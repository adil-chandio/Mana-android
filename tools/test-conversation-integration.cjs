#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict'),{createRequire}=require('node:module');
const root=path.resolve(__dirname,'..');process.chdir(root);
const html=fs.readFileSync('public/index.html','utf8');
const base=fs.readFileSync('tools/test-fish-selection.cjs','utf8');
const fixture={require:createRequire(root+'/package.json'),__dirname:path.join(root,'tools'),console,Buffer,setTimeout,clearTimeout,process};
vm.createContext(fixture);vm.runInContext(base.slice(0,base.indexOf("test('empty/default")),fixture);
let pass=0;function test(name,fn){fn();pass++;console.log('PASS '+name);}
function world(){const s=fixture.world(),w=s.w;w.INPUT_EPOCH=1;w.cleanSpeech=t=>t;w.addBubble=()=>{};w.chatHist=[];w.persistChat=()=>{};w.settings.wakeWord=false;w.persona=()=>({rate:1,pitch:1});
 w.eval(html.slice(html.indexOf('/* OWNED CONVERSATION METRICS */'),html.indexOf('/* END OWNED CONVERSATION */')));
 w.eval(html.slice(html.indexOf('function speak(text, wasVoice)'),html.indexOf('/* ---------- TEST VOICE')));
 w.eval(html.slice(html.indexOf('var _speakCore ='),html.indexOf('/* ---------- setOrb WRAP')));return s;}
test('actual reply and persona wrapper carry the owner to the selected Fish playing callback',()=>{const {w,sent}=world();try{const r=w.SESSION_TIME.begin(false,null,1);w.reply('CONTROLLED',false,null,r,'provider');assert.notEqual(r.textMs,null);assert.equal(r.phase,'preparing');assert.equal(sent[0].body.reference_id,'saved-id');w.__fishStreamEvent(sent[0].id,'playing',200);assert.notEqual(r.fishMs,null);w.__fishStreamEvent(sent[0].id,'done',200);assert.equal(r.phase,'done');}finally{w.close();}});
test('actual STOP cancels measurement ownership without changing the selected voice',()=>{const {w,sent}=world();try{const r=w.SESSION_TIME.begin(false,null,1);w.reply('CONTROLLED',false,null,r,'provider');w.AWAAZ.stop();w.__fishStreamEvent(sent[0].id,'playing',200);assert.equal(r.fishMs,null);assert.equal(r.phase,'audio-cancelled');assert.equal(w.settings.fishVoice,'saved-id');}finally{w.close();}});
test('real SUNO audition cannot overwrite an accepted main reply timing row',()=>{const {w,sent}=world();try{const r=w.SESSION_TIME.begin(false,null,1);w.reply('CONTROLLED',false,null,r,'provider');w.AWAAZ.stop();w.$('#fishTest').click();w.__fishStreamEvent(sent.at(-1).id,'playing',200);assert.equal(r.fishMs,null);assert.equal(r.phase,'audio-cancelled');}finally{w.close();}});
test('an unowned legacy reply is not attached to the previous accepted input',()=>{const {w,sent}=world();try{const r=w.SESSION_TIME.begin(false,null,1);w.reply('UNOWNED',false);w.__fishStreamEvent(sent[0].id,'playing',200);assert.equal(r.textMs,null);assert.equal(r.fishMs,null);}finally{w.close();}});
test('actual Fish failure keeps the text measurement and marks voice error separately',()=>{const {w,sent}=world();try{const r=w.SESSION_TIME.begin(true,{origin:'wake',recognitionMs:123},1);w.reply('CONTROLLED',true,null,r,'cache');w.__fishStreamEvent(sent[0].id,'error',503);assert.notEqual(r.textMs,null);assert.equal(r.phase,'voice-error');assert.equal(w.chatHist.length,1);assert.equal(w.SESSION_TIME.summary('wake').count,0);}finally{w.close();}});
console.log(`CONVERSATION INTEGRATION: ${pass}/${pass} passed. No phone or live synthesis.`);
