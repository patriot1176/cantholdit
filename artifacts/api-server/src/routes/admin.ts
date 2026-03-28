import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
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

        await db.execute(sql`INSERT INTO stops (name, address, type, lat, lng, hours, highway, amenities) VALUES (${name}, ${address}, 'gas_station', ${lat}, ${lng}, null, null, ${JSON.stringify(["restrooms", "accessible", "parking", "vending"])})`);
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
  const fixes = await db.execute(sql`
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
        OR name ILIKE 'Buc-ee%'
      )
  `);
  const total = await db.execute(sql`SELECT type, count(*) as cnt FROM stops GROUP BY type ORDER BY cnt DESC`);
  res.json({
    message: "Type fix complete",
    updated: Number((fixes as any).rowCount ?? 0),
    breakdown: (total.rows as any[]).map((r) => ({ type: r.type, count: Number(r.cnt) })),
  });
});

export default router;
