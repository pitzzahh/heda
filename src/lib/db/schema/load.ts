import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

const load = sqliteTable("load", {
  id: integer("id").primaryKey().unique(),
  load_description: text("load_description").default("NULL"),
  quantity: integer("quantity"),
  varies: integer("varies"),
  // created_at: text("created_at").default("CURRENT_TIMESTAMP"),
  // deleted_at: text("deleted_at").default("NULL"),
  is_panel: integer("is_panel").default(0),
  continuous: integer("continuous").notNull().default(0),
  special: text("special").default("NULL"),
  // updated_at: text("updated_at").default("CURRENT_TIMESTAMP"),
});

export default load;