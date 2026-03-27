import { pgTable, serial, timestamp, integer, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { stopsTable } from "./stops";

export const ratingsTable = pgTable("ratings", {
  id: serial("id").primaryKey(),
  stopId: integer("stop_id").notNull().references(() => stopsTable.id),
  cleanliness: integer("cleanliness").notNull(),
  smell: integer("smell").notNull(),
  paperSupply: integer("paper_supply").notNull(),
  lighting: integer("lighting").notNull(),
  safety: integer("safety").notNull(),
  familyFriendly: integer("family_friendly").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRatingSchema = createInsertSchema(ratingsTable).omit({ id: true, createdAt: true });
export type InsertRating = z.infer<typeof insertRatingSchema>;
export type Rating = typeof ratingsTable.$inferSelect;
