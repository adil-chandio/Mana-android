#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const path=require('node:path'),{createRequire}=require('node:module');
const root=path.resolve(__dirname,'..');process.chdir(root);
const html=fs.readFileSync('public/index.html','utf8');
const base=fs.readFileSync('tools/test-fish-selection.cjs','utf8');
const fixture={require:createRequire(root+'/package.json'),__dirname:path.join(root,'tools'),console,Buffer,setTimeout,clearTimeout,process};
vm.createContext(fixture);vm.runInContext(base.slice(0,base.indexOf("test('empty/default")),fixture);
let passed=0,failed=0;
function test(name,fn){try{fn();passed++;console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+': '+e.message);}}
function world(){
  const s=fixture.world(),w=s.w;let clock=0,serial=0;const timers=new Map();
  w.setTimeout=(fn,ms)=>{timers.set(++serial,{fn,at:clock+ms});return serial;};w.clearTimeout=id=>timers.delete(id);
  s.advance=ms=>{const end=clock+ms;let guard=0;while(true){const entry=[...timers.entries()].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!entry)break;assert(++guard<500,'timer loop');clock=entry[1].at;timers.delete(entry[0]);entry[1].fn();}clock=end;};
  s.haals=[];w.MayaBridge.setHaal=h=>s.haals.push(h);w.speaking=false;w.listening=false;w.thinking=false;w.settings.wakeWord=true;
  w.eval(html.slice(html.indexOf('var SUKOON = {'),html.indexOf('var KAAN = {')));
  return s;
}
function ui(w){const a=html.indexOf('/* NATIVE WAKE STATUS */'),b=html.indexOf('/* Kotlin ab SAARE andaze');assert(a>=0&&b>a,'native wake status missing');w.eval(html.slice(a,b));}
function sample(s){s.w.fishFillVoices();s.w.$('#fishTest').click();assert.equal(s.w.speaking,true);return s.sent[s.sent.length-1].id;}
test('STOP of SUNO releases speaking and speech exclusion after echo tail',()=>{const s=world();try{sample(s);s.w.AWAAZ.stop();assert.equal(s.w.speaking,false);s.advance(549);assert.equal(s.w.SUKOON.haal,'BOL_RAHI');s.advance(1);assert.equal(s.w.SUKOON.haal,'KHALI');assert.equal(s.w.settings.fishVoice,'saved-id');}finally{s.w.close();}});
test('STOP cannot release a microphone owned by tap-to-speak',()=>{const s=world();try{s.w.SUKOON.sunStart();s.w.listening=true;s.w.AWAAZ.stop();s.advance(600);assert.equal(s.w.SUKOON.haal,'APP_SUN');assert.equal(s.w.listening,true);}finally{s.w.close();}});
test('a late old terminal cannot end the next audition or its wake exclusion',()=>{const s=world();try{const old=sample(s);s.w.AWAAZ.stop();const current=sample(s);s.w.__fishStreamEvent(old,'done',200);s.advance(600);assert.equal(s.w.speaking,true);assert.equal(s.w.SUKOON.haal,'BOL_RAHI');assert.equal(s.w.FISH.streamPending.id,current);}finally{s.w.close();}});
for(const event of ['done','error','timeout','interrupted'])test('current audition '+event+' releases exclusion, not the selected reference',()=>{const s=world();try{const id=sample(s);if(event==='done')s.w.__fishStreamEvent(id,'playing',200);s.w.__fishStreamEvent(id,event,event==='done'?200:0);s.advance(550);assert.equal(s.w.speaking,false);assert.equal(s.w.SUKOON.haal,'KHALI');assert.equal(s.w.settings.fishVoice,'saved-id');}finally{s.w.close();}});
test('pending Fish stream is not cleared merely because no playing event exists',()=>{const s=world();try{const id=sample(s);s.advance(45000);assert.equal(s.w.speaking,true);assert.equal(s.w.FISH.streamPending.id,id);assert.equal(s.w.SUKOON.haal,'BOL_RAHI');}finally{s.w.close();}});
test('no native ready callback means no listening badge, even after old four-second interval',()=>{const s=world();try{ui(s.w);s.w.WAKE_STATUS.receive({state:'starting',reason:'none',ageMs:0});s.advance(4000);assert.notEqual(s.w.WAKE_DOT.el.className,'');assert.doesNotMatch(s.w.WAKE_DOT.el.textContent,/SUN RAHI|MIC READY/);}finally{s.w.close();}});
test('native ready is indicated then expires to unknown without another callback',()=>{const s=world();try{ui(s.w);s.w.WAKE_STATUS.receive({state:'ready',reason:'none',servicePresent:true,foreground:true,micPermission:true,ageMs:0});assert.match(s.w.WAKE_DOT.el.textContent,/MIC READY/);s.advance(35001);assert.doesNotMatch(s.w.WAKE_DOT.el.textContent,/MIC READY|SUN RAHI/);}finally{s.w.close();}});
test('already-stale ready snapshots are never rendered as listening',()=>{const s=world();try{ui(s.w);s.w.WAKE_STATUS.receive({state:'ready',reason:'none',servicePresent:true,foreground:true,micPermission:true,ageMs:40000});assert.doesNotMatch(s.w.WAKE_DOT.el.textContent,/MIC READY|SUN RAHI/);}finally{s.w.close();}});
test('native status report excludes arbitrary reasons, keys and unknown fields',()=>{const s=world();try{ui(s.w);s.w.MayaBridge.wakeStatus=()=>JSON.stringify({state:'PRIVATE_STATE',reason:'PRIVATE_KEY',error:500,ageMs:-1,transcript:'PRIVATE_TEXT'});const r=JSON.stringify(s.w.WAKE_STATUS.read());assert.doesNotMatch(r,/PRIVATE/);assert.match(r,/unknown/);}finally{s.w.close();}});
test('wake OFF hides ready callbacks and never enables itself',()=>{const s=world();try{ui(s.w);s.w.settings.wakeWord=false;s.w.WAKE_STATUS.receive({state:'ready',reason:'none',servicePresent:true,foreground:true,micPermission:true,ageMs:0});assert.equal(s.w.WAKE_DOT.el.style.display,'none');assert.equal(s.w.settings.wakeWord,false);}finally{s.w.close();}});
test('missing or broken status bridge is unknown, not healthy',()=>{const s=world();try{ui(s.w);assert.equal(s.w.WAKE_STATUS.read().state,'unknown');s.w.MayaBridge.wakeStatus=()=>{throw Error('PRIVATE');};assert.equal(s.w.WAKE_STATUS.read().state,'unknown');}finally{s.w.close();}});
test('contradictory native ready without a foreground service is unknown',()=>{const s=world();try{ui(s.w);s.w.WAKE_STATUS.receive({state:'ready',reason:'none',servicePresent:false,foreground:false,micPermission:true,ageMs:0});assert.doesNotMatch(s.w.WAKE_DOT.el.textContent,/MIC READY/);}finally{s.w.close();}});
test('delayed native signal pulls current status instead of trusting an old ready payload',()=>{const s=world();try{ui(s.w);s.w.MayaBridge.wakeStatus=()=>JSON.stringify({state:'blocked',reason:'fish_output',ageMs:0});s.w.__wakeState({state:'ready',ageMs:0});assert.match(s.w.WAKE_DOT.el.textContent,/PAUSED/);}finally{s.w.close();}});
test('rejected start is visible, never a listening promise or automatic settings launch',()=>{const s=world();try{
  const w=s.w;ui(w);const toasts=[];w.toast=t=>toasts.push(t);w.hudRefresh=()=>{};w.MayaBridge.wakeService=()=>false;
  w.MayaBridge.wakeStatus=()=>JSON.stringify({state:'error',reason:'permission',error:9,ageMs:0});
  w.MayaBridge.batteryUnrestricted=()=>{throw Error('must not launch settings');};
  w.eval(html.slice(html.indexOf('function setWakeService(on)'),html.indexOf('/* ---------- VOICE STUDIO')));w.setWakeService(true);
  assert.match(toasts.join(' '),/start nahi hui/);assert.equal(w.settings.wakeWord,true);assert.match(w.WAKE_DOT.el.textContent,/ERROR/);
}finally{s.w.close();}});
test('new main reply reacquires output exclusion after centralized STOP',()=>{const s=world();try{
  const w=s.w;sample(s);w.cleanSpeech=t=>t;w.afterSpeak=()=>{};
  w.eval(html.slice(html.indexOf('function speak(text, wasVoice)'),html.indexOf('/* purana naam')));
  w.speak('New harmless answer',false);s.advance(600);assert.equal(w.speaking,true);assert.equal(w.SUKOON.haal,'BOL_RAHI');assert.equal(s.sent.length,2);assert.equal(s.sent[1].body.reference_id,'saved-id');
}finally{s.w.close();}});
test('manual native snapshot does not cancel pending Fish or expose raw fields',()=>{const s=world();try{
  const w=s.w;ui(w);const id=sample(s);const before=JSON.stringify(w.settings),gen=w.AWAAZ.gen;
  w.MayaBridge.wakeStatus=()=>JSON.stringify({state:'blocked',reason:'fish_output',error:0,ageMs:400,servicePresent:true,foreground:true,micPermission:true,fishOutputActive:true,audioState:'BOL_RAHI',transcript:'PRIVATE_TEXT',voiceId:'PRIVATE_ID'});
  w.eval(html.slice(html.indexOf('function deviceTestReport()'),html.indexOf('/* END DEVICE TEST REPORT */')));
  const report=w.deviceTestReport();assert.match(report,/Native wake: blocked/);assert.match(report,/Fish active: yes/);assert.doesNotMatch(report,/PRIVATE/);assert.equal(w.speaking,true);assert.equal(w.FISH.streamPending.id,id);assert.equal(w.AWAAZ.gen,gen);assert.equal(JSON.stringify(w.settings),before);
}finally{s.w.close();}});
test('native readiness wiring guards stale callbacks and surfaces startup failure',()=>{
  const kt=fs.readFileSync('app/src/main/java/com/maya/ai/WakeWordService.kt','utf8');
  const main=fs.readFileSync('app/src/main/java/com/maya/ai/MainActivity.kt','utf8');
  assert.match(kt,/onReadyForSpeech[^]*?session != recognitionGeneration \|\| delivered \|\| ready[^]*?updateHealth\(State.READY\)/);
  assert.match(kt,/if \(!startAsForeground\(\)\) \{ running = false; stopSelf\(\); return \}/);
  assert.match(kt,/fun start\(ctx: Context\): Boolean/);assert.match(kt,/Reason.START_REJECTED/);
  assert.match(kt,/requested = false[^]*?instance\?\.running = false/);
  assert.match(main,/fun wakeStatus\(\): String/);
  const boot=main.slice(main.indexOf('private fun ensureWakeAlive()'),main.indexOf('private fun evalAsync'));
  assert.doesNotMatch(boot,/startActivity/);assert.match(boot,/return@postDelayed/);
});
console.log(`WAKE RECOVERY: ${passed}/${passed+failed} passed (controlled lifecycle, no physical recognition).`);if(failed)process.exitCode=1;
