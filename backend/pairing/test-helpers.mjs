// Test-only bindings. Never imported by the Worker or web client.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { publicJwk, fingerprint } from './shared.mjs';
export function clock() {
  let now = Date.UTC(2026, 8, 11), n = 0; const tasks = new Map();
  return { tasks, now: () => now, set(fn, ms) { const id = ++n; tasks.set(id, { fn, due: now + ms }); return id; }, clear(id) { tasks.delete(id); },
    advance(ms, fire = true) { now += ms; if (fire) for (const [id, t] of [...tasks]) if (t.due <= now) { tasks.delete(id); t.fn(); } } };
}
export function database() {
  const sqlite = new DatabaseSync(':memory:'); sqlite.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
  const DB = { prepare(sql) { return { bind(...args) { return { sql, args }; } }; },
    async batch(statements) {
      sqlite.exec('BEGIN IMMEDIATE');
      try { const output = statements.map(s => ({ success: true, results: sqlite.prepare(s.sql).all(...s.args) })); sqlite.exec('COMMIT'); return output; }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    } };
  return { sqlite, DB };
}
export async function key() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const out = await crypto.subtle.exportKey('jwk', pair.publicKey);
  const jwk = publicJwk({ kty: out.kty, crv: out.crv, x: out.x, y: out.y });
  return { privateKey: pair.privateKey, publicJwk: jwk, keyId: await fingerprint(jwk) };
}
