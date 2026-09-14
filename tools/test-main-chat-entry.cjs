'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('public/index.html','utf8');
const script=html.match(/\/\* MAIN_CHAT_ENTRY_START[\s\S]*?\*\/([\s\S]*?)\/\* MAIN_CHAT_ENTRY_END \*\//)[1];
const home=html.slice(html.indexOf('<section class="tab active" id="tab-home">'),html.indexOf('<!-- ============ CHAT'));
assert(home.indexOf('CHAT + AGENT')>=0 && home.indexOf('CHAT + AGENT')<home.indexOf('id="orb"'));
const {JSDOM}=require('jsdom');const document=new JSDOM(html).window.document;
assert.equal(document.querySelectorAll('a[data-main-chat]').length,5);
for(const a of document.querySelectorAll('[data-main-chat]')) assert.equal(a.getAttribute('href'),'maya-private-chat://open');
assert(document.querySelector('nav a[data-main-chat]'));assert(document.querySelector('#drawer a[data-main-chat]'));
function world(apk, nav, trusted, href='maya-private-chat://open') {
  let listener,prevent=0,stopped=0,removed=0,tabs=0;
  const hint={textContent:''},link={getAttribute:n=>n==='href'?href:n==='data-tab'&&nav?'tab-chat':null,addEventListener:(name,fn,capture)=>{assert.equal(name,'click');assert.equal(capture,true);listener=fn;}};
  const context={window:{},showTab:id=>{assert.equal(id,'tab-chat');tabs++},document:{querySelectorAll:selector=>{assert.equal(selector,'[data-main-chat]');return [link]},getElementById:id=>id.includes('Hint')?hint:{classList:{remove:()=>removed++}}}};
  if(apk) context.window.MayaBridge={};
  vm.runInNewContext(script,context);assert.equal(prevent+stopped+removed+tabs,0);
  listener({isTrusted:trusted,preventDefault:()=>prevent++,stopImmediatePropagation:()=>stopped++});
  return {prevent,stopped,removed,tabs,hint:hint.textContent};
}
assert.equal(world(true,false,true).prevent,0); // default anchor navigation, not JS location assignment
assert.equal(world(true,true,true).prevent,0);
assert.equal(world(true,true,false).prevent,1);
assert.equal(world(true,true,true,'https://evil.invalid').prevent,1);
assert.equal(world(false,true,true).tabs,1); // browser's existing Chat tab
const browser=world(false,false,true);assert.equal(browser.prevent,1);assert(browser.hint.includes('Android APK'));
assert(!/\.value|chatHist|localStorage|fetch\(|http\(|innerHTML|MayaBridge\.|location\s*\./.test(script));
const main=fs.readFileSync('app/src/main/java/com/maya/ai/MainActivity.kt','utf8');
assert(main.includes('request.isForMainFrame && request.hasGesture()'));
assert(main.includes('mainSurface.addView(surface'));
assert(main.includes('webView.visibility = android.view.View.GONE'));
assert(!main.includes('startActivity(Intent(this@MainActivity, com.maya.ai.chat.NativeChatActivity::class.java))'));
assert(main.includes('nativeChat?.leaveScreen()'));assert(main.includes('nativeChat?.dispose()'));
console.log('Main Chat entry PASS: 6 offline navigation cases + actual anchors/source/privacy checks; no device or live request.');
