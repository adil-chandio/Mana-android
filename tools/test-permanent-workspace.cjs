'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('public/index.html','utf8');
const script=html.match(/\/\* PERMANENT_WORKSPACE_START[\s\S]*?\*\/([\s\S]*?)\/\* PERMANENT_WORKSPACE_END \*\//)[1];
const make=()=>new JSDOM(html,{runScripts:'outside-only',url:'https://appassets.androidplatform.net/assets/web/index.html'});
const d=make(),w=d.window;w.scrollTo=()=>{};w.eval(script);
assert.equal(w.__mayaWorkspaceMount(),false);assert(!w.document.documentElement.classList.contains('maya-workspace-host'));
w.MayaBridge={};const orb=w.document.getElementById('orb');let legacyVoice=0;
orb.addEventListener('click',()=>legacyVoice++);
const fields=[...w.document.querySelectorAll('input,select')].map(el=>[el,el.value]);
assert.equal(w.__mayaWorkspaceMount(),true);assert.equal(w.__mayaWorkspaceMount(),true);
assert.equal(w.document.getElementById('qStop').parentNode.id,'tab-set');
assert.equal(w.document.querySelectorAll('.workspace-orb-link').length,1);assert.equal(w.document.querySelector('.workspace-orb-link').firstElementChild,orb);
assert.equal(w.document.querySelector('.workspace-orb-link').getAttribute('href'),'maya-private-chat://open');
const e=new w.MouseEvent('click',{bubbles:true,cancelable:true});orb.dispatchEvent(e);
assert.equal(legacyVoice,0);assert(e.defaultPrevented); // synthetic event cannot navigate or trigger hidden legacy AI
assert.equal(w.__mayaWorkspaceSettings(true),true);assert(w.document.documentElement.classList.contains('maya-settings-expanded'));
assert.equal(w.getComputedStyle(w.document.getElementById('tab-home')).display,'none');
// Exercise the real theme function, including the old bug: className replacement used to erase host flags.
w.settings={theme:'day',accent:'#abc123',radius:18,fontScale:1,edgeGlow:false};w.THEMES={day:{},obsidian:{}};
w.accent2Of=c=>c;w.$=s=>w.document.querySelector(s);
w.eval(html.slice(html.indexOf('function applyTheme(){'),html.indexOf('function renderThemeUI(){')));
for(const theme of ['day','obsidian','day']) {
  w.settings.theme=theme;w.applyTheme();
  assert(w.document.documentElement.classList.contains('maya-workspace-host'));
  assert(w.document.documentElement.classList.contains('maya-settings-expanded'));
  assert.equal(w.getComputedStyle(w.document.querySelector('nav')).display,'none');
  assert.equal(w.getComputedStyle(w.document.querySelector('header')).display,'none');
  assert.equal(w.getComputedStyle(w.document.getElementById('tab-home')).display,'none');
}
assert.equal(w.__mayaWorkspaceMount(),true);assert.equal(w.document.querySelectorAll('.workspace-orb-link').length,1);
w.__mayaWorkspaceSettings(false);assert(!w.document.documentElement.classList.contains('maya-settings-expanded'));
for(const [el,value] of fields) assert.equal(el.value,value); // mount/settings presentation never rewrites voice/provider settings
assert.equal(w.getComputedStyle(w.document.querySelector('header')).display,'none');
assert.equal(w.getComputedStyle(w.document.querySelector('nav')).display,'none');
assert.equal(w.getComputedStyle(w.document.querySelector('.homebar')).display,'none');
assert.equal(w.getComputedStyle(w.document.querySelector('#tab-chat')).display,'none');
assert.equal(w.getComputedStyle(w.document.querySelector('#tab-home')).display,'block');
assert(!/localStorage|fetch\(|http\(|MayaBridge\.|evaluateJavascript|innerHTML|\.value\s*=/.test(script));
assert.equal(w.getComputedStyle(w.document.body).backgroundColor,'rgb(22, 23, 25)');
w.document.documentElement.classList.add('t-day');
assert.equal(w.getComputedStyle(w.document.getElementById('app')).color,'rgb(238, 234, 228)');
assert.equal(w.getComputedStyle(w.document.querySelector('#tab-set .ui-group')).backgroundColor,'rgb(33, 34, 37)');
w.document.documentElement.classList.remove('t-day');
const early=make();early.window.MayaBridge={};early.window.scrollTo=()=>{};
early.window.eval(html.match(/<script>\/\* NATIVE_HOST_BOOT[\s\S]*?<\/script>/)[0].replace(/<\/?script>/g,''));
assert.equal(early.window.getComputedStyle(early.window.document.querySelector('nav')).display,'none');
early.window.eval(script);assert.equal(early.window.__mayaWorkspaceMount(),true);assert.equal(early.window.document.querySelectorAll('.workspace-orb-link').length,1);
// JSDOM has no layout/media-query renderer. Verify compact host rules exist without claiming pixels.
assert(html.includes('@media(max-height:90px)'));
assert(html.includes('html.maya-workspace-host:not(.maya-settings-expanded) #orb{width:56px;height:56px}'));
assert(html.includes('@media(prefers-reduced-motion:reduce)'));
const main=fs.readFileSync('app/src/main/java/com/maya/ai/MainActivity.kt','utf8');
const create=main.slice(main.indexOf('override fun onCreate('),main.indexOf('override fun onActivityResult('));
assert(create.includes('workspace.createView(webView)'));assert(create.includes('nativeChat = workspace'));
const focus=main.slice(main.indexOf('private fun openMainChat()'),main.indexOf('override fun onResume()'));
assert(!/createView|addView|removeView|visibility|startActivity|loadUrl/.test(focus));assert(focus.includes('focusComposer()'));
const builder=fs.readFileSync('app/src/main/java/com/maya/ai/agent/InlineBuildTurn.kt','utf8');
for(const text of ['javaScriptEnabled=false','blockNetworkLoads=true','allowFileAccess=false','allowContentAccess=false','domStorageEnabled=false',"default-src 'none'","form-action 'none'",'request.deny()','handler.postDelayed(it,20000)','epoch!=ticket','services.text(prompt)']) assert(builder.includes(text),text);
assert(!/addJavascriptInterface|startActivity|createExplicitly|Runtime\.getRuntime|ProcessBuilder|FileOutputStream|ACTION_VIEW|evaluateJavascript/.test(builder));
console.log('Permanent workspace PASS: startup ownership, idempotent original-orb mounting, no duplicate chat/legacy dispatch/settings writes; isolated static Builder boundaries. Not device or live-provider proof.');
