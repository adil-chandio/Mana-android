const fs=require('fs'), path=require('path');
const { JSDOM } = require('jsdom');
const ROOT='/home/user/Mana-android';
const HTML=fs.readFileSync(path.join(ROOT,'public/index.html'),'utf8');
const dom=new JSDOM('<!doctype html><body></body>',{runScripts:'dangerously',url:'https://appassets.androidplatform.net/'});
const w=dom.window;
w.pushLog=()=>{}; w.$=()=>null; w.NATIVE=false;
w.settings={name:'Boss',lang:'roman-ur'};
w.eval(HTML.slice(HTML.indexOf('var SCHEMA = {'), HTML.indexOf('var AWAAZ = {')));
const AWAAZSRC=HTML.slice(HTML.indexOf('var AWAAZ = {'), HTML.indexOf('var EDGE_TTS = {'));
try { w.eval(AWAAZSRC); console.log('AWAAZ eval OK'); } catch(e){ console.log('AWAAZ eval FAIL:', e.message); }
const A=w.AWAAZ;
console.log('props:', typeof A.speak, typeof A.lockBegin, typeof A.setEngine, typeof A.blockReason, JSON.stringify(A.lock));
// stub tiers
const calls=[];
A.cfg=function(){ return { on:true, mode:'auto', key:'k', fish:true, edge:true, maxChars:4000, wifiOnly:false }; };
A.liveKeys=function(){ return 1; };
A.paint=function(){};
A.note=function(c){ A.lastNote=c; };
A.stop=function(){ A.gen++; };
A.fishReady=()=>true; A.edgeReady=()=>true; A.blockReason=()=>''; A.pollenBad=0;
A.fish=function(t,done,err){ calls.push('fish:'+t); done(); };
A.neural=function(t,done,err){ calls.push('neural:'+t); done(); };
A.edge=function(t,done,err){ calls.push('edge:'+t); done(); };
A.pollen=function(t,done,err){ calls.push('free:'+t); done(); };
A.device=function(t,done){ calls.push('device:'+t); done(); };
A.FAST=0;  // disable fast timer
A.lockBegin('j1');
A.setEngine('fish');
console.log('lock after setEngine:', JSON.stringify(A.lock), 'switched', A.switched);
A.speak('pehla tukra', { lockKey:'j1', onStart:function(e){ calls.push('start:'+e); }, onDone:function(){ calls.push('done'); } });
A.speak('doosra tukra', { lockKey:'j1', chain:true, onStart:function(e){ calls.push('start:'+e); }, onDone:function(){ calls.push('done'); } });
console.log('calls:', calls.join(' | '));
console.log('switched total:', A.switched);
// ttsDay
console.log('ttsDay:', A.ttsDay(), 'max', A.TTS_DAY_MAX);
for(let i=0;i<12;i++) A.ttsBump();
console.log('after 12 bumps ttsDay:', A.ttsDay(), 'blockReason:', A.blockReason('hello'));
process.exit(0);
