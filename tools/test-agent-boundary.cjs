'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const files=['AgentActivity.kt','ApprovedPlanRunner.kt'].map(f=>fs.readFileSync('app/src/main/java/com/maya/ai/agent/'+f,'utf8'));
for(const s of files) {
  assert(!/MayaAct|AutoSendService|AccessibilityService|MediaProjection|WebView|JavascriptInterface|OkHttp|HttpURLConnection|NativeChatTransport|NativeChatIdentity|startService|requestPermissions|getStringExtra|intent\.(data|extras)|SharedPreferences/.test(s));
}
assert(files[0].includes('event.actionMasked == MotionEvent.ACTION_DOWN && engine.busy'));
assert(files[0].includes('epoch == generation && source == plan.text.toString() && initial == lab.text.toString()'));
assert(files[0].includes('foreground = false; clear()'));
assert(files[1].includes('require(target == TARGET)'));
assert(files[1].includes('grant.plan.digest != current.digest'));
assert(files[1].includes('run !== ticket'));
assert(files[1].includes('port.read() != ticket.expected'));
assert(files[1].includes('port.read() != value'));
assert(files[1].includes('time + 60000'));assert(files[1].includes('time + 30000'));
assert(fs.readFileSync('app/src/main/AndroidManifest.xml','utf8').includes('.agent.AgentActivity'));
console.log('Agent local-only source boundaries PASS; not external device execution evidence.');
