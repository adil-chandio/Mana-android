import { MODEL, modelInput, modelText, modelFailureReason } from './model.mjs';
import { ASSETS } from './assets.generated.mjs';
import { createPairingHandler } from '../pairing/worker.mjs';
import { LIMITS, Failure } from '../chat/protocol.mjs';
import { RESERVE_SQL } from '../chat/budget.mjs';
import { authorize } from './auth.mjs';
import { bounded, defaultClock } from './deadline.mjs';
import { CHAT_PATH, CHECK_PATH } from './wire.mjs';
const security = {
  'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; object-src 'none'; form-action 'none'; frame-ancestors 'none'",
};
function reply(data, status = 200) { return Response.json(data, { status, headers: security }); }
async function reserve(db, now) {
  let row;
  try {
    row = await db.prepare(RESERVE_SQL).bind(new Date(now).toISOString().slice(0, 10),
      Math.floor(now / 60_000), LIMITS.perDay, LIMITS.perMinute).first();
  } catch { throw new Failure(503, 'BUDGET_UNAVAILABLE'); }
  if (row === null) throw new Failure(429, 'REQUEST_LIMIT');
  if (row?.id !== 1) throw new Failure(503, 'BUDGET_UNAVAILABLE');
}
export function createHandler({ clock = defaultClock } = {}) {
  const pairing = createPairingHandler({ clock });
  return async function fetch(request, env = {}) {
    const url = new URL(request.url);
    if (![CHAT_PATH, CHECK_PATH].includes(url.pathname)) {
      if (request.method === 'GET' && !url.search && !url.hash && Object.hasOwn(ASSETS, url.pathname)) {
        const [type, body] = ASSETS[url.pathname];
        return new Response(body, { headers: { ...security, 'Content-Type': type } });
      }
      if (url.pathname === '/chat/health' && request.method === 'GET') return reply({ service: 'maya-signed-chat', liveConnectionVerified: false, inferenceInvoked: false });
      return pairing(request, env);
    }
    let dispatched = false;
    const requestId = crypto.randomUUID();
    try {
      if (request.method !== 'POST') throw new Failure(405, 'POST_ONLY');
      // Operator acknowledgements, NOT automatic verification of plan/eligibility.
      // A user can run empty signed diagnostics without an AI binding or any flag below.
      if (url.pathname === CHAT_PATH && (env.ENABLE_CHAT !== 'true' || env.FREE_PLAN_CONFIRMED !== 'true'
          || env.MODEL_REVIEW_CONFIRMED !== 'true' || env.LIVE_AUTH_CHECKS_CONFIRMED !== 'true'
          || typeof env.AI?.run !== 'function')) throw new Failure(503, 'CHAT_NOT_ENABLED');
      return await bounded(request, clock, async scope => {
        const auth = await authorize(request, env, scope, clock); scope.check();
        if (url.pathname === CHECK_PATH) return reply({ kind: 'chat-auth-verified', keyId: auth.keyId, nonce: auth.nonce, aiConnected: false });
        // Replay claim precedes quota. Errors/aborts do not refund or auto-resubmit.
        await reserve(env.DB, clock.now()); scope.check();
        let output; dispatched = true;
        try {
          output = await env.AI.run(MODEL, modelInput(auth.messages));
        } catch { scope.check(); throw new Failure(502, 'MODEL_UNAVAILABLE'); }
        scope.check();
        const text = modelText(output);
        return reply({ requestId, kind: 'model-response', model: MODEL, text,
          keyId: auth.keyId, nonce: auth.nonce, capabilities: { text: true, tools: false, vision: false, voice: false } });
      });
    } catch (error) {
      const safe = error instanceof Failure ? error : new Failure(503, 'SERVICE_UNAVAILABLE');
      const reason = dispatched && safe.code === 'INVALID_MODEL_RESPONSE' ? modelFailureReason(error) : undefined;
      return reply({ requestId, error: { code: safe.code, automaticRetry: false,
        ...(reason ? { validationReason: reason } : {}),
        providerOutcome: dispatched ? 'unknown_or_completed' : 'not_dispatched' } }, safe.status);
    } finally {
      if (request.body && !request.body.locked) request.body.cancel().catch(() => {});
    }
  };
}
export default { fetch: createHandler() };
