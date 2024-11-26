import { createClient } from '@libsql/client/sqlite3';
import { drizzle } from 'drizzle-orm/libsql';
import { seed } from 'drizzle-seed';
import { load } from '@/db/schema';

export async function createDatabase(file_name: string, extension: string = 'sqlite') {
  const client = createClient({
    url: `file:${process.cwd()}/${file_name}.${extension}`,
  });

  const db = drizzle(client);

  await seed(db, { load }, { count: 20 });
  return db
}