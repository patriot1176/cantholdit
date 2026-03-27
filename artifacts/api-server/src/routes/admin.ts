import { Router, type IRouter } from "express";
import { db, stopsTable } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

const ADMIN_KEY = process.env.ADMIN_SEED_KEY || "cant-hold-it-seed";

// HIFLD Rest Areas ArcGIS REST API
// Dataset: Interstate Rest Areas (US DOT / FHWA)
// https://hifld-geoplatform.opendata.arcgis.com/datasets/rest-areas
const HIFLD_BASE =
  "https://services1.arcgis.com/Hp6G80Pky0om7QvQ/arcgis/rest/services/Rest_Areas/FeatureServer/0/query";

interface HifldFeature {
  attributes: {
    NAME: string;
    ADDRESS: string | null;
    CITY: string | null;
    STATE: string | null;
    ZIP: string | null;
    TPID: string | null;
    DIRECTION: string | null;
    MAINTAINER: string | null;
    LATITUDE: number;
    LONGITUDE: number;
  };
  geometry: { x: number; y: number };
}

async function fetchHifldPage(offset: number, limit = 1000): Promise<HifldFeature[]> {
  const params = new URLSearchParams({
    where: "1=1",
    outFields: "NAME,ADDRESS,CITY,STATE,ZIP,TPID,DIRECTION,MAINTAINER,LATITUDE,LONGITUDE",
    outSR: "4326",
    f: "json",
    resultOffset: String(offset),
    resultRecordCount: String(limit),
  });
  const res = await fetch(`${HIFLD_BASE}?${params}`, {
    headers: { "User-Agent": "CantHoldIt-Seed/1.0" },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`HIFLD HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(`HIFLD error: ${data.error.message}`);
  return data.features ?? [];
}

/**
 * POST /admin/seed-rest-areas?key=<ADMIN_SEED_KEY>
 *
 * Fetches up to 2,000 US Interstate rest areas from the HIFLD federal dataset
 * and inserts them into the stops table.  Already-existing stops (matched by
 * proximity within ~100 m) are skipped.
 *
 * Protect with the ADMIN_SEED_KEY environment variable (default: cant-hold-it-seed).
 * Run once after deploying; safe to re-run (duplicates are skipped).
 */
router.post("/admin/seed-rest-areas", async (req, res): Promise<void> => {
  if (req.query.key !== ADMIN_KEY) {
    res.status(401).json({ error: "Invalid key" });
    return;
  }

  try {
    // Fetch up to 2 pages (2 × 1000) to cover the full dataset (~1,500 records)
    const page1 = await fetchHifldPage(0, 1000);
    let page2: HifldFeature[] = [];
    if (page1.length === 1000) {
      page2 = await fetchHifldPage(1000, 1000);
    }
    const all = [...page1, ...page2];

    if (all.length === 0) {
      res.json({ inserted: 0, skipped: 0, message: "HIFLD returned 0 features" });
      return;
    }

    // Map to our schema
    const rows = all
      .filter((f) => {
        const lat = f.attributes.LATITUDE ?? f.geometry?.y;
        const lng = f.attributes.LONGITUDE ?? f.geometry?.x;
        const name = f.attributes.NAME;
        return name && lat && lng && lat > 24 && lat < 50 && lng > -125 && lng < -66;
      })
      .map((f) => {
        const lat = f.attributes.LATITUDE ?? f.geometry.y;
        const lng = f.attributes.LONGITUDE ?? f.geometry.x;
        const nameParts = [f.attributes.NAME];
        if (f.attributes.DIRECTION) nameParts.push(`(${f.attributes.DIRECTION})`);
        const name = nameParts.join(" ");

        const addrParts = [
          f.attributes.ADDRESS,
          f.attributes.CITY,
          f.attributes.STATE,
          f.attributes.ZIP,
        ].filter(Boolean);
        const address = addrParts.length > 0 ? addrParts.join(", ") : "US Interstate Rest Area";

        return { name, address, lat, lng };
      });

    // Bulk upsert — skip rows that already have a rest_area within ~0.01° (~1 km)
    // We use a temp CTE to avoid touching existing rows
    let inserted = 0;
    let skipped = 0;

    for (const row of rows) {
      // Check proximity: skip if there's already a stop within ~0.01 degrees
      const nearby = await db.execute(sql`
        SELECT id FROM stops
        WHERE type = 'rest_area'
          AND ABS(lat - ${row.lat}) < 0.01
          AND ABS(lng - ${row.lng}) < 0.01
        LIMIT 1
      `);
      if (nearby.rows.length > 0) {
        skipped++;
        continue;
      }
      await db.execute(sql`
        INSERT INTO stops (name, address, type, lat, lng)
        VALUES (${row.name}, ${row.address}, 'rest_area', ${row.lat}, ${row.lng})
      `);
      inserted++;
    }

    res.json({
      message: "Seed complete",
      hifldTotal: all.length,
      filtered: rows.length,
      inserted,
      skipped,
    });
  } catch (err: any) {
    console.error("Seed error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
