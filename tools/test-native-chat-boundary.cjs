'use strict';
const fs = require('node:fs'), assert = require('node:assert/strict');
const read = p => fs.readFileSync(p, 'utf8');
const a = read('app/src/main/java/com/maya/ai/chat/NativeChatActivity.kt');
assert(!/WebView\(|JavascriptInterface|intent\.(data|extras)|getStringExtra|startService\(|requestPermissions\(|loadUrl\(/.test(a));
assert(!/MayaBridge|TextToSpeech|SpeechRecognizer|performAction|enqueue\(/.test(a));
assert(a.includes('SynchronousQueue()')); assert(a.includes('session.clear()')); assert(a.includes('consent.isChecked = false'));
assert(a.includes('send.isEnabled = !busy && consent.isChecked'));
assert(!a.includes('send.isEnabled = !busy && publicText')); assert(a.includes('isSaveEnabled = false'));
const create = a.slice(a.indexOf('override fun onCreate'), a.indexOf('private fun confirm'));
assert(!create.includes('identity.publicJwk()')); // no startup identity inspection
const m = read('app/src/main/java/com/maya/ai/MainActivity.kt');
assert(m.includes('request.isForMainFrame && request.hasGesture()'));
assert(m.includes('webView.url in listOf('));
assert.equal(read('public/index.html'), read('app/src/main/assets/web/index.html'));
assert.equal(JSON.parse(read('release/version.json')).versionCode, 93);
assert(read('app/build.gradle').includes("implementation 'com.squareup.okhttp3:okhttp:4.12.0'"));
console.log('Native static integration boundaries PASS (not a device/UI execution test).');

assert(a.includes('check.isEnabled = !busy'));
assert(!a.includes('check.isEnabled = !busy && publicText'));
assert(a.includes('Copy check report')); assert(a.includes('NativeAccessDiagnostic.State.LEFT_SCREEN'));
assert(a.includes('FLAG_WINDOW_IS_OBSCURED')); assert(a.includes('FLAG_WINDOW_IS_PARTIALLY_OBSCURED'));
assert(a.includes('if (obscured)')); assert(a.includes('return true // Keep protection'));
assert(a.indexOf('check = button(') < a.indexOf('create = button('));
assert(!a.includes('putString("last_check", status.text')); // no free text is persisted

assert(a.includes('if (kind == "chat" || kind == "readiness") inspectReadiness(job)'));
assert(a.includes('else if (reason == Reason.READY) launch(true)'));
assert(a.includes('No model request was sent.'));
assert(a.includes('Copy readiness report'));
assert(a.includes('getString("reason", null)'));
assert(a.includes('putString("reason", reason.name)'));
assert(!m.includes('!settings.convoMode'));

assert(a.includes('listOf("Chat", "Checks", "Info")'));
assert(a.includes('showPage(0); setContentView(shell)'));
assert(a.includes('shell.addView(stop, LinearLayout.LayoutParams(-1, -2))'));
assert(a.includes('{ endLocalSession(); finish() }'));
assert(a.includes('endLocalSession(); handler.removeCallbacksAndMessages(null)'));

assert(a.includes('confirmSpeech(message.content)'));
assert(a.includes('session.messages().any { it === message }'));
assert(a.includes('strictNetwork = true'));
assert(a.includes('speech.stop()'));
assert(a.includes('fishCheck = button("Check saved Fish setup · no network")'));
assert(!a.includes('identity.sign(text)'));
