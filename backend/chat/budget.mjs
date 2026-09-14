import { LIMITS, Failure } from './protocol.mjs';

// One persistent, atomic counter row. No prompts, replies, IPs or identities stored.
// Window keys only move forward: late writes cannot reset a newer budget window.
// A failed/uncertain call keeps its reservation: never refund and silently replay.
export const RESERVE_SQL = `INSERT INTO chat_budget
  (id, utc_day, day_count, minute_id, minute_count) VALUES (1, ?, 1, ?, 1)
  ON CONFLICT(id) DO UPDATE SET
    utc_day = excluded.utc_day,
    day_count = CASE WHEN chat_budget.utc_day = excluded.utc_day THEN chat_budget.day_count + 1 ELSE 1 END,
    minute_id = excluded.minute_id,
    minute_count = CASE WHEN chat_budget.minute_id = excluded.minute_id THEN chat_budget.minute_count + 1 ELSE 1 END
  WHERE (chat_budget.utc_day < excluded.utc_day OR (chat_budget.utc_day = excluded.utc_day AND chat_budget.day_count < ?))
    AND (chat_budget.minute_id < excluded.minute_id OR (chat_budget.minute_id = excluded.minute_id AND chat_budget.minute_count < ?))
  RETURNING id`;

export async function reserveBudget(db, now) {
  if (!db?.prepare) throw new Failure(503, 'BUDGET_UNAVAILABLE');
  try {
    const row = await db.prepare(RESERVE_SQL).bind(new Date(now).toISOString().slice(0, 10),
      Math.floor(now / 60_000), LIMITS.perDay, LIMITS.perMinute).first();
    if (!row) throw new Failure(429, 'REQUEST_LIMIT');
  } catch (error) {
    if (error instanceof Failure) throw error;
    throw new Failure(503, 'BUDGET_UNAVAILABLE');
  }
}
