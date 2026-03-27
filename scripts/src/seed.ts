import { db, stopsTable, ratingsTable } from "@workspace/db";

const seedStops = [
  {
    name: "I-70 Welcome Center",
    address: "I-70, Salina, KS 67401",
    type: "rest_area" as const,
    lat: 38.84,
    lng: -97.61,
    hours: "24/7",
  },
  {
    name: "Buc-ee's",
    address: "2000 Buc-ee's Blvd, Temple, TX 76504",
    type: "gas_station" as const,
    lat: 31.09,
    lng: -97.36,
    hours: "24/7",
  },
  {
    name: "McDonald's",
    address: "3001 E Rte 66, Amarillo, TX 79104",
    type: "fast_food" as const,
    lat: 35.22,
    lng: -101.78,
    hours: "6am - 11pm",
  },
  {
    name: "Flying J Travel Center",
    address: "4501 I-40 E, Oklahoma City, OK 73117",
    type: "truck_stop" as const,
    lat: 35.48,
    lng: -97.46,
    hours: "24/7",
  },
  {
    name: "Missouri Welcome Center",
    address: "I-44 Westbound, Joplin, MO 64804",
    type: "rest_area" as const,
    lat: 37.08,
    lng: -94.53,
    hours: "24/7",
  },
  {
    name: "Pilot Travel Center",
    address: "7800 I-55, Memphis, TN 38118",
    type: "truck_stop" as const,
    lat: 35.01,
    lng: -90.02,
    hours: "24/7",
  },
];

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
    stopIndex: 0,
    ratings: [
      { cleanliness: 5, smell: 5, paperSupply: 5, lighting: 5, safety: 5, familyFriendly: 5, comment: "Spotless! Best rest stop on the whole trip." },
      { cleanliness: 4, smell: 5, paperSupply: 5, lighting: 4, safety: 5, familyFriendly: 5, comment: "Very clean, friendly staff." },
      { cleanliness: 5, smell: 4, paperSupply: 5, lighting: 5, safety: 5, familyFriendly: 4, comment: null },
    ],
  },
  {
    stopIndex: 1,
    ratings: [
      { cleanliness: 5, smell: 5, paperSupply: 5, lighting: 5, safety: 5, familyFriendly: 5, comment: "Buc-ee's is the gold standard. Every stall spotless!" },
      { cleanliness: 5, smell: 5, paperSupply: 5, lighting: 5, safety: 5, familyFriendly: 5, comment: "Worth the detour. Best bathrooms in America." },
      { cleanliness: 5, smell: 4, paperSupply: 5, lighting: 5, safety: 5, familyFriendly: 5, comment: "Clean, massive, and they have snacks. Peak road trip stop." },
      { cleanliness: 4, smell: 5, paperSupply: 5, lighting: 5, safety: 5, familyFriendly: 5, comment: null },
      { cleanliness: 5, smell: 5, paperSupply: 5, lighting: 4, safety: 5, familyFriendly: 5, comment: "The beaver logo has never steered me wrong." },
    ],
  },
  {
    stopIndex: 2,
    ratings: [
      { cleanliness: 3, smell: 2, paperSupply: 3, lighting: 3, safety: 3, familyFriendly: 3, comment: "It's... fine. Nothing to write home about." },
      { cleanliness: 2, smell: 2, paperSupply: 4, lighting: 3, safety: 3, familyFriendly: 3, comment: "Sticky floors. Go elsewhere if you can." },
      { cleanliness: 3, smell: 3, paperSupply: 2, lighting: 4, safety: 3, familyFriendly: 2, comment: null },
    ],
  },
  {
    stopIndex: 3,
    ratings: [
      { cleanliness: 1, smell: 1, paperSupply: 2, lighting: 2, safety: 2, familyFriendly: 1, comment: "Absolutely horrifying. I'll just hold it next time." },
      { cleanliness: 1, smell: 1, paperSupply: 1, lighting: 1, safety: 2, familyFriendly: 1, comment: "Smelled like the apocalypse. Nope." },
      { cleanliness: 2, smell: 1, paperSupply: 2, lighting: 2, safety: 2, familyFriendly: 1, comment: "I've seen less scary things in horror movies." },
    ],
  },
  {
    stopIndex: 4,
    ratings: [
      { cleanliness: 4, smell: 4, paperSupply: 4, lighting: 5, safety: 5, familyFriendly: 5, comment: "Great welcome center, very well maintained." },
      { cleanliness: 5, smell: 4, paperSupply: 5, lighting: 5, safety: 5, familyFriendly: 5, comment: "Missouri knows how to welcome travelers!" },
    ],
  },
  {
    stopIndex: 5,
    ratings: [
      { cleanliness: 3, smell: 3, paperSupply: 3, lighting: 3, safety: 3, familyFriendly: 3, comment: "Average. Gets the job done." },
      { cleanliness: 4, smell: 3, paperSupply: 4, lighting: 4, safety: 4, familyFriendly: 4, comment: "Better than expected for a truck stop." },
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
