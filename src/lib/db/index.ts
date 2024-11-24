import { createClient } from '@libsql/client/sqlite3';
import { drizzle } from 'drizzle-orm/libsql';

export function createDatabase(file_name: string, extension: string = 'sqlite') {
  const client = createClient({
    url: `file:${process.cwd()}/${file_name}.${extension}`,
  });
  return drizzle(client);
}