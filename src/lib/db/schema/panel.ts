import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

const panel = sqliteTable("panel", {
  age: integer("age").default(18),
  // city: text("city").default("NULL"),
  // created_at: text("created_at").default("CURRENT_TIMESTAMP"),
  // deleted_at: text("deleted_at").default("NULL"),
  // email: text("email").unique(),
  id: integer("id").primaryKey().unique(),
  name: text("name"),
  // updated_at: text("updated_at").default("CURRENT_TIMESTAMP"),
});

export default panel;