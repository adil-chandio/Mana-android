'use strict';
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const source = fs.readFileSync('app/src/main/java/com/maya/ai/chat/NativeChatReadiness.kt','utf8');
const script = source.match(/const val LOCAL_SCRIPT = """([\s\S]*?)"""/)[1];
let network = 0;
globalThis.fetch = () => { network++; throw Error('NETWORK_FORBIDDEN'); };
function context() { return { window: {__mayaJSOK:true}, settings:{wakeWord:false,autoListen:false,proactive:false,notifSpeak:false,convoMode:true},
  speaking:false,listening:false,thinking:false,TURNS:{active:null},INPUT_SESSION:{active:null} }; }
function run(c) { return vm.runInNewContext(script,c,{timeout:100}); }
let count=0; function test(label, fn) { fn(); count++; }
test('idle with conversation style ON does not block',()=>assert.equal(run(context()),'READY'));
for(const [flag,code] of [['wakeWord','JS_WAKE_ENABLED'],['autoListen','AUTO_LISTEN_ENABLED'],['proactive','PROACTIVE_ENABLED'],['notifSpeak','NOTIFY_SPEECH_ENABLED']]) {
  test(flag,()=>{const c=context();c.settings[flag]=true;assert.equal(run(c),code);});
  test(flag+' unknown',()=>{const c=context();delete c.settings[flag];assert.equal(run(c),'UNKNOWN');});
}
for(const [flag,code] of [['speaking','JS_SPEAKING'],['listening','JS_LISTENING'],['thinking','JS_THINKING']]) {
  test(flag,()=>{const c=context();c[flag]=true;assert.equal(run(c),code);});
  test(flag+' string',()=>{const c=context();c[flag]='PRIVATE';assert.equal(run(c),'UNKNOWN');});
}
for(const [field,code] of [['TURNS','TURN_BUSY'],['INPUT_SESSION','INPUT_BUSY']]) {
  test(field,()=>{const c=context();c[field].active={secret:'PRIVATE'};assert.equal(run(c),code);});
  test(field+' missing owner field',()=>{const c=context();c[field]={};assert.equal(run(c),'UNKNOWN');});
  test(field+' invalid false sentinel',()=>{const c=context();c[field].active=false;assert.equal(run(c),code);});
}
test('unloaded',()=>{const c=context();c.window.__mayaJSOK=false;assert.equal(run(c),'JS_LOADING');});
test('nonboolean readiness marker fails closed',()=>{const c=context();c.window.__mayaJSOK='true';assert.equal(run(c),'JS_LOADING');});
test('getter error redacted',()=>{const c=context();Object.defineProperty(c.settings,'wakeWord',{get(){throw Error('PRIVATE')}});assert.equal(run(c),'UNKNOWN');});
test('no state/preference mutation',()=>{const c=context(),before=JSON.stringify(c);assert.equal(run(c),'READY');assert.equal(JSON.stringify(c),before);});
const main = fs.readFileSync('app/src/main/java/com/maya/ai/MainActivity.kt','utf8');
const gate = main.slice(main.indexOf('fun nativeChatReady('),main.indexOf('/* ================= WEBVIEW CLIENT'));
test('gate uses active session not allocated recognizer',()=>{assert(gate.includes('recognitionActive'));assert(!gate.includes('recognizer != null'));assert(gate.includes('webView.url in listOf('));});
for(const method of ['onError(error: Int)','onResults(results: Bundle?)']) test(method+' terminal reset',()=>{
  const index=main.indexOf('override fun '+method);const end=main.indexOf('override fun ',index+15);const block=main.slice(index,end);
  assert(block.includes('if (session != speechGeneration || delivered) return'));assert(block.includes('recognitionActive = false'));
  assert(block.indexOf('if (session')<block.indexOf('recognitionActive = false'));
});
test('stop resets and start marks active before listen',()=>{
  assert(main.includes('private fun stopRecognizer() {\n        recognitionActive = false'));
  assert(main.includes('catch (e: Exception) { recognitionActive = recognizer != null }'));
  assert(main.includes('recognitionActive = true\n                recognizer = makeRecognizer().apply {'));
});
test('no live request',()=>assert.equal(network,0));
console.log('NATIVE_READINESS_PASS: '+count+' offline JS/wiring cases; no voice/phone/model execution.');
