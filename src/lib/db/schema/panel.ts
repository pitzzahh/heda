import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

const panel = sqliteTable("panel", {
  id: integer("id").primaryKey().unique(),
  name: text("name").notNull(),
});

export default panel;