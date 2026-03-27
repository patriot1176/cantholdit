import { db, stopsTable, ratingsTable } from "@workspace/db";
import { count } from "drizzle-orm";
import { logger } from "./logger";

const SEED_STOPS = [
  { name: "Iowa 80 Truck Stop",        address: "755 W Iowa 80 Rd, Walcott, IA 52773",         type: "truck_stop"  as const, lat: 41.59, lng: -90.77, hours: "24/7" },
  { name: "Flying J Travel Center",    address: "7301 E 21st St, Indianapolis, IN 46219",       type: "truck_stop"  as const, lat: 39.77, lng: -86.06, hours: "24/7" },
  { name: "I-70 Rest Area",            address: "I-70 Eastbound, Columbus, OH 43004",           type: "rest_area"   as const, lat: 39.96, lng: -82.76, hours: "24/7" },
  { name: "Buc-ee's",                  address: "1000 Buc-ee's Blvd, Winchester, KY 40391",    type: "gas_station" as const, lat: 37.99, lng: -84.18, hours: "24/7" },
  { name: "Love's Travel Stop",        address: "3630 Gasconade St, St. Louis, MO 63116",       type: "gas_station" as const, lat: 38.58, lng: -90.24, hours: "24/7" },
  { name: "I-75 Rest Area",            address: "I-75 Northbound, Findlay, OH 45840",           type: "rest_area"   as const, lat: 41.04, lng: -83.65, hours: "24/7" },
  { name: "Buc-ee's Luling",           address: "20150 US-183, Luling, TX 78648",               type: "gas_station" as const, lat: 29.67, lng: -97.65, hours: "24/7" },
  { name: "I-95 Vero Beach Rest Area", address: "I-95 Northbound, Vero Beach, FL 32960",       type: "rest_area"   as const, lat: 27.71, lng: -80.43, hours: "24/7" },
  { name: "I-5 Coalinga Rest Area",    address: "I-5 Northbound, Coalinga, CA 93210",           type: "rest_area"   as const, lat: 36.12, lng: -120.23, hours: "24/7" },
  { name: "NY Thruway Chittenango Service Area", address: "I-90 Westbound, Chittenango, NY 13037", type: "rest_area" as const, lat: 43.04, lng: -75.87, hours: "24/7" },
  { name: "I-75 Rest Area Piqua",      address: "I-75 Northbound, Piqua, OH 45356",            type: "rest_area"   as const, lat: 40.14, lng: -84.24, hours: "24/7" },
  { name: "Speedway Springboro",       address: "SR-73 & I-75, Springboro, OH 45066",           type: "gas_station" as const, lat: 39.57, lng: -84.25, hours: "24/7" },
  { name: "Buc-ee's Florence",         address: "7225 Turfway Rd, Florence, KY 41042",          type: "gas_station" as const, lat: 38.98, lng: -84.64, hours: "24/7" },
  { name: "Love's Travel Stop Wilmington", address: "US-68 & I-71, Wilmington, OH 45177",      type: "gas_station" as const, lat: 39.44, lng: -83.83, hours: "24/7" },
  { name: "Flying J Jeffersonville",   address: "US-35 & SR-35, Jeffersonville, OH 43128",      type: "gas_station" as const, lat: 39.64, lng: -83.54, hours: "24/7" },
];

type RatingRow = { cleanliness: number; smell: number; paperSupply: number; lighting: number; safety: number; familyFriendly: number; comment: string | null };

const SEED_RATINGS: Record<string, RatingRow[]> = {
  "Iowa 80 Truck Stop": [
    { cleanliness: 5, smell: 5, paperSupply: 5, lighting: 5, safety: 5, familyFriendly: 5, comment: "World's largest truck stop lives up to the hype. Spotless bathrooms, no waiting." },
    { cleanliness: 5, smell: 5, paperSupply: 5, lighting: 5, safety: 5, familyFriendly: 4, comment: "Iowa 80 is the gold standard for road trip pit stops. 10/10." },
    { cleanliness: 5, smell: 4, paperSupply: 5, lighting: 5, safety: 5, familyFriendly: 5, comment: "Like a spa compared to other truck stops. Highly recommend." },
  ],
  "Flying J Travel Center": [
    { cleanliness: 3, smell: 3, paperSupply: 4, lighting: 3, safety: 3, familyFriendly: 3, comment: "It's fine. Gets the job done but don't linger." },
    { cleanliness: 3, smell: 2, paperSupply: 3, lighting: 4, safety: 4, familyFriendly: 3, comment: "Typical truck stop, smells like diesel and regret." },
    { cleanliness: 4, smell: 3, paperSupply: 3, lighting: 3, safety: 3, familyFriendly: 3, comment: null },
  ],
  "I-70 Rest Area": [
    { cleanliness: 1, smell: 1, paperSupply: 2, lighting: 2, safety: 1, familyFriendly: 1, comment: "Do NOT stop here unless it is a genuine emergency. I have nightmares." },
    { cleanliness: 1, smell: 1, paperSupply: 1, lighting: 1, safety: 2, familyFriendly: 1, comment: "Ohio has failed us. This is a biohazard zone." },
    { cleanliness: 2, smell: 1, paperSupply: 1, lighting: 2, safety: 1, familyFriendly: 1, comment: "I drove 40 miles to the next exit after seeing this place." },
  ],
  "Buc-ee's": [
    { cleanliness: 5, smell: 5, paperSupply: 5, lighting: 5, safety: 5, familyFriendly: 5, comment: "Buc-ee's continues to be the GOAT of road trip bathrooms. Every stall is immaculate." },
    { cleanliness: 5, smell: 5, paperSupply: 5, lighting: 5, safety: 5, familyFriendly: 5, comment: "Brought tears to my eyes. Fresh flowers?? In a gas station bathroom??" },
    { cleanliness: 5, smell: 5, paperSupply: 5, lighting: 5, safety: 5, familyFriendly: 4, comment: "My kids asked if we could live here. Can confirm the bathrooms are cleaner than my house." },
    { cleanliness: 5, smell: 4, paperSupply: 5, lighting: 5, safety: 5, familyFriendly: 5, comment: "Worth the detour. Every. Single. Time." },
  ],
  "Love's Travel Stop": [
    { cleanliness: 4, smell: 3, paperSupply: 4, lighting: 4, safety: 4, familyFriendly: 3, comment: "Solid Love's. Better than average." },
    { cleanliness: 4, smell: 4, paperSupply: 3, lighting: 4, safety: 3, familyFriendly: 4, comment: "Did its job. Clean enough that I'm not writing a strongly worded letter." },
    { cleanliness: 3, smell: 3, paperSupply: 4, lighting: 4, safety: 4, familyFriendly: 3, comment: null },
  ],
  "I-75 Rest Area": [
    { cleanliness: 2, smell: 2, paperSupply: 2, lighting: 2, safety: 2, familyFriendly: 2, comment: "Mediocre at best. Paper towels were out, floor was damp." },
    { cleanliness: 2, smell: 2, paperSupply: 2, lighting: 3, safety: 2, familyFriendly: 2, comment: "Ohio rest areas are... a journey. Not a good one." },
    { cleanliness: 3, smell: 2, paperSupply: 2, lighting: 2, safety: 2, familyFriendly: 2, comment: null },
  ],
  "Buc-ee's Luling": [
    { cleanliness: 4, smell: 3, paperSupply: 4, lighting: 4, safety: 3, familyFriendly: 3, comment: "Buc-ee's in Texas doesn't disappoint but this location is a bit hit or miss." },
    { cleanliness: 3, smell: 4, paperSupply: 3, lighting: 3, safety: 4, familyFriendly: 4, comment: "Long drive, needed a break. Did the job fine." },
    { cleanliness: 4, smell: 3, paperSupply: 3, lighting: 4, safety: 4, familyFriendly: 3, comment: null },
  ],
  "I-95 Vero Beach Rest Area": [
    { cleanliness: 5, smell: 4, paperSupply: 5, lighting: 5, safety: 4, familyFriendly: 5, comment: "Surprisingly spotless for an I-95 rest stop. Florida doing something right." },
    { cleanliness: 4, smell: 5, paperSupply: 4, lighting: 5, safety: 5, familyFriendly: 4, comment: "Nicely landscaped, clean stalls, and the hand dryers actually work!" },
    { cleanliness: 5, smell: 4, paperSupply: 5, lighting: 4, safety: 5, familyFriendly: 5, comment: "Stopped here twice on the same trip. Still excellent." },
  ],
  "I-5 Coalinga Rest Area": [
    { cleanliness: 2, smell: 2, paperSupply: 2, lighting: 2, safety: 2, familyFriendly: 2, comment: "California rest stops need serious attention. This one especially." },
    { cleanliness: 1, smell: 2, paperSupply: 2, lighting: 2, safety: 3, familyFriendly: 2, comment: "Hot, smelly, barely functional. Only stopped because I had no choice." },
    { cleanliness: 2, smell: 2, paperSupply: 1, lighting: 2, safety: 2, familyFriendly: 3, comment: null },
  ],
  "NY Thruway Chittenango Service Area": [
    { cleanliness: 3, smell: 3, paperSupply: 3, lighting: 3, safety: 3, familyFriendly: 3, comment: "Standard Thruway service area. Has the essentials, nothing more." },
    { cleanliness: 3, smell: 2, paperSupply: 4, lighting: 3, safety: 3, familyFriendly: 3, comment: "Gets very crowded on holiday weekends. Come back in the off-season." },
    { cleanliness: 2, smell: 3, paperSupply: 3, lighting: 4, safety: 3, familyFriendly: 3, comment: null },
  ],
  "I-75 Rest Area Piqua": [
    { cleanliness: 3, smell: 3, paperSupply: 3, lighting: 2, safety: 3, familyFriendly: 3, comment: "Ohio rest stops are a gamble. This one is losing." },
    { cleanliness: 2, smell: 3, paperSupply: 2, lighting: 3, safety: 3, familyFriendly: 3, comment: "Not terrible, not good. Exactly what you'd expect from a highway rest area." },
    { cleanliness: 3, smell: 3, paperSupply: 3, lighting: 3, safety: 3, familyFriendly: 2, comment: null },
  ],
  "Speedway Springboro": [
    { cleanliness: 4, smell: 3, paperSupply: 4, lighting: 3, safety: 4, familyFriendly: 3, comment: "Surprisingly clean for a Speedway. Staff keeps it tidy." },
    { cleanliness: 3, smell: 4, paperSupply: 3, lighting: 3, safety: 4, familyFriendly: 3, comment: "Quick stop, did the job. Nothing fancy." },
    { cleanliness: 3, smell: 3, paperSupply: 4, lighting: 4, safety: 3, familyFriendly: 3, comment: null },
  ],
  "Buc-ee's Florence": [
    { cleanliness: 5, smell: 5, paperSupply: 5, lighting: 5, safety: 5, familyFriendly: 5, comment: "The Florence Buc-ee's is an absolute gem. Brand new and immaculate. This is what all bathrooms should be." },
    { cleanliness: 5, smell: 5, paperSupply: 5, lighting: 5, safety: 5, familyFriendly: 5, comment: "We detoured 15 minutes off I-71/75 specifically for this Buc-ee's. Worth every mile." },
    { cleanliness: 5, smell: 5, paperSupply: 4, lighting: 5, safety: 5, familyFriendly: 5, comment: "Genuinely cleaner than my bathroom at home. No notes." },
    { cleanliness: 5, smell: 5, paperSupply: 5, lighting: 5, safety: 4, familyFriendly: 5, comment: "Royal Flush 100%. The gold standard of road trip stops." },
  ],
  "Love's Travel Stop Wilmington": [
    { cleanliness: 3, smell: 3, paperSupply: 3, lighting: 3, safety: 3, familyFriendly: 4, comment: "Standard Love's. Solid enough that I didn't run back to the car." },
    { cleanliness: 3, smell: 3, paperSupply: 3, lighting: 3, safety: 3, familyFriendly: 3, comment: "Gets the job done. No horror stories, no pleasant surprises." },
    { cleanliness: 3, smell: 3, paperSupply: 3, lighting: 4, safety: 3, familyFriendly: 3, comment: null },
  ],
  "Flying J Jeffersonville": [
    { cleanliness: 2, smell: 2, paperSupply: 3, lighting: 2, safety: 2, familyFriendly: 2, comment: "Smells like it hasn't been mopped this decade. Functional but grim." },
    { cleanliness: 2, smell: 3, paperSupply: 2, lighting: 2, safety: 2, familyFriendly: 3, comment: "I've seen worse, but not by much. Only stop here if you're desperate." },
    { cleanliness: 3, smell: 2, paperSupply: 2, lighting: 2, safety: 3, familyFriendly: 2, comment: null },
  ],
};

export async function autoSeedIfEmpty() {
  try {
    const [{ total }] = await db.select({ total: count() }).from(stopsTable);
    if (Number(total) > 0) {
      logger.info({ total }, "Database already has stops — skipping auto-seed");
      return;
    }

    logger.info("Database is empty — running auto-seed...");

    const inserted = await db.insert(stopsTable).values(SEED_STOPS).returning();
    logger.info({ count: inserted.length }, "Inserted seed stops");

    const nameToId = new Map(inserted.map((s) => [s.name, s.id]));

    for (const [stopName, ratings] of Object.entries(SEED_RATINGS)) {
      const stopId = nameToId.get(stopName);
      if (!stopId) continue;
      await db.insert(ratingsTable).values(ratings.map((r) => ({ ...r, stopId })));
      logger.info({ stopName, count: ratings.length }, "Inserted seed ratings");
    }

    logger.info("Auto-seed complete");
  } catch (err) {
    logger.error({ err }, "Auto-seed failed — continuing without seed data");
  }
}
