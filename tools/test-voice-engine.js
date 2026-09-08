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
/* 🎙️ v5.15.0 — slice ab VOICE_ARTISTS se shuru: ARTIST.parse() purane #artistGrid ids
   (zephyr/charon/leda…) ko bhi samajhta hai, is liye wo table world mein honi chahiye */
const AV = HTML.indexOf('var VOICE_ARTISTS = {');
const A = AV >= 0 ? AV : HTML.indexOf('var GEMINI_VOICES = [');
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
    /* 🔁 v5.15.0 K5.2/K5.3 — ye purana taala JAAN-BOOJH KAR badla gaya:
       PEHLE: "sirf-neural mode bhi nakami par phone par girta hai" — yaani user ne Gemini
       chuna tha magar nakami par CHUP-CHAAP phone ki robotic awaaz bol jati thi (F89-F93).
       AB QANOON: pasand chuni = STRICT → doosri awaaz khud NAHI chalti; pehle USI artist
       par retry, phir SACH + IJAZAT ka sawal. Purana wada ("khamoshi kabhi nahi") sirf
       AUTO mode ka hai — wo neeche alag taale mein barqarar hai. */
    const { w, AWAAZ, state } = makeWorld({ settings: { voiceEngine: 'neural' }, respond: () => ({ status: 500, body: {} }) });
    const bubbles = []; w.addBubble = (who, t) => bubbles.push(String(t)); w.toast = () => {}; w.pushLog = () => {};
    AWAAZ.speak('neural mode', {});
    await wait(1500);
    is(state.deviceSaid.length === 0 && AWAAZ.engine !== 'device' && AWAAZ.engine !== 'edge',
      '🎙️ STRICT: Gemini chuna tha → nakami par phone/Edge par NAHI gira (chup-chaap artist change BAND)',
      'engine=' + AWAAZ.engine + ' device=' + state.deviceSaid.length);
    is(AWAAZ.artistRetries >= 1, '🎙️ STRICT: pehle USI artist par dobara koshish hui', 'retries=' + AWAAZ.artistRetries);
    is(!!AWAAZ.ask && AWAAZ.ask.eng === 'neural' && AWAAZ.ask.text === 'neural mode',
      '🎙️ STRICT: nakami par ijazat maangi (ask darj: engine + adhoora matn)', JSON.stringify(AWAAZ.ask || null).slice(0, 80));
    is(bubbles.some(b => /nahi bol saki/.test(b)) && bubbles.some(b => /dobara koshish/.test(b)),
      '🎙️ STRICT: screen par SACH likha + 4 ikhtiyar (dobara / sirf ab / hamesha / chup)', bubbles.join(' | ').slice(0, 140));
    AWAAZ.stop();
  }
  {
    /* AUTO mode ka purana wada barqarar: khamoshi kabhi nahi — aakhri teh phone */
    const { AWAAZ, state } = makeWorld({ settings: { voiceEngine: 'auto' }, respond: () => ({ status: 500, body: {} }) });
    AWAAZ.speak('auto mode', {});
    await wait(150);
    is(state.deviceSaid.length === 1, 'AUTO mode mein purana wada barqarar: nakami par phone bolta hai (khamoshi nahi)',
      'device=' + state.deviceSaid.length);
    AWAAZ.stop();
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
    is(/window\.__nativeTtsDone = function \(\) \{ try \{ if \(AWAAZ\.deviceDone\)/.test(src), 'Kotlin ka TTS-done callback engine se juda hai');
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
        settings: Object.assign({ fishKey: 'fk_test_key_123456', fishOn: true }, opts.settings || {})
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
      is(c2.bridge.calls[0].json.reference_id === undefined,
        'awaaz na chuni ho to reference_id bheja hi nahi jata (Fish default use kare)');
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
      is(/402/.test(FISH.why('PAYMENT')) && /31 Aug/i.test(FISH.why('PAYMENT')),
        'PAYMENT ka matlab insani zubaan mein likha hai (31 Aug wala dar)', FISH.why('PAYMENT').slice(0, 50));
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
      is(seen[0] === 'fish' && seen[1] === 'neural',
        'Fish mar jaye to 🎭 Gemini par jata hai (khamoshi nahi)', seen.join('>'));
      is(state.gcalls.length >= 1, 'Gemini ko sach much request gayi');
    }
    {
      const { AWAAZ } = fishWorld({ reply: { status: 402 }, settings: { apikey: '', ttsKey: '' } });
      const seen = [];
      AWAAZ.speak('Salam', { onStart: (e) => seen.push(e) });
      await wait(50);
      is(seen[0] === 'fish' && seen.indexOf('free') > 0,
        'Fish + Gemini dono na hon to bhi asli awaaz aati hai', seen.join('>'));
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
      is(good.verdict === 'OK' && good.ok === true && /ZINDA HAI/.test(good.text),
        '✅ DOCTOR: 200 + audio = muft daur ZINDA', good.verdict);
      is(/Koi rozana hadd nahi/.test(good.text) && good.bytes > 500,
        'DOCTOR bytes aur "koi hadd nahi" dono batata hai', good.bytes + ' bytes');
      const dead = await mk({ reply: { status: 402, b64: jb64({ message: 'free tier ended' }) } });
      is(dead.verdict === 'PAYMENT' && dead.ok === false && /402/.test(dead.text) && /31 August 2026/.test(dead.text),
        '🚨 DOCTOR: 402 par saaf kehta hai muft window band ho gaya', dead.verdict);
      is(/Edge/.test(dead.text), 'DOCTOR: band hone par bhi tasalli deta hai ke Edge zinda hai');
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
      is(/bufferedReader/.test(KT.slice(KT.indexOf('fun httpPostAsync('), KT.indexOf('fun httpPostAsync(') + 1800)),
        'purana httpPostAsync jyun ka tyun hai (matn ke liye) — koi regression nahi');
      is(/JSONObject\(headersJson\)[\s\S]{0,220}setRequestProperty/.test(KT),
        'Kotlin har custom header bhejta hai (model: s2.1-pro-free is ke bagair na jata)');
      is(src.indexOf('window.__binDone') > 0, 'bytes wapas lene ka darwaza maujood');
    }
  }


  /* ═══ 19. 🎙️ v5.15.0 MERI AWAAZ — STRICT artist: aap ki pasand = QANOON ═══
     F84-F101 ka ilaaj. PEHLE: #artistGrid ki pasand DEAD thi (currentArtist ka koi caller
     nahi), mode "neural" ki speak() mein shakh hi nahi thi, aur FAST/quota/health gates
     chup-chaap artist badal dete the. AB: ARTIST wahid darwaza, strict = sirf wahi. */
  head('19. 🎙️ MERI AWAAZ — strict artist (K5)');
  {
    /* ── 19a. ARTIST: id ka tarjuma + purani pasand ki migration ── */
    const { w, AWAAZ } = makeWorld({ settings: { voiceEngine: 'auto', gVoice: 'Kore' } });
    const AR = w.ARTIST;
    is(typeof AR === 'object' && AR.VER === 1, '🎙️ ARTIST module maujood — pasand ka WAHID darwaza (F86 ka ilaaj)');
    is(AR.parse('g:Zephyr').eng === 'neural' && AR.parse('g:Zephyr').voice === 'Zephyr', 'id "g:Zephyr" → Gemini + wahi voice');
    is(AR.parse('fish').eng === 'fish' && AR.parse('device').eng === 'device', 'id "fish"/"device" → apne engine');
    is(AR.parse('edge:ur-PK-UzmaNeural').eng === 'edge' && AR.parse('edge:ur-PK-UzmaNeural').voice === 'ur-PK-UzmaNeural',
      'id "edge:<voice>" → Edge + wahi voice');
    is(AR.parse('auto').eng === 'auto' && AR.parse('auto').strict !== true, 'id "auto" → machine ki marzi (strict NAHI)');
    is(AR.cur().eng === 'auto' && AWAAZ.cfg().strict === false,
      'DEFAULT (koi pasand nahi) → AUTO: purana rawaiya barqarar, koi zabardasti nahi');
    is(AR.legacyId() === 'auto', 'DEFAULTS ka voiceArtist:"maya" click ka saboot NAHI (har user zabardasti strict na bane)');
    /* 🔑 F85 ka ilaaj: purana DEAD picker ab zinda */
    const w2 = makeWorld({ settings: { voiceArtist: 'zephyr' } });
    is(w2.w.ARTIST.legacyId() === 'zephyr' && w2.w.ARTIST.cur().voice === 'Zephyr' && w2.w.AWAAZ.cfg().strict === true,
      '🔑 F85 ILAAJ: purane artistGrid wala voiceArtist ab ASAL artist ban jata hai (dead picker zinda)');
    is(w2.w.ARTIST.parse('maya').eng === 'neural' && w2.w.ARTIST.parse('maya').voice === 'Kore',
      'purana grid id "maya" → Gemini Kore (VOICE_ARTISTS ab wire hai)');
    /* engine dropdown ki purani pasand bhi migrate */
    const w3 = makeWorld({ settings: { voiceEngine: 'fish' } });
    is(w3.w.ARTIST.cur().eng === 'fish' && w3.w.AWAAZ.cfg().strict === true, 'voiceEngine "fish" → STRICT Fish (migration)');
    const w4 = makeWorld({ settings: { voiceEngine: 'edge', edgeVoice: 'ur-PK-UzmaNeural' } });
    is(w4.w.AWAAZ.cfg().mode === 'edge' && w4.w.AWAAZ.cfg().strict === true, 'voiceEngine "edge" → STRICT Edge');
    is(w4.w.AWAAZ.edgeVoice() === 'ur-PK-UzmaNeural', '🔑 F95 ILAAJ: Edge ki awaaz aap ki pasand wali (khud pick nahi)');
    const w5 = makeWorld({ settings: { voiceEngine: 'neural', gVoice: 'Charon' } });
    is(w5.w.AWAAZ.cfg().mode === 'neural' && w5.w.AWAAZ.voiceId() === 'Charon',
      '🔑 F89 ILAAJ: "neural" chuna to Gemini bolega (Fish nahi) + wahi voice');
    /* knobs ↔ grid ka do-tarfa sync (warna F86 dohra jata) */
    w5.w.settings.voiceEngine = 'device';
    w5.w.ARTIST.syncFromKnobs();
    is(w5.w.settings.artist === 'device' && w5.w.AWAAZ.cfg().mode === 'device',
      '🔑 advanced knob badla → artist foran ham-ahang (form aur grid ek hi sach)');
    w5.w.ARTIST.set('g:Puck');
    is(w5.w.settings.voiceEngine === 'neural' && w5.w.settings.gVoice === 'Puck' && w5.w.AWAAZ.voiceId() === 'Puck',
      '🔑 grid se pasand badli → engine + voice dono settings mein likhe gaye (F84 ka khatma)');
  }

  {
    /* ── 19b. STRICT: sirf chuna hua engine (F89-F93) ── */
    const { w, AWAAZ, state } = fishWorld({ settings: { voiceEngine: 'fish' } });
    const seen = [];
    AWAAZ.speak('salam strict fish', { onStart: (e) => seen.push(e) });
    await wait(40);
    is(seen.join('>') === 'fish' && state.gcalls.length === 0 && state.deviceSaid.length === 0,
      '🎙️ STRICT Fish: sirf Fish boli — na Gemini ka quota jala, na phone', seen.join('>') + ' g=' + state.gcalls.length);
    is(AWAAZ.cfg().strict === true && AWAAZ.switched === 0, '🎙️ STRICT: artist badla = 0 (switched counter saaf)');
    AWAAZ.stop();
  }
  {
    /* STRICT Fish NAKAAM → doosri awaaz NAHI; retry + sawal */
    const { w, AWAAZ, state } = fishWorld({ settings: { voiceEngine: 'fish' }, reply: { status: 429, b64: '', ctype: '', err: 'rate' } });
    const bubbles = []; w.addBubble = (who, t) => bubbles.push(String(t)); w.toast = () => {}; w.pushLog = () => {};
    AWAAZ.speak('fish nakam', {});
    await wait(1500);
    is(AWAAZ.engine !== 'edge' && AWAAZ.engine !== 'device' && state.deviceSaid.length === 0,
      '🔑 STRICT: Fish nakaam (429) hui to Edge/phone par NAHI gira — artist wahi raha', 'engine=' + AWAAZ.engine);
    is(AWAAZ.artistRetries >= 1 && !!AWAAZ.ask && AWAAZ.ask.eng === 'fish',
      '🔑 STRICT: retry USI par, phir ijazat ka sawal (chup-chaap faisla nahi)',
      'retries=' + AWAAZ.artistRetries + ' ask=' + JSON.stringify(AWAAZ.ask || null).slice(0, 60));
    AWAAZ.stop();
  }
  {
    /* 🔑 F90/F91/F99: FAST hijack STRICT mein BAND */
    const { w, AWAAZ, state } = makeWorld({ settings: { voiceEngine: 'neural' }, respond: () => ({ timeout: true }) });
    AWAAZ.FAST = 8;               /* purana code isi timer par Edge/phone par phenk deta tha */
    w.addBubble = () => {}; w.toast = () => {};
    AWAAZ.speak('slow neural', {});
    await wait(120);
    is(AWAAZ.fastTrips === 0, '🔑 F90 ILAAJ: STRICT mein FAST hijack chala hi nahi (fastTrips = 0)', 'trips=' + AWAAZ.fastTrips);
    is(AWAAZ.engine === 'neural' && state.deviceSaid.length === 0,
      '🔑 F91 ILAAJ: awaaz dheemi ho to bhi artist NAHI kata gaya (Edge/phone par nahi phenka)', 'engine=' + AWAAZ.engine);
    AWAAZ.stop();
  }
  {
    /* AUTO mein FAST rescue abhi bhi ARMED hota hai (purana wada barqarar), STRICT mein
       armed HI NAHI hota — kyunke wahi timer pasand ki awaaz ko kaat kar phenk deta tha */
    const { w, AWAAZ } = makeWorld({ settings: { voiceEngine: 'auto' }, respond: () => ({ timeout: true }) });
    AWAAZ.FAST = 5000; w.addBubble = () => {}; w.toast = () => {};
    AWAAZ.speak('slow auto', {});
    is(!!AWAAZ.fastTo, 'AUTO mode mein FAST rescue armed (khamoshi se behtar — purana wada)', 'fastTo=' + AWAAZ.fastTo);
    AWAAZ.stop();
    const w2 = makeWorld({ settings: { voiceEngine: 'neural' }, respond: () => ({ timeout: true }) });
    w2.w.addBubble = () => {}; w2.w.toast = () => {};
    w2.AWAAZ.FAST = 5000;
    w2.AWAAZ.speak('slow strict', {});
    is(!w2.AWAAZ.fastTo && w2.AWAAZ.fastTrips === 0,
      '🔑 F90/F99 ILAAJ: STRICT mein FAST timer ARMED HI NAHI hota (pasand ko kaatne wala pehra khatam)',
      'fastTo=' + w2.AWAAZ.fastTo + ' trips=' + w2.AWAAZ.fastTrips);
    w2.AWAAZ.stop();
  }
  {
    /* 🔑 F92: Gemini ka roz ka quota khatam → STRICT mein Edge par NAHI */
    const { w, AWAAZ, state } = makeWorld({ settings: { voiceEngine: 'neural' } });
    AWAAZ.ttsDay = () => 99;      /* hadd se zyada */
    const bubbles = []; w.addBubble = (who, t) => bubbles.push(String(t)); w.toast = () => {};
    AWAAZ.speak('quota khatam', {});
    await wait(80);
    is(state.deviceSaid.length === 0 && AWAAZ.engine !== 'edge' && state.gcalls.length === 0,
      '🔑 F92 ILAAJ: quota khatam hone par bhi artist NAHI badla, bekar request bhi nahi gayi',
      'engine=' + AWAAZ.engine + ' g=' + state.gcalls.length);
    is(!!AWAAZ.ask && AWAAZ.ask.code === 'QUOTA_DAY' && bubbles.some(b => /quota/i.test(b)),
      '🔑 F100 ILAAJ: quota ki WAJAH screen par sach likhi gayi (chup-chaap nahi)', JSON.stringify(AWAAZ.ask || null).slice(0, 70));
    AWAAZ.stop();
  }
  {
    /* K5.3: aap ka jawab — dobara / sirf ab / hamesha / chup */
    const { w, AWAAZ } = makeWorld({ settings: { voiceEngine: 'neural' } });
    const mk = () => { AWAAZ.ask = { at: Date.now(), code: 'TIMEOUT', eng: 'neural', artist: 'g:Kore', text: 'adhura jawab', lockKey: 'j1' }; };
    mk(); is(AWAAZ.answer('dobara koshish karo').act === 'retry', 'jawab "dobara koshish" → retry (usi artist par)');
    mk(); is(AWAAZ.answer('chup raho').act === 'silent', 'jawab "chup raho" → khamosh (sirf text)');
    mk(); is(AWAAZ.answer('haan edge se bolo').act === 'once', 'jawab "haan … se bolo" → SIRF AB doosri awaaz');
    mk(); const r = AWAAZ.answer('hamesha edge se bola karo');
    is(r.act === 'always' && /edge/.test(r.id), 'jawab "hamesha" → pasand badlo (artist id bhi sath)', JSON.stringify(r));
    mk(); w.toast = () => {}; w.addBubble = () => {};
    const msg = AWAAZ.applyAnswer(AWAAZ.answer('dobara koshish'));
    is(/Dobara/.test(msg) && AWAAZ.ask === null, 'applyAnswer: sawal khatam + dobara bolne lagi', msg);
    AWAAZ.stop();
  }
  {
    /* K5.3: hush — ek hi jawab par sawal DOBARA nahi, doosri awaaz bhi nahi */
    const { w, AWAAZ, state } = makeWorld({ settings: { voiceEngine: 'neural' } });
    AWAAZ.ttsDay = () => 99; w.addBubble = () => {}; w.toast = () => {};
    let doneN = 0;
    AWAAZ.speak('tukra 1', { lockKey: 'jH', onDone: () => doneN++ });
    await wait(60);
    const calls1 = state.calls.length;
    AWAAZ.speak('tukra 2', { lockKey: 'jH', chain: true, onDone: () => doneN++ });
    await wait(30);
    is(state.calls.length === calls1 && doneN === 2,
      '🔑 K5.3: hush — baqi tukron par na nayi koshish na dobara sawal (magar onDone chala: jawab ruka nahi)',
      'calls=' + calls1 + '→' + state.calls.length + ' done=' + doneN);
    AWAAZ.lockBegin('jN');
    is(AWAAZ.hush === false, 'naye jawab par hush saaf (agli baar poori koshish hogi)');
    AWAAZ.stop();
  }
  {
    /* K5.5: lock ab engine + VOICE; Edge ki awaaz jawab bhar EK HI (F95) */
    const { w, AWAAZ, bridge, state } = edgeWorld({ settings: { voiceEngine: 'edge' } });
    AWAAZ.lockBegin('jL');
    AWAAZ.speak('pehla tukra', { lockKey: 'jL' });
    await wait(40);
    const v1 = AWAAZ.lock.voice, e1 = AWAAZ.lock.engine;
    AWAAZ.speak('doosra tukra', { lockKey: 'jL', chain: true });
    await wait(40);
    is(e1 === 'edge' && AWAAZ.lock.engine === 'edge' && !!v1 && AWAAZ.lock.voice === v1,
      '🔑 K5.5 (F95): jawab bhar Edge ki WAHI awaaz — har tukre par dobara pick nahi', v1 + ' → ' + AWAAZ.lock.voice);
    is(!!AWAAZ.lock.artist && AWAAZ.switched === 0, 'K5.5: lock mein artist id darj, artist switch = 0', String(AWAAZ.lock.artist));
    AWAAZ.lockEnd(); AWAAZ.stop();
  }
  {
    /* K5.4: Fish ka preheat + cache → tukron ke beech gap khatam (artist badle baghair raftaar) */
    const { w, AWAAZ, FISH, bridge } = fishWorld({ settings: { voiceEngine: 'fish' }, delay: 1 });
    AWAAZ.lockBegin('jF'); AWAAZ.lock.engine = 'fish'; AWAAZ.lockMatch = true;
    const TXT = 'ye agla tukra hai jo fish par pehle se mangwaya ja raha hai';
    const n = AWAAZ.preheat(TXT);
    is(n === 1 && bridge.calls.length === 1,
      '🔑 K5.4 (F90): Fish par bhi preheat chalta hai (v5.14.0 mein sirf Gemini par tha)', 'n=' + n + ' calls=' + bridge.calls.length);
    await wait(40);
    is(Object.keys(FISH.cache).length === 1, 'preheat ki clip Fish ke cache mein mehfooz', Object.keys(FISH.cache).length + '');
    AWAAZ.lockMatch = false;
    AWAAZ.speak(TXT, {});
    await wait(40);
    is(FISH.cacheHits === 1 && bridge.calls.length === 1,
      '🔑 K5.4: wahi tukra CACHE se baja — nayi request NAHI (gap = 0, artist wahi)',
      'hits=' + FISH.cacheHits + ' calls=' + bridge.calls.length);
    AWAAZ.lockEnd(); AWAAZ.stop();
  }
  {
    /* K5.4: preheat device/edge par bekar request nahi bhejta */
    const { w, AWAAZ, state } = makeWorld({ settings: { voiceEngine: 'device' } });
    AWAAZ.lockBegin('jD'); AWAAZ.lock.engine = 'device'; AWAAZ.lockMatch = true;
    is(AWAAZ.preheat('device par kuch mangwane ko nahi') === 0 && state.calls.length === 0,
      'K5.4: device artist par preheat = 0 (jhoothi ginti nahi, bekar request nahi)');
    AWAAZ.lockEnd(); AWAAZ.stop();
  }
  {
    /* K5.6: namoona (audition) — grid ka 🔊 isi artist par bolta hai, settings chhede baghair */
    const { w, AWAAZ, state } = makeWorld({ settings: { voiceEngine: 'auto', gVoice: 'Kore' } });
    w.toast = () => {}; w.addBubble = () => {};
    const okCall = AWAAZ.speakOnce('g:Zephyr', 'namoona');
    await wait(40);
    is(okCall === true && AWAAZ.engine === 'neural' && AWAAZ.voiceId() === 'Zephyr',
      '🎙️ namoona: chune hue artist par hi bola (auto mode mein bhi)', 'engine=' + AWAAZ.engine + ' voice=' + AWAAZ.voiceId());
    is(w.settings.gVoice === 'Kore', '🎙️ namoone ne aap ki ASAL pasand nahi badli (gVoice wahi)');
    AWAAZ.stop();
    AWAAZ.speak('aam jawab', {});
    await wait(20);
    is(AWAAZ.voiceId() === 'Kore' && AWAAZ.onceArtist === null, 'namoone ke baad aam jawab wapas apni pasand par');
    AWAAZ.stop();
  }
  {
    /* K5.7: pasand mehfooz — Kotlin prefs push + wapsi */
    const { w, AWAAZ } = makeWorld({ settings: { voiceEngine: 'auto' } });
    w.ARTIST.set('edge:ur-PK-UzmaNeural');
    is(/function pullNativePrefs\(/.test(HTML) && /awaaz_" \+ AK\[ai\]/.test(HTML),
      '🔑 K5.7 (F88 ILAAJ): awaaz ki pasand Kotlin prefs mein push AUR wahan se pull hoti hai');
    is(/awaaz_/.test(HTML) && /getPrefString\("awaaz_"/.test(HTML),
      'K5.7: awaaz ki pasand "awaaz_*" prefs mein likhi aur parhi jati hai');
    is(/getPrefString/.test(HTML) && /setPrefString/.test(HTML), 'K5.7: JS side prefs ke dono darwaze (get + set) istemal hote hain');
  }
  {
    /* K5.6/K5.8: UI + PANEL ka sach */
    is(/id="artistChip"/.test(HTML) && /id="artistPolicy"/.test(HTML) && /id="artistGrid"/.test(HTML),
      'K5.6: UI mein chip + grid + policy teeno maujood');
    is(/function paintArtistChip\(\)/.test(HTML) && /function renderArtistPolicy\(\)/.test(HTML),
      'K5.6: chip aur policy chips ke painter maujood');
    is(/window\.selectArtist = function \(id\) \{[\s\S]{0,120}ARTIST\.set\(id\)/.test(HTML),
      '🔑 F84 ILAAJ: selectArtist ab ARTIST.set() bulata hai (sirf settings.voiceArtist nahi likta)');
    is(!/function currentArtist\(/.test(HTML), '🔑 F85 ILAAJ: dead function currentArtist() hata diya (zero-caller code nahi)');
    is(/🎙️ MERI AWAAZ:/.test(HTML) && /ijazat maangi/.test(HTML),
      'K5.8: PANEL mein MERI AWAAZ ka hisaab (pasand · strict · retry · nakam · ijazat)');
    is(/AWAAZ\.ask && \(\(Date\.now\(\) - AWAAZ\.ask\.at\) < AWAAZ\.ASK_MS\)/.test(HTML),
      'K5.3: ijazat ke sawal ka jawab handleUserText mein suna jata hai (90s ki muddat)');
  }


  /* ═══ 20. 🩺 v5.16.0 ARTIST DOCTOR — policy ka ASAL amal + hijack guard + doctor ═══
     v5.15.0 ne qanoon banaya (strict artist). Ye section us qanoon ke DARWAZON ko
     azmata hai: "🔁 dobara" aur "🤫 chup" pehle dead the (F102/F103), jawab ka regex
     naye hukum ko hijack karta tha (F104), "sirf ab" mein awaaz nahi jati thi (F106),
     strict TOO_LONG dead-end tha (F107), Edge id bina jaanch ke chalti thi (F108),
     aur per-artist doctor maujood hi nahi tha (F110). */
  head('20. 🩺 ARTIST DOCTOR — policies ka amal, hijack guard, doctor (K6)');
  {
    /* ── K6.1 (F102): "🔁 Sirf dobara koshish" — pehle DEAD option ── */
    const { w, AWAAZ, FISH, state } = fishWorld({
      settings: { artist: 'fish', artistFail: 'dobara' },
      reply: { status: 429, b64: '', ctype: '', err: 'rate' }
    });
    const bubbles = []; w.addBubble = (who, t) => bubbles.push(String(t)); w.toast = () => {}; w.pushLog = () => {};
    AWAAZ.STRICT_RETRY = 0; AWAAZ.POL_RETRY_DELAY = 120;
    const bridgeBefore = w.MayaBridge.calls.length;
    AWAAZ.speak('dobara policy ka tajurba', { lockKey: 'jD1' });
    await wait(20);
    is(AWAAZ.polRetries === 1 && AWAAZ.ask === null,
      '🩺 K6.1 (F102 ILAAJ): "dobara" policy zinda — USI artist par ek aur koshish, bina sawal',
      'polRetries=' + AWAAZ.polRetries + ' ask=' + JSON.stringify(AWAAZ.ask));
    is(bubbles.length === 0, '🩺 K6.1: koshish ke dauraan koi bubble nahi (aap ne "poochho mat" kaha tha)', bubbles.length + ' bubbles');
    await wait(260);
    is(w.MayaBridge.calls.length > bridgeBefore && AWAAZ.engine !== 'edge' && AWAAZ.engine !== 'device' && state.deviceSaid.length === 0,
      '🩺 K6.1: dobara koshish USI artist par hui (Edge/phone par nahi giri)',
      'calls=' + w.MayaBridge.calls.length + ' engine=' + AWAAZ.engine);
    is(AWAAZ.polRetries === 1 && AWAAZ.tells >= 1 && AWAAZ.ask === null && bubbles.some(b => /dobara bhi nahi bol saki/.test(b)),
      '🩺 K6.1: koshishen khatam → sach likha gaya, sawal NAHI (budget ek hi dafa)',
      'tells=' + AWAAZ.tells + ' bubbles=' + bubbles.length);
    AWAAZ.polRetries = 3; AWAAZ.lockBegin('jD2');
    is(AWAAZ.polRetries === 0, '🩺 K6.1: har naye jawab par "dobara" ka budget tazaa (lockBegin)');
    AWAAZ.stop();
  }
  {
    /* ── K6.1: permanent rukawat par bekar retry NAHI ── */
    const { w, AWAAZ, state } = makeWorld({ settings: { artist: 'g:Kore', artistFail: 'dobara' } });
    w.addBubble = () => {}; w.toast = () => {}; w.pushLog = () => {};
    AWAAZ.ttsDay = () => 99;                    /* QUOTA_DAY = PERMANENT */
    AWAAZ.POL_RETRY_DELAY = 10;
    AWAAZ.speak('quota khatam + dobara policy', { lockKey: 'jD3' });
    await wait(60);
    is(AWAAZ.polRetries === 0 && AWAAZ.tells >= 1 && AWAAZ.ask === null && state.gcalls.length === 0,
      '🩺 K6.1: PERMANENT rukawat (quota) par retry zaya nahi kiya — sach likha, sawal nahi',
      'polRetries=' + AWAAZ.polRetries + ' g=' + state.gcalls.length);
    AWAAZ.stop();
  }
  {
    /* ── K6.2 (F103): "🤫 Chup" — pehle chup kehne par bhi bubble + toast + sawal aata tha ── */
    const { w, AWAAZ, state } = fishWorld({
      settings: { artist: 'fish', artistFail: 'chup' },
      reply: { status: 429, b64: '', ctype: '', err: 'rate' }
    });
    const bubbles = [], toasts = [];
    w.addBubble = (who, t) => bubbles.push(String(t)); w.toast = (t) => toasts.push(String(t)); w.pushLog = () => {};
    AWAAZ.STRICT_RETRY = 0;
    AWAAZ.speak('chup policy ka tajurba', { lockKey: 'jC1' });
    await wait(60);
    is(bubbles.length === 0 && toasts.length === 0 && AWAAZ.ask === null,
      '🩺 K6.2 (F103 ILAAJ): "chup" par NA bubble, NA toast, NA sawal — aap ki marzi chali',
      'bubbles=' + bubbles.length + ' toasts=' + toasts.length + ' ask=' + JSON.stringify(AWAAZ.ask));
    is(AWAAZ.silentFails === 1 && AWAAZ.hush === true && AWAAZ.hushKey === 'jC1',
      '🩺 K6.2: sach ginti mein darj (silentFails) + isi jawab ke baqi tukre chup');
    const before = w.MayaBridge.calls.length;
    AWAAZ.speak('agli chunk usi jawab ki', { lockKey: 'jC1' });
    await wait(20);
    is(w.MayaBridge.calls.length === before && state.deviceSaid.length === 0 && AWAAZ.engine !== 'edge',
      '🩺 K6.2: hush ke baad na doosri awaaz, na baar baar nakami ka shor');
    AWAAZ.stop();
  }
  {
    /* ── K6.3 (F104): hijack guard — naya hukum gum na ho ── */
    const { w, AWAAZ } = makeWorld({ settings: { artist: 'g:Kore' } });
    const mk = () => { AWAAZ.ask = { at: Date.now(), code: 'TIMEOUT', eng: 'neural', artist: 'g:Kore', text: 'adhura jawab', lockKey: 'jH1' }; };
    mk(); is(AWAAZ.answer('theek hai, alarm 7 baje laga do') === null,
      '🩺 K6.3 (F104 ILAAJ): "theek hai, alarm 7 baje laga do" = HUKUM, jawab nahi (alarm gum nahi hoga)');
    mk(); is(AWAAZ.answer('ok mera balance check karo') === null, '🩺 K6.3: "ok mera balance check karo" hijack nahi hua');
    mk(); is(AWAAZ.answer('abhi mausam kaisa hai?') === null, '🩺 K6.3: sawal ("?") jawab nahi samjha jata');
    mk(); is(AWAAZ.answer('youtube par gaana chalao') === null, '🩺 K6.3: hukum ka lafz (youtube/gaana) → hijack nahi');
    mk(); is(AWAAZ.answer('dobara koshish').act === 'retry', '🩺 K6.3: asal jawab "dobara koshish" abhi bhi samjha jata hai');
    mk(); is(AWAAZ.answer('chup raho').act === 'silent', '🩺 K6.3: asal jawab "chup raho" abhi bhi samjha jata hai');
    mk(); is(AWAAZ.answer('haan edge se bolo').act === 'once', '🩺 K6.3: asal jawab "haan edge se bolo" abhi bhi samjha jata hai');
    mk(); is(AWAAZ.answer('hamesha edge se bola karo').act === 'always', '🩺 K6.3: "hamesha …" → pasand badalti hai');
    AWAAZ.ask = null;
    is(AWAAZ.answerOk('haan') === true && AWAAZ.answerOk('dobara koshish karo') === true, 'K6.3: answerOk — chhote saaf jawab qabool');
    is(AWAAZ.answerOk('x'.repeat(41)) === false, 'K6.3: answerOk — 40 se lamba message jawab nahi', 'ANSWER_MAX=' + AWAAZ.ANSWER_MAX);
    is(AWAAZ.answerOk('timer 5 minute ka laga do') === false, 'K6.3: answerOk — number wala message jawab nahi');
    is(AWAAZ.answerOk('kya haal hai؟') === false, 'K6.3: answerOk — Urdu sawal ka nishaan (؟) bhi pakda jata hai');
  }
  {
    /* ── K6.4 (F106): "sirf ab … se bolo" → engine AUR awaaz ── */
    const { w, AWAAZ } = makeWorld({ settings: { artist: 'g:Kore', edgeVoice: 'ur-PK-UzmaNeural', edgeTTS: true } });
    w.addBubble = () => {}; w.toast = () => {}; w.pushLog = () => {};
    AWAAZ.ask = { at: Date.now(), code: 'TIMEOUT', eng: 'neural', artist: 'g:Kore', text: 'adhura jawab', lockKey: 'jO1' };
    const r = AWAAZ.answer('haan edge se bolo');
    const msg = AWAAZ.applyAnswer(r);
    is(!!r && r.act === 'once' && AWAAZ.onceArtist && AWAAZ.onceArtist.eng === 'edge' && AWAAZ.onceArtist.voice === 'ur-PK-UzmaNeural',
      '🩺 K6.4 (F106 ILAAJ): "sirf ab" mein AWAAZ bhi sath jati hai (sirf engine nahi)',
      JSON.stringify(AWAAZ.onceArtist || null).slice(0, 80));
    is(AWAAZ.edgeVoice() === 'ur-PK-UzmaNeural' && /bol rahi hoon/.test(msg),
      '🩺 K6.4: Edge waade ki hui awaaz (Uzma) par bola — jo likha woh kiya', AWAAZ.edgeVoice());
    AWAAZ.stop(); AWAAZ.ask = null; AWAAZ.hush = false;
    AWAAZ.speak('aam jawab', {});
    is(AWAAZ.onceArtist === null, '🩺 K6.4: agle AAM jawab par "sirf ab" ki pasand khud saaf (chipkti nahi)');
    AWAAZ.stop();
  }
  {
    /* ── K6.5 (F107): strict + TOO_LONG = dead-end tha; ab usi artist par tukre ── */
    const { w, AWAAZ, state } = makeWorld({ settings: { artist: 'g:Kore', neuralMaxChars: 200 } });
    w.addBubble = () => {}; w.toast = () => {}; w.pushLog = () => {};
    /* har jumla ALAG — warna clip cache wahi tukra dohra deta (test ka maqsad gum) */
    let long = '';
    for (let li = 0; li < 14; li++) long += 'Jumla number ' + (li + 1) + ' mein bilkul alag baat likhi gayi hai taake har tukra nayi request bane. ';
    AWAAZ.speak(long, { lockKey: 'jL1' });
    await wait(120);
    is(AWAAZ.longSplits === 1 && state.gcalls.length > 1,
      '🩺 K6.5 (F107 ILAAJ): hadd se lamba text USI artist par tukron mein bola (dead-end khatam)',
      'splits=' + AWAAZ.longSplits + ' requests=' + state.gcalls.length);
    is(AWAAZ.engine === 'neural' && state.deviceSaid.length === 0 && AWAAZ.ask === null,
      '🩺 K6.5: artist wahi raha (Edge/phone nahi), koi sawal nahi — awaaz nikalti hai');
    AWAAZ.stop();
    const { AWAAZ: A2, state: s2 } = makeWorld({ settings: { artist: 'g:Kore', neuralMaxChars: 1400 } });
    A2.speak('Chhota jawab.', { lockKey: 'jL2' });
    await wait(40);
    is(A2.longSplits === 0 && s2.gcalls.length === 1, '🩺 K6.5: chhote text par tukre NAHI (bekar request nahi)', 'g=' + s2.gcalls.length);
    A2.stop();
  }
  {
    /* ── K6.6 (F108): Edge ki awaaz ka saboot ── */
    const { w, AWAAZ, EDGE_TTS } = makeWorld({ settings: { artist: 'auto' } });
    is(w.ARTIST.edgeOk('ur-PK-UzmaNeural') === true, '🩺 K6.6: qanooni Edge id qabool');
    is(w.ARTIST.edgeOk('garbage') === false && w.ARTIST.edgeOk('') === false, '🩺 K6.6 (F108 ILAAJ): ghalat/khaali Edge id reject');
    const bad = w.ARTIST.parse('edge:garbage');
    is(w.ARTIST.edgeOk(bad.voice) === true,
      '🩺 K6.6: ghalat id → qanooni pasand (har tukra nakam hone se bacha)', 'voice=' + bad.voice);
    is(w.ARTIST.parse('edge:ur-PK-AsadNeural').voice === 'ur-PK-AsadNeural', '🩺 K6.6: sahi id waisi hi rehti hai (pasand zaya nahi)');
    is(w.ARTIST.parse('neural').eng === 'neural' && w.ARTIST.parse('gemini').eng === 'neural',
      '🩺 K6.6 (F113 ILAAJ): purana naam "neural"/"gemini" bhi pasand samjha jata hai (chup-chaap AUTO nahi)');
    w.settings.artist = 'neural'; w.settings.gVoice = 'Zephyr';
    is(w.ARTIST.cur().strict === true && w.ARTIST.cur().voice === 'Zephyr',
      '🩺 K6.6 (F113): "neural" se 🔒 strict + aap ki Gemini awaaz (qanoon gum nahi hua)', JSON.stringify(w.ARTIST.cur()).slice(0, 70));
  }
  {
    /* ── K6.7 (F105): muddat ka ek hi saboot ── */
    const { w, AWAAZ } = makeWorld({ settings: { artist: 'g:Kore' } });
    AWAAZ.ask = { at: Date.now(), code: 'TIMEOUT', eng: 'neural', artist: 'g:Kore', text: 'x', lockKey: 'jA1' };
    is(AWAAZ.askLive() === true, '🩺 K6.7: taaza sawal zinda');
    AWAAZ.ask.at = Date.now() - (AWAAZ.ASK_MS + 1000);
    is(AWAAZ.askLive() === false && AWAAZ.answer('haan bolo') === null,
      '🩺 K6.7 (F105 ILAAJ): BAASI sawal par amal nahi hota (answer() khud muddat dekhta hai)');
    AWAAZ.ask = null; is(AWAAZ.askLive() === false, 'K6.7: koi sawal nahi to askLive false');
  }
  {
    /* ── K6.8 (F110/F111): ARTIST DOCTOR — har awaaz ka haal, bina network ── */
    const { w, AWAAZ, state } = makeWorld({ settings: { artist: 'fish', fishKey: 'fk_test_key_123456', fishOn: true }, native: true });
    w.addBubble = () => {}; w.toast = () => {}; w.pushLog = () => {};
    const L = AWAAZ.artistDoctor();
    is(Array.isArray(L) && L.length >= 16, '🩺 K6.8 (F110 ILAAJ): ARTIST DOCTOR report deta hai', L.length + ' lines');
    is(/^🩺 ARTIST DOCTOR/.test(L[0]), '🩺 K6.8: report ka sar-naam + waqt');
    const txt = L.join('\n');
    is(/Aap ki pasand/.test(txt) && /🔒 SIRF yahi bolegi/.test(txt), '🩺 K6.8: aap ki pasand + strict ka sach');
    is(/Nakami policy/.test(txt) && /poochho/.test(txt), '🩺 K6.8: nakami ki policy darj');
    is(/🐟 FISH/.test(txt) && /🎭 GEMINI/.test(txt) && /🌊 EDGE/.test(txt) && /📱 PHONE/.test(txt),
      '🩺 K6.8: charon artist ka alag-alag muaina');
    is(/Hisab \(is session\)/.test(txt) && /Nateeja/.test(txt), '🩺 K6.8: session ka hisaab + nateeja');
    is(state.calls.length === 0, '🩺 K6.8: doctor NE koi network request NAHI bheji (offline bhi chalta hai)', 'calls=' + state.calls.length);
    AWAAZ.lat.fish = 640; AWAAZ.fishSpoke = 3; AWAAZ.artistFails = 2; AWAAZ.asks = 1;
    const L2 = AWAAZ.artistDoctor().join('\n');
    is(/640ms/.test(L2) && /boli: 3 dafa/.test(L2) && /nakam 2/.test(L2) && /ijazat maangi 1/.test(L2),
      '🩺 K6.8 (F111 ILAAJ): latency + ginti doctor mein dikhti hai (andaza nahi, aankre)');
    AWAAZ.ttsDay = () => 99;
    is(/QUOTA_DAY/.test(AWAAZ.artistDoctor().join('\n')), '🩺 K6.8: Gemini ka roz ka quota doctor mein saaf');
    AWAAZ.stop();
  }
  {
    /* ── K6.8: doctor AUTO mode ka sach bhi bolta hai ── */
    const { w, AWAAZ } = makeWorld({ settings: { artist: 'auto' } });
    w.addBubble = () => {}; w.toast = () => {}; w.pushLog = () => {};
    const t = AWAAZ.artistDoctor().join('\n');
    is(/🤖 AUTO/.test(t) && /Nateeja/.test(t), '🩺 K6.8: AUTO par doctor jhoot nahi bolta (machine chunegi + kaun tayyar hai)');
    is(typeof AWAAZ.status().lat === 'number' && typeof AWAAZ.status().askLive === 'boolean',
      '🩺 K6.8: status() mein latency + sawal ki zindagi (PANEL/doctor ek hi saboot se)');
  }
  {
    /* ── K6.8: phone ki awaaz ka hisaab (deviceSpoke pehle maujood hi nahi tha) ── */
    const { w, AWAAZ, state } = makeWorld({ settings: { artist: 'device' } });
    w.addBubble = () => {}; w.toast = () => {}; w.pushLog = () => {};
    AWAAZ.speak('phone ki awaaz ka tajurba', { lockKey: 'jP1' });
    await wait(30);
    is(AWAAZ.deviceSpoke === 1 && state.deviceSaid.length === 1,
      '🩺 K6.8: phone ki awaaz bhi ginti mein (doctor pehle andaza lagata)', 'deviceSpoke=' + AWAAZ.deviceSpoke);
    AWAAZ.stop();
  }
  {
    /* ── regression: "koi bhi" ijazat par ladder + sach (v5.15.0 ka wada barqarar) ── */
    const { w, AWAAZ, state } = fishWorld({
      settings: { artist: 'fish', artistFail: 'koi_bhi' },
      reply: { status: 429, b64: '', ctype: '', err: 'rate' }
    });
    const bubbles = []; w.addBubble = (who, t) => bubbles.push(String(t)); w.toast = () => {}; w.pushLog = () => {};
    AWAAZ.STRICT_RETRY = 0;
    AWAAZ.speak('koi bhi policy', { lockKey: 'jK1' });
    await wait(120);
    is(AWAAZ.switched >= 1 && AWAAZ.allowed >= 1 && bubbles.some(b => /ijazat se doosri awaaz/.test(b)),
      '🩺 regression: "koi bhi" par ladder chalti hai magar SACH + ginti ke sath (chup-chaap nahi)',
      'switched=' + AWAAZ.switched + ' bubbles=' + bubbles.length);
    AWAAZ.stop();
  }

  console.log('\n\x1b[1m\x1b[35m══════════════════════════════════════════════════════════\x1b[0m');
  if (fail === 0) console.log('\x1b[1m\x1b[32m✅ SAB TEST PASS — ' + pass + '/' + pass + '\x1b[0m');
  else console.log('\x1b[1m\x1b[31m❌ ' + fail + ' TEST FAIL — ' + pass + '/' + (pass + fail) + ' pass\x1b[0m');
  console.log('\x1b[1m\x1b[35m══════════════════════════════════════════════════════════\x1b[0m\n');
  process.exit(fail === 0 ? 0 : 1);
})();
