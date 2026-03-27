import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { stopsTable } from "./stops";

export const photosTable = pgTable("photos", {
  id: serial("id").primaryKey(),
  stopId: integer("stop_id").notNull().references(() => stopsTable.id, { onDelete: "cascade" }),
  objectPath: text("object_path").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Photo = typeof photosTable.$inferSelect;
