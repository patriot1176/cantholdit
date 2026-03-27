import { Router, type IRouter } from "express";
import { eq, desc, avg, count, sql, and, gte } from "drizzle-orm";
import { db, stopsTable, ratingsTable, photosTable, reportsTable } from "@workspace/db";
import {
  GetStopsQueryParams,
  GetStopsResponse,
  GetStopParams,
  GetStopResponse,
  CreateStopBody,
  GetStopRatingsParams,
  GetStopRatingsResponse,
  CreateRatingParams,
  CreateRatingBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

function computeBadges(
  overallRating: number | null,
  totalRatings: number,
  isTopReviewed: boolean
): ("royal_flush" | "biohazard" | "most_reviewed")[] {
  const badges: ("royal_flush" | "biohazard" | "most_reviewed")[] = [];
  if (overallRating !== null) {
    if (overallRating >= 4.5) badges.push("royal_flush");
    if (overallRating <= 1.5) badges.push("biohazard");
  }
  if (isTopReviewed) badges.push("most_reviewed");
  return badges;
}

router.get("/stops", async (req, res): Promise<void> => {
  const parsed = GetStopsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { query } = parsed.data;

  const stopsWithStats = await db
    .select({
      id: stopsTable.id,
      name: stopsTable.name,
      address: stopsTable.address,
      type: stopsTable.type,
      lat: stopsTable.lat,
      lng: stopsTable.lng,
      hours: stopsTable.hours,
      amenities: stopsTable.amenities,
      highway: stopsTable.highway,
      createdAt: stopsTable.createdAt,
      overallRating: avg(
        sql`(${ratingsTable.cleanliness} + ${ratingsTable.smell} + ${ratingsTable.paperSupply} + ${ratingsTable.lighting} + ${ratingsTable.safety} + ${ratingsTable.familyFriendly}) / 6.0`
      ),
      totalRatings: count(ratingsTable.id),
    })
    .from(stopsTable)
    .leftJoin(ratingsTable, eq(stopsTable.id, ratingsTable.stopId))
    .groupBy(stopsTable.id)
    .orderBy(desc(stopsTable.createdAt));

  const maxReviews = Math.max(...stopsWithStats.map((s) => Number(s.totalRatings)));

  let results = stopsWithStats.map((s) => {
    const overallRating = s.overallRating ? parseFloat(String(s.overallRating)) : null;
    const totalRatings = Number(s.totalRatings);
    const isTopReviewed = totalRatings > 0 && totalRatings === maxReviews;
    let amenities: string[] = [];
    try { amenities = JSON.parse(s.amenities || "[]"); } catch { amenities = []; }
    return {
      id: s.id,
      name: s.name,
      address: s.address,
      type: s.type,
      lat: s.lat,
      lng: s.lng,
      overallRating,
      totalRatings,
      amenities,
      highway: s.highway ?? null,
      badges: computeBadges(overallRating, totalRatings, isTopReviewed),
      createdAt: s.createdAt,
    };
  });

  if (query) {
    const q = query.toLowerCase();
    results = results.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.address.toLowerCase().includes(q)
    );
  }

  res.json(GetStopsResponse.parse(results));
});

router.post("/stops", async (req, res): Promise<void> => {
  const parsed = CreateStopBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [stop] = await db.insert(stopsTable).values(parsed.data).returning();

  res.status(201).json({
    ...stop,
    overallRating: null,
    totalRatings: 0,
    badges: [],
  });
});

router.get("/stops/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetStopParams.safeParse({ id: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [stopWithStats] = await db
    .select({
      id: stopsTable.id,
      name: stopsTable.name,
      address: stopsTable.address,
      type: stopsTable.type,
      lat: stopsTable.lat,
      lng: stopsTable.lng,
      hours: stopsTable.hours,
      amenities: stopsTable.amenities,
      highway: stopsTable.highway,
      createdAt: stopsTable.createdAt,
      overallRating: avg(
        sql`(${ratingsTable.cleanliness} + ${ratingsTable.smell} + ${ratingsTable.paperSupply} + ${ratingsTable.lighting} + ${ratingsTable.safety} + ${ratingsTable.familyFriendly}) / 6.0`
      ),
      totalRatings: count(ratingsTable.id),
      cleanliness: avg(ratingsTable.cleanliness),
      smell: avg(ratingsTable.smell),
      paperSupply: avg(ratingsTable.paperSupply),
      lighting: avg(ratingsTable.lighting),
      safety: avg(ratingsTable.safety),
      familyFriendly: avg(ratingsTable.familyFriendly),
    })
    .from(stopsTable)
    .leftJoin(ratingsTable, eq(stopsTable.id, ratingsTable.stopId))
    .where(eq(stopsTable.id, params.data.id))
    .groupBy(stopsTable.id);

  if (!stopWithStats) {
    res.status(404).json({ error: "Stop not found" });
    return;
  }

  const recentRatings = await db
    .select()
    .from(ratingsTable)
    .where(eq(ratingsTable.stopId, params.data.id))
    .orderBy(desc(ratingsTable.createdAt))
    .limit(10);

  const parseAvg = (val: unknown) => (val ? parseFloat(String(val)) : null);
  const overallRating = parseAvg(stopWithStats.overallRating);
  const totalRatings = Number(stopWithStats.totalRatings);
  let amenities: string[] = [];
  try { amenities = JSON.parse(stopWithStats.amenities || "[]"); } catch { amenities = []; }
  const highway = stopWithStats.highway ?? null;

  const formattedRatings = recentRatings.map((r) => ({
    ...r,
    overallScore:
      (r.cleanliness +
        r.smell +
        r.paperSupply +
        r.lighting +
        r.safety +
        r.familyFriendly) /
      6.0,
  }));

  const detail = {
    id: stopWithStats.id,
    name: stopWithStats.name,
    address: stopWithStats.address,
    type: stopWithStats.type,
    lat: stopWithStats.lat,
    lng: stopWithStats.lng,
    hours: stopWithStats.hours ?? null,
    amenities,
    highway,
    overallRating,
    totalRatings,
    badges: computeBadges(overallRating, totalRatings, false),
    cleanliness: parseAvg(stopWithStats.cleanliness),
    smell: parseAvg(stopWithStats.smell),
    paperSupply: parseAvg(stopWithStats.paperSupply),
    lighting: parseAvg(stopWithStats.lighting),
    safety: parseAvg(stopWithStats.safety),
    familyFriendly: parseAvg(stopWithStats.familyFriendly),
    recentRatings: formattedRatings,
    createdAt: stopWithStats.createdAt,
  };

  res.json(GetStopResponse.parse(detail));
});

router.get("/stops/:id/ratings", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetStopRatingsParams.safeParse({ id: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const ratings = await db
    .select()
    .from(ratingsTable)
    .where(eq(ratingsTable.stopId, params.data.id))
    .orderBy(desc(ratingsTable.createdAt));

  const formatted = ratings.map((r) => ({
    ...r,
    overallScore:
      (r.cleanliness +
        r.smell +
        r.paperSupply +
        r.lighting +
        r.safety +
        r.familyFriendly) /
      6.0,
  }));

  res.json(GetStopRatingsResponse.parse(formatted));
});

router.post("/stops/:id/ratings", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = CreateRatingParams.safeParse({ id: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [stop] = await db
    .select({ id: stopsTable.id })
    .from(stopsTable)
    .where(eq(stopsTable.id, params.data.id));

  if (!stop) {
    res.status(404).json({ error: "Stop not found" });
    return;
  }

  const body = CreateRatingBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [rating] = await db
    .insert(ratingsTable)
    .values({ ...body.data, stopId: params.data.id })
    .returning();

  res.status(201).json({
    ...rating,
    overallScore:
      (rating.cleanliness +
        rating.smell +
        rating.paperSupply +
        rating.lighting +
        rating.safety +
        rating.familyFriendly) /
      6.0,
  });
});

router.get("/stops/:id/photos", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid stop id" }); return; }
  const photos = await db
    .select()
    .from(photosTable)
    .where(eq(photosTable.stopId, id))
    .orderBy(desc(photosTable.createdAt));
  res.json(photos.map((p) => ({ ...p, url: `/api/storage${p.objectPath}` })));
});

router.post("/stops/:id/photos", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { objectPath } = req.body as { objectPath?: string };
  if (isNaN(id) || !objectPath) { res.status(400).json({ error: "Invalid request" }); return; }
  const [stop] = await db.select({ id: stopsTable.id }).from(stopsTable).where(eq(stopsTable.id, id));
  if (!stop) { res.status(404).json({ error: "Stop not found" }); return; }
  const [photo] = await db.insert(photosTable).values({ stopId: id, objectPath }).returning();
  res.status(201).json({ ...photo, url: `/api/storage${photo.objectPath}` });
});

// PATCH /stops/:id/amenities — community-toggle amenities list
router.patch("/stops/:id/amenities", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid stop id" }); return; }
  const { amenities } = req.body as { amenities?: unknown };
  if (!Array.isArray(amenities) || amenities.some((a) => typeof a !== "string")) {
    res.status(400).json({ error: "amenities must be a string array" });
    return;
  }
  const [stop] = await db.select({ id: stopsTable.id }).from(stopsTable).where(eq(stopsTable.id, id));
  if (!stop) { res.status(404).json({ error: "Stop not found" }); return; }
  await db.update(stopsTable).set({ amenities: JSON.stringify(amenities) }).where(eq(stopsTable.id, id));
  res.json({ amenities });
});

// GET /stops/:id/reports — get recent community reports for a stop
router.get("/stops/:id/reports", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid stop id" }); return; }

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const reports = await db
    .select()
    .from(reportsTable)
    .where(and(eq(reportsTable.stopId, id), gte(reportsTable.createdAt, ninetyDaysAgo)))
    .orderBy(desc(reportsTable.createdAt));

  const countByType: Record<string, number> = {};
  for (const r of reports) {
    countByType[r.reportType] = (countByType[r.reportType] || 0) + 1;
  }

  const topType = Object.entries(countByType).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  res.json({ total: reports.length, countByType, topType, latest: reports[0] ?? null });
});

// POST /stops/:id/report — report a problem with a stop
router.post("/stops/:id/report", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid stop id" }); return; }
  const { reportType, comment } = req.body as { reportType?: string; comment?: string };
  const validTypes = ["permanently_closed", "temporarily_closed", "wrong_location", "wrong_info", "other"];
  if (!reportType || !validTypes.includes(reportType)) {
    res.status(400).json({ error: `reportType must be one of: ${validTypes.join(", ")}` });
    return;
  }
  const [stop] = await db.select({ id: stopsTable.id }).from(stopsTable).where(eq(stopsTable.id, id));
  if (!stop) { res.status(404).json({ error: "Stop not found" }); return; }
  const [report] = await db.insert(reportsTable).values({
    stopId: id,
    reportType: reportType as any,
    comment: comment?.trim() || null,
  }).returning();
  res.status(201).json(report);
});

export default router;
