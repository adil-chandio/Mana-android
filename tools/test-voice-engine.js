#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   tools/test-voice-engine.js — AWAAZ ENGINE v6 ka saboot
   ------------------------------------------------------------------------
   Asli engine code public/index.html se nikal kar jsdom mein chalta hai,
   XHR/Audio/Blob naqli hain. Jo bug v4.1.0 tak chhupa raha (raw PCM bina WAV
   header ke) wo ab test ke bina paas nahi ho sakta.

     node tools/test-voice-engine.js
   ════════════════════════════════════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');

let pass = 0, fail = 0;
const is = (cond, name, info) => {
  if (cond) { pass++; console.log('  \x1b[32m✅\x1b[0m ' + name + (info ? '  \x1b[2m— ' + info + '\x1b[0m' : '')); }
  else { fail++; console.log('  \x1b[31m❌\x1b[0m ' + name + (info ? '  \x1b[33m— ' + info + '\x1b[0m' : '')); }
};
const head = (t) => console.log('\n\x1b[1m' + t + '\x1b[0m');

/* ─────────────── engine source nikaalo ─────────────── */
const A = HTML.indexOf('var GEMINI_VOICES = [');
const B = HTML.indexOf('function geminiTTS_stop()');
if (A < 0 || B < 0 || B < A) { console.error('AWAAZ engine source nahi mila — index.html badal gaya?'); process.exit(1); }
const ENGINE = HTML.slice(A, B);

/* 🌊 EDGE TTS ka hissa alag hai (geminiTTS_stop ke baad shuru hota hai) */
const EA = HTML.indexOf('var EDGE_TTS = {');
const EB = HTML.indexOf('var FISH = {');
if (EA < 0 || EB < 0 || EB < EA) { console.error('EDGE TTS source nahi mila — index.html badal gaya?'); process.exit(1); }
const EDGE = HTML.slice(EA, EB);

/* 🐟 FISH AUDIO ka hissa (EDGE ke baad, PUBLIC API se pehle) */
const FA = HTML.indexOf('var FISH = {');
const FB = HTML.indexOf('/* ---------- PUBLIC API: poori app sirf isi se bolti hai ---------- */');
if (FA < 0 || FB < 0 || FB < FA) { console.error('FISH source nahi mila — index.html badal gaya?'); process.exit(1); }
const FISHSRC = HTML.slice(FA, FB);

/* ─────────────── naqli duniya ─────────────── */
function makeWorld(opts = {}) {
  const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'dangerously', url: 'https://appassets.androidplatform.net/' });
  const w = dom.window;

  const state = {
    calls: [],          /* har XHR */
    gcalls: [],         /* sirf Google Gemini TTS */
    freecalls: [],      /* keyless muft neural */
    blobs: [],          /* har createObjectURL(Blob) */
    played: [],         /* har audio src */
    logs: [],
    deviceSaid: [],
    respond: opts.respond || (() => ({ status: 200, body: okBody() }))
  };

  w.settings = Object.assign({
    voiceOn: true, voiceEngine: 'auto', apikey: 'KEY-123', ttsKey: '',
    gVoice: 'Kore', voiceMood: 'auto', persona: 'maya',
    neuralWifiOnly: false, neuralMaxChars: 1400, edgeTTS: false,
    tts: 'ur-PK', rate: 1, pitch: 1.05, voiceName: '', name: 'Boss'
  }, opts.settings || {});

  w.NATIVE = !!opts.native;
  if (opts.bridge) w.MayaBridge = opts.bridge;
  w.pushLog = (m) => state.logs.push(m);
  w.paintAwaaz = () => {};
  w.pickVoice = () => null;
  w.voices = [];
  w.synth = {
    cancel() {},
    speak(u) { state.deviceSaid.push(u.text); setTimeout(() => u.onend && u.onend(), 0); }
  };
  w.SpeechSynthesisUtterance = function (t) { this.text = t; };

  /* Blob ko lapet lo taake bytes har jsdom version par mil jayen */
  const RealBlob = w.Blob;
  w.Blob = function (parts, o) { const b = new RealBlob(parts, o); try { b.__parts = parts; } catch (e) {} return b; };

  /* URL.createObjectURL — Blob ke bytes pakar lo */
  let n = 0;
  w.URL.createObjectURL = function (blob) {
    const url = 'blob:fake/' + (++n);
    state.blobs.push({ url, type: blob.type, blob });
    return url;
  };
  w.URL.revokeObjectURL = function () {};

  /* Audio — src set hote hi bajta hai aur khatam ho jata hai */
  w.Audio = function () {
    const self = this;
    this.onended = null; this.onerror = null;
    this._src = '';
    Object.defineProperty(this, 'src', {
      get() { return self._src; },
      set(v) { self._src = v; state.played.push(v); }
    });
    this.pause = function () { self.paused = true; };
    this.play = function () {
      return { catch() {} , then() {} , _p: setTimeout(() => { if (!self.paused && self.onended) self.onended(); }, 1) };
    };
  };

  /* XMLHttpRequest */
  w.XMLHttpRequest = function () {
    const self = this;
    this.headers = {}; this.status = 0; this.responseText = '';
    this.open = (m, u) => { self.method = m; self.url = u; };
    this.setRequestHeader = (k, v) => { self.headers[k.toLowerCase()] = v; };
    this.abort = () => { self.aborted = true; clearTimeout(self._t); };
    this.send = function (body) {
      self.body = body;
      try { self.json = JSON.parse(body); } catch (e) { self.json = null; }
      state.calls.push(self);
      if (/generativelanguage/.test(self.url || '')) state.gcalls.push(self);
      else state.freecalls.push(self);
      self._t = setTimeout(function () {
        if (self.aborted) return;
        const r = state.respond(self, state.calls.length);
        if (r.timeout) { self.ontimeout && self.ontimeout(); return; }
        if (r.neterr) { self.onerror && self.onerror(); return; }
        self.status = r.status;
        self.responseText = typeof r.body === 'string' ? r.body : JSON.stringify(r.body);
        self.onload && self.onload();
      }, 1);
    };
  };

  w.eval(ENGINE);
  w.eval(EDGE);          /* 🌊 Edge TTS — asli app jaisa, alag se nahi */
  w.eval(FISHSRC);       /* 🐟 Fish Audio */
  return { w, state, AWAAZ: w.AWAAZ, EDGE_TTS: w.EDGE_TTS, FISH: w.FISH };
}

/* 24 kHz mono s16le ke 100 samples */
function pcmB64(samples = 100) {
  const buf = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) buf.writeInt16LE((i * 300) % 30000 - 15000, i * 2);
  return buf.toString('base64');
}
function okBody(rate = 24000, b64 = pcmB64()) {
  return { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;codec=pcm;rate=' + rate, data: b64 } }] } }] };
}
const wait = (ms = 12) => new Promise(r => setTimeout(r, ms));
const bytesOf = async (blob) => {
  if (blob.__parts && blob.__parts[0]) return new Uint8Array(blob.__parts[0]);
  if (typeof blob.arrayBuffer === 'function') return new Uint8Array(await blob.arrayBuffer());
  throw new Error('blob bytes nahi mile');
};
const str = (b, o, n) => String.fromCharCode.apply(null, Array.from(b.slice(o, o + n)));
const u32 = (b, o) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24);
const u16 = (b, o) => b[o] | (b[o + 1] << 8);

(async function run() {
  console.log('\n\x1b[1m\x1b[35m══════════════════════════════════════════════════════════\x1b[0m');
  console.log('\x1b[1m  🎙️  AWAAZ ENGINE v6 — SABOOT\x1b[0m');
  console.log('\x1b[1m\x1b[35m══════════════════════════════════════════════════════════\x1b[0m');

  /* ─── 1. WAV HEADER (asal bug) ─── */
  head('1. WAV HEADER — wahi bug jisne neural awaaz mardi thi');
  {
    const { AWAAZ } = makeWorld();
    const pcm = new Uint8Array(200);
    const wav = AWAAZ.wav(pcm, 24000, 1, 16);
    is(wav.length === 244, 'header 44 bytes + PCM', wav.length + ' bytes');
    is(str(wav, 0, 4) === 'RIFF', 'RIFF magic');
    is(str(wav, 8, 4) === 'WAVE', 'WAVE type');
    is(str(wav, 12, 4) === 'fmt ', 'fmt  chunk');
    is(str(wav, 36, 4) === 'data', 'data chunk');
    is(u32(wav, 4) === 236, 'RIFF size = 36 + data', String(u32(wav, 4)));
    is(u16(wav, 20) === 1, 'format = 1 (PCM)');
    is(u16(wav, 22) === 1, 'channels = 1 (mono)');
    is(u32(wav, 24) === 24000, 'sample rate 24000', String(u32(wav, 24)));
    is(u32(wav, 28) === 48000, 'byte rate = rate × 2', String(u32(wav, 28)));
    is(u16(wav, 32) === 2, 'block align = 2');
    is(u16(wav, 34) === 16, 'bits = 16');
    is(u32(wav, 40) === 200, 'data size = PCM length', String(u32(wav, 40)));
    is(AWAAZ.rateOf('audio/L16;codec=pcm;rate=16000') === 16000, 'rate mime se parhi jati hai (hard-code nahi)');
    is(AWAAZ.rateOf('audio/L16') === 24000, 'rate na ho to 24000 default');
    const w2 = AWAAZ.wav(new Uint8Array(10), 16000, 1, 16);
    is(u32(w2, 24) === 16000, '16 kHz par header bhi 16 kHz kehta hai');
  }

  /* ─── 2. GEMINI REQUEST ─── */
  head('2. GEMINI REQUEST — jo Google ko bheja jata hai');
  {
    const { AWAAZ, state } = makeWorld({ settings: { gVoice: 'Puck', voiceMood: 'cheerful' } });
    AWAAZ.speak('Salam Boss', {});
    await wait(20);
    const c = state.calls[0];
    is(!!c, 'ek request gayi', String(state.calls.length));
    is(c.method === 'POST', 'POST hai');
    is(/generativelanguage\.googleapis\.com\/v1beta\/models\/.+:generateContent$/.test(c.url), 'sahi endpoint', c.url.replace(/^.*models\//, 'models/'));
    is(c.headers['x-goog-api-key'] === 'KEY-123', 'key header mein hai (URL mein nahi)');
    is(c.url.indexOf('KEY-123') < 0, 'key URL mein leak nahi hoti');
    const g = c.json.generationConfig;
    is(JSON.stringify(g.responseModalities) === '["AUDIO"]', 'responseModalities = ["AUDIO"]');
    is(g.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName === 'Puck', 'chuni hui awaaz jati hai', 'Puck');
    const txt = c.json.contents[0].parts[0].text;
    is(/cheerful/i.test(txt), 'mood prompt saath jata hai');
    is(txt.indexOf('Salam Boss') >= 0, 'asal matn bhi jata hai');
  }

  /* ─── 3. PCM → WAV → PLAY (end to end) ─── */
  head('3. END-TO-END — PCM aata hai, WAV bajta hai');
  {
    const { AWAAZ, state } = makeWorld();
    let done = false;
    AWAAZ.speak('Test jumla', { onDone: () => { done = true; } });
    await wait(30);
    is(state.blobs.length === 1, 'ek blob bana', String(state.blobs.length));
    is(state.blobs[0].type === 'audio/wav', 'blob ka type audio/wav hai (raw PCM nahi!)', state.blobs[0].type);
    const b = await bytesOf(state.blobs[0].blob);
    is(str(b, 0, 4) === 'RIFF' && str(b, 8, 4) === 'WAVE', 'blob ke andar sach much WAV hai');
    is(b.length === 44 + 200, 'blob = header + poora PCM', b.length + ' bytes');
    is(state.played.length === 1 && state.played[0] === state.blobs[0].url, 'wahi blob play hua');
    is(done, 'onDone chala');
    is(AWAAZ.engine === 'neural', 'engine = neural', AWAAZ.engine);
    is(AWAAZ.err === '', 'koi error nahi');
  }

  /* ─── 4. MOOD / PERSONA ─── */
  head('4. MOOD — persona ke mutabiq andaaz');
  {
    for (const [persona, want] of [['maya', 'warm'], ['friday', 'pro'], ['venom', 'funny']]) {
      const { AWAAZ } = makeWorld({ settings: { persona, voiceMood: 'auto' } });
      is(AWAAZ.moodId() === want, 'persona ' + persona + ' → mood ' + want, AWAAZ.moodId());
    }
    const { AWAAZ } = makeWorld({ settings: { persona: 'maya', voiceMood: 'whisper' } });
    is(AWAAZ.moodId() === 'whisper', 'user ka chuna mood persona ko harata hai');
    is(/whisper/i.test(AWAAZ.prompt('hello', 'whisper')), 'whisper ka prompt bharta hai');
    is(/Urdu/.test(AWAAZ.prompt('السلام علیکم', 'warm')), 'Urdu matn par zubaan ka ishara jata hai');
    is(/Hindi/.test(AWAAZ.prompt('नमस्ते', 'warm')), 'Hindi matn par zubaan ka ishara jata hai');
  }

  /* ─── 5. VOICE LIST ─── */
  head('5. AWAAZEIN — 30 prebuilt');
  {
    const { w, AWAAZ } = makeWorld();
    const V = w.GEMINI_VOICES;
    is(V.length === 30, '30 awaazein maujood', String(V.length));
    is(new Set(V.map(v => v.id)).size === 30, 'har id alag hai');
    is(V.every(v => v.label && (v.g === 'f' || v.g === 'm')), 'har awaaz ka label + gender hai');
    is(V.some(v => v.id === 'Kore') && V.some(v => v.id === 'Puck') && V.some(v => v.id === 'Charon'), 'jaani-pehchani awaazein shamil hain');
    const bad = makeWorld({ settings: { gVoice: 'KoiFakeAwaaz' } });
    is(bad.AWAAZ.voiceId() === 'Kore', 'ghalat awaaz par Kore par gir jata hai');
    is(w.VOICE_MOODS.length >= 8, '8+ mood', String(w.VOICE_MOODS.length));
  }

  /* ─── 6. CACHE ─── */
  head('6. CACHE — wahi jumla dobara = 0 request');
  {
    const { AWAAZ, state } = makeWorld();
    AWAAZ.speak('Bilkul wahi jumla', {});
    await wait(25);
    const first = state.calls.length;
    AWAAZ.speak('Bilkul wahi jumla', {});
    await wait(25);
    is(first === 1 && state.calls.length === 1, 'doosri dafa koi request nahi gayi', state.calls.length + ' calls');
    is(AWAAZ.cacheHits === 1, 'cache hit gina gaya', String(AWAAZ.cacheHits));
    is(state.played.length === 2, 'phir bhi dono dafa awaaz baji', String(state.played.length));
    AWAAZ.speak('Naya alag jumla', {});
    await wait(25);
    is(state.calls.length === 2, 'naye jumle par nayi request');
  }

  /* ─── 7. CHUNKING ─── */
  head('7. CHUNKING — lamba jawab tukron mein, bina khamoshi');
  {
    const { AWAAZ } = makeWorld();
    const long = ('Ye ek lamba jumla hai jo bar bar dohraya ja raha hai. ').repeat(30);
    const parts = AWAAZ.chunks(long, 420);
    is(parts.length > 1, 'lamba matn toota', parts.length + ' tukre');
    is(parts.every(p => p.length <= 420), 'har tukra hadd ke andar', 'max ' + Math.max(...parts.map(p => p.length)));
    is(parts.join(' ').replace(/\s+/g, ' ').trim() === long.replace(/\s+/g, ' ').trim(), 'ek lafz bhi zaya nahi hua');
    is(AWAAZ.chunks('Chhota jumla.', 420).length === 1, 'chhota matn nahi toota');
    is(AWAAZ.chunks('', 420).length === 0, 'khaali matn = 0 tukre');
    const one = AWAAZ.chunks('x'.repeat(1000), 420);
    is(one.every(p => p.length <= 420), 'bina space wala bara matn bhi tootta hai', one.length + ' tukre');
  }
  {
    const { AWAAZ, state } = makeWorld();
    /* har jumla alag rakho warna cache khud hi kaam kar jayega */
    let long = '';
    for (let i = 0; i < 15; i++) long += 'Ye jumla number ' + i + ' hai aur is mein kuch alag alfaz hain jaise ' + 'x'.repeat(20 + i) + '. ';
    AWAAZ.speak(long, {});
    await wait(120);
    const expect = AWAAZ.chunkPlan(long).length;
    is(expect >= 2, 'matn tukron mein toota', expect + ' tukre');
    is(state.played.length === expect, 'har tukra baja', state.played.length + '/' + expect);
    is(state.calls.length === expect, 'har tukre ki ek hi request (prefetch ne duplicate nahi banaya)', state.calls.length + ' calls');
    const urls = new Set(state.played);
    is(urls.size === expect, 'har tukre ka apna audio (dobara wahi clip nahi baji)', urls.size + ' unique');
    /* ASAL FAIDA: purana 420-chunk plan isi matn par kai guna requests bhejta tha */
    const oldWay = AWAAZ.chunks(long, 420).length;
    is(expect < oldWay, 'naya plan purane se KAM request bhejta hai (quota bachta hai)', expect + ' vs purana ' + oldWay);
  }
  {
    /* pehla tukra chhota = awaaz foran shuru; baqi bare = kam request */
    const { AWAAZ } = makeWorld();
    let long = '';
    for (let i = 0; i < 20; i++) long += 'Jumla number ' + i + ' yahan likha gaya hai. ';
    const plan = AWAAZ.chunkPlan(long);
    is(plan.length >= 2, 'lamba matn plan mein toota', plan.length + ' tukre');
    is(plan[0].length <= AWAAZ.CHUNK1, 'pehla tukra chhota hai (foran bolne ke liye)', plan[0].length + ' harf');
    is(plan[1].length > AWAAZ.CHUNK1, 'doosra tukra bara hai (request bachane ke liye)', plan[1].length + ' harf');
    is(plan.join(' ').replace(/\s+/g, ' ').trim() === long.replace(/\s+/g, ' ').trim(), 'plan mein ek lafz bhi zaya nahi hua');
    is(AWAAZ.chunkPlan('Chhota jumla.').length === 1, 'chhota matn ek hi request');
    is(AWAAZ.chunkPlan('').length === 0, 'khaali matn = 0 request');
  }

  /* ─── 8. ERROR TAXONOMY ─── */
  head('8. ERRORS — har nakami ka naam');
  {
    const cases = [
      [{ status: 429, body: {} }, 'QUOTA'],
      [{ status: 401, body: {} }, 'KEY_BAD'],
      [{ status: 403, body: {} }, 'QUOTA'],
      [{ status: 403, body: { error: { message: 'API key not valid. Please pass a valid API key.' } } }, 'KEY_BAD'],
      [{ status: 429, body: { error: { message: 'Quota exceeded for quota metric per day' } } }, 'QUOTA_DAY'],
      [{ status: 500, body: {} }, 'HTTP_500'],
      [{ timeout: true }, 'TIMEOUT'],
      [{ neterr: true }, 'NETWORK'],
      [{ status: 200, body: { candidates: [] } }, 'NO_AUDIO']
    ];
    for (const [resp, code] of cases) {
      const { AWAAZ, state } = makeWorld({ respond: () => resp });
      AWAAZ.speak('kuch bhi', {});
      await wait(40);
      is(AWAAZ.err === code, 'error code = ' + code, AWAAZ.err);
      is(state.deviceSaid.length === 1, '  → phone ki awaaz ne sambhal liya (khamoshi nahi)', AWAAZ.engine);
    }
  }

  /* ─── 9. COOLDOWN ─── */
  head('9. COOLDOWN — 429 ke baad spam band');
  {
    const { AWAAZ, state } = makeWorld({ respond: () => ({ status: 429, body: {} }) });
    AWAAZ.speak('pehli koshish', {});
    await wait(30);
    is(AWAAZ.cooldownUntil > Date.now(), 'cooldown lag gaya', Math.round((AWAAZ.cooldownUntil - Date.now()) / 1000) + 's');
    is(AWAAZ.blockReason('x') === 'QUOTA', 'cooldown ke dauran neural block hai');
    const before = state.calls.length;
    AWAAZ.speak('doosri koshish', {});
    await wait(30);
    is(state.calls.length === before, 'doosri dafa Google ko haath hi nahi lagaya', state.calls.length + ' calls');
    is(state.deviceSaid.length === 2, 'phir bhi dono dafa bola', String(state.deviceSaid.length));
    AWAAZ.reset();
    is(AWAAZ.blockReason('x') === '', 'reset (nayi settings) ke baad neural wapas');
    is(AWAAZ.liveKeys() === AWAAZ.keyList().length, 'reset par har key azaad ho gayi');
  }

  /* ─── 10. KEY BAD ─── */
  head('10. KHARAB KEY — per key faisla, aur khamoshi phir bhi nahi');
  {
    const { AWAAZ, state } = makeWorld({ respond: () => ({ status: 401, body: { error: { message: 'API key not valid' } } }) });
    AWAAZ.speak('a', {}); await wait(40);
    is(AWAAZ.keyBad === true, 'ek hi key thi aur wo sach much kharab -> keyBad');
    is(AWAAZ.kst(0).why === 'KEY_BAD', 'us key par KEY_BAD ka thappa laga', AWAAZ.kst(0).why);
    const before = state.gcalls.length;
    AWAAZ.speak('b', {}); await wait(40);
    is(state.gcalls.length === before, 'kharab key ke sath Google ko dobara try nahi kiya', state.gcalls.length + ' vs ' + before);
    is(state.deviceSaid.length + state.played.length >= 2, 'phir bhi dono dafa kuch na kuch bola');
    is(AWAAZ.why('KEY_BAD').length > 5, 'user ke liye insani wajah maujood', AWAAZ.why('KEY_BAD'));
  }
  {
    /* do keys: pehli ka quota khatam -> DOOSRI khud chal padti hai */
    const { AWAAZ, state } = makeWorld({
      settings: { ttsKey: 'KEY_ONE,KEY_TWO', apikey: '' },
      respond: (xhr) => (xhr.headers['x-goog-api-key'] === 'KEY_ONE')
        ? { status: 429, body: { error: { message: 'rate limit' } } }
        : { status: 200, body: okBody() }
    });
    AWAAZ.speak('do keys ka imtihan', {}); await wait(60);
    is(AWAAZ.keyList().length === 2, 'comma se do TTS keys nikleen', AWAAZ.keyList().join('|'));
    is(state.played.length === 1, 'doosri key se awaaz aa gayi', state.played.length + ' clip');
    is(AWAAZ.ki === 1, 'ab doosri key chal rahi hai', 'ki=' + AWAAZ.ki);
    is(AWAAZ.kst(0).why === 'QUOTA', 'pehli key par QUOTA ka cooldown laga');
    is(AWAAZ.liveKeys() === 1, 'ek key abhi bhi zinda hai');
    is(AWAAZ.engine === 'neural', 'engine neural hi raha (device par nahi gira)', AWAAZ.engine);
  }
  {
    /* app band ho kar khule to bhi quota yaad rahe */
    const { AWAAZ, w } = makeWorld({ respond: () => ({ status: 429, body: { error: { message: 'quota per day exhausted' } } }) });
    AWAAZ.speak('din khatam', {}); await wait(40);
    is(AWAAZ.kst(0).why === 'QUOTA_DAY', 'din wale quota ka alag thappa', AWAAZ.kst(0).why);
    const saved = w.localStorage.getItem('maya_awaaz');
    is(!!saved && /QUOTA_DAY/.test(saved), 'halat localStorage mein mehfooz hai');
    AWAAZ.kstate = {}; AWAAZ.restore();
    is(AWAAZ.kst(0).why === 'QUOTA_DAY', 'restart ke baad bhi yaad raha');
  }

  /* ─── 11. POLICY GATES ─── */
  head('11. POLICY — kab neural chalega, kab nahi');
  {
    const t = (settings, want, name, extra) => {
      const { AWAAZ } = makeWorld({ settings });
      if (extra) extra(AWAAZ);
      is(AWAAZ.blockReason('salam') === want, name, AWAAZ.blockReason('salam') || '(chalega)');
    };
    t({}, '', 'sab theek → neural');
    t({ apikey: '', ttsKey: '' }, 'KEY_MISSING', 'key nahi → KEY_MISSING');
    t({ voiceEngine: 'device' }, 'DEVICE_MODE', 'sirf-phone mode → DEVICE_MODE');
    t({ voiceEngine: 'off' }, 'OFF', 'band → OFF');
    t({ voiceOn: false }, 'OFF', 'voiceOn=false → OFF');
    t({ neuralMaxChars: 3 }, 'TOO_LONG', 'hadd se lamba → TOO_LONG');
    {
      const { w, AWAAZ } = makeWorld();
      Object.defineProperty(w.navigator, 'onLine', { value: false, configurable: true });
      is(AWAAZ.blockReason('x') === 'OFFLINE', 'internet nahi → OFFLINE');
    }
    {
      const { w, AWAAZ } = makeWorld({ settings: { neuralWifiOnly: true } });
      w.navigator.connection = { type: 'cellular' };
      is(AWAAZ.blockReason('x') === 'MOBILE_DATA', 'WiFi-only + mobile data → MOBILE_DATA');
      w.navigator.connection = { type: 'wifi' };
      is(AWAAZ.blockReason('x') === '', 'WiFi par chalta hai');
    }
    {
      const { AWAAZ } = makeWorld({ settings: { apikey: 'MAIN', ttsKey: 'ALAG-TTS' } });
      is(AWAAZ.cfg().key === 'ALAG-TTS', 'alag TTS key ko tarjeeh milti hai');
    }
  }

  /* ─── 11b. AWAAZ DOCTOR ─── */
  head('11b. AWAAZ DOCTOR — "3 nayi keys lagayin, ek bhi nahi chali"');
  {
    const { AWAAZ } = makeWorld();
    const r = (st, m) => AWAAZ.readErr(st, JSON.stringify({ error: { message: m } }));
    is(r(429, 'Quota exceeded for metric: generate_content_free_tier_requests, limit: 0').tag === 'LIMIT0',
       'limit: 0 ko alag pehchanta hai (project ko free tier mila hi nahi)');
    is(r(400, 'API key not valid. Please pass a valid API key.').tag === 'BADKEY', 'ghalat key pehchani');
    is(r(403, 'PERMISSION_DENIED: requests from this key are blocked').tag === 'RESTRICT', 'restriction wali key pehchani');
    is(r(429, 'You have exhausted your daily quota for this model').tag === 'DAYQUOTA', 'din ka quota pehchana');
    is(r(429, 'rate limit exceeded').tag === 'QUOTA', 'saada quota pehchana');
    is(r(200, '').tag === 'OK', 'kamyabi bhi pehchani');
    is(r(0, '').tag === 'NET', 'request pahunchi hi nahi — NET');
    is(r(403, 'PERMISSION_DENIED').fix.indexOf('restriction') > -1, 'har masle ka ILAJ bhi likha hai');
  }
  {
    /* 🎯 ASAL SHIKAYAT: teen nayi keys, teenon EK HI project ki */
    const { AWAAZ } = makeWorld();
    const rows = [1, 2, 3].map(n => ({
      n, tail: 'aaa' + n, models: ['gemini-2.5-flash-preview-tts'], model: 'gemini-2.5-flash-preview-tts',
      list: { tag: 'OK', status: 200, msg: '', fix: '' },
      tts: { tag: 'QUOTA', status: 429, msg: 'quota exceeded', fix: '' }
    }));
    const v = AWAAZ.verdict(rows);
    is(v.verdict === 'SAMEPROJECT', '🔥 teenon keys zinda magar teenon ka quota khatam -> EK HI PROJECT ka faisla', v.verdict);
    is(/EK HI PROJECT/.test(v.text), '  → user ko saaf batata hai ke sab keys ek hi project ki hain');
    is(/ALAG GOOGLE ACCOUNT/.test(v.text), '  → asal ilaj bhi batata hai (alag Google account)');
    is(/MUFT NEURAL/.test(v.text), '  → aur tasalli deta hai ke awaaz phir bhi chalegi');
  }
  {
    const { AWAAZ } = makeWorld();
    const mk = (listTag, ttsTag) => ({
      n: 1, tail: 'zzz', models: [], model: 'm',
      list: { tag: listTag, status: listTag === 'OK' ? 200 : 403, msg: '', fix: 'restriction lagao' },
      tts: { tag: ttsTag, status: ttsTag === 'OK' ? 200 : 429, msg: '', fix: '' }
    });
    is(AWAAZ.verdict([mk('OK', 'OK')]).verdict === 'OK', 'chalti key par faisla OK');
    is(AWAAZ.verdict([mk('RESTRICT', 'QUOTA')]).verdict === 'RESTRICT', 'restriction sab se pehle pakda jata hai');
    is(/19 June 2026/.test(AWAAZ.verdict([mk('RESTRICT', 'QUOTA')]).text), '  → June 2026 wali policy ka hawala diya');
    is(AWAAZ.verdict([mk('BADKEY', 'QUOTA')]).verdict === 'BADKEY', 'ghalat copy hui key ka apna faisla');
    const one = AWAAZ.verdict([mk('OK', 'DAYQUOTA')]);
    is(one.verdict === 'QUOTA', 'ek hi key ka din khatam -> QUOTA (SAMEPROJECT nahi)', one.verdict);
    is(AWAAZ.verdict([]).verdict === undefined || true, 'khaali list par crash nahi');
  }
  {
    /* poora muaina end-to-end: ListModels + TTS dono */
    const { AWAAZ } = makeWorld({
      settings: { ttsKey: 'AIzaKeyOne,AIzaKeyTwo', apikey: '' },
      respond: (xhr) => /\/models$/.test(xhr.url || '')
        ? { status: 200, body: { models: [{ name: 'models/gemini-2.5-flash-preview-tts' }, { name: 'models/gemini-2.5-flash' }] } }
        : { status: 429, body: { error: { message: 'Quota exceeded, limit: 0' } } }
    });
    let res = null, lines = 0;
    AWAAZ.doctor(() => { lines++; }, (r) => { res = r; });
    await wait(120);
    is(!!res, 'doctor poora chala');
    is(res.rows.length === 2, 'dono keys ka muaina hua', res.rows.length + '');
    is(res.rows[0].models.length === 1, 'ListModels se sirf TTS model chune gaye', res.rows[0].models.join());
    is(res.verdict === 'LIMIT0', 'limit:0 -> project ko free tier mila hi nahi', res.verdict);
    is(/ALAG GOOGLE ACCOUNT/.test(res.text), 'ilaj mein alag account ka mashwara');
    is(lines >= 4, 'har qadam live likha gaya', lines + ' lines');
  }

  /* ─── 12. FALLBACK CHAIN ─── */
  head('12. FALLBACK — khamoshi kabhi nahi');
  {
    const { AWAAZ, state } = makeWorld({ settings: { apikey: '', ttsKey: '' } });
    AWAAZ.speak('bina key ke', {});
    await wait(20);
    is(state.gcalls.length === 0, 'key na ho to Google ko call hi nahi jati');
    is(state.freecalls.length > 0, '  → magar MUFT NEURAL (bina key) ko zaroor try kiya', state.freecalls.length + ' call');
    is(state.deviceSaid[0] === 'bina key ke', 'phone ki awaaz ne bola', state.deviceSaid[0]);
    is(AWAAZ.engine === 'device', 'engine = device');
  }
  {
    const { AWAAZ, state } = makeWorld({ settings: { voiceEngine: 'off' } });
    AWAAZ.speak('khamosh raho', {});
    await wait(20);
    is(state.calls.length === 0 && state.deviceSaid.length === 0, 'OFF par sach much khamoshi');
    is(AWAAZ.engine === 'off', 'engine = off');
  }
  {
    /* sirf-neural mode mein bhi nakami par bolna zaroori hai */
    const { AWAAZ, state } = makeWorld({ settings: { voiceEngine: 'neural' }, respond: () => ({ status: 500, body: {} }) });
    AWAAZ.speak('neural mode', {});
    await wait(40);
    is(state.deviceSaid.length === 0 && AWAAZ.engine === 'neural' && !!AWAAZ.err, 'selected neural voice fails visibly without switching to phone');
  }

  /* ─── 13. MODEL AUTO-SWITCH ─── */
  head('13. MODEL — jo chale wahi yaad');
  {
    const { AWAAZ, state } = makeWorld({
      respond: (xhr, n) => (n === 1 ? { status: 404, body: {} } : { status: 200, body: okBody() })
    });
    AWAAZ.speak('model test', {});
    await wait(40);
    is(state.calls.length === 2, 'pehla model fail → doosra try hua', state.calls.length + ' calls');
    is(AWAAZ.model && state.calls[1].url.indexOf(AWAAZ.model) > 0, 'jo chala wo yaad rakha', AWAAZ.model);
    const before = state.calls.length;
    AWAAZ.speak('ek aur jumla', {});
    await wait(40);
    is(state.calls.length === before + 1, 'agli dafa seedha kaam wala model (koi zaya request nahi)');
  }

  /* ─── 14. STOP ─── */
  head('14. STOP — foran chup');
  {
    const { AWAAZ, state } = makeWorld();
    AWAAZ.speak('bohat lamba jawab jo beech mein roka jayega', {});
    AWAAZ.stop();                                   /* foran, jawab aane se pehle */
    await wait(40);
    is(state.calls[0].aborted === true, 'chalti request abort hui');
    is(state.played.length === 0, 'stop ke baad kuch nahi baja', String(state.played.length));
    is(AWAAZ.xhrs.length === 0, 'xhr list saaf hai');
  }
  {
    const { AWAAZ, state } = makeWorld();
    let done = 0;
    AWAAZ.speak('pehla', { onDone: () => done++ });
    AWAAZ.speak('doosra', { onDone: () => done++ });  /* purana foran mar jaye */
    await wait(40);
    is(done === 1, 'purana speak apne aap mar gaya (double callback nahi)', String(done));
    is(state.played.length === 1, 'sirf naya jumla baja');
  }

  /* ─── 15. STATUS ─── */
  head('15. STATUS — Doctor aur badge ke liye sach');
  {
    const { AWAAZ } = makeWorld();
    const st = AWAAZ.status();
    is(st.ready === true, 'ready = true jab sab theek');
    is(st.voice === 'Kore' && st.mood === 'warm', 'voice + mood report hote hain', st.voice + '/' + st.mood);
    is(typeof st.cache === 'number' && typeof st.cooldown === 'number', 'cache + cooldown ginte hain');
    const off = makeWorld({ settings: { apikey: '', ttsKey: '' } }).AWAAZ.status();
    is(off.ready === false && off.block === 'KEY_MISSING', 'key na ho to status sach bolta hai', off.why);
  }

  /* ─── 16. PURANE NAAM ─── */
  head('16. PURANI API — baqi app na toote');
  {
    const src = HTML;
    is(/function geminiTTS_stop\(\)\s*\{\s*AWAAZ\.stop\(\);\s*\}/.test(src), 'geminiTTS_stop() ab AWAAZ.stop() hai');
    is(src.indexOf('fishTTS_speak') < 0, 'purana toota hua fishTTS_speak khatam (wo CORS par marta tha)');
    is(src.indexOf('MayaBridge.httpBytes') > 0, 'fish.audio ab WAPAS hai — magar sirf native bridge se (Section 18)');
    is(src.indexOf('puterTTS_speak') < 0, 'puter.js ka murda reference khatam');
    is((src.match(/function testMayaVoice/g) || []).length === 1, 'testMayaVoice sirf ek dafa');
    is((src.match(/function speak\(text, wasVoice\)/g) || []).length === 1, 'speak() sirf ek dafa');
    /* v5.9.5: pehle DO __nativeTtsDone definitions thi — doosri pehli ko overwrite kar deti thi aur SUKOON/afterSpeak kabhi nahi chalte the. Ab ek hi unified handler hai jo AWAAZ.deviceDone + SUKOON.bolEnd + afterSpeak sab chalata hai. */
    is((src.match(/window\.__nativeTtsDone = function/g) || []).length === 1, 'sirf EK __nativeTtsDone definition (duplicate overwrite khatam)');
    is(/var complete = AWAAZ\.deviceDone;[\s\S]*?AWAAZ\.deviceDone = null;[\s\S]*?complete\(\)/.test(src), 'TTS-done callback ab arbiter ko UNLOCK bhi karta hai (deviceDone)');
    is(/window\.__nativeTtsWatch = function/.test(src), 'native utterance watchdog maujood (12s stuck-TTS rescue)');
    is(/if \(e\.cancelable && e\.preventDefault\)/.test(src), 'touchmove par cancelable guard laga (console warning fix)');
    is(/data-say/.test(src) && /say-btn/.test(src), 'har jawab par 🔊 replay button maujood');
  }

  /* ═══════════════════════════════════════════════════════════════════════
     17. 🌊 EDGE TTS — MUFT, BE-HISAAB, ASLI URDU AWAAZ  (v4.7.0)
     -----------------------------------------------------------------------
     Purana Edge code JS ke `new WebSocket()` par khara tha, aur wo API
     custom headers (Origin / User-Agent / Pragma) bhej hi nahi sakti —
     is liye Microsoft handshake rad kar deta tha aur Edge kabhi nahi bola.
     Ab WebSocket Kotlin mein hai. Ye section us naye raaste ka saboot hai.
     ═══════════════════════════════════════════════════════════════════════ */
  head('17. 🌊 EDGE TTS — muft, be-hisaab (Kotlin bridge)');
  {
    /* naqli MP3 (asli bytes ka header) */
    const MP3 = Buffer.from([0xFF, 0xFB, 0x90, 0x64, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66]);
    const MP3B64 = MP3.toString('base64');

    function edgeWorld(opts = {}) {
      const bridge = { calls: [], fail: opts.bridgeFail || null, delay: opts.delay == null ? 1 : opts.delay };
      const world = makeWorld({
        native: opts.native !== false,
        respond: opts.respond,
        bridge,
        settings: Object.assign({ edgeTTS: true }, opts.settings || {})
      });
      const w = world.w;
      bridge.edgeTts = function (ssml, reqId, timeoutMs) {
        bridge.calls.push({ ssml, reqId, timeoutMs });
        if (opts.silent) return;                       /* jawab hi na aaye (timeout ka test) */
        setTimeout(function () {
          if (bridge.fail) w.__edgeDone(reqId, false, bridge.fail);
          else w.__edgeDone(reqId, true, opts.mp3 === undefined ? MP3B64 : opts.mp3);
        }, bridge.delay);
      };
      bridge.edgeVoices = function () { return opts.voicesJson || ''; };
      return Object.assign(world, { bridge, MP3, MP3B64 });
    }

    /* ── 17a. Awaaz ki fehrist ── */
    {
      const { EDGE_TTS } = edgeWorld();
      const ids = EDGE_TTS.VOICES.map(v => v.id);
      is(ids.indexOf('ur-PK-UzmaNeural') >= 0 && ids.indexOf('ur-PK-AsadNeural') >= 0,
        'ASLI Pakistani Urdu awaazein maujood (Uzma + Asad)', ids.length + ' awaazein');
      is(EDGE_TTS.VOICES.every(v => /^[a-z]{2}-[A-Za-z]{2,4}-[A-Za-z]+Neural$/.test(v.id)),
        'har voice id ka format Microsoft wala hai');
      is(EDGE_TTS.VOICES.every(v => v.lang && (v.g === 'f' || v.g === 'm') && v.label),
        'har awaaz ke sath zubaan, gender aur naam hai');
      is(EDGE_TTS.langOf('ur-PK-UzmaNeural') === 'ur-PK' && EDGE_TTS.langOf('hi-IN-SwaraNeural') === 'hi-IN',
        'voice id se zubaan nikal aati hai');
    }

    /* ── 17b. Kaunsi awaaz chuni jaye ── */
    {
      is(edgeWorld().EDGE_TTS.pick() === 'ur-PK-UzmaNeural',
        'default: Urdu (Pakistan) ki zanana awaaz — Maya larki hai');
      is(edgeWorld({ settings: { persona: 'jarvis' } }).EDGE_TTS.pick() === 'ur-PK-AsadNeural',
        'Jarvis persona par mardana Urdu awaaz');
      is(edgeWorld({ settings: { tts: 'hi-IN' } }).EDGE_TTS.pick() === 'hi-IN-SwaraNeural',
        'Hindi chuni to Hindi awaaz');
      is(edgeWorld({ settings: { tts: 'en-IN' } }).EDGE_TTS.pick() === 'en-IN-NeerjaNeural',
        'English (India) chuni to Neerja');
      is(edgeWorld({ settings: { edgeVoice: 'ur-IN-GulNeural', tts: 'hi-IN' } }).EDGE_TTS.pick() === 'ur-IN-GulNeural',
        'user ki apni pasand sab par bhaari hai');
      is(edgeWorld({ settings: { tts: 'fr-FR' } }).EDGE_TTS.pick() === 'ur-PK-UzmaNeural',
        'anjaan zubaan par bhi khamoshi nahi — Uzma par gir jata hai');
      is(edgeWorld({ settings: { edgeVoice: 'nonsense-value' } }).EDGE_TTS.pick() === 'ur-PK-UzmaNeural',
        'bekaar voice setting rad ho kar sahi awaaz par jati hai');
    }

    /* ── 17c. Raftaar aur sur ── */
    {
      const { EDGE_TTS } = edgeWorld();
      is(EDGE_TTS.rateStr(1) === '+0%' && EDGE_TTS.rateStr(1.2) === '+20%' && EDGE_TTS.rateStr(0.8) === '-20%',
        'rate settings se Edge ki shakl mein badla', EDGE_TTS.rateStr(1.2));
      is(EDGE_TTS.rateStr(9) === '+100%' && EDGE_TTS.rateStr(0) === '+0%',
        'rate Edge ki hadd se bahar nahi ja sakta', EDGE_TTS.rateStr(9));
      is(EDGE_TTS.pitchStr(1.05) === '+3Hz' && EDGE_TTS.pitchStr(1) === '+0Hz' && EDGE_TTS.pitchStr(0.9) === '-5Hz',
        'pitch bhi sahi shakl mein (Maya ka default 1.05 = +3Hz)', EDGE_TTS.pitchStr(1.05));
      is(EDGE_TTS.pitchStr(5) === '+50Hz' && EDGE_TTS.pitchStr(0) === '+0Hz',
        'pitch bhi hadd ke andar rehta hai', EDGE_TTS.pitchStr(5));
    }

    /* ── 17d. SSML — aur injection ka darwaza band ── */
    {
      const { EDGE_TTS } = edgeWorld();
      const x = EDGE_TTS.ssml('Salam', 'ur-PK-UzmaNeural', 'ur-PK', '+8%', '+2Hz');
      is(x.indexOf("<voice name='ur-PK-UzmaNeural'>") > 0, 'SSML mein sahi awaaz ka naam');
      is(x.indexOf("xml:lang='ur-PK'") > 0, 'SSML mein sahi zubaan');
      is(x.indexOf("pitch='+2Hz' rate='+8%'") > 0, 'SSML mein prosody', 'pitch+rate');
      const bad = EDGE_TTS.ssml("5 < 6 & Ali's \"kaam\" > sab", 'ur-PK-UzmaNeural');
      is(bad.indexOf('&lt;') > 0 && bad.indexOf('&amp;') > 0 && bad.indexOf('&apos;') > 0 && bad.indexOf('&quot;') > 0,
        'matn ka har khatarnak nishan escape hua (XML injection band)');
      is((bad.match(/<voice/g) || []).length === 1 && (bad.match(/<\/speak>/g) || []).length === 1,
        'matn SSML ka dhancha nahi tor sakta');
      is(EDGE_TTS.ssml('hi', 'ur-PK-UzmaNeural').indexOf("xml:lang='ur-PK'") > 0,
        'zubaan na di jaye to voice se khud nikal aati hai');
    }

    /* ── 17e. NATIVE BRIDGE — asal fix ── */
    {
      const { w, bridge, state, EDGE_TTS } = edgeWorld();
      let ok = 0, bad = 0;
      w.edgeTTS_speak('Assalam o alaikum', 'ur-PK-UzmaNeural', 'ur-PK', '+0%', '+0Hz',
        () => ok++, () => bad++);
      is(bridge.calls.length === 1, 'native maujood ho to KOTLIN bridge chala (browser WebSocket nahi)');
      is(/^<speak /.test(bridge.calls[0].ssml) && bridge.calls[0].ssml.indexOf('Assalam o alaikum') > 0,
        'bridge ko poora tayyar SSML gaya');
      is(typeof bridge.calls[0].reqId === 'string' && bridge.calls[0].reqId.length > 3,
        'har request ka apna id (jawab ghalat jagah na gire)', bridge.calls[0].reqId);
      is(bridge.calls[0].timeoutMs > 0 && bridge.calls[0].timeoutMs < EDGE_TTS.TIMEOUT,
        'native ka timeout JS se chhota hai (JS aakhri pehredaar rahe)', bridge.calls[0].timeoutMs + 'ms');
      await wait(20);
      is(ok === 1 && bad === 0, 'awaaz aa gayi aur onDone chala', 'ok=' + ok);
      is(state.played.length === 1, 'audio sach much baji', state.played[0]);
      const b = state.blobs[state.blobs.length - 1];
      is(b && b.type === 'audio/mpeg', 'blob MP3 hai (Gemini wali raw PCM nahi)', b ? b.type : '-');
      const bytes = await bytesOf(b.blob);
      is(bytes.length === 10 && bytes[0] === 0xFF && bytes[1] === 0xFB,
        'Kotlin ke bheje hue thek wohi bytes baje', bytes.length + ' bytes');
      is(EDGE_TTS.spoke === 1, 'Edge ka counter barha (status sach bole)');
    }

    /* ── 17f. Nakami par sach ── */
    {
      const { w, EDGE_TTS } = edgeWorld({ bridgeFail: 'Edge ne handshake mana kiya: HTTP/1.1 403 Forbidden' });
      let code = '';
      w.edgeTTS_speak('test', 'ur-PK-UzmaNeural', 'ur-PK', '+0%', '+0Hz', () => {}, (c) => { code = c; });
      await wait(20);
      is(code === 'NETWORK', 'nakami chup-chaap nahi — code aaya', code);
      is(EDGE_TTS.lastErr.indexOf('403') > 0,
        'Microsoft ki ASAL ghalati mehfooz hai (andaza nahi)', EDGE_TTS.lastErr);
    }

    /* ── 17g. Do dafa jawab / stop ke baad jawab ── */
    {
      const { w } = edgeWorld();
      let ok = 0;
      w.edgeTTS_speak('test', 'ur-PK-UzmaNeural', 'ur-PK', '+0%', '+0Hz', () => ok++, () => {});
      await wait(20);
      const id = Object.keys(w.EDGE_TTS.pend);
      w.__edgeDone('e1_' + Date.now(), true, 'AAAA');   /* anjaan id */
      await wait(10);
      is(ok === 1 && id.length === 0, 'ek request = ek jawab (dohra callback nahi)', 'ok=' + ok);
    }
    {
      const { w, state, bridge } = edgeWorld({ delay: 30 });
      let ok = 0, bad = 0;
      w.edgeTTS_speak('test', 'ur-PK-UzmaNeural', 'ur-PK', '+0%', '+0Hz', () => ok++, () => bad++);
      w.edgeTTS_stop();                                  /* user ne rok diya */
      await wait(60);
      is(ok === 0 && bad === 0 && state.played.length === 0,
        'stop() ke baad aayi hui awaaz chup rehti hai', 'played=' + state.played.length);
    }

    /* ── 17h. Browser mein Edge sach bolta hai (jhooti koshish nahi) ── */
    {
      const world = makeWorld({ native: false, settings: { edgeTTS: true } });
      is(world.AWAAZ.edgeReady() === false,
        'bridge na ho to Edge khud ko tayyar nahi kehta (waqt zaya nahi hota)');
      const w2 = makeWorld({ native: false, settings: { edgeTTS: true, voiceEngine: 'edge' } });
      is(w2.AWAAZ.edgeReady() === true,
        'browser mein bhi jab user khud "Sirf Edge" chune to koshish hoti hai');
      delete w2.w.WebSocket;
      let code = '';
      w2.w.edgeTTS_speak('t', 'ur-PK-UzmaNeural', 'ur-PK', '+0%', '+0Hz', () => {}, (c) => { code = c; });
      await wait(10);
      is(code === 'MODEL', 'WebSocket hi na ho to foran sach bata deta hai', code);
    }

    /* ── 17i. SEERHI — Edge ab muft-neural se PEHLE ── */
    {
      const { AWAAZ, bridge, state } = edgeWorld({ settings: { apikey: '', ttsKey: '' } });
      const seen = [];
      AWAAZ.speak('Gemini key hi nahi hai', { onStart: (e) => seen.push(e) });
      await wait(30);
      is(seen[0] === 'edge', 'Gemini na ho to seedha EDGE bolta hai (robot nahi)', seen.join('>'));
      is(bridge.calls.length === 1, 'Edge ko sach much bheja gaya');
      is(state.freecalls.length === 0, 'Edge chal gaya to Pollinations ko takleef nahi di');
    }
    {
      const { AWAAZ, bridge, state } = edgeWorld({
        settings: { voiceEngine: 'edge', apikey: 'KEY-123' }
      });
      const seen = [];
      AWAAZ.speak('sirf edge', { onStart: (e) => seen.push(e) });
      await wait(30);
      is(seen.join('>') === 'edge', 'mode "edge" par sirf Edge bola', seen.join('>'));
      is(state.gcalls.length === 0, 'mode "edge" par Gemini ka quota bilkul nahi jala', state.gcalls.length + ' Google calls');
      is(bridge.calls.length === 1, 'Edge ne kaam kiya');
    }
    {
      const { AWAAZ, bridge, state } = edgeWorld({
        bridgeFail: 'net down', settings: { apikey: '', ttsKey: '' }
      });
      const seen = [];
      AWAAZ.speak('edge bhi mar gaya', { onStart: (e) => seen.push(e) });
      await wait(40);
      is(seen[0] === 'edge' && seen[1] === 'free',
        'Edge nakaam ho to muft neural par jata hai (khamoshi kabhi nahi)', seen.join('>'));
      is(bridge.calls.length === 1 && state.freecalls.length === 1, 'dono tehon ne apna kaam kiya');
    }
    {
      const { AWAAZ, bridge } = edgeWorld({
        settings: { edgeTTS: false, apikey: '', ttsKey: '' }
      });
      const seen = [];
      AWAAZ.speak('edge band hai', { onStart: (e) => seen.push(e) });
      await wait(30);
      is(seen[0] === 'free' && bridge.calls.length === 0,
        'switch OFF ho to Edge ko chhua bhi nahi jata', seen.join('>'));
    }

    /* ── 17j. STATUS — Doctor ke liye sach ── */
    {
      const st = edgeWorld().AWAAZ.status();
      is(st.edgeOn === true && st.edgeReady === true && st.edgeNative === true,
        'status Edge ka sach bolta hai (on / tayyar / native)');
      is(st.edgeVoice === 'ur-PK-UzmaNeural', 'status batata hai kaunsi Edge awaaz chalegi', st.edgeVoice);
      const st2 = makeWorld({ native: false }).AWAAZ.status();
      is(st2.edgeReady === false && st2.edgeNative === false,
        'browser mein status jhooti tasalli nahi deta');
    }

    /* ── 17k. Purana toota hua raasta wapas na aaye ── */
    {
      const src = HTML;
      is(/if \(EDGE_TTS\.native\(\)\)[\s\S]{0,400}MayaBridge\.edgeTts\(/.test(src),
        'edgeTTS_speak ab BRIDGE-FIRST hai (yehi asal fix hai)');
      is(src.indexOf('window.__edgeDone') > 0, 'Kotlin ka jawab lene wala darwaza maujood');
      is(/fun edgeTts\(/.test(fs.readFileSync(path.join(ROOT, 'app/src/main/java/com/maya/ai/MainActivity.kt'), 'utf8')),
        'Kotlin side par edgeTts bridge sach much likha hai');
      const KT = fs.readFileSync(path.join(ROOT, 'app/src/main/java/com/maya/ai/MainActivity.kt'), 'utf8');
      is(KT.indexOf('chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold') > 0,
        'Kotlin wahi Origin header bhejta hai jo Microsoft maangta hai');
      is(/Sec-WebSocket-Version: 13/.test(KT) && /Sec-MS-GEC=/.test(KT),
        'handshake ke dono zaroori tukre maujood (yehi browser nahi bhej sakta)');
      is(/ticks -= ticks % 300\.0/.test(KT) && /11644473600/.test(KT) && /SHA-256/.test(KT),
        'DRM token ka hisab edge-tts wala hi hai (5 min block + windows epoch)');
      is(/0x80 or opcode/.test(KT) && /mask\[i % 4\]/.test(KT),
        'client frames par mask lagta hai (RFC-6455 ki lazmi shart)');
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     18. 🐟 FISH AUDIO S2.1 Pro — BE-HISAAB + *ANDAAZ* WAPAS   (v4.8.0)
     -----------------------------------------------------------------------
     Do cheezein sabit karni hain:
       1. MOOD zinda hai — Gemini ko hum lafzi hidayat bhejte the, Edge wo kha
          gaya tha; Fish us hidayat ko [bracket] mein wapas leta hai.
       2. BINARY mehfooz hai — purana bridge jawab ko TEXT samajhta tha, jo MP3
          ko barbaad kar deta. Naya httpBytes() raw bytes deta hai.
     Aur teesri: nakami par sach — khaas kar 402, jo kehta hai muft daur khatam.
     ═══════════════════════════════════════════════════════════════════════ */
  head('18. 🐟 FISH AUDIO — be-hisaab + andaaz (Kotlin binary bridge)');
  {
    const MP3 = Buffer.from([0xFF, 0xFB, 0x90, 0x64, 0x00, 0x11, 0xEE, 0x7F, 0x80, 0x01, 0xFE, 0x42]);
    const MP3B64 = MP3.toString('base64');
    const jb64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');

    function fishWorld(opts = {}) {
      const bridge = { calls: [] };
      const world = makeWorld({
        native: opts.native !== false,
        respond: opts.respond,
        bridge,
        settings: Object.assign({ fishKey: 'fk_test_key_123456', fishOn: true, fishVoice: 'fixture-selected-id' }, opts.settings || {})
      });
      const w = world.w;
      bridge.httpBytes = function (method, url, headersJson, body, reqId, timeoutMs) {
        let hdrs = {}; try { hdrs = JSON.parse(headersJson); } catch (e) {}
        let json = null; try { json = JSON.parse(body); } catch (e) {}
        bridge.calls.push({ method, url, hdrs, body, json, reqId, timeoutMs });
        if (opts.silent) return;
        setTimeout(function () {
          const r = (typeof opts.reply === 'function')
            ? opts.reply(bridge.calls.length, bridge.calls[bridge.calls.length - 1])
            : (opts.reply || { status: 200, b64: MP3B64, ctype: 'audio/mpeg' });
          w.__binDone(reqId, r.status || 0, r.b64 || '', r.ctype || '', r.err || '');
        }, opts.delay == null ? 1 : opts.delay);
      };
      if (opts.stream) {
        bridge.streams = []; bridge.stops = 0;
        bridge.fishStreamSpeak = (body, headers, id) => bridge.streams.push({ body: JSON.parse(body), headers: JSON.parse(headers), id });
        bridge.fishStreamStop = () => bridge.stops++;
        w.VOICE_TIME = { count: 0, playing() { this.count++; } };
      }
      return Object.assign(world, { bridge, FISH: w.FISH, MP3, MP3B64 });
    }

    /* ── 18a. MOOD -> [bracket] : yehi asal maqsad hai ── */
    {
      const { FISH, w } = fishWorld();
      is(/warm/i.test(FISH.BRACKET.warm) && FISH.BRACKET.warm.length <= 14,
        '🔑 Warm mood ka ishara CHHOTA hai (lamba angrezi ishara Devanagari ko angrezi bana deta tha)',
        FISH.BRACKET.warm + ' — ' + FISH.BRACKET.warm.length + ' harf');
      var longest = 0, bk;
      for (bk in FISH.BRACKET) if (FISH.BRACKET[bk].length > longest) longest = FISH.BRACKET[bk].length;
      is(longest <= 14, '   → har ishara 14 harf se chhota (lehja mehfooz)', longest + ' harf sab se lamba');
      is(/whisper/i.test(FISH.BRACKET.whisper), 'Whisper mood zinda hai', FISH.BRACKET.whisper);
      is(/excited|energy/i.test(FISH.BRACKET.hype) && /playful|teasing/i.test(FISH.BRACKET.funny),
        'Hype aur Funny bhi zinda');
      /* app ke SAB mood (auto ke ilawa) Fish par kaam karen — koi peeche na chhoote */
      const moods = (HTML.match(/\{ id:"([a-z]+)",\s+label:"[^"]*",\s+p:"[^"]*"/g) || [])
        .map(m => /id:"([a-z]+)"/.exec(m)[1]).filter(x => x !== 'auto');
      const missing = moods.filter(m => !FISH.BRACKET[m]);
      is(moods.length >= 8 && missing.length === 0,
        'app ke HAR mood ka Fish ishara maujood (Edge par ye sab mar jate the)',
        moods.length + ' mood, ' + missing.length + ' gayab');
      const st = FISH.styled('Kaise ho', 'whisper');
      is(st.indexOf(FISH.BRACKET.whisper) === 0 && /Kaise ho$/.test(st),
        'ishara matn ke SHURU mein lagta hai, matn baad mein', st);
      is(FISH.styled('Salam', '') === 'Salam' && FISH.styled('Salam', 'bakwaas') === 'Salam',
        'mood na ho to matn saaf rehta hai — koi fazool bracket nahi');
    }

    /* ── 18b. Request ki shakl ── */
    {
      const { FISH, bridge, w } = fishWorld({ settings: { fishVoice: 'voice_abc123', rate: 1.25 } });
      FISH.speak('Assalam o alaikum', 'warm', () => {}, () => {});
      const c = bridge.calls[0];
      is(!!c && c.method === 'POST' && c.url === 'https://api.fish.audio/v1/tts',
        'sahih endpoint par POST', c ? c.url : '-');
      is(c.hdrs.model === 's2.1-pro-free',
        '🔑 custom header `model: s2.1-pro-free` gaya (purana bridge ye bhej HI nahi sakta tha)', c.hdrs.model);
      is(c.hdrs.Authorization === 'Bearer fk_test_key_123456', 'Bearer key sahih');
      is(c.json.format === 'mp3' && c.json.mp3_bitrate === 128, 'MP3 manga gaya');
      is(c.json.reference_id === 'voice_abc123', 'chuni hui awaaz bheji gayi', c.json.reference_id);
      is(c.json.text.indexOf('[warm]') === 0 && c.json.text.indexOf('Assalam') > 0,
        'matn ke sath andaaz ka ishara bhi gaya', c.json.text.slice(0, 40));
      is(c.json.prosody.speed === 1.25, 'settings ka rate prosody.speed ban gaya', String(c.json.prosody.speed));
      is(c.timeoutMs > 0, 'native ko timeout diya gaya', c.timeoutMs + 'ms');
      const c2 = fishWorld({ settings: { fishVoice: '' } });
      c2.FISH.speak('hi', 'warm', () => {}, () => {});
      is(c2.bridge.calls.length === 0 && c2.FISH.block() === 'VOICE_MISSING',
        'buffered and streaming paths both require an explicit saved reference');
      const c3 = fishWorld({ settings: { rate: 9 } });
      c3.FISH.speak('hi', 'warm', () => {}, () => {});
      is(c3.bridge.calls[0].json.prosody.speed === 2, 'speed hadd (2.0) se bahar nahi ja sakti',
        String(c3.bridge.calls[0].json.prosody.speed));
    }

    /* ── 18c. BINARY — doosra asal fix ── */
    {
      const { FISH, state } = fishWorld();
      let ok = 0, bad = '';
      FISH.speak('test', 'warm', () => ok++, (c) => { bad = c; });
      await wait(20);
      is(ok === 1 && !bad, 'awaaz aa gayi aur baji', 'ok=' + ok + ' bad=' + bad);
      const b = state.blobs[state.blobs.length - 1];
      is(b && b.type === 'audio/mpeg', 'blob MP3 hai', b ? b.type : '-');
      const bytes = await bytesOf(b.blob);
      is(bytes.length === MP3.length && bytes[0] === 0xFF && bytes[1] === 0xFB && bytes[6] === 0xEE && bytes[11] === 0x42,
        '🔑 raw bytes JYUN KE TYUN baje — text-decode ne MP3 nahi bigara', bytes.length + ' bytes');
      is(FISH.spoke === 1 && FISH.lastHttp === 200, 'counter aur status sach bolte hain');
      is(FISH.lastMs >= 0 && typeof FISH.lastMs === 'number', 'raftaar naapi gayi', FISH.lastMs + 'ms');
    }

    /* ── 18d. Nakami par SACH ── */
    {
      const t = async (status, b64, want, note) => {
        const { FISH } = fishWorld({ reply: { status, b64: b64 || '' } });
        let code = '';
        FISH.speak('x', 'warm', () => {}, (c) => { code = c; });
        await wait(20);
        is(code === want, note, code + (FISH.lastErr ? (' — ' + FISH.lastErr.slice(0, 60)) : ''));
        return FISH;
      };
      await t(401, jb64({ message: 'Invalid API key' }), 'KEY_BAD', '401 = key ghalat');
      const f402 = await t(402, jb64({ message: 'Insufficient balance' }), 'PAYMENT',
        '🚨 402 = muft daur band / balance khatam');
      is(f402.cool > Date.now(), '402 ke baad Fish thori der ke liye so jati hai (baar baar na maare)');
      const f429 = await t(429, jb64({ message: 'Rate limit exceeded' }), 'RATE', '429 = Fair Use ki hadd');
      is(f429.cool > Date.now(), '429 par bhi cooldown lagta hai');
      await t(403, '', 'FORBIDDEN', '403 = ijazat nahi');
      await t(503, '', 'BUSY', '503 = server busy');
      await t(0, '', 'NETWORK', 'network gir gaya');
      await t(200, '', 'NO_AUDIO', '200 magar audio khaali');
      const { FISH } = fishWorld();
      is(FISH.readErr(jb64({ message: 'Free tier ended on 2026-08-31' })) === 'Free tier ended on 2026-08-31',
        'Fish ka APNA message nikal aata hai (andaza nahi)');
      is(FISH.readErr(Buffer.from('plain text error', 'utf8').toString('base64')) === 'plain text error',
        'JSON na ho to bhi matn mil jata hai');
      is(FISH.readErr('') === '' && FISH.readErr(null) === '', 'khaali jawab par crash nahi');
      is(FISH.code(200) === 'OK' && FISH.code(402) === 'PAYMENT' && FISH.code(418) === 'HTTP_418',
        'har HTTP status ka apna code');
      is(/402/.test(FISH.why('PAYMENT')) && /No paid model/.test(FISH.why('PAYMENT')),
        '402 is reported without guessing a free-tier end date', FISH.why('PAYMENT').slice(0, 50));
    }

    /* ── 18e. Pehredaar — bekaar request bheji hi na jaye ── */
    {
      const a = fishWorld({ settings: { fishKey: '' } });
      let c1 = '';
      a.FISH.speak('x', 'warm', () => {}, (c) => { c1 = c; });
      is(c1 === 'KEY_MISSING' && a.bridge.calls.length === 0,
        'key na ho to ek byte bhi nahi bheja jata', c1);
      const b = fishWorld({ native: false });
      let c2 = '';
      b.FISH.speak('x', 'warm', () => {}, (c) => { c2 = c; });
      is(c2 === 'BROWSER' && /CORS/.test(b.FISH.why('BROWSER')),
        'browser mein saaf sach: CORS rokta hai (purana zakhm yaad hai)', c2);
      const c = fishWorld({ settings: { fishOn: false } });
      let c3 = '';
      c.FISH.speak('x', 'warm', () => {}, (x) => { c3 = x; });
      is(c3 === 'OFF' && c.bridge.calls.length === 0, 'switch OFF = bilkul band');
      const d = fishWorld();
      d.FISH.cool = Date.now() + 60000;
      is(d.FISH.ready() === false && d.FISH.block() === 'RATE', 'cooldown mein Fish khud ko tayyar nahi kehti');
      d.FISH.persist();
      is(String(d.w.localStorage.getItem('maya_fish')).indexOf('"c"') > 0,
        'cooldown app band hone par bhi yaad rehta hai');
    }

    /* ── 18f. SEERHI — Fish sab se upar ── */
    {
      const { AWAAZ, bridge, state } = fishWorld();
      const seen = [];
      AWAAZ.speak('Salam', { onStart: (e) => seen.push(e) });
      await wait(30);
      is(seen[0] === 'fish', '🐟 Fish SAB SE PEHLE bolti hai', seen.join('>'));
      is(state.gcalls.length === 0, 'Fish chali to Gemini ka quota bilkul nahi jala', state.gcalls.length + ' Google calls');
      is(bridge.calls.length === 1, 'ek jawab = ek Fish request');
    }
    {
      const { AWAAZ, state } = fishWorld({ reply: { status: 402, b64: '' } });
      const seen = [];
      AWAAZ.speak('Salam', { onStart: (e) => seen.push(e) });
      await wait(40);
      is(seen.join('>') === 'fish' && AWAAZ.err === 'PAYMENT',
        'Fish failure is reported; selected voice remains unchanged', seen.join('>'));
      is(state.gcalls.length === 0 && state.deviceSaid.length === 0, 'no hidden Gemini or phone fallback');
    }
    {
      const { AWAAZ } = fishWorld({ reply: { status: 402 }, settings: { apikey: '', ttsKey: '' } });
      const seen = [];
      AWAAZ.speak('Salam', { onStart: (e) => seen.push(e) });
      await wait(50);
      is(seen.join('>') === 'fish' && AWAAZ.err === 'PAYMENT',
        'missing alternatives cannot change the selected Fish voice', seen.join('>'));
    }
    {
      const { AWAAZ, bridge, state } = fishWorld({ settings: { fishKey: '' } });
      const seen = [];
      AWAAZ.speak('Salam', { onStart: (e) => seen.push(e) });
      await wait(30);
      is(seen[0] === 'neural' && bridge.calls.length === 0,
        'Fish key na ho to purana raasta jyun ka tyun (koi regression nahi)', seen.join('>'));
    }
    {
      const { AWAAZ, bridge, state } = fishWorld({ settings: { voiceEngine: 'fish', apikey: 'KEY-123' } });
      const seen = [];
      AWAAZ.speak('Salam', { onStart: (e) => seen.push(e) });
      await wait(30);
      is(seen.join('>') === 'fish' && state.gcalls.length === 0,
        'mode "fish" par sirf Fish — Gemini ka quota poora bacha', seen.join('>'));
      is(bridge.calls.length === 1, 'Fish ne kaam kiya');
    }
    {
      const { AWAAZ, state } = fishWorld({ delay: 30 });
      let done = 0;
      AWAAZ.speak('Salam', { onDone: () => done++ });
      AWAAZ.stop();
      await wait(60);
      is(done === 0 && state.played.length === 0, 'stop() ke baad Fish ka jawab chup rehta hai');
    }

    // Real JS streaming bridge protocol; Android audio/network remain device tests.
    {
      const { AWAAZ, bridge, w, FISH, state } = fishWorld({ stream: true, settings: { voiceEngine: 'fish', fishVoice: 'chosen-voice', fastShort: true } });
      let done = 0;
      AWAAZ.speak('Hello', { onDone: () => done++ });
      is(bridge.streams.length === 1 && bridge.calls.length === 0, 'Fish starts streaming without full-file/base64 download');
      is(bridge.streams[0].body.reference_id === 'chosen-voice', 'stream preserves selected voice even with fastShort enabled');
      is(bridge.streams[0].body.chunk_length === 100 && bridge.streams[0].headers.model === 's2.1-pro-free', 'provider uses smaller streaming segments and the same free model');
      is(w.VOICE_TIME.count === 0 && done === 0, 'request submission is not counted as audible playback');
      const id = bridge.streams[0].id;
      w.__fishStreamEvent('unrelated', 'playing', 200);
      is(w.VOICE_TIME.count === 0, 'foreign stream callbacks are ignored');
      w.__fishStreamEvent(id, 'playing', 200); w.__fishStreamEvent(id, 'playing', 200);
      is(w.VOICE_TIME.count === 1 && done === 0, 'actual playing is marked once, before full stream completion');
      w.__fishStreamEvent(id, 'done', 200); w.__fishStreamEvent(id, 'done', 200);
      is(done === 1 && FISH.spoke === 1 && FISH.streamPending === null, 'one terminal callback and cleanup per stream');
      is(state.deviceSaid.length === 0 && state.gcalls.length === 0 && state.freecalls.length === 0, 'stream never calls replacement voice providers');
      w.close();
    }
    {
      const { AWAAZ, bridge, w, state } = fishWorld({ stream: true, settings: { fishVoice: 'chosen-voice' } });
      let done = 0, err = '';
      AWAAZ.speak('Hello', { onDone: () => done++, onError: code => { err = code; } });
      w.__fishStreamEvent(bridge.streams[0].id, 'error', 402);
      is(err === 'PAYMENT' && done === 1, 'stream billing failure is explicit and completes once');
      is(state.gcalls.length === 0 && state.deviceSaid.length === 0 && AWAAZ.engine === 'fish', 'Auto with configured Fish also refuses voice substitution');
      w.close();
    }
    {
      const { AWAAZ, bridge, w } = fishWorld({ stream: true, settings: { voiceEngine: 'fish', fishVoice: 'original' } });
      let done = 0;
      AWAAZ.speak('A complete sentence. '.repeat(240), { onDone: () => done++ });
      const first = bridge.streams[0];
      w.settings.fishVoice = 'changed'; w.settings.rate = 2;
      w.__fishStreamEvent(first.id, 'playing', 200); w.__fishStreamEvent(first.id, 'done', 200);
      is(bridge.streams.length === 2 && bridge.streams[1].body.reference_id === 'original', 'later chunks retain the original voice snapshot');
      is(bridge.streams[1].body.prosody.speed === first.body.prosody.speed, 'later chunks retain original prosody');
      const second = bridge.streams[1].id;
      AWAAZ.stop(); w.__fishStreamEvent(second, 'playing', 200); w.__fishStreamEvent(second, 'done', 200);
      is(done === 0 && bridge.stops > 0 && w.FISH.streamPending === null, 'stop cancels native playback and rejects late completion');
      w.close();
    }
    {
      const { AWAAZ, bridge, w } = fishWorld({ stream: true, settings: { voiceEngine: 'fish', fishVoice: '' } });
      let error = '';
      AWAAZ.speak('Hello', { onError: code => { error = code; } });
      is(error === 'VOICE_MISSING' && bridge.streams.length === 0, 'missing selection cannot silently use a default stream voice');
      w.close();
    }

    /* ── 18g. 🩺 FISH DOCTOR ── */
    {
      const mk = (opts) => new Promise((res) => fishWorld(opts).FISH.doctor(() => {}, res));
      const noKey = await mk({ settings: { fishKey: '' } });
      is(noKey.verdict === 'KEY_MISSING' && /api-keys/.test(noKey.text),
        'DOCTOR: key na ho to seedha bata deta hai kahan se banani hai', noKey.verdict);
      const brow = await mk({ native: false });
      is(brow.verdict === 'BROWSER' && /CORS/.test(brow.text),
        'DOCTOR: browser mein wajah CORS batata hai', brow.verdict);
      const good = await mk({ reply: { status: 200, b64: Buffer.alloc(4000, 7).toString('base64'), ctype: 'audio/mpeg' } });
      is(good.verdict === 'OK' && good.ok === true && /Selected-reference synthesis returned audio/.test(good.text),
        'Doctor distinguishes synthesis from audible playback', good.verdict);
      is(/no unlimited-use guarantee/.test(good.text) && good.bytes > 500,
        'Doctor reports bytes without promising unlimited use', good.bytes + ' bytes');
      const dead = await mk({ reply: { status: 402, b64: jb64({ message: 'free tier ended' }) } });
      is(dead.verdict === 'PAYMENT' && dead.ok === false && /402/.test(dead.text) && /No paid-model retry/.test(dead.text),
        'Doctor reports 402 without promising a fallback voice', dead.verdict);
      is(/No automatic voice replacement/.test(dead.text), 'Doctor explicitly refuses automatic voice replacement');
      const bad = await mk({ reply: { status: 401, b64: jb64({ message: 'bad key' }) } });
      is(bad.verdict === 'KEY_BAD' && /401/.test(bad.text) && /bad key/.test(bad.text),
        'DOCTOR: 401 par Fish ka apna message bhi dikhata hai', bad.verdict);
      const busy = await mk({ reply: { status: 429, b64: '' } });
      is(busy.verdict === 'RATE' && /Fair Use/.test(busy.text), 'DOCTOR: 429 = Fair Use', busy.verdict);
    }

    /* ── 18h. Awaaz ki library ── */
    {
      const lib = { items: [
        { _id: 'v1', title: 'Warm Urdu Girl', languages: ['ur'], like_count: 42 },
        { _id: 'v2', title: 'Calm Narrator', languages: ['en', 'hi'], like_count: 7 },
        { _id: null, title: 'kharab' }
      ] };
      const { FISH, bridge } = fishWorld({ reply: { status: 200, b64: jb64(lib), ctype: 'application/json' } });
      let got = null, code = '-';
      FISH.library('', (L, c) => { got = L; code = c; });
      await wait(20);
      is(bridge.calls[0].method === 'GET' && /api\.fish\.audio\/model/.test(bridge.calls[0].url),
        'library GET /model se aati hai', bridge.calls[0].url.slice(0, 46));
      is(got && got.length === 2, 'awaazein parh li gayin, kharab entry chhaan di gayi', got ? got.length + '' : '-');
      is(got[0].id === 'v1' && got[0].title === 'Warm Urdu Girl' && got[0].langs === 'ur',
        'har awaaz ka id, naam aur zubaan mehfooz');
      const fail = fishWorld({ reply: { status: 401, b64: jb64({ message: 'nope' }) } });
      let c2 = '';
      fail.FISH.library('', (L, c) => { c2 = c; });
      await wait(20);
      is(c2 === 'KEY_BAD', 'library bhi nakami par sach bolti hai', c2);
    }

    /* ── 18i. Purana toota hua raasta wapas na aaye ── */
    {
      const src = HTML;
      const KT = fs.readFileSync(path.join(ROOT, 'app/src/main/java/com/maya/ai/MainActivity.kt'), 'utf8');
      is(src.indexOf('fishTTS_speak') < 0,
        'purana fishTTS_speak khatam — wo browser XHR par tha aur CORS se marta tha');
      is(/req: function \(method, url, headersJson, body, cb\) \{\s*if \(!FISH\.native\(\)\)/.test(src),
        '🔑 Fish ka HAR request pehle native bridge check karta hai (CORS ka ilaj)');
      is(src.indexOf('MayaBridge.httpBytes') > 0 && !/XMLHttpRequest[\s\S]{0,120}fish\.audio/.test(src),
        'Fish kabhi seedha browser XHR se call nahi hota');
      is(/fun httpBytes\(/.test(KT), 'Kotlin mein httpBytes() bridge maujood');
      const hb = KT.slice(KT.indexOf('fun httpBytes('), KT.indexOf('fun httpBytes(') + 3200);
      is(hb.indexOf('bufferedReader') < 0 && /bos\.write\(buf, 0, n\)/.test(hb) && /Base64\.encodeToString\(bos\.toByteArray\(\)/.test(hb),
        '🔑 Kotlin RAW BYTES base64 karta hai — httpBytes mein bufferedReader hai HI nahi (wohi MP3 tor deta tha)');
      is(/fun httpPostAsync[\s\S]{0,180}httpAsync\("POST"/.test(KT) && /bufferedReader/.test(KT.slice(KT.indexOf('private fun httpAsync('), KT.indexOf('fun cancelHttpPost('))),
        'async text bridge retains text decoding; raw-byte voice bridge stays separate');
      is(/JSONObject\(headersJson\)[\s\S]{0,220}setRequestProperty/.test(KT),
        'Kotlin har custom header bhejta hai (model: s2.1-pro-free is ke bagair na jata)');
      is(src.indexOf('window.__binDone') > 0, 'bytes wapas lene ka darwaza maujood');
    }
  }

  console.log('\n\x1b[1m\x1b[35m══════════════════════════════════════════════════════════\x1b[0m');
  if (fail === 0) console.log('\x1b[1m\x1b[32m✅ SAB TEST PASS — ' + pass + '/' + pass + '\x1b[0m');
  else console.log('\x1b[1m\x1b[31m❌ ' + fail + ' TEST FAIL — ' + pass + '/' + (pass + fail) + ' pass\x1b[0m');
  console.log('\x1b[1m\x1b[35m══════════════════════════════════════════════════════════\x1b[0m\n');
  process.exit(fail === 0 ? 0 : 1);
})();
