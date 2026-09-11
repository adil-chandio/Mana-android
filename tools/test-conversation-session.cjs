#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('public/index.html','utf8');
let passed=0,failed=0;
function test(n,f){try{f();passed++;console.log('PASS '+n);}catch(e){failed++;console.error('FAIL '+n+': '+e.message);}}
function world(){
 let clock=10000,seq=0;const timers=new Map();
 function Clock(){return new Date(clock);}Clock.now=()=>clock;
 const s={console,Date:Clock,performance:{now:()=>clock},settings:{wakeWord:true,wakeDoor:15,autoListen:false,stt:'ur-PK',name:'Boss'},
  speaking:false,thinking:false,listening:false,NATIVE:true,rec:null,INPUT_EPOCH:0,interimEl:{},statusText:{},commands:[],calls:[],logs:[],
  setTimeout(fn,ms){timers.set(++seq,{fn,at:clock+(ms||0)});return seq;},clearTimeout(id){timers.delete(id);},
  pushLog(x){s.logs.push(x);},setOrb(){},ensureAudio(){},chime(){},toast(){},addBubble(){},
  stripWake(t){return String(t).replace(s.KAAN.PREFIX, "").trim();},handleUserText(t,v,m){s.commands.push({t,m});},FLAGS:{on:()=>true},
  AWAAZ:{gen:0,stop(){this.gen++;}},SUKOON:{sunStart(){},sunEnd(){},bolEnd(){}},
  VOICE_TIME:{reset(){},now:()=>clock},MayaBridge:{listen(){s.calls.push('legacy');},listenOwned(lang,id){s.calls.push(id);},stopListen(){s.calls.push('stop');}}
 };
 s.window=s;vm.createContext(s);
 s.advance=ms=>{let end=clock+ms,n=0;while(true){let e=[...timers.entries()].filter(x=>x[1].at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!e)break;assert(++n<1000);clock=e[1].at;timers.delete(e[0]);e[1].fn();}clock=end;};
 const a=html.indexOf('/* OWNED CONVERSATION METRICS */'),b=html.indexOf('/* END OWNED CONVERSATION */');
 if(a>=0&&b>a)vm.runInContext(html.slice(a,b),s);
 vm.runInContext(html.slice(html.indexOf('var KAAN = {'),html.indexOf('window.__wakeErr = function')),s);
 vm.runInContext(html.slice(html.indexOf('function afterSpeak(wasVoice)'),html.indexOf('function reply(text')),s);
 vm.runInContext(html.slice(html.indexOf('var listenTimer = null;'),html.indexOf('/* ---------- ORB / STATUS')),s);
 vm.runInContext(html.slice(html.indexOf('window.__nativeSpeech ='),html.indexOf('window.__nativeRms =')),s);
 return s;
}
function metricWorld(){const s=world();assert(s.SESSION_TIME,'owned metrics missing');return s;}
test('silent follow-up closes its mic when the configured window expires',()=>{const s=world();s.KAAN.DARWAZA.open();s.scheduleListening(0);s.advance(1);assert.equal(s.listening,true);s.advance(15000);assert.equal(s.listening,false);});
test('a late native result cannot act after that follow-up expires',()=>{const s=world();s.KAAN.DARWAZA.open();s.scheduleListening(0);s.advance(1);const id=s.calls[0];s.advance(15000);s.__nativeSpeech('late question','',id,200);assert.equal(s.commands.length,0);});
test('explicit bare wake with window0 still listens once',()=>{const s=world();s.settings.wakeDoor=0;s.__wakeHeard('["Maya"]');s.advance(500);assert.equal(s.listening,true);assert.equal(s.commands.length,0);});
test('follow-up speech begun in-window gets a bounded completion allowance',()=>{const s=metricWorld();s.KAAN.DARWAZA.open();s.scheduleListening(0);s.advance(10000);const id=s.calls[0];s.INPUT_SESSION.began(id);s.advance(6000);assert.equal(s.listening,true);s.__nativeSpeech('answer','',id,200);assert.equal(s.commands.length,1);});
test('speech beginning after expiry cannot reopen the mic',()=>{const s=metricWorld();s.KAAN.DARWAZA.open();s.scheduleListening(0);s.advance(1);const id=s.calls[0];s.advance(15001);s.INPUT_SESSION.began(id);assert.equal(s.listening,false);});
test('explicit tap mic is not bound to a closed follow-up window',()=>{const s=metricWorld();s.startListening();s.advance(16000);assert.equal(s.listening,true);});
test('all input attempts have a hard bounded recognition wait',()=>{const s=metricWorld();s.startListening();s.advance(30001);assert.equal(s.listening,false);});
test('old native callback cannot steal a newer tap session',()=>{const s=metricWorld();s.startListening();const old=s.calls[0];s.stopListening();s.startListening();s.__nativeSpeech('obsolete','',old,100);assert.equal(s.commands.length,0);assert.equal(s.listening,true);});
test('partial callbacks never execute and cannot alter a different owner',()=>{const s=metricWorld();s.startListening();s.__nativePartial('PRIVATE','wrong');assert.notEqual(s.interimEl.textContent,'PRIVATE');assert.equal(s.commands.length,0);});
test('native duration is transferred with the accepted input only',()=>{const s=metricWorld();s.startListening();const id=s.calls[0];s.__nativeSpeech('test','',id,234);assert.equal(s.commands[0].m.origin,'tap');assert.equal(s.commands[0].m.recognitionMs,234);});
test('typed metrics distinguish text delivery from Fish dispatch and playing',()=>{const s=metricWorld(),m=s.SESSION_TIME;s.INPUT_EPOCH=1;const r=m.begin(false,null,1);s.advance(120);m.text(r,'provider');s.advance(20);m.output(r,10,'fish');s.advance(300);m.playing(10);assert.equal(r.textMs,120);assert.equal(r.fishMs,300);assert.equal(r.finalTextMs,null);});
test('wake metrics use native same-clock recognition duration, not old tap markers',()=>{const s=metricWorld(),m=s.SESSION_TIME;const r=m.begin(true,{origin:'wake',recognitionMs:250},0);s.advance(50);m.text(r,'provider');assert.equal(r.recognitionMs,250);assert.equal(r.finalTextMs,50);});
test('old row and old audio generation cannot overwrite the current measurement',()=>{const s=metricWorld(),m=s.SESSION_TIME;const old=m.begin(false,null,0);m.text(old,'provider');m.output(old,1,'fish');const r=m.begin(false,null,0);m.text(old,'provider');m.playing(1);assert.equal(r.textMs,null);assert.equal(r.fishMs,null);});
test('audition and speech-only retries do not acquire the main-reply sample',()=>{const s=metricWorld(),m=s.SESSION_TIME;const r=m.begin(false,null,0);m.text(r,'provider');m.output(null,4,'fish');m.playing(4);assert.equal(r.fishMs,null);});
test('cancelled output cannot record later playing even without a newer input',()=>{const s=metricWorld(),m=s.SESSION_TIME;const r=m.begin(false,null,0);m.text(r,'provider');m.output(r,4,'fish');m.stopAudio();m.playing(4);assert.equal(r.fishMs,null);});
test('timing records are bounded and contain no raw text/keys/voice IDs',()=>{const s=metricWorld(),m=s.SESSION_TIME;for(let i=0;i<35;i++)m.begin(true,{origin:'PRIVATE',recognitionMs:'PRIVATE',text:'PRIVATE',voiceId:'PRIVATE'},0);assert.equal(m.rows.length,20);assert.doesNotMatch(JSON.stringify(m.rows),/PRIVATE/);});
test('missing, negative and excessive recognition markers stay unknown',()=>{const s=metricWorld();for(const v of [undefined,null,-1,NaN,Infinity,300001])assert.equal(s.SESSION_TIME.begin(true,{origin:'wake',recognitionMs:v},0).recognitionMs,null);});
test('cache/local samples are not presented as provider speed',()=>{const s=metricWorld(),m=s.SESSION_TIME;for(const route of ['provider','cache','local']){const r=m.begin(false,null,0);s.advance(route==='provider'?100:1);m.text(r,route);}assert.equal(m.summary('typed').count,1);assert.equal(m.summary('typed').median,100);});
test('stale input epoch prevents even an otherwise-current row being updated',()=>{const s=metricWorld(),m=s.SESSION_TIME;const r=m.begin(false,null,0);s.INPUT_EPOCH++;m.text(r,'provider');assert.equal(r.textMs,null);});
console.log(`CONVERSATION SESSION: ${passed}/${passed+failed} passed. Controlled evidence only.`);if(failed)process.exitCode=1;
