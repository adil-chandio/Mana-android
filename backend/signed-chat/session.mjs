import { isValidationReason } from './validation-diagnostics.mjs';
import { MODEL } from './model.mjs';
import { LIMITS, validateMessages } from '../chat/protocol.mjs';
import { signChat, CHAT_PATH, CHECK_PATH } from './wire.mjs';
// Monotonic local durations/deadlines only; wire signatures still use Date.now().
const clockDefault = { now: () => performance.now(), set: (fn, ms) => setTimeout(fn, ms), clear: id => clearTimeout(id) };
const SAFE = new Set(['CHAT_NOT_ENABLED', 'SETUP_REQUIRED', 'INVALID_OWNER_CONFIGURATION', 'SIGNATURE_REQUIRED',
  'INVALID_APK_CONFIGURATION', 'BAD_SIGNATURE', 'REQUEST_EXPIRED_OR_CLOCK_SKEW', 'REPLAY_OR_WINDOW_FULL', 'REPLAY_STORE_UNAVAILABLE',
  'ORIGIN_OR_TARGET_DENIED', 'JSON_ONLY', 'BODY_TOO_LARGE', 'INVALID_JSON', 'INVALID_REQUEST', 'INVALID_MESSAGES',
  'EMPTY_CHECK_REQUIRED', 'BUDGET_UNAVAILABLE', 'REQUEST_LIMIT', 'MODEL_UNAVAILABLE', 'INVALID_MODEL_RESPONSE',
  'STOPPED_LOCALLY', 'DEADLINE_EXCEEDED', 'SERVICE_UNAVAILABLE', 'STORAGE_UNAVAILABLE', 'STORAGE_TIMEOUT',
  'INVALID_LOCAL_KEY', 'KEY_REQUIRED', 'KEY_CHANGED', 'CONSENT_REQUIRED', 'NETWORK_UNCERTAIN',
  'INVALID_SERVER_RESPONSE', 'CONTEXT_LIMIT', 'INVALID_TARGET', 'REPLAY_CHECK_FAILED']);
function fault(code, outcome) { return Object.assign(new Error(code), { code, outcome }); }
function safeCode(error) { const code = error?.code || error?.message; return SAFE.has(code) ? code : 'SERVICE_UNAVAILABLE'; }
function context(history, text) {
  if (history.some(m => m.content.length > LIMITS.contentChars)) throw fault('CONTEXT_LIMIT');
  const messages = [...history, { role: 'user', content: text }];
  try { validateMessages({ messages }); }
  catch (error) { if (history.length) throw fault('CONTEXT_LIMIT'); throw error; }
  const body = JSON.stringify({ messages });
  if (new TextEncoder().encode(body).byteLength > LIMITS.bodyBytes) throw fault('BODY_TOO_LARGE');
  return { messages, body };
}
export class ChatSession {
  constructor({ origin, loadKey, fetcher = globalThis.fetch.bind(globalThis), signer = signChat, clock = clockDefault, onChange = () => {} }) {
    this.origin = origin; this.loadKey = loadKey; this.fetcher = fetcher; this.signer = signer; this.clock = clock; this.onChange = onChange;
    this.history = []; this.active = null;
    this.state = { busy: false, status: 'idle', code: null, validationReason: null, providerOutcome: 'not_dispatched', messages: [], contextCount: 0, displayDropped: 0, elapsedMs: null };
  }
  snapshot() { return structuredClone(this.state); }
  emit() { this.onChange(this.snapshot()); }
  cleanup(tx) {
    this.clock.clear(tx.timer);
    for (const fn of tx.cleanup.splice(0)) { try { fn(); } catch {} }
  }
  finish(tx, error, status = 'complete') {
    if (this.active !== tx) return;
    tx.closed = true; this.active = null; this.cleanup(tx);
    this.state.busy = false; this.state.status = error ? 'error' : status;
    this.state.elapsedMs = tx.entry ? Math.max(0, Math.round(this.clock.now() - tx.started)) : null;
    this.state.code = error ? safeCode(error) : null;
    this.state.validationReason = this.state.code === 'INVALID_MODEL_RESPONSE' && isValidationReason(error?.validationReason) ? error.validationReason : null;
    this.state.providerOutcome = error ? (error.outcome || (tx.sent && tx.entry ? 'unknown_or_completed' : 'not_dispatched')) : 'completed';
    if (tx.entry) tx.entry.delivery = error ? 'not_completed' : 'completed';
    this.state.contextCount = this.history.length; this.emit();
  }
  stop(code = 'STOPPED_LOCALLY') {
    const tx = this.active; if (!tx) return;
    const error = fault(code); tx.reason = error;
    this.finish(tx, error); tx.controller.abort(); tx.reject(error);
  }
  clear(code = null) {
    // Clearing/forgetting cannot turn an already-sent request into "not dispatched".
    const uncertain = Boolean(this.active?.sent && this.active?.entry) || this.state.providerOutcome === 'unknown_or_completed';
    this.stop(); this.history = [];
    this.state = { busy: false, status: code ? 'error' : 'idle', code, validationReason: null,
      providerOutcome: uncertain ? 'unknown_or_completed' : 'not_dispatched', messages: [], contextCount: 0, displayDropped: 0, elapsedMs: null };
    this.emit();
  }
  trimDisplay() {
    if (this.state.messages.length > 24) {
      this.state.displayDropped += this.state.messages.length - 24;
      this.state.messages.splice(0, this.state.messages.length - 24);
    }
  }
  async run(operation, entry = null) {
    if (this.active) return { ok: false, code: 'BUSY' };
    const started = this.clock.now();
    const tx = { started, controller: new AbortController(), closed: false, sent: false, cleanup: [], entry,
      end: started + 20_000 };
    const guard = new Promise((_, reject) => { tx.reject = reject; });
    tx.check = () => {
      if (this.active !== tx || tx.closed) throw tx.reason || fault('STOPPED_LOCALLY');
      if (this.clock.now() >= tx.end) throw fault('DEADLINE_EXCEEDED');
    };
    this.active = tx;
    tx.timer = this.clock.set(() => { if (this.active === tx) this.stop('DEADLINE_EXCEEDED'); }, 20_000);
    this.state.busy = true; this.state.status = 'working'; this.state.code = null; this.state.validationReason = null;
    this.state.providerOutcome = 'not_dispatched'; this.state.elapsedMs = null; this.emit();
    try {
      const result = await Promise.race([guard, Promise.resolve().then(async () => { tx.check(); return operation(tx); })]);
      tx.check(); this.finish(tx, null, result?.status || 'complete'); return { ok: true };
    } catch (error) {
      this.finish(tx, error); tx.controller.abort(); return { ok: false, code: safeCode(error) };
    } finally { this.cleanup(tx); }
  }
  async prepare(tx, body, path) {
    if (new URL(this.origin).origin !== this.origin || !this.origin.startsWith('https://')) throw fault('INVALID_TARGET');
    const record = await this.loadKey(); tx.check();
    if (!record) throw fault('KEY_REQUIRED');
    const options = await this.signer(record, this.origin, body, { path }); tx.check();
    return options;
  }
  async request(tx, path, options) {
    tx.check(); tx.sent = true;
    let response;
    try {
      response = await this.fetcher(this.origin + path, { ...options, signal: tx.controller.signal,
        credentials: 'omit', redirect: 'error', cache: 'no-store', mode: 'same-origin', referrerPolicy: 'no-referrer' });
    } catch { tx.check(); throw fault('NETWORK_UNCERTAIN'); }
    // Register cleanup before the elapsed-deadline check too. An ignored abort
    // or throttled timer must not leave a late response stream unconsumed.
    const cancel = () => response.body?.cancel().catch(() => {});
    if (this.active !== tx || tx.closed) { cancel(); tx.check(); }
    tx.cleanup.push(cancel); tx.check();
    if (response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json'
        || !response.body) throw fault('INVALID_SERVER_RESPONSE');
    const length = response.headers.get('content-length');
    if (length !== null && (!/^\d+$/.test(length) || Number(length) > 65536)) throw fault('INVALID_SERVER_RESPONSE');
    const reader = response.body.getReader(); tx.cleanup.push(() => reader.cancel().catch(() => {}));
    let bytes = 0, text = ''; const decoder = new TextDecoder('utf-8', { fatal: true });
    try {
      while (true) {
        const { done, value } = await reader.read(); tx.check(); if (done) break;
        bytes += value.byteLength; if (bytes > 65536) throw fault('INVALID_SERVER_RESPONSE');
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
      return { status: response.status, data: JSON.parse(text) };
    } catch (error) {
      tx.check(); throw fault(SAFE.has(error.code) ? error.code : 'INVALID_SERVER_RESPONSE');
    } finally { reader.cancel().catch(() => {}); reader.releaseLock(); }
  }
  serverError(result) {
    if (result.status >= 200 && result.status < 300) return;
    const error = result.data?.error;
    if (!error || !SAFE.has(error.code) || error.automaticRetry !== false
        || !['not_dispatched', 'unknown_or_completed'].includes(error.providerOutcome)) throw fault('INVALID_SERVER_RESPONSE');
    const reason = error.validationReason;
    if (reason !== undefined && (error.code !== 'INVALID_MODEL_RESPONSE' || result.status !== 502
        || error.providerOutcome !== 'unknown_or_completed' || !isValidationReason(reason))) throw fault('INVALID_SERVER_RESPONSE');
    throw Object.assign(fault(error.code, error.providerOutcome), reason === undefined ? {} : { validationReason: reason });
  }
  async send(text, consented = false) {
    if (this.active) return { ok: false, code: 'BUSY' };
    let prepared;
    try {
      if (!consented) throw fault('CONSENT_REQUIRED');
      if (typeof text !== 'string' || !text.trim() || text.length > LIMITS.contentChars) throw fault('INVALID_MESSAGES');
      prepared = context(this.history, text);
    } catch (error) {
      this.state.status = 'error'; this.state.code = safeCode(error); this.state.validationReason = null; this.state.providerOutcome = 'not_dispatched'; this.state.elapsedMs = null; this.emit();
      return { ok: false, code: safeCode(error) };
    }
    const entry = { role: 'user', content: text, delivery: 'pending' };
    this.state.messages.push(entry);
    this.trimDisplay();
    return this.run(async tx => {
      const options = await this.prepare(tx, prepared.body, CHAT_PATH);
      const result = await this.request(tx, CHAT_PATH, options); tx.check(); this.serverError(result);
      const data = result.data;
      if (result.status !== 200 || data?.kind !== 'model-response' || data.model !== MODEL
          || data.keyId !== options.headers['X-Maya-Key-Id'] || data.nonce !== options.headers['X-Maya-Nonce']
          || typeof data.text !== 'string' || !data.text.trim() || data.text.length > LIMITS.outputChars
          || data.capabilities?.text !== true || ['tools', 'vision', 'voice'].some(k => data.capabilities?.[k] !== false)) throw fault('INVALID_SERVER_RESPONSE');
      this.history = [...prepared.messages, { role: 'assistant', content: data.text }];
      this.state.messages.push({ role: 'assistant', content: data.text, delivery: 'completed' });
      this.trimDisplay();
      return { status: 'reply' };
    }, entry);
  }
  async checkReplay() {
    // Explicit diagnostic: deliberately send one identical EMPTY request twice.
    // Never repeats a chat body; this endpoint has no inference path or quota reservation.
    return this.run(async tx => {
      const options = await this.prepare(tx, '{}', CHECK_PATH);
      const first = await this.request(tx, CHECK_PATH, options); tx.check(); this.serverError(first);
      if (first.status !== 200 || first.data?.kind !== 'chat-auth-verified' || first.data.aiConnected !== false
          || first.data.keyId !== options.headers['X-Maya-Key-Id'] || first.data.nonce !== options.headers['X-Maya-Nonce']) throw fault('INVALID_SERVER_RESPONSE');
      const second = await this.request(tx, CHECK_PATH, options); tx.check();
      if (second.status !== 409 || second.data?.error?.code !== 'REPLAY_OR_WINDOW_FULL'
          || second.data.error.automaticRetry !== false || second.data.error.providerOutcome !== 'not_dispatched') throw fault('REPLAY_CHECK_FAILED');
      return { status: 'replay_checked' };
    });
  }
}
