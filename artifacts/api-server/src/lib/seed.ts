import { db, stopsTable, ratingsTable } from "@workspace/db";
import { count } from "drizzle-orm";
import { logger } from "./logger";

const SEED_STOPS = [
  // ── MIDWEST ─────────────────────────────────────────────────────────────
  { name: "Iowa 80 Truck Stop",               address: "755 W Iowa 80 Rd, Walcott, IA 52773",                   type: "truck_stop"  as const, lat: 41.593,  lng: -90.773,   hours: "24/7" },
  { name: "Pilot Flying J – Gary, IN",        address: "4111 Burr St, Gary, IN 46408",                          type: "truck_stop"  as const, lat: 41.571,  lng: -87.335,   hours: "24/7" },
  { name: "Casey's General Store – Bloomington, IL", address: "1802 N Veterans Pkwy, Bloomington, IL 61704",   type: "gas_station" as const, lat: 40.484,  lng: -88.994,   hours: "24/7" },
  { name: "I-90 Portage Service Plaza – IN",  address: "I-90 EB Mile 22.5, Portage, IN 46368",                  type: "rest_area"   as const, lat: 41.570,  lng: -87.182,   hours: "24/7" },
  { name: "I-70 Russell Rest Area – KS",      address: "I-70 EB, Russell, KS 67665",                            type: "rest_area"   as const, lat: 38.901,  lng: -98.857,   hours: "24/7" },

  // ── SOUTH / TEXAS ────────────────────────────────────────────────────────
  { name: "Buc-ee's New Braunfels",           address: "100 Bucees Blvd, New Braunfels, TX 78130",              type: "gas_station" as const, lat: 29.691,  lng: -98.079,   hours: "24/7" },
  { name: "Buc-ee's Fort Worth (Alliance)",   address: "13901 Harmon Rd, Fort Worth, TX 76177",                 type: "gas_station" as const, lat: 32.981,  lng: -97.309,   hours: "24/7" },
  { name: "Buc-ee's Luling, TX",              address: "21067 US-183, Luling, TX 78648",                        type: "gas_station" as const, lat: 29.674,  lng: -97.657,   hours: "24/7" },
  { name: "Love's Travel Stop – Oklahoma City, OK", address: "3030 SW 59th St, Oklahoma City, OK 73119",       type: "gas_station" as const, lat: 35.443,  lng: -97.610,   hours: "24/7" },
  { name: "Flying J Travel Center – Amarillo, TX", address: "4068 Amarillo Blvd W, Amarillo, TX 79106",        type: "truck_stop"  as const, lat: 35.227,  lng: -101.831,  hours: "24/7" },
  { name: "I-10 Texas Welcome Center – El Paso", address: "I-10 EB near Anthony, TX 79821",                    type: "rest_area"   as const, lat: 31.990,  lng: -106.598,  hours: "24/7" },

  // ── SOUTHEAST ───────────────────────────────────────────────────────────
  { name: "Buc-ee's Daytona Beach, FL",       address: "2330 LPGA Blvd, Daytona Beach, FL 32124",               type: "gas_station" as const, lat: 29.143,  lng: -81.083,   hours: "24/7" },
  { name: "Buc-ee's Calhoun, GA",             address: "201 Buc-ee's Blvd, Calhoun, GA 30701",                  type: "gas_station" as const, lat: 34.487,  lng: -84.939,   hours: "24/7" },
  { name: "Buc-ee's Leeds, AL",               address: "1000 Buc-ee's Blvd, Leeds, AL 35094",                   type: "gas_station" as const, lat: 33.548,  lng: -86.557,   hours: "24/7" },
  { name: "Buc-ee's Winchester, KY",          address: "1000 Buc-ee's Blvd, Winchester, KY 40391",              type: "gas_station" as const, lat: 37.992,  lng: -84.177,   hours: "24/7" },
  { name: "Buc-ee's Florence, KY",            address: "7225 Turfway Rd, Florence, KY 41042",                   type: "gas_station" as const, lat: 38.980,  lng: -84.638,   hours: "24/7" },
  { name: "I-95 South Carolina Rest Area – Santee", address: "I-95 SB, Santee, SC 29142",                      type: "rest_area"   as const, lat: 33.489,  lng: -80.496,   hours: "24/7" },
  { name: "I-77 Fancy Gap Rest Area – VA",    address: "I-77 SB, Fancy Gap, VA 24328",                          type: "rest_area"   as const, lat: 36.651,  lng: -80.738,   hours: "24/7" },
  { name: "QuikTrip #934 – Atlanta, GA",      address: "I-285 & Peachtree Industrial Blvd, Dunwoody, GA 30338", type: "gas_station" as const, lat: 33.940,  lng: -84.334,   hours: "24/7" },

  // ── NORTHEAST / MID-ATLANTIC ────────────────────────────────────────────
  { name: "Vince Lombardi Service Area – NJ Tpke", address: "NJ Turnpike MP 116.0 NB, Ridgefield Park, NJ 07660", type: "rest_area" as const, lat: 40.854, lng: -74.021, hours: "24/7" },
  { name: "Molly Pitcher Service Area – NJ Tpke",  address: "NJ Turnpike MP 71.7 SB, Hazlet, NJ 07730",          type: "rest_area" as const, lat: 40.336, lng: -74.268, hours: "24/7" },
  { name: "Wawa #8113 – Newark, DE",          address: "270 E Main St, Newark, DE 19711",                        type: "gas_station" as const, lat: 39.684,  lng: -75.750,   hours: "24/7" },
  { name: "Sheetz #399 – Frederick, MD",      address: "2500 Osprey Way, Frederick, MD 21701",                   type: "gas_station" as const, lat: 39.414,  lng: -77.410,   hours: "24/7" },
  { name: "NY Thruway Chittenango Service Area", address: "I-90 WB MP 269, Chittenango, NY 13037",               type: "rest_area"   as const, lat: 43.044,  lng: -75.872,   hours: "24/7" },

  // ── MOUNTAIN WEST ────────────────────────────────────────────────────────
  { name: "Love's Travel Stop – Albuquerque, NM", address: "6901 Pan American Fwy NE, Albuquerque, NM 87109",   type: "gas_station" as const, lat: 35.167,  lng: -106.600,  hours: "24/7" },
  { name: "Pilot Travel Center – Grand Junction, CO", address: "2830 Crossroads Blvd, Grand Junction, CO 81506", type: "truck_stop" as const, lat: 39.064,  lng: -108.551,  hours: "24/7" },
  { name: "I-70 Vail Pass Rest Area – CO",    address: "I-70 WB Mile Marker 190, Vail, CO 81657",                type: "rest_area"   as const, lat: 39.553,  lng: -106.213,  hours: "24/7" },
  { name: "Flying J – Salt Lake City, UT",    address: "5150 W 3500 S, West Valley City, UT 84120",              type: "truck_stop"  as const, lat: 40.688,  lng: -112.009,  hours: "24/7" },
  { name: "I-40 NM Welcome Center – Gallup",  address: "I-40 EB, Gallup, NM 87301",                             type: "rest_area"   as const, lat: 35.528,  lng: -108.743,  hours: "24/7" },

  // ── PACIFIC ──────────────────────────────────────────────────────────────
  { name: "Love's Travel Stop – Redding, CA", address: "20777 Kittredge Rd, Redding, CA 96002",                  type: "gas_station" as const, lat: 40.587,  lng: -122.392,  hours: "24/7" },
  { name: "I-5 Rest Area – Centralia, WA",    address: "I-5 SB MP 82, Centralia, WA 98531",                     type: "rest_area"   as const, lat: 46.716,  lng: -122.954,  hours: "24/7" },
  { name: "Pilot Travel Center – Portland, OR", address: "3640 NW Yeon Ave, Portland, OR 97210",                 type: "truck_stop"  as const, lat: 45.534,  lng: -122.746,  hours: "24/7" },
];

type RatingRow = { cleanliness: number; smell: number; paperSupply: number; lighting: number; safety: number; familyFriendly: number; comment: string | null };

const SEED_RATINGS: Record<string, RatingRow[]> = {
  "Iowa 80 Truck Stop": [
    { cleanliness: 5, smell: 5, paperSupply: 5, lighting: 5, safety: 5, familyFriendly: 5, comment: "World's largest truck stop lives up to the hype. Spotless bathrooms, zero wait." },
    { cleanliness: 5, smell: 5, paperSupply: 5, lighting: 5, safety: 5, familyFriendly: 4, comment: "Iowa 80 is the gold standard for road trip pit stops. 10/10 every visit." },
    { cleanliness: 5, smell: 4, paperSupply: 5, lighting: 5, safety: 5, familyFriendly: 5, comment: "Like a spa compared to other truck stops. The shower facilities alone are worth the detour." },
  ],
  "Buc-ee's New Braunfels": [
    { cleanliness: 5, smell: 5, paperSupply: 5, lighting: 5, safety: 5, familyFriendly: 5, comment: "The largest Buc-ee's in the world and it shows. 100+ stalls, all spotless. Unreal." },
    { cleanliness: 5, smell: 5, paperSupply: 5, lighting: 5, safety: 5, familyFriendly: 5, comment: "My kids asked if we could live here. Genuinely cleaner than most hotels." },
    { cleanliness: 5, smell: 5, paperSupply: 5, lighting: 5, safety: 5, familyFriendly: 5, comment: "Fresh flowers in a gas station bathroom. I cried." },
    { cleanliness: 5, smell: 5, paperSupply: 5, lighting: 5, safety: 4, familyFriendly: 5, comment: "Royal Flush every single time. The standard all rest stops should be measured against." },
  ],
  "Buc-ee's Fort Worth (Alliance)": [
    { cleanliness: 5, smell: 5, paperSupply: 5, lighting: 5, safety: 5, familyFriendly: 5, comment: "Brand new location and it shows — immaculate. Staff cleaning constantly." },
    { cleanliness: 5, smell: 5, paperSupply: 4, lighting: 5, safety: 5, familyFriendly: 5, comment: "We made a 20-minute detour specifically for this Buc-ee's. Worth every mile." },
    { cleanliness: 5, smell: 4, paperSupply: 5, lighting: 5, safety: 5, familyFriendly: 5, comment: "Buc-ee's never misses. Alliance location is one of the best." },
  ],
  "Buc-ee's Luling, TX": [
    { cleanliness: 4, smell: 4, paperSupply: 4, lighting: 4, safety: 4, familyFriendly: 4, comment: "Solid Buc-ee's. Not the biggest but still miles ahead of any competitor." },
    { cleanliness: 4, smell: 3, paperSupply: 4, lighting: 4, safety: 4, familyFriendly: 4, comment: "Good stop between San Antonio and Houston. Dependable as always." },
    { cleanliness: 3, smell: 4, paperSupply: 4, lighting: 4, safety: 4, familyFriendly: 3, comment: "Busy on a holiday weekend — lines were long but it was still clean." },
  ],
  "Buc-ee's Daytona Beach, FL": [
    { cleanliness: 5, smell: 5, paperSupply: 5, lighting: 5, safety: 5, familyFriendly: 5, comment: "Florida Buc-ee's is the best thing to happen to I-95. Never stopping at a Pilot again." },
    { cleanliness: 5, smell: 5, paperSupply: 5, lighting: 5, safety: 5, familyFriendly: 4, comment: "Spring break traffic and the bathrooms were STILL spotless. Impressive." },
    { cleanliness: 4, smell: 5, paperSupply: 5, lighting: 5, safety: 5, familyFriendly: 5, comment: "Saved our road trip. Smells like fresh citrus, not regret." },
  ],
  "Buc-ee's Calhoun, GA": [
    { cleanliness: 5, smell: 5, paperSupply: 5, lighting: 5, safety: 5, familyFriendly: 5, comment: "Perfect I-75 stop between Atlanta and Chattanooga. Pristine as always." },
    { cleanliness: 5, smell: 4, paperSupply: 5, lighting: 5, safety: 5, familyFriendly: 5, comment: "The Calhoun Buc-ee's is our family's official halfway point. Never disappoints." },
    { cleanliness: 4, smell: 5, paperSupply: 4, lighting: 5, safety: 5, familyFriendly: 5, comment: "Quick in and out, clean stalls, stocked TP. What more do you want?" },
  ],
  "Buc-ee's Leeds, AL": [
    { cleanliness: 5, smell: 5, paperSupply: 5, lighting: 5, safety: 5, familyFriendly: 5, comment: "Alabama Buc-ee's is an institution. The bathrooms have a full-time cleaning crew walking around." },
    { cleanliness: 5, smell: 5, paperSupply: 5, lighting: 5, safety: 4, familyFriendly: 5, comment: "I've stopped here six times. Never had a bad experience." },
    { cleanliness: 4, smell: 5, paperSupply: 5, lighting: 5, safety: 5, familyFriendly: 5, comment: "Road trip tradition. Perfect off I-20." },
  ],
  "Buc-ee's Winchester, KY": [
    { cleanliness: 5, smell: 5, paperSupply: 5, lighting: 5, safety: 5, familyFriendly: 5, comment: "Kentucky Buc-ee's is top tier. Converted two non-believers on this trip." },
    { cleanliness: 5, smell: 5, paperSupply: 5, lighting: 5, safety: 5, familyFriendly: 4, comment: "Worth the 10-min detour off I-64. Every. Single. Time." },
    { cleanliness: 5, smell: 4, paperSupply: 5, lighting: 5, safety: 5, familyFriendly: 5, comment: "First time at a Buc-ee's. I now understand the cult following." },
  ],
  "Buc-ee's Florence, KY": [
    { cleanliness: 5, smell: 5, paperSupply: 5, lighting: 5, safety: 5, familyFriendly: 5, comment: "The Florence Buc-ee's is a gem. Cleaner than my bathroom at home. No notes." },
    { cleanliness: 5, smell: 5, paperSupply: 5, lighting: 5, safety: 5, familyFriendly: 5, comment: "We detoured 15 minutes off I-71/75 specifically for this. Worth every mile." },
    { cleanliness: 5, smell: 5, paperSupply: 4, lighting: 5, safety: 5, familyFriendly: 5, comment: "Royal Flush 100%. The gold standard of road trip stops." },
  ],
  "Pilot Flying J – Gary, IN": [
    { cleanliness: 3, smell: 2, paperSupply: 3, lighting: 3, safety: 3, familyFriendly: 3, comment: "It's a Flying J. You know what you're getting into. Clean enough to survive." },
    { cleanliness: 3, smell: 3, paperSupply: 3, lighting: 3, safety: 3, familyFriendly: 2, comment: "Typical truck stop experience. The trucker showers look nicer than the regular restrooms." },
    { cleanliness: 2, smell: 2, paperSupply: 3, lighting: 3, safety: 3, familyFriendly: 2, comment: "Smells like diesel and decisions. Gets the job done, don't linger." },
  ],
  "Casey's General Store – Bloomington, IL": [
    { cleanliness: 4, smell: 4, paperSupply: 4, lighting: 4, safety: 4, familyFriendly: 4, comment: "Casey's is underrated. This location is surprisingly well-kept." },
    { cleanliness: 4, smell: 3, paperSupply: 4, lighting: 4, safety: 4, familyFriendly: 3, comment: "Midwest gem. Clean bathroom, good pizza, get both." },
    { cleanliness: 3, smell: 4, paperSupply: 4, lighting: 3, safety: 4, familyFriendly: 3, comment: null },
  ],
  "I-90 Portage Service Plaza – IN": [
    { cleanliness: 3, smell: 3, paperSupply: 3, lighting: 3, safety: 3, familyFriendly: 3, comment: "Indiana Toll Road service plazas are adequate. This one smells like fast food, which is better than the alternative." },
    { cleanliness: 2, smell: 3, paperSupply: 2, lighting: 3, safety: 3, familyFriendly: 3, comment: "Gets crowded on summer weekends. Paper towels always run out." },
    { cleanliness: 3, smell: 2, paperSupply: 3, lighting: 3, safety: 3, familyFriendly: 2, comment: null },
  ],
  "I-70 Russell Rest Area – KS": [
    { cleanliness: 4, smell: 4, paperSupply: 4, lighting: 3, safety: 4, familyFriendly: 4, comment: "Middle-of-Kansas rest stop that's better than you'd expect. Kansas DOT takes pride in these." },
    { cleanliness: 3, smell: 4, paperSupply: 3, lighting: 4, safety: 4, familyFriendly: 3, comment: "Saved us in the middle of the Great Plains. Clean, functioning, thank you Kansas." },
    { cleanliness: 4, smell: 3, paperSupply: 4, lighting: 3, safety: 3, familyFriendly: 3, comment: null },
  ],
  "Love's Travel Stop – Oklahoma City, OK": [
    { cleanliness: 4, smell: 3, paperSupply: 4, lighting: 4, safety: 4, familyFriendly: 4, comment: "Oklahoma Love's are consistently solid. This one's well-maintained." },
    { cleanliness: 4, smell: 4, paperSupply: 4, lighting: 4, safety: 4, familyFriendly: 3, comment: "Reliable chain. Never great, never terrible. Good checkpoint stop." },
    { cleanliness: 3, smell: 3, paperSupply: 3, lighting: 4, safety: 4, familyFriendly: 3, comment: null },
  ],
  "Flying J Travel Center – Amarillo, TX": [
    { cleanliness: 3, smell: 2, paperSupply: 3, lighting: 3, safety: 3, familyFriendly: 2, comment: "It's Amarillo. The bathroom matches the vibe — functional, dusty, a bit grim." },
    { cleanliness: 2, smell: 2, paperSupply: 3, lighting: 3, safety: 3, familyFriendly: 2, comment: "Only stopped because we had no choice crossing the Panhandle. Gets the job done." },
    { cleanliness: 3, smell: 3, paperSupply: 2, lighting: 3, safety: 3, familyFriendly: 3, comment: null },
  ],
  "I-10 Texas Welcome Center – El Paso": [
    { cleanliness: 4, smell: 4, paperSupply: 4, lighting: 4, safety: 4, familyFriendly: 4, comment: "Texas Welcome Centers are always well-run. Great first (or last) stop in the state." },
    { cleanliness: 4, smell: 3, paperSupply: 4, lighting: 4, safety: 4, familyFriendly: 4, comment: "Friendly staff, clean restrooms, free maps. Classic Texas hospitality." },
    { cleanliness: 3, smell: 4, paperSupply: 4, lighting: 3, safety: 4, familyFriendly: 3, comment: null },
  ],
  "I-95 South Carolina Rest Area – Santee": [
    { cleanliness: 3, smell: 3, paperSupply: 3, lighting: 3, safety: 3, familyFriendly: 3, comment: "SC rest areas are passable. Santee is a reliable I-95 stop, nothing more." },
    { cleanliness: 2, smell: 3, paperSupply: 2, lighting: 3, safety: 3, familyFriendly: 3, comment: "Gets PACKED during snowbird season. Long lines, moderate cleanliness." },
    { cleanliness: 3, smell: 2, paperSupply: 3, lighting: 3, safety: 3, familyFriendly: 2, comment: null },
  ],
  "I-77 Fancy Gap Rest Area – VA": [
    { cleanliness: 4, smell: 4, paperSupply: 4, lighting: 4, safety: 4, familyFriendly: 4, comment: "Beautiful mountain views and a clean bathroom. Virginia rest areas punch above their weight." },
    { cleanliness: 4, smell: 4, paperSupply: 3, lighting: 3, safety: 4, familyFriendly: 4, comment: "Great stop on the way to the Blue Ridge Parkway. Well-maintained." },
    { cleanliness: 3, smell: 4, paperSupply: 4, lighting: 4, safety: 4, familyFriendly: 3, comment: null },
  ],
  "QuikTrip #934 – Atlanta, GA": [
    { cleanliness: 4, smell: 4, paperSupply: 4, lighting: 5, safety: 4, familyFriendly: 4, comment: "QuikTrip is the Buc-ee's of the Southeast and I will die on this hill. Always clean." },
    { cleanliness: 5, smell: 4, paperSupply: 5, lighting: 5, safety: 4, familyFriendly: 4, comment: "QT never misses. This location near 285 is spotless even during rush hour." },
    { cleanliness: 4, smell: 4, paperSupply: 4, lighting: 4, safety: 4, familyFriendly: 3, comment: "Atlanta traffic is brutal but at least QT bathrooms are a safe harbor." },
  ],
  "Vince Lombardi Service Area – NJ Tpke": [
    { cleanliness: 3, smell: 3, paperSupply: 3, lighting: 3, safety: 3, familyFriendly: 3, comment: "NJ Turnpike service areas are what they are. Vince Lombardi is better than the southern ones." },
    { cleanliness: 3, smell: 2, paperSupply: 3, lighting: 4, safety: 3, familyFriendly: 3, comment: "Holiday weekends are rough — lines 20+ deep. Standard cleanliness otherwise." },
    { cleanliness: 2, smell: 3, paperSupply: 2, lighting: 3, safety: 3, familyFriendly: 2, comment: "It's fine. New Jersey is fine." },
  ],
  "Molly Pitcher Service Area – NJ Tpke": [
    { cleanliness: 2, smell: 2, paperSupply: 2, lighting: 3, safety: 3, familyFriendly: 2, comment: "If Vince Lombardi is a 6, Molly Pitcher is a 4. Under-cleaned and understaffed." },
    { cleanliness: 3, smell: 2, paperSupply: 2, lighting: 3, safety: 3, familyFriendly: 2, comment: "The food smells from the plaza don't help. Bathroom situation is grim." },
    { cleanliness: 2, smell: 2, paperSupply: 3, lighting: 3, safety: 3, familyFriendly: 2, comment: null },
  ],
  "Wawa #8113 – Newark, DE": [
    { cleanliness: 4, smell: 4, paperSupply: 4, lighting: 4, safety: 4, familyFriendly: 4, comment: "Wawa bathrooms are underrated. This location is consistently clean." },
    { cleanliness: 4, smell: 4, paperSupply: 4, lighting: 4, safety: 4, familyFriendly: 4, comment: "Mid-Atlantic staple. If you're on I-95 and need to stop, find a Wawa. You won't regret it." },
    { cleanliness: 5, smell: 4, paperSupply: 4, lighting: 5, safety: 4, familyFriendly: 4, comment: "Hot coffee + clean bathroom = road trip perfection. Wawa 4ever." },
  ],
  "Sheetz #399 – Frederick, MD": [
    { cleanliness: 4, smell: 4, paperSupply: 4, lighting: 5, safety: 4, familyFriendly: 4, comment: "Sheetz is quietly one of the best gas station bathroom experiences in the country. Bright, clean, fresh." },
    { cleanliness: 4, smell: 4, paperSupply: 4, lighting: 4, safety: 4, familyFriendly: 4, comment: "The Frederick Sheetz is well-run. Staff takes it seriously." },
    { cleanliness: 3, smell: 4, paperSupply: 3, lighting: 4, safety: 4, familyFriendly: 3, comment: null },
  ],
  "NY Thruway Chittenango Service Area": [
    { cleanliness: 3, smell: 3, paperSupply: 3, lighting: 3, safety: 3, familyFriendly: 3, comment: "Standard Thruway service area. Hits different at 2am when you're desperate." },
    { cleanliness: 3, smell: 2, paperSupply: 4, lighting: 3, safety: 3, familyFriendly: 3, comment: "Gets very crowded on holiday weekends. Lines can be long but the stalls stay reasonably clean." },
    { cleanliness: 2, smell: 3, paperSupply: 3, lighting: 4, safety: 3, familyFriendly: 3, comment: null },
  ],
  "Love's Travel Stop – Albuquerque, NM": [
    { cleanliness: 4, smell: 3, paperSupply: 4, lighting: 4, safety: 4, familyFriendly: 3, comment: "Good stop on I-25 or I-40. Better than the Pilot up the road." },
    { cleanliness: 3, smell: 4, paperSupply: 3, lighting: 4, safety: 4, familyFriendly: 3, comment: "Albuquerque Love's is a solid desert pit stop. Didn't hate it." },
    { cleanliness: 4, smell: 3, paperSupply: 4, lighting: 3, safety: 4, familyFriendly: 3, comment: null },
  ],
  "Pilot Travel Center – Grand Junction, CO": [
    { cleanliness: 3, smell: 3, paperSupply: 3, lighting: 3, safety: 3, familyFriendly: 3, comment: "Colorado plateau stop on I-70. Clean enough after a long drive from Denver." },
    { cleanliness: 3, smell: 2, paperSupply: 4, lighting: 3, safety: 3, familyFriendly: 3, comment: "Grand Junction Pilot is fine. The truck parking lot is enormous, the bathroom is small." },
    { cleanliness: 4, smell: 3, paperSupply: 3, lighting: 4, safety: 3, familyFriendly: 2, comment: null },
  ],
  "I-70 Vail Pass Rest Area – CO": [
    { cleanliness: 4, smell: 4, paperSupply: 3, lighting: 3, safety: 4, familyFriendly: 4, comment: "Stunning mountain views. The bathroom doesn't match but after crossing Vail Pass you're just grateful." },
    { cleanliness: 3, smell: 3, paperSupply: 3, lighting: 2, safety: 4, familyFriendly: 3, comment: "Cold in winter, busy in summer. The outdoor setting makes up for the basic facilities." },
    { cleanliness: 4, smell: 3, paperSupply: 4, lighting: 3, safety: 4, familyFriendly: 4, comment: "Best rest stop view in America. Rocky Mountains at 10,600 feet. 10/10 for scenery." },
  ],
  "Flying J – Salt Lake City, UT": [
    { cleanliness: 4, smell: 3, paperSupply: 4, lighting: 4, safety: 4, familyFriendly: 3, comment: "One of the better Flying J's I've stopped at. Big and reasonably clean." },
    { cleanliness: 3, smell: 3, paperSupply: 3, lighting: 4, safety: 4, familyFriendly: 3, comment: "SLC Flying J is a solid I-15 or I-80 stop. Nothing fancy but reliable." },
    { cleanliness: 4, smell: 4, paperSupply: 3, lighting: 3, safety: 3, familyFriendly: 3, comment: null },
  ],
  "I-40 NM Welcome Center – Gallup": [
    { cleanliness: 3, smell: 3, paperSupply: 3, lighting: 3, safety: 3, familyFriendly: 3, comment: "Gallup is a welcome sight in the desert. Basic facilities, friendly staff, free maps." },
    { cleanliness: 2, smell: 3, paperSupply: 2, lighting: 3, safety: 3, familyFriendly: 2, comment: "Only stop if desperate between Flagstaff and Albuquerque. It'll do." },
    { cleanliness: 3, smell: 2, paperSupply: 3, lighting: 3, safety: 3, familyFriendly: 3, comment: null },
  ],
  "Love's Travel Stop – Redding, CA": [
    { cleanliness: 3, smell: 3, paperSupply: 3, lighting: 4, safety: 3, familyFriendly: 3, comment: "Best stop on I-5 between Sacramento and Oregon. California rest areas are bad, this Love's saves you." },
    { cleanliness: 4, smell: 3, paperSupply: 4, lighting: 4, safety: 3, familyFriendly: 3, comment: "The Redding Love's is a lifeline on the northern California highway. Solid." },
    { cleanliness: 3, smell: 3, paperSupply: 3, lighting: 3, safety: 3, familyFriendly: 3, comment: null },
  ],
  "I-5 Rest Area – Centralia, WA": [
    { cleanliness: 4, smell: 4, paperSupply: 4, lighting: 4, safety: 4, familyFriendly: 4, comment: "Washington state rest areas are among the best in the country. Centralia is no exception." },
    { cleanliness: 4, smell: 4, paperSupply: 4, lighting: 4, safety: 4, familyFriendly: 4, comment: "Clean, well-lit, landscaped grounds. Washington DOT takes pride in these stops." },
    { cleanliness: 5, smell: 4, paperSupply: 4, lighting: 4, safety: 4, familyFriendly: 5, comment: "Rainy day stop with clean facilities and a covered dog walk area. PNW doing it right." },
  ],
  "Pilot Travel Center – Portland, OR": [
    { cleanliness: 3, smell: 3, paperSupply: 3, lighting: 3, safety: 3, familyFriendly: 3, comment: "Portland Pilot is busy but functional. Peak I-5 stop." },
    { cleanliness: 3, smell: 2, paperSupply: 3, lighting: 4, safety: 3, familyFriendly: 3, comment: "Busy truck stop near the airport. Does the job. Don't expect luxury." },
    { cleanliness: 4, smell: 3, paperSupply: 3, lighting: 3, safety: 3, familyFriendly: 3, comment: null },
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
