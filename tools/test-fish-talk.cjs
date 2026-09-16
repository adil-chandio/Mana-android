'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync('public/fish-talk.js','utf8');let passed=0;
function test(name,fn){fn();passed++;console.log('PASS '+name);}
function world(provider='groq'){
 let time=0,seq=0;const timers=new Map();
 const s={performance:{now:()=>time},setTimeout(fn,ms){timers.set(++seq,{fn,at:time+ms});return seq;},clearTimeout(id){timers.delete(id);},
  settings:{voiceOn:true,voiceEngine:'auto',stt:'ur-PK',model:'auto',wakeWord:true,autoListen:false,proactive:false,notifSpeak:false},
  MODEL_CACHE:null,MODELS:['gemini-2.5-flash'],listening:false,thinking:false,speaking:false,
  TURNS:{active:null},chatHist:[{role:'user',text:'PRIVATE_OLD_CHAT'}],facts:['PRIVATE_MEMORY'],posts:[],audio:[],events:[],inputs:[],cancelled:[],
  FISH:{block:()=>'',voice:()=> 'SAVED_REFERENCE',key:()=> 'PRIVATE_FISH_KEY',streamPending:null,
    body:t=>JSON.stringify({text:t,reference_id:'SAVED_REFERENCE'}),headers:()=>JSON.stringify({Authorization:'Bearer PRIVATE_FISH_KEY'}),
    speak(){throw Error('legacy output must not be used');}},
  BRAIN:{plan:()=>[{p:{id:provider,url:'https://api.groq.com/openai/v1/chat/completions',models:['saved-model'],keyless:false},ki:0}],keys:()=>['PRIVATE_AI_KEY'],models:{},budget:()=>400,waiting:{}},
  INPUT_SESSION:{active:null,begin(){const a={id:'miinput_'+(++seq)};this.active=a;return a;},matches(id){return !!this.active && this.active.id===id;},stop(){this.active=null;}},
  SUKOON:{sunStart(){},sunEnd(){},bolStart(){},bolEnd(){}},cleanSpeech:t=>t,
  AWAAZ:{speak(){throw Error('no voice ladder');},device(){throw Error('no device voice');}},
  MayaBridge:{fishTalkEvent(id,kind,text){s.events.push({id,kind,text});},listenOwned(lang,id){s.inputs.push({lang,id});},stopListen(){},
    httpPostAsync(url,auth,body,id,ms){s.posts.push({url,auth,body:JSON.parse(body),id,ms});},cancelHttpPost(id){s.cancelled.push(id);},
    fishTalkSpeak(id,turn,body,headers){s.audio.push({id,turn,body:JSON.parse(body),headers});}}
 };
 s.window=s;vm.createContext(s);vm.runInContext(source,s);
 s.advance=ms=>{const end=time+ms;let count=0;while(true){const item=[...timers].filter(x=>x[1].at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!item)break;assert(++count<1000);timers.delete(item[0]);time=item[1].at;item[1].fn();}time=end;};
 s.begin=()=>{const r=JSON.parse(s.FISH_TALK.describe());assert.equal(r.code,'READY');assert(s.FISH_TALK.start('a'.repeat(32),r.review));};
 s.say=text=>{const id=s.inputs.at(-1).id;s.FISH_TALK.ready(id);s.FISH_TALK.began(id);s.FISH_TALK.result(id,text);};
 s.answer=(value='Maya answer',status=200,custom=null)=>{const p=s.posts.at(-1),cb=s.BRAIN.waiting[p.id];assert(cb);cb(status,JSON.stringify(custom||{choices:[{finish_reason:'stop',message:{content:value}}]}));};
 return s;
}
test('startup and description make zero mic/AI/Fish calls and expose no secrets',()=>{const s=world(),d=s.FISH_TALK.describe();assert(!/PRIVATE|SAVED_REFERENCE/.test(d));assert.equal(s.inputs.length+s.posts.length+s.audio.length,0);});
test('one start permits speech to AI to exact Fish and then next input without Send/Sunao',()=>{
 const s=world();s.begin();s.say('hello');assert.equal(s.posts.length,1);s.answer();assert.equal(s.audio.length,1);assert.equal(s.audio[0].body.reference_id,'SAVED_REFERENCE');
 s.FISH_TALK.audioEvent('a'.repeat(32),1,'playing',200);s.advance(45000);s.FISH_TALK.audioEvent('a'.repeat(32),1,'done',200);s.advance(599);assert.equal(s.inputs.length,1);s.advance(1);assert.equal(s.inputs.length,2);
 s.say('follow up');assert.equal(s.posts.length,2);assert.equal(s.posts[1].body.messages.length,4);
});
test('voice request contains only session context and no tools or saved memories',()=>{const s=world();s.begin();s.say('open bank and transfer money');const p=s.posts[0];assert(!p.body.tools);assert(!/PRIVATE_OLD_CHAT|PRIVATE_MEMORY/.test(JSON.stringify(p.body)));assert.equal(p.body.max_tokens,400);assert.equal(s.audio.length,0);});
test('existing reasoning budget is preserved, not increased or confused with Direct token cap',()=>{const s=world();s.BRAIN.budget=()=>1400;s.begin();s.say('question');assert.equal(s.posts[0].body.max_tokens,1400);});
test('Gemini uses existing model and one tool-free request',()=>{const s=world('gemini');s.begin();s.say('hello');const p=s.posts[0];assert(p.url.includes('/gemini-2.5-flash:generateContent'));assert.equal(p.body.generationConfig.maxOutputTokens,280);assert(!p.body.tools);s.answer('',200,{candidates:[{finishReason:'STOP',content:{parts:[{text:'answer'}]}}]});assert.equal(s.audio.length,1);});
test('no configured account means no keyless or provider fallback',()=>{const s=world();s.BRAIN.plan=()=>[{p:{id:'pollen',keyless:true},ki:0}];assert.equal(JSON.parse(s.FISH_TALK.describe()).code,'AI');assert.equal(s.posts.length,0);});
test('configuration change after review rejects Start before recording',()=>{const s=world(),r=JSON.parse(s.FISH_TALK.describe());s.FISH.voice=()=> 'CHANGED';assert.equal(s.FISH_TALK.start('a'.repeat(32),r.review),false);assert.equal(s.inputs.length,0);});
test('review expires and cannot be replayed',()=>{const s=world(),r=JSON.parse(s.FISH_TALK.describe());s.advance(60001);assert.equal(s.FISH_TALK.start('a'.repeat(32),r.review),false);s.begin();assert.equal(s.FISH_TALK.start('b'.repeat(32),r.review),false);});
test('duplicate or wrong-owner transcripts do not send twice',()=>{const s=world();s.begin();const id=s.inputs[0].id;s.FISH_TALK.result('wrong','wrong');s.say('hi');s.FISH_TALK.result(id,'duplicate');assert.equal(s.posts.length,1);});
test('STOP cancels pending request and a late response never speaks',()=>{const s=world();s.begin();s.say('hi');const cb=s.BRAIN.waiting[s.posts[0].id];s.FISH_TALK.stop('a'.repeat(32));cb(200,JSON.stringify({choices:[{finish_reason:'stop',message:{content:'late'}}]}));assert.equal(s.audio.length,0);assert.equal(s.cancelled.length,1);});
test('no-match/timeout has no recorder retry loop',()=>{const s=world();s.begin();s.FISH_TALK.ready(s.inputs[0].id);s.advance(15001);assert(!s.FISH_TALK.active());assert.equal(s.inputs.length,1);assert.equal(s.posts.length,0);});
test('provider failure never changes provider or output voice',()=>{const s=world();s.begin();s.say('hi');s.answer('',429);s.advance(1000);assert.equal(s.posts.length,1);assert.equal(s.audio.length,0);assert(!s.FISH_TALK.active());});
test('tools, truncated answers and reasoning traces are rejected without action or speech',()=>{for(const payload of [{choices:[{finish_reason:'tool_calls',message:{tool_calls:[{function:{name:'send_sms'}}]}}]},{choices:[{finish_reason:'length',message:{content:'partial'}}]},{choices:[{finish_reason:'stop',message:{content:'<think>private</think>'}}]}]){const s=world();s.begin();s.say('question');s.answer('',200,payload);assert.equal(s.audio.length,0);assert(!s.FISH_TALK.active());}});
test('changed Fish reference while AI waits does not speak in another voice',()=>{const s=world();s.begin();s.say('hi');s.FISH.voice=()=> 'other';s.answer();assert.equal(s.audio.length,0);assert(!s.FISH_TALK.active());});
test('Fish failure retains displayed answer and never invokes device TTS',()=>{const s=world();s.begin();s.say('hi');s.answer();s.FISH_TALK.audioEvent('a'.repeat(32),1,'error',402);assert(!s.FISH_TALK.active());assert(s.events.some(e=>e.kind==='assistant' && e.text==='Maya answer'));assert.equal(s.audio.length,1);});
test('old/doubled audio completion cannot start additional listening',()=>{const s=world();s.begin();s.say('hi');s.answer();s.FISH_TALK.audioEvent('a'.repeat(32),2,'done');assert.equal(s.inputs.length,1);s.FISH_TALK.audioEvent('a'.repeat(32),1,'done');s.FISH_TALK.audioEvent('a'.repeat(32),1,'done');s.advance(600);assert.equal(s.inputs.length,2);});
test('five-minute session ceiling also interrupts long output',()=>{const s=world();s.begin();s.say('hi');s.answer();s.advance(300001);assert(!s.FISH_TALK.active());assert.equal(s.inputs.length,1);});
test('session ends after five answers instead of evicting or uploading older context',()=>{const s=world();s.begin();for(let i=1;i<=5;i++){s.say('q');s.answer('a');s.FISH_TALK.audioEvent('a'.repeat(32),i,'done');s.advance(600);}assert.equal(s.posts.length,5);assert(!s.FISH_TALK.active());});
test('spoken STOP ends only this conversation and sends no AI request',()=>{const s=world();s.begin();s.say('bas karo');assert.equal(s.posts.length,0);assert(!s.FISH_TALK.active());});
test('model mismatch and paid OpenRouter model are refused, no discovery',()=>{const s=world('openrouter');s.BRAIN.plan=()=>[{p:{id:'openrouter',url:'https://openrouter.ai/api/v1/chat/completions',models:['paid-model']},ki:0}];assert.equal(JSON.parse(s.FISH_TALK.describe()).code,'AI');assert.equal(s.posts.length,0);});
test('typed config read is independent of Fish, input language and microphone',()=>{
 const s=world();s.FISH.block=()=> 'KEY_MISSING';s.settings.voiceOn=false;s.settings.stt='unsupported';
 const c=JSON.parse(s.FISH_TALK.chatConfig());assert.equal(c.code,'READY');assert.equal(c.provider,'groq');
 assert.equal(c.key,'PRIVATE_AI_KEY');assert(!('fishKey' in c));assert(!('voice' in c));
 assert.equal(s.inputs.length+s.posts.length+s.audio.length,0);
});
test('typed and spoken preflights choose the same configured account/model without requests',()=>{
 const s=world();const typed=JSON.parse(s.FISH_TALK.chatConfig()),talk=JSON.parse(s.FISH_TALK.describe());
 assert.equal(typed.provider,talk.provider);assert.equal(typed.model,talk.model);assert.equal(typed.tokens,talk.tokens);
 assert.equal(s.posts.length,0);
});
test('typed config has no keyless fallback when saved account is absent',()=>{
 const s=world();s.BRAIN.plan=()=>[];assert.equal(JSON.parse(s.FISH_TALK.chatConfig()).code,'AI');assert.equal(s.posts.length,0);
});
test('empty or null tool fields are plain answers but real tool calls are denied',()=>{
 for(const calls of [[],null]) {const s=world();s.begin();s.say('hi');s.answer('',200,{choices:[{finish_reason:'stop',message:{role:'assistant',content:'normal answer',tool_calls:calls,function_call:null}}]});assert.equal(s.audio.length,1);}
 const s=world();s.begin();s.say('hi');s.answer('',200,{choices:[{finish_reason:'stop',message:{content:'unsafe',tool_calls:[{}]}}]});assert.equal(s.audio.length,0);
});
test('speech beginning before ready does not rearm silence but still has a hard ceiling',()=>{
 const s=world();s.begin();const id=s.inputs[0].id;s.FISH_TALK.began(id);s.FISH_TALK.ready(id);s.advance(15001);assert(s.FISH_TALK.active());s.advance(5000);assert(!s.FISH_TALK.active());assert.equal(s.inputs.length,1);
});
test('quarantined saved flags cannot block Talk or reactivate old features',()=>{
 const s=world();s.MayaBridge.legacyRestricted=()=>true;s.settings.autoListen=true;s.settings.proactive=true;s.settings.notifSpeak=true;
 s.begin();assert.equal(s.inputs.length,1);assert.equal(s.posts.length,0);assert(s.settings.proactive);
});
test('input language and permission failures retain fixed useful causes',()=>{
 for(const code of [12,13,9]) {const s=world();s.begin();s.FISH_TALK.error(s.inputs[0].id,code);const msg=s.events.at(-1).text;assert(msg.includes(code===9?'permission':'language/model'));assert(!s.FISH_TALK.active());assert.equal(s.posts.length,0);}
});
test('multiple choices or wrong roles never become speech',()=>{
 for(const payload of [{choices:[{finish_reason:'stop',message:{content:'one'}},{finish_reason:'stop',message:{content:'two'}}]},{choices:[{finish_reason:'stop',message:{role:'system',content:'wrong'}}]}]) {const s=world();s.begin();s.say('hi');s.answer('',200,payload);assert.equal(s.audio.length,0);}
});
test('approved Wake waits without sending, then question goes straight to AI and Fish',()=>{
 const s=world(),r=JSON.parse(s.FISH_TALK.describe());assert(s.FISH_TALK.start('a'.repeat(32),r.review,true));
 assert.equal(s.inputs.length,0);assert.equal(s.posts.length,0);s.advance(61000);
 s.FISH_TALK.wake('a'.repeat(32),'wake question');assert.equal(s.posts.length,1);assert.equal(s.posts[0].body.messages.at(-1).content,'wake question');
 s.answer('Fish answer');assert.equal(s.audio.length,1);assert.equal(s.audio[0].body.reference_id,'SAVED_REFERENCE');
 s.FISH_TALK.audioEvent('a'.repeat(32),1,'done',200);s.advance(600);assert.equal(s.inputs.length,1);
 s.say('follow up without Maya');assert.equal(s.posts.length,2);
});
test('bare Wake captures the following sentence once, not an extra consent loop',()=>{
 const s=world(),r=JSON.parse(s.FISH_TALK.describe());s.FISH_TALK.start('a'.repeat(32),r.review,true);
 s.FISH_TALK.wake('a'.repeat(32),'');assert.equal(s.inputs.length,1);assert.equal(s.posts.length,0);
 s.FISH_TALK.wake('a'.repeat(32),'duplicate');assert.equal(s.inputs.length,1);assert.equal(s.posts.length,0);
 s.say('my question');assert.equal(s.posts.length,1);
});
test('unowned duplicate or cancelled Wake cannot submit an AI question',()=>{
 const s=world(),r=JSON.parse(s.FISH_TALK.describe());s.FISH_TALK.start('a'.repeat(32),r.review,true);
 s.FISH_TALK.wake('b'.repeat(32),'wrong');assert.equal(s.posts.length,0);
 s.FISH_TALK.wake('a'.repeat(32),'first');s.FISH_TALK.wake('a'.repeat(32),'duplicate');assert.equal(s.posts.length,1);
 s.FISH_TALK.stop('a'.repeat(32));s.FISH_TALK.wake('a'.repeat(32),'late');assert.equal(s.posts.length,1);
});
test('Wake waiting remains bounded and a stop command does not call the model',()=>{
 const s=world(),r=JSON.parse(s.FISH_TALK.describe());s.FISH_TALK.start('a'.repeat(32),r.review,true);s.advance(300001);
 s.FISH_TALK.wake('a'.repeat(32),'late');assert.equal(s.posts.length,0);assert(!s.FISH_TALK.active());
 const t=world(),review=JSON.parse(t.FISH_TALK.describe());t.FISH_TALK.start('a'.repeat(32),review.review,true);t.FISH_TALK.wake('a'.repeat(32),'bas karo');assert.equal(t.posts.length,0);assert(!t.FISH_TALK.active());
});
assert.equal(source,fs.readFileSync('app/src/main/assets/web/fish-talk.js','utf8'));
assert(!/handleUserText\(|execTool\(|geminiChat\(|localStorage|sessionStorage|chatHist|saveSettings\(|AWAAZ\.speak|AWAAZ\.device|TextToSpeech|SpeechSynthesis/.test(source));
console.log(`FISH TALK: ${passed}/${passed} passed. Synthetic transports only; no microphone/provider/Fish calls.`);
