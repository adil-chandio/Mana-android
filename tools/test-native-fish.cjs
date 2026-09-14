'use strict';
// Actual packaged Fish/BOLI builders, pure VM only. No provider, sound or browser traffic.
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const html = fs.readFileSync('public/index.html','utf8');
const source = fs.readFileSync('app/src/main/java/com/maya/ai/chat/NativeFishPolicy.kt','utf8');
const prepare = source.match(/const val LOCAL_PREPARE = """([\s\S]*?)"""/)[1];
const fish = html.slice(html.indexOf('var FISH = {'),html.indexOf('/* Kotlin ke bytes yahan girte hain */'));
const boli = html.slice(html.indexOf('var BOLI = {'),html.indexOf('var AWAAZ = {'));
let network = 0, count = 0;
const deny = () => { network++; throw Error('LIVE_NETWORK_BLOCKED'); };
globalThis.fetch=deny;
for (const name of ['http','https']) { const mod=require(name);mod.get=mod.request=deny; }
function world() {
  const c = vm.createContext({ settings:{fishOn:true,fishKey:'SYNTHETIC_KEY',fishVoice:'EXACT_saved-reference',fishTemp:.35,rate:1.0,tts:'ur-PK'},
    FLAGS:{on:()=>true},fetch:deny,XMLHttpRequest:deny,localStorage:{setItem:deny,getItem:deny},window:{MayaBridge:{httpBytes:deny,fishStreamSpeak:deny}},
    Date,JSON,Math,setTimeout:deny,clearTimeout:deny });
  vm.runInContext(boli+fish,c);c.FISH.speak=deny;c.FISH.req=deny;
  c.BOLI.last={from:'OLD_LOCAL',to:'OLD_LOCAL'};
  return c;
}
function run(c,text=null,idle='READY') {
  c.text=text;c.idle=idle;
  return JSON.parse(JSON.stringify(vm.runInContext('(function(text){'+prepare+'})(text)',c,{timeout:500})));
}
function test(label,fn) { fn(); count++; }
test('setup returns fixed code only, no header/key/text',()=>{const c=world();assert.deepEqual(run(c),{code:'READY'});assert.equal(c.BOLI.last.from,'OLD_LOCAL');});
test('exact reference, model, rate and temperature; restore pronunciation diagnostics',()=>{
  const c=world(),before=JSON.stringify(c.settings),last=c.BOLI.last;
  const r=run(c,'Salam, aap kaise hain?');assert.equal(r.code,'READY');
  const b=JSON.parse(r.body),h=JSON.parse(r.headers);
  assert.equal(b.reference_id,'EXACT_saved-reference');assert.equal(r.reference,b.reference_id);
  assert.equal(b.temperature,.35);assert.equal(b.prosody.speed,1);assert.equal(h.model,'s2.1-pro-free');
  assert.equal(h.Authorization,'Bearer SYNTHETIC_KEY');assert.notEqual(b.text,'Salam, aap kaise hain?');
  assert.equal(c.BOLI.last,last);assert.equal(JSON.stringify(c.settings),before);
});
for(const [field,value,code] of [
  ['fishOn',false,'FISH_OFF'],['fishOn',undefined,'FISH_OFF'],['fishKey','','KEY_MISSING'],['fishKey',42,'KEY_MISSING'],
  ['fishKey','BAD\r\nKEY','KEY_MISSING'],['fishVoice','','VOICE_MISSING'],['fishVoice',null,'VOICE_MISSING'],
  ['fishVoice','other voice','VOICE_INVALID'],['fishVoice',42,'VOICE_INVALID'],['fishVoice','x'.repeat(201),'VOICE_INVALID']]) {
  test(field+' '+code,()=>{const c=world();c.settings[field]=value;assert.equal(run(c,'test').code,code);});
}
test('active or unknown assistant cannot prepare',()=>{assert.equal(run(world(),'test','JS_LISTENING').code,'ASSISTANT_BUSY');});
test('overlong text is not chunked/truncated',()=>assert.equal(run(world(),'x'.repeat(2001)).code,'TOO_LONG'));
test('cooldown blocks without resetting it',()=>{const c=world();c.FISH.cool=Date.now()+100000;assert.equal(run(c,'test').code,'RATE_LIMIT');});
test('unknown cooldown fails closed',()=>{const c=world();c.FISH.cool=undefined;assert.equal(run(c,'test').code,'UNAVAILABLE');});
test('no different model fallback',()=>{const c=world();c.FISH.MODEL='paid';assert.equal(run(c,'test').code,'UNAVAILABLE');});
test('changed builder reference is rejected',()=>{const c=world();c.FISH.body=()=>JSON.stringify({reference_id:'different'});assert.equal(run(c,'test').code,'VOICE_CHANGED');});
test('conversion failure restores old diagnostic without exposing exception',()=>{
  const c=world(),last=c.BOLI.last;c.BOLI.say=()=>{c.BOLI.last={from:'PRIVATE_NEW'};throw Error('PRIVATE_DETAIL');};
  assert.deepEqual(run(c,'test'),{code:'UNAVAILABLE'});assert.equal(c.BOLI.last,last);
});
test('reply code characters stay data',()=>{
  const c=world();c.FLAGS.on=()=>false;
  const text='quote "; globalThis.hacked=true; //\n</script> اردو';
  assert.equal(JSON.parse(run(c,text).body).text,text);assert.equal(c.hacked,undefined);
});
test('no live traffic or settings storage',()=>assert.equal(network,0));
if(process.argv[2]) test('exact Kotlin script quotes reply as data',()=>{
  const fixture=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));assert(fixture.script.length<65536);
  const c=world();Object.assign(c.settings,{wakeWord:false,autoListen:false,proactive:false,notifSpeak:false});
  Object.assign(c,{speaking:false,listening:false,thinking:false,TURNS:{active:null},INPUT_SESSION:{active:null}});
  c.window.__mayaJSOK=true;c.FLAGS.on=()=>false;
  const result=vm.runInContext(fixture.script,c,{timeout:500});assert.equal(result.code,'READY');
  assert.equal(JSON.parse(result.body).text,fixture.text);assert.equal(c.hacked,undefined);assert.equal(network,0);
});

console.log('NATIVE_FISH_LOCAL_PASS: '+count+' offline cases; no synthesis or model execution.');
