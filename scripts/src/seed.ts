import { db, stopsTable, ratingsTable } from "@workspace/db";

const seedStops = [
  {
    name: "Iowa 80 Truck Stop",
    address: "755 W Iowa 80 Rd, Walcott, IA 52773",
    type: "truck_stop" as const,
    lat: 41.59,
    lng: -90.77,
    hours: "24/7",
  },
  {
    name: "Flying J Travel Center",
    address: "7301 E 21st St, Indianapolis, IN 46219",
    type: "truck_stop" as const,
    lat: 39.77,
    lng: -86.06,
    hours: "24/7",
  },
  {
    name: "I-70 Rest Area",
    address: "I-70 Eastbound, Columbus, OH 43004",
    type: "rest_area" as const,
    lat: 39.96,
    lng: -82.76,
    hours: "24/7",
  },
  {
    name: "Buc-ee's",
    address: "1000 Buc-ee's Blvd, Winchester, KY 40391",
    type: "gas_station" as const,
    lat: 37.99,
    lng: -84.18,
    hours: "24/7",
  },
  {
    name: "Love's Travel Stop",
    address: "3630 Gasconade St, St. Louis, MO 63116",
    type: "gas_station" as const,
    lat: 38.58,
    lng: -90.24,
    hours: "24/7",
  },
  {
    name: "I-75 Rest Area",
    address: "I-75 Northbound, Findlay, OH 45840",
    type: "rest_area" as const,
    lat: 41.04,
    lng: -83.65,
    hours: "24/7",
  },
];

// Ratings designed to produce target averages:
// Iowa 80: ~4.8 (Royal Flush 👑)
// Flying J Indy: ~3.2
// I-70 Columbus: ~1.4 (Biohazard ☣️)
// Buc-ee's Winchester: ~4.9 (Royal Flush 👑)
// Love's St. Louis: ~3.6
// I-75 Findlay: ~2.1
const seedRatings: {
  stopIndex: number;
  ratings: Array<{
    cleanliness: number;
    smell: number;
    paperSupply: number;
    lighting: number;
    safety: number;
    familyFriendly: number;
    comment: string | null;
  }>;
}[] = [
  {
    stopIndex: 0, // Iowa 80 — target 4.8
    ratings: [
      { cleanliness: 5, smell: 5, paperSupply: 5, lighting: 5, safety: 5, familyFriendly: 5, comment: "World's largest truck stop lives up to the hype. Spotless bathrooms, no waiting." },
      { cleanliness: 5, smell: 5, paperSupply: 5, lighting: 5, safety: 5, familyFriendly: 4, comment: "Iowa 80 is the gold standard for road trip pit stops. 10/10." },
      { cleanliness: 5, smell: 4, paperSupply: 5, lighting: 5, safety: 5, familyFriendly: 5, comment: "Like a spa compared to other truck stops. Highly recommend." },
    ],
  },
  {
    stopIndex: 1, // Flying J Indy — target 3.2
    ratings: [
      { cleanliness: 3, smell: 3, paperSupply: 4, lighting: 3, safety: 3, familyFriendly: 3, comment: "It's fine. Gets the job done but don't linger." },
      { cleanliness: 3, smell: 2, paperSupply: 3, lighting: 4, safety: 4, familyFriendly: 3, comment: "Typical truck stop, smells like diesel and regret." },
      { cleanliness: 4, smell: 3, paperSupply: 3, lighting: 3, safety: 3, familyFriendly: 3, comment: null },
    ],
  },
  {
    stopIndex: 2, // I-70 Columbus — target 1.4 (Biohazard)
    ratings: [
      { cleanliness: 1, smell: 1, paperSupply: 2, lighting: 2, safety: 1, familyFriendly: 1, comment: "Do NOT stop here unless it is a genuine emergency. I have nightmares." },
      { cleanliness: 1, smell: 1, paperSupply: 1, lighting: 1, safety: 2, familyFriendly: 1, comment: "Ohio has failed us. This is a biohazard zone." },
      { cleanliness: 2, smell: 1, paperSupply: 1, lighting: 2, safety: 1, familyFriendly: 1, comment: "I drove 40 miles to the next exit after seeing this place." },
    ],
  },
  {
    stopIndex: 3, // Buc-ee's Winchester — target 4.9 (Royal Flush)
    ratings: [
      { cleanliness: 5, smell: 5, paperSupply: 5, lighting: 5, safety: 5, familyFriendly: 5, comment: "Buc-ee's continues to be the GOAT of road trip bathrooms. Every stall is immaculate." },
      { cleanliness: 5, smell: 5, paperSupply: 5, lighting: 5, safety: 5, familyFriendly: 5, comment: "Brought tears to my eyes. Fresh flowers?? In a gas station bathroom??" },
      { cleanliness: 5, smell: 5, paperSupply: 5, lighting: 5, safety: 5, familyFriendly: 4, comment: "My kids asked if we could live here. Can confirm the bathrooms are cleaner than my house." },
      { cleanliness: 5, smell: 5, paperSupply: 5, lighting: 5, safety: 5, familyFriendly: 5, comment: null },
      { cleanliness: 5, smell: 4, paperSupply: 5, lighting: 5, safety: 5, familyFriendly: 5, comment: "Worth the detour. Every. Single. Time." },
    ],
  },
  {
    stopIndex: 4, // Love's St. Louis — target 3.6
    ratings: [
      { cleanliness: 4, smell: 3, paperSupply: 4, lighting: 4, safety: 4, familyFriendly: 3, comment: "Solid Love's. Better than average." },
      { cleanliness: 4, smell: 4, paperSupply: 3, lighting: 4, safety: 3, familyFriendly: 4, comment: "Did its job. Clean enough that I'm not writing a strongly worded letter." },
      { cleanliness: 3, smell: 3, paperSupply: 4, lighting: 4, safety: 4, familyFriendly: 3, comment: null },
    ],
  },
  {
    stopIndex: 5, // I-75 Findlay — target 2.1
    ratings: [
      { cleanliness: 2, smell: 2, paperSupply: 2, lighting: 2, safety: 2, familyFriendly: 2, comment: "Mediocre at best. Paper towels were out, floor was damp." },
      { cleanliness: 2, smell: 2, paperSupply: 2, lighting: 3, safety: 2, familyFriendly: 2, comment: "Ohio rest areas are... a journey. Not a good one." },
      { cleanliness: 3, smell: 2, paperSupply: 2, lighting: 2, safety: 2, familyFriendly: 2, comment: null },
    ],
  },
];

async function main() {
  console.log("Seeding database...");

  const existingStops = await db.select().from(stopsTable);
  if (existingStops.length > 0) {
    console.log(`Database already has ${existingStops.length} stops. Skipping seed.`);
    process.exit(0);
  }

  const insertedStops = await db.insert(stopsTable).values(seedStops).returning();
  console.log(`Inserted ${insertedStops.length} stops.`);

  for (const { stopIndex, ratings } of seedRatings) {
    const stop = insertedStops[stopIndex];
    if (!stop) continue;
    await db.insert(ratingsTable).values(
      ratings.map((r) => ({ ...r, stopId: stop.id }))
    );
    console.log(`Inserted ${ratings.length} ratings for "${stop.name}".`);
  }

  console.log("Seed complete!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
