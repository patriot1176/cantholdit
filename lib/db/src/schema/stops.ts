import { pgTable, text, serial, timestamp, real, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const stopTypeEnum = pgEnum("stop_type", [
  "rest_area",
  "gas_station",
  "fast_food",
  "truck_stop",
  "walmart",
  "other",
]);

export const stopsTable = pgTable("stops", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  type: stopTypeEnum("type").notNull().default("other"),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  hours: text("hours"),
  amenities: text("amenities").default("[]").notNull(),
  highway: text("highway"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertStopSchema = createInsertSchema(stopsTable).omit({ id: true, createdAt: true });
export type InsertStop = z.infer<typeof insertStopSchema>;
export type Stop = typeof stopsTable.$inferSelect;
