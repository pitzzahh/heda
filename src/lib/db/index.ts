import { createClient } from '@libsql/client/sqlite3';
import { drizzle } from 'drizzle-orm/libsql';
import { seed } from 'drizzle-seed';
import * as schema from '@/db/schema';

export async function createDatabase(file_name: string, extension: string = 'sqlite') {
  const client = createClient({
    url: `file:${process.cwd()}/${file_name}.${extension}`,
  });

  const db = drizzle(client);

  const seed_result = await seed(db, schema, { count: 20 });
  console.log('seed_result', seed_result);
  return db
}