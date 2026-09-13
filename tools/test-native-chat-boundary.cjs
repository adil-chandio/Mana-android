'use strict';
const fs = require('node:fs'), assert = require('node:assert/strict');
const read = p => fs.readFileSync(p, 'utf8');
const a = read('app/src/main/java/com/maya/ai/chat/NativeChatActivity.kt');
assert(!/WebView\(|JavascriptInterface|intent\.(data|extras)|getStringExtra|startService\(|requestPermissions\(|loadUrl\(/.test(a));
assert(!/MayaBridge|TextToSpeech|SpeechRecognizer|performAction|enqueue\(/.test(a));
assert(a.includes('SynchronousQueue()')); assert(a.includes('session.clear()')); assert(a.includes('consent.isChecked = false'));
assert(a.includes('publicText != null && consent.isChecked')); assert(a.includes('isSaveEnabled = false'));
const create = a.slice(a.indexOf('override fun onCreate'), a.indexOf('private fun confirm'));
assert(!create.includes('identity.publicJwk()')); // no startup identity inspection
const m = read('app/src/main/java/com/maya/ai/MainActivity.kt');
assert(m.includes('request.isForMainFrame && request.hasGesture()'));
assert(m.includes('webView.url !in listOf('));
assert.equal(read('public/index.html'), read('app/src/main/assets/web/index.html'));
assert.equal(JSON.parse(read('release/version.json')).versionCode, 89);
assert(read('app/build.gradle').includes("implementation 'com.squareup.okhttp3:okhttp:4.12.0'"));
console.log('Native static integration boundaries PASS (not a device/UI execution test).');

assert(a.includes('check.isEnabled = !busy'));
assert(!a.includes('check.isEnabled = !busy && publicText'));
assert(a.includes('Copy check report')); assert(a.includes('NativeAccessDiagnostic.State.LEFT_SCREEN'));
assert(a.includes('FLAG_WINDOW_IS_OBSCURED')); assert(a.includes('FLAG_WINDOW_IS_PARTIALLY_OBSCURED'));
assert(a.includes('if (obscured)')); assert(a.includes('return true // Keep protection'));
assert(a.indexOf('check = button(') < a.indexOf('create = button('));
assert(!a.includes('putString("last_check", status.text')); // no free text is persisted
