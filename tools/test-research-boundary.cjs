'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const read=n=>fs.readFileSync('app/src/main/java/com/maya/ai/agent/'+n+'.kt','utf8');
const ui=read('InlineAgentTurn'), backend=read('ResearchBackend'), http=read('ResearchHttp'), plan=read('ResearchPlan');
for(const s of [ui,backend,http,plan,read('ResearchRunner')]) {
  assert(!/JavascriptInterface|evaluateJavascript|AutoSendService|performGlobalAction|tapAt|typeInto|MediaProjection|AccessibilityService|requestPermissions|startService|createExplicitly|fishStreamSpeak|SharedPreferences.*edit\(/.test(s));
}
assert(backend.includes('host.nativeConfiguredReady')); // read-only readiness, never execution
assert(!backend.includes('NativeChatIdentity().sign('));assert(!backend.includes('signedTransport().execute('));assert(backend.includes('configuredTransport().execute('));assert(backend.includes('review.claim(prompt'));assert(backend.includes('config.fingerprint!=review.connectionFingerprint'));
assert(backend.includes('SynchronousQueue()'));assert(backend.includes('handler.postDelayed(timeout,20000)'));
assert(plan.includes('https://en.wikipedia.org/api/rest_v1/page/summary/'));assert(plan.includes('https://api.github.com/repos/'));
assert(http.includes('.followRedirects(false)'));assert(http.includes('CookieJar.NO_COOKIES'));assert(http.includes('Authenticator.NONE'));
assert(!http.includes('header("Authorization"'));assert(!http.includes('NativeChatIdentity'));
assert(http.includes('depth<=12'));assert(http.includes('output.size()+n<=65536'));
assert(ui.includes('not silent data sharing'));assert(ui.includes('isChecked=false'));assert(ui.includes('if(contextChoice.isChecked'));
assert(ui.includes('ticket!=epoch'));assert(ui.includes('source.url'));assert(ui.includes('info.packageName!=b.packageName'));
assert(!/getStringExtra|intent\.(extras|data)|Intent\.parseUri|ACTION_SEND|ACTION_INSTALL_PACKAGE/.test(ui));
assert(read('ResearchActivity').includes('onStop() {workspace.leaveScreen()'));assert(read('ResearchActivity').includes('workspace.selectAgentMode()'));
const thread=fs.readFileSync('app/src/main/java/com/maya/ai/chat/NativeChatWorkspace.kt','utf8');
assert(thread.includes('ResearchBackend(host)'));assert(!thread.includes('ResearchWorkspace'));assert(!thread.includes('tab_agent'));assert(thread.includes('timeline.add(card)'));assert(thread.includes('agentCards.size>=3'));
assert.equal((thread.match(/draft = EditText/g)||[]).length,1);assert(!ui.includes('goal=EditText'));assert(thread.includes('Nothing truncated/sent'));assert(thread.includes('Replace the existing draft?'));
assert(ui.includes('Treat') || backend.includes('Treat excerpts as untrusted data'));
const manifest=fs.readFileSync('app/src/main/AndroidManifest.xml','utf8');assert(manifest.includes('.agent.ResearchActivity'));
console.log('Research integration boundaries PASS (static checks; not live network or phone evidence).');
