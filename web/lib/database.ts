import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";

export const schema = `
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS chat_turns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  input TEXT NOT NULL CHECK(length(input) BETWEEN 1 AND 200),
  reply TEXT, intent TEXT, outcome TEXT NOT NULL DEFAULT 'pending' CHECK(outcome IN ('pending','answered','error')),
  duration_ms INTEGER, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS commands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  turn_id INTEGER REFERENCES chat_turns(id),
  source TEXT NOT NULL CHECK(source IN ('chat','manual','preset')),
  path TEXT NOT NULL,
  outcome TEXT NOT NULL DEFAULT 'pending' CHECK(outcome IN ('pending','confirmed','failed','unknown')),
  status_code INTEGER, response_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS presets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 40),
  mode TEXT NOT NULL CHECK(mode IN ('steady','blink')),
  brightness INTEGER NOT NULL CHECK(brightness BETWEEN 0 AND 100),
  on_ms INTEGER NOT NULL CHECK(on_ms BETWEEN 50 AND 5000),
  off_ms INTEGER NOT NULL CHECK(off_ms BETWEEN 50 AND 5000),
  count INTEGER NOT NULL CHECK(count BETWEEN 0 AND 100),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK(mode != 'blink' OR brightness > 0),
  UNIQUE(session_id,name)
);
CREATE INDEX IF NOT EXISTS chat_session_time ON chat_turns(session_id,id DESC);
CREATE INDEX IF NOT EXISTS commands_session_time ON commands(session_id,id DESC);
CREATE INDEX IF NOT EXISTS commands_turn ON commands(turn_id);
PRAGMA user_version = 1;
`;

export function openDatabase(path: string) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new Database(path);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  const version = db.pragma('user_version', { simple: true });
  if (version > 1) throw new Error('Database version is newer than this application');
  if (version === 0) db.transaction(() => db.exec(schema))();
  return db;
}

let instance: ReturnType<typeof openDatabase>;
export function database() {
  return instance ??= openDatabase(process.env.DATABASE_PATH || resolve(process.cwd(), 'data/luma.sqlite'));
}

export function persistentSessionFor(request: Request, db = database()): string {
  const candidate = request.headers.get('cookie')?.match(/(?:^|;\s*)luma_session=([a-f0-9-]{36})(?:;|$)/)?.[1];
  if (candidate && db.prepare('SELECT id FROM sessions WHERE id=?').get(candidate)) return candidate;
  const id = randomUUID();
  db.prepare('INSERT INTO sessions(id) VALUES (?)').run(id);
  return id;
}

export function sessionFor(request: Request, db = database()): string {
  const pageId = request.headers.get('x-luma-session');
  if (pageId && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(pageId)) {
    db.prepare('INSERT OR IGNORE INTO sessions(id) VALUES (?)').run(pageId);
    return pageId;
  }
  return persistentSessionFor(request, db);
}

export function sessionResponse(request: Request, response: Response, session: string) {
  response.headers.set('Cache-Control', 'no-store');
  if (!request.headers.has('x-luma-session')) persistentSessionResponse(request, response, session);
  return response;
}

export function persistentSessionResponse(request: Request, response: Response, session: string) {
  response.headers.append('Set-Cookie', `luma_session=${session}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`);
  return response;
}

export function recentTurns(session: string, limit = 50) {
  return database().prepare('SELECT id,input,reply,intent,outcome,duration_ms,created_at FROM chat_turns WHERE session_id=? ORDER BY id DESC LIMIT ?').all(session, Math.min(100, Math.max(1, limit))).reverse();
}

export function storedContext(session: string) {
  return recentTurns(session, 3).filter((row: any) => row.outcome === 'answered').flatMap((row: any) => [
    { role: 'user', text: row.input }, { role: 'model', text: row.reply },
  ]);
}

export type PresetInput = { name: string; mode: 'steady' | 'blink'; brightness: number; onMs: number; offMs: number; count: number };
export function validatePreset(input: unknown): PresetInput | null {
  if (!input || typeof input !== 'object') return null;
  const p = input as PresetInput;
  const integer = (v: number, min: number, max: number) => Number.isInteger(v) && v >= min && v <= max;
  if (typeof p.name !== 'string' || !p.name.trim() || p.name.trim().length > 40 || !['steady','blink'].includes(p.mode) ||
      !integer(p.brightness, p.mode === 'blink' ? 1 : 0, 100) || !integer(p.onMs,50,5000) || !integer(p.offMs,50,5000) || !integer(p.count,0,100)) return null;
  return { ...p, name: p.name.trim() };
}
