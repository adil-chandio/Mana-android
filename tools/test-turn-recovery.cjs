#!/usr/bin/env node
'use strict';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..'); process.chdir(root);
const html = fs.readFileSync('public/index.html', 'utf8');
const fixtureText = fs.readFileSync('tools/test-brain-engine.js', 'utf8');
const fixture = { require: createRequire(root + '/package.json'), __dirname, console, Buffer, setTimeout, clearTimeout };
vm.createContext(fixture); vm.runInContext(fixtureText.slice(0, fixtureText.indexOf('(async function run()')), fixture);
const cases = [];
function test(name, run) { cases.push({ name, run }); }
function world(opts) {
  const x = fixture.makeWorld(opts);
  x.w.interimEl = { textContent: 'old microphone hint' };
  x.w.listening = false; x.w.speaking = false;
  x.w.stopListening = () => { x.w.listening = false; x.w.interimEl.textContent = ''; };
  x.w.showTurnNotice = text => { if (text) x.state.notices.push(text); };
  x.state.notices = [];
  return x;
}
const tick = () => new Promise(resolve => setImmediate(resolve));
async function bounded(p) {
  let timer;
  try { return await Promise.race([p, new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Test did not settle')), 500); })]); }
  finally { clearTimeout(timer); }
}
test('planning exception recovers instead of rejecting and wedging thinking', async () => {
  const {w,state} = world();
  try {
    w.BRAIN.plan = () => { throw Error('INJECTED'); };
    await bounded(w.askAI(false));
    assert.equal(w.thinking, false); assert.equal(w.TURNS.active, null); assert.equal(state.notices.length, 1);
  } finally { w.close(); }
});
test('never-settling provider reaches one overall deadline and clears the mic hint', async () => {
  const {w,state} = world();
  try {
    w.TURNS.BUDGET_MS = 20;
    w.geminiChat = () => new Promise(()=>{});
    await bounded(w.askAI(false));
    assert.equal(w.thinking, false); assert.equal(w.interimEl.textContent, '');
    assert.equal(w.TURNS.history.at(-1).result, 'timeout'); assert.equal(state.notices.length, 1);
  } finally { w.close(); }
});
test('STOP invalidates a late provider answer', async () => {
  const {w,state} = world();
  try {
    let resolve; w.geminiChat = () => new Promise(r=>{resolve=r;});
    const pending = w.askAI(false); await tick();
    w.TURNS.cancel('cancelled'); resolve('obsolete answer'); await bounded(pending); await tick();
    assert.equal(state.replies.length, 0); assert.equal(w.thinking, false);
  } finally { w.close(); }
});
test('replacement B is not cleared or overwritten by late A', async () => {
  const {w,state} = world();
  try {
    const resolves = []; w.geminiChat = () => new Promise(r=>resolves.push(r));
    const a = w.askAI(false); await tick();
    w.chatHist.push({role:'user',text:'second question'});
    const b = w.askAI(false); await tick();
    resolves[0]('old answer'); await bounded(a); await tick();
    assert.equal(w.thinking, true); assert.equal(state.replies.length, 0);
    resolves[1]('new answer'); await bounded(b);
    assert.equal(state.replies.length, 1); assert.equal(state.replies[0], 'new answer'); assert.equal(w.thinking,false);
  } finally { w.close(); }
});
test('AI startup stops active input before thinking', async () => {
  const {w} = world();
  try {
    w.listening = true; w.geminiChat = async () => 'answer';
    await bounded(w.askAI(false)); assert.equal(w.listening,false); assert.equal(w.interimEl.textContent,'');
  } finally { w.close(); }
});
test('cancelling native HTTP unregisters response and cancels its socket job', async () => {
  const {w} = world();
  try {
    let id, cancelled, callbacks=0;
    w.NATIVE = true;
    w.MayaBridge = { httpPostAsync(url,auth,body,request){id=request;}, cancelHttpPost(request){cancelled=request;} };
    const turn = w.TURNS.begin();
    w.BRAIN.post('https://example.test', '', '{}', 22000, ()=>callbacks++, turn);
    const late = w.BRAIN.waiting[id]; w.TURNS.cancel('cancelled'); late(200,'{}');
    assert.equal(cancelled,id); assert.equal(Object.keys(w.BRAIN.waiting).length,0); assert.equal(callbacks,0);
  } finally { w.close(); }
});
for (const bodyHang of [false, true]) test('Gemini ' + (bodyHang ? 'body read' : 'connection') + ' deadline aborts fetch', async () => {
  const {w,state} = world();
  try {
    w.TURNS.BUDGET_MS = 20; let signal;
    w.fetch = async (url, init) => { signal = init.signal; return bodyHang ? { ok:true, status:200, json:()=>new Promise(()=>{}) } : new Promise(()=>{}); };
    await bounded(w.askAI(false));
    assert.equal(signal.aborted,true); assert.equal(w.thinking,false); assert.equal(state.replies.length,0);
    assert.equal(w.TURNS.history.at(-1).result,'timeout');
  } finally { w.close(); }
});
test('real model discovery is included in the deadline and cannot update cache after cancellation', async () => {
  const {w,state} = world();
  try {
    w.eval(html.slice(html.indexOf('function modelScore('),html.indexOf('var BRAINS = [')));
    w.MODEL_CACHE=null; w.TURNS.BUDGET_MS=20;
    let resolve,signal;
    w.fetch=async(url,init)=>{ signal=init.signal; return {ok:true,status:200,json:()=>new Promise(r=>resolve=r)}; };
    await bounded(w.askAI(false)); assert.equal(signal.aborted,true);
    resolve({models:[{name:'models/gemini-2.5-flash',supportedGenerationMethods:['generateContent']}]}); await tick();
    assert.equal(w.MODEL_CACHE,null); assert.equal(state.replies.length,0);
  } finally { w.close(); }
});
test('late Gemini function-call JSON cannot launch a tool after STOP', async () => {
  const {w,state} = world();
  try {
    let resolve,tools=0;
    w.needsTools=()=>true; w.execTool=async()=>{tools++;return {ok:true};};
    w.fetch=async()=>({ok:true,status:200,json:()=>new Promise(r=>resolve=r)});
    const p=w.askAI(false); await tick(); w.TURNS.cancel('cancelled');
    resolve({candidates:[{content:{parts:[{functionCall:{name:'notify',args:{}}}]}}]});
    await bounded(p); await tick(); assert.equal(tools,0); assert.equal(state.replies.length,0);
  } finally { w.close(); }
});
test('STOP closes pending permission and a late YES cannot dispatch its action', async () => {
  const {w} = world();
  try {
    w.eval(html.slice(html.indexOf('async function execTool('),html.indexOf('/* =========== NEVER-STOP BRAIN')));
    w.FLAGS.on=()=>true; w.RAILS.check=()=>({ok:true}); w.IJAZAT.need=()=>true;
    let approve,denials=0,notifications=0;
    w.IJAZAT.ask=()=>new Promise(resolve=>{approve=resolve;w.IJAZAT.pend=yes=>{if(!yes)denials++;resolve(yes);};});
    w.NATIVE=true; w.MayaBridge={notify(){notifications++;}};
    const t=w.TURNS.begin(), p=w.execTool('notify',{message:'controlled'},t);
    const rejected=assert.rejects(p,e=>e.name==='TurnCancelled');
    w.TURNS.cancel('cancelled'); approve(true); await bounded(rejected);
    assert.equal(denials,1); assert.equal(notifications,0);
  } finally { w.close(); }
});
test('AMAL stops between tools and does not continue its provider request', async () => {
  const {w} = world();
  try {
    let resolve,tools=0;
    w.execTool=()=>{tools++;return new Promise(r=>resolve=r);};
    const t=w.TURNS.begin();
    const p=w.AMAL.runCalls([{id:'a',function:{name:'notify',arguments:'{}'}},{id:'b',function:{name:'notify',arguments:'{}'}}],t);
    const rejected=assert.rejects(p,e=>e.name==='TurnCancelled');
    w.TURNS.cancel('cancelled'); resolve({ok:true}); await bounded(rejected); await tick(); assert.equal(tools,1);
  } finally { w.close(); }
});
test('pool tool completion after cancellation cannot send another HTTP request', async () => {
  const {w,state}=world({settings:{apikey:'',groqKey:'TEST'},pool:()=>({status:200,body:{choices:[{message:{tool_calls:[{id:'a',function:{name:'notify',arguments:'{}'}}]}}]}})});
  try {
    let resolve;
    w.AMAL.poolOn=()=>true; w.AMAL.openaiTools=()=>[];
    w.execTool=()=>new Promise(r=>resolve=r);
    const p=w.askAI(false); await new Promise(r=>setTimeout(r,15));
    assert.equal(typeof resolve,'function'); w.TURNS.cancel('cancelled'); resolve({ok:true});
    await bounded(p); await tick(); assert.equal(state.pool.length,1); assert.equal(state.replies.length,0);
  } finally { w.close(); }
});
test('native GET tool requests use the cancellable async bridge, not the blocking bridge', async () => {
  const {w}=world();
  try {
    w.eval(html.slice(html.indexOf('async function nativeGet('),html.indexOf('async function webSearch(')));
    let id,stopped;
    w.NATIVE=true; w.MayaBridge={httpGet(){throw Error('Blocking HTTP forbidden');},httpGetAsync(url,auth,rid){id=rid;},cancelHttpPost(rid){stopped=rid;}};
    const t=w.TURNS.begin(),p=w.nativeGet('https://example.test',t);
    const rejected=assert.rejects(p,e=>e.name==='TurnCancelled'); w.TURNS.cancel('cancelled'); await bounded(rejected);
    assert.equal(stopped,id); assert.equal(Object.keys(w.BRAIN.waiting).length,0);
  } finally { w.close(); }
});
test('XHR cancellation aborts the resource, clears timeout and ignores late onload', async () => {
  const {w}=world();
  try {
    let xhr,aborted=0,callbacks=0;
    w.XMLHttpRequest=function(){xhr=this;this.open=()=>{};this.setRequestHeader=()=>{};this.send=()=>{};this.abort=()=>aborted++;};
    const t=w.TURNS.begin();w.BRAIN.post('https://example.test','','{}',22000,()=>callbacks++,t);
    w.TURNS.cancel('cancelled'); xhr.status=200;xhr.responseText='{}';xhr.onload();
    assert.equal(aborted,1);assert.equal(callbacks,0);assert.equal(t.cancels.length,0);
  } finally { w.close(); }
});
test('actual STOP button cancels the AI owner before a late response arrives', async () => {
  const {w,state}=world();
  try {
    w.document.body.innerHTML='<button id="qStop"></button>';w.$=s=>w.document.querySelector(s);
    w.INPUT_EPOCH=0;w.synth=null;w.geminiTTS_stop=()=>{};
    w.eval(html.slice(html.indexOf('$("#qStop").addEventListener'),html.indexOf('$("#qAuto").addEventListener')));
    let resolve;w.geminiChat=()=>new Promise(r=>resolve=r);
    const p=w.askAI(false);await tick();w.document.getElementById('qStop').click();resolve('late');await bounded(p);
    assert.equal(w.TURNS.active,null);assert.equal(state.replies.length,0);assert.equal(w.INPUT_EPOCH,1);
  } finally { w.close(); }
});
test('Home and Chat typing both stop active input/audio and enter as typed text', async () => {
  const {w}=world();
  try {
    w.document.body.innerHTML='<div id="tab-home"><input id="homeTxt"><button id="micHome"></button></div><input id="chatTxt">';
    w.$=s=>w.document.querySelector(s);w.txt=w.$('#chatTxt');w.AWAAZ={stop(){}};w.showVoiceNotice=()=>{};
    const received=[];w.handleUserText=(text,voice)=>received.push({text,voice,listening:w.listening,speaking:w.speaking,thinking:w.thinking});
    w.eval(html.slice(html.indexOf('var _hutInteract ='),html.indexOf('/* ---------- PERSONA CHIPS')));
    w.eval(html.slice(html.indexOf('function sendText(){'),html.indexOf('$("#qStop").addEventListener')));
    for (const home of [true,false]) {
      w.TURNS.begin(); w.thinking=w.listening=w.speaking=true;
      const input=w.$(home?'#homeTxt':'#chatTxt'); input.value=home?'home question':'chat question';
      if (home) input.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter'})); else w.sendText();
      const r=received.at(-1);assert.equal(r.voice,false);assert.equal(r.listening,false);assert.equal(r.speaking,false);assert.equal(r.thinking,false);
    }
    assert.equal(received.length,2);
  } finally { w.close(); }
});
test('missing selected Fish voice preserves both Home answer and chat text', async () => {
  const src=fs.readFileSync('tools/test-voice-engine.js','utf8');
  const f={require:createRequire(root+'/package.json'),__dirname,console,Buffer,setTimeout,clearTimeout};
  vm.createContext(f);vm.runInContext(src.slice(0,src.indexOf('(async function run()')),f);
  const {w}=f.makeWorld({native:true,bridge:{httpBytes(){throw Error('No network expected');},fishStreamSpeak(){throw Error('Missing selection must not stream');}},settings:{voiceEngine:'fish',fishKey:'TEST_ONLY',fishVoice:''}});
  try {
    w.document.body.innerHTML='<div id="tab-home"><div id="homeLast"></div></div><div id="tab-chat"></div>';
    w.$=s=>w.document.querySelector(s);w.persona=()=>({emoji:'M'});w.personaName=()=>'MAYA';w.esc=s=>String(s);
    const bubbles=[];w.addBubble=(who,text)=>bubbles.push({who,text});w.chatHist=[];w.persistChat=()=>{};w.cleanSpeech=s=>s;
    w.setOrb=()=>{};w.speaking=w.thinking=false;w.SUKOON={bolStart(){},bolEnd(){}};
    w.eval(html.slice(html.indexOf('var _addBubbleCore ='),html.indexOf('/* ---------- handleUserText WRAP')));
    w.eval(html.slice(html.indexOf('function speak(text, wasVoice)'),html.indexOf('/* ---------- TEST VOICE')));
    w.reply('CONTROLLED ANSWER',false);
    assert.match(w.$('#homeLast').textContent,/CONTROLLED ANSWER/);
    assert.doesNotMatch(w.$('#homeLast').textContent,/VOICE_MISSING/);
    assert.equal(w.chatHist.length,1);assert.equal(w.chatHist[0].text,'CONTROLLED ANSWER');assert.equal(bubbles.length,1);
    assert.equal(w.document.querySelectorAll('.voice-notice').length,2);
    assert.match(w.$('.voice-notice').textContent,/VOICE_MISSING/);assert.equal(w.speaking,false);
    assert.equal(w.settings.fishVoice,'');assert.equal(w.settings.voiceEngine,'fish');
  } finally { w.close(); }
});
test('server failures never arm an automatic retry, and completed turns clear timers', async () => {
  const {w,state}=world({settings:{apikey:''},pool:()=>({status:503,body:'unavailable'})});
  try {
    const timers=new Set(), nativeSet=w.setTimeout.bind(w), nativeClear=w.clearTimeout.bind(w);
    w.setTimeout=(fn,ms)=>{const id=nativeSet(()=>{timers.delete(id);fn();},ms);timers.add(id);return id;};
    w.clearTimeout=id=>{timers.delete(id);nativeClear(id);};
    await bounded(w.askAI(false));assert.equal(timers.size,0);assert.equal(w.TURNS.active,null);
    assert.equal(state.replies.length,0);assert.match(state.notices.at(-1),/no automatic retry/);
  } finally { w.close(); }
});
test('old WebView without AbortController uses an abortable transport instead of raw fetch', async () => {
  const {w}=world();
  try {
    w.AbortController=undefined;w.fetch=()=>{throw Error('Unabortable fetch forbidden');};
    let xhr,aborts=0;
    w.XMLHttpRequest=function(){xhr=this;this.open=()=>{};this.setRequestHeader=()=>{};this.send=()=>{};this.abort=()=>aborts++;};
    const t=w.TURNS.begin(),p=w.TURNS.json(t,'https://example.test');
    const rejected=assert.rejects(p,e=>e.name==='TurnCancelled');w.TURNS.cancel('cancelled');await bounded(rejected);
    assert.ok(xhr);assert.equal(aborts,1);
  } finally { w.close(); }
});
test('request-level native timeout cancels the job and removes late callbacks', async () => {
  const {w}=world();
  try {
    let id,abort,late;
    w.NATIVE=true;w.MayaBridge={httpPostAsync(url,auth,body,rid){id=rid;late=w.BRAIN.waiting[id];},cancelHttpPost(rid){abort=rid;}};
    const t=w.TURNS.begin();let callbacks=0;
    const p=new Promise(resolve=>w.BRAIN.post('https://example.test','','{}',15,(status)=>{callbacks++;resolve(status);},t));
    assert.equal(await bounded(p),0);late(200,'{}');assert.equal(callbacks,1);assert.equal(abort,id);
    assert.equal(Object.keys(w.BRAIN.waiting).length,0);w.TURNS.finish(t);
  } finally { w.close(); }
});
test('manual mic tap interrupts a hung AI turn and its late answer cannot close the mic', async () => {
  const {w,state}=world();
  try {
    let resolve,listens=0;
    w.NATIVE=true;w.MayaBridge={listen(){listens++;},stopListen(){}};
    w.VOICE_TIME={reset(){}};w.AWAAZ={stop(){}};w.ensureAudio=w.chime=()=>{};w.rec=null;
    w.eval(html.slice(html.indexOf('var listenTimer = null;'),html.indexOf('/* ---------- ORB / STATUS')));
    w.geminiChat=()=>new Promise(r=>resolve=r);
    const p=w.askAI(false);await tick();w.startListening();assert.equal(listens,1);assert.equal(w.listening,true);assert.equal(w.thinking,false);
    resolve('old answer');await bounded(p);assert.equal(w.listening,true);assert.equal(state.replies.length,0);
  } finally { w.close(); }
});
test('browser recognizer events from an abandoned session cannot reset a new turn', async () => {
  const {w}=world();
  try {
    let aborted=0;
    w.NATIVE=false;w.VOICE_TIME={reset(){}};w.AWAAZ={stop(){}};w.ensureAudio=w.chime=()=>{};
    w.SR=function(){this.start=()=>{};this.abort=()=>aborted++;};w.rec=null;
    w.eval(html.slice(html.indexOf('var listenTimer = null;'),html.indexOf('/* ---------- ORB / STATUS')));
    w.startListening();const old=w.rec,ended=old.onend,result=old.onresult;
    w.stopListening();w.thinking=true;ended();result({resultIndex:0,results:[]});
    assert.equal(aborted,1);assert.equal(w.thinking,true);assert.equal(old.onresult,null);
  } finally { w.close(); }
});
test('cancelled code tool terminates its worker and releases the blob URL', async () => {
  const {w}=world();
  try {
    w.eval(html.slice(html.indexOf('function sandboxRun('),html.indexOf('function htmlToText(')));
    let worker,stopped=0,revoked=0;
    w.URL.createObjectURL=()=> 'blob:controlled';w.URL.revokeObjectURL=()=>revoked++;
    w.Worker=function(){worker=this;this.postMessage=()=>{};this.terminate=()=>stopped++;};
    const t=w.TURNS.begin(),p=w.sandboxRun('return 1','',t);w.TURNS.cancel('cancelled');
    const out=await bounded(p);assert.match(out.error,/cancelled/);assert.ok(stopped>=1);assert.equal(revoked,1);
    worker.onmessage({data:{ok:true,result:999}});assert.equal(revoked,1);
  } finally { w.close(); }
});
test('AI code cannot fall back to uncancellable main-thread execution when workers are unavailable', async () => {
  const {w}=world();
  try {
    w.eval(html.slice(html.indexOf('function sandboxRun('),html.indexOf('function htmlToText(')));
    w.Worker=undefined;const t=w.TURNS.begin();const result=await bounded(w.sandboxRun('window.CANARY = true','',t));
    assert.equal(w.CANARY,undefined);assert.match(result.error,/not run on the UI thread/);w.TURNS.finish(t);
  } finally { w.close(); }
});
(async()=>{
  let failed=0;
  for (const c of cases) { try { await c.run(); console.log('PASS '+c.name); } catch(e) { failed++; console.error('FAIL '+c.name+': '+e.message); } }
  console.log(`TURN RECOVERY: ${cases.length-failed}/${cases.length} passed (mocked integration, no phone/network).`);
  process.exitCode=failed?1:0;
})();
