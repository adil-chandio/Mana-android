#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const html = fs.readFileSync('public/index.html', 'utf8');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }
function world() {
  const timers = new Map(); let serial = 0;
  const s = { console, performance: { now: () => 100 },
    settings: { wakeWord: true, autoListen: false, wakeDoor: 15, name: 'Boss', stt: 'ur-PK' },
    speaking: false, thinking: false, listening: false, NATIVE: true, rec: null,
    interimEl: {}, statusText: {}, calls: [], commands: [], bubbles: [],
    setTimeout(fn, ms) { const id = ++serial; timers.set(id, {fn, ms: ms || 0}); return id; },
    clearTimeout(id) { timers.delete(id); },
    flush(maxMs = 1000) { const due = [...timers.entries()].filter(([, t]) => t.ms <= maxMs); due.forEach(([id]) => timers.delete(id)); due.forEach(([, t]) => t.fn()); },
    pushLog() {}, setOrb() {}, ensureAudio() {}, chime() {}, toast() {},
    addBubble(who, text) { s.bubbles.push(text); }, handleUserText(text) { s.commands.push(text); },
    FLAGS: { on: () => true },
    AWAAZ: { gen: 1, deviceDone: null, engine: 'device', stop() { this.gen++; this.deviceDone = null; } },
    SUKOON: { bolEnd() { s.speaking = false; }, sunStart() {}, sunEnd() {} },
    MayaBridge: { listen() { s.calls.push('listen'); }, stopListen() { s.calls.push('stop'); } }
  };
  s.window = s;
  vm.createContext(s);
  vm.runInContext(html.slice(html.indexOf('window.__nativeTtsDone ='), html.indexOf('window.__nativeTtsStatus =')), s);
  vm.runInContext(html.slice(html.indexOf('var KAAN = {'), html.indexOf('window.__wakeErr = function')), s);
  vm.runInContext(html.slice(html.indexOf('function stripWake(t)'), html.indexOf('function handleUserText(text')), s);
  vm.runInContext(html.slice(html.indexOf('function afterSpeak(wasVoice)'), html.indexOf('function reply(text')), s);
  vm.runInContext(html.slice(html.indexOf('var listenTimer = null;'), html.indexOf('/* ---------- ORB / STATUS')), s);
  return s;
}
test('native completion has one owner and opens the microphone once', () => {
  const s = world(); s.KAAN.DARWAZA.open();
  let done = 0; s.AWAAZ.deviceDone = () => { done++; s.afterSpeak(true); };
  s.__nativeTtsDone('done'); s.__nativeTtsDone('done'); s.flush();
  assert.equal(done, 1); assert.deepEqual(s.calls, ['listen']);
});
test('duplicate scheduled starts cannot toggle an already open microphone off', () => {
  const s = world(); s.KAAN.DARWAZA.open();
  s.afterSpeak(true); s.afterSpeak(true); s.flush();
  s.afterSpeak(true); s.flush(); assert.deepEqual(s.calls, ['listen']);
});
test('a new audio generation invalidates a pending microphone start', () => {
  const s = world(); s.KAAN.DARWAZA.open(); s.afterSpeak(true); s.AWAAZ.stop(); s.flush(); assert.equal(s.calls.length, 0);
});
test('manual microphone stop cancels a scheduled restart', () => {
  const s = world(); s.KAAN.DARWAZA.open(); s.afterSpeak(true); s.stopListening(); s.flush(); assert.deepEqual(s.calls, ['stop']);
});
test('old native watchdog cannot end a new Fish utterance', () => {
  const s = world(); let ended = 0;
  s.AWAAZ.deviceDone = () => ended++; s.__nativeTtsWatch(12000);
  s.AWAAZ.gen++; s.AWAAZ.engine = 'fish'; s.flush(12000); assert.equal(ended, 0);
});
test('bare Roman, Urdu and Hindi wake words listen, not execute a command', () => {
  for (const word of ['Maya', 'مایا', 'माया', 'Hey Maya!']) {
    const s = world(); s.__wakeHeard(JSON.stringify([word])); s.flush();
    assert.deepEqual(s.commands, []); assert.deepEqual(s.calls, ['listen']);
  }
});
test('wake prefix requires a whole word, never a substring', () => {
  const s = world();
  for (const text of ['mayonnaise', 'mayank', 'bossanova', 'chalo Maya', 'hello mayank']) assert.equal(s.KAAN.atStart(text), false, text);
});
test('wake plus command strips the same multilingual prefix it matched', () => {
  for (const text of ['Maya weather', 'مایا weather', 'माया weather', 'hey Maya, weather']) {
    const s = world(); s.__wakeHeard(JSON.stringify([text])); assert.deepEqual(s.commands, ['weather']);
  }
});
test('bare wake works with follow-up window disabled', () => {
  const s = world(); s.settings.wakeDoor = 0; s.__wakeHeard('["Maya"]'); s.flush(); assert.deepEqual(s.calls, ['listen']);
});
test('disabling wake invalidates its pending explicit handoff', () => {
  const s = world(); s.__wakeHeard('["Maya"]'); s.settings.wakeWord = false; s.flush(); assert.equal(s.calls.length, 0);
});
test('wake OFF rejects late service results before any command or microphone handoff', () => {
  const s = world(); s.settings.wakeWord = false;
  s.__wakeHeard('["Maya weather"]'); s.__wakeHeard('["Maya"]'); s.flush();
  assert.deepEqual(s.commands, []); assert.deepEqual(s.calls, []);
});
test('spoken replies and in-flight thinking cannot self-trigger wake', () => {
  for (const busy of ['speaking', 'thinking', 'listening']) { const s = world(); s[busy] = true; s.__wakeHeard('["Maya weather"]'); assert.equal(s.commands.length, 0); }
});
// Source wiring guards supplement, but do not replace, Android playback testing.
test('Media3 automatic focus uses media usage with speech content', () => {
  const player = fs.readFileSync('app/src/main/java/com/maya/ai/voice/FishStreamPlayer.kt', 'utf8');
  assert.match(player, /setUsage\(C.USAGE_MEDIA\)/);
  assert.match(player, /setContentType\(C.AUDIO_CONTENT_TYPE_SPEECH\)/);
  assert.match(player, /DefaultLoadErrorHandlingPolicy\(0\)/);
  assert.match(player, /instanceFollowRedirects = false/);
  assert.match(player, /opened.compareAndSet\(false, true\)/);
});
test('wake cannot resume over an active Fish stream or discard its first syllable', () => {
  const wake = fs.readFileSync('app/src/main/java/com/maya/ai/WakeWordService.kt', 'utf8');
  assert.match(wake, /if \(fishOutputActive\) return/);
  assert.match(wake, /private fun vadEnabled\(\): Boolean = false/);
  assert.match(wake, /session != recognitionGeneration \|\| delivered/);
  assert.match(wake, /haalBlock\(\) == null && !recognitionActive/);
});
console.log(`VOICE SESSION TESTS PASS — ${passed}/${passed}. Mocked JS lifecycle, not device recognition.`);
