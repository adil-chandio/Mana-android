'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path'),{createRequire}=require('module'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('public/index.html','utf8');let count=0;
async function test(name,fn){await fn();count++;console.log('PASS '+name);}
function context(code,s={}){s.window=s;vm.createContext(s);vm.runInContext(code,s,{timeout:1000});return s;}
(async()=>{
 await test('restricted native boot installs restrictive resource policy without network or settings writes',()=>{
  const d=new JSDOM(html,{runScripts:'outside-only',url:'https://appassets.androidplatform.net/assets/web/index.html'});
  try {const w=d.window;w.MayaBridge={legacyRestricted:()=>true};w.eval(html.match(/<script>\/\* NATIVE_HOST_BOOT[\s\S]*?<\/script>/)[0].replace(/^<script>|<\/script>$/g,''));
   const c=w.document.querySelector('meta[http-equiv="Content-Security-Policy"]').content;
   for(const rule of ["connect-src 'none'","frame-src 'none'","worker-src 'none'","object-src 'none'","form-action 'none'"]) assert(c.includes(rule));
   assert(!c.includes('unsafe-eval'));assert(w.nativeLegacyRestricted());
  } finally {d.window.close();}
 });
 await test('zero numeric settings survive the actual collector',()=>{
  const a=html.indexOf('  collect: function () {'),b=html.indexOf('  /* ---------- galat khane',a);
  const s=context('var SETFORM={'+html.slice(a,b)+'};',{settings:{},SET_FIELDS:[{id:'door',key:'wakeDoor',t:'num',def:15},{id:'zoom',key:'micZoom',t:'num',def:.8}],document:{getElementById:()=>({value:'0'})}});
  s.SETFORM.collect();assert.equal(s.settings.wakeDoor,0);assert.equal(s.settings.micZoom,0);
 });
 await test('invalid numbers use defaults rather than storing Infinity or NaN',()=>{
  const a=html.indexOf('  collect: function () {'),b=html.indexOf('  /* ---------- galat khane',a);
  for(const value of ['', 'Infinity','NaN','not-a-number']) {const s=context('var SETFORM={'+html.slice(a,b)+'};',{settings:{},SET_FIELDS:[{id:'n',key:'value',t:'num',def:15}],document:{getElementById:()=>({value})}});s.SETFORM.collect();assert.equal(s.settings.value,15);}
 });
 await test('legacy backup never serializes credentials or creates a download',()=>{
  const a=html.indexOf('try { $("#expBtn").addEventListener'),b=html.indexOf('/* renderFacts override',a);let click,notice='';
  const deny=()=>{throw Error('Must not export')};context(html.slice(a,b),{settings:{fishKey:'PRIVATE'},Blob:deny,URL:{createObjectURL:deny},document:{createElement:deny},$(){return {addEventListener(_,fn){click=fn}}},toast(s){notice=s}});
  click();assert(notice.includes('retired'));assert(!notice.includes('PRIVATE'));
 });
 await test('scheduled-message callback cannot call, send, notify or mutate stored tasks',()=>{
  const a=html.indexOf('window.__taskDue = function(id){'),b=html.indexOf('\n};',a)+3;let notice='';const deny=()=>{throw Error('Action forbidden')};
  const s=context(html.slice(a,b),{schedTasks:{test:{kind:'message'}},execTool:deny,MayaBridge:{contactsSearch:deny,openWhatsAppDraft:deny},showTurnNotice(t){notice=t}});
  s.__taskDue('test');assert(s.schedTasks.test);assert(notice.includes('No call or message'));
 });
 await test('proactive initialization stops old timer but does not activate saved preference',()=>{
  const a=html.indexOf('function startProactive(){'),b=html.indexOf('/* ---------- v4 INIT',a);let stopped=0;
  const s=context(html.slice(a,b),{settings:{proactive:true},MAYA_V4:{proactiveTimer:123},clearInterval(){stopped++},setInterval(){throw Error('No unsolicited timer')},reply(){throw Error('No unsolicited speech')}});
  s.startProactive();assert.equal(stopped,1);assert.equal(s.MAYA_V4.proactiveTimer,null);assert(s.settings.proactive);
 });
 await test('retired vision neither resolves models nor uploads a supplied image',async()=>{
  const a=html.indexOf('async function visionAsk('),b=html.indexOf('/* ---------- NAMAZ TIMES',a);const deny=()=>{throw Error('No upload')};
  const s=context(html.slice(a,b),{fetch:deny,resolveModels:deny,showTurnNotice(){}});
  assert.equal(await s.visionAsk('question','SYNTHETIC_IMAGE'),null);s.__photoTaken('SYNTHETIC_IMAGE');
 });
 await test('unowned code and native-owned legacy code cannot reach a bridge or worker',async()=>{
  const a=html.indexOf('function sandboxRun('),b=html.indexOf('function htmlToText',a);const deny=()=>{throw Error('Must not execute')};
  const s=context(html.slice(a,b),{Promise,Worker:deny,MayaBridge:{probe:deny},nativeLegacyRestricted:()=>true});
  for(const turn of [null,{}]) {const result=await s.sandboxRun('return globalThis.MayaBridge.probe()','',turn);assert(result.error.includes('retired'));}
 });
 await test('native legacy output cannot enter any TTS ladder or device voice',()=>{
  const src=fs.readFileSync('tools/test-voice-engine.js','utf8');const f={require:createRequire(path.resolve('package.json')),__dirname:path.resolve('tools'),console,Buffer,setTimeout,clearTimeout};vm.createContext(f);vm.runInContext(src.slice(0,src.indexOf('(async function run()')),f);
  const {w,state}=f.makeWorld({native:true});try {w.nativeLegacyRestricted=()=>true;let error='';w.AWAAZ.speak('synthetic',{onError:c=>error=c});w.AWAAZ.device('synthetic',()=>{});assert.equal(error,'LEGACY_DISABLED');assert.equal(state.deviceSaid.length,0);assert.equal(state.calls.length,0);} finally {w.close();}
 });
 await test('primary Fish detection still works without the removed generic binary proxy',()=>{
  const a=html.indexOf('var FISH = {'),b=html.indexOf('/* Kotlin ke bytes yahan girte hain */');
  const s=context(html.slice(a,b),{NATIVE:true,MayaBridge:{fishTalkSpeak(){}},settings:{fishKey:'TEST',fishVoice:'SAVED'},Date,JSON,Math});assert(s.FISH.native());assert.equal(s.FISH.voice(),'SAVED');
 });
 console.log(`LEGACY CONTAINMENT: ${count}/${count} passed. No actual device, network, capture, upload or deployment.`);
})().catch(e=>{console.error(e);process.exitCode=1});
