import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

const panel = sqliteTable("panel", {
  id: integer("id").primaryKey().unique(),
  name: text("name"),
});

export default panel;