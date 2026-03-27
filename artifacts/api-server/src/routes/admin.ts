import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

const ADMIN_KEY = process.env.ADMIN_SEED_KEY || "cant-hold-it-seed";

// Continental US broken into manageable tiles so each Overpass query is fast
const US_REGIONS: [number, number, number, number][] = [
  [24, -125, 32, -114], // Southern CA, AZ, NM south
  [32, -125, 42, -114], // Northern CA, NV, UT west
  [42, -124, 49, -114], // OR, WA, ID west
  [36, -114, 49, -104], // UT east, CO, WY, MT, ID east
  [24, -114, 36, -96],  // TX, OK, NM north, CO south
  [36, -104, 42, -96],  // KS, NE, SD south
  [42, -104, 49, -96],  // SD north, ND, MN west
  [36, -96,  42, -88],  // MO, IA, IL, WI south
  [42, -96,  49, -88],  // MN east, WI north
  [36, -88,  42, -80],  // IN, OH, KY
  [42, -88,  46, -80],  // MI
  [36, -80,  42, -74],  // WV, VA, PA, NY south, NJ
  [42, -80,  47, -70],  // NY north, CT, MA, VT, NH
  [24, -88,  36, -76],  // TN, NC, SC, GA, AL, MS, FL
  [36, -76,  40, -66],  // MD, DE, DC, NC coast, New England coast
];

interface OsmNode {
  id: number;
  lat: number;
  lon: number;
  tags: Record<string, string>;
}

async function fetchOverpassRegion(
  s: number, w: number, n: number, e: number
): Promise<OsmNode[]> {
  const query = `[out:json][timeout:25];node["highway"="rest_area"]["name"](${s},${w},${n},${e});out body;`;
  const res = await fetch("https://overpass.kumi.systems/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "data=" + encodeURIComponent(query),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.elements ?? [];
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * POST /api/admin/seed-rest-areas?key=<ADMIN_SEED_KEY>
 *
 * Fetches named US highway rest areas from OpenStreetMap via Overpass API,
 * covering the full continental US in 15 regional tiles.
 * Already-existing stops (within ~1 km of an existing rest_area) are skipped.
 *
 * Protect with the ADMIN_SEED_KEY env var (default: cant-hold-it-seed).
 * Safe to re-run — duplicates are always skipped.
 */
router.post("/admin/seed-rest-areas", async (req, res): Promise<void> => {
  if (req.query.key !== ADMIN_KEY) {
    res.status(401).json({ error: "Invalid key" });
    return;
  }

  try {
    // Collect all OSM nodes, deduplicating by node ID across tiles
    const seen = new Set<number>();
    const allNodes: OsmNode[] = [];
    const regionResults: Record<string, number> = {};

    // Run all regions in parallel — much faster than sequential
    const settled = await Promise.allSettled(
      US_REGIONS.map(async ([s, w, n, e]) => {
        const label = `${s},${w},${n},${e}`;
        const nodes = await fetchOverpassRegion(s, w, n, e);
        return { label, nodes };
      })
    );

    for (const result of settled) {
      if (result.status === "fulfilled") {
        const { label, nodes } = result.value;
        let added = 0;
        for (const node of nodes) {
          if (!seen.has(node.id)) {
            seen.add(node.id);
            allNodes.push(node);
            added++;
          }
        }
        regionResults[label] = added;
      } else {
        regionResults["error"] = (regionResults["error"] ?? 0) + 1;
      }
    }

    // Filter to clean US-only named nodes
    const REJECT_NAMES = /^(Halte |Baños|Canchas|Tienda|jardin|jardín)/i;
    const rows = allNodes
      .filter((n) => {
        const name = n.tags?.name || "";
        return (
          name.length >= 4 &&
          !REJECT_NAMES.test(name) &&
          n.lat > 24.4 && n.lat < 49.5 &&
          n.lon > -124.8 && n.lon < -66.9
        );
      })
      .map((n) => {
        const addrParts = [
          n.tags["addr:street"],
          n.tags["addr:city"],
          n.tags["addr:state"],
        ].filter(Boolean);
        return {
          name: n.tags.name,
          address: addrParts.length > 0 ? addrParts.join(", ") : (n.tags.operator || "US Highway Rest Area"),
          lat: n.lat,
          lng: n.lon,
          hours: n.tags.opening_hours ?? null,
        };
      });

    // Insert, skipping anything within ~0.01° (~1 km) of an existing rest_area
    let inserted = 0;
    let skipped = 0;

    for (const row of rows) {
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
        INSERT INTO stops (name, address, type, lat, lng, hours)
        VALUES (${row.name}, ${row.address}, 'rest_area', ${row.lat}, ${row.lng}, ${row.hours})
      `);
      inserted++;
    }

    res.json({
      message: "Seed complete",
      osmTotal: allNodes.length,
      filtered: rows.length,
      inserted,
      skipped,
      regions: regionResults,
    });
  } catch (err: any) {
    console.error("Seed error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
