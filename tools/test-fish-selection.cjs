#!/usr/bin/env node
'use strict';
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const path = require('node:path'), { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..'); process.chdir(root);
const html = fs.readFileSync('public/index.html', 'utf8');
const source = fs.readFileSync('tools/test-voice-engine.js', 'utf8');
const fixture = { require:createRequire(root+'/package.json'), __dirname, console, Buffer, setTimeout, clearTimeout };
vm.createContext(fixture); vm.runInContext(source.slice(0,source.indexOf('(async function run()')),fixture);
const tests=[];function test(name,run){tests.push({name,run});}
function world(saved={fishVoice:'saved-id',fishVoiceName:'Chosen Hindi voice'}) {
  const sent=[];
  const {w,state}=fixture.makeWorld({native:true,settings:{voiceEngine:'fish',fishKey:'TEST_ONLY',...saved},bridge:{httpBytes(){throw Error('No live request');},fishStreamSpeak(body,headers,id){sent.push({body:JSON.parse(body),headers:JSON.parse(headers),id});},fishStreamStop(){}}});
  w.document.body.innerHTML='<div id="tab-home"></div><div id="tab-chat"></div><div id="grp-voice"><select id="sFishVoice"></select><div id="fishHint"></div><button id="fishLib">Library</button><button id="fishPyari">Search</button><button id="fishTest">Test</button><button id="fishDoctor">Doctor</button><div id="fishDocOut"></div></div>';
  w.$=s=>w.document.querySelector(s);w.toast=()=>{};w.setOrb=()=>{};w.SUKOON={bolStart(){},bolEnd(){}};
  w.saveSettings=()=>w.localStorage.setItem('maya_settings',JSON.stringify(w.settings));
  w.eval(html.slice(html.indexOf('function fishFillVoices(){'),html.indexOf('/* ---------- BRAIN POOL ka live')));
  w.eval(html.slice(html.indexOf('/* ═══ 🐟 FISH — library'),html.indexOf('/* ═══ 🌊 EDGE AWAAZ SUNO')));
  return {w,state,sent};
}
test('empty/default choice is a disabled setup placeholder, never selectable random voice',()=>{
  const {w}=world({fishVoice:'',fishVoiceName:''});try{w.fishFillVoices();const p=w.$('#sFishVoice').options[0];assert.equal(p.value,'');assert.equal(p.disabled,true);assert.doesNotMatch(p.textContent,/Fish khud chunta/);}finally{w.close();}
});
test('saved reference and title survive a library that no longer contains them',()=>{
  const {w}=world();try{w.FISH.lib=[{id:'other',title:'Different voice'}];w.fishFillVoices();assert.equal(w.$('#sFishVoice').value,'saved-id');assert.match(w.$('#sFishVoice').selectedOptions[0].textContent,/Chosen Hindi/);assert.equal(w.settings.fishVoice,'saved-id');}finally{w.close();}
});
test('blank settings cannot inherit an unrelated stale DOM selection',()=>{
  const {w}=world({fishVoice:'',fishVoiceName:''});try{w.$('#sFishVoice').innerHTML='<option value="stale">stale</option>';w.fishFillVoices();assert.equal(w.$('#sFishVoice').value,'');assert.equal(w.settings.fishVoice,'');}finally{w.close();}
});
test('missing ID is not ready on streaming or buffered transport',()=>{
  const {w}=world({fishVoice:'',fishVoiceName:''});try{assert.equal(w.FISH.ready(),false);assert.equal(w.FISH.block(),'VOICE_MISSING');delete w.MayaBridge.fishStreamSpeak;assert.equal(w.FISH.block(),'VOICE_MISSING');}finally{w.close();}
});
test('Test synchronizes an explicit rendered selection before validating it',()=>{
  const {w,sent}=world({fishVoice:'',fishVoiceName:''});try{w.FISH.lib=[{id:'chosen',title:'Hindi voice'}];w.fishFillVoices();w.$('#sFishVoice').value='chosen';w.$('#fishTest').click();assert.equal(sent.length,1);assert.equal(sent[0].body.reference_id,'chosen');assert.equal(JSON.parse(w.localStorage.getItem('maya_settings')).fishVoice,'chosen');}finally{w.close();}
});
test('Test with an empty/unhydrated picker cannot erase a saved reference',()=>{
  const {w,sent}=world();try{w.$('#fishTest').click();assert.equal(w.settings.fishVoice,'saved-id');assert.equal(sent[0].body.reference_id,'saved-id');}finally{w.close();}
});
test('Doctor uses the saved reference, never a provider-default synthesis',()=>{
  const {w}=world();try{let payload;w.FISH.req=(method,url,h,body)=>{payload=JSON.parse(body);};w.FISH.doctor(()=>{},()=>{});assert.equal(payload.reference_id,'saved-id');}finally{w.close();}
});
test('female and woman tags are not accidentally matched as male/man',()=>{
  const {w}=world();try{assert.equal(w.FISH.MALEISH.test('sweet female woman'),false);assert.equal(w.FISH.MALEISH.test('male man'),true);}finally{w.close();}
});
const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64');
function installReply(w) {
  w.cleanSpeech=s=>s;w.thinking=false;w.listening=false;w.speaking=false;w.chatHist=[];w.persistChat=()=>{};
  w.addBubble=()=>{};w.askAI=()=>{throw Error('Voice retry must not ask AI');};w.execTool=()=>{throw Error('Voice retry must not execute tools');};
  w.eval(html.slice(html.indexOf('function speak(text, wasVoice)'),html.indexOf('/* ---------- TEST VOICE')));
}
function reloadSettings(w) { w.eval(html.slice(html.indexOf('var DEFAULTS ='),html.indexOf('/* ---------- MEMORY ---------- */'))); }
test('current saved voice survives a malformed obsolete legacy settings record',()=>{
  const {w}=world();try{w.localStorage.setItem('maya_settings',JSON.stringify(w.settings));w.localStorage.setItem('jarvisSettings','{broken');reloadSettings(w);assert.equal(w.settings.fishVoice,'saved-id');}finally{w.close();}
});
test('upgrade from legacy settings preserves exact reference, title, and unrelated data',()=>{
  const {w}=world();try{
    const legacy={fishVoice:'legacy_voice-123',fishVoiceName:'Hindi choice',fishKey:'TEST_ONLY',customPreference:'keep'};
    w.localStorage.setItem('jarvisSettings',JSON.stringify(legacy));w.localStorage.setItem('maya_chat','CHAT_SENTINEL');w.localStorage.setItem('maya_facts','FACT_SENTINEL');
    reloadSettings(w);w.fishFillVoices();w.saveSettings();reloadSettings(w);w.fishFillVoices();
    assert.equal(w.settings.fishVoice,legacy.fishVoice);assert.equal(w.settings.fishVoiceName,legacy.fishVoiceName);assert.equal(w.settings.customPreference,'keep');
    assert.equal(w.localStorage.getItem('maya_chat'),'CHAT_SENTINEL');assert.equal(w.localStorage.getItem('maya_facts'),'FACT_SENTINEL');
    assert.equal(w.FISH.voice(),legacy.fishVoice);
  }finally{w.close();}
});
test('an explicit blank current setting cannot silently resurrect an older different voice',()=>{
  const {w}=world();try{w.localStorage.setItem('jarvisSettings',JSON.stringify({fishVoice:'old-other'}));w.localStorage.setItem('maya_settings',JSON.stringify({fishVoice:'',fishVoiceName:''}));reloadSettings(w);w.fishFillVoices();assert.equal(w.settings.fishVoice,'');assert.equal(w.FISH.selection().state,'legacy-or-unset');}finally{w.close();}
});
test('saved display name alone never guesses an ID from matching library names',()=>{
  const {w}=world({fishVoice:'',fishVoiceName:'Hindi voice'});try{w.FISH.lib=[{id:'one',title:'Hindi voice'},{id:'two',title:'Hindi voice'}];w.fishFillVoices();assert.equal(w.FISH.selection().state,'missing-id');assert.equal(w.FISH.voice(),'');assert.match(w.$('#fishHint').textContent,/name alone/);}finally{w.close();}
});
test('malformed saved IDs are retained for diagnosis but never synthesized or coerced',()=>{
  for(const id of ['voice\n',' voice','voice ',201,'v'.repeat(201),{id:'voice'},['voice']]) {
    const {w,sent}=world({fishVoice:id});try{const before=JSON.stringify(w.settings);w.fishFillVoices();let code;w.FISH.speak('sample','warm',()=>{},c=>code=c);assert.equal(code,'VOICE_INVALID');assert.equal(sent.length,0);assert.equal(JSON.stringify(w.settings),before);}finally{w.close();}
  }
});
test('explicit selection is persisted immediately and survives restart without library',()=>{
  const {w}=world();try{w.FISH.lib=[{id:'new-id',title:'Chosen Hindi female'}];w.fishFillVoices();w.$('#sFishVoice').value='new-id';w.$('#sFishVoice').dispatchEvent(new w.Event('change'));w.FISH.lib=null;w.localStorage.removeItem('maya_fishlib');reloadSettings(w);w.fishFillVoices();assert.equal(w.settings.fishVoice,'new-id');assert.equal(w.$('#sFishVoice').value,'new-id');assert.match(w.$('#sFishVoice').selectedOptions[0].textContent,/Chosen Hindi female/);}finally{w.close();}
});
test('storage failure restores previous voice and does not synthesize the unsaved choice',()=>{
  const {w,sent}=world();try{w.saveSettings();const disk=w.localStorage.getItem('maya_settings');w.FISH.lib=[{id:'new',title:'New'}];w.fishFillVoices();w.$('#sFishVoice').value='new';w.saveSettings=()=>{throw Error('QuotaExceeded');};w.$('#fishTest').click();assert.equal(sent.length,0);assert.equal(w.settings.fishVoice,'saved-id');assert.equal(w.settings.fishVoiceName,'Chosen Hindi voice');assert.equal(w.$('#sFishVoice').value,'saved-id');assert.equal(w.localStorage.getItem('maya_settings'),disk);}finally{w.close();}
});
test('Doctor with missing voice makes no default request, and never exposes the configured key',()=>{
  const {w}=world({fishVoice:'',fishVoiceName:''});try{let requests=0,result;w.FISH.req=()=>requests++;w.FISH.doctor(()=>{},r=>result=r);assert.equal(requests,0);assert.equal(result.verdict,'VOICE_MISSING');assert.equal(result.ok,false);assert.doesNotMatch(result.text,/TEST_ONLY/);}finally{w.close();}
});
test('Doctor does not report JSON/error bytes as audio success',()=>{
  const {w}=world();try{let result;w.FISH.req=(m,u,h,b,cb)=>cb(200,Buffer.alloc(4000).toString('base64'),'application/json','');w.FISH.doctor(()=>{},r=>result=r);assert.equal(result.ok,false);assert.equal(result.verdict,'NO_AUDIO');assert.doesNotMatch(result.text,/TEST_ONLY/);}finally{w.close();}
});
test('library refresh is possible without a voice ID and never auto-selects its first entry',()=>{
  const {w}=world({fishVoice:'',fishVoiceName:''});try{w.FISH.req=(m,u,h,b,cb)=>cb(200,b64({items:[{_id:'first',title:'Hindi female',languages:['hi']}]}),'application/json','');w.$('#fishLib').click();assert.equal(w.$('#fishLib').disabled,false);assert.equal(w.settings.fishVoice,'');assert.equal(w.$('#sFishVoice').value,'');assert.equal(w.$('#sFishVoice').options.length,2);}finally{w.close();}
});
test('a late older library response cannot replace a newer result or the saved reference',()=>{
  const {w}=world();try{const replies=[];w.FISH.req=(m,u,h,b,cb)=>replies.push(cb);w.FISH.library('old',()=>{});w.FISH.library('new',()=>{});replies[1](200,b64({items:[{_id:'new',title:'New'}]}),'application/json','');replies[0](200,b64({items:[{_id:'old',title:'Old'}]}),'application/json','');assert.equal(w.FISH.lib[0].id,'new');assert.equal(w.settings.fishVoice,'saved-id');assert.equal(JSON.parse(w.localStorage.getItem('maya_fishlib'))[0].id,'new');}finally{w.close();}
});
test('ranked multi-search persists its combined list, without changing the selected voice',()=>{
  const {w}=world();try{let i=0;w.FISH.req=(m,u,h,b,cb)=>cb(200,b64({items:[{_id:'voice-'+(++i),title:'Hindi female '+i,languages:['hi']}]}),'application/json','');let list;w.FISH.pyari(l=>list=l);assert.equal(list.length,5);assert.equal(JSON.parse(w.localStorage.getItem('maya_fishlib')).length,5);assert.equal(w.settings.fishVoice,'saved-id');}finally{w.close();}
});
test('STOP while loading the library releases its button and keeps the previous library/voice',()=>{
  const {w}=world();try{w.FISH.lib=[{id:'cached',title:'Cached'}];w.MayaBridge.httpBytes=()=>{};w.$('#fishPyari').click();assert.equal(w.$('#fishPyari').disabled,true);w.AWAAZ.stop();assert.equal(w.$('#fishPyari').disabled,false);assert.equal(w.FISH.lib[0].id,'cached');assert.equal(w.settings.fishVoice,'saved-id');assert.equal(Object.keys(w.FISH.pend).length,0);}finally{w.close();}
});
test('STOP while auditioning re-enables SUNO and late stream events cannot alter the new state',()=>{
  const {w,sent}=world();try{w.fishFillVoices();w.$('#fishTest').click();assert.equal(w.$('#fishTest').disabled,true);const id=sent[0].id;w.AWAAZ.stop();w.thinking=true;w.__fishStreamEvent(id,'done',200);assert.equal(w.$('#fishTest').disabled,false);assert.equal(w.thinking,true);}finally{w.close();}
});
test('a failed Fish reply can retry speech only, with the exact newly selected ID and no duplicate answer',()=>{
  const {w,sent,state}=world({fishVoice:'',fishVoiceName:''});try{installReply(w);w.reply('Original answer',false);const button=[...w.document.querySelectorAll('.voice-notice button')].find(b=>b.textContent==='Retry voice only');assert.ok(button);w.FISH.lib=[{id:'chosen-id',title:'Hindi female'}];w.fishFillVoices();w.$('#sFishVoice').value='chosen-id';w.$('#sFishVoice').dispatchEvent(new w.Event('change'));button.click();button.click();assert.equal(sent.length,1);assert.equal(sent[0].body.reference_id,'chosen-id');assert.match(sent[0].body.text,/Original answer/);assert.equal(sent[0].headers.model,'s2.1-pro-free');assert.equal(w.chatHist.length,1);assert.equal(state.gcalls.length,0);assert.equal(state.deviceSaid.length,0);}finally{w.close();}
});
test('old retry button is invalidated by STOP rather than replaying stale speech',()=>{
  const {w,sent}=world({fishVoice:'',fishVoiceName:''});try{installReply(w);w.reply('old',false);const b=[...w.document.querySelectorAll('.voice-notice button')].find(b=>b.textContent==='Retry voice only');w.AWAAZ.stop();w.settings.fishVoice='chosen';b.click();assert.equal(sent.length,0);}finally{w.close();}
});
test('voice-settings action opens the voice section without changing the reference',()=>{
  const {w}=world();try{installReply(w);let tab;w.showTab=t=>tab=t;w.showVoiceNotice('Test failure');w.$('.voice-notice button').click();assert.equal(tab,'set');assert.equal(w.$('#grp-voice').classList.contains('is-open'),true);assert.equal(w.settings.fishVoice,'saved-id');assert.equal(w.document.activeElement.id,'sFishVoice');}finally{w.close();}
});
(async()=>{let failed=0;for(const t of tests){try{await t.run();console.log('PASS '+t.name);}catch(e){failed++;console.error('FAIL '+t.name+': '+e.message);}}console.log(`FISH SELECTION: ${tests.length-failed}/${tests.length} passed (controlled fixtures, no live synthesis).`);process.exitCode=failed?1:0;})();
