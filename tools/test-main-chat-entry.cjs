'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('public/index.html','utf8');
const script=html.match(/\/\* MAIN_CHAT_ENTRY_START[\s\S]*?\*\/([\s\S]*?)\/\* MAIN_CHAT_ENTRY_END \*\//)[1];
assert(script.includes('window.location.href'));
const home=html.slice(html.indexOf('<section class="tab active" id="tab-home">'),html.indexOf('<!-- ============ CHAT'));
assert(home.indexOf('CHAT + AGENT')>=0 && home.indexOf('CHAT + AGENT')<home.indexOf('id="orb"'));
function world(apk, direct, trusted) {
  let listener, prevent=0, stopped=0, removed=0;
  const hint={textContent:''},link={hasAttribute:()=>direct,addEventListener:(name,fn,capture)=>{assert.equal(name,'click');assert.equal(capture,true);listener=fn;}};
  const context={window:{location:{href:''}},document:{querySelectorAll:selector=>{assert(selector.includes('[data-tab="tab-chat"]'));return [link]},getElementById:id=>id.includes('Hint')?hint:{classList:{remove:()=>removed++}}}};
  if(apk) context.window.MayaBridge={};
  vm.runInNewContext(script,context);assert.equal(context.window.location.href,''); // opening page never navigates
  listener({isTrusted:trusted,preventDefault:()=>prevent++,stopImmediatePropagation:()=>stopped++});
  return {href:context.window.location.href,prevent,stopped,removed,hint:hint.textContent};
}
assert.equal(world(true,true,true).href,'maya-private-chat://open');
assert.equal(world(true,false,true).href,'maya-private-chat://open');
assert.equal(world(true,true,false).href,'');
assert.equal(world(false,false,true).prevent,0); // browser's old Chat tab still works
const browser=world(false,true,true);assert.equal(browser.href,'');assert.equal(browser.prevent,1);assert(browser.hint.includes('Android APK'));
assert(!/\.value|chatHist|localStorage|fetch\(|http\(|innerHTML|MayaBridge\./.test(script));
const main=fs.readFileSync('app/src/main/java/com/maya/ai/MainActivity.kt','utf8');
assert(main.includes('request.isForMainFrame && request.hasGesture()'));
assert(main.includes('mainSurface.addView(surface'));
assert(main.includes('webView.visibility = android.view.View.GONE'));
assert(!main.includes('startActivity(Intent(this@MainActivity, com.maya.ai.chat.NativeChatActivity::class.java))'));
assert(main.includes('nativeChat?.stop()'));assert(main.includes('nativeChat?.dispose()'));
console.log('Main Chat entry PASS: 5 offline navigation cases + source/privacy boundaries; no device or live request.');
