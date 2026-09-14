export class Fault extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}
export const defaultClock = { now: () => Date.now(), set: (fn, ms) => setTimeout(fn, ms), clear: id => clearTimeout(id) };
export async function bounded(request, clock, operation) {
  const end = clock.now() + 8_000, cleanup = [];
  let closed = false, failure = new Fault(499, 'STOPPED_LOCALLY'), reject;
  const guard = new Promise((_, r) => { reject = r; });
  const stop = fault => { if (!closed) { closed = true; failure = fault; reject(fault); } };
  const abort = () => stop(new Fault(499, 'STOPPED_LOCALLY'));
  const timer = clock.set(() => stop(new Fault(504, 'DEADLINE_EXCEEDED')), 8_000);
  const scope = {
    check() { if (closed || request.signal.aborted) throw failure; if (clock.now() >= end) throw new Fault(504, 'DEADLINE_EXCEEDED'); },
    onClose(fn) { cleanup.push(fn); },
  };
  request.signal.addEventListener('abort', abort, { once: true });
  if (request.signal.aborted) abort();
  try { return await Promise.race([guard, Promise.resolve().then(() => { scope.check(); return operation(scope); })]); }
  finally {
    closed = true; clock.clear(timer); request.signal.removeEventListener('abort', abort);
    for (const fn of cleanup) { try { fn(); } catch { /* no content logging */ } }
  }
}
