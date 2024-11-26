import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema/index.ts",
  verbose: false,
  strict: true,
  out: "./src-tauri/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: "file:test.heda"
  }
});