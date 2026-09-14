'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const read=n=>fs.readFileSync('app/src/main/java/com/maya/ai/agent/'+n+'.kt','utf8');
const ui=read('ResearchActivity'), backend=read('ResearchBackend'), http=read('ResearchHttp'), plan=read('ResearchPlan');
for(const s of [ui,backend,http,plan,read('ResearchRunner')]) {
  assert(!/JavascriptInterface|evaluateJavascript|AutoSendService|performGlobalAction|tapAt|typeInto|MediaProjection|AccessibilityService|requestPermissions|startService|createExplicitly|fishStreamSpeak|SharedPreferences.*edit\(/.test(s));
}
assert(backend.includes('MayaAct.hasPendingActions()')); // read-only readiness, never execution
assert(backend.includes('NativeChatIdentity().sign('));assert(backend.includes('NativeChatTransport().execute('));
assert(backend.includes('SynchronousQueue()'));assert(backend.includes('handler.postDelayed(timeout,20000)'));
assert(plan.includes('https://en.wikipedia.org/api/rest_v1/page/summary/'));assert(plan.includes('https://api.github.com/repos/'));
assert(http.includes('.followRedirects(false)'));assert(http.includes('CookieJar.NO_COOKIES'));assert(http.includes('Authenticator.NONE'));
assert(!http.includes('header("Authorization"'));assert(!http.includes('NativeChatIdentity'));
assert(http.includes('depth<=12'));assert(http.includes('output.size()+n<=65536'));
assert(ui.includes('Sharing') || ui.includes('sharing excerpts requires its own consent'));
assert(ui.includes('generation!=epoch'));assert(ui.includes('source.url'));assert(ui.includes('info.packageName!=target.packageName'));
assert(!/getStringExtra|intent\.(extras|data)|Intent\.parseUri|ACTION_SEND|ACTION_INSTALL_PACKAGE/.test(ui));
assert(ui.includes('onStop() {clear()'));assert(ui.includes('No AI call happens on open'));
const manifest=fs.readFileSync('app/src/main/AndroidManifest.xml','utf8');assert(manifest.includes('.agent.ResearchActivity'));
console.log('Research integration boundaries PASS (static checks; not live network or phone evidence).');
