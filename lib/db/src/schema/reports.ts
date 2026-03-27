import { pgTable, serial, timestamp, integer, text, pgEnum } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { stopsTable } from "./stops";

export const reportTypeEnum = pgEnum("report_type", [
  "permanently_closed",
  "temporarily_closed",
  "wrong_location",
  "wrong_info",
  "other",
]);

export const reportsTable = pgTable("stop_reports", {
  id: serial("id").primaryKey(),
  stopId: integer("stop_id").notNull().references(() => stopsTable.id),
  reportType: reportTypeEnum("report_type").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Report = typeof reportsTable.$inferSelect;
