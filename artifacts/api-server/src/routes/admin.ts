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

export default router;
