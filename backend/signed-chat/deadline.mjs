import { Failure, LIMITS } from '../chat/protocol.mjs';
export const defaultClock = { now: () => Date.now(), set: (fn, ms) => setTimeout(fn, ms), clear: id => clearTimeout(id) };
export async function bounded(request, clock, operation) {
  const end = clock.now() + LIMITS.timeoutMs, cleanup = [];
  let closed = false, failure = new Failure(499, 'STOPPED_LOCALLY'), reject;
  const guard = new Promise((_, r) => { reject = r; });
  const stop = error => { if (!closed) { closed = true; failure = error; reject(error); } };
  const abort = () => stop(new Failure(499, 'STOPPED_LOCALLY'));
  const timer = clock.set(() => stop(new Failure(504, 'DEADLINE_EXCEEDED')), LIMITS.timeoutMs);
  const scope = {
    check() {
      if (closed || request.signal.aborted) throw failure;
      if (clock.now() >= end) throw new Failure(504, 'DEADLINE_EXCEEDED');
    },
    onClose(fn) { cleanup.push(fn); },
  };
  request.signal.addEventListener('abort', abort, { once: true });
  if (request.signal.aborted) abort();
  try { return await Promise.race([guard, Promise.resolve().then(() => { scope.check(); return operation(scope); })]); }
  finally {
    closed = true; clock.clear(timer); request.signal.removeEventListener('abort', abort);
    for (const fn of cleanup) { try { fn(); } catch { /* Never log user content. */ } }
  }
}
