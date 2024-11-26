import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

const load = sqliteTable("load", {
  age: integer("age").default(18),
  // city: text("city").default("NULL"),
  // created_at: text("created_at").default("CURRENT_TIMESTAMP"),
  // deleted_at: text("deleted_at").default("NULL"),
  // email: text("email").unique(),
  id: integer("id").primaryKey().unique(),
  name: text("name"),
  is_panel: integer("is_panel").default(0),
  // updated_at: text("updated_at").default("CURRENT_TIMESTAMP"),
});

export default load;