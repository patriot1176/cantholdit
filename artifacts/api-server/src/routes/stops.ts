import { Router, type IRouter } from "express";
import { eq, desc, avg, count, sql } from "drizzle-orm";
import { db, stopsTable, ratingsTable } from "@workspace/db";
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
    return {
      id: s.id,
      name: s.name,
      address: s.address,
      type: s.type,
      lat: s.lat,
      lng: s.lng,
      overallRating,
      totalRatings,
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

export default router;
