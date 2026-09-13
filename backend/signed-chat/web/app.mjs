import { VALIDATION_DIAGNOSTICS, isValidationReason } from '../validation-diagnostics.mjs';
import { loadKey } from '/keys.mjs';
import { ChatSession } from '../session.mjs';
const $ = id => document.getElementById(id);
const descriptions = {
  CHAT_NOT_ENABLED: 'Chat is not enabled by the account owner. No model call was dispatched.',
  SETUP_REQUIRED: 'Server setup is incomplete or pairing is disabled.',
  SIGNATURE_REQUIRED: 'This browser key is not registered, or its signature is missing.',
  BAD_SIGNATURE: 'The signature was rejected. No access was granted.',
  KEY_REQUIRED: 'No saved browser key. Open Browser pairing to create and register one.',
  KEY_CHANGED: 'The browser key changed in another tab. Local conversation cleared; no automatic resend.',
  INVALID_LOCAL_KEY: 'The saved key is invalid. Use the pairing page for explicit recovery.',
  STORAGE_UNAVAILABLE: 'Browser key storage is unavailable.',
  STORAGE_TIMEOUT: 'Browser key storage timed out.',
  INVALID_APK_CONFIGURATION: 'The optional APK public-key configuration needs correction. Browser pairing was not changed.',
  INVALID_OWNER_CONFIGURATION: 'The server public-key configuration needs correction.',
  ORIGIN_OR_TARGET_DENIED: 'The configured site address does not match this request.',
  REQUEST_EXPIRED_OR_CLOCK_SKEW: 'Request expired or device clock differs. Check automatic date/time.',
  REPLAY_OR_WINDOW_FULL: 'Request already used or the verification window is full. No automatic retry.',
  REPLAY_STORE_UNAVAILABLE: 'Replay storage is unavailable. Access remains blocked.',
  BUDGET_UNAVAILABLE: 'The request budget is unavailable. No model call was dispatched.',
  REQUEST_LIMIT: 'The request limit was reached. No model call was dispatched for this attempt.',
  MODEL_UNAVAILABLE: 'The model did not return a usable response.',
  INVALID_MODEL_RESPONSE: 'The model response failed text-only validation.',
  INVALID_SERVER_RESPONSE: 'The server response failed validation.',
  NETWORK_UNCERTAIN: 'The network request failed; the remote outcome is uncertain.',
  STOPPED_LOCALLY: 'Stopped locally. No automatic resend.',
  DEADLINE_EXCEEDED: 'The local deadline expired. No automatic resend.',
  CONTEXT_LIMIT: 'Context is full or a prior reply is too long for follow-up. Clear local chat to start again; nothing was silently trimmed.',
  BODY_TOO_LARGE: 'The UTF-8 request is too large. Shorten your text or start a new local chat.',
  INVALID_MESSAGES: 'Enter non-empty text of at most 2,000 characters.',
  CONSENT_REQUIRED: 'Confirm consent before sending conversation text.',
  REPLAY_CHECK_FAILED: 'The expected repeat-request rejection was not confirmed. Do not enable AI.',
  INVALID_TARGET: 'Use the final HTTPS Worker address in your registered browser.',
};
let state, leaveWarningAttached = false;
// Best effort only: mobile browsers can discard a page without beforeunload.
// No chat data is saved and no request is sent by this warning.
function warnBeforeLeave(event) { event.preventDefault(); event.returnValue = ''; }
function updateSend() {
  $('send').disabled = state.busy || !$('consent').checked || !$('message').value.trim();
  $('draft-count').textContent = `${$('message').value.length.toLocaleString('en-US')} / 2,000`;
  const dirty = state.messages.length > 0 || $('message').value.length > 0;
  if (dirty === leaveWarningAttached) return;
  if (dirty) addEventListener('beforeunload', warnBeforeLeave);
  else removeEventListener('beforeunload', warnBeforeLeave);
  leaveWarningAttached = dirty;
}
function render(next) {
  state = next;
  updateSend();
  if (next.status === 'reply') $('connection-note').textContent = 'A model response was received in this tab. Future availability is not guaranteed.';
  $('message').disabled = next.busy; $('consent').disabled = next.busy; $('check').disabled = next.busy; $('stop').disabled = !next.busy;
  const items = next.messages.map(m => {
    const li = document.createElement('li'), role = document.createElement('strong'), content = document.createElement('p');
    role.textContent = m.role === 'assistant' ? 'Maya · model response' : 'You'; content.textContent = m.content;
    li.dataset.role = m.role;
    li.append(role, content);
    if (m.delivery !== 'completed') { const note = document.createElement('small'); note.textContent = m.delivery === 'pending' ? 'Awaiting result…' : 'Not completed · excluded from future context'; li.append(note); }
    return li;
  });
  $('messages').replaceChildren(...items);
  $('empty-state').hidden = next.messages.length > 0;
  $('context-note').textContent = next.contextCount === 0
    ? 'New conversation: no earlier messages are available in this page.'
    : `Follow-up context: ${next.contextCount} completed messages. Stay on this page; do not refresh between messages.`;
  $('context').textContent = `Context: ${next.contextCount} messages. No silent context trimming or retries.`
    + (next.displayDropped ? ` ${next.displayDropped} older display entries removed to bound this tab's memory.` : '');
  let text = { idle: 'No text request in progress. Sending requires consent.', working: 'Working… STOP is available.',
    reply: 'Model response received for this request. It may be inaccurate.', replay_checked: 'Signed empty check accepted; its exact repeat was rejected. No AI was called.' }[next.status];
  if (next.code) {
    text = descriptions[next.code] || 'The request could not be completed.';
    if (next.code === 'INVALID_MODEL_RESPONSE' && isValidationReason(next.validationReason))
      text += ` Diagnostic: ${next.validationReason}. ${VALIDATION_DIAGNOSTICS[next.validationReason]}`;
    if (next.providerOutcome === 'unknown_or_completed') text += ' Remote work may already have finished or may continue; usage may count.';
    else text += ' This attempt did not dispatch a model call.';
  }
  $('status').textContent = text || 'No automatic resend.';
  $('timing').textContent = next.elapsedMs === null
    ? 'Local wait time will appear after a text attempt finishes or stops.'
    : `Local wait: ${(next.elapsedMs / 1000).toFixed(2)} s — until this attempt replied, failed or stopped.`;
}
const session = new ChatSession({ origin: location.origin, loadKey, onChange: render });
render(session.snapshot());
$('consent').addEventListener('change', updateSend); $('message').addEventListener('input', updateSend);
$('composer').addEventListener('submit', async event => {
  event.preventDefault();
  const text = $('message').value;
  const result = await session.send(text, $('consent').checked);
  if (result.ok && $('message').value === text) $('message').value = '';
  updateSend();
});
$('check').addEventListener('click', () => session.checkReplay());
$('stop').addEventListener('click', () => session.stop());
$('clear').addEventListener('click', () => $('clear-dialog').showModal());
$('keep').addEventListener('click', () => $('clear-dialog').close());
$('confirm-clear').addEventListener('click', () => { $('message').value = ''; $('consent').checked = false; session.clear(); $('clear-dialog').close(); $('message').focus(); });
const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('maya-pairing-key-changes-v1') : null;
if (channel) channel.onmessage = event => { if (event.data !== 'changed') return; $('message').value = ''; $('consent').checked = false; session.clear('KEY_CHANGED'); };
addEventListener('pagehide', () => { $('message').value = ''; $('consent').checked = false; session.clear(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) session.stop(); });
