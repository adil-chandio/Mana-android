import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
export { clock, key } from '../pairing/test-helpers.mjs';
export function database() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../pairing/schema.sql', import.meta.url), 'utf8'));
  sqlite.exec(readFileSync(new URL('schema.sql', import.meta.url), 'utf8'));
  const DB = { prepare(sql) { return { bind(...args) { return { sql, args, async first() { return sqlite.prepare(sql).get(...args) ?? null; } }; } }; },
    async batch(statements) {
      sqlite.exec('BEGIN IMMEDIATE');
      try { const result = statements.map(s => ({ success: true, results: sqlite.prepare(s.sql).all(...s.args) })); sqlite.exec('COMMIT'); return result; }
      catch (e) { sqlite.exec('ROLLBACK'); throw e; }
    } };
  return { DB, sqlite };
}
export function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }

// Synthetic provider envelope only: no model inference in tests.
export function completion(content = 'Synthetic fixture response.') {
  return { object: 'chat.completion', choices: [{ index: 0, finish_reason: 'stop',
    message: { role: 'assistant', content } }] };
}
