import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

const highest_unit = sqliteTable("highest_unit", {
  id: integer("id").primaryKey().unique(),
  distribution_unit: text("distribution_unit").default("NULL"),
  wire_length: integer("wire_length"),
  ambient_temp: integer("ambient_temp").notNull().default(0),
  phase: text("phase"),
  // created_at: text("created_at").default("CURRENT_TIMESTAMP"),
  // deleted_at: text("deleted_at").default("NULL"),
  // updated_at: text("updated_at").default("CURRENT_TIMESTAMP"),
});

export default highest_unit;