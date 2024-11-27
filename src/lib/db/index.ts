// import { createClient } from '@libsql/client/sqlite3';
// import { drizzle } from 'drizzle-orm/libsql';
// import { seed } from 'drizzle-seed';
// import * as schema from '@/db/schema';

// export async function createDatabase(file_name: string, extension: string = 'sqlite') {
//   const client = createClient({
//     url: `file:${process.cwd()}/${file_name}.${extension}`,
//   });

//   const db = drizzle(client);

//   const seed_result = await seed(db, schema, { count: 20 });
//   console.log('seed_result', seed_result);
//   return db
// }

import { drizzle } from "drizzle-orm/sqlite-proxy";
import Database from "tauri-plugin-sql-api";
import * as schema from '@/db/schema';

/**
 * Represents the result of a SELECT query.
 */
export type SelectQueryResult = {
  [key: string]: any;
};

/**
 * Loads the sqlite database via the Tauri Proxy.
 * @param file_name The name of the database file.
 * @param file_extenstion The extension of the database file.
 */
export async function loadDatabase(file_name: string = "sqlite-1", file_extenstion: string = "db") {
  const db_path = `sqlite:${file_name}.${file_extenstion}`;
  return typeof window !== "undefined" ? await Database.load(db_path) : ({} as Database);
}


/**
 * The drizzle database instance.
 */
export async function createDatabase(database: Database) {
  return drizzle<typeof schema>(
    async (sql, params, method) => {
      let rows: any = [];
      let results = [];

      // If the query is a SELECT, use the select method
      if (isSelectQuery(sql)) {
        rows = await database.select(sql, params).catch((e) => {
          console.error("SQL Error:", e);
          return [];
        });
      } else {
        // Otherwise, use the execute method
        rows = await database.execute(sql, params).catch((e) => {
          console.error("SQL Error:", e);
          return [];
        });
        return { rows: [] };
      }

      rows = rows.map((row: any) => {
        return Object.values(row);
      });

      // If the method is "all", return all rows
      results = method === "all" ? rows : rows[0];

      return { rows: results };
    },
    // Pass the schema to the drizzle instance
    { schema: schema, logger: true }
  );
}


/**
 * Checks if the given SQL query is a SELECT query.
 * @param sql The SQL query to check.
 * @returns True if the query is a SELECT query, false otherwise.
 */
function isSelectQuery(sql: string): boolean {
  const selectRegex = /^\s*SELECT\b/i;
  return selectRegex.test(sql);
}