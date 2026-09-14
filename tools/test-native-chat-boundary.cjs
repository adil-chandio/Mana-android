'use strict';
const fs = require('node:fs'), assert = require('node:assert/strict');
const read = p => fs.readFileSync(p, 'utf8');
const a = read('app/src/main/java/com/maya/ai/chat/NativeChatWorkspace.kt');
assert(!/WebView\(|JavascriptInterface|intent\.(data|extras)|getStringExtra|startService\(|requestPermissions\(|loadUrl\(/.test(a));
assert(!/MayaBridge|TextToSpeech|SpeechRecognizer|performAction|enqueue\(/.test(a));
assert(a.includes('SynchronousQueue()')); assert(a.includes('session.clear()')); assert(a.includes('consent.isChecked = false'));
assert(a.includes('send.isEnabled = !busy && section==0 && (agentSelected || consent.isChecked)'));
assert(!a.includes('send.isEnabled = !busy && publicText')); assert(a.includes('isSaveEnabled = false'));
const create = a.slice(a.indexOf('fun createView'), a.indexOf('private fun confirm'));
assert(!create.includes('identity.publicJwk()')); // no startup identity inspection
const m = read('app/src/main/java/com/maya/ai/MainActivity.kt');
assert(m.includes('request.isForMainFrame && request.hasGesture()'));
assert(m.includes('webView.url in listOf('));
assert.equal(read('public/index.html'), read('app/src/main/assets/web/index.html'));
assert.equal(JSON.parse(read('release/version.json')).versionCode, 103);
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

assert(a.includes('listOf("Close details", "Checks ▾", "Privacy ▾")'));
assert(a.includes('navigateSettings(0)')); assert(a.includes('tag="settings_screen"'));  assert(a.includes('return surface'));
assert(a.includes('addView(stop,FrameLayout.LayoutParams(dp(48),dp(48),android.view.Gravity.BOTTOM or android.view.Gravity.RIGHT)'));
assert(a.includes('{ endLocalSession(); close() }'));
assert(a.includes('endLocalSession(); handler.removeCallbacksAndMessages(null)'));

assert(a.includes('confirmSpeech(message.content)'));
assert(a.includes('session.messages().any { it === message }'));
assert(a.includes('strictNetwork = true'));
assert(a.includes('speech.stop()'));
assert(a.includes('fishCheck = button("Check saved Fish setup · no network")'));
assert(!a.includes('identity.sign(text)'));

assert(a.includes('addView(composer,FrameLayout.LayoutParams(-1,-2,android.view.Gravity.BOTTOM)'));

assert(a.includes('session.review(draft.text.toString())'));
assert(a.includes('timeline.count {it is ChatAttempt}>=6'));
assert(a.includes('No reply accepted.'));
const diff=read('app/src/main/java/com/maya/ai/agent/BuilderDiff.kt');
assert(!/WebView|Runtime|ProcessBuilder|Http|fetch|FileOutputStream/.test(diff));
assert(read('app/src/main/java/com/maya/ai/agent/InlineBuildTurn.kt').includes('BuilderDiff.render(code,reply)'));

const dictation=read('app/src/main/java/com/maya/ai/chat/NativeDictation.kt');
const inputPort=read('app/src/main/java/com/maya/ai/chat/AndroidDictationPort.kt');
assert(dictation.includes('schedule(1500)')); assert(dictation.includes('schedule(20000)'));
assert(dictation.includes('NativeChatProtocol.validateDraft(text)'));
assert(!/session\.begin|identity\.|fetch\(|HttpURLConnection|FileOutputStream|MayaBridge/.test(dictation));
assert(!/createExplicitly|makeRecognizer|startActivity\(|startService\(|FileOutputStream|fishStreamSpeak/.test(inputPort));
assert(inputPort.includes('createOnDeviceSpeechRecognizer(activity)'));
assert(inputPort.includes('createSpeechRecognizer(activity)'));
assert(inputPort.includes('if(main!=null && !permission()) ActivityCompat.requestPermissions'));
assert(!m.includes('requestNeededPermissions()'));
assert(a.includes('dictation.transcript==text && draft.text.toString()==before'));

// Recovery is explicit, fixed-reason, and cannot become provider consent or a download ladder.
assert(inputPort.includes('fun serviceFailure(onDeviceOnly: Boolean)'));
assert(!inputPort.includes('triggerModelDownload'));
assert(inputPort.includes('ERROR_LANGUAGE_NOT_SUPPORTED -> NativeDictation.State.LANGUAGE_UNSUPPORTED'));
assert(inputPort.includes('ERROR_LANGUAGE_UNAVAILABLE -> NativeDictation.State.LANGUAGE_UNAVAILABLE'));
assert(a.includes('Choose voice options')); assert(a.includes('isChecked=true'));
assert(a.includes('tag="recognition_availability"'));
assert(a.includes('Retry local interface')); assert(a.includes('confirmHostRetry()'));
assert(m.includes('hostHandler.postDelayed(it,8000)'));
assert(m.includes('mountTicket==hostMountEpoch && !answered'));
assert(m.includes('presentationTicket==hostPresentationEpoch && !answered'));
assert(m.includes('hostFallbackUsed=true;beginWorkspaceHostLoad()'));
assert(m.includes('if(hostFailed) {view.stopLoading()'));
assert(!m.slice(m.indexOf('inner class MayaBridge')).includes('retryWorkspaceHost'));
console.log('Voice and bundled-host recovery boundaries PASS (no live device/service proof).');
