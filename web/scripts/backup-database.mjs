import Database from 'better-sqlite3';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const source = resolve(process.env.DATABASE_PATH || './data/luma.sqlite');
const destination = process.argv[2] && resolve(process.argv[2]);
if (!destination || destination === source || !existsSync(source) || existsSync(destination)) {
  console.error('Usage: DATABASE_PATH=<source.sqlite> node scripts/backup-database.mjs <new-backup.sqlite>');
  process.exit(1);
}
const db = new Database(source,{ readonly:true });
try {
  await db.backup(destination);
  console.log(`Backup created: ${destination}`);
} finally { db.close(); }
