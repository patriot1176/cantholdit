import { Router, type IRouter } from "express";
import { db, pool } from "@workspace/db";
import { sql } from "drizzle-orm";
import { STATIC_STOPS } from "../data/static-stops";

const router: IRouter = Router();

const ADMIN_KEY = process.env.ADMIN_SEED_KEY || "cant-hold-it-seed";

/**
 * POST /api/admin/seed-rest-areas?key=<ADMIN_SEED_KEY>
 *
 * Inserts all 151 curated US rest stops (130 rest areas, 15 gas stations,
 * 6 truck stops) from the bundled static dataset into the database.
 * Any stop already within ~1 km of an existing entry is skipped.
 *
 * Safe to re-run — duplicates are always skipped.
 * No external network calls required.
 */
router.post("/admin/seed-rest-areas", async (req, res): Promise<void> => {
  if (req.query.key !== ADMIN_KEY) {
    res.status(401).json({ error: "Invalid key" });
    return;
  }

  try {
    let inserted = 0;
    let skipped = 0;

    for (const stop of STATIC_STOPS) {
      const nearby = await db.execute(sql`
        SELECT id FROM stops
        WHERE ABS(lat - ${stop.lat}) < 0.01
          AND ABS(lng - ${stop.lng}) < 0.01
        LIMIT 1
      `);
      if (nearby.rows.length > 0) {
        skipped++;
        continue;
      }
      await db.execute(sql`
        INSERT INTO stops (name, address, type, lat, lng, hours)
        VALUES (${stop.name}, ${stop.address}, ${stop.type}, ${stop.lat}, ${stop.lng}, ${stop.hours ?? null})
      `);
      inserted++;
    }

    const total = await db.execute(sql`SELECT count(*) FROM stops`);

    res.json({
      message: "Seed complete",
      datasetSize: STATIC_STOPS.length,
      inserted,
      skipped,
      totalStops: Number((total.rows[0] as any).count),
    });
  } catch (err: any) {
    console.error("Seed error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Overpass helpers ───────────────────────────────────────────────────────

const OVERPASS_URL = "https://overpass.kumi.systems/api/interpreter";

/** Extract the first US highway reference found in an OSM name/ref string */
function extractHighwayRef(tags: Record<string, string>): string | null {
  const src = `${tags.name || ""} ${tags.ref || ""}`;
  const m = src.match(/\b(I[-–]\d+[A-Z]?|US[-–]\d+|SR[-–]\d+|US\s+\d+|I\s+\d+)\b/i);
  if (m) return m[1].replace(/\s+/, "-").replace("–", "-");
  return null;
}

/** Build a human-readable address from OSM tags */
function buildOverpassAddress(tags: Record<string, string>): string {
  if (tags["addr:full"]) return tags["addr:full"];
  if (tags["addr:street"]) return tags["addr:street"];
  const hw = extractHighwayRef(tags);
  if (hw) return `${hw} Rest Area`;
  return "US Highway Rest Area";
}

async function queryOverpass(bbox: string): Promise<any[]> {
  const query = `[out:json][timeout:30];(node["highway"="rest_area"](${bbox});way["highway"="rest_area"](${bbox}););out center;`;
  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "data=" + encodeURIComponent(query),
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}`);
  const data = await res.json();
  return data.elements || [];
}

/**
 * POST /api/admin/seed-overpass?key=<ADMIN_SEED_KEY>
 *
 * Queries the Overpass API (OpenStreetMap) for every highway rest_area node
 * in the continental US, filtered to named stops only, and inserts any that
 * aren't already within ~500 m of an existing stop.  Safe to re-run.
 */
router.post("/admin/seed-overpass", async (req, res): Promise<void> => {
  if (req.query.key !== ADMIN_KEY) {
    res.status(401).json({ error: "Invalid key" });
    return;
  }

  // Continental US split into manageable bboxes (south,west,north,east)
  const REGIONS = [
    { name: "New England",    bbox: "41,-74,47,-67" },
    { name: "Mid-Atlantic",   bbox: "37,-80,42,-73" },
    { name: "Southeast",      bbox: "25,-88,37,-79" },
    { name: "Appalachian",    bbox: "34,-90,37,-81" },
    { name: "Great Lakes",    bbox: "38,-92,47,-82" },
    { name: "Upper Midwest",  bbox: "40,-97,47,-89" },
    { name: "Texas & Gulf",   bbox: "25,-107,37,-94" },
    { name: "Great Plains",   bbox: "37,-105,46,-95" },
    { name: "Mountain",       bbox: "37,-117,47,-103" },
    { name: "Southwest",      bbox: "31,-114,37,-103" },
    { name: "Pacific",        bbox: "32,-125,49,-117" },
  ];

  const results: Record<string, { inserted: number; skipped: number; error?: string }> = {};
  let totalInserted = 0;
  let totalSkipped = 0;

  for (const region of REGIONS) {
    try {
      const elements = await queryOverpass(region.bbox);
      let inserted = 0;
      let skipped = 0;

      for (const el of elements) {
        const lat: number = el.lat ?? el.center?.lat;
        const lng: number = el.lon ?? el.center?.lon;
        const tags: Record<string, string> = el.tags || {};
        const name = tags.name?.trim().replace(/^["']+|["']+$/g, "");

        // Require a real name and valid continental-US coordinates
        if (!name || name.length < 3) { skipped++; continue; }
        if (!lat || !lng || lat < 24 || lat > 50 || lng < -126 || lng > -65) { skipped++; continue; }

        // Skip if within ~500 m of an existing stop
        const nearby = await db.execute(sql`
          SELECT id FROM stops
          WHERE ABS(lat - ${lat}) < 0.005
            AND ABS(lng - ${lng}) < 0.005
          LIMIT 1
        `);
        if (nearby.rows.length > 0) { skipped++; continue; }

        const address = buildOverpassAddress(tags);
        const highway = extractHighwayRef(tags);

        await db.execute(sql`
          INSERT INTO stops (name, address, type, lat, lng, hours, highway)
          VALUES (${name}, ${address}, 'rest_area', ${lat}, ${lng}, null, ${highway})
        `);
        inserted++;
      }

      results[region.name] = { inserted, skipped };
      totalInserted += inserted;
      totalSkipped += skipped;
    } catch (err: any) {
      results[region.name] = { inserted: 0, skipped: 0, error: err.message };
    }

    // Brief pause to avoid overwhelming the Overpass API
    await new Promise((r) => setTimeout(r, 1500));
  }

  const total = await db.execute(sql`SELECT count(*) FROM stops`);
  res.json({
    message: "Overpass seed complete",
    totalInserted,
    totalSkipped,
    totalStops: Number((total.rows[0] as any).count),
    regions: results,
  });
});

/**
 * POST /api/admin/cleanup-placeholders?key=<ADMIN_SEED_KEY>
 *
 * Removes French-Canadian placeholder stops (Belvédère, Parc de, etc.) that
 * were imported from OpenStreetMap and are irrelevant to US road trippers.
 * Keeps exactly one per stop type as a clearly-labelled "Example" entry.
 * Also fixes any remaining stops with trailing spaces in their name.
 *
 * Safe to re-run — uses name matching, already-renamed entries are skipped.
 */
router.post("/admin/cleanup-placeholders", async (req, res): Promise<void> => {
  if (req.query.key !== ADMIN_KEY) {
    res.status(401).json({ error: "Invalid key" });
    return;
  }

  try {
    // 1. Fix trailing-space placeholder stops (e.g. "Pilot ", "Culver's ")
    await db.execute(sql`
      UPDATE stops
      SET name    = 'Example - Truck Stop',
          address = 'Example stop — add a real one near you!',
          lat     = 39.8,
          lng     = -98.6
      WHERE name = 'Pilot ' AND type = 'truck_stop'
    `);
    await db.execute(sql`
      UPDATE stops
      SET name    = 'Example - Fast Food',
          address = 'Example stop — add a real one near you!',
          lat     = 39.8,
          lng     = -98.5
      WHERE name = 'Culver''s ' AND type = 'fast_food'
    `);

    // 2. Rename the first Belvédère/French-Canadian rest_area to "Example - Rest Area"
    //    so we keep one per type for reference.
    await db.execute(sql`
      UPDATE stops
      SET name    = 'Example - Rest Area',
          address = 'Example stop — add a real one near you!'
      WHERE type = 'rest_area'
        AND (
          name ILIKE '%belvédère%' OR name ILIKE '%belvedere%' OR
          name ILIKE 'parc de%' OR name ILIKE 'le parc%' OR
          name ILIKE 'l''abri%' OR name ILIKE 'relais de%' OR
          name ILIKE 'stationnement%' OR name ILIKE 'banc de repos%'
        )
        AND id = (
          SELECT id FROM stops
          WHERE type = 'rest_area'
            AND (
              name ILIKE '%belvédère%' OR name ILIKE '%belvedere%' OR
              name ILIKE 'parc de%' OR name ILIKE 'le parc%' OR
              name ILIKE 'l''abri%' OR name ILIKE 'relais de%' OR
              name ILIKE 'stationnement%' OR name ILIKE 'banc de repos%'
            )
          ORDER BY id
          LIMIT 1
        )
    `);

    // 3. Delete remaining French-Canadian / non-US placeholder stops
    const deleteResult = await db.execute(sql`
      DELETE FROM stops
      WHERE (
        name ILIKE '%belvédère%' OR name ILIKE '%belvedere%' OR
        name ILIKE 'parc de%' OR name ILIKE 'le parc%' OR
        name ILIKE 'l''abri%' OR name ILIKE 'relais de%' OR
        name ILIKE 'stationnement%' OR name ILIKE 'banc de repos%'
      )
        AND name NOT ILIKE 'example%'
    `);

    // 4. Fix any remaining name trailing-space issues
    await db.execute(sql`
      UPDATE stops SET name = TRIM(name) WHERE name != TRIM(name)
    `);

    const total = await db.execute(sql`SELECT count(*) FROM stops`);

    res.json({
      message: "Cleanup complete",
      deletedPlaceholders: Number((deleteResult as any).rowCount ?? 0),
      totalStops: Number((total.rows[0] as any).count),
    });
  } catch (err: any) {
    console.error("Cleanup error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/seed-batch?key=<ADMIN_SEED_KEY>
 *
 * Accepts a JSON body: { stops: Array<{name,address,type,lat,lng,highway?,amenities?}> }
 * Deduplicates against existing stops within ~500 m and bulk-inserts new ones.
 * Safe to re-run — already-present stops are silently skipped.
 */
router.post("/admin/seed-batch", async (req, res): Promise<void> => {
  if (req.query.key !== ADMIN_KEY) {
    res.status(401).json({ error: "Invalid key" });
    return;
  }

  const incoming = req.body?.stops;
  if (!Array.isArray(incoming) || incoming.length === 0) {
    res.status(400).json({ error: "Body must be { stops: [...] }" });
    return;
  }

  let inserted = 0;
  let skipped = 0;

  for (const s of incoming) {
    const { name, address, type, lat, lng, highway, amenities } = s;

    if (!name || typeof lat !== "number" || typeof lng !== "number") { skipped++; continue; }
    if (lat < 24 || lat > 50 || lng < -126 || lng > -65) { skipped++; continue; }

    const nearby = await db.execute(sql`
      SELECT id FROM stops
      WHERE ABS(lat - ${lat}) < 0.005
        AND ABS(lng - ${lng}) < 0.005
      LIMIT 1
    `);
    if (nearby.rows.length > 0) { skipped++; continue; }

    const amenitiesJson = amenities ? (typeof amenities === "string" ? amenities : JSON.stringify(amenities)) : null;

    await db.execute(sql`
      INSERT INTO stops (name, address, type, lat, lng, hours, highway, amenities)
      VALUES (${name}, ${address ?? "US Highway Rest Area"}, ${type ?? "rest_area"}, ${lat}, ${lng}, null, ${highway ?? null}, ${amenitiesJson})
    `);
    inserted++;
  }

  const total = await db.execute(sql`SELECT count(*) FROM stops`);
  res.json({
    message: "Batch seed complete",
    received: incoming.length,
    inserted,
    skipped,
    totalStops: Number((total.rows[0] as any).count),
  });
});

/**
 * POST /api/admin/seed-walmart?key=<ADMIN_SEED_KEY>
 *
 * Queries Overpass for all Walmart Supercenters / stores in the continental US
 * and inserts them as `gas_station` type (they're primarily bathroom + fuel stops
 * for road trippers).  Deduplicates by proximity. Safe to re-run.
 */
router.post("/admin/seed-walmart", async (req, res): Promise<void> => {
  if (req.query.key !== ADMIN_KEY) {
    res.status(401).json({ error: "Invalid key" });
    return;
  }

  const REGIONS = [
    { name: "Northeast",   bbox: "37,-80,47,-67" },
    { name: "Southeast",   bbox: "25,-88,37,-79" },
    { name: "Appalachian", bbox: "34,-90,37,-81" },
    { name: "Midwest",     bbox: "37,-97,47,-82" },
    { name: "Texas+Gulf",  bbox: "25,-107,37,-94" },
    { name: "Plains",      bbox: "37,-105,47,-95" },
    { name: "Mountain",    bbox: "37,-117,47,-103" },
    { name: "Southwest",   bbox: "31,-114,37,-103" },
    { name: "Pacific",     bbox: "32,-125,49,-117" },
  ];

  const results: Record<string, { inserted: number; skipped: number; error?: string }> = {};
  let totalInserted = 0;

  for (const region of REGIONS) {
    try {
      const walmartQuery = `[out:json][timeout:30];node["brand"="Walmart"](${region.bbox});out;`;
      const resp = await fetch(OVERPASS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(walmartQuery),
      });
      if (!resp.ok) throw new Error(`Overpass ${resp.status}`);
      const data = await resp.json();
      const els: any[] = data.elements || [];

      let inserted = 0, skipped = 0;
      for (const el of els) {
        const lat = el.lat ?? el.center?.lat;
        const lng = el.lon ?? el.center?.lon;
        const tags = el.tags || {};
        const name = (tags.name || tags.brand || "Walmart").trim();
        if (!lat || !lng || lat < 24 || lat > 50 || lng < -126 || lng > -65) { skipped++; continue; }

        const nearby = await db.execute(sql`SELECT id FROM stops WHERE ABS(lat - ${lat}) < 0.004 AND ABS(lng - ${lng}) < 0.004 LIMIT 1`);
        if (nearby.rows.length > 0) { skipped++; continue; }

        const city = tags["addr:city"] || "";
        const state = tags["addr:state"] || "";
        const street = tags["addr:street"] || "";
        const address = [street, city, state].filter(Boolean).join(", ") || "Walmart";

        await db.execute(sql`INSERT INTO stops (name, address, type, lat, lng, hours, highway, amenities) VALUES (${name}, ${address}, 'walmart', ${lat}, ${lng}, null, null, ${JSON.stringify(["restrooms", "accessible", "parking", "vending"])})`);
        inserted++;
      }
      results[region.name] = { inserted, skipped };
      totalInserted += inserted;
    } catch (err: any) {
      results[region.name] = { inserted: 0, skipped: 0, error: err.message };
    }
    await new Promise((r) => setTimeout(r, 1200));
  }

  const total = await db.execute(sql`SELECT count(*) FROM stops`);
  res.json({ message: "Walmart seed complete", totalInserted, totalStops: Number((total.rows[0] as any).count), regions: results });
});

/**
 * POST /api/admin/seed-fastfood?key=<ADMIN_SEED_KEY>
 *
 * Queries Overpass for major fast-food chains (McDonald's, Subway, Taco Bell,
 * Burger King, Wendy's, Chick-fil-A, Arby's, Sonic, Dairy Queen, Starbucks)
 * and inserts them as `fast_food` type. Deduplicates by proximity.
 */
router.post("/admin/seed-fastfood", async (req, res): Promise<void> => {
  if (req.query.key !== ADMIN_KEY) {
    res.status(401).json({ error: "Invalid key" });
    return;
  }

  const CHAINS = [
    "McDonald's", "Subway", "Taco Bell", "Burger King", "Wendy's",
    "Chick-fil-A", "Arby's", "Sonic", "Dairy Queen", "Starbucks",
    "Dunkin'", "Panera Bread", "Popeyes", "KFC", "Hardee's",
  ];
  const brandFilter = CHAINS.map((c) => `["brand"="${c}"]`).join("|");
  // Use a single regex on the brand tag
  const brandRegex = CHAINS.map((c) => c.replace(/'/g, "\\'")).join("|");

  const REGIONS = [
    { name: "Northeast",   bbox: "37,-80,47,-67" },
    { name: "Southeast",   bbox: "25,-88,37,-79" },
    { name: "Appalachian", bbox: "34,-90,37,-81" },
    { name: "Midwest",     bbox: "37,-97,47,-82" },
    { name: "Texas+Gulf",  bbox: "25,-107,37,-94" },
    { name: "Plains",      bbox: "37,-105,47,-95" },
    { name: "Mountain",    bbox: "37,-117,47,-103" },
    { name: "Southwest",   bbox: "31,-114,37,-103" },
    { name: "Pacific",     bbox: "32,-125,49,-117" },
  ];

  const results: Record<string, { inserted: number; skipped: number; error?: string }> = {};
  let totalInserted = 0;

  for (const region of REGIONS) {
    try {
      const query = `[out:json][timeout:30];node["amenity"="fast_food"]["brand"~"${brandRegex}"](${region.bbox});out;`;
      const resp = await fetch(OVERPASS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(query),
      });
      if (!resp.ok) throw new Error(`Overpass ${resp.status}`);
      const data = await resp.json();
      const els: any[] = data.elements || [];

      let inserted = 0, skipped = 0;
      for (const el of els) {
        const lat = el.lat ?? el.center?.lat;
        const lng = el.lon ?? el.center?.lon;
        const tags = el.tags || {};
        const name = (tags.brand || tags.name || "").trim();
        if (!name || !lat || !lng || lat < 24 || lat > 50 || lng < -126 || lng > -65) { skipped++; continue; }

        const nearby = await db.execute(sql`SELECT id FROM stops WHERE ABS(lat - ${lat}) < 0.003 AND ABS(lng - ${lng}) < 0.003 LIMIT 1`);
        if (nearby.rows.length > 0) { skipped++; continue; }

        const city = tags["addr:city"] || "";
        const state = tags["addr:state"] || "";
        const street = tags["addr:housenumber"] ? `${tags["addr:housenumber"]} ${tags["addr:street"] || ""}`.trim() : (tags["addr:street"] || "");
        const address = [street, city, state].filter(Boolean).join(", ") || name;

        await db.execute(sql`INSERT INTO stops (name, address, type, lat, lng, hours, highway, amenities) VALUES (${name}, ${address}, 'fast_food', ${lat}, ${lng}, ${tags.opening_hours || null}, null, ${JSON.stringify(["restrooms", "food"])})`);
        inserted++;
      }
      results[region.name] = { inserted, skipped };
      totalInserted += inserted;
    } catch (err: any) {
      results[region.name] = { inserted: 0, skipped: 0, error: err.message };
    }
    await new Promise((r) => setTimeout(r, 1200));
  }

  const total = await db.execute(sql`SELECT count(*) FROM stops`);
  res.json({ message: "Fast food seed complete", totalInserted, totalStops: Number((total.rows[0] as any).count), regions: results });
});

/**
 * POST /api/admin/fix-stop-types?key=<ADMIN_SEED_KEY>
 *
 * Corrects the `type` field for known commercial chains that were imported
 * as the wrong type. Safe to re-run.
 */
router.post("/admin/fix-stop-types", async (req, res): Promise<void> => {
  if (req.query.key !== ADMIN_KEY) {
    res.status(401).json({ error: "Invalid key" });
    return;
  }
  // 1. Fix Walmart stops → walmart type
  const walmartFix = await db.execute(sql`
    UPDATE stops SET type = 'walmart'
    WHERE name ILIKE '%walmart%'
      AND type IN ('gas_station', 'other', 'truck_stop')
  `);

  // 2. Fix Buc-ee's → gas_station (large travel center, NOT a truck stop)
  const buceeFix = await db.execute(sql`
    UPDATE stops SET type = 'gas_station'
    WHERE (name ILIKE 'Buc-ee%' OR name ILIKE 'Bucee%')
      AND type IN ('truck_stop', 'other')
  `);

  // 3. Fix major truck stop chains → truck_stop
  const truckFix = await db.execute(sql`
    UPDATE stops SET type = 'truck_stop'
    WHERE type IN ('gas_station', 'other')
      AND (
        name ILIKE 'Love%'
        OR name ILIKE 'Pilot%'
        OR name ILIKE 'Flying J%'
        OR name ILIKE 'TravelCenters%'
        OR name ILIKE 'TA Travel%'
        OR name ILIKE 'Petro %'
        OR name ILIKE 'Pilot Travel%'
      )
  `);

  const total = await db.execute(sql`SELECT type, count(*) as cnt FROM stops GROUP BY type ORDER BY cnt DESC`);
  res.json({
    message: "Type fix complete",
    walmartFixed: Number((walmartFix as any).rowCount ?? 0),
    buceeFixed: Number((buceeFix as any).rowCount ?? 0),
    truckFixed: Number((truckFix as any).rowCount ?? 0),
    breakdown: (total.rows as any[]).map((r) => ({ type: r.type, count: Number(r.cnt) })),
  });
});

/**
 * POST /api/admin/migrate-enum?key=<ADMIN_SEED_KEY>
 *
 * Adds the 'walmart' value to the stop_type enum (if not present) and then
 * re-types Walmart stops + fixes Buc-ee's. Safe to re-run.
 */
router.post("/admin/migrate-enum", async (req, res): Promise<void> => {
  if (req.query.key !== ADMIN_KEY) {
    res.status(401).json({ error: "Invalid key" });
    return;
  }
  const client = await pool.connect();
  try {
    // ALTER TYPE ADD VALUE cannot run inside a transaction — use raw client
    await client.query("ALTER TYPE stop_type ADD VALUE IF NOT EXISTS 'walmart'");
    await client.query("ALTER TYPE stop_type ADD VALUE IF NOT EXISTS 'other'");

    // Fix Walmart stops
    const walmartRes = await client.query(
      "UPDATE stops SET type='walmart' WHERE name ILIKE '%walmart%' AND type IN ('gas_station','other','truck_stop')"
    );
    // Fix Buc-ee's → gas_station
    const buceeRes = await client.query(
      "UPDATE stops SET type='gas_station' WHERE (name ILIKE 'Buc-ee%' OR name ILIKE 'Bucee%') AND type IN ('truck_stop','other')"
    );
    // Fix real truck stops
    const truckRes = await client.query(
      `UPDATE stops SET type='truck_stop' WHERE type IN ('gas_station','other') AND (
        name ILIKE 'Love%' OR name ILIKE 'Pilot%' OR name ILIKE 'Flying J%' OR
        name ILIKE 'TravelCenters%' OR name ILIKE 'TA Travel%' OR name ILIKE 'Petro %'
      )`
    );

    const breakdownRes = await client.query(
      "SELECT type, count(*) as cnt FROM stops GROUP BY type ORDER BY cnt DESC"
    );

    res.json({
      message: "Enum migration complete",
      walmartFixed: walmartRes.rowCount,
      buceeFixed: buceeRes.rowCount,
      truckFixed: truckRes.rowCount,
      breakdown: breakdownRes.rows.map((r: any) => ({ type: r.type, count: Number(r.cnt) })),
    });
  } finally {
    client.release();
  }
});

/**
 * POST /api/admin/seed-ohio?key=<ADMIN_SEED_KEY>
 *
 * Targeted gap-fill for Ohio, Indiana, Kentucky, and western Pennsylvania —
 * the geographic seam missed between the Midwest and Northeast bboxes.
 * Seeds both Walmart stores and fast-food chains.
 * Safe to re-run (deduplicates by proximity).
 */
router.post("/admin/seed-ohio", async (req, res): Promise<void> => {
  if (req.query.key !== ADMIN_KEY) {
    res.status(401).json({ error: "Invalid key" });
    return;
  }

  // Split into smaller sub-regions to avoid Overpass timeouts
  const SUB_REGIONS = [
    { name: "Ohio-West",   bbox: "38,-85,42,-82" },   // Dayton, Columbus, Toledo
    { name: "Ohio-East",   bbox: "38,-82,42,-80" },   // Cleveland, Akron, Canton
    { name: "Indiana-E",   bbox: "38,-87,42,-85" },   // Indianapolis east, Fort Wayne
    { name: "Kentucky-N",  bbox: "36,-87,38,-80" },   // Lexington, Louisville, Cincinnati
    { name: "W-PA",        bbox: "39,-80,42,-77" },   // Pittsburgh area
    { name: "Michigan-S",  bbox: "41,-87,43,-82" },   // Detroit area, Flint, Lansing
  ];

  const CHAINS = [
    "McDonald's", "Subway", "Taco Bell", "Burger King", "Wendy's",
    "Chick-fil-A", "Arby's", "Sonic", "Dairy Queen", "Starbucks",
    "Dunkin'", "Panera Bread", "Popeyes", "KFC", "Hardee's",
    "Bob Evans", "Skyline Chili",
  ];
  const brandRegex = CHAINS.map((c) => c.replace(/'/g, "\\'")).join("|");

  const results: Record<string, { walmart: number; fastFood: number; skipped: number; error?: string }> = {};
  let totalInserted = 0;

  for (const region of SUB_REGIONS) {
    let walmartInserted = 0, fastFoodInserted = 0, skipped = 0;
    try {
      // Walmart
      const walmartQuery = `[out:json][timeout:30];node["brand"="Walmart"](${region.bbox});out;`;
      const wResp = await fetch(OVERPASS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(walmartQuery),
      });
      if (wResp.ok) {
        const wData = await wResp.json();
        for (const el of (wData.elements || [])) {
          const lat = el.lat, lng = el.lon;
          const tags = el.tags || {};
          const name = (tags.brand || tags.name || "Walmart").trim();
          if (!lat || !lng || lat < 24 || lat > 50 || lng < -126 || lng > -65) { skipped++; continue; }
          const nearby = await db.execute(sql`SELECT id FROM stops WHERE ABS(lat - ${lat}) < 0.003 AND ABS(lng - ${lng}) < 0.003 LIMIT 1`);
          if (nearby.rows.length > 0) { skipped++; continue; }
          const city = tags["addr:city"] || "";
          const state = tags["addr:state"] || "";
          const address = [city, state].filter(Boolean).join(", ") || name;
          await db.execute(sql`INSERT INTO stops (name, address, type, lat, lng, hours, highway, amenities) VALUES (${name}, ${address}, 'walmart', ${lat}, ${lng}, ${tags.opening_hours || null}, null, ${JSON.stringify(["restrooms", "parking"])})`);
          walmartInserted++;
        }
      }

      await new Promise((r) => setTimeout(r, 1000));

      // Fast food
      const ffQuery = `[out:json][timeout:30];node["amenity"="fast_food"]["brand"~"${brandRegex}"](${region.bbox});out;`;
      const fResp = await fetch(OVERPASS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(ffQuery),
      });
      if (fResp.ok) {
        const fData = await fResp.json();
        for (const el of (fData.elements || [])) {
          const lat = el.lat, lng = el.lon;
          const tags = el.tags || {};
          const name = (tags.brand || tags.name || "").trim();
          if (!name || !lat || !lng || lat < 24 || lat > 50 || lng < -126 || lng > -65) { skipped++; continue; }
          const nearby = await db.execute(sql`SELECT id FROM stops WHERE ABS(lat - ${lat}) < 0.003 AND ABS(lng - ${lng}) < 0.003 LIMIT 1`);
          if (nearby.rows.length > 0) { skipped++; continue; }
          const city = tags["addr:city"] || "";
          const state = tags["addr:state"] || "";
          const street = tags["addr:housenumber"] ? `${tags["addr:housenumber"]} ${tags["addr:street"] || ""}`.trim() : (tags["addr:street"] || "");
          const address = [street, city, state].filter(Boolean).join(", ") || name;
          await db.execute(sql`INSERT INTO stops (name, address, type, lat, lng, hours, highway, amenities) VALUES (${name}, ${address}, 'fast_food', ${lat}, ${lng}, ${tags.opening_hours || null}, null, ${JSON.stringify(["restrooms", "food"])})`);
          fastFoodInserted++;
        }
      }

      results[region.name] = { walmart: walmartInserted, fastFood: fastFoodInserted, skipped };
      totalInserted += walmartInserted + fastFoodInserted;
    } catch (err: any) {
      results[region.name] = { walmart: walmartInserted, fastFood: fastFoodInserted, skipped, error: err.message };
    }
    await new Promise((r) => setTimeout(r, 1200));
  }

  const total = await db.execute(sql`SELECT count(*) FROM stops`);
  res.json({
    message: "Ohio gap-fill complete",
    totalInserted,
    results,
    totalStops: Number((total.rows[0] as any).count),
  });
});

/**
 * POST /api/admin/replace-bucees?key=<ADMIN_SEED_KEY>
 *
 * Wipes all existing Buc-ee's stops and re-inserts the complete official
 * location list from buc-ees.com. Handles FK constraints by deleting
 * ratings and reports first, then stops, then inserting fresh data.
 */
router.post("/admin/replace-bucees", async (req, res): Promise<void> => {
  if (req.query.key !== ADMIN_KEY) {
    res.status(401).json({ error: "Invalid key" });
    return;
  }

  const AMENITIES = JSON.stringify(["restrooms", "food", "gas", "parking", "shower"]);

  // Complete official Buc-ee's location list (from buc-ees.com)
  const LOCATIONS = [
    // Alabama
    { name: "Buc-ee's Athens",          address: "2328 Lindsay Lane South, Athens, AL 35613",                lat: 34.790, lng: -86.951 },
    { name: "Buc-ee's Auburn",          address: "2500 Buc-ee's Blvd, Auburn, AL 36832",                    lat: 32.603, lng: -85.480 },
    { name: "Buc-ee's Leeds",           address: "6900 Buc-ee's Blvd, Leeds, AL 35094",                     lat: 33.548, lng: -86.557 },
    { name: "Buc-ee's Loxley",          address: "20403 County Rd. 68, Robertsdale, AL 36567",              lat: 30.617, lng: -87.779 },
    // Colorado
    { name: "Buc-ee's Johnstown",       address: "5201 Nugget Road, Berthoud, CO 80513",                    lat: 40.354, lng: -104.978 },
    // Florida
    { name: "Buc-ee's Daytona Beach",   address: "2330 Gateway North Drive, Daytona Beach, FL 32117",       lat: 29.143, lng: -81.083 },
    { name: "Buc-ee's Saint Augustine", address: "200 World Commerce Pkwy, Saint Augustine, FL 32092",      lat: 29.889, lng: -81.342 },
    // Georgia
    { name: "Buc-ee's Brunswick",       address: "6900 Hwy 99, Brunswick, GA 31525",                        lat: 31.226, lng: -81.573 },
    { name: "Buc-ee's Calhoun",         address: "601 Union Grove Rd SE, Adairsville, GA 30103",            lat: 34.487, lng: -84.939 },
    { name: "Buc-ee's Warner Robins",   address: "7001 Russell Parkway, Fort Valley, GA 31030",             lat: 32.549, lng: -83.849 },
    // Kentucky
    { name: "Buc-ee's Richmond",        address: "1013 Buc-ee's Blvd, Richmond, KY 40475",                  lat: 37.748, lng: -84.296 },
    { name: "Buc-ee's Smiths Grove",    address: "4001 Smiths Grove-Scottsville Rd, Smiths Grove, KY 42171", lat: 37.046, lng: -86.218 },
    // Mississippi
    { name: "Buc-ee's Harrison County", address: "8245 Firetower Road, Pass Christian, MS 39571",           lat: 30.319, lng: -89.248 },
    // Missouri
    { name: "Buc-ee's Springfield",     address: "3284 N Beaver Rd, Springfield, MO 65803",                 lat: 37.286, lng: -93.298 },
    // Ohio (opening April 6 2026)
    { name: "Buc-ee's Huber Heights",   address: "8000 State Route 235, Huber Heights, OH 45424",           lat: 39.861, lng: -84.122 },
    // South Carolina
    { name: "Buc-ee's Florence",        address: "3390 North Williston Road, Florence, SC 29506",           lat: 34.245, lng: -79.763 },
    // Tennessee
    { name: "Buc-ee's Crossville",      address: "2045 Genesis Road, Crossville, TN 38555",                 lat: 35.961, lng: -85.031 },
    { name: "Buc-ee's Sevierville",     address: "170 Buc-ee's Blvd, Kodak, TN 37764",                      lat: 35.931, lng: -83.567 },
    // Virginia
    { name: "Buc-ee's Rockingham County", address: "6500 Buc-ee's Blvd, Mount Crawford, VA 22841",          lat: 38.354, lng: -78.937 },
    // Texas
    { name: "Buc-ee's Alvin",           address: "780 Hwy-35 N Byp, Alvin, TX 77511",                      lat: 29.395, lng: -95.248 },
    { name: "Buc-ee's Amarillo",        address: "9900 East Interstate 40, Amarillo, TX 79118",             lat: 35.193, lng: -101.684 },
    { name: "Buc-ee's Angleton",        address: "2299 E Mulberry St, Angleton, TX 77515",                  lat: 29.176, lng: -95.418 },
    { name: "Buc-ee's Angleton North",  address: "931 Loop 274, Angleton, TX 77515",                        lat: 29.182, lng: -95.434 },
    { name: "Buc-ee's Angleton West",   address: "2304 W Mulberry St, Angleton, TX 77515",                  lat: 29.168, lng: -95.452 },
    { name: "Buc-ee's Bastrop",         address: "1700 Highway 71 East, Bastrop, TX 78602",                 lat: 30.107, lng: -97.297 },
    { name: "Buc-ee's Baytown",         address: "4080 East Freeway, Baytown, TX 77521",                    lat: 29.753, lng: -94.981 },
    { name: "Buc-ee's Brazoria",        address: "801 N Brooks, Brazoria, TX 77422",                        lat: 29.053, lng: -95.561 },
    { name: "Buc-ee's Cypress",         address: "27106 US-290, Cypress, TX 77433",                         lat: 29.971, lng: -95.698 },
    { name: "Buc-ee's Denton",          address: "2800 S Interstate 35 E, Denton, TX 76210",                lat: 33.142, lng: -97.144 },
    { name: "Buc-ee's Eagle Lake",      address: "505 E Main St, Eagle Lake, TX 77434",                     lat: 29.590, lng: -96.328 },
    { name: "Buc-ee's Ennis",           address: "1402 South IH-45, Ennis, TX 75119",                       lat: 32.295, lng: -96.628 },
    { name: "Buc-ee's Fort Worth",      address: "15901 N Freeway, Fort Worth, TX 76177",                   lat: 32.981, lng: -97.309 },
    { name: "Buc-ee's Freeport",        address: "4231 E. Hwy 332, Freeport, TX 77541",                     lat: 28.960, lng: -95.329 },
    { name: "Buc-ee's Freeport Brazosport", address: "1002 N Brazosport Blvd, Freeport, TX 77541",         lat: 28.956, lng: -95.358 },
    { name: "Buc-ee's Giddings",        address: "2375 E Austin St, Giddings, TX 78942",                    lat: 30.188, lng: -96.917 },
    { name: "Buc-ee's Hillsboro",       address: "165 State Highway 77, Hillsboro, TX 76645",               lat: 31.974, lng: -97.129 },
    { name: "Buc-ee's Katy",            address: "27700 Katy Fwy, Katy, TX 77494",                          lat: 29.783, lng: -95.837 },
    { name: "Buc-ee's Lake Jackson",    address: "999 Oyster Creek Drive, Lake Jackson, TX 77566",          lat: 29.028, lng: -95.447 },
    { name: "Buc-ee's Lake Jackson North", address: "101 N Hwy 2004, Lake Jackson, TX 77566",              lat: 29.036, lng: -95.443 },
    { name: "Buc-ee's Lake Jackson West", address: "598 Hwy 332, Lake Jackson, TX 77566",                  lat: 29.010, lng: -95.471 },
    { name: "Buc-ee's League City",     address: "1702 League City Pkwy, League City, TX 77573",            lat: 29.480, lng: -95.095 },
    { name: "Buc-ee's Luling",          address: "10070 West IH 10, Luling, TX 77648",                      lat: 29.674, lng: -97.657 },
    { name: "Buc-ee's Madisonville",    address: "205 IH-45 South, Madisonville, TX 77864",                 lat: 30.938, lng: -95.910 },
    { name: "Buc-ee's Melissa",         address: "1550 Central Texas Expressway, Melissa, TX 75454",        lat: 33.281, lng: -96.568 },
    { name: "Buc-ee's New Braunfels",   address: "2760 IH 35 North, New Braunfels, TX 78130",               lat: 29.691, lng: -98.079 },
    { name: "Buc-ee's Pearland",        address: "2541 S Main St, Pearland, TX 77584",                      lat: 29.524, lng: -95.286 },
    { name: "Buc-ee's Pearland Shadow Creek", address: "11151 Shadow Creek Pky, Pearland, TX 77584",       lat: 29.617, lng: -95.413 },
    { name: "Buc-ee's Port Lavaca",     address: "2318 W Main, Port Lavaca, TX 77979",                      lat: 28.618, lng: -96.653 },
    { name: "Buc-ee's Richmond TX",     address: "1243 Crabb River Rd, Richmond, TX 77469",                 lat: 29.543, lng: -95.747 },
    { name: "Buc-ee's Royse City",      address: "5005 E Interstate 30, Royse City, TX 75189",              lat: 32.982, lng: -96.279 },
    { name: "Buc-ee's Temple",          address: "4155 N General Bruce Dr, Temple, TX 76501",               lat: 31.115, lng: -97.370 },
    { name: "Buc-ee's Terrell",         address: "506 W. IH 20, Terrell, TX 75160",                         lat: 32.738, lng: -96.285 },
    { name: "Buc-ee's Texas City",      address: "6201 Gulf Fwy (IH 45), Texas City, TX 77591",             lat: 29.348, lng: -94.939 },
    { name: "Buc-ee's Waller",          address: "40900 US Hwy 290 Bypass, Waller, TX 77484",               lat: 30.059, lng: -95.927 },
    { name: "Buc-ee's Wharton",         address: "10484 US 59 Road, Wharton, TX 77488",                     lat: 29.269, lng: -96.066 },
  ];

  const client = await pool.connect();
  try {
    // Step 1: Find all current Buc-ee's stop IDs
    const existing = await client.query(
      `SELECT id FROM stops WHERE name ILIKE 'buc-ee%' OR name ILIKE 'bucee%'`
    );
    const ids = existing.rows.map((r: any) => r.id);

    if (ids.length > 0) {
      const idList = ids.join(",");
      // Step 2: Delete ratings and reports first (no cascade), then stops
      await client.query(`DELETE FROM ratings WHERE stop_id IN (${idList})`);
      await client.query(`DELETE FROM reports WHERE stop_id IN (${idList})`);
      // Photos cascade automatically
      await client.query(`DELETE FROM stops WHERE id IN (${idList})`);
    }

    // Step 3: Insert complete official list
    let inserted = 0;
    for (const loc of LOCATIONS) {
      await client.query(
        `INSERT INTO stops (name, address, type, lat, lng, hours, highway, amenities)
         VALUES ($1, $2, 'gas_station', $3, $4, null, null, $5)`,
        [loc.name, loc.address, loc.lat, loc.lng, AMENITIES]
      );
      inserted++;
    }

    const total = await client.query(`SELECT count(*) FROM stops`);

    res.json({
      message: "Buc-ee's fully replaced with official list",
      removedOld: ids.length,
      inserted,
      totalStops: Number(total.rows[0].count),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

export default router;
