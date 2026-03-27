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

export default router;
