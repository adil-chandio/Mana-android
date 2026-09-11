#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const html=fs.readFileSync('public/index.html','utf8'),v=JSON.parse(fs.readFileSync('release/version.json','utf8'));
let passed=0,failed=0;
function test(name,fn){try{fn();passed++;console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+': '+e.message);}}
function world(extra={}) {
  const s={MAYA_BUILD:v,settings:{apikey:'PRIVATE_KEY',fishKey:'FISH_SECRET',fishVoice:'PRIVATE_ID',fishVoiceName:'PRIVATE_TITLE',name:'PRIVATE_NAME',voiceEngine:'fish',wakeWord:true},
    VOICE_TIME:{ended:100,final:300,requested:700,audio:1400},
    TURNS:{active:null,history:[{id:1,stage:'text-ready',result:'done',ms:450}]},
    FISH:{selection:()=>({state:'reference'}),streamPending:null},
    AWAAZ:{engine:'fish'},KAAN:{starts:3,heard:2,woke:1,errs:0,lastErr:0,log:[{d:'PRIVATE_TRANSCRIPT'}]},
    speaking:false,listening:false,thinking:false,...extra};
  s.window=s;vm.createContext(s);
  const a=html.indexOf('function deviceTestReport()'),b=html.indexOf('/* END DEVICE TEST REPORT */',a);
  assert(a>=0&&b>a,'read-only report implementation missing');vm.runInContext(html.slice(a,b),s);return s;
}
test('candidate is newer than failed installed code86',()=>assert(v.versionCode>86));
test('visible splash, subtitle and build label match release version',()=>{
  const dom=new JSDOM(html);const d=dom.window.document;
  for(const node of [d.querySelector('.ver'),d.querySelector('#subTitle'),d.querySelector('#hudBuild')]) assert(node.textContent.includes(v.versionName),node.textContent);
  assert.doesNotMatch(d.querySelector('.ver').textContent,/kabhi nahi|sach mein zinda/);dom.window.close();
});
test('runtime build identity matches packaged version metadata',()=>{
  const m=html.match(/var MAYA_BUILD = (\{[^;]+\});/);assert(m);const s={};vm.createContext(s);vm.runInContext('var b='+m[1],s);assert.equal(s.b.versionName,v.versionName);assert.equal(s.b.versionCode,v.versionCode);
});
test('test status displays durations and version without exporting private fields',()=>{
  const s=world();const before=JSON.stringify(s.settings);const r=s.deviceTestReport();
  assert(r.includes(v.versionName));assert.match(r,/200ms/);assert.match(r,/700ms/);assert.match(r,/1100ms/);
  assert.doesNotMatch(r,/PRIVATE_|FISH_SECRET|TRANSCRIPT/);assert.equal(JSON.stringify(s.settings),before);
  assert.match(r,/not audible proof/);assert.match(r,/manual/);
});
test('missing timing markers are unknown, not a fabricated zero-latency success',()=>{
  const s=world({VOICE_TIME:{ended:0,final:0,requested:0,audio:0}}),r=s.deviceTestReport();assert.match(r,/not recorded/);assert.doesNotMatch(r,/(?:transcript|event): 0ms/);
});
test('malformed diagnostics are bounded and allowlisted rather than leaked as raw text',()=>{
  const s=world({VOICE_TIME:{ended:200,final:100,requested:NaN,audio:Infinity},KAAN:{starts:'PRIVATE_EVENT',lastErr:9000},TURNS:{history:[{id:'PRIVATE',stage:'PRIVATE_STAGE',result:'PRIVATE_ERROR',ms:'PRIVATE_DURATION'}]},AWAAZ:{engine:'PRIVATE_ENGINE'}});
  const r=s.deviceTestReport();assert.doesNotMatch(r,/PRIVATE|Infinity|NaN/);assert.match(r,/unknown|not recorded/);
});
test('snapshot tolerates absent subsystems during partial startup',()=>{
  const s=world();for(const k of ['TURNS','VOICE_TIME','FISH','KAAN','AWAAZ'])delete s[k];assert.doesNotThrow(()=>s.deviceTestReport());
});
test('status button is an explicit local display, without auto-copy or auto-upload',()=>{
  const dom=new JSDOM(html);assert(dom.window.document.getElementById('deviceTestStatus'));assert(dom.window.document.getElementById('deviceTestOut'));dom.window.close();
  const a=html.indexOf('/* DEVICE TEST WIRING */'),b=html.indexOf('/* END DEVICE TEST WIRING */',a);assert(a>=0&&b>a);
  const src=html.slice(a,b);assert.match(src,/addEventListener\("click"/);assert.match(src,/textContent = deviceTestReport\(\)/);assert.doesNotMatch(src,/fetch\(|setInterval|clipboard|MayaBridge|speak\(/);
});
test('clicking the status button renders a fresh local snapshot without changing app state',()=>{
  const dom=new JSDOM(html),s=world();s.document=dom.window.document;
  const a=html.indexOf('/* DEVICE TEST WIRING */'),b=html.indexOf('/* END DEVICE TEST WIRING */',a);
  const before=JSON.stringify({settings:s.settings,turns:s.TURNS,timing:s.VOICE_TIME});
  vm.runInContext(html.slice(a,b),s);
  const out=s.document.getElementById('deviceTestOut');assert.equal(out.style.display,'none');
  s.document.getElementById('deviceTestStatus').click();assert.equal(out.style.display,'block');assert.match(out.textContent,/MAYA DEVICE TEST/);
  assert.equal(JSON.stringify({settings:s.settings,turns:s.TURNS,timing:s.VOICE_TIME}),before);dom.window.close();
});
console.log(`DEVICE CANDIDATE: ${passed}/${passed+failed} passed. No physical-device evidence.`);process.exitCode=failed?1:0;
