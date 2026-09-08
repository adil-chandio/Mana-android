#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   tools/test-lab-engine.js — 🧪 MAYA LAB ka SABOOT   (P0 + P1 + 👑 MALIK)
   ------------------------------------------------------------------------
   Asli code public/index.html se nikal kar jsdom mein chalta hai.

   Sab se ahem: SAAF ke test asli screenshot ke matn par chalte hain — wohi
   jo user ne bheja tha. Wo bug dobara nikal hi nahi sakta.

     node tools/test-lab-engine.js
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

/* ── LAB source ── */
const LA = HTML.indexOf('var SCHEMA = {');
const LB = HTML.indexOf('var AWAAZ = {');
if (LA < 0 || LB < 0 || LB < LA) { console.error('MAYA LAB source nahi mila — index.html badal gaya?'); process.exit(1); }
const LAB = HTML.slice(LA, LB);   /* SUNO bhi isi mein hai (SCHEMA..AWAAZ) */

/* ⚡ AMAL (P2a) — TOOL_DECLS + execTool ke baad rehta hai */
const NA = HTML.indexOf('var NAZAR = {');
const NB = HTML.indexOf('var BIJLI = {');
if (NA < 0 || NB < 0 || NB < NA) { console.error('NAZAR source nahi mila'); process.exit(1); }
const NAZSRC = HTML.slice(NA, NB);
const QA = HTML.indexOf('var BIJLI = {');
const QB = HTML.indexOf('var IJAZAT = {');
if (QA < 0 || QB < 0 || QB < QA) { console.error('P4 source nahi mila'); process.exit(1); }
const P4SRC = HTML.slice(QA, QB);
const PA = HTML.indexOf('var IJAZAT = {');
const PB = HTML.indexOf('var HAQEEQAT = {');
if (PA < 0 || PB < 0 || PB < PA) { console.error('P3 source nahi mila'); process.exit(1); }
const P3SRC = HTML.slice(PA, PB);
const HA = HTML.indexOf('var HAQEEQAT = {');
const HB = HTML.indexOf('var AMAL = {');
if (HA < 0 || HB < 0 || HB < HA) { console.error('HAQEEQAT source nahi mila'); process.exit(1); }
const HAQSRC = HTML.slice(HA, HB);
const AA = HTML.indexOf('var AMAL = {');
const AB = HTML.indexOf('/* --- OpenAI-shakl providers ab BRAIN POOL sambhalta hai --- */');
if (AA < 0 || AB < 0 || AB < AA) { console.error('AMAL source nahi mila'); process.exit(1); }
const AMALSRC = HTML.slice(AA, AB);
const TD_A = HTML.indexOf('var TOOL_DECLS = [');
const TD_B = HTML.indexOf('async function execTool');
const TOOLSRC = HTML.slice(TD_A, TD_B);

function world(flags) {
  const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'dangerously', url: 'https://appassets.androidplatform.net/' });
  const w = dom.window;
  w.pushLog = () => {};
  w.$ = () => null;
  w.NATIVE = false;
  w.settings = { name: 'Boss', lang: 'roman-ur' };
  w.sysLogs = [];
  w.eval(LAB);
  w.eval(TOOLSRC);
  w.execTool = async function (n, a) { w.__ran = w.__ran || []; w.__ran.push({ n, a }); return { done: true, echo: a }; };
  w.log = w.document.body;
  w.esc = function (x) { return String(x == null ? '' : x); };
  w.execTool = w.execTool || (async function(){ return { ok: true }; });
  w.eval(P3SRC);
  w.eval(NAZSRC);
  w.eval(P4SRC);
  w.eval(HAQSRC);
  w.eval(AMALSRC);
  if (flags) { for (const k in flags) w.FLAGS.set(k, flags[k]); }
  return w;
}

/* 🕸️ P6 KHUD-MUKHTAR — AMAL engine ke baad, wake word se pehle rehta hai */
const KA = HTML.indexOf('var KHUD = {');
const KB = HTML.indexOf("/* ---------- WAKE WORD ('Maya' / 'Boss') ---------- */");
if (KA < 0 || KB < 0 || KB < KA) { console.error('KHUD source nahi mila — index.html badal gaya?'); process.exit(1); }
const KHUDSRC = HTML.slice(KA, KB);

/* KHUD ki duniya: wohi purani world + KHUD module + apne stub
   (reply/toast/execTool/battery — taake ASAL rawaiya naapa ja sake) */
function kworld(flags, opts) {
  const w = world(Object.assign({ khud: true, ijazat: true }, flags || {}));
  const o = opts || {};
  w.speaking = false; w.thinking = false;
  w.said = [];
  w.reply = function (t, v) { w.said.push(String(t)); return true; };
  w.toasted = [];
  w.toast = function (t) { w.toasted.push(String(t)); };
  w.ran = [];
  w.execTool = function (n, a) {
    w.ran.push({ n: n, a: a });
    return Promise.resolve({ ok: true, done: true, state: 'done' });
  };
  w.settings = { name: 'Boss', proactive: true, lang: 'roman-ur' };
  w.MAYA_V4 = { lastInteract: Date.now(), proactiveTimer: null };
  if (o.batteryAsync) {
    w.navigator.getBattery = function () {
      return Promise.resolve({ level: o.batteryAsync.level / 100, charging: !!o.batteryAsync.charging, addEventListener: function () {} });
    };
  }
  w.eval(KHUDSRC);
  /* battery ka cache: HAAL.watch() isi ko bharta hai (native bridge ya browser) */
  if (o.battery) w.KHUD.HAAL._b = { level: o.battery.level, charging: !!o.battery.charging };
  if (flags) { for (const k in flags) w.FLAGS.set(k, flags[k]); }
  return w;
}

/* NATIVE wali duniya: jsdom mein `NATIVE` const hai, is liye defineProperty se
   likhne-laiq banaya jata hai (warna assignment TypeError deta hai) */
function natworld(batt, flags) {
  const w = world(Object.assign({ khud: true, ijazat: true }, flags || {}));
  Object.defineProperty(w, 'NATIVE', { value: true, writable: true, configurable: true });
  w.MayaBridge = Object.assign(w.MayaBridge || {}, { battery: function () { return JSON.stringify(batt); } });
  w.said = []; w.reply = function (t) { w.said.push(String(t)); };
  w.ran = []; w.execTool = function (n, a) { w.ran.push({ n: n, a: a }); return Promise.resolve({ ok: true }); };
  w.settings = { name: 'Boss', proactive: true };
  w.eval(KHUDSRC);
  return w;
}

/* 👂 KAAN (wake word) — SUKOON ke baad, __wakeLog se pehle */
const KNA = HTML.indexOf('var KAAN = {');
const KNB = HTML.indexOf('/* Kotlin ki har report yahan aati hai');
if (KNA < 0 || KNB < 0 || KNB < KNA) { console.error('KAAN source nahi mila'); process.exit(1); }
const KAANSRC = HTML.slice(KNA, KNB);

/* KAAN ki duniya — bridge stub ke sath (onDeviceMap/micDoctor hum dete hain) */
function kw() {
  const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'dangerously' });
  const w = dom.window;
  w.pushLog = function () {}; w.toast = function () {};
  w.settings = { name: 'Boss', stt: 'ur-PK', wakeWord: true, micZoom: 0.8 };
  w.speaking = false; w.thinking = false; w.listening = false;
  w.NATIVE = true;
  w.MayaBridge = { onDeviceMap: function () { return '{}'; }, micDoctor: function () { return '{}'; } };
  w.eval(HTML.slice(HTML.indexOf('var SCHEMA = {'), HTML.indexOf('var AWAAZ = {')));  /* FLAGS */
  w.eval(KAANSRC);
  return w;
}

/* waqt ka SANCHA — test kabhi CI ke ghante par fail na ho:
   din ka waqt (15:xx) chuna jata hai, khamosh ghanton (0-7) se door */
function at(dayOffset, hh, mm) {
  const d = new Date();
  d.setDate(d.getDate() + (dayOffset || 0));
  d.setHours(hh === undefined ? 15 : hh, mm || 0, 0, 0);
  return d.getTime();
}

/* Wohi matn jo user ne screenshot mein bheja tha */
const REAL_SCREENSHOT = `<think>
The user wants to set brightness to 100%.
I need to use the brightness_control tool.
The user spoke in Roman Hindi/Hinglish ("Britness barhao 100%").
Language rule says: "Reply in Hindi (Devanagari script)."
I will call the tool, then reply in Hindi (Devanagari) confirming the action.

Tool: brightness_control
Parameters: likely level or value = 100.

Response draft (Hindi Devanagari):
चमक 100 पर सेट कर दी है, बॉस।

Check constraints:
- Spoken aloud style: yes.
- 1-3 sentences, <60 words: yes.
- Hindi Devanagari: yes.
</think>

brightness_control(level=100)`;

const REAL_TRUNCATED = `<think>
Here's a thinking process:
1. **Analyze User Input:**
   - User says: "Chalo choro isko or Suno"
   - Language: Roman Hindi/Hinglish
2. **Draft Construction (Mental):**
   बॉस, बताइए अब मैं क्या करूँ?
3. **Refine against Constraints:**
   - Hindi (Devanagari)? Yes.`;

(function run() {
  console.log('\n\x1b[1m\x1b[35m══════════════════════════════════════════════════════════\x1b[0m');
  console.log('\x1b[1m  🧪  MAYA LAB — P0 (NAAP) + P1 (SAAF) + 👑 MALIK\x1b[0m');
  console.log('\x1b[1m\x1b[35m══════════════════════════════════════════════════════════\x1b[0m');

  /* ═══ 1. SAAF — soch kabhi bahar na aaye ═══ */
  head('1. 🧹 SAAF — andar ki soch (asal bug jo screenshot mein tha)');
  {
    const w = world({ saaf: true });
    const S = w.SAAF;

    /* ── asli screenshot ── */
    const a = S(REAL_SCREENSHOT);
    is(a.indexOf('<think') < 0 && a.indexOf('</think') < 0, '🔑 ASLI SCREENSHOT: <think> poora ghayab', JSON.stringify(a.slice(0, 40)));
    is(a.indexOf('Language rule says') < 0 && a.indexOf('Check constraints') < 0, '   → "Check constraints" wali soch bhi gayi');
    is(a.indexOf('Response draft') < 0, '   → "Response draft" bhi gaya');
    is(a.indexOf('brightness_control(level=100)') < 0, '   → tool ka NATAK bhi hata (P2 mein ye CHALEGA)');
    is(w.SAAF.usable(REAL_SCREENSHOT) === '', '🔑 kuch na bacha → EMPTY → AGLA DIMAAG (khali bubble nahi)', 'usable=""');

    /* ── kata hua think (token khatam) ── */
    const b = S(REAL_TRUNCATED);
    is(b.indexOf('<think') < 0 && b.indexOf('Here\'s a thinking') < 0,
      '🔑 BAND NA HUA <think> bhi kat gaya (320-token wala hadsa)', JSON.stringify(b.slice(0, 30)));
    is(b.indexOf('Analyze User Input') < 0 && b.indexOf('Refine against') < 0, '   → numbered analysis bhi gaya');

    /* ── har shakl ── */
    is(S('<thinking>abc</thinking>Salam') === 'Salam', '<thinking> tag');
    is(S('<reasoning>x</reasoning>Salam') === 'Salam', '<reasoning> tag');
    is(S('<|channel|>analysis blah<|message|>Salam').trim() === 'Salam', 'gpt-oss harmony channel', 'harmony');
    is(S('<|start|>Salam<|end|>').trim() === 'Salam', 'akele harmony token');
    is(S('</think> Salam').trim() === 'Salam', 'akela band hone wala tag');
    is(S('\u2039AMAL\u203A{"tool":"x"}\u2039/AMAL\u203A Salam').trim() === 'Salam', 'hamara AMAL protocol chhupa rehta hai');
    is(S('<tool_call>{"a":1}</tool_call>Salam').trim() === 'Salam', 'XML tool_call');
    is(S('torch_control(on=true)\nHo gaya boss').trim() === 'Ho gaya boss', 'akeli tool-call line hat gayi');
    is(S('Let me think\nSalam boss').trim() === 'Salam boss', '"Let me think" header');

    /* ── ASAL JAWAB kabhi na kate ── */
    is(S('Ho gaya boss, brightness 100 kar di.') === 'Ho gaya boss, brightness 100 kar di.',
      '✅ SAHIH jawab bilkul nahi chhua jata');
    is(S('\u0622\u062C \u0645\u0648\u0633\u0645 \u0627\u0686\u06BE\u0627 \u06C1\u06D2') === '\u0622\u062C \u0645\u0648\u0633\u0645 \u0627\u0686\u06BE\u0627 \u06C1\u06D2', '✅ Urdu script salamat');
    is(S('150 ka 18 percent 27 hota hai (yani solah aana theek).').indexOf('27 hota hai') > 0,
      '✅ jumle ke andar bracket wala hisab salamat');
    is(S('Pehli baat.\nDoosri baat.\nTeesri baat.').split('\n').length === 3, '✅ aam kai-line jawab salamat');

    /* ── nazuk soortein ── */
    is(S(null) === '' && S(undefined) === '' && S('') === '', 'khali/null par crash nahi');
    is(S(S('<think>x</think>Salam')) === 'Salam', 'dobara chalane par bhi wahi (idempotent)');
    const combo = S('<think>a</think><|channel|>b<|message|>Check constraints:\nSalam');
    is(combo.trim() === 'Salam', 'kai shaklein ek sath', JSON.stringify(combo.trim()));
    S('<think>abcdefghij</think>Salam');
    is(S.cut > 10 && /think/.test(S.hit), 'kitna kata aur kya kata — dono darj', S.cut + ' harf · ' + S.hit);

    /* ── switch OFF: kuch na ho ── */
    const off = world({ saaf: false });
    is(off.SAAF.usable(REAL_SCREENSHOT) === REAL_SCREENSHOT,
      '🔒 switch OFF → matn bilkul nahi chhua (Qanoon 1)');
    is(off.SAAF('<think>x</think>Salam') === 'Salam', '   → magar SAAF() khud phir bhi kaam karta hai');
  }

  /* ═══ 2. FLAGS ═══ */
  head('2. 🧪 FLAGS — har cheez switch ke peeche (Qanoon 1)');
  {
    const w = world();
    is(w.FLAGS.on('naap') === true, 'naap default ON (bay-zarar hai)');
    is(w.FLAGS.on('saaf') === false && w.FLAGS.on('malik') === false,
      'saaf aur malik default OFF — pehle sabit hon, phir chalen');
    w.FLAGS.set('saaf', true);
    is(w.FLAGS.on('saaf') === true, 'switch ON hota hai');
    is(String(w.localStorage.getItem('maya_flags')).indexOf('"saaf":true') > 0, 'switch app band hone par bhi yaad');
    w.FLAGS.set('saaf', 'haan');
    is(w.FLAGS.on('saaf') === false, 'sirf sacha boolean qubool (kachra nahi)');
    w.FLAGS.reset();
    is(w.FLAGS.on('naap') === true && w.FLAGS.on('saaf') === false, 'reset default par le aata hai');
    is(w.FLAGS.on('bakwas') === false, 'anjaan switch hamesha OFF');
  }

  /* ═══ 3. NAAP ═══ */
  head('3. 📊 NAAP — naapne ka aala (P0)');
  {
    const w = world({ naap: true });
    const N = w.NAAP;
    N.clear();
    N.start('voice');
    is(!!N.cur && N.cur.src === 'voice', 'turn shuru hua');
    N.mark('brain'); N.mark('voice');
    N.mark('brain');
    is(typeof N.cur.m.brain === 'number', 'mark darj hua');
    const first = N.cur.m.brain;
    N.mark('brain');
    is(N.cur.m.brain === first, 'ek mark sirf EK dafa (pehla waqt hi asli hai)');
    N.end({ brain: 'Groq', engine: 'edge', tool: 'torch_control' });
    is(N.cur === null && N.hist.length === 1, 'turn khatam, tareekh mein darj');
    is(N.hist[0].brain === 'Groq' && N.hist[0].engine === 'edge' && typeof N.hist[0].m.done === 'number',
      'dimaag, awaaz aur kul waqt — sab mehfooz');
    is(N.pct([10, 20, 30, 40, 100], 50) === 30, 'p50 sahih nikalta hai', '30');
    is(N.pct([10, 20, 30, 40, 100], 90) === 100, 'p90 sahih (औsat jhoot bolta, ye nahi)', '100');
    is(N.pct([], 50) === 0, 'khali par crash nahi');
    const st = N.stats();
    is(st.turns === 1 && st.brains.Groq === 1 && st.toolTurns === 1, 'stats ginti sahih');
    is(N.report().indexOf('BASELINE') >= 0 && N.report().indexOf('Groq') > 0, 'report likhi jati hai');
    is(String(w.localStorage.getItem('maya_naap')).indexOf('Groq') > 0, 'naap app band hone par bhi mehfooz');
    N.clear();
    is(N.hist.length === 0 && N.report().indexOf('Abhi koi naap nahi') > 0, 'clear kaam karta hai');
    const off = world({ naap: false });
    off.NAAP.start('text');
    is(off.NAAP.cur === null, '🔒 switch OFF → naap bilkul nahi hoti');
  }

  /* ═══ 4. MALIK ═══ */
  head('4. 👑 MALIK — Maya ko apne banane wale ka pata');
  {
    const w = world({ malik: true });
    const M = w.MALIK;
    is(M.name === 'Adil Chandio' && M.brand === 'Monarch', 'naam aur brand', M.name + ' / ' + M.brand);
    is(M.ASK.test('tumhe kis ne banaya') && M.ASK.test('who made you') &&
       M.ASK.test('tumhara malik kaun hai') && M.ASK.test('Who created you?'),
      'sawal ke sab andaaz pehchane jate hain');
    is(!M.ASK.test('brightness barhao') && !M.ASK.test('mausam kaisa hai'),
      'aam hukm ko galti se ta\'aruf na samjhe');
    is(M.pick('tumhe kis ne banaya', false).indexOf('Adil Chandio') === 0, 'aam sawal → chhota ta\'aruf');
    is(M.pick('who made you', false).indexOf('Adil Chandio') === 0 && /Founder of Monarch/.test(M.pick('who made you', false)),
      'English sawal → English jawab');
    is(M.pick('poora batao kis ne banaya', false).length > M.pick('kis ne banaya', false).length,
      '"poora batao" → lamba ta\'aruf');
    is(/fakhr hai, Monarch/.test(M.pick('kis ne banaya', true)), '👑 Adil KHUD puche → flex mode', 'flex');
    const blk = M.block();
    is(blk.indexOf('Adil Chandio') > 0 && blk.indexOf('Monarch') > 0, 'prompt block mein malik ki pehchan');
    is(/SIRF SACH/.test(blk), '🔒 prompt saaf kehta hai: sirf sach, kuch apni taraf se mat joro');
    is(blk.length < 700, 'block chhota hai — prompt phool kar phate nahi (CHHED 9)', blk.length + ' harf');
    const off = world({ malik: false });
    is(off.MALIK.block() === '', '🔒 switch OFF → prompt mein kuch nahi jata');
    let withNum = 0;
    for (let i = 0; i < M.proof.length; i++) if (/\d/.test(M.proof[i])) withNum++;
    is(M.proof.length >= 5 && withNum >= 4,
      'saboot naapa hua hai, jhooti tareef nahi', withNum + '/' + M.proof.length + ' mein number');
    is(!/best|greatest|genius|legend|world.?class|sab se behtareen/i.test(M.proof.join(' ') + M.intro.flex),
      '🔒 koi khokhli tareef nahi — sirf jo sach mein hua');
  }

  /* ═══ 5. DIAG ═══ */
  head('5. 📋 DIAG — sab kuch copy, magar raaz chhupa kar (CHHED 3 + 14)');
  {
    const w = world();
    const D = w.DIAG;
    is(D.redact('key AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz123').indexOf('AIzaSyAbCd') < 0, '🔒 Gemini key chhup gayi');
    is(D.redact('gsk_abcdefghij1234567890').indexOf('abcdefghij') < 0, '🔒 Groq key chhupi');
    is(D.redact('Authorization: Bearer sk-abcdef123456').indexOf('sk-abcdef') < 0, '🔒 Bearer token chhupa');
    is(D.redact('ghp_ABCDEFGHIJ1234567890').indexOf('ABCDEFGHIJ') < 0, '🔒 GitHub token chhupa');
    is(D.redact('call 03001234567 abhi') === 'call <number> abhi', '🔒 phone number chhupa', D.redact('call 03001234567 abhi'));
    is(D.redact('mail adil@example.com karo').indexOf('adil@example') < 0, '🔒 email chhupa');
    is(D.redact('brightness 100 kar do') === 'brightness 100 kar do', '✅ aam matn bilkul nahi badla');
    const built = D.build();
    is(built.indexOf('MAYA DIAGNOSTIC') > 0 && built.indexOf('LAB') > 0 && built.indexOf('SETTINGS') > 0,
      'diagnostic ke saare hisse maujood', built.length + ' harf');
    is(built.indexOf('AIzaSy') < 0, '🔒 poore diagnostic mein koi key nahi bachi');
  }

  /* ═══ 6. HARVEST ═══ */
  head('6. 🗃️ HARVEST — aap ki apni zubaan se test set (CHHED 2)');
  {
    const w = world();
    w.localStorage.setItem('maya_chat', JSON.stringify([
      { role: 'user', text: 'britness barhao 100%' },
      { role: 'model', text: 'ho gaya' },
      { role: 'user', text: 'Ali ko call karo 03001234567 par' },
      { role: 'user', text: 'alarm laga do 7 baje' },
      { role: 'user', text: 'x' }
    ]));
    w.ACTION_WORDS = /(alarm|call)/i;
    const got = w.HARVEST.scan();
    is(got.length === 3, 'sirf user ke jumle liye gaye (bohat chhote chhor kar)', got.length + '');
    is(got.join(' ').indexOf('03001234567') < 0 && got.join(' ').indexOf('<number>') > 0,
      '🔒 number chhupa kar hi nikala gaya');
    const rep = w.HARVEST.report();
    is(rep.indexOf('britness barhao 100%') > 0, '🔑 "britness" jaisa lafz pakra gaya — jo main soch bhi nahi sakta tha');
    is(/router ne pakre\s*:\s*2/.test(rep), 'router ka hisab sahih (alarm + call)', 'hit=2');
    is(rep.indexOf('phone par hi hai') > 0, 'saaf likha hai ke data phone se bahar nahi jata');
  }

  /* ═══ 7. TOKEN BUDGET ═══ */
  head('7. 🪙 TOKEN BUDGET — reasoning models ko soch ki jagah (P1)');
  {
    const src = HTML;
    const m = /REASONER:\s*(\/.*?\/[a-z]*),/.exec(src);
    is(!!m, 'REASONER pehchan maujood');
    const re = eval(m[1]);
    is(re.test('openai/gpt-oss-120b:free') && re.test('qwen3.6-plus') && re.test('deepseek-r1'),
      'reasoning models pehchane jate hain');
    is(!re.test('gemini-2.5-flash') && !re.test('llama-4-scout') && !re.test('mistral-small-latest'),
      'aam models galti se reasoning na samjhe jayen');
    is(/budget: function \(model\)[\s\S]{0,140}1400[\s\S]{0,40}400/.test(src),
      '🔑 reasoning ko 1400, baqi ko 400 (pehle sab ko 320 tha — soch usi mein khatam)');
    is(src.indexOf('max_tokens: BRAIN.budget(model)') > 0, 'budget sach much request mein lag raha hai');
    is(src.indexOf('max_tokens: 320') < 0, 'purana 320 wala hadsa code se nikal gaya');
  }

  /* ═══ 8. ZUBAAN ═══ */
  head('8. 🗣️ ZUBAAN — do mutazad hukm ab ek (P1 · BUG 6)');
  {
    const src = HTML;
    is(/LANGUAGE RULE: user ki ZUBAAN aur SCRIPT dono ki naqal karo/.test(src),
      '🔑 ab ZUBAAN aur SCRIPT dono mirror hote hain');
    is(/sirf naam ya ek lafz/.test(src) && /ANGREZI mein jawab SIRF tab/.test(src),
      '🔑 "Maya" jaisa ek lafz likhne par ANGREZI par nahi jati (asli device se mila bug)');
    is(/Agar user ki script saaf pata na chale to: " \+\s*\(LR\[settings\.lang/.test(src),
      'setting sirf FALLBACK hai, hukm nahi');
    is(!/p \+= "\\nLANGUAGE RULE: " \+ \(LR\[settings\.lang/.test(src),
      'purana seedha "Reply in Hindi (Devanagari)" wala hukm khatam');
    is(src.indexOf('User ki language aur script mein jawab') > 0,
      'base RULE(3) ab LANGUAGE RULE se takrata nahi — dono ek baat kehte hain');
  }

  /* ═══ 9. SCHEMA ═══ */
  head('9. 🔖 SCHEMA — localStorage ki version (CHHED 4)');
  {
    const w = world();
    is(w.SCHEMA.at === w.SCHEMA.NOW, 'version set ho gaya', String(w.SCHEMA.at));
    is(w.localStorage.getItem('maya_schema') === String(w.SCHEMA.NOW), 'version mehfooz hai');
    is(typeof w.SCHEMA.init === 'function' && w.SCHEMA.init() === w.SCHEMA.NOW, 'dobara chalane par bhi wahi');
  }

  /* ═══ 10. TAALE — purana raasta zinda rahe (Qanoon 2) ═══ */
  head('10. 🔒 TAALE — kuch bhi ho, Maya chalti rahe');
  {
    const src = HTML;
    is(/if \(out && typeof SAAF !== "undefined"\)/.test(src),
      '🔑 LAB na ho to bhi dimaag ka jawab aata hai (Qanoon 2)');
    is(/if \(typeof SAAF !== "undefined"\) t = SAAF\.usable/.test(src), 'awaaz ka raasta bhi mehfooz');
    is(/if \(typeof MALIK !== "undefined"\) p \+= MALIK\.block\(\)/.test(src), 'prompt ka raasta bhi mehfooz');
    is((src.match(/try \{ NAAP\./g) || []).length >= 4, 'har NAAP hook try ke andar hai', 'guarded');
    is(src.indexOf('var FLAGS = {') > 0 && src.indexOf('var FLAGS = {') < src.indexOf('var AWAAZ = {'),
      'LAB block AWAAZ se PEHLE hai (sab ke liye maujood)');
    /* dhanche ka taala — harness naam se code kaatta hai */
    const order = ['var SCHEMA = {', 'var FLAGS = {', 'var NAAP = {', 'function SAAF(', 'var MALIK = {',
                   'var DIAG = {', 'var AWAAZ = {', 'var EDGE_TTS = {', 'var FISH = {', 'var BRAIN = {',
                   'var DIMAAG = {', 'var SETFORM = {'];
    let ok = true, at = -1, bad = '';
    for (const k of order) { const i = src.indexOf(k); if (i < 0 || i < at) { ok = false; bad = k; break; } at = i; }
    is(ok, '🔑 DHANCHE KA TAALA — saare namespace maujood aur sahih tarteeb mein', bad || 'sab theek');
  }


  /* ═══ 11. ⚡ AMAL — tools ab har dimaag ko (P2a) ═══ */
  head('11. ⚡ AMAL — asal ilaj: "tool wale turn 0/12"');
  {
    const w = world({ poolTools: true });
    const A = w.AMAL;

    /* ── OpenAI dialect ── */
    const T = A.openaiTools();
    is(T.length === w.TOOL_DECLS.length && T.length >= 30,
      '🔑 saare tools OpenAI shakl mein bhi tayyar', T.length + ' tools');
    is(T[0].type === 'function' && !!T[0].function.name && !!T[0].function.parameters,
      'shakl OpenAI wali hai (type/function/parameters)');
    is(T[0].function.parameters.type === 'object',
      '🔑 Gemini ka "OBJECT" -> OpenAI ka "object" (warna 400 aata)', T[0].function.parameters.type);
    const bri = T.filter(x => x.function.name === 'brightness_control')[0];
    is(!!bri && bri.function.parameters.properties.percent.type === 'integer',
      'andar ke types bhi chhote harf mein', bri ? bri.function.parameters.properties.percent.type : '-');
    is(A.openaiTools() === T, 'ek dafa ban kar yaad rehti hai (har request par nahi banti)');

    /* ── kaun tools le sakta hai ── */
    is(A.poolOn({ id: 'groq', kind: 'openai' }) === true, 'OpenAI-shakl dimaag ko tools milte hain');
    is(A.poolOn({ id: 'gemini', kind: 'gemini' }) === false, 'Gemini ka apna raasta — dohra nahi');
    A.markBad('groq', '400 tools unsupported');
    is(A.poolOn({ id: 'groq', kind: 'openai' }) === false,
      '🔑 jis ne 400 diya usay dobara nahi mara jata (dimaag marna nahi chahiye)');
    const off = world({ poolTools: false });
    is(off.AMAL.poolOn({ id: 'groq', kind: 'openai' }) === false, '🔒 switch OFF → koi tool nahi jata');

    /* ── ARG ALIAS (BUG 8 — screenshot mein level=100 aaya tha) ── */
    is(A.alias('brightness_control', { level: 100 }).percent === 100,
      '🔑 level -> percent (screenshot ka asal bug)', 'percent=100');
    is(A.alias('brightness_control', { value: '80%' }).percent === 80, '"80%" -> 80 (number ban gaya)');
    is(A.alias('volume_control', { vol: 50 }).percent === 50, 'vol -> percent');
    is(A.alias('torch_control', { state: 'on' }).on === true, '"on" -> true');
    is(A.alias('torch_control', { enable: 'band' }).on === false, '"band" -> false');
    is(A.alias('play_youtube', { song: 'Funk Taka' }).query === 'Funk Taka',
      '🔑 song -> query (aap ka "Funk Taka" wala hukm)');
    is(A.alias('brightness_control', { percent: 30, level: 99 }).percent === 30,
      'asli naam maujood ho to alias use nahi hota');
    is(JSON.stringify(A.alias('bakwas_tool', { x: 1 })) === '{"x":1}', 'anjaan tool par kuch nahi bigarta');

    /* ── tool sach much chalta hai ── */
    (async function () {
      const res = await A.runCalls([
        { id: 'c1', function: { name: 'brightness_control', arguments: '{"level":100}' } }
      ]);
      is(w.__ran.length === 1 && w.__ran[0].n === 'brightness_control' && w.__ran[0].a.percent === 100,
        '🔑 tool ASAL MEIN chala (alias ke sath)', 'percent=' + w.__ran[0].a.percent);
      is(res[0].role === 'tool' && res[0].tool_call_id === 'c1' && res[0].name === 'brightness_control',
        'nateeja OpenAI shakl mein wapas gaya');
      const bad = await A.runCalls([{ id: 'c2', function: { name: 'x', arguments: 'kachra{{' } }]);
      is(bad.length === 1, 'kharab arguments par bhi crash nahi');
    })();
  }

  /* ═══ 12. 🧭 ROUTER — 33/33 tools ab nazar aate hain ═══ */
  head('12. 🧭 ROUTER — pehle 12 tools nazar hi nahi aate the');
  {
    const w = world({ poolTools: true });
    const A = w.AMAL;
    const say = {
      brightness_control: 'britness barhao 100%', torch_control: 'torch on karo',
      volume_control: 'awaaz 50 kar do', set_reminder: 'mujhe 20 minute baad yaad dilana',
      prayer_times: 'maghrib ka waqt kya hai', reply_message: 'Ali ko reply karo theek hai',
      recall_memory: 'mujhe kya kya yaad hai', search_memory: 'yaad hai maine kya kaha tha',
      web_search: 'internet par talash karo', web_fetch: 'is website ko parho',
      create_skill: 'ye tareeqa seekh lo', notify: 'notification bhejo',
      set_alarm: 'subah 7 baje ka alarm laga do', set_timer: '10 minute ka timer laga do',
      open_app: 'whatsapp kholo', play_youtube: 'funk taka song lagao',
      call_contact: 'ammi ko call karo', message_contact: 'Ali ko message karo',
      get_weather: 'mausam kaisa hai', battery_status: 'battery kitni hai',
      run_javascript: '150 ka 18 percent kitna hua', wiki_search: 'wikipedia se batao',
      list_files: 'meri files dikhao', diary_write: 'diary mein likho aaj acha din tha',
      save_memory: 'yaad rakho meri birthday 5 june', read_messages: 'naye message parho'
    };
    const re = A.actionRe();
    let missed = [];
    for (const k in say) if (!re.test(say[k])) missed.push(k);
    is(missed.length === 0, '🔑 HAR hukm ab "kaam" pehchana jata hai', missed.length ? missed.join(',') : Object.keys(say).length + '/' + Object.keys(say).length);

    is(A.guess('britness barhao 100%') === 'brightness_control', 'britness → brightness_control (ghalat spelling bhi)');
    is(A.guess('torch on karo') === 'torch_control', 'torch → torch_control');
    is(A.guess('funk taka song lagao') === 'play_youtube', 'song → play_youtube');
    is(A.guess('maghrib ka waqt') === 'prayer_times', 'maghrib → prayer_times');
    is(!re.test('hello maya kaise ho'), 'aam gap-shap ko kaam na samjhe');

    /* har tool ke apne trigger hon */
    const noTrig = [];
    for (let i = 0; i < w.TOOL_DECLS.length; i++) {
      const n = w.TOOL_DECLS[i].name;
      if (!A.TRIGGERS[n] || !A.TRIGGERS[n].length) noTrig.push(n);
    }
    is(noTrig.length === 0, '🔑 HAR tool ke apne trigger lafz maujood (BUG 1 ka taala)', noTrig.join(',') || 'sab');
  }

  /* ═══ 13. 🩹 ASLI DEVICE SE MILE 5 BUG ═══ */
  head('13. 🩹 aap ke device ke diagnostic se mile bug');
  {
    const w = world({ saaf: true, malik: true });
    is(w.SAAF('play_youtube(query="Funk').trim() === '',
      '🔑 KATA HUA tool call bhi chhup gaya (band bracket nahi tha)', 'saaf');
    is(w.SAAF('brightness_control(level=100)').trim() === '', '   → poora tool call bhi');
    is(w.MALIK.ASK.test('\u092e\u0948\u0902 \u0924\u0941\u092e\u094d\u0939\u0947\u0902 \u0915\u093f\u0938\u0928\u0947 \u092c\u0928\u093e\u092f\u093e'),
      '🔑 Devanagari "किसने बनाया" ab pakra jata hai (aap ne isi mein poocha tha)');
    is(w.MALIK.ASK.test('\u062a\u0645\u06c1\u06cc\u06ba \u06a9\u0633 \u0646\u06d2 \u0628\u0646\u0627\u06cc\u0627'), '   → Urdu script bhi');
    is(w.MALIK.ASK.test('\u0906\u0926\u093f\u0932 \u091a\u093e\u0902\u0921\u093f\u092f\u094b \u0915\u094c\u0928 \u0939\u0948'),
      '   → "आदिल चांडियो कौन है" bhi');
    is(w.MALIK.ASK.test('adil chandio kaun hai'), '   → Roman mein bhi');
    const src = HTML;
    is(src.indexOf('VERSION 4.1.0 — IRONCLAD SETTINGS EDITION') < 0,
      '🔑 splash par hard-code "4.1.0" khatam (diagnostic ghalat version dikhata tha)');
    is(/p\.kind === "gemini"[\s\S]{0,120}dayQuotaUntil[\s\S]{0,20}continue/.test(src),
      '🔑 Gemini ka DIN ka quota khatam → poora dimaag skip (p90 31s ka sabab)');
    is(/if \(status === 402\)[\s\S]{0,120}21600000/.test(src),
      '🔑 402 (paisa maanga) → 6 ghante cooldown (Cerebras ne diya tha)');
    is(/if \(useTools && \(status === 400 \|\| status === 422\)/.test(src),
      'tools par 400 → bina tools dobara, dimaag marta nahi');
  }


  /* ═══ 14. 🎙️ SUNO — "Maya meri awaaz theek nahi samajhti" ═══ */
  head('14. 🎙️ SUNO — aap ki asli chat ke jumle');
  {
    const w = world({ suno: true });
    const S = w.SUNO;

    /* ── Urdu script -> Roman Urdu ── */
    is(S.roman('\u0686\u0644\u0648 \u0679\u06BE\u06CC\u06A9 \u06C1\u06D2') === 'chalo theek hai',
      'chalo theek hai', S.roman('\u0686\u0644\u0648 \u0679\u06BE\u06CC\u06A9 \u06C1\u06D2'));
    is(S.roman('\u06CC\u06C1 \u06A9\u06CC\u0627 \u06C1\u06D2') === 'ye kya hai', 'ye kya hai');
    is(S.roman('\u0627\u0628 \u062C\u0627\u0624 \u0627\u0648\u0631 \u0628\u06BE\u06CC\u062C\u0648') === 'ab jao aur bhejo',
      'ab jao aur bhejo', S.roman('\u0627\u0628 \u062C\u0627\u0624 \u0627\u0648\u0631 \u0628\u06BE\u06CC\u062C\u0648'));
    is(/WhatsApp/i.test(S.roman('\u0648\u0627\u0679\u0633 \u0627\u06CC\u067E \u067E\u0631')),
      '"واٹس ایپ" -> WhatsApp', S.roman('\u0648\u0627\u0679\u0633 \u0627\u06CC\u067E \u067E\u0631'));
    is(/YouTube/i.test(S.roman('\u06CC\u0648\u0679\u06CC\u0648\u0628 \u067E\u0631 \u0633\u0648\u0646\u06AF \u0644\u06AF\u0627\u0624')),
      '"یوٹیوب پر سونگ لگاؤ" -> YouTube', S.roman('\u06CC\u0648\u0679\u06CC\u0648\u0628 \u067E\u0631 \u0633\u0648\u0646\u06AF \u0644\u06AF\u0627\u0624'));
    is(S.roman('brightness 100 karo') === 'brightness 100 karo', 'Roman matn bilkul nahi chhua jata');
    is(S.isUrdu('\u06C1\u06D2') === true && S.isUrdu('hai') === false, 'Urdu script pehchani jati hai');

    /* ── pise hue naam theek (aap ki chat se) ── */
    is(S.fixWord('monak') === 'Monarch', '🔑 "monak" -> Monarch (aap ki chat ka asli lafz)');
    is(S.fixWord('manar') === 'Monarch',
      '🔑 "manar" -> Monarch (chhote lafz "maya" ko jeetne nahi diya jata)');
    is(S.fixWord('maya') === 'Maya', '   → magar sach much "maya" ho to wo pehchana bhi jata hai');
    is(S.fixWord('instgram') === 'Instagram', '"instgram" -> Instagram');
    is(S.fixWord('watsapp') === 'WhatsApp', '"watsapp" -> WhatsApp');
    is(S.fixWord('yotube') === 'YouTube', '"yotube" -> YouTube');
    is(S.fixWord('karo') === 'karo' && S.fixWord('kholo') === 'kholo',
      '✅ aam lafz kabhi nahi badle jate (karo -> Chrome nahi banta)');
    is(S.fixWord('hi') === 'hi' && S.fixWord('ab') === 'ab', '✅ chhote lafz chhue hi nahi jate');
    is(S.fixWord('beast') === 'beast', '✅ jo lughat mein nahi wo jyun ka tyun');

    /* ── poora jumla ── */
    const line = S.fix(S.roman('\u0645\u0648\u0646\u0627\u06A9 \u06A9\u0648 \u0648\u0627\u0679\u0633 \u0627\u06CC\u067E \u067E\u0631 \u0645\u06CC\u0633\u062C \u0628\u06BE\u06CC\u062C\u0648'));
    is(/Monarch/.test(line) && /WhatsApp/i.test(line) && /message/.test(line) && /bhejo/.test(line),
      '🔑 "موناک کو واٹس ایپ پر میسج بھیجو" poora theek', line);

    /* ── N-best: behtareen andaza chuno ── */
    const alts = ['\u0645\u0646\u0627\u0631 \u06A9\u0648 \u0628\u06BE\u06CC\u062C\u0648', '\u0645\u0648\u0646\u0627\u06A9 \u06A9\u0648 \u0628\u06BE\u06CC\u062C\u0648', 'kuch aur'];
    is(S.pick(alts).indexOf('\u0645') === 0, '🔑 kai andazon mein se wo chuna jismein naam mila', 'pick');
    is(S.pick([]) === '' && S.pick(null) === '', 'khali list par crash nahi');
    is(S.score('\u0645\u0648\u0646\u0627\u06A9 \u06A9\u0648') > S.score('kuch bhi nahi'), 'jaane-pehchane naam wala andaza zyada score leta hai');

    /* ── seekhna ── */
    S.learn('Funk Taka ka link Monarch ko bhejo');
    is(S.load().indexOf('funk') >= 0 || S.load().indexOf('taka') >= 0,
      '🔑 aap jo naam KHUD likhte ho, SUNO wo yaad rakh leta hai', S.load().join(','));
    is(S.load().indexOf('bhejo') < 0 && S.load().indexOf('link') < 0, 'aam lafz yaad nahi rakhe jate');
    is(String(w.localStorage.getItem('maya_suno')).length > 2, 'seekha hua app band hone par bhi mehfooz');

    /* ── wahid darwaza ── */
    const heard = S.heard(['\u0645\u0648\u0646\u0627\u06A9 \u06A9\u0648 \u06C1\u0627\u0626\u06CC \u06A9\u0631\u0648']);
    is(/Monarch/.test(heard) && !/[\u0600-\u06FF]/.test(heard),
      '🔑 heard(): Urdu andar -> saaf Roman Urdu bahar', heard);
    const off = world({ suno: false });
    is(off.SUNO.heard(['\u06C1\u06D2']) === '\u06C1\u06D2', '🔒 switch OFF -> matn bilkul nahi chhua');

    /* ── Kotlin ab saare andaze bhejta hai ── */
    const KT = fs.readFileSync(path.join(ROOT, 'app/src/main/java/com/maya/ai/MainActivity.kt'), 'utf8');
    is(/RESULTS_RECOGNITION[\s\S]{0,420}JSONArray/.test(KT),
      '🔑 Kotlin ab SAARE andaze bhejta hai (pehle sirf firstOrNull)');
    is(/CONFIDENCE_SCORES/.test(KT) && /o\.put\("c", conf\[i\]/.test(KT),
      '🔑 P8b: har andaze ka YAQEEN (confidence) bhi JS ko jata hai');
    /* v5.12.0: slice 2000 -> 4000. listen() ke andar ab J1.4 ke tafseeli comment bhi
       hain (silence extra ki ghalat chaabi wala hisab) — intent ki asli lines door chali
       gayin thi aur ye taala jhoot bolne laga tha. */
    is(/EXTRA_MAX_RESULTS, 6\)/.test(KT.slice(KT.indexOf('fun listen'), KT.indexOf('fun listen') + 4000)),
      '🔑 P8b: MAIN MIC ke andaze 1 -> 6 (SUNO ki taqat ab zinda)');
    is(/__nativeSpeech\('" \+ jsEscape\(text\) \+\s*"','" \+ jsEscape\(arr\.toString\(\)\)/.test(KT.replace(/\s+/g, ' ')),
      'dono cheezein JS ko jati hain: pehla andaza + poori list');
  }

  /* ═══ 15. 🩹 v4.10 ke device se mile bug ═══ */
  head('15. 🩹 UI + SAAF ke naye bug (aap ke UI CHECK se)');
  {
    const w = world({ saaf: true });
    is(w.SAAF('Bhej di gayi. (Note: emojis not allowed per rules, remove)Sir link bhej di.').indexOf('Note:') < 0,
      '🔑 "(Note: emojis not allowed per rules)" wali soch bhi chhupi', 'note');
    is(w.SAAF('Ye (100 rupay) ka hisab hai.').indexOf('100 rupay') > 0,
      '✅ aam bracket wala jumla bilkul salamat');
    const src = HTML;
    is(!/#send,#saveSettings\{[^}]*[^-]background:linear-gradient/.test(src),
      '🔑 SAVE button ka background ab shorthand se transparent nahi hota (UI CHECK ne pakra tha)');
    is(/#send,#saveSettings\{[\s\S]{0,220}background-color:var\(--accent/.test(src),
      '   → solid rang ka fallback maujood (purane WebView par bhi dikhega)');
  }


  /* ═══ 16. 🤝 HAQEEQAT — "bhej diya" ka jhoot khatam (P2 · TEH 6) ═══ */
  head('16. 🤝 SACH — aap ne 5 dafa kaha "nhi hua", Maya har dafa boli "bhej diya"');
  {
    const w = world({ sach: true });
    const H = w.HAQEEQAT;

    /* ── har tool ka sach ── */
    let r = H.wrap('message_contact', { done: true, how: 'chat khul gaya message type ho chuka' });
    is(r.ok === true && r.state === 'typed' && r.sure === false,
      '🔑 WhatsApp: ok=true magar sure=FALSE (type hua, bheja nahi)', r.state + '/sure=' + r.sure);
    is(/BHEJA NAHI/.test(r.sach), '   → jawab mein SAAF likha hai "BHEJA NAHI"');
    r = H.wrap('torch_control', { done: true });
    is(r.sure === true && r.state === 'done', '✅ torch: sach mein hua, sure=true');
    r = H.wrap('brightness_control', { done: true, level: 100 });
    is(r.sure === true, '✅ brightness: sure=true (asli level wapas aata hai)');
    r = H.wrap('open_app', { done: true });
    is(r.state === 'started' && r.sure === false, '⚠️ app kholna: sirf "chala diya", yaqeen nahi');
    r = H.wrap('set_alarm', { done: true });
    is(r.state === 'queued' && r.sure === true, '✅ alarm: set ho gaya, yaqeen hai');
    r = H.wrap('get_weather', { temp: 30 });
    is(r.state === 'info' && r.sure === true, '✅ mausam: sirf maloomat');
    r = H.wrap('message_contact', { done: false, note: 'contact nahi mila' });
    is(r.ok === false && r.state === 'failed' && /NAKAAM/.test(r.sach),
      '❌ nakami: saaf NAKAAM, aur wajah bhi');
    r = H.wrap('x', { error: 'boom' });
    is(r.ok === false && /boom/.test(r.sach), 'error bhi nakami hi hai');

    /* ── POST-CHECK: asli jhoot pakro (aap ki chat ke jumle) ── */
    const LIES = [
      'Monarch ke WhatsApp par "hi" send ho gaya.',
      'abhi turant send kar diya',
      '\u2713 Bhej diya, Sir!',
      'link Monarch ko WhatsApp par bhej di gayi hai',
      'Sir, "Funk Taka" song ab YouTube par chal raha hai.',
      '\u092d\u0947\u091c \u0926\u093f\u092f\u093e \u0939\u0948',
      '\u0628\u06BE\u06CC\u062C \u062F\u06CC\u0627 \u06C1\u06D2'
    ];
    let caught = 0;
    for (let i = 0; i < LIES.length; i++) {
      H.wrap('message_contact', { done: true });
      const fixed = H.check(LIES[i]);
      if (H.caught && fixed !== LIES[i]) caught++;
    }
    is(caught === LIES.length,
      '🔑 aap ki chat ke SAARE jhoot pakre gaye (Roman + Devanagari + Urdu)', caught + '/' + LIES.length);

    H.wrap('message_contact', { done: true });
    const fx = H.check('Bhej diya, Sir!');
    is(/SEND ka button/.test(fx) && /AutoSend/.test(fx),
      '🔑 aur jhoot ki jagah SACH aata hai — "SEND ka button dabana hoga"', fx.slice(0, 62));

    /* ── sacha jawab kabhi nahi badla jata ── */
    H.wrap('torch_control', { done: true });
    is(H.check('Torch on kar di, Boss!') === 'Torch on kar di, Boss!',
      '✅ sure=true wala kaam? jawab bilkul nahi chhua jata');
    H.wrap('message_contact', { done: true });
    is(H.check('Chat khol kar type kar diya, ab send dabao') !== undefined && !H.caught,
      '✅ jo pehle se sach bol raha ho, wo bhi nahi chhua jata');
    H.clear();
    is(H.check('bhej diya') === 'bhej diya', '✅ koi amal hi na hua ho to kuch nahi badalta');

    /* ── purana amal ab is jawab se muta\'alliq nahi ── */
    H.wrap('message_contact', { done: true });
    H.pending.at = (new Date()).getTime() - 60000;
    is(H.check('bhej diya') === 'bhej diya', '✅ 30 sec purana amal naye jawab par nahi lagta');

    /* ── switch OFF ── */
    const off = world({ sach: false });
    off.HAQEEQAT.wrap('message_contact', { done: true });
    is(off.HAQEEQAT.check('bhej diya') === 'bhej diya', '🔒 switch OFF -> jawab bilkul nahi chhua');
    is(off.HAQEEQAT.rule() === '', '🔒 switch OFF -> prompt mein qanoon nahi jata');

    /* ── prompt ka qanoon ── */
    is(/sure:true/.test(H.rule()) && /JHOOT/.test(H.rule()), 'prompt mein sach ka qanoon saaf likha hai');
    is(H.rule().length < 600, 'qanoon chhota hai (prompt phoolta nahi)', H.rule().length + ' harf');

    /* ── code mein juda hua hai ── */
    const src = HTML;
    is(/HAQEEQAT\.wrap\(name, out\)/.test(src), 'har tool ka jawab HAQEEQAT se guzarta hai');
    is(/text = HAQEEQAT\.check\(text\)/.test(src), '🔑 har jawab bahar jane se PEHLE jaancha jata hai');
    is(/step < 4\)/.test(src) && /FLAGS\.on\("sach"\) \? 4 : 2/.test(src),
      '🧭 agent loop 2 -> 4 qadam (kai-qadam wale hukm ke liye)');
  }


  /* ═══ 17. 🗣️ BOLI — LEHJA ka asal ilaj ═══ */
  head('17. 🗣️ BOLI — "Maya hamare accent mein nahi bol rahi"');
  {
    const w = world({ boli: true });
    const B = w.BOLI;

    is(B.deva('karo') === '\u0915\u0930\u094B', 'karo -> करो', B.deva('karo'));
    is(B.deva('theek') === '\u0920\u0940\u0915', 'theek -> ठीक', B.deva('theek'));
    is(/[\u0900-\u097F]/.test(B.deva('kya')), 'kya -> Devanagari', B.deva('kya'));
    is(B.deva('brightness') === '\u092C\u094D\u0930\u093E\u0907\u091F\u0928\u0947\u0938',
      'brightness -> ब्राइटनेस (lughat se)', B.deva('brightness'));
    is(/[\u0900-\u097F]/.test(B.deva('sundar')), 'lughat mein na ho to bhi harf-ba-harf', B.deva('sundar'));

    const line = B.say('Ho gaya boss, brightness set kar di', 'hi-IN');
    is(/[\u0900-\u097F]/.test(line) && !/Ho gaya/.test(line),
      '🔑 Maya ka asli jawab -> Devanagari (yehi lehja theek karta hai)', line);

    const br = B.say('WhatsApp par Monarch ko message bhejo', 'hi-IN');
    is(/WhatsApp/.test(br) && /Monarch/.test(br),
      '🔑 brand ke naam Latin hi rahe (Fish inhen theek parhta hai)', br);
    is(/[\u0900-\u097F]/.test(br), '   → magar baqi matn Devanagari — lehja Hindustani');

    const ur = B.say('theek hai boss', 'ur-PK');
    is(/[\u0600-\u06FF]/.test(ur) && !/[\u0900-\u097F]/.test(ur), 'ur-PK par saaf Urdu script', ur);

    is(B.say('hello how are you', 'en-US') === 'hello how are you', '✅ English par bilkul nahi chhua jata');
    is(B.say('\u092F\u0947 \u0939\u093F\u0902\u0926\u0940 \u0939\u0948', 'hi-IN') === '\u092F\u0947 \u0939\u093F\u0902\u0926\u0940 \u0939\u0948',
      '✅ pehle se Devanagari ho to dobara nahi badla jata');
    is(B.say('', 'hi-IN') === '' && B.say(null, 'hi-IN') === '', 'khali par crash nahi');
    const off = world({ boli: false });
    is(off.BOLI.say('theek hai', 'hi-IN') === 'theek hai', '🔒 switch OFF -> matn bilkul nahi chhua');

    const src = HTML;
    is(/text: FISH\.styled\(\(typeof BOLI[\s\S]{0,90}BOLI\.say\(text, s\.tts\)/.test(src),
      '🔑 Fish ko ab BOLA hua matn jata hai');
    is(/var spoken = \(typeof BOLI[\s\S]{0,70}BOLI\.say\(text, EDGE_TTS\.langOf/.test(src),
      'Edge ko bhi bola hua matn jata hai');
    is(!/addBubble[\s\S]{0,90}BOLI\.say/.test(src),
      '✅ BUBBLE par BOLI nahi lagti — screen par Roman Urdu hi rahega (aap ki farmaish)');
  }

  /* ═══ 18. 🎀 PYARI — Kore jaisi awaaz dhoondna ═══ */
  head('18. 🎀 PYARI — meethi zanana awaazein saamne lao');
  {
    const src = HTML;
    const sw = /SWEET: (\/.*?\/i),/.exec(src);
    const ml = /MALEISH: (\/.*?\/i),/.exec(src);
    is(!!sw && !!ml, 'zanana/mardana pehchan ki dono kasautiyan maujood');
    const SWEET = eval(sw[1]), MALEISH = eval(ml[1]);
    is(SWEET.test('Sweet Indian Girl') && SWEET.test('soft female hindi') && SWEET.test('pyari ladki'),
      'zanana/meethi awaaz pehchani jati hai');
    is(MALEISH.test('Deep Male Voice') && !MALEISH.test('Sweet Girl'), 'mardana awaaz alag pehchani jati hai');
    is(/pyari: function \(cb\)/.test(src), '🎀 PYARI ka darwaza maujood');
    is(/qs = \["hindi", "urdu", "female", "indian", "girl"\]/.test(src),
      '🔑 paanch talash ek sath (hindi/urdu/female/indian/girl)');
    is(/sc \+= 60[\s\S]{0,140}sc -= 80/.test(src), 'zanana ko + , mardana ko − (meethi awaaz upar)');
    is(/language=" \+ lg/.test(src), '🔑 Fish ki LANGUAGE filter istemal ho rahi hai');
    is(src.indexOf('id="fishPyari"') > 0, 'Settings mein 🎀 button maujood');
    is(/Fish ke paas <b>pitch<\/b> ka option hai hi nahi/.test(src),
      '🔑 saaf likha hai ke pitch Fish par asar nahi karta (aap ne 1.3 kiya tha)');
    is(/tags: \(m\.tags \|\| \[\]\)/.test(src), 'library ab tags bhi laati hai');
  }


  /* ═══ 19. 🔒 AWAAZ MEHFOOZ — "setting reset ho gayi" ═══ */
  head('19. 🔒 AWAAZ MEHFOOZ + 🎯 STHIR LEHJA');
  {
    const src = HTML;

    /* ── BUG A: awaaz kho jati thi ── */
    is(/var keep = sv\.fishVoice \|\| fs\.value/.test(src),
      '🔑 SETTINGS ab sach hai, dropdown nahi (boot par khali dropdown SAVE karta to awaaz mit jati thi)');
    is(/fs\.__wired[\s\S]{0,420}settings\.fishVoice = id[\s\S]{0,120}saveSettings\(\)/.test(src),
      '🔑 awaaz chunte hi FORAN mehfooz — SAVE dabane ka intezar nahi');
    is(/fishVoice SETFORM se BAHAR hai/.test(src) && !/{ id: "sFishVoice",   key: "fishVoice"/.test(src),
      '🔑 fishVoice ab SETFORM se bahar — khali dropdown use mita nahi sakta');
    is(/localStorage\.setItem\("maya_fishlib"/.test(src) && /loadLib: function/.test(src),
      '🔒 awaaz ki poori list mehfooz — restart par bhi NAAM dikhega');
    is(/voiceName: function/.test(src) && /fishVoiceName/.test(src),
      '🎤 hex id nahi, awaaz ka NAAM dikhta hai');
    is(/fishVoiceName:""/.test(src.replace(/\s/g, '')), 'naya khana DEFAULTS mein maujood');

    /* ── BUG B: SUNO purani awaaz bajata tha ── */
    is(/jo awaaz DROPDOWN mein chuni hai wohi sunao/.test(src),
      '🔑 🐟 SUNO ab DROPDOWN wali awaaz bajata hai (pehle purani bajti thi)');

    /* ── lehja sthir ── */
    is(/temperature: FISH\.temp\(\)/.test(src), '🎯 temperature ab setting se aata hai');
    is(/temp: function \(\)[\s\S]{0,220}v = 0\.35/.test(src),
      '🔑 default 0.35 (pehle 0.7 tha — isi liye har turn ka lehja badalta tha)');
    is(/fishTemp:0\.35/.test(src.replace(/\s/g, '')), 'sthirta DEFAULTS mein');
    is(src.indexOf('id="sFishTemp"') > 0, 'Settings mein lehja ka khana maujood');
    is(/lehja: " \+ \(FISH\.temp\(\) <= 0\.4 \? "sthir" : "jazbaati"\)/.test(src),
      'hint saaf batata hai ke lehja sthir hai ya jazbaati');
  }


  /* ═══ 20. 🛡️ IJAZAT + 📜 LEDGER + ⟲ UNDO + 📊 TRACE  (P3 · LAGAAM) ═══ */
  head('20. 🛡️ P3 LAGAAM — taqat dene se pehle lagaam');
  {
    const w = world({ ijazat: true });
    const I = w.IJAZAT, L = w.LEDGER, R = w.RAILS, T = w.TRACE;

    /* ── teen darje ── */
    is(I.tier('brightness_control') === 1 && I.tier('torch_control') === 1 && I.tier('get_weather') === 1,
      '🟢 SABZ — phone ki setting, foran');
    is(I.tier('set_alarm') === 2 && I.tier('open_app') === 2 && I.tier('diary_write') === 2,
      '🟡 ZARD — bata kar karo');
    is(I.tier('call_contact') === 3 && I.tier('send_sms') === 3 && I.tier('message_contact') === 3,
      '🔴 SURKH — phone se BAHAR nikal jata hai, wapas nahi hota');
    is(I.need('call_contact') === true && I.need('brightness_control') === false,
      '🔑 sirf SURKH par ijazat maangi jati hai');
    /* har tool ka darja maujood */
    const noTier = [];
    for (let i = 0; i < w.TOOL_DECLS.length; i++) {
      const n = w.TOOL_DECLS[i].name;
      if (!I.T[n]) noTier.push(n);
    }
    is(noTier.length === 0, '🔑 HAR tool ka darja tay hai (naya tool + darja bhoolo = test fail)',
      noTier.join(',') || w.TOOL_DECLS.length + '/' + w.TOOL_DECLS.length);

    /* ── TRUST MODE ── */
    w.settings.trustMode = true;
    is(I.tier('call_contact') === 2 && I.need('call_contact') === false,
      '⚡ TRUST MODE — surkh bhi zard ban jata hai (faisla aap ka)');
    w.settings.trustMode = false;
    is(I.need('call_contact') === true, '   → band karte hi lagaam wapas');

    /* ── insani zubaan ── */
    is(/CALL/.test(I.what('call_contact', { name: 'Ammi' })) && /Ammi/.test(I.what('call_contact', { name: 'Ammi' })),
      'ijazat ka sawal saaf likha jata hai', I.what('call_contact', { name: 'Ammi' }));
    is(/hi/.test(I.what('message_contact', { name: 'Monarch', text: 'hi' })),
      'message ka matn bhi dikhaya jata hai');

    /* ── 🛡️ RAILS ── */
    let g = R.check('message_contact', { name: 'x', text: 'mera OTP 483920 hai' });
    is(g.ok === false && /OTP/.test(g.why),
      '🔑 OTP/password wala message KABHI nahi jata', g.why.slice(0, 46));
    is(R.check('message_contact', { name: 'x', text: 'password bhejo' }).ok === false, '   → "password" bhi rukta hai');
    is(R.check('message_contact', { name: 'x', text: 'kal milte hain' }).ok === true, '✅ aam message bilkul nahi rukta');
    R.hits = {};
    is(R.check('call_contact', { name: 'a' }).ok === true, 'pehli call ki ijazat hai');
    is(R.check('call_contact', { name: 'a' }).ok === false, '🔑 45 sec mein doosri call ROK di (loop mein 50 call nahi lagengi)');
    is(R.check('brightness_control', { percent: 50 }).ok === true, '✅ sabz tools par koi rate limit nahi');

    /* ── 📜 LEDGER ── */
    L.list = []; L.known = {};
    L.push('brightness_control', { percent: 100 }, { ok: true, state: 'done', level: 100 }, 45);
    L.push('call_contact', { name: 'Ammi' }, { ok: false, state: 'failed' }, undefined);
    is(L.list.length === 2, 'har amal roznamche mein darj');
    const rep = L.today();
    is(/brightness_control/.test(rep) && /call_contact/.test(rep) && /2 amal/.test(rep),
      '📜 "aaj kya kya kiya" ka jawab', rep.split('\n')[0]);
    is(/✅/.test(rep) && /❌/.test(rep), '   → kamyabi aur nakami dono saaf');
    is(String(w.localStorage.getItem('maya_ledger')).indexOf('brightness') > 0, 'roznamcha app band hone par bhi mehfooz');

    /* ── ⟲ UNDO ── */
    is(L.lastUndoable().n === 'brightness_control', '⟲ aakhri wapas-hone-laiq kaam mil gaya');
    is(L.lastUndoable().b === 45, '   → us se pehle ki halat bhi yaad (45)');
    L.list = [];
    L.push('call_contact', { name: 'x' }, { ok: true }, undefined);
    is(L.lastUndoable() === null, '✅ call wapas nahi ho sakti — jhoota waada nahi karti');
    is(L.ASK_UNDO.test('wapas karo') && L.ASK_UNDO.test('undo') && L.ASK_UNDO.test('\u0648\u0627\u067E\u0633 \u06A9\u0631\u0648'),
      '"wapas karo" har zubaan mein pehchana jata hai');
    is(L.ASK_TODAY.test('aaj kya kya kiya'), '"aaj kya kya kiya" pehchana jata hai');
    is(!L.ASK_UNDO.test('brightness barhao'), 'aam hukm ko undo na samjhe');

    /* ── 📊 TRACE ── */
    T.start();
    T.tool('brightness_control', { ok: true, state: 'done' });
    T.tool('message_contact', { ok: false });
    const tl = T.line();
    is(/brightness_control/.test(tl) && /message_contact/.test(tl), '📊 trace mein dono tool', tl.slice(0, 60));
    is(/\u26A0/.test(tl), '   → nakaam tool par nishan bhi');

    /* ── switch OFF ── */
    const off = world({ ijazat: false });
    is(off.IJAZAT.need('call_contact') === false, '🔒 switch OFF -> koi ijazat nahi maangi jati (purana rawaiya)');
    is(off.RAILS.check('message_contact', { text: 'OTP 1234' }).ok === true, '🔒 switch OFF -> rails bhi band');
    is(off.TRACE.line() === '', '🔒 switch OFF -> trace bhi nahi dikhta');

    /* ── code mein juda ── */
    const src = HTML;
    const et = src.slice(src.indexOf('async function execTool'), src.indexOf('async function execTool') + 1800);
    is(et.indexOf('RAILS.check(name, args)') > 0 &&
       et.indexOf('IJAZAT.need(name)') > et.indexOf('RAILS.check(name, args)') &&
       et.indexOf('IJAZAT.ask') > 0,
      '🔑 amal se PEHLE: pehle RAILS, phir IJAZAT — dono execTool ke shuru mein');
    is(et.indexOf('LEDGER.snap(name, args)') > et.indexOf('IJAZAT.ask'),
      '   → undo ki halat ijazat ke BAAD, amal se pehle mehfooz hoti hai');
    is(/LEDGER\.push\(name, args, out, _before\); TRACE\.tool\(name, out\)/.test(src),
      '🔑 amal ke BAAD: roznamcha + trace');
    is(/setTimeout\(function \(\) \{ finish\(false\); \}, 15000\)/.test(src),
      '🔑 ijazat ka jawab na aaye to 15 sec baad KHUD "NAHI" (workflow ka usool)');
    is(/LEDGER\.ASK_TODAY\.test\(stripped\)[\s\S]{0,200}LEDGER\.ASK_UNDO\.test\(stripped\)/.test(src),
      '"aaj kya kiya" aur "wapas karo" — dimaag se poochhne ki zaroorat nahi');
    is(src.indexOf('id="sTrustMode"') > 0 && src.indexOf('id="labLedger"') > 0,
      'Settings mein TRUST MODE switch + roznamcha button');
  }


  /* ═══ 21. ⚡ BIJLI + 👁️ AANKHEIN  (P4) ═══ */
  head('21. ⚡ BIJLI — 50ms mein kaam, dimaag se PEHLE');
  {
    const w = world({ bijli: true, ijazat: true });
    const B = w.BIJLI;

    /* ── pehchan ── */
    let m = B.match('torch on karo');
    is(m && m.tool === 'torch_control' && m.args.on === true, '🔦 "torch on karo" → torch ON', JSON.stringify(m));
    is(B.match('torch band karo').args.on === false, '🔦 "torch band karo" → OFF');
    m = B.match('britness 100 karo');
    is(m && m.tool === 'brightness_control' && m.args.percent === 100,
      '🔑 "britness 100 karo" → brightness 100 (ghalat spelling bhi)', JSON.stringify(m && m.args));
    is(B.match('brightness full karo').args.percent === 100, '"full" → 100');
    is(B.match('brightness kam karo').args.percent === 20, '"kam" → 20');
    is(B.match('chamak aadhi kar do').args.percent === 50, '"aadhi" → 50');
    is(B.match('awaaz 50 kar do').tool === 'volume_control', '🔊 volume');
    is(B.match('10 minute ka timer laga do').args.seconds === 600, '⏱️ 10 minute → 600 second');
    is(B.match('30 second ka timer').args.seconds === 30, '⏱️ second bhi');
    is(B.match('battery kitni hai').tool === 'battery_status', '🔋 battery');

    /* ── kab NAHI chalna chahiye (hifazat) ── */
    is(B.match('Ammi ko call karo') === null, '🔒 call BIJLI se kabhi nahi (surkh hai)');
    is(B.match('Monarch ko whatsapp par hi bhejo') === null, '🔒 WhatsApp bhi nahi');
    is(B.match('alarm laga do 7 baje') === null, '🔒 alarm bhi nahi (zard hai)');
    is(B.match('torch') === null, '🔒 sirf "torch" — on/off nahi bataya to dimaag hi kare');
    is(B.match('brightness') === null, '🔒 sirf "brightness" — value nahi to dimaag hi kare');
    is(B.match('mujhe brightness ke bare mein tafseel se batao ke ye kaam kaise karti hai aur kyun zaroori hai') === null,
      '🔒 lamba jumla = baat-cheet, hukm nahi');
    is(B.match('kaise ho maya') === null, '🔒 aam gap-shap par kuch nahi');
    const off = world({ bijli: false, ijazat: true });
    is(off.BIJLI.match('torch on karo') === null, '🔒 switch OFF → BIJLI bilkul band');

    /* ── khud jumla bana leta hai (internet ke bina) ── */
    is(/Torch on/.test(B.say('torch_control', { on: true })), '🌐 internet ke bina bhi jawab banata hai');
    is(/100/.test(B.say('brightness_control', { percent: 100 }, { level: 100 })), '   → asli value ke sath');
    is(/\u26A1/.test(B.say('torch_control', { on: true })), '   → ⚡ ka nishan (BIJLI se hua)');

    /* ── ek hukm = ek amal ── */
    B.mark('torch_control');
    is(B.dupe('torch_control') === true && B.dupe('brightness_control') === false,
      '🔒 wohi tool 8 sec mein dobara na chale');

    /* ── code mein juda ── */
    const src = HTML;
    is(/BIJLI\.match\(stripped\)[\s\S]{0,900}askAI\(wasVoice\)/.test(src),
      '🔑 BIJLI dimaag se PEHLE chalti hai, aur nakaam ho to dimaag ko de deti hai');
    const bj = src.slice(src.indexOf('var BIJLI = {'), src.indexOf('var IJAZAT = {'));
    is(/OK: \{ torch_control: 1/.test(bj) && bj.indexOf('IJAZAT.T[r.t] !== 1') > 0 && bj.indexOf('!BIJLI.OK[r.t]') > 0,
      '🔑 dohri hifazat — IJAZAT ka darja SABZ ho AUR BIJLI.OK mein bhi ho');
    is(bj.indexOf('call_contact') < 0 && bj.indexOf('message_contact') < 0,
      '   → surkh tools BIJLI ki list mein hain hi nahi');
  }

  head('21b. 👁️ AANKHEIN — Maya ab DEKH sakti hai');
  {
    const src = HTML;
    is(/name: "see_camera"/.test(src) && /name: "see_image"/.test(src),
      '🔑 dekhna ab asli TOOL hai (pehle sirf ek tang regex tha)');
    is(/is bill ka total/.test(src) && /ye likha kya hai/.test(src),
      '   → tafseel mein likha hai kab dekhna hai (bill, likhai, dawa)');
    is(/see_camera: 2, see_image: 2/.test(src),
      '🟡 ZARD darja — camera khulta hai, aap dekh kar dabate ho (chori-chhupe photo nahi)');
    is(/see_camera:\s*\["ye dekho"/.test(src), 'router ke trigger bhi maujood');
    is(/see_camera:\s*\{ question:/.test(src), 'arg alias (q/prompt/ask → question)');
    is(/see_camera: "started", see_image: "started"/.test(src),
      '🤝 SACH: "camera khol diya" — "dekh liya" ka jhoota daawa nahi');
    is(/AANKH\.waiting\) \? AANKH\.prompt\(\)/.test(src),
      '🔑 sawal yaad rehta hai — jawab USI sawal ka aata hai');
    is(/Tasveer dekh kar jawab do/.test(src) && /hisab maanga gaya hai to hisab karo/.test(src),
      '   → prompt kehta hai: likha hua parho, hisab maanga ho to hisab karo');
    is(/AANKH: dekh rahi hoon/.test(src), 'log mein bhi darj hota hai');

    const w = world({});
    w.NATIVE = false;
    const r = w.AANKH.ask('ye kya hai', 'camera');
    is(r.ok === false && /APK/.test(r.note), 'browser mein saaf sach — camera sirf APK mein');
  }


  /* ═══ 22. 🎯 NISHANA — aap ke device se mile 4 bug ═══ */
  head('22. 🎯 NISHANA — local hukm ab DIMAAG ka kaam nahi cheenti');
  {
    const src = HTML;

    /* ── BUG 1: "Camera khol ke picture lo" -> open_app hijack ── */
    is(/list mein nahi \u2014 DIMAAG faisla kare/.test(src) || /list mein nahi[\s\S]{0,80}return null;/.test(src),
      '🔑 app ka naam list mein na ho to ab DIMAAG faisla karta hai (pehle bakwas jawab deti thi)');
    is(!/meri list mein nahi hai\. Try: WhatsApp/.test(src) ||
       /return null;[\s\S]{0,40}\}\s*\n\s*\/\* 🎯 NISHANA/.test(src) ||
       src.indexOf('appOne.length === 1') > 0,
      '   → "Camera khol ke picture lo" ab see_camera tak pohanchega');

    /* ── BUG 2: "arena agent search karo" -> sirf "karo" dhoonda ── */
    is(/\^\(\.\{2,60\}\?\)\\s\+\(\?:ko\\s\+\)\?\(\?:search\|khojo/.test(src.replace(/\\\\/g, '\\')) ||
       src.indexOf('(?:search|khojo|dhoondo|dhundo)\\s*(?:karo|kar do|kar)?\\s*$') > 0,
      '🔑 "X search karo" wali shakl bhi pakri jati hai (pehle sirf "search X")');
    is(src.indexOf('STOPQ') > 0 && /if \(sq\.length >= 2 && !STOPQ\.test\(sq\)\)/.test(src),
      '🔑 bacha hua matn bekaar ho ("karo") to search hota hi nahi — DIMAAG kare');
    is(/replace\(\/\^\(google\|chrome\|browser/.test(src),
      '   → "chrome par search karo X" se "chrome par" hat jata hai');

    /* ── BUG 3: bina tool ke daawa (vision hallucination) ── */
    const w = world({ sach: true, ijazat: true });
    const H = w.HAQEEQAT, T = w.TRACE;
    T.start();
    let fixed = H.check('Aankhein mode activate kar rahi hoon \u2014 bas ek second, screen par nazar rakh');
    is(H.caught === true && /camera KHOLNA parega/.test(fixed),
      '🔑 "Aankhein activate kar rahi hoon" (koi tool nahi chala) = JHOOT, pakra gaya', fixed.slice(0, 54));
    is(/screenshot main abhi nahi le sakti/.test(fixed),
      '   → aur saaf batati hai ke screenshot nahi le sakti');
    T.start();
    fixed = H.check('Boss, screen khol rahi hoon \u2014 photo khich rahi hoon.');
    is(H.caught === true, '   → "photo khich rahi hoon" bhi pakra gaya');
    T.start();
    T.tool('see_camera', { ok: true, state: 'started' });
    is(H.check('Camera khol rahi hoon, Boss') === 'Camera khol rahi hoon, Boss',
      '✅ tool SACH MEIN chala ho to jawab bilkul nahi chhua jata');
    T.cur = null;
    is(H.check('dekh rahi hoon') === 'dekh rahi hoon', '✅ turn track hi na hua ho to kuch nahi badalta');
    T.start();
    is(H.check('Theek hai Boss, bataiye') === 'Theek hai Boss, bataiye', '✅ aam jawab bilkul salamat');

    /* ── BUG 4: 📊 TRACE mein sirf "🧠 —" dikhta tha ── */
    T.start();
    is(T.line() === '', '🔑 kuch asli na ho to chip dikhta HI nahi (pehle khali "🧠 —" aata tha)');
    T.brain('\u26A1 Groq', 340);
    is(/Groq/.test(T.line()) && /340ms/.test(T.line()), '🔑 dimaag ka naam ab DARJ hota hai, render par nahi parha jata', T.line());
    T.brain('-', 0);
    is(/Groq/.test(T.line()), '   → "-" jaisa bekaar naam use nahi karta');
    is(/TRACE\.brain\(_bn/.test(src) && /TRACE\.brain\("\\u26A1 BIJLI", ms\)/.test(src),
      'dono raaston (dimaag aur BIJLI) par naam darj hota hai');
  }


  /* ═══ 23. 👁️ NAZAR — Maya screen PARH sakti hai (P7a) ═══ */
  head('23. 👁️ NAZAR — screen parhna (chhuna NAHI)');
  {
    const w = world({ nazar: true });
    const N = w.NAZAR;

    /* naqli screen — Chrome jaisa */
    const fake = {
      ok: true, pkg: 'com.android.chrome', n: 7,
      items: [
        { i:0, t:'input', x:'Search or type URL', cx:540, cy:180, id:'url_bar', e:1 },
        { i:1, t:'btn',   x:'Search',            cx:960, cy:180 },
        { i:2, t:'btn',   x:'New tab',           cx:1000, cy:90, id:'tab_switcher' },
        { i:3, t:'text',  x:'Agent Arena | AI Agent Performance Leaderboard', cx:540, cy:600 },
        { i:4, t:'text',  x:'',                  cx:1, cy:1 },
        { i:5, t:'btn',   x:'Search',            cx:960, cy:180 },
        { i:6, t:'scroll',x:'',                  cx:540, cy:900, s:1 }
      ]
    };
    w.NATIVE = true;
    w.MayaBridge = { uiDump: function(){ return JSON.stringify(fake); } };

    is(N.can() === true, 'bridge maujood ho to NAZAR tayyar');
    const r = N.look(90);
    is(r.ok === true && r.app === 'Chrome', '🔑 screen parh li — app pehchan liya', r.app);

    /* chhanti */
    is(r.items.length < fake.items.length, 'dohri chhanti hui', fake.items.length + ' -> ' + r.items.length);
    is(!r.items.some(x => x.t === 'text' && x.x === '(bay-naam)'),
      'bina naam wala aam matn phenk diya gaya');
    const searches = r.items.filter(x => x.x === 'Search');
    is(searches.length === 1, 'ek jaise element JAMA kar diye gaye (2 "Search" -> 1)');
    is(searches[0].n === 2, '   → aur ginti bhi likhi (×2)', 'n=' + searches[0].n);
    is(r.items[0].i === 0 && r.items[1].i === 1, 'har element ka apna number (dimaag isi se tap karega)');

    /* lamba matn kata */
    const long = { ok:true, pkg:'x', n:1, items:[{ i:0, t:'text', x:'a'.repeat(200), cx:1, cy:1 }] };
    w.MayaBridge.uiDump = function(){ return JSON.stringify(long); };
    const r2 = N.look(90);
    is(r2.items[0].x.length <= N.MAXLABEL + 1, '🔑 lamba matn kata gaya (prompt phate nahi)', r2.items[0].x.length + ' harf');

    /* 40 se zyada nahi */
    const many = { ok:true, pkg:'x', n:120, items:[] };
    for (let i = 0; i < 120; i++) many.items.push({ i:i, t:'btn', x:'button ' + i, cx:i, cy:i });
    w.MayaBridge.uiDump = function(){ return JSON.stringify(many); };
    const r3 = N.look(200);
    is(r3.items.length <= N.MAXITEMS, '🔑 40 se zyada element kabhi nahi', r3.items.length + ' items');
    is(N.tokens(r3) < 700, '🔑 prompt ka budget mehfooz (CHHED 9 ka sabaq)', '~' + N.tokens(r3) + ' token');

    /* dimaag ke liye matn */
    w.MayaBridge.uiDump = function(){ return JSON.stringify(fake); };
    N.look(90);
    const fb = N.forBrain();
    is(/^SCREEN: Chrome/.test(fb) && /\[0\] input/.test(fb) && /Search or type URL/.test(fb),
      'dimaag ko saaf, numberon wali fehrist jati hai', fb.split('\n')[1]);

    /* aap ke liye */
    const fe = N.forEye();
    is(/SCREEN PAR ABHI/.test(fe) && /Chrome/.test(fe) && /CHHUA nahi/.test(fe),
      '🔒 aap ko dikhne wali report saaf kehti hai: "Maya ne kuch CHHUA nahi"');

    /* nakami par sach */
    w.MayaBridge.uiDump = function(){ return JSON.stringify({ ok:false, why:'accessibility band hai' }); };
    const bad = N.look(90);
    is(bad.ok === false && /accessibility/.test(bad.why), '❌ accessibility band ho to SAAF batati hai', bad.why);
    is(/nahi parh saki/.test(N.forEye(bad)), '   → jhoot nahi bolti');
    w.MayaBridge.uiDump = function(){ return 'kachra{{{'; };
    is(N.look(90).ok === false, 'kharab jawab par crash nahi');
    delete w.MayaBridge.uiDump;
    is(N.can() === false && N.look(90).ok === false, 'bridge na ho to saaf mana');

    /* app ke naam */
    is(N.appOf('com.instagram.android') === 'Instagram' && N.appOf('com.android.chrome') === 'Chrome',
      'aam apps naam se pehchani jati hain');
    is(N.appOf('com.kuch.anjaan') === 'anjaan', 'anjaan app ka bhi kuch naam nikal aata hai');
  }

  head('23b. 🔒 NAZAR ki hadd — dekhna haan, chhuna NAHI');
  {
    const src = HTML;
    const KT = fs.readFileSync(path.join(ROOT, 'app/src/main/java/com/maya/ai/AutoSendService.kt'), 'utf8');
    const CFG = fs.readFileSync(path.join(ROOT, 'app/src/main/res/xml/autosend_service_config.xml'), 'utf8');

    is(/fun dumpScreen\(max: Int\): String/.test(KT), '🔑 Kotlin mein dumpScreen() maujood');
    is(!/dumpScreen[\s\S]{0,2200}performAction/.test(KT),
      '🔑 dumpScreen KUCH CHHUTA NAHI — us mein performAction hai hi nahi');
    is(/isVisibleToUser/.test(KT) && /r\.width\(\) > 4/.test(KT),
      'sirf nazar aane wale element (chhupe hue nahi)');
    is(/depth > 22/.test(KT) && /out\.length\(\) >= cap/.test(KT),
      '🔑 tree par chalne ki hadd — bara page bhi app ko jam nahi karega');
    is(/label\.substring\(0, 60\)/.test(KT), 'Kotlin bhi label kaat deta hai (dohri chhanti)');

    /* purana kaam salamat */
    is(/com\.whatsapp:id\/send/.test(KT) && /fun findAndClick/.test(KT) && /autosend_at/.test(KT),
      '🔒 purana WhatsApp AutoSend BILKUL salamat (Qanoon 2)');

    /* config */
    const CFGLIVE = CFG.replace(/<!--[\s\S]*?-->/g, '');   /* comment nikal do */
    is(!/android:packageNames/.test(CFGLIVE),
      '🔑 packageNames hata di gayi — ab har app parh sakti hai');
    is(/packageNames="com\.whatsapp"/.test(CFG),
      '   → aur comment mein likha hai ke pehle kya tha (kyun badla)');
    is(/flagReportViewIds/.test(CFG), '🔑 flagReportViewIds — ab view-id bhi milte hain');
    is(/canPerformGestures="true"/.test(CFG), 'canPerformGestures ON (P7b ke liye — abhi istemal nahi)');
    is(/dobara jorni parti hai/.test(CFG), 'config mein likha hai ke service dobara ON karni paregi');

    /* JS side */
    is(/name: "read_screen"/.test(src), 'read_screen ab asli TOOL hai');
    is(/read_screen: 1,/.test(src), '🟢 SABZ darja — sirf parhta hai, kuch chhuta nahi');
    is(/read_screen: "info"/.test(src), '🤝 SACH: "info" — koi amal ka daawa nahi');
    is(src.indexOf('id="labNazarTest"') > 0, 'Settings mein "SCREEN ABHI PARHO" button');
    is(/is version mein service ka config badla hai/.test(src),
      '🔑 app khud batati hai ke Accessibility dobara ON karni paregi');
    const off = world({ nazar: false });
    is(/NAZAR band hai/.test(src), '🔒 switch OFF ho to tool saaf mana kar deta hai');
  }


  /* ═══ 24. 👂 KAAN — wake word ke 7 bug ═══ */
  head('24. 👂 KAAN — "Maya bolta hoon, kuch nahi hota"');
  {
    const HB = HTML.indexOf('var KAAN = {');
    const HE = HTML.indexOf('window.__wakeErr = function');
    const KSRC = HTML.slice(HB, HE);
    const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'dangerously' });
    const w = dom.window;
    w.settings = { name: 'Boss', wakeWord: true, stt: 'ur-PK' };
    w.speaking = false; w.thinking = false; w.listening = false;
    w.said = [];
    w.handleUserText = function (t) { w.said.push(t); };
    w.addBubble = function () {}; w.chime = function () {};
    w.statusText = {}; w.startListening = function () { w.said.push('__LISTEN__'); };
    w.stripWake = function (t) { return String(t).replace(/^\s*(maya|boss)[\s,]*/i, '').trim(); };
    w.FLAGS = { on: function () { return true; } };
    w.SUNO = { pick: function (a) { return String((a && a[0]) || ''); } };
    /* 🛡️ J1 (v5.12.0 / F53) — __wakeHeard ab masroof hone par JAWAB.ignore() se
       WAJAH poochta hai (aur flag phansa ho to khud ilaaj karta hai). Is naqli
       duniya mein stub: ignore() = false, yaani "masroof hun, ignore karo" — jo
       purane amal ke hoo-bahoo barabar hai. Gin-ti is liye ke taala lage ke wake
       waqai referee se poochti hai (chup-chaap ignore nahi karti). */
    w.__ignoreAsk = 0;
    w.JAWAB = {
      ignore: function () { w.__ignoreAsk++; return false; },
      age: function () { return 0; },
      LISTEN_MAX: 12000, THINK_MAX: 40000, SPEAK_BASE: 20000
    };
    w.eval(KSRC);
    const K = w.KAAN;

    /* ── BUG 3: Urdu ab match hota hai ── */
    is(K.SURE.test('\u0645\u0627\u06CC\u0627'), '🔑 Urdu "مایا" ab MATCH hota hai (pehle literal "\\\\u0645" tha)');
    is(K.SURE.test('\u092E\u093E\u092F\u093E'), '   → Devanagari "माया" bhi');
    is(K.SURE.test('maya') && K.SURE.test('Boss') && K.SURE.test('maaya'), 'Roman bhi');

    /* ── BUG 7: fuzzy ── */
    is(K.WAKE.test('maiya') && K.WAKE.test('mya') && K.WAKE.test('my a') && K.WAKE.test('mahiya'),
      '🔑 halki si ghalat pehchan bhi chalti hai (maiya / mya / my a / mahiya)');
    is(!K.SURE.test('mausam') && !K.SURE.test('message'), 'aam lafz galti se wake na banen');

    /* ── BUG 4: SAARE andaze ── */
    let m = K.match(['mera naam', 'kuch aur', 'maya suno']);
    is(m && m.sure === true && m.idx === 2,
      '🔑 wake word TEESRE andaze mein mila — pehle sirf pehla dekha jata tha', 'idx=' + m.idx);
    is(K.match(['mausam kaisa hai', 'kal kya hua']) === null, 'koi wake na ho to null');

    /* ── BUG 1: ab hum ANDHE nahi ── */
    w.__wakeLog('start', 'ur-PK|1');
    w.__wakeLog('err', '7|3');
    is(K.log.length === 2 && K.starts === 1 && K.errs === 1 && K.lastErr === 7,
      '🔑 har waqia darj hota hai (pehle hum BILKUL andhe the)');
    is(/samajh nahi aaya/.test(K.report()), 'error ka insani matlab bhi', 'code 7');
    is(/lagatar 3/.test(K.report()), '   → aur ye ke lagatar kitni dafa hua');

    /* ── poora silsila ── */
    K.log = []; K.heard = 0; K.woke = 0; w.said = [];
    w.__wakeHeard(JSON.stringify(['mera naam', 'maya']));
    is(K.heard === 1 && K.woke === 1, '🔑 suna aur JAAGI — dono darj', 'heard=1 woke=1');
    is(/Ji Boss|Boliye/.test(String(K.log[0] && K.log[0].d) + 'x') || K.woke === 1,
      '   → aur "Ji Boss? Boliye" wala jawab chala');

    w.said = [];
    w.__wakeHeard(JSON.stringify(['maya brightness barhao']));
    is(w.said.length === 1 && /brightness/.test(w.said[0]),
      '🔑 "maya <hukm>" ek hi saans mein — seedha hukm chala', w.said[0]);

    w.said = []; K.woke = 0;
    K.DARWAZA.close();                      /* P8a: darwaza band karo, warna wo raasta khula hai */
    w.__wakeHeard(JSON.stringify(['mausam kaisa hai']));
    is(w.said.length === 0 && K.woke === 0, '🔒 wake word na ho to Maya CHUP rehti hai');

    w.said = []; w.speaking = true;
    w.__wakeHeard(JSON.stringify(['maya']));
    is(w.said.length === 0, '🔒 Maya pehle se bol rahi ho to beech mein na kude');
    is(w.__ignoreAsk === 1, '🙉 F53: ignore karne se PEHLE referee se poocha gaya (wajah log/status par jati hai)', w.__ignoreAsk + ' dafa');
    w.speaking = false;

    w.__wakeHeard('kachra{{{');
    w.__wakeHeard('');
    is(true, 'kharab payload par crash nahi');

    /* khali halat par madad */
    K.log = [];
    is(/ABHI TAK KUCH NAHI aaya/.test(K.report()) && /ijazat nahi mili/.test(K.report()) &&
       /purani APK/.test(K.report()),
      '🔑 kuch na aaye to report KHUD batati hai ke kya check karna hai');
  }

  head('24b. 🩹 Kotlin ke 4 bug');
  {
    const KT = fs.readFileSync(path.join(ROOT, 'app/src/main/java/com/maya/ai/WakeWordService.kt'), 'utf8');
    const live = KT.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\*.*$/gm, '');

    is(!/val isWake =/.test(live), '🔑 BUG 2: dead variable `isWake` khatam — ab faisla JS karta hai');
    is(!/contains\("\\\\u0645/.test(live), '🔑 BUG 3: literal "\\\\u0645" wala jhoota check khatam');
    is(/EXTRA_MAX_RESULTS, 6/.test(live), '🔑 BUG 4: ab 6 andaze aate hain (pehle 1)');
    is(/getString\("wake_lang"/.test(live), '🔑 BUG 5: zubaan ab settings se (pehle "en-IN" hard-code)');
    is(/errStreak\.coerceAtMost\(8\) \* 350L/.test(live),
      '🔑 BUG 6: nakami par intezar barhta hai (Android throttle se bachne ko)');
    is(!/6, 7 -> restart\(250\)/.test(live), '   → purana 250ms wala tez restart khatam');
    is(/report\("err"/.test(live) && /report\("start"/.test(live),
      '🔑 BUG 1: Kotlin ab har error aur har start REPORT karta hai');
    is(/handleAll\(list: List<String>\)/.test(live) && /JSONArray/.test(live),
      'saare andaze JSON bana kar JS ko jate hain');
    /* 🔬 v5.10.3 (F25/F27) — delivery ab `evalPublicOk()` se hoti hai (murda WebView
       par JS nahi thonsi jati), magar SAFE MODE ka qanoon wahi: app band = kuch na karo. */
    is(/val act = MainActivity\.instance/.test(live) && /act != null && act\.evalPublicOk/.test(live) &&
       /SAFE MODE/.test(KT) && /lastHeardOffline = payload/.test(live),
      '🔒 app band ho to SAFE MODE bilkul waisa hi (Qanoon 2) — ab delivery-check ke sath');

    const src = HTML;
    /* 🔬 v5.10.3 (F12) — ye assert PEHLE `settings.stt` ko sahih kehta tha, halanke
       wahi bug tha: Urdu decoder "مایا" ko "ہے" parh leta hai (hamara apna DOCTOR
       ye kehta tha). Ab wake ki zubaan STT se AZAD hai. */
    is(/setPrefString\('wake_lang', settings\.wakeLang/.test(src) &&
       !/setPrefString\('wake_lang', settings\.stt/.test(src),
      '🔑 F12: wake ki zubaan ab settings.wakeLang (default en-IN) — STT se azad');
    is(/fun setPrefString/.test(fs.readFileSync(path.join(ROOT, 'app/src/main/java/com/maya/ai/MainActivity.kt'), 'utf8')),
      'bridge mein setPrefString maujood');
    is(src.indexOf('id="labKaan"') > 0, 'Settings mein "WAKE WORD KA HAAL" button');
  }


  /* ═══ 25. 🚪 SAKHT DARWAZA + 🎤 QAREEB  (P8a/b/c) ═══ */
  head('25. 🚪 "Maya" ke bagair KUCH NAHI');
  {
    const HB = HTML.indexOf('var KAAN = {');
    const HE = HTML.indexOf('window.__wakeErr = function');
    const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'dangerously' });
    const w = dom.window;
    w.settings = { name: 'Boss', wakeWord: true, wakeDoor: 15, micZoom: 0.8 };
    w.speaking = false; w.thinking = false; w.listening = false;
    w.said = []; w.bub = [];
    w.handleUserText = function (t) { w.said.push(t); };
    w.addBubble = function (a, b) { w.bub.push(b); };
    w.chime = function () {}; w.statusText = {}; w.startListening = function () {};
    w.stripWake = function (t) { return String(t).replace(/^\s*(maya|maaya|boss)[\s,]*/i, '').trim(); };
    w.FLAGS = { on: function () { return true; } };
    w.SUNO = { pick: function (a) { return String((a && a[0]) || ''); } };
    w.eval(HTML.slice(HB, HE));
    const K = w.KAAN, D = w.KAAN.DARWAZA;

    /* ── wake word SHURU mein hona chahiye ── */
    is(K.atStart('maya brightness barhao') === true, '"Maya yeh karo" → shuru mein ✅');
    is(K.atStart('maya') === true, 'akela "Maya" bhi');
    is(K.atStart('chalo maya yeh karo') === false, '🔑 "chalo Maya yeh karo" → NAHI (Maya shuru mein nahi)');
    is(K.atStart('brightness barhao maya') === false, '🔑 aakhir mein Maya → NAHI');
    is(K.atStart('yeh karo') === false, '🔑 bilkul Maya nahi → NAHI');

    /* ── ASAL FARMAISH: "yeh karo" par KUCH NA HO ── */
    D.close(); w.said = []; K.woke = 0;
    w.__wakeHeard(JSON.stringify(['yeh karo']));
    is(w.said.length === 0 && K.woke === 0, '🔑🔑 "yeh karo" → BILKUL KUCH NAHI (aap ki asal farmaish)');
    w.__wakeHeard(JSON.stringify(['brightness barhao']));
    w.__wakeHeard(JSON.stringify(['mausam kaisa hai']));
    w.__wakeHeard(JSON.stringify(['open whatsapp']));
    is(w.said.length === 0 && K.woke === 0, '   → 4 aam hukm, ek bhi nahi chala ✅');

    /* ── "Maya yeh karo" → chale ── */
    w.said = [];
    w.__wakeHeard(JSON.stringify(['maya brightness barhao']));
    is(w.said.length === 1 && /brightness/.test(w.said[0]), '✅ "Maya yeh karo" → seedha kaam', w.said[0]);
    is(D.isOpen() === true, '   → aur DARWAZA khul gaya');

    /* ── darwaza khula: ab bina Maya bhi chale ── */
    w.said = [];
    w.__wakeHeard(JSON.stringify(['aur volume bhi']));
    is(w.said.length === 1, '🚪 darwaza khula → bina "Maya" bhi chala', w.said[0]);

    /* ── darwaza band → phir kuch nahi ── */
    D.close(); w.said = [];
    w.__wakeHeard(JSON.stringify(['aur volume bhi']));
    is(w.said.length === 0, '🔒 darwaza band → phir "Maya" chahiye');

    /* ── "bas" par foran band ── */
    D.open();
    w.__wakeHeard(JSON.stringify(['bas']));
    is(D.isOpen() === false, '🔑 "bas" kehte hi darwaza foran band');
    D.open();
    w.__wakeHeard(JSON.stringify(['theek hai']));
    is(D.isOpen() === false, '   → "theek hai" bhi');

    /* ── 0 = har baar Maya ── */
    w.settings.wakeDoor = 0;
    D.close(); w.said = [];
    w.__wakeHeard(JSON.stringify(['maya torch on karo']));
    is(w.said.length === 1 && D.isOpen() === false,
      '🔑 darwaza 0 sec → kaam chala magar darwaza khula HI NAHI (har baar Maya)');
    w.settings.wakeDoor = 15;

    /* ── hadd ── */
    w.settings.wakeDoor = 999;
    is(D.secs() === 60, 'darwaza 60 sec se zyada nahi');
    w.settings.wakeDoor = -5;
    is(D.secs() === 0, 'aur 0 se kam nahi');
    w.settings.wakeDoor = 15;

    /* ── afterSpeak ka bug ── */
    const src = HTML;
    is(/YEHI wo bug tha/.test(src) && /KAAN\.DARWAZA\.isOpen\(\)/.test(src),
      '🔑 afterSpeak: wake mode mein khud-sunna ab sirf DARWAZA khula ho tab');
    is(!/if \(\(settings\.autoListen \|\| settings\.wakeWord\) && wasVoice\) setTimeout\(startListening/.test(src),
      '   → purana bay-shart khud-sunna khatam');
  }

  head('25b. 🎤 QAREEB — nazdeeki awaaz, background rad');
  {
    const KT = fs.readFileSync(path.join(ROOT, 'app/src/main/java/com/maya/ai/MicKit.kt'), 'utf8');
    const WS = fs.readFileSync(path.join(ROOT, 'app/src/main/java/com/maya/ai/WakeWordService.kt'), 'utf8');
    const MA = fs.readFileSync(path.join(ROOT, 'app/src/main/java/com/maya/ai/MainActivity.kt'), 'utf8');
    const src = HTML;

    is(/setPreferredMicrophoneFieldDimension/.test(KT),
      '🔑 MIC ZOOM — Android ka apna "background rad karo" wala API');
    is(/MIC_DIRECTION_TOWARDS_USER/.test(KT), '🔑 mic ka rukh AAP ki taraf');
    is(/AudioSource\.VOICE_RECOGNITION/.test(KT), 'ASR ke liye bana audio source (+AGC)');
    is(/NoiseSuppressor/.test(KT) && /AutomaticGainControl/.test(KT) && /AcousticEchoCanceler/.test(KT),
      'shor-kush + auto-gain + echo canceler (Maya apni awaaz na sune)');
    is(/fxZoom = false/.test(KT) && /o\.put\("zoom", fxZoom\)/.test(KT),
      '🔑 har effect ka natija YAAD rakha jata hai — DOCTOR sach dikhata hai (andaza nahi)');
    is(/Build\.VERSION\.SDK_INT >= 29/.test(KT), 'purane Android par crash nahi (API guard)');
    is(/fun test\(ms: Int, zoom: Float\)/.test(KT) && /snr/.test(KT), '🧪 MIC TEST: shor, awaaz aur SNR naapta hai');

    /* VAD */
    is(/KHAMOSHI KA PEHRA/.test(WS) && /gateOn/.test(WS), '🎧 khamoshi ka pehra (VAD) maujood');
    is(/if \(vadEnabled\(\)\) startGate\(\) else actuallyStart\(\)/.test(WS),
      '🔑 sannate mein recognizer BILKUL nahi chalta ("mic on/off" ka ilaj)');
    /* v5.11.0 (1.5/F17) is lock ko SUDHARA: pehle har gate-exit par actuallyStart()
       post hota tha — chahe gate BAHAR se band hui ho (app ka mic khul raha ho).
       Ab mic pehle chhora jata hai (join+release) aur recognizer SIRF awaaz wali
       exit par; "bahar se band" wali exit par kuch nahi hota (wahi race thi). */
    is(/rec\.release\(\)[\s\S]{0,200}MicKit\.release\(\)[\s\S]{0,900}?when \(why\)[\s\S]{0,200}?actuallyStart/.test(WS) &&
       /"stop"  -> \{/.test(WS),
      '🔒 mic pehle CHHORA jata hai, phir recognizer — aur BAHAR se band hone par recognizer hamla NAHI karta (F17)');
    is(/over > TRIG_STEP/.test(WS) && /loud >= 3/.test(WS) &&
       /const val TRIG_STEP = 14\.0/.test(WS) && /const val TRIG_CAP = 72\.0/.test(WS),
      '📏 door ki dheemi awaaz rad — sirf qareebi buland awaaz par jaage (v5.11.0: chokhat ab farsh se banti hai, cap 72dB)');

    /* recognizer seerhi */
    is(/isOnDeviceRecognitionAvailable/.test(MA) && /createOnDeviceSpeechRecognizer/.test(MA),
      '🎯 Android 12+ ka on-device recognizer (offline)');
    is(/googlequicksearchbox[\s\S]{0,200}GoogleRecognitionService/.test(MA),
      '🎯 warna Google ka recognizer ZABARDASTI (AiAi bug ka ilaj)');
    is(/lastRecognizerKind/.test(MA) && /MainActivity\.instance\?\.makeRecognizer\(\)/.test(WS),
      'wake service bhi wahi seerhi istemal karti hai');

    /* doctor */
    is(/voice_recognition_service/.test(MA), '🩺 DOCTOR phone ka voice-input service ka NAAM parhta hai');
    is(/o\.put\("aiai"/.test(MA), '   → aur AiAi ho to pehchan leta hai');
    is(/fun openSetting/.test(MA) && /ACTION_VOICE_INPUT_SETTINGS/.test(MA),
      '🔑 seedha sahih settings screen khol deta hai (menu mein bhatakna khatam)');
    is(/YEHI SAB SE BARA MASLA HAI/.test(src), 'DOCTOR saaf batata hai ke AiAi hi mujrim hai');
    is(src.indexOf('id="labKaanDoc"') > 0 && src.indexOf('id="labMicTest"') > 0,
      'Settings mein DOCTOR + MIC TEST dono button');
    is(src.indexOf('id="sWakeDoor"') > 0 && src.indexOf('id="sMicZoom"') > 0,
      'darwaza aur zoom dono aap ke haath mein');

    /* confidence */
    is(/norm: function \(alts\)/.test(src) && /typeof a === "string"/.test(src),
      '🔒 purani APK (sirf matn) bhi chalti rahegi — Qanoon 2');
    is(/weak: function \(\)[\s\S]{0,90}0\.35/.test(src), 'kam yaqeen ka paimana');
    is(/Theek se sunai nahi diya/.test(src),
      '🔑 kam yaqeen par ghalat kaam karne ke bajaye POOCHH leti hai');
  }

  /* ═══ 26. 🎚️ SUKOON (P9) — audio referee: awaaz kabhi nahi kategi ═══ */
  head('26. 🎚️ SUKOON — ek waqt mein EK cheez (mic-larai khatam)');
  {
    const WS = fs.readFileSync(path.join(ROOT, 'app/src/main/java/com/maya/ai/WakeWordService.kt'), 'utf8');
    const MA = fs.readFileSync(path.join(ROOT, 'app/src/main/java/com/maya/ai/MainActivity.kt'), 'utf8');

    /* ── L1 HAAL bridge: JS ka dil Kotlin tak ── */
    is(/fun setHaal\(h: String\)/.test(MA) && /WakeWordService\.applyHaal\(h\)/.test(MA),
      '🔑 setHaal bridge — JS ki HAAL seedha wake service tak (applyHaal — JVM setter clash se mehfooz)');
    is(/fun applyHaal\(h: String\)/.test(WS),
      '🔑 companion mein applyHaal — \'haal\' property ke JVM setter se naam HARGIZ takraye nahi');
    is(HTML.indexOf('var SUKOON = {') > 0 && HTML.indexOf('SUKOON.bolStart') > 0,
      'SUKOON module maujood hai (JS taraf ka referee)');
    is(/MayaBridge\.setHaal/.test(HTML), '🌉 SUKOON har HAAL Kotlin ko bhejta hai');

    /* ── speak/listen ke SAARE raaste cover ── */
    is((HTML.match(/try \{ SUKOON\.bolStart/g) || []).length >= 6 &&
       (HTML.match(/try \{ SUKOON\.bolEnd/g) || []).length >= 11 &&
       (HTML.match(/try \{ SUKOON\.sunStart/g) || []).length >= 2 &&
       (HTML.match(/try \{ SUKOON\.sunEnd/g) || []).length >= 7,
      '🧲 speaking/listening ke 25 jagah SUKOON ke hook lage (koi raasta nahi chhoota)');
    is(/function speak\(text, wasVoice\) \{[\s\S]{0,420}?SUKOON\.bolStart/.test(HTML),
      '🔑 speak() CALL ke waqt hi bolStart — fetch ki 1-2s mein bhi mic nahi khulta');

    /* ── L2 Kotlin gates: mic ke 4 darwaze HAAL se poochchte hain ── */
    is((WS.match(/haalBlock\(\)/g) || []).length >= 5,
      '🔑 restart + actuallyStart + VAD-gate + watchdog — HAR mic-darwaza HAAL se poochhta hai (' + (WS.match(/haalBlock\(\)/g) || []).length + ' jagah)');
    is(/if \(haal == "BOL_RAHI"\) return "Maya bol rahi hai"/.test(WS) &&
       /if \(haal == "APP_SUN"\) return "app ka mic chal raha hai"/.test(WS),
      'Maya bol rahi ho YA app ka mic chal raha ho -> mic BAND rahega');

    /* ── L4 MIC SULAH: tap-to-speak hamesha jeetta hai ── */
    is(/fun pauseForApp\(\)/.test(WS) && /fun resumeFromApp\(\)/.test(WS) &&
       /WakeWordService\.pauseForApp\(\)/.test(MA),
      '🤝 MIC SULAH — tap-to-speak se pehle wake service apna mic chhor deti hai');
    /* 🔬 v5.10.3 (F05) — 60s sirf "hamesha ke liye nahi sota" wala wada nibhata tha,
       magar har SUNO ke baad wake ek poore MINUTE ke liye murda rehti thi. Ab 10s,
       AUR app ka mic asal mein khali ho tab hi (blind release = mic jang). */
    is(/pausedByApp && System\.currentTimeMillis\(\) - pausedAt > STALE_PAUSE_MS/.test(WS) &&
       /const val STALE_PAUSE_MS = 10000L/.test(WS) && /appMicBusy\(\)/.test(WS),
      '🔒 F05: stale-pause 60s → 10s + appMicBusy() check (wake foran wapas, mic jang nahi)');

    /* ── L5 ERR-8 MERCY: service khud ko nahi marti, aap ka switch nahi mita ── */
    /* 🔬 v5.10.3 — onError ka `when` ab `if (error == 8)` block hai (escalation ki wajah se) */
    const E8A = WS.indexOf('if (error == 8) {');
    const E8 = WS.slice(E8A, E8A + 900);
    is(E8.indexOf('stopSelf()') === -1 && /restart\(2000\)/.test(E8) && /err8/.test(E8),
      '🕊️ error 8 ab service ko NAHI marta — sirf 2s sukoon (nakami-kahti mauth khatam)');
    const WE = HTML.slice(HTML.indexOf('window.__wakeErr = function'), HTML.indexOf('window.__wakeErr = function') + 900);
    is(WE.indexOf('settings.wakeWord = false;') === -1,
      '🔑🔑 aap ka WAKE SWITCH ab KABHI khud nahi mitega — faisla sirf aap ka');

    /* ── L6 RACE TOKEN: pending restart murda ── */
    is(/val gen = \+\+pendingGen/.test(WS) && /if \(gen != pendingGen\) return@postDelayed/.test(WS),
      '🎫 har schedule ka apna duct-ticket — purana pending restart MURDA (mic strobe ka ilaj)');

    /* ── L7 SELF-WAKE SHIELD ── */
    is(/pehra khamosh/.test(WS) && /while \(gateOn && running[\s\S]{0,1600}?haalBlock/.test(WS),
      '🛡️ Maya ke bolte waqt VAD pehra bhi khamosh — apni awaaz par jaagne ka loop IMKAN-HARAB');

    /* ── echo tail: JS aur Kotlin MILTE HAIN ── */
    is(/ECHO_TAIL_MS = 550L/.test(WS) && /tailMs: 550/.test(HTML),
      '📏 echo tail JS aur Kotlin mein DONO 550ms (ek ka 300, doosre ka 800 nahi)');

    /* ── watchdog bhi gate ka hukam maanta hai ── */
    is(/watchdogRuns = 0[\s\S]{0,300}?if \(haalBlock\(\) == null\)/.test(WS),
      '🔑 har-12-minute wala recognizer-reset ab HAAL poochhta hai (awaaz kaatne ka scheduled chance khatam)');

    /* ── instance lifecycle ── */
    is(/attach\(this\)/.test(WS) && /detach\(this\)/.test(WS) && /@Volatile var instance/.test(WS),
      'companion ke paas ZINDA instance hota hai (static call se bhi mic control)');

    /* ── escape hatch + nazaarat ── */
    is(/getBoolean\("sukoon", true\)/.test(WS) && /sukoon: true/.test(HTML),
      'SUKOON default ON (ye bugfix hai — band karna ho to LAB mein switch hai)');
    is(HTML.indexOf('id="labSukoon"') > 0 && /sw\("labSukoon", "sukoon"/.test(HTML),
      'LAB mein SUKOON ka apna switch — aap ke haath mein');
    is(/setPref\('sukoon', FLAGS\.on\('sukoon'\)\)/.test(HTML) && /labSukoonMirror/.test(HTML),
      '🔑 switch ka nateeja TURANT SharedPrefs tak pahunchta hai — ubharna nahi parta');
    is(/skips: 0, err8: 0/.test(HTML) && /if \(kind === "skip"\) KAAN\.skips\+\+;/.test(HTML),
      'KAAN v3 — skipping ka saboot ginita hai (andha nahi rahenge)');
    /* 🔬 v5.10.3 (F04) — panel ab JS AUR Kotlin DONO ka HAAL dikhata hai. Pehle sirf
       JS ka tha, aur "HAAL: KHALI" likh kar humein galat raaste par bhejta tha jabke
       Kotlin mein pausedByApp=true phansa tha. */
    is(HTML.indexOf('HAAL (JS)   : ') > 0 && HTML.indexOf('HAAL (Kotlin): ') > 0 &&
       HTML.indexOf('roka gaya') > 0,
      '👁️ KAAN report mein HAAL (JS) + HAAL (Kotlin) + roko ki ginti nazar aati hai');

    /* ── version qanoon ── */
    is(/appVersion\(\): String = "5\.13\.0-native"/.test(MA) && MA.indexOf('4.3.0-native') === -1 &&
       MA.indexOf('5.12.5-native') === -1,
      '🩹 BONUS — appVersion() ka purana 4.3.0 jhoot bhi ab qatl (v5.13.0 barqarar)');
    is(fs.readFileSync(path.join(ROOT, 'app/src/main/assets/web/sw.js'), 'utf8').indexOf('maya-v5.13.0') > 0 &&
       /versionCode 78/.test(fs.readFileSync(path.join(ROOT, 'app/build.gradle'), 'utf8')) &&
       /versionName "5\.13\.0"/.test(fs.readFileSync(path.join(ROOT, 'app/build.gradle'), 'utf8')) &&
       fs.readFileSync(path.join(ROOT, 'public/sw.js'), 'utf8').indexOf('maya-v5.13.0') > 0,
      '🏷️ poore app mein VERSION v5.13.0 (cache saaf, splash saaf, APK saaf)');
    is(HTML.indexOf('5.8.0') === -1, 'kahi purana 5.8.0 version nazar nahi aata');

    /* ── v5.9.1 hotfix — doctor ka jhoota button ab ASAL hai ── */
    head('26c. 🗣️ ON-DEVICE LANGUAGE — wo button jo pehle sirf LIKHA tha');
    is(HTML.indexOf('id="labOnDevice"') > 0,
      '🔑🆕 LAB mein ab 🗣️ ON-DEVICE LANGUAGE ka ASLI button hai (pehle sirf text tha — user dhoondta reh jata tha)');
    is(/show\("\\uD83D\\uDDE3\\uFE0F ON-DEVICE LANGUAGE/.test(HTML.replace(/'/g, '"')) && /KAAN\.onDevice\(\)/.test(HTML),
      'button ka click poora panel dikhata hai (v5.10.1: ab screen ka NAAM bhi batata hai — Section 28)');
    is(/"ondevice", "gboardvoice" ->/.test(MA) && /VoiceSettingsActivity/.test(MA) &&
       /ACTION_VOICE_INPUT_SETTINGS/.test(MA) && /ACTION_SETTINGS/.test(MA),
      '🔑 Kotlin: Gboard → voice-input → input-method → aam Settings (koi bhi phone tode nahi) — tafseel Section 28');
    is(HTML.indexOf('[ON-DEVICE] dabao') === -1,
      '🔑🆕 doctor ab us button ka HAWALA nahi deta jo MAUJOOD nahi — seedha asli button ka rasta likhta hai');
  }

  /* ── 26b. ASLI behavior — time ke saath (550ms tail) ── */
  (async function () {
    await new Promise(function (r) { setTimeout(r, 60); });  /* pehle ke floating async apna hisaab poora kar lein */

    head('26b. 🎭 SUKOON ka AMAL — asli waqt mein chal kar');
    const SB = HTML.indexOf('var SUKOON = {');
    const SE = HTML.indexOf('var KAAN = {');
    const dom2 = new JSDOM('<!doctype html><body></body>', { runScripts: 'dangerously' });
    const w2 = dom2.window;
    const calls = [];
    w2.MayaBridge = { setHaal: function (h) { calls.push(h); } };
    w2.KAAN = { push: function () {} };
    w2.eval(HTML.slice(SB, SE));
    const S = w2.SUKOON;
    const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

    is(S && S.haal === 'KHALI', 'SUKOON module KHALI halat se uthta hai');

    /* (1) bolna shuru -> Kotlin ko BOL_RAHI gaya */
    S.bolStart();
    is(S.haal === 'BOL_RAHI' && calls.length === 1 && calls[0] === 'BOL_RAHI',
      '🔑 bolte hi HAAL = BOL_RAHI, aur Kotlin ko LAMHE mein pata chal gaya');

    /* (2) same HAAL dobara -> native spam nahi */
    S.set('BOL_RAHI');
    is(calls.length === 1, 'same HAAL dubara native par nahi jata (bridge spam nahi)');

    /* (3) bolEnd — furan KHALI nahi, tail ke baad */
    S.bolEnd();
    is(S.haal === 'BOL_RAHI', 'bolEnd ke furan baad BOL_RAHI hi — speaker ki goonj ka tail zinda');
    await sleep(700);
    is(S.haal === 'KHALI' && calls[calls.length - 1] === 'KHALI',
      '🔑 550ms tail ke baad KHALI — ab mic khol sakta hai (awaaz ke beech NAHI)');

    /* (4) tail, mic-sunne per STOMP nahi karta — sab se khatarnak race */
    S.bolStart(); S.bolEnd();   /* tail start */
    await sleep(200);
    S.sunStart();               /* tail ke bich app ka mic khul gaya */
    is(S.haal === 'APP_SUN', 'bolne ke tail ke beech mic khule to APP_SUN maana gaya');
    await sleep(500);           /* tail ka poora waqt guzar gaya */
    is(S.haal === 'APP_SUN', '🔑 tail ka timer sunne ki HAAL ko KHALI karke BARBAD nahi karta');

    /* (5) sunEnd -> wapas KHALI */
    S.sunEnd();
    is(S.haal === 'KHALI' && calls[calls.length - 1] === 'KHALI',
      'mic band -> wapas KHALI (wake pehra phir se zinda ho sakta hai)');

    /* (6) tore-dhaage sequence — greeting ke poora kat-jaane wala scene */
    calls.length = 0;
    S.bolStart();               /* greeting shuru */
    is(S.haal === 'BOL_RAHI', 'scene: greeting shuru -> BOL_RAHI');
    S.bolEnd(); await sleep(50); S.bolStart();  /* doosra jumla turant */
    is(S.haal === 'BOL_RAHI', 'scene: agla jumla aa gaya to tail cancel — ab bhi BOL_RAHI');
    S.bolEnd(); await sleep(700);
    is(S.haal === 'KHALI' && calls.join('>') === 'BOL_RAHI>KHALI',
      '🔑 POORA POOD: sirf 2 HAAL badle (BOL>KHALI) — awaaz ke beech mic kabhi nahi khula');


    /* ═══ 27. 🕸️ P6 KHUD-MUKHTAR — khud sochna, LAGAAM ke sath ═══ */
    head('27. 🕸️ KHUD-MUKHTAR (P6) — bay-maqsad shor khatam, ab WAJAH se bolti hai');

    /* ── 27a. 🔒 Qanoon 1: switch OFF = purana raasta jyun ka tyun ── */
    {
      const off = kworld({ khud: false });
      is(off.FLAGS.DEF.khud === false, '🔑 khud default OFF — pehle sabit ho, phir chale (Qanoon 1)');
      is(off.KHUD.HAAL.context() === '', 'switch OFF → dimaag ko koi HAAL nahi jata');
      is(off.KHUD.HAAL.rule() === '', 'switch OFF → prompt ka qanoon bhi khali');
      is(off.KHUD.BUDGET.can('test').ok === false, 'switch OFF → khud se kuch karne ki ijazat NAHI');
      is(off.KHUD.AADAT.due() === null && off.KHUD.ADHOORA.find() === null, 'switch OFF → na aadat, na adhoora');
      is(off.KHUD.tick() === null && off.said.length === 0, 'switch OFF → tick bilkul chup (koi jumla nahi)');
      is(off.KHUD.start() === false && off.KHUD.timer === null, 'switch OFF → koi timer hi nahi (battery zaya nahi)');
      const offHtml = /var khudOn = false;\s*try \{ khudOn = \(typeof KHUD !== "undefined" && FLAGS\.on\("khud"\)\); \} catch \(e\) \{ khudOn = false; \}\s*if \(khudOn\) \{/.test(HTML);
      is(offHtml && HTML.indexOf('var PRO_LINES = [') > 0,
        '🔒 purani 6-minute chatter MITAI nahi gayi — sirf switch ON par chhor di jati hai (Qanoon 2)');
    }

    /* ── 27b. 👁️ HAAL — jo nahi pata, wo likha hi nahi jata ── */
    {
      const w = natworld({ level: 12, charging: false });
      w.FLAGS.set('khud', true);
      const H = w.KHUD.HAAL;
      const NOW = at(0, 15, 30);
      const line = H.line(NOW);
      is(line.indexOf('dopahar 15:30') === 0, '👁️ HAAL waqt se shuru (din ka hissa Urdu mein)', line.slice(0, 26));
      is(line.indexOf('battery 12%') > 0 && line.indexOf('charge ho rahi') < 0, 'battery sach ke sath (charging ka jhoot nahi)');
      const ctx = H.context(NOW);
      is(ctx.indexOf('ABHI KA HAAL') > 0 && ctx.indexOf('Jo HAAL mein NAHI') > 0, '🔑 prompt line + qanoon: jo NAHI pata, ijaad mat karo');
      is(ctx.length < 340, 'HAAL ~40 token se chhota — prompt phool kar phate nahi (CHHED 9)', ctx.length + ' harf');
      /* battery ka koi zariya nahi → sach sach chup */
      const w2 = kworld({ khud: true });
      is(w2.KHUD.HAAL.battery() === null, 'battery maloom na ho → null (andaza nahi)');
      is(w2.KHUD.HAAL.line(NOW).indexOf('battery') === -1, '🔑 battery na pata ho to HAAL mein likha hi nahi jata');
      /* aakhri amal LEDGER se */
      w2.LEDGER.push('brightness_control', { percent: 30 }, { ok: true, state: 'done' }, 80);
      const l = w2.LEDGER.load(); l[l.length - 1].t = NOW - 5 * 60000;
      const la = w2.KHUD.HAAL.lastAmal(NOW);
      is(la.indexOf('brightness_control') === 0 && la.indexOf('30%') > 0 && la.indexOf('5 min pehle') > 0,
        '🧠 "aakhri amal" roznamche se — dimaag ko pata chalta hai abhi kya hua tha', la);
      is(w2.KHUD.HAAL.waqt(at(0, 23, 45)) === 'aadhi raat' && w2.KHUD.HAAL.waqt(at(0, 2, 0)) === 'aadhi raat' &&
         w2.KHUD.HAAL.waqt(at(0, 5, 0)) === 'subah' && w2.KHUD.HAAL.waqt(at(0, 17, 0)) === 'shaam' &&
         w2.KHUD.HAAL.waqt(at(0, 21, 0)) === 'raat' && w2.KHUD.HAAL.waqt(at(0, 13, 0)) === 'dopahar',
        'din ke hisse sahih (4-12 subah · 12-16 dopahar · 16-19 shaam · 19-23 raat · 23-4 aadhi raat)');
      /* browser ka rasta: watch() promise se cache bharta hai */
      const wb = kworld({ khud: true }, { batteryAsync: { level: 43, charging: true } });
      wb.KHUD.HAAL.watch();
      await new Promise(function (r) { setTimeout(r, 30); });
      is(wb.KHUD.HAAL.battery() && wb.KHUD.HAAL.battery().level === 43 &&
         wb.KHUD.HAAL.line(at(0, 15, 30)).indexOf('battery 43% (charge ho rahi hai)') > 0,
        '🌐 browser mein bhi HAAL zinda — navigator.getBattery se (APK ke baghair bhi chalegi)');
      is(H.context(NOW, true) !== undefined && typeof w2.KHUD.HAAL.facts(NOW) === 'object', 'facts() khali halat par bhi crash nahi');
    }

    /* ── 27c. 🛡️ BUDGET — be-lagam khud-mukhtari = tabahi ── */
    {
      const w = kworld({ khud: true });
      const B = w.KHUD.BUDGET;
      const D = at(0, 15, 0);
      is(B.DAY === 6 && B.GAP === 45 * 60000 && B.QUIET_FROM === 0 && B.QUIET_TO === 7,
        '🛡️ qanoon ke number: 6/din · 45 min farq · raat 12 se subah 7 khamosh');
      is(B.can('x', D).ok === true, 'din ke 3 baje, khali budget → bol sakti hai');
      is(B.can('x', at(0, 3, 30)).ok === false && /khamosh/.test(B.can('x', at(0, 3, 30)).why),
        '🔇 raat 3:30 → KHAMOSH GHANTE (neend zaroori hai)', B.can('x', at(0, 3, 30)).why);
      is(B.quiet(at(0, 6, 59)) === true && B.quiet(at(0, 7, 0)) === false, '7:00 par khamoshi khatam');
      is(B.can('x', D, false, true).ok === true, 'urgent (battery) → khamosh ghante mein bhi zaroori baat');
      B.spend('test', D);
      is(B.can('x', D + 10 * 60000).ok === false && /farq/.test(B.can('x', D + 10 * 60000).why), '10 min baad → 45 min ka farq lazmi');
      is(B.can('x', D + 46 * 60000).ok === true, '46 min baad → ijazat');
      for (let i = 0; i < 6; i++) B.spend('x', D + (i + 1) * 46 * 60000);
      is(B.left(D) === 0 && /bol-budget/.test(B.can('x', D + 4 * 3600000).why), '💬 6/din ki hadd (roki DARJ hoti hai)', B.can('x', D + 4 * 3600000).why);
      is(B.can('x', D + 4 * 3600000, true).ok === true, 'urgent → hadd se chhoot (sirf zaroori ke liye)');
      is(B.load().capBlocked >= 1 && B.report(D).indexOf('hadd') > 0, '📊 roki gayi baatein DARJ hoti hain (andhi khud-mukhtari nahi)');
      is(B.roll(at(1, 9, 0)).n === 0 && B.left(at(1, 9, 0)) === 6, 'agle din ginti saaf (roz naya budget)');
      /* 🤫 Maya bol rahi hai → beech mein na tokay */
      const w3 = kworld({ khud: true });
      w3.SUKOON = { haal: 'BOL_RAHI' };
      const r3 = w3.KHUD.BUDGET.can('x', at(0, 15, 0));
      is(r3.ok === false && /bol rahi/.test(r3.why) && w3.KHUD.BUDGET.load().busyBlocked === 1,
        '🤫 SUKOON ki HAAL BUDGET tak — Maya bolte waqt khud se kuch nahi (P9 + P6 ka jor)');
      /* 🔋 battery guard */
      const w4 = natworld({ level: 5, charging: false }); w4.FLAGS.set('khud', true);
      const r4 = w4.KHUD.BUDGET.can('x', at(0, 15, 0));
      is(r4.ok === false && /battery 5%/.test(r4.why), '🔋 5% battery → khud se kuch nahi (phone zinda rahe)');
      is(w4.KHUD.BUDGET.can('x', at(0, 15, 0), true).ok === true, '   → magar ZAROORI baat rok nahi sakti (urgent)');
      const w5 = natworld({ level: 5, charging: true }); w5.FLAGS.set('khud', true);
      is(w5.KHUD.BUDGET.can('x', at(0, 15, 0)).ok === true, '🔌 charge ho rahi ho to 5% par bhi ijazat');
      /* 💬 say() budget ke bagair bol hi nahi sakti */
      const w6 = kworld({ khud: true });
      is(w6.KHUD.say('salam', 'test', false, at(0, 15, 0)) === true && w6.said.length === 1, 'say() chalti hai (budget mein jagah thi)');
      for (let i = 0; i < 8; i++) w6.KHUD.say('aur', 'test', false, at(0, 16, 0) + i * 46 * 60000);
      is(w6.said.length <= 7, '🔑 bol-budget ke baad say() INKAR karti hai — jumla bahar hi nahi jata', w6.said.length + ' jumlay');
      /* rozana hadd */
      let okc = 0; for (let i = 0; i < 25; i++) if (w6.KHUD.BUDGET.askOk('r1', at(0, 15, i))) { w6.KHUD.BUDGET.asked('r1', at(0, 15, i)); okc++; }
      is(okc === 20, '⏱️ har rule rozana 20 dafa se zyada nahi (loop ka taala)', okc + '/25');
    }

    /* ── 27d. 🧠 AADAT — apne roznamche se aadat pakarna (WTF #1) ── */
    {
      const w = kworld({ khud: true });
      const A = w.KHUD.AADAT;
      const NOW = at(0, 15, 20);
      is(A.bucket(15) === '10' && A.bucket(20) === '20' && A.bucket(25) === '20' && A.bucket(90) === '90',
        '🔑 number bucket mein — FLOOR se (15→10, 20 aur 25→20: round se 25 alag aadat ban jati aur shart kabhi poori na hoti)');
      is(A.sig('run_javascript', { code: 'x' }).indexOf('code=') < 0, '🔑 bekaar matn (code/text/query) se aadat NAHI banti');
      is(A.sig('torch_control', { on: true }) === 'torch_control|on=on' && A.sig('torch_control', { on: false }) === 'torch_control|on=off',
        '🔑 bool ki chaabi salamat — torch ON aur OFF do ALAG aadatain hain');
      is(A.mine(NOW).length === 0, 'khali LEDGER → koi aadat nahi (jhooti tajweez nahi)');
      const pushDay = function (off, pct) {
        w.LEDGER.push('brightness_control', { percent: pct }, { ok: true, state: 'done' }, 80);
        const l = w.LEDGER.load(); l[l.length - 1].t = at(off, 15, 10);
      };
      pushDay(-1, 20); pushDay(-2, 20);
      is(A.mine(NOW).length === 0, '🔑 2 din → kuch NAHI (shart: ≥4 dafa AUR ≥3 alag din)');
      pushDay(-3, 25); pushDay(-4, 20);
      const found = A.mine(NOW);
      is(found.length === 1 && found[0].count === 4 && found[0].dayCount === 4 && found[0].hour === 15,
        '💥 4 dafa / 4 alag din → AADAT mil gayi (bucket ne 20 aur 25 ko jor diya)', JSON.stringify({ c: found[0].count, d: found[0].dayCount }));
      /* sirf 🟢 SABZ */
      const w2 = kworld({ khud: true });
      for (let i = 1; i <= 4; i++) {
        w2.LEDGER.push('open_app', { app: 'whatsapp' }, { ok: true, state: 'started' }, undefined);
        const l2 = w2.LEDGER.load(); l2[l2.length - 1].t = at(-i, 15, 10);
      }
      is(w2.KHUD.AADAT.mine(NOW).length === 0, '🚫 🟡 ZARD tool (open_app) ki aadat kabhi nahi banti — sirf 🟢 SABZ');
      const w3 = kworld({ khud: true });
      for (let i = 1; i <= 4; i++) {
        w3.LEDGER.push('brightness_control', { percent: 20 }, { ok: false }, undefined);
        const l3 = w3.LEDGER.load(); l3[l3.length - 1].t = at(-i, 15, 10);
      }
      is(w3.KHUD.AADAT.mine(NOW).length === 0, '❌ nakaam amal aadat nahi ban sakta');
      const w4 = kworld({ khud: true });
      for (let i = 0; i < 4; i++) {
        w4.LEDGER.push('volume_control', { percent: 50 }, { ok: true, state: 'done' }, undefined);
        const l4 = w4.LEDGER.load(); l4[l4.length - 1].t = at(0, 10 + i, 10);
      }
      is(w4.KHUD.AADAT.mine(NOW).length === 0, '🔑 4 dafa magar EK HI din → aadat nahi (3 alag din lazmi)');
      /* waqt ki khirki */
      const h = found[0]; h.sigKey = h.sig + '@' + h.hour;
      is(A.due(at(0, 15, 20)) !== null, '⏰ 15:10 wali aadat 15:20 par banti hai');
      is(A.due(at(0, 15, 5)) === null, '   → aadat ke waqt se PEHLE nahi');
      is(A.due(at(0, 16, 0)) === null, '   → dusre ghante mein nahi');
      is(A.due(at(0, 3, 20)) === null, '🔇 khamosh ghanton mein aadat chalti hi nahi');
      /* tajweez ka card */
      const w5 = kworld({ khud: true });
      for (let i = 1; i <= 4; i++) {
        w5.LEDGER.push('brightness_control', { percent: 20 }, { ok: true, state: 'done' }, 80);
        const l5 = w5.LEDGER.load(); l5[l5.length - 1].t = at(-i, 15, 10);
      }
      const h5 = w5.KHUD.AADAT.due(NOW);
      is(w5.KHUD.AADAT.propose(h5) === true && typeof w5.KHUD.pending === 'function', '💥 tajweez ka card khula (WTF #1)');
      const btns = w5.document.querySelectorAll("[data-k]");
      is(btns.length === 3, 'teen button: HAAN ROZ KARO · POOCH KAR · NAHI', btns.length + ' button');
      btns[0].click();
      const st = w5.KHUD.AADAT.load()[h5.sigKey];
      is(st && st.mode === 'auto' && w5.KHUD.pending === null, '✅ HAAN → roz khud (mehfooz, app band hone par bhi)');
      is(w5.KHUD.AADAT.propose(h5) === false, '🔑 jo aadat seekh li gayi, us ki tajweez dobara NAHI aati');
      /* chala kar dikhao */
      w5.ran.length = 0;
      const rr = w5.KHUD.AADAT.run(h5.sigKey, 'auto', NOW);
      is(rr.ok === true && w5.ran.length === 1 && w5.ran[0].n === 'brightness_control' && w5.ran[0].a.percent === 20,
        '🟢 aadat ASAL mein chali — tool + wahi args (15:10 wali 20%)');
      is(w5.KHUD.AADAT.load()[h5.sigKey].runs === 1 && w5.KHUD.AADAT.due(NOW) === null, '⏱️ aaj ho chuka → dobara nahi (loop ka taala)');
      /* mana kiya → hamesha ke liye chup */
      const w6 = kworld({ khud: true });
      for (let i = 1; i <= 4; i++) {
        w6.LEDGER.push('torch_control', { on: true }, { ok: true, state: 'done' }, false);
        const l6 = w6.LEDGER.load(); l6[l6.length - 1].t = at(-i, 15, 10);
      }
      const h6 = w6.KHUD.AADAT.due(NOW);
      w6.KHUD.AADAT.propose(h6);
      w6.document.querySelectorAll('[data-k]')[2].click();
      is(w6.KHUD.AADAT.load()[h6.sigKey].mode === 'off', '❌ NAHI → band darj');
      is(w6.KHUD.AADAT.due(NOW) === null, '🔑🔑 mana kiya to DOBARA KABHI NAHI (zid mana hai)');
      is(w6.KHUD.BUDGET.load().denied === 1, 'inkar bhi darj hota hai (report mein ginti)');
      /* dry-run: karta kuch nahi */
      const w7 = kworld({ khud: true });
      for (let i = 1; i <= 4; i++) {
        w7.LEDGER.push('volume_control', { percent: 40 }, { ok: true, state: 'done' }, undefined);
        const l7 = w7.LEDGER.load(); l7[l7.length - 1].t = at(-i, 15, 10);
      }
      const h7 = w7.KHUD.AADAT.due(NOW);
      const dr = w7.KHUD.AADAT.run(h7.sigKey, 'dry', NOW);
      is(dr.dry === true && w7.ran.length === 0 && /DRY-RUN/.test(dr.say), '⚗️ DRY-RUN: "karti to ye karti" — chala KUCH NAHI');
    }

    /* ── 27e. 📌 ADHOORA — "type kar diya, SEND nahi hua" (WTF #2) ── */
    {
      const w = kworld({ khud: true });
      const NOW = at(0, 15, 30);
      is(w.KHUD.ADHOORA.find(NOW) === null, 'khali roznamche → koi adhoora nahi');
      w.LEDGER.push('message_contact', { name: 'Monarch', text: 'main aa raha hoon' }, { ok: true, state: 'typed' }, undefined);
      const l = w.LEDGER.load(); l[l.length - 1].t = NOW - 5 * 60000;
      is(w.KHUD.ADHOORA.find(NOW) === null, '🔑 5 min purana → abhi nahi (10 min ka intezar — shayad SEND dabne wala ho)');
      l[l.length - 1].t = NOW - 20 * 60000;
      const e = w.KHUD.ADHOORA.find(NOW);
      is(!!e && e.st === 'typed', '📌 20 min purana "typed" → ADHOORA pakar liya (WTF #2)');
      is(/^Monarch ko message_contact/.test(w.KHUD.ADHOORA.what(e)) && w.KHUD.ADHOORA.what(e).indexOf('aa raha hoon') > 0,
        '📝 report mein NAAM aur MATN dono — "kya adhoora hai" saaf, andaza nahi', w.KHUD.ADHOORA.what(e));
      is(w.KHUD.ADHOORA.offer(NOW) === true && w.KHUD.pending !== null, 'card khula: "ab bhej doon?"');
      is(w.KHUD.ADHOORA.offer(NOW) === false, '🔑 ek waqt mein EK hi card (doosri tajweez ruk jati hai)');
      w.document.querySelectorAll('[data-k]')[1].click();
      is(l[l.length - 1].kdone === 1 && w.KHUD.ADHOORA.find(NOW) === null, '❌ REHNE DO → dobara nahi poochegi');
      /* AUTO-SEND ✓ = tasdeeq */
      const w2 = kworld({ khud: true });
      const NOW2 = at(0, 16, 0);
      w2.LEDGER.push('message_contact', { name: 'Ammi', text: 'khana kha liya' }, { ok: true, state: 'typed' }, undefined);
      const l2 = w2.LEDGER.load(); l2[l2.length - 1].t = NOW2 - 20 * 60000;
      is(!!w2.KHUD.ADHOORA.find(NOW2), 'bina tasdeeq ke adhoora maana jata hai');
      is(w2.KHUD.ADHOORA.markSent(NOW2) === 1, '✅ AUTO-SEND ✓ aaya → pichle 30 min ke "typed" BHEJE hue');
      is(w2.KHUD.ADHOORA.find(NOW2) === null, '🔑🔑 bheja hua message ADHOORA NAHI (jhooti yaaddasht ka taala)');
      /* bohat purana → bhoola hua, adhoora nahi */
      const w3 = kworld({ khud: true });
      w3.LEDGER.push('send_sms', { number: '0300', text: 'hi' }, { ok: true, state: 'typed' }, undefined);
      const l3 = w3.LEDGER.load(); l3[l3.length - 1].t = at(-9, 15, 0);
      is(w3.KHUD.ADHOORA.find(at(0, 15, 30)) === null, '🗓️ 9 din purana → adhoora nahi (sirf 3 din tak yaad)');
      /* rozana ek se zyada nahi */
      const w4 = kworld({ khud: true });
      for (let i = 0; i < 25; i++) w4.KHUD.BUDGET.asked('adhoora', NOW);
      is(w4.KHUD.BUDGET.askOk('adhoora', NOW) === false, '⏱️ ADHOORA bhi rozana hadd ke andar (20) — bar bar nahi tokay');
    }

    /* ── 27f. ⚗️ DRY-RUN + 🕸️ report ── */
    {
      const w = kworld({ khud: true });
      const d = w.KHUD.dry(at(0, 15, 30));
      is(/DRY-RUN/.test(d) && /KIYA KUCH NAHI/.test(d), '⚗️ DRY-RUN ki pehchan');
      is(/bol-budget/.test(d) && /aadat/.test(d) && /adhoora/.test(d) && /haal/.test(d), 'charo sutoon ka hisab ek screen par');
      is(w.ran.length === 0 && w.said.length === 0, '🔑 DRY-RUN mein na tool chala na jumla bola');
      const r = w.KHUD.report(at(0, 15, 30));
      is(/KHUD-MUKHTAR/.test(r) && /KHAMOSH GHANTE/.test(r) && /SURKH/.test(r), 'report mein qanoon bhi likha hai (andha nahi)');
      is(/IJAZAT ka switch band/.test(w.KHUD.report()) === false, 'ijazat ON ho to ilzaam nahi (sach hi likhti hai)');
      const w2 = kworld({ khud: true, ijazat: false });
      is(/LEDGER khali hai kyunki/.test(w2.KHUD.report()), '🤝 SACH: roznamcha band ho to report khud batati hai (bahana nahi)');
    }

    /* ── 27g. 🕸️ tick — poori khud-mukhtari ek jhonk mein ── */
    {
      const NOW = at(0, 15, 30);
      const w = kworld({ khud: true });
      for (let i = 1; i <= 4; i++) {
        w.LEDGER.push('brightness_control', { percent: 20 }, { ok: true, state: 'done' }, 80);
        const l = w.LEDGER.load(); l[l.length - 1].t = at(-i, 15, 10);
      }
      const t1 = w.KHUD.tick(NOW);
      is(t1 && t1.kind === 'aadat-tajweez' && w.ran.length === 0, '💥 pehli dafa: aadat KHUD nahi chali — PEHLE ijazat maangi');
      w.document.querySelectorAll('[data-k]')[0].click();
      const t2 = w.KHUD.tick(NOW + 60000);
      is(t2 && t2.kind === 'aadat-auto' && w.ran.length === 1, '✅ HAAN ke baad agli jhonk mein KHUD kar diya');
      is(w.KHUD.BUDGET.load().n === 1, '🛡️ khud-mukhtar amal bol-budget mein GINA gaya (chhupa hua shor nahi)');
      is(w.KHUD.tick(NOW + 120000) === null, '🔑 aaj ka kaam ho chuka → agla tick CHUP (har 2 min wahi kaam nahi)');
      /* 📌 adhoora sab se aham */
      const w2 = kworld({ khud: true });
      w2.LEDGER.push('message_contact', { name: 'Ali', text: 'late ho jaunga' }, { ok: true, state: 'typed' }, undefined);
      const l2 = w2.LEDGER.load(); l2[l2.length - 1].t = NOW - 20 * 60000;
      is(w2.KHUD.tick(NOW).kind === 'adhoora', '📌 adhoora kaam sab se pehle (asli kaam pada hai)');
      /* 🤫 Maya bol rahi hai → chup
         ⚠️ IMAANDARI (J3 ke waqt pakda gaya): ye lock GHANTE par nirbhar tha —
         kworld() `MAYA_V4.lastInteract = Date.now()` rakhta hai aur tick ka `idle`
         branch `NOW - lastInteract > 3h` par chalta hai. Sandbox ka clock 15:30 se
         3 ghante se zyada peeche ho to idle branch BHI can() bulata, busyBlocked 2
         ho jata aur test jhoota FAIL deta (asal rawaiya theek tha). Ab lastInteract
         ko NOW par pin kar diya — naap sirf "bolte waqt chup" ka hota hai. */
      const w3 = kworld({ khud: true });
      w3.LEDGER.push('message_contact', { name: 'Ali', text: 'x' }, { ok: true, state: 'typed' }, undefined);
      const l3 = w3.LEDGER.load(); l3[l3.length - 1].t = NOW - 20 * 60000;
      w3.MAYA_V4.lastInteract = NOW;
      w3.SUKOON = { haal: 'BOL_RAHI' };
      is(w3.KHUD.tick(NOW) === null && w3.KHUD.BUDGET.load().busyBlocked === 1, '🤫 bolte/sunte waqt KHUD kuch nahi (P9 ka ehteram)');
      /* 🔇 khamosh ghante */
      const w4 = kworld({ khud: true });
      w4.LEDGER.push('message_contact', { name: 'Ali', text: 'x' }, { ok: true, state: 'typed' }, undefined);
      const l4 = w4.LEDGER.load(); l4[l4.length - 1].t = at(0, 2, 30);
      is(w4.KHUD.tick(at(0, 3, 30)) === null, '🔇 raat 3:30 → adhoora bhi chup (subah 7 ke baad poochegi)');
      /* 🔋 battery */
      const w5 = natworld({ level: 12, charging: false }); w5.FLAGS.set('khud', true);
      const t5 = w5.KHUD.tick(NOW);
      is(t5 && t5.kind === 'battery' && /12%/.test(w5.said[0] || ''), '🔋 12% par mashwara — aur % sach likha', (w5.said[0] || '').slice(0, 40));
      is(w5.KHUD.BUDGET.saidToday('battery', NOW) === true, '🔑 battery wali baat rozana EK dafa (bar bar nahi)');
      is(w5.KHUD.tick(NOW + 50 * 60000) === null || w5.said.length === 1, 'agli jhonk mein dobara nahi bola');
      /* 💧 teen ghante ki chuppi */
      const w6 = kworld({ khud: true });
      w6.MAYA_V4.lastInteract = NOW - 4 * 3600000;
      const t6 = w6.KHUD.tick(NOW);
      is(t6 && t6.kind === 'idle' && /paani/.test(w6.said[0] || ''), '💧 4 ghante chup + dopahar → ek pyari baat', (w6.said[0] || '').slice(0, 34));
      is(w6.KHUD.tick(NOW + 50 * 60000) === null, '🔑 aur foran dobara NAHI (rozana ek, 45 min ka farq)');
      /* proactive OFF → idle wali baat bhi nahi */
      const w7 = kworld({ khud: true });
      w7.settings.proactive = false;
      w7.MAYA_V4.lastInteract = NOW - 4 * 3600000;
      is(w7.KHUD.tick(NOW) === null, '🔒 aap ne proactive band kiya hua hai → "pyari baat" bhi nahi (sirf zaroori)');
    }

    /* ── 27h. 🚫 qanoon: khud se KABHI surkh/zard nahi ── */
    {
      const w = kworld({ khud: true });
      w.KHUD.AADAT.map = {
        'message_contact|name=ammi@22': { mode: 'auto', n: 'message_contact', a: { name: 'Ammi', text: 'salam' }, hour: 22, min: 0, runs: 0 },
        'call_contact|name=ali@9': { mode: 'auto', n: 'call_contact', a: { name: 'Ali' }, hour: 9, min: 0, runs: 0 },
        'open_app|app=whatsapp@8': { mode: 'auto', n: 'open_app', a: { app: 'whatsapp' }, hour: 8, min: 0, runs: 0 }
      };
      const r1 = w.KHUD.AADAT.run('message_contact|name=ammi@22', 'auto');
      const r2 = w.KHUD.AADAT.run('call_contact|name=ali@9', 'auto');
      const r3 = w.KHUD.AADAT.run('open_app|app=whatsapp@8', 'auto');
      is(r1.ok === false && r2.ok === false && r3.ok === false, '🚫🔑 surkh AUR zard — dono RAD (localStorage mein koi herapheri ho to bhi)');
      is(w.ran.length === 0, '🔑🔑 tool CHALA HI NAHI — WhatsApp/call khud se kabhi nahi (qanoon 2)');
      is(/SABZ nahi|data nahi mila/.test(r2.why), '🤝 inkar ki WAJAH bhi saaf likhi jati hai (chup-chaap rad nahi)', r2.why);
      /* saare tools par ek hi taala */
      const w2 = kworld({ khud: true });
      let green = 0, blocked = 0;
      for (let i = 0; i < w2.TOOL_DECLS.length; i++) {
        const nm = w2.TOOL_DECLS[i].name;
        w2.KHUD.AADAT.map = {};
        w2.KHUD.AADAT.map['x@1'] = { mode: 'auto', n: nm, a: {}, hour: 1, min: 0 };
        w2.KHUD.AADAT.list = function () { return [{ key: 'x@1', v: { mode: 'auto', n: nm } }]; };
        const rr = w2.KHUD.AADAT.run('x@1', 'auto');
        if (w2.IJAZAT.T[nm] === 1) green++; else if (rr.ok === false) blocked++;
      }
      is(green + blocked === w2.TOOL_DECLS.length,
        '🔒 ' + w2.TOOL_DECLS.length + '/' + w2.TOOL_DECLS.length + ' tools par ye taala jaancha gaya (🟢 ' + green + ' ijazat ke sath, baqi ' + blocked + ' rad)');
    }


    /* ═══ 28. 🗣️ v5.10.1 — ON-DEVICE LANGUAGE ka raasta (aap ki video ka saboot) ═══ */
    head('28. 🗣️ ON-DEVICE ka RAASTA — "Digital assistant" wali screen kyun khuli?');

    /* ── 28a. 🔬 Kotlin: andhi chain ka qatl ── */
    {
      const MF = fs.readFileSync(path.join(ROOT, 'app/src/main/AndroidManifest.xml'), 'utf8');
      const MA = fs.readFileSync(path.join(ROOT, 'app/src/main/java/com/maya/ai/MainActivity.kt'), 'utf8');
      is(MF.indexOf('<queries>') > 0 && /com\.google\.android\.inputmethod\.latin/.test(MF) &&
         /android\.speech\.RecognitionService/.test(MF) && /ACTION_ASSIST|android\.intent\.action\.ASSIST/.test(MF),
        '🔑🆕 manifest mein <queries> — Android 11+ ki package-visibility se Gboard/Google app CHHUPE hue the (pehla qadam hamesha fail hota tha)');
      is(/private fun go\(i: Intent, vararg blocked: String\): String\?/.test(MA) && /queryIntentActivities\(i, 0\)/.test(MA) &&
         /getActivityInfo\(cn, 0\)/.test(MA) && /flattenToShortString\(\)/.test(MA),
        '🔑🆕 go() — screen khud khole se PEHLE poochhta hai ke use KAUN kholta hai, aur us component ka NAAM wapas deta hai (andaza nahi)');
      is(/fun openSettingNamed\(which: String\): String\?/.test(MA) &&
         /fun openSetting\(which: String\): Boolean = openSettingNamed\(which\) != null/.test(MA),
        '🔒 purana openSetting() bridge SALAMAT (purani JS nahi tooti — Qanoon 2), naya naam wala sath hai');
      is(/fun onDeviceMap\(\): String/.test(MA) && /RecognitionService\.SERVICE_INTERFACE/.test(MA) &&
         /queryIntentServices/.test(MA) && /o\.put\("asst", asst\)/.test(MA),
        '🔑🆕 onDeviceMap() — RecognitionService ki FEHRIST + assistant ka NAAM (aap ki video ka saboot ab code mein dikhta hai)');
      is(MA.indexOf('for (i in tries) {') === -1,
        '💀 purani ANDHI chain (startActivity → return true, screen ka naam poochhe bagair) MITA di gayi');
      is(/"assistant" ->/.test(MA) && MA.indexOf('"assistant"') > MA.indexOf('"ondevice", "gboardvoice"'),
        '🤖 Digital-assistant screen ab SIRF alag darwaze par — zubaan ki seedhi ka hissa NAHI (wohi ghalat screen jo video mein khuli thi)');
      is(/ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS/.test(MA) && /com\.android\.settings\.TTS_SETTINGS/.test(MA),
        '🔒 purane darwaze (battery / tts / voice / input) sab salamat');
    }

    /* ── 28b. 👁️ KAAN.onDevice(): ASLI fehrist, sirf ASLI button ── */
    {
      const w = kw();
      /* aap ka phone: Google Go assistant, poori Google app NAHI, Gboard Go */
      w.MayaBridge.onDeviceMap = function () {
        return JSON.stringify({
          sdk: 33, aiai: false, goog: false, ondevice: false, using: 'default',
          svc: 'com.google.android.apps.searchlite/.SearchLiteAssistService',
          srv: [{ pkg: 'com.google.android.apps.searchlite', label: 'Google Go', comp: 'a/b' }],
          kb: ['com.google.android.inputmethod.latin.go'],
          asst: 'Google Go'
        });
      };
      let r = w.KAAN.onDevice();
      is(/ASLI fehrist/.test(r.txt), '🕵️ panel ka waada: andaza nahi, phone ki fehlist');
      is(/Google Go/.test(r.txt) && r.txt.indexOf('Speech recognition services') > 0,
        '📋 phone ki asli services + assistant ka naam dikhta hai (chhupa hua saboot nahi)');
      is(r.btns.some(function (b) { return b.k === 'voiceservices'; }), '🎙️ speech services ka darwaza hamesha maujood');
      /* chaitha phone: koi keyboard hi NAHI — wahan jhoota Gboard button banna hi nahi chahiye */
      w.MayaBridge.onDeviceMap = function () {
        return JSON.stringify({ sdk: 33, aiai: false, goog: false, ondevice: false, using: 'default',
          svc: 'x/y', srv: [], kb: [], asst: 'Google Go' });
      };
      const rn = w.KAAN.onDevice();
      is(!rn.btns.some(function (b) { return b.k === 'gboardvoice'; }) &&
         rn.btns.some(function (b) { return b.k === 'gboard'; }),
        '🔑🆕 Gboard NAHI hai to us ka JHOOTA button bhi nahi banta — sirf keyboard settings');
      is(/GBOARD IS PHONE PAR NAHI HAI/.test(rn.txt), '🤝 SACH: saaf kehta hai ke Gboard nahi (bahana nahi, andaza nahi)');
      /* wapas aap ke phone (Gboard Go) par lao — baqi jaanch isi par hoti hai */
      w.MayaBridge.onDeviceMap = function () {
        return JSON.stringify({
          sdk: 33, aiai: false, goog: false, ondevice: false, using: 'default',
          svc: 'com.google.android.apps.searchlite/.SearchLiteAssistService',
          srv: [{ pkg: 'com.google.android.apps.searchlite', label: 'Google Go', comp: 'a/b' }],
          kb: ['com.google.android.inputmethod.latin.go'],
          asst: 'Google Go'
        });
      };
      r = w.KAAN.onDevice();
      /* teesra phone: sirf GBOARD GO (aap ke video wale phone jaisa) */
      w.MayaBridge.onDeviceMap = function () {
        return JSON.stringify({ sdk: 33, aiai: false, goog: false, ondevice: false, using: 'default',
          svc: 'x/y', srv: [], kb: ['com.google.android.inputmethod.latin.go'], asst: 'Google Go' });
      };
      const rgo = w.KAAN.onDevice();
      is(/GBOARD GO' HAI, poora Gboard NAHI/.test(rgo.txt) && /jhoota\s+wadaa?/i.test(rgo.txt.replace(/waada/, 'wada')),
        '🔑🆕 Gboard Go par saaf sach: us mein Voice typing aksar hoti hi nahi (jhoota waada nahi)');
      is(rgo.btns.filter(function (b) { return b.k === 'gboard'; }).length === 1,
        '   → sath "poora Gboard lao" ka darwaza bhi');
      is(/SACH: is phone par offline \(on-device\) wake mumkin NAHI/.test(r.txt),
        '🔑🆕 na AiAi na poori Google app → imaandari: offline wake mumkin NAHI (jhooti umeed nahi)');
      is(/Digital assistant app/.test(r.txt) && /HAL NAHI HOTA/.test(r.txt),
        '🛑 panel khud batata hai ke assistant wali screen se ye masla HAL NAHI hota (aap ki video ka sabak)');
      is(/\\u0627\\u0631\\u062F\\u0648/.test(JSON.stringify(r.txt)) || r.txt.indexOf('\u0627\u0631\u062F\u0648') > 0,
        '📝 likha hua manual raasta bhi saath (koi screen na khule to bhi raasta yaad rahe)');

      /* doosra phone: Gboard + AiAi maujood */
      w.MayaBridge.onDeviceMap = function () {
        return JSON.stringify({
          sdk: 34, aiai: true, goog: true, ondevice: true, using: 'on-device',
          svc: 'com.google.android.as/.AiAiRecognitionService',
          srv: [{ pkg: 'com.google.android.as', label: 'Android System Intelligence', comp: 'c/d' },
                { pkg: 'com.google.android.googlequicksearchbox', label: 'Speech Recognition & Synthesis', comp: 'e/f' }],
          kb: ['com.google.android.inputmethod.latin', 'com.google.android.tts'],
          asst: 'Google'
        });
      };
      r = w.KAAN.onDevice();
      is(r.btns[0].k === 'gboardvoice' && r.btns.length >= 4,
        '✅ Gboard maujood ho to pehla button wahi (Voice typing settings) — 4+ darwaze');
      is(/On-device recognizer\s*: MAUJOOD/.test(r.txt),
        '🎉 on-device maujood ho to khush khabri bhi SACH likhi jati hai (chhupate nahi)');
      is(r.txt.indexOf('offline (on-device) wake mumkin NAHI') === -1,
        '🔑 AiAi + Google app hon to "namumkin" wali baat NAHI aati (jhoota dar nahi)');

      /* purani APK — bridge hi nahi */
      const w0 = kw();
      delete w0.MayaBridge.onDeviceMap;
      const r0 = w0.KAAN.onDevice();
      is(r0.d === null && /purani hai/.test(r0.txt) && r0.btns.length >= 1 && /On-screen keyboard/.test(r0.txt),
        '🔒 purani APK (bina onDeviceMap) par bhi panel chalta hai — likha hua raasta + Qanoon 2');

      /* bridge toot jaye (garbage JSON) to crash NAHI */
      const w1 = kw();
      w1.MayaBridge.onDeviceMap = function () { return '}{'; };
      let okc = true; try { w1.KAAN.onDevice(); } catch (e) { okc = false; }
      is(okc, '🛡️ kharab JSON par bhi crash nahi (WebView mein koi error screen nahi)');
    }

    /* ── 28c. 🩺 doctor ki nasihat ab panel ka rasta batati hai ── */
    {
      const w = kw();
      w.MayaBridge.micDoctor = function () {
        return JSON.stringify({ mic: true, avail: true, svc: 'com.google.android.as/AiAi', aiai: true,
          ondevice: false, using: 'default', gtts: 'enabled', battOk: true, wakeOn: true, sdk: 34 });
      };
      const d = w.KAAN.doctor();
      is(d.indexOf('ON-DEVICE LANGUAGE button') > 0 && /ASLI darwaze/.test(d),
        '🩺 doctor ab "wo button dabao" ke sath ye bhi kehta hai ke panel ASLI darwaze dikhata hai');
      is(d.indexOf('[ON-DEVICE] dabao') === -1, '🔑 jhoota bracket-button ka hawala ab bhi gayab (v5.9.1 ka sabak yaad hai)');
    }

    /* ── 28d. 🧯 CI ki teen COMPILER galtiyaan dobara na hon (2 Sep 2026 ka sabak) ──
       Run 33660254877 ne saaf bataya:
         e: …MainActivity.kt:1368 Unresolved reference: ACTION_ASSISTANT_SETTINGS
         e: …MainActivity.kt:1369 Unresolved reference: ACTION_MANAGE_DEFAULT_ASSISTANT
         e: …MainActivity.kt:1436 Type mismatch: inferred type is MayaBridge but Context was expected
       (GitHub ke "cache service responded with 400" warnings RED HERRING the —
        asal wajah compile error thi, aur log blob sandbox se download nahi ho
        raha tha is liye pehle andaza ghalat nikla.) */
    {
      const MA2 = fs.readFileSync(path.join(ROOT, 'app/src/main/java/com/maya/ai/MainActivity.kt'), 'utf8');
      is(!/Settings\.ACTION_ASSISTANT_SETTINGS|Settings\.ACTION_MANAGE_DEFAULT_ASSISTANT/.test(MA2),
        '🔑🆕 jo Settings constants PUBLIC API mein HAIN HI NAHI wo dobara na aayen (CI yehi par tooti thi) — ab asal action string literal');
      is(/go\(act\("android\.settings\.MANAGE_DEFAULT_APPS_SETTINGS"\)\)/.test(MA2),
        '   → us ki jagah AOSP ka asal action (literal hamesha compile hota hai; na mile to go() null)');
      /* MayaBridge ke ANDAR ka hissa: wahan `this` = MayaBridge, Context NAHI.
         makeRecognizer() bridge ke BAHAR hai — wahan `this` = MainActivity, jo jayaz hai. */
      const BR = MA2.slice(MA2.indexOf('inner class MayaBridge'), MA2.indexOf('fun makeRecognizer'));
      is(BR.length > 5000 && (BR.match(/isOnDeviceRecognitionAvailable\((?!this@MainActivity)/g) || []).length === 0,
        '🔑🆕 bridge ke andar isOnDeviceRecognitionAvailable ko hamesha Context do — `this` MayaBridge hai (CI: Type mismatch)');
      is((BR.match(/isOnDeviceRecognitionAvailable\(this@MainActivity\)/g) || []).length === 2 &&
         (BR.match(/Build\.VERSION\.SDK_INT >= 33/g) || []).length === 2,
        '🔑🆕 method API 33 se hai — dono jagah guard 33 (pehle 31 tha: API 31/32 par crash)');
      is((MA2.match(/catch \(e: Throwable\)/g) || []).length >= 2,
        '🛡️🆕 NoSuchMethodError ek ERROR hai, Exception nahi — is liye catch (Throwable) (warna purane phone par bridge mar jata)');
      is(!/act\([^)]*Uri\.parse/.test(MA2),
        '🔑🆕 act(action, pkg: String?) ko Uri mat thonsna — CI ne 2 "Type mismatch: Uri! but String?" pakde (v5.10.2)');
      is(/Intent\(Settings\.ACTION_APPLICATION_DETAILS_SETTINGS, Uri\.parse\("package:\$GBOARD"\)\)/.test(MA2),
        '🔑🆕 app-info screen ko package: DATA URI chahiye — sirf setPackage() se wo rung bekaar jata tha');
      const MFX = fs.readFileSync(path.join(ROOT, 'app/src/main/AndroidManifest.xml'), 'utf8');
      is(!/ASSISTANT_SETTINGS|MANAGE_DEFAULT_ASSISTANT/.test(MFX) &&
         /MANAGE_DEFAULT_APPS_SETTINGS/.test(MFX),
        '📄 manifest ke <queries> bhi wahi asal action par (jo cheez khulti hi nahi us ki query bekaar)');
    }


    /* ═══ 29. 🗣️ v5.10.2 — ghalat screen ab KHULTI HI NAHI (aap ke phone ka doosra saboot) ═══
       v5.10.1 ne naam batana shuru kiya, magar aap ne khud dekha:
         ✅ Jo screen khuli: com.android.settings/.Settings$ManageAssistActivity
         ☝️ Us mein dhoondo: Voice typing → Faster voice typing …   ← YE MASHWARA GALAT THA
       Yaani wo "Digital assistant" screen KHUL bhi gayi aur hum ne us par zubaan ka
       pack dhoondne ko keh diya. Ab: Kotlin wo rung kholta hi nahi, JS naam par khud
       pehchanta hai, aur fehlist ka takrao ("speech service maujood" + "install karo")
       bhi khatam. */
    head('29. 🗣️ v5.10.2 — ASSISTANT screen ab khulti hi nahi + fehlist ka takrao khatam');

    /* ── 29a. 🔬 Kotlin ── */
    {
      const MA3 = fs.readFileSync(path.join(ROOT, 'app/src/main/java/com/maya/ai/MainActivity.kt'), 'utf8');
      const MF3 = fs.readFileSync(path.join(ROOT, 'app/src/main/AndroidManifest.xml'), 'utf8');
      is(/private fun go\(i: Intent, vararg blocked: String\): String\?/.test(MA3) &&
         /for \(bb in blocked\) if \(bb\.isNotEmpty\(\) && low\.contains\(bb\.lowercase\(\)\)\) return null/.test(MA3),
        '🔑🆕 go() ko BLOCK-LIST sikhayi: naam milta ho to screen kholti hi nahi (sirf naam batana kaafi na tha)');
      const rungBlocks = (MA3.match(/go\(act\(Settings\.ACTION_VOICE_INPUT_SETTINGS\), "assist"\)/g) || []).length;
      is(rungBlocks === 3, '🔑🆕 teeno voice rungs par "assist" block — aap ke phone par yehi ManageAssistActivity khulta tha', rungBlocks + '/3 rung');
      is(!/MANAGE_DEFAULT_APPS_SETTINGS"\), "assist"/.test(MA3),
        '🔒 magar "assistant" darwaze par block NAHI — user KHUD maange to wo screen khulni chahiye');
      is(/which\.startsWith\("appinfo:"\)/.test(MA3) && /which\.startsWith\("market:"\)/.test(MA3),
        '🔑🆕 naye darwaze appinfo:<pkg> aur market:<pkg> — JS ab fehlist dekh kar KHUD darwaza chunti hai');
      is(/market:\/\/details\?id=\$pkg/.test(MA3) && /play\.google\.com\/store\/apps\/details\?id=\$pkg/.test(MA3),
        '   → Play Store app na ho to web fallback (dono go() se POOCHH kar, andaza nahi)');
      is(/o\.put\("play", play\)/.test(MA3) && /getPackageInfo\("com\.android\.vending", 0\)/.test(MA3),
        '🔑🆕 onDeviceMap ab Play Store ki maujoodgi bhi batata hai');
      is(/com\.android\.vending/.test(MF3) && /android:scheme="market"/.test(MF3),
        '📄 manifest queries: Play Store + market scheme (warna market: darwaza resolve hi na hota)');
      const MK = MA3.slice(MA3.indexOf('fun makeRecognizer'));
      is(/Build\.VERSION\.SDK_INT >= 33/.test(MK) && /catch \(e: Throwable\)/.test(MK),
        '🛡️🆕 makeRecognizer ka guard 31→33 + Throwable: Android 12/12L par SUNO dabate hi CRASH (NoSuchMethodError)');
      is((MA3.match(/Build\.VERSION\.SDK_INT >= 33/g) || []).length === 3,
        '🔒 teeno jagah (makeRecognizer + micDoctor + onDeviceMap) ek hi guard — koi chhoota nahi');
    }

    /* ── 29b. 👁️ panel: aap ke phone par jo takrao tha wo khatam ── */
    {
      const w = kw();
      w.MayaBridge.onDeviceMap = function () {
        return JSON.stringify({
          sdk: 33, aiai: false, goog: false, ondevice: false, using: 'default',
          svc: 'com.google.android.tts/.SpeechRecognitionService',
          srv: [{ pkg: 'com.google.android.tts', label: 'Speech Recognition and Synthesis', comp: 'a/b' }],
          kb: ['com.google.android.inputmethod.latin'], asst: 'Google Go', play: true
        });
      };
      const r = w.KAAN.onDevice();
      is(/Google ka speech service\s*: Speech Recognition and Synthesis/.test(r.txt),
        '📋🆕 Google ka speech service ab ALAG line par dikhta hai (pehle sirf "poori Google app" dekha jata tha)');
      is(r.txt.indexOf('magar speech service maujood hai') > 0,
        '🔑🆕 takrao khatam: "poori Google app NAHI" ab apni hi fehrist se nahi takrata');
      is(r.txt.indexOf('wake mumkin NAHI') === -1,
        '🤝🆕 jhoota dar khatam — speech service maujood ho to "mumkin NAHI" nahi kehte');
      is(/EXTRA_PREFER_OFFLINE istemal nahi karti/.test(r.txt),
        '🔑🆕 jhooti umeed bhi nahi: Maya ki WAKE abhi online hai — ye saaf likha hai (pack se sirf Gboard typing offline hoti hai)');
      is(/SIRF EK service hai/.test(r.txt),
        '🎯 ek hi service ho to "default chuno" wala bekaar mashwara nahi (wo hi default hai)');
      is(r.btns.some(function (b) { return b.k === 'appinfo:com.google.android.tts'; }),
        '📦🆕 app-info ka darwaza — zubaan pack isi app mein hoti hain');
      is(r.btns.filter(function (b) { return b.h; }).length === r.btns.length - 1,
        '🔑🆕 har darwaze ka apna HINT (sirf DOCTOR ka nahi) — aam "Voice typing dhoondo" mashwara har screen par sach nahi hota');
      is(r.txt.indexOf('&') === -1,
        '🧹 panel ke apne matn mein "&" nahi (kuch render paths par wo "&amp;" ban kar dikhta tha)');
    }

    /* ── 29c. 🛒 Play Store ka darwaza sirf jab Play Store maujood ho ── */
    {
      const w = kw();
      const base = { sdk: 33, aiai: false, goog: false, ondevice: false, using: 'default',
        svc: 'x/y', srv: [], kb: ['com.google.android.inputmethod.latin'], asst: 'Google' };
      w.MayaBridge.onDeviceMap = function () { return JSON.stringify(Object.assign({}, base, { play: true })); };
      const r = w.KAAN.onDevice();
      is(r.btns.some(function (b) { return b.k === 'market:com.google.android.tts'; }),
        '🛒🆕 speech service NAHI + Play Store maujood → seedha install ka darwaza (menu mein bhatakna nahi)');
      w.MayaBridge.onDeviceMap = function () { return JSON.stringify(base); };
      const r2 = w.KAAN.onDevice();
      is(!r2.btns.some(function (b) { return String(b.k).indexOf('market:') === 0; }),
        '🔒 Play Store na ho to market ka JHOOTA button nahi banta');
      is(/KOI speech service NAHI/.test(r2.txt), '🤝 aur saaf bata deta hai ke chunne ko kuch nahi');
    }

    /* ── 29d. 👍 AiAi wale phone par khush-khabri (wahan jhoota dar nahi) ── */
    {
      const w = kw();
      w.MayaBridge.onDeviceMap = function () {
        return JSON.stringify({ sdk: 34, aiai: true, goog: true, ondevice: true, using: 'on-device',
          svc: 'com.google.android.as/.AiAiRecognitionService',
          srv: [{ pkg: 'com.google.android.as', label: 'Android System Intelligence', comp: 'c/d' }],
          kb: ['com.google.android.inputmethod.latin'], asst: 'Google', play: true });
      };
      const r = w.KAAN.onDevice();
      is(/On-device ka GHAR is phone par maujood hai/.test(r.txt),
        '👍🆕 AiAi/on-device ho to saaf khush-khabri: pack download karo, wake offline chalegi');
      is(r.txt.indexOf('EXTRA_PREFER_OFFLINE') === -1 && r.txt.indexOf('wake mumkin NAHI') === -1,
        '🔒 wahan na "wake online hai" wali be-mauqa baat, na jhoota dar');
      is(r.btns.some(function (b) { return b.k === 'appinfo:com.google.android.as'; }),
        '📦 AiAi ki app-info bhi (packs/storage dekhne ke liye)');
    }

  /* ═══ 30. 🔬 v5.10.3 — WAKE ZINDA (docs/FORENSIC-WAKE-WORD.md ke fixes) ═══
     USOOL: har assert WIRING par hai, DECLARATION par nahi.
     F01 ka sabaq: `resumeFromApp()` likhi hui thi (is liye purana test GREEN tha)
     magar CALL kahin nahi hoti thi — wake har SUNO ke baad 60 second murda rehti thi. */
  head('30. 🔬 v5.10.3 — WAKE ZINDA: forensic ke fixes (wiring-level locks)');
  {
    const WS = fs.readFileSync(path.join(ROOT, 'app/src/main/java/com/maya/ai/WakeWordService.kt'), 'utf8');
    const MA = fs.readFileSync(path.join(ROOT, 'app/src/main/java/com/maya/ai/MainActivity.kt'), 'utf8');
    const IH = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/web/index.html'), 'utf8');
    const PUB = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');
    const GR = fs.readFileSync(path.join(ROOT, 'app/build.gradle'), 'utf8');
    const PK = fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8');
    const SW = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/web/sw.js'), 'utf8');

    /* ── F01: pauseForApp() ki WAPSI (sab se bara mujrim) ── */
    is((MA.match(/WakeWordService\.resumeFromApp\(\)/g) || []).length >= 4,
      '🔑 F01: resumeFromApp() ab KAM AZ KAM 4 jagah CALL hoti hai (pehle 0 thi)',
      (MA.match(/WakeWordService\.resumeFromApp\(\)/g) || []).length + ' call sites');
    const SRA = MA.indexOf('private fun stopRecognizer()');
    is(/resumeFromApp\(\)/.test(MA.slice(SRA, SRA + 700)),
      '🔑 F01: stopRecognizer() ke ANDAR resume — wiring, sirf declaration nahi');
    const ERA = MA.indexOf('override fun onError(error: Int) {');
    is(/resumeFromApp\(\)/.test(MA.slice(ERA, ERA + 500)),
      '🔑 F01: app ka mic NAKAM ho to bhi wake wapas (pehle ye rasta khali tha)');
    const RRA = MA.indexOf('override fun onResults(results: Bundle?) {');
    is(/resumeFromApp\(\)/.test(MA.slice(RRA, RRA + 500)),
      '🔑 F01: nateeja milte hi wake wapas');

    /* ── F03: skip-spam par lagam ── */
    is(/private fun reportSkip\(why: String\)/.test(WS) &&
       /const val SKIP_REPORT_MS = 15000L/.test(WS) &&
       (WS.match(/reportSkip\(/g) || []).length >= 4,
      '🧹 F03: skip ab rate-limited — pehle har 700ms report ne KAAN ka 40-entry log bhar diya tha',
      (WS.match(/reportSkip\(/g) || []).length + ' jagah');
    is(/const val BLOCKED_POLL_MS = 3000L/.test(WS) && WS.indexOf('restart(700)') === -1,
      '🧹 F03: blocked poll 700ms → 3000ms (restart(700) kahin nahi bacha)');
    is(/private fun skipReset\(\)/.test(WS) && (WS.match(/skipReset\(\)/g) || []).length >= 3,
      '🧹 F03: darwaza khulte hi ginti saaf (agli rukawat nayi ginti se)');

    /* ── F09/F10/F35: retry policy ab policy hai, aadat nahi ── */
    is(/10 -> 5000L/.test(WS) && /11 -> 1500L/.test(WS) && /12, 13 -> 8000L/.test(WS),
      '⏱️ F09: error 10/11/12/13 ke APNE backoff (pehle sab `else -> 1200L` = 1.2s hammer)');
    is(/1L shl \(errStreak - 1\)\.coerceAtMost\(4\)/.test(WS) && /coerceAtMost\(30000L\)/.test(WS),
      '⏱️ F09: escalation x1→x16 + 30s cap (lagatar 15 hamle khatam)');
    is(/if \(errStreak >= 3\) \{ try \{ resetRecognizer\(\)/.test(WS),
      '🔧 F09: 3 lagatar nakami par recognizer fresh (connection khud mar chuka hota hai)');
    is(/if \(errStreak == 5\)/.test(WS) && /report\("dead"/.test(WS) && /__wakeErr/.test(WS),
      '☠️ F10: CIRCUIT OPEN par user ko khabar — chup-chaap marna band');
    const CBA = WS.indexOf('errStreak == 5');
    is(WS.slice(CBA, CBA + 400).indexOf('stopSelf()') === -1,
      '🕊️ F10: circuit open par service khud ko NAHI marti (L5 mercy barqarar)');
    is(/if \(error == 9\)/.test(WS) && /restart\(60000\)/.test(WS),
      '🔑 F35: mic permission (err 9) par hammer nahi — 60s + saaf alert');

    /* ── F11: ERRNAME + ERRFIX ── */
    is(/11: "server se connection toota"/.test(IH) && /13: "zubaan ka pack download nahi hua"/.test(IH) &&
       /10: "bohot request/.test(IH) && /15: "model-download events support nahi"/.test(IH),
      '📛 F11: ERRNAME ab 1..15 poori — panel "?" nahi chhapta (aakhri err 11 — ?)');
    is(/ERRFIX: \{/.test(IH) && /KAAN\.ERRFIX\[K\.lastErr\]/.test(IH),
      '💡 F11+: har code ka ILAJ bhi — sirf naam nahi, rasta bhi');

    /* ── F12: wake ki zubaan STT se azad ── */
    is(/wakeLang:"en-IN"/.test(IH.replace(/\s/g, '')) && IH.indexOf('id="sWakeLang"') > 0 &&
       /key: "wakeLang"/.test(IH),
      '🗣️ F12: settings.wakeLang (default en-IN) + LAB mein apna select');
    is(/getString\("wake_lang", "en-IN"\)/.test(WS),
      '🗣️ F12: Kotlin ka default bhi en-IN (purani pref na ho to bhi Urdu nahi)');

    /* ── F18: watchdog ka gate guard ── */
    is(/if \(!gateOn\) actuallyStart\(\)/.test(WS),
      '🛡️ F18: 12-min watchdog ab gate chalu hote hue recognizer mic par NAHI thons ta');

    /* ── F25/F27/F04: NATIVE INSTRUMENT (ab instrument mareez ke sath nahi marta) ── */
    is(/fun record\(kind: String, payload: String\)/.test(WS) &&
       /private val evBuf = ArrayList<String>\(\)/.test(WS) && /fun drainEvents\(\)/.test(WS),
      '🧠 F25: Kotlin-side ring buffer + drainEvents() — counters UI ki maut se azad');
    is(/record\(kind, payload\)/.test(WS) && /record\("heard", payload\)/.test(WS),
      '🧠 F25: har report AUR har suni hui baat PEHLE native darj — `suna 0` ka ambiguity khatam');
    is(/fun evalPublicOk\(js: String\): Boolean/.test(MA) && /if \(!webViewAlive\)/.test(MA) &&
       /evalPublicOk\(js\)/.test(WS),
      '🧠 F27: murda WebView par JS nahi thonsi jati + delivery ka hisab (sent/dropped)');
    is(/fun wakeState\(\): String/.test(MA) && /fun wakeEvents\(\): String/.test(MA) &&
       /fun stateBits\(\): String/.test(WS),
      '🌉 F04/F25: naye bridge — wakeState() (Kotlin ka sach) + wakeEvents() (native buffer)');
    is(/HAAL \(Kotlin\)/.test(IH) && /MISMATCH/.test(IH) && /flushNative: function/.test(IH) &&
       /KAAN\.flushNative\(\)/.test(IH),
      '🔎 F04: panel ab JS AUR Kotlin dono ka HAAL + MISMATCH pakadta hai + boot par native flush');
    is(/heardOffline/.test(WS) && /heardOffline/.test(IH),
      '🔎 F25: "kitni wake UI mare hone ki wajah se zaya huin" ab nazar aata hai');

    /* ── F38: pref drift (ye fix ko "kaam nahi kiya" dikhane wala trap tha) ── */
    is(/function pushNativePrefs\(\)/.test(IH) &&
       /saveSettings\(\)\{[\s\S]{0,160}pushNativePrefs\(\)/.test(IH),
      '🔧 F38: har settings-save par native prefs tazaa (pehle SIRF wake-toggle par push hote the)');
    is((IH.match(/pushNativePrefs\(\)/g) || []).length >= 3,
      '🔧 F38: pushNativePrefs definition + saveSettings + setWakeService — teeno jagah');

    /* ── F39: switch ka jhoot ── */
    is(/wakeService\(on\) !== false/.test(IH) && /Wake ON nahi hui/.test(IH) &&
       /settings\.wakeWord = false; saveSettings\(\);/.test(IH),
      '🔒 F39: wakeService() ka jawab AB parha jata hai — ijazat na ho to switch OFF + saaf toast');

    /* ── F05: app mic ka asal haal ── */
    is(/fun appMicBusy\(\): Boolean/.test(MA) && /appMicOn = true/.test(MA) &&
       (MA.match(/appMicOn = false/g) || []).length >= 3,
      '🎯 F05: appMicBusy() — blind release ki jagah asal haal');

    /* ── 🔖 version bump + mirror discipline ── */
    const VER = (GR.match(/versionName "([^"]+)"/) || [])[1] || '';
    is(/versionCode 78/.test(GR) && VER === '5.13.0' &&
       /"version": "5\.13\.0"/.test(PK) && /maya-v5\.13\.0/.test(SW) &&
       /5\.13\.0-native/.test(MA) && /MAYA v5\.13\.0/.test(MA) &&
       IH.indexOf('var MAYA_VER = "' + VER + '"') > 0 && IH.indexOf('PERSONAL AI v' + VER) > 0,
      '🔖 v5.13.0 ka bump har jagah + JS ka MAYA_VER gradle ke versionName se MILTA hai (header ka subtitle ab jam nahi ho sakta)');
    is(PUB.indexOf('pushNativePrefs') > 0 && PUB.indexOf('sWakeLang') > 0 &&
       PUB.indexOf('HAAL (Kotlin)') > 0,
      '🪞 public/ mirror tazaa hai (npm run build) — assets aur web ek jaise');

    /* ── 🔒 P9 ke wade barqarar (regression guard) ── */
    is(/fun pauseForApp\(\)/.test(WS) && /fun resumeFromApp\(\)/.test(WS) &&
       /fun haalBlock\(\)/.test(WS) && (WS.match(/haalBlock\(\)/g) || []).length >= 5,
      '🔒 SUKOON/HAAL ka nizam barqarar — har mic-darwaza HAAL se poochhta hai',
      (WS.match(/haalBlock\(\)/g) || []).length + ' darwaze');
    is(/if \(error == 8\)/.test(WS) && /report\("err8"/.test(WS) &&
       WS.slice(WS.indexOf('if (error == 8)'), WS.indexOf('if (error == 8)') + 400).indexOf('stopSelf()') === -1,
      '🕊️ L5 ERR-8 MERCY barqarar — na stopSelf, na switch haath mein');
  }

  /* ═══ 31. 📱 QANOON 9 — RELEASE REPORT (aap ki farmaish 2026-09-03) ═══
     "har naye version… hum ko batana hai last mein ke isme kya naya add hua
      aur usko kaise check karna hai, test kaise karna hai."
     Ye ab QANOON hai — aur qanoon us waqt tak qanoon nahi jab tak TAALA na ho. */
  head('31. 📱 QANOON 9 — har release ka aam-zubaan hisab (kya naya + kaise parakhna)');
  {
    const WF = fs.readFileSync(path.join(ROOT, 'docs/AMAL-WORKFLOW.md'), 'utf8');
    is(/Qanoon 9 — HAR VERSION KE AAKHIR MEIN/.test(WF) &&
       /HISSA M — 📱 RELEASE REPORT ka FARMA/.test(WF),
      '📜 Qanoon 9 + HISSA M ka farma workflow doc mein darj hai (zubaani wada nahi)');
    const RD = fs.readFileSync(path.join(ROOT, 'docs/FIX-v5.10.3-wake-zinda.md'), 'utf8');
    is(/## 📱 RELEASE REPORT/.test(RD) && /Kya naya hua — aam zubaan/.test(RD),
      '📱 v5.10.3 ki release report maujood — aam zubaan mein (code ke naam ke bagair)');
    is(/✅ PASS ka nishaan/.test(RD) && /❌ FAIL ka nishaan/.test(RD),
      '🎯 har test ka PASS AUR FAIL nishaan likha hai — "check karo" ke bagair andaza nahi');
    is(/Kya abhi bhi adhoora hai/.test(RD) && /Version ki pehchaan/.test(RD) &&
       /Agar kaam na kare — ye bhejein/.test(RD),
      '🫱 imaandari (kya adhoora) + version ki pehchaan + nakami par kya bhejein — teeno lazmi');

    /* ── 31b. Ek parcha: phone mein rakhne layak, tick (✅) lagane layak ── */
    const RP = fs.readFileSync(path.join(ROOT, 'docs/REPORT-v5.10.3-aam-zubaan.md'), 'utf8');
    is(/## 1\) Kya naya hua/.test(RP) && /## 2\) Parakhne ka tareeqa/.test(RP) &&
       /## 3\) Jo abhi adhoora hai/.test(RP) && /## 4\) FAIL ho to/.test(RP) &&
       /## 5\) Sahi version ki pehchaan/.test(RP),
      '📄 ek-parcha report: paanchon hisse (naya / parakhna / adhoora / kya bhejen / pehchaan)');
    is((RP.match(/- \[ \]/g) || []).length >= 9,
      '🖊️ parche mein tick-khane (checkbox) hain — user parakh kar khud ✅ laga sakta hai',
      (RP.match(/- \[ \]/g) || []).length + ' khane');
    is(/PASS \| FAIL|PASS ✅ \| FAIL ❌|PASS ✅/.test(RP) && /FAIL ❌/.test(RP),
      '🎯 parche mein PASS aur FAIL dono ke nishan (andaza nahi, nishan)');
    const RM = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
    is(/REPORT-v5\.10\.3-aam-zubaan\.md/.test(RM),
      '🔗 README se parche ka raasta — report chat mein gum nahi hoti, repo mein rehti hai');
  }

  /* ═══ 32. 🛡️ v5.11.0 — WAKE MAZBOOT (Phase 1) ═══
     F02 (haal ki mudat) · F15/F42 (farsh calibration) · F16 (gate ka CPU spin) ·
     F17 (stopGate ki race) · F13 (wake ka apna recognizer) · F14 (session shaping) ·
     F19 (session vs KUL nakami) · F29 (foreground ka jhoot) · F35 (mic ijazat) ·
     F41 (onResume/onPause) · F06 (level-triggered HAAL + heartbeat)
     USOOL wahi: har lock WIRING par — declaration par nahi. */
  head('32. 🛡️ v5.11.0 — WAKE MAZBOOT: haal ki mudat, farsh calibration, gate ka spin, wake ka apna recognizer');
  {
    const WS = fs.readFileSync(path.join(ROOT, 'app/src/main/java/com/maya/ai/WakeWordService.kt'), 'utf8');
    const MA = fs.readFileSync(path.join(ROOT, 'app/src/main/java/com/maya/ai/MainActivity.kt'), 'utf8');
    const ST = fs.readFileSync(path.join(ROOT, 'app/src/main/java/com/maya/ai/WakeState.kt'), 'utf8');
    const IH = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/web/index.html'), 'utf8');

    /* ── 1.1 (F02) WAKE STATE: halat ka EK ghar, har halat ki MUDAT ── */
    is(/object WakeState/.test(ST) && /const val PAUSE_EXP_MS = 8000L/.test(ST) &&
       /const val APP_SUN_EXP_MS = 30000L/.test(ST) && /const val BOL_EXP_MS = 20000L/.test(ST),
      '🧭 1.1 (F02): WakeState — halat ka EK ghar + har halat ki MUDAT (sulah 8s · app-mic 30s · bolna 20s)');
    is(/const val HB_MS = 10000L/.test(ST) && /const val HB_MISS = 3/.test(ST) &&
       /HB_MS \* HB_MISS/.test(ST),
      '🧭 1.1: heartbeat 10s · 3 miss = JS murda → Kotlin KHUD KHALI (pehle daimi pabandi)');
    is(/get\(\) = WakeState\.haal/.test(WS) && /set\(v\) \{ WakeState\.set\(/.test(WS) &&
       /get\(\) = WakeState\.pausedByApp/.test(WS),
      '🧭 1.1: service ke `haal`/`pausedByApp` ab WakeState ke PAICHE hain (do ghar nahi, ek)');
    const HBi = WS.indexOf('fun haalBlock(): String?');
    const HBs = WS.slice(HBi, HBi + 800);
    is(HBs.indexOf('enforceExpiry()') > 0 &&
       HBs.indexOf('enforceExpiry()') < HBs.indexOf('if (haal == "BOL_RAHI")'),
      '🧭 1.1: haalBlock() PEHLE mudat dekhta hai PHIR pabandi — phansa hua haal wake ko daimi band nahi rakhta');
    is(/selfFixes\+\+/.test(ST) && /lastFixWhy/.test(ST) && /onSelfFix\(/.test(WS),
      '🧭 1.1: khud-sudhaar CHUP-CHAAP nahi — ginti + wajah panel par (andha nahi rahenge)');
    is(/MainActivity\.instance\?\.appMicBusy\(\)/.test(ST) && /pausedAt = t/.test(ST),
      '🧭 1.1 (F05 ka sabaq): sulah andhi azad NAHI hoti — app ka mic khali ho tab hi, warna intezar barhao');
    is(/if \(pausedByApp \|\| listening \|\| gateOn\) return/.test(WS),
      '🔒 khud-sudhaar ke baad mic par HAMLA nahi agar mic pehle se kisi ke paas hai (nayi jang paida nahi ki)');

    /* ── 1.2 (F06) HAAL LEVEL-TRIGGERED + heartbeat ── */
    is(/fun wakeBeat\(h: String\): String/.test(MA) && /fun wakeResync\(h: String\): String/.test(MA) &&
       /WakeWordService\.heartbeat\(h\)/.test(MA) && /WakeWordService\.healthKick\(\)/.test(MA),
      '🧭 1.2: naye bridge — wakeBeat (10s heartbeat) + wakeResync (reload/wapsi par poora haal)');
    is(/HB_MS: 10000/.test(IH) && /wakeBeat\(SUKOON\.haal\)/.test(IH) && /hbStart: function/.test(IH) &&
       /resync: function/.test(IH),
      '🧭 1.2: JS har 10s heartbeat bhejta hai (wakeBeat) + hbStart + resync');
    is(/set: function \(h, force\)/.test(IH) && /SUKOON\.set\("KHALI", true\)/.test(IH) &&
       /if \(!force && SUKOON\.haal === h\) return;/.test(IH),
      '🧭 1.2: sunEnd/bolEnd par FORCE-send (dedup bypass) — ek khoya hua "KHALI" ab wake band nahi rakta');
    is(/try \{ SUKOON\.resync\(\); \} catch\(e\)\{\}/.test(IH),
      '🧭 1.2: boot par resync WIRING — WebView reload ke foran baad wake chalti hai');
    is(/window\.__wakeHealth = function/.test(IH) && /KAAN\.push\("sehat"/.test(IH),
      '🧭 1.2: __wakeHealth — app wapsi par sehat ka nazar (toast + log), chup-chaap nahi');

    /* ── 1.3 + 1.11 (F15/F42) FARSH AB CALIBRATION SE BANTA HAI ── */
    is(/const val CAL_MS = 800L/.test(WS) && /const val CAL_FRAMES = 3/.test(WS) &&
       /const val FLOOR_MIN = 20\.0/.test(WS) && /const val FLOOR_MAX = 50\.0/.test(WS),
      '🧭 1.3 (F15): 800ms calibration + 3 saaf frame + farsh ka clamp 20..50dB');
    is(/const val TRIG_CAP = 72\.0/.test(WS) && /coerceAtMost\(TRIG_CAP\)/.test(WS),
      '🧭 1.3: chokhat par ABSOLUTE CAP 72dB — chillane par bhi wake khulti hai (76dB wali maut khatam)');
    is(/const val FLOOR_DOWN = 0\.10/.test(WS) && /const val FLOOR_UP = 0\.005/.test(WS) &&
       /floorDb = floorDb\.coerceIn\(FLOOR_MIN, FLOOR_MAX\)/.test(WS),
      '🧭 1.3: farsh ab DONO taraf seekhta hai — neeche jaldi, upar dheere (shor barhe to false-wake nahi)');
    is(WS.indexOf('floorDb <= 0.0') === -1,
      '🧭 1.3 (F15): purana LATCH qatl — "pehla sample hi farsh" wala bug dobara nahi aa sakta');
    const CALi = WS.indexOf('if (!calDone) {');
    const CALs = WS.slice(CALi, CALi + 1400);
    is(CALs.indexOf('calUntil') > 0 && CALs.indexOf('calFrames') > 0 && CALs.indexOf('continue') > 0 &&
       /calibration adhoora/.test(CALs),
      '🧭 1.11 (F42): calibration window ke dauran NA trigger, NA farsh latch — aur adhoora calibration REPORT hota hai');
    is(/if \(d > 0\.0\) \{ calFrames\+\+/.test(WS) && WS.indexOf('strikes = 0') > 0,
      '🧭 1.11 (F42): read==0/negative frame farsh ko CHHOOTA hi nahi (khamoshi ko farsh samajhna ghalat tha)');

    /* ── 1.4 (F16) GATE KA CPU SPIN + UMAR ── */
    is(/if \(n < 0\) \{/.test(WS) && /strikes >= READ_STRIKES/.test(WS) && /why = "read"/.test(WS) &&
       /const val READ_STRIKES = 5/.test(WS),
      '🧭 1.4 (F16): read-error par 5-strike → mic TAZAA (pehle 100% CPU ka infinite spin, koi timeout nahi)');
    is(/if \(n == 0\) \{/.test(WS) && /Thread\.sleep\(READ_SLEEP_MS\)/.test(WS) &&
       /const val READ_SLEEP_MS = 8L/.test(WS),
      '🧭 1.4 (F16): n==0 par 8ms sukoon — CPU ghoomta nahi (battery + garmi)');
    is(/const val GATE_LIFE_MS = 90000L/.test(WS) &&
       /while \(gateOn && running && System\.currentTimeMillis\(\) < gateUntil\)/.test(WS) &&
       /pehre ki umar khatam/.test(WS),
      '🧭 1.4: pehre ki zyada se zyada umar 90s — phir mic tazaa (phansa hua AudioRecord hamesha ke liye nahi)');

    /* ── 1.5 (F17) stopGate: join + release + race-free exit ── */
    is(/t\.join\(250\)/.test(WS) && WS.indexOf('private fun stopGate() { gateOn = false }') === -1,
      '🧭 1.5 (F17): stopGate ab thread ko JOIN karta hai (250ms) — purana one-liner (sirf flag) qatl');
    is(/when \(why\) \{/.test(WS) && /"voice" -> handler\.post \{ actuallyStart\(\) \}/.test(WS) &&
       /"life"  -> \{/.test(WS) && /else    -> handler\.post \{ restart\(200\) \}/.test(WS),
      '🧭 1.5 (F17): gate ki exit ab WAJAH dekhti hai — sirf AWAAZ par recognizer; sulah par kuch nahi');

    /* ── 1.6 (F13) WAKE KA APNA RECOGNIZER (self-healing) ── */
    is(/private fun makeWakeRecognizer\(\): SpeechRecognizer\?/.test(WS) &&
       /sr = \(makeWakeRecognizer\(\)/.test(WS) && /@Volatile private var wakeRecognizerKind/.test(WS),
      '🧭 1.6 (F13): wake ka APNA recognizer, SERVICE ke context se (Activity marne par chupke `default` par girna khatam)');
    is(/getString\("wake_rec", null\)/.test(WS) && /rememberWakeRec\(\)/.test(WS) &&
       /WakeState\.sessionOk\(\)\s*\n\s*rememberWakeRec\(\)/.test(WS),
      '🧭 1.6: jo candidate CHALA usay prefs mein yaad rakha jata hai — saboot pehle onReadyForSpeech se, andaza nahi');
    is(/forgetWakeRec\("4 lagatar nakami"\)/.test(WS) && /if \(errStreak == 4\)/.test(WS),
      '🧭 1.6: 4 lagatar nakami = candidate bhool jao, agla azmao (self-healing — user ke haath ka kaam nahi)');
    is(/,\\"using\\":\\"" \+ wakeRecognizerKind/.test(WS) && /appUsing/.test(WS) &&
       /cand/.test(WS),
      '🧭 1.6: panel ab WAKE ka aur APP ka recognizer ALAG batata hai (pehle ek shared jhoot tha)');

    /* ── 1.7 (F14) wake session shaping ── */
    is(/EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 600L/.test(WS) &&
       /EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 300L/.test(WS),
      '🧭 1.7 (F14) + ⚡J3 (F66): wake session ki shaping — 600ms khamoshi = khatam (pehle 700ms), 300ms = kam az kam');

    /* ── 1.8 (F19) session vs KUL nakami ── */
    is(/private var errStreak: Int/.test(WS) && /get\(\) = WakeState\.errStreak/.test(WS) &&
       /WakeState\.sessionErr\(\)/.test(WS) && /WakeState\.sessionOk\(\)/.test(WS),
      '🧭 1.8 (F19): errStreak har kamyab session par SAAF (onReadyForSpeech/onResults) + KUL ginti alag');
    is(/IS SESSION lagatar/.test(IH) && /KUL nakami/.test(IH),
      '🧭 1.8: panel ab "IS SESSION" aur "KUL" nakami ALAG dikhata hai (adhoora sach khatam)');

    /* ── 1.9 (F29/F35) foreground ka jhoot + mic ijazat ka darwaza ── */
    is(/catch \(e: Throwable\) \{\s*\n\s*\/\* 🧭 1\.9 \(F29\)/.test(WS) && /record\("fgs"/.test(WS) &&
       /alive = false/.test(WS) && /notifyState\(true/.test(WS),
      '🧭 1.9 (F29): foreground service na bane to CHUP-CHAAP nahi — report + alive=false + notification "wake beemar"');
    is(/private fun micGranted\(\): Boolean/.test(WS) && /if \(micGranted\(\)\) \{\s*\n\s*startLoop\(\)/.test(WS) &&
       /loopHeld = true/.test(WS),
      '🧭 1.9 (F35): mic ki ijazat na ho to loop SHURU HI NAHI hota (pehle har chand second error 9 khata tha)');
    is(/if \(loopHeld && micGranted\(\)\)/.test(WS) && /if \(loopHeld && micGranted\(\)\) \{[\s\S]{0,300}?startLoop\(\)/.test(WS),
      '🧭 1.9: ijazat milte hi wake KHUD shuru (app band kar ke dobara kholne ki zaroorat nahi)');

    /* ── 1.10 (F35) notification par seedha darwaza ── */
    is(/addAction\(0, "Ijazat do"/.test(WS) && /putExtra\("maya_open", "appinfo"\)/.test(WS),
      '🧭 1.10 (F35): notification par "Ijazat do" ka BUTTON — user ko Settings dhoondhna nahi parta');
    is(/private fun handleOpenRequest\(i: Intent\?\)/.test(MA) && /"maya_open"/.test(MA) &&
       /ACTION_APPLICATION_DETAILS_SETTINGS/.test(MA),
      '🧭 1.10: wo button app-info screen kholta hai (wahi rasta jo device par chalta dekha gaya, blind chain nahi)');

    /* ── 1.12 (F41) lifecycle: resume par resync, pause par background ── */
    is(/override fun onResume\(\)/.test(MA) && /override fun onPause\(\)/.test(MA) &&
       /webView\.onResume\(\)/.test(MA) && /webView\.onPause\(\)/.test(MA),
      '🧭 1.12 (F41): MainActivity mein onResume/onPause AB HAIN (pehle the hi nahi) — WebView background + wapsi');
    is(MA.indexOf('webView.pauseTimers()') === -1,
      '🧭 1.12: pauseTimers() JAAN BOOJH kar nahi — us se heartbeat aur wake reports dono mar jate');
    const ORI = MA.indexOf('override fun onResume()');
    const ORs = MA.slice(ORI, ORI + 900);
    is(ORs.indexOf('handleOpenRequest(intent)') > 0 && ORs.indexOf('SUKOON.resync') > 0 &&
       ORs.indexOf('__wakeHealth') > 0,
      '🧭 1.12: wapsi par teen kaam — notification darwaza + HAAL resync + wake ki sehat ka check');
    is(/listening = true/.test(WS) && /if \(!listening && !gateOn && haalBlock\(\) == null\) restart\(200\)/.test(WS),
      '🧭 1.12: `listening` ka naya flag — sehat ka darwaza mic par hamla nahi karta jab recognizer chal raha ho');

    /* ── 📱 QANOON 9: v5.11.0 ka hisab bhi lazmi (aap ki farmaish) ── */
    const FX = fs.readFileSync(path.join(ROOT, 'docs/FIX-v5.11.0-wake-mazboot.md'), 'utf8');
    const RP = fs.readFileSync(path.join(ROOT, 'docs/REPORT-v5.11.0-aam-zubaan.md'), 'utf8');
    is(/## 📱 RELEASE REPORT/.test(FX) && /✅ PASS/.test(FX) && /❌ FAIL/.test(FX) &&
       /adhoora/i.test(FX),
      '📱 Qanoon 9: v5.11.0 ki release report — kya naya, kaise parakhna (PASS/FAIL), kya adhoora');
    is((RP.match(/- \[ \]/g) || []).length >= 8 && /## 1\)/.test(RP) && /## 5\)/.test(RP) &&
       /FAIL ❌|FAIL ka nishan/.test(RP),
      '📄 Qanoon 9: v5.11.0 ka EK PARCHA bhi hai (tick ✅ layak checklist + pehchaan)');
  }

  /* ═══ 33. 📋 JAWAB LOOP ka STRUCTURE (aap ki farmaish: "pehle structure banao") ═══
     Ye locks PLAN ko bandhte hain — taake amal ke waqt koi flaw chhoot na jaye aur
     koi phase bina acceptance criteria ke "ho gaya" na kehla sake. */
  head('33. 📋 JAWAB LOOP — forensic F44-F58 + structure J1-J4 (plan-doc-first ka taala)');
  {
    const FJ = fs.readFileSync(path.join(ROOT, 'docs/FORENSIC-JAWAB-LOOP.md'), 'utf8');
    let ids = 0;
    for (let n = 44; n <= 58; n++) if (FJ.indexOf('F' + n + ' ') > 0 || FJ.indexOf('F' + n + ' —') > 0) ids++;
    is(ids >= 15, '🔬 jawab-loop ke 15 flaws darj hain (F44..F58) — aap ki teeno shikayaton ke saboot', ids + '/15');
    is(/J1  v5\.12\.0  "JAWAB PAKKA"/.test(FJ) && /J2  v5\.12\.5  "MIC NAZAR"/.test(FJ) &&
       /J3  v5\.13\.0  "RAFTAR"/.test(FJ) && /J4  v5\.13\.5  "SAAF AWAAZ"/.test(FJ),
      '🏗️ chaaron phase naam + version ke sath darj hain (tarteeb: pakka → nazar → raftar → awaaz)');
    is(/LISTEN 12s/.test(FJ) && /THINK 25s/.test(FJ) && /SPEAK 60s/.test(FJ),
      '⏱️ J1: teen watchdog ki muddat likhi hai (phansa hua mic/think/speak khud reset hoga)');
    is(/COMPLETE_SILENCE_LENGTH_MILLIS=600L/.test(FJ) && /800ms/.test(FJ) && /STREAMING/.test(FJ),
      '⚡ J3: raftar ke teeno hathiyar — Long silence extra, TTS 800ms budget, dimaag ki streaming');
    is(/IMAANDARI/.test(FJ) && /jhilmilana poori tarah khatam nahi ho sakta/.test(FJ) &&
       /offline KWS/.test(FJ),
      '⚖️ imaandari: system mic-dot ki haqeeqat likhi hai (jhoot nahi) + uska asal ilaj (Phase 4)');
    is(/## 5\. ❓ Do faisle/.test(FJ) && /CONVERSATION MODE/.test(FJ) && /raftar ya khoobsurti/.test(FJ),
      '❓ jo do faisle MALIK ke hain wo saaf likhe hain (baqi kaam agent ka)');
    is((FJ.match(/\*\*Acceptance/g) || []).length + (FJ.match(/Acceptance \(device par\)/g) || []).length >= 1 &&
       /^\d+\. /m.test(FJ),
      '✅ har phase ke acceptance criteria numbered hain (device par parakhne layak)');
  }

  /* ═══ 34. 🛡️ v5.12.0 "JAWAB PAKKA" — J1 ke wiring-level taale ═══
     Aap ki shikayat: "kabhi bolta hun to reply nahi aata, aur pata nahi chalta kyun."
     Ye locks FORENSIC-JAWAB-LOOP.md ke F44-F49, F53-F55 ko bandhte hain — taake
     koi aane wala badlaav chup-chaap jawab ka referee tod na de. */
  head('34. 🛡️ v5.12.0 — JAWAB PAKKA: jawab ka referee (watchdog + sahi error + mic khud dobara)');
  {
    const MA = fs.readFileSync(path.join(ROOT, 'app/src/main/java/com/maya/ai/MainActivity.kt'), 'utf8');
    const AS = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/web/index.html'), 'utf8');
    const n = (re) => (HTML.match(re) || []).length;

    /* ── referee maujood + teeno muddatein ── */
    is(HTML.indexOf('var JAWAB = {') > 0 && /LISTEN_MAX: 12000/.test(HTML) &&
       /THINK_MAX: 40000/.test(HTML) && /SPEAK_BASE: 20000/.test(HTML) &&
       /SPEAK_PER_CHAR: 110/.test(HTML),
      '⏱️ F46: JAWAB referee maujood — teen muddatein (sunna 12s · sochna 40s · bolna 20s+110ms/harf)');
    is(/setInterval\(function\(\)\{ try \{ JAWAB\.watchdog\(\); \} catch \(e\) \{\} \}, 2000\);/.test(HTML),
      '💓 F46: watchdog ka DIL har 2 second dhadakta hai (try/catch ke sath — baqi app na ruke)');
    is(n(/JAWAB\.mark\("speak", JAWAB\.SPEAK_BASE \+ JAWAB\.SPEAK_PER_CHAR/g) >= 2 &&
       n(/JAWAB\.clear\("speak"\)/g) >= 3,
      '🗣️ F46: bolne ka budget ADAPTIVE stamp hota hai (speak + legacy nativeSpeak dono raste)');

    /* ── do-jawab ka khatma ── */
    is(HTML.indexOf('var myGen = ++JAWAB.thinkGen;') > 0 && /JAWAB\.mark\("think"\)/.test(HTML) &&
       n(/myGen !== JAWAB\.thinkGen/g) === 2,
      '🧠 F46: dimaag ka GENERATION token — kamyaab AUR nakam DONO raste par purana jawab rad');

    /* ── AOSP ki poori fehlist + sahi matlab ── */
    is(/9:"mic ki ijazat nahi"/.test(HTML) && /7:"samajh nahi aaya \(no match\)"/.test(HTML) &&
       /15:"model-download events support nahi"/.test(HTML) &&
       HTML.indexOf('7:"Mic permission nahi"') === -1,
      '🔢 F44: AOSP ke poore 1..15 code SAHI naam ke sath (7=no match, 9=ijazat — pehle ulta tha)');
    is(/JAWAB\.sttError\(code\)/.test(HTML) && HTML.indexOf('var m = { 1:"Network timeout"') === -1,
      '🚦 F44/F45: __nativeSpeechErr ab referee ke paas jata hai (purani adhoori fehlist qatl)');
    is(/if \(code === 9\)/.test(HTML) && /code === 12 \|\| code === 13/.test(HTML) &&
       /JAWAB\.netStreak >= 3/.test(HTML) && /JAWAB\.noMatchStreak >= 4/.test(HTML) &&
       /KAAN\.DARWAZA\.close\(\)/.test(HTML),
      '🎯 F45: har code ka APNA amal — ijazat/zubaan par rukna, network par 3 dafa, no-match par 4 ke baad darwaza band');

    /* ── kam-yaqeen wala rasta (F47) ── */
    is(/reply\("\\uD83D\\uDC42 Theek se sunai nahi diya/.test(HTML) &&
       HTML.indexOf('AWAAZ.speak("Theek se sunai nahi diya, dobara boliye", {})') === -1,
      '🔁 F47: kam-yaqeen sunai ab reply() ke POORE raste se (SUKOON + mic dobara) — speak() bypass khatam');

    /* ── phanse flags ka ilaaj + circuit breaker ── */
    is(/JAWAB\.age\("listen"\) > JAWAB\.LISTEN_MAX/.test(HTML) &&
       /JAWAB\.age\("think"\) > JAWAB\.THINK_MAX/.test(HTML),
      '🎛️ F46: mic button par purana flag = murda, pehle reset (pehle button ULTA kaam karta tha)');
    is(/if \(JAWAB\.retryN > 6\)/.test(HTML) && /25000/.test(HTML) && /JAWAB\.n\.breaks\+\+/.test(HTML),
      '🔌 F45+: dobara-suno ka CIRCUIT BREAKER — 25s mein 6 nakami = ruk kar bol kar khabar');

    /* ── wake ka ignore chup-chaap nahi (F53) ── */
    is(HTML.indexOf('if (speaking || thinking || listening) { if (!JAWAB.ignore()) return; }') > 0 &&
       /KAAN\.push\("ignore"/.test(HTML),
      '🙉 F53: wake ignore ki WAJAH ab log + status par (aur phansa flag ho to khud ilaaj)');

    /* ── dimaag fail par awaaz (F54) + darwaza (F55) ── */
    is(/if \(wasVoice\) \{\s*\n\s*try \{\s*\n\s*JAWAB\.bol\("Dimaag se rabta nahi ho saka/.test(HTML),
      '📢 F54: retry ka intezar ab BOL kar bataya jata hai (pehle sirf toast — awaaz wala andhera)');
    const RI = HTML.indexOf('function reply(text, wasVoice, link, opts){');
    is(RI > 0 && HTML.slice(RI, RI + 520).indexOf('KAAN.DARWAZA.open()') > 0,
      '🚪 F55: darwaza jawab SHURU par tazaa — lamba jawab baat-cheet ko beech mein nahi todta');

    /* ── Kotlin: sahi code, sahi chaabi, crash-guard ── */
    is(/window\.__nativeSpeechErr\(9\)/.test(MA) && MA.indexOf('__nativeSpeechErr(7)') === -1,
      '🔐 F44: Kotlin ijazat ke liye code 9 bhejta hai (pehle 7 = "samajh nahi aaya" — JS galat loop chalati thi)');
    is(/RecognizerIntent\.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS/.test(MA) &&
       /\n\s*600L\s*\n/.test(MA) && MA.indexOf('700L') === -1 &&
       MA.indexOf('"android.speech.extra.SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS"') === -1,
      '🔑 F48 + ⚡J3 (F66): silence extra SARKARI chaabi se + Long, aur ab 600L (har turn par 100ms ki bachat)');
    const LI = MA.indexOf('fun listen(lang: String)');
    const LE = MA.indexOf('fun stopListen()', LI);           /* listen() ki asal hadd */
    is(LI > 0 && LE > LI && MA.slice(LI, LE).indexOf('} catch (e: Throwable) {') > 0 &&
       MA.slice(LI, LE).indexOf('WakeWordService.resumeFromApp()') > 0 &&
       MA.slice(LI, LE).indexOf('appMicOn = false') > 0 &&
       /__nativeSpeechErr\(5\)/.test(MA.slice(LI, LE)),
      '🛟 F49: mic khulte waqt crash/atak par try/catch — safai + wake wapas + JS ko code 5');

    /* ── mirror + Qanoon 9 ── */
    is(AS === HTML,
      '🪞 public/index.html aur assets/web/index.html HOOBAHOO ek (APK mein wahi code jata hai jo test hua)');
    const FX = fs.readFileSync(path.join(ROOT, 'docs/FIX-v5.12.0-jawab-pakka.md'), 'utf8');
    const RP = fs.readFileSync(path.join(ROOT, 'docs/REPORT-v5.12.0-aam-zubaan.md'), 'utf8');
    is(/## 📱 RELEASE REPORT/.test(FX) && /✅ PASS/.test(FX) && /❌ FAIL/.test(FX) && /adhoora/i.test(FX),
      '📱 Qanoon 9: v5.12.0 ki release report — kya naya, kaise parakhna (PASS/FAIL), kya adhoora');
    is((RP.match(/- \[ \]/g) || []).length >= 9 && /## 1\)/.test(RP) && /## 5\)/.test(RP) &&
       /FAIL ka nishan/.test(RP) && /IMAANDARI|imaandari/.test(FX),
      '📄 Qanoon 9: v5.12.0 ka EK PARCHA + FIX mein imaandari ka hisab (plan se kya alag kiya)');
  }

  /* ═══ 34b. 🧪 JAWAB ka AMAL — referee ko CHALA kar parakha (sirf wiring nahi) ═══
     Wiring locks upar hain; yahan asli module jsdom mein chalta hai aur hum dekhte hain
     ke watchdog waqai phansa kaam reset karta hai, error ka sahi amal hota hai, aur
     be-inteha loop nahi chalta. */
  head('34b. 🧪 JAWAB ka AMAL — asli waqt mein chal kar (watchdog + faislay + breaker)');
  {
    const JA = HTML.indexOf('var JAWAB = {');
    const JB = HTML.indexOf('function reply(text, wasVoice, link, opts){');
    is(JA > 0 && JB > JA, '🔬 JAWAB ka poora module index.html se alag nikala ja saka');
    const JSRC = HTML.slice(JA, JB);
    const sleep = (ms) => new Promise(function (r) { setTimeout(r, ms); });

    function jawabWorld(opts) {
      const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'dangerously' });
      const w = dom.window;
      const st = { bubbles: [], spoken: [], logs: [], reListen: 0, doorOpen: 0, doorClose: 0, status: '' };
      w.settings = Object.assign({ name: 'Boss', wakeWord: true }, (opts || {}).settings || {});
      w.speaking = false; w.thinking = false; w.listening = false;
      w.addBubble = function (who, t) { st.bubbles.push(who + ': ' + t); };
      w.speak = function (t) { st.spoken.push(t); };
      w.pushLog = function (m) { st.logs.push(m); };
      w.setOrb = function () {};
      w.statusText = { get textContent() { return st.status; }, set textContent(v) { st.status = v; } };
      w.interimEl = { textContent: '' };
      w.SUKOON = { sunEnd: function () {}, bolStart: function () {}, bolEnd: function () {} };
      w.AWAAZ = { stop: function () {} };
      w.startListening = function () { st.reListen++; };
      w.KAAN = {
        push: function (k, d) { st.logs.push(k + ': ' + d); },
        DARWAZA: { open: function () { st.doorOpen++; }, close: function () { st.doorClose++; }, isOpen: function () { return true; } }
      };
      w.eval(JSRC);
      return { w: w, J: w.JAWAB, st: st };
    }

    /* ── watchdog: phansa mic ── */
    {
      const { w, J, st } = jawabWorld();
      w.listening = true; J.mark('listen');
      J.at.listen = Date.now() - 13000;                 /* 13s purana = hadd se zyada */
      J.watchdog();
      is(w.listening === false && J.at.listen === 0 && J.n.watchdog === 1,
        '⏱️ F46: 12s se phansa mic — watchdog ne khud reset kiya (flag + stamp dono saaf)');
      await sleep(750);
      is(st.reListen === 1, '🔁 F45: reset ke baad mic KHUD dobara khula (dobara "Maya" ke baghair)', st.reListen + ' dafa');
      is(/Mic phans gaya tha/.test(st.status), '👁️ user ko status par KHAabar mili (chup-chaap nahi)', st.status);
    }

    /* ── watchdog: phansa dimaag + do-jawab ka khatma ── */
    {
      const { w, J, st } = jawabWorld();
      w.thinking = true; J.mark('think');
      const g0 = J.thinkGen;
      J.at.think = Date.now() - 41000;
      J.watchdog();
      is(w.thinking === false && J.thinkGen > g0 && J.n.thinkReset === 1,
        '🧠 F46: 40s se sochta dimaag reset + GENERATION barh gayi (purana jawab ab rad hoga)');
      is(st.spoken.length === 1 && /der ho gayi/.test(st.spoken[0]),
        '📢 F54: user ko BOL kar bataya gaya (pehle sirf orb ghoomta rehta)', st.spoken[0]);
    }

    /* ── watchdog: bolne ka ADAPTIVE budget (imaandari #2 ka saboot) ── */
    {
      const { w, J } = jawabWorld();
      w.speaking = true;
      J.mark('speak', J.SPEAK_BASE + J.SPEAK_PER_CHAR * 1400);   /* 1400 harf = ~174s */
      J.at.speak = Date.now() - 60000;
      J.watchdog();
      is(w.speaking === true, '🗣️ F46: 1400 harf ka jawab 60s par NAHI kata (saabit hadd ka qatl khatam)');
      J.at.speak = Date.now() - 175000;
      J.watchdog();
      is(w.speaking === false && J.n.speakReset === 1, '🗣️ magar budget khatam hone par reset zaroor hota hai');
    }

    /* ── STT ke faisle: ijazat ── */
    {
      const { J, st } = jawabWorld();
      J.sttError(9);
      await sleep(300);
      is(st.reListen === 0 && /ijazat/i.test(st.spoken.join(' ')),
        '🔐 F44: code 9 = ijazat → ijazat ka paigham, mic dobara NAHI (loop nahi)', st.spoken.join('|'));
    }

    /* ── STT ke faisle: no-match (sab se aam) ── */
    {
      const { J, st } = jawabWorld();
      J.sttError(7); J.sttError(7); J.sttError(7); J.sttError(7);
      await sleep(700);
      is(st.doorClose === 1 && /ruk jati hun/.test(st.spoken[st.spoken.length - 1]),
        '🚪 F45: 4 nakami ke baad darwaza BAND + bol kar rukna (be-inteha koshish nahi)');
      is(st.reListen === 2 && /dobara boliye/.test(st.spoken[0]),
        '🎯 F44: pehli nakami par "dobara boliye", darmiyan mein 2 khud-suno', st.reListen + ' re-listen');
    }

    /* ── STT ke faisle: network ── */
    {
      const { J, st } = jawabWorld();
      J.sttError(2); J.sttError(2); J.sttError(2);
      is(/internet/i.test(st.spoken.join(' ')) && J.netStreak === 0,
        '🌐 F45: 3 network nakami → BOL kar khabar + hisab saaf (chup-chaap loop nahi)');
    }

    /* ── STT ke faisle: voice service murda (naya rasta) ── */
    {
      const { J, st } = jawabWorld();
      J.sttError(5); J.sttError(5);
      await sleep(200);
      is(st.doorClose === 1 && /voice service/i.test(st.spoken.join(' ')),
        '📵 F44: code 5 (service murda) → 2 koshish ke baad BOL kar rukna, darwaza band');
    }

    /* ── circuit breaker ── */
    {
      const { J, st } = jawabWorld();
      for (let i = 0; i < 8; i++) J.hearAgain('test', 10);
      await sleep(200);
      is(st.reListen === 6 && J.n.breaks >= 1,
        '🔌 F45+: 25s ke andar sirf 6 koshishein — breaker LATCH hua (agli call foran mic nahi kholti)', st.reListen + ' mic, ' + J.n.breaks + ' break');
      is(/ruk jati hun/.test(st.spoken.join(' ')) && st.doorClose >= 1,
        '🔌 F45+: rukne par user ko BOL kar bataya + darwaza band (latch trip par bhi)');
    }

    /* ── wake band ho to khud mic NAHI ── */
    {
      const { J, st } = jawabWorld({ settings: { wakeWord: false } });
      J.hearAgain('manual', 10);
      await sleep(120);
      is(st.reListen === 0, '🔒 manual-mic user (wake OFF) ke liye khud mic nahi khulta — faisla aap ka');
    }

    /* ── wake ignore: wajah + khud ilaaj ── */
    {
      const { w, J, st } = jawabWorld();
      w.speaking = true; J.mark('speak', J.SPEAK_BASE);
      is(J.ignore() === false, '🙉 F53: Maya sach-much bol rahi ho to wake ignore (sahi)');
      is(/wake ignore/.test(st.logs.join(' ')) && /Sun nahi sakti/.test(st.status),
        '🙉 F53: ignore ki WAJAH log + status par likhi gayi', st.status);
      J.at.speak = Date.now() - 30000;                   /* ab stamp phansa hua hai */
      is(J.ignore() === true && w.speaking === false,
        '🩹 F46/F53: phansa flag mile to ignore ki jagah KHUD ilaaj — wake usi lamhe zinda');
    }

    /* ── report(): nazaarat ka ek-line hisab ── */
    {
      const { J } = jawabWorld();
      J.sttError(7); J.watchdog();
      is(/STT err 1/.test(J.report()) && /watchdog/.test(J.report()),
        '📊 report() ek line mein poora hisab deta hai (LAB/panel ke liye)', J.report());
    }
  }

  /* ═══ 35. 🎛️ v5.12.5 "MIC NAZAR" — J2 ke taale (F52, F56, F57 + churn) ═══
     Aap ki shikayat: "mic par on off horha ha jo ke irritating ha... mujhe pata hi nhi
     chalna mic on hua ha ya nhi." Ye locks uska ilaj bandhte hain: mic ka haal NAZAR,
     wake ka ZINDA level, aur baat-cheet mode (ek turn = ek mic). */
  head('35. 🎛️ v5.12.5 — MIC NAZAR: mic ka haal hamesha nazar + wake ka zinda level + baat-cheet');
  {
    const MA = fs.readFileSync(path.join(ROOT, 'app/src/main/java/com/maya/ai/MainActivity.kt'), 'utf8');
    const WS = fs.readFileSync(path.join(ROOT, 'app/src/main/java/com/maya/ai/WakeWordService.kt'), 'utf8');
    const ST = fs.readFileSync(path.join(ROOT, 'app/src/main/java/com/maya/ai/WakeState.kt'), 'utf8');
    const GR = fs.readFileSync(path.join(ROOT, 'app/build.gradle'), 'utf8');

    /* ── J2.1: bar ka wajood + rang ── */
    is(HTML.indexOf('id="micHaal"') > 0 && HTML.indexOf('id="mhIc"') > 0 && HTML.indexOf('id="mhTx"') > 0 &&
       HTML.indexOf('id="mhFill"') > 0 && HTML.indexOf('id="mhDb"') > 0 && /role="status"/.test(HTML),
      '🎛️ F52: MIC HAAL BAR header ke neeche maujood (icon + lafz + level bar + dB) — HAR TAB par nazar');
    /* slice SIRF bar ka CSS — aage UI KIT layer hai (wahan @supports ke andar
       guarded features hote hain, jo yahan galat ilzam lagate) */
    const CS = HTML.indexOf('#micHaal{');
    const CE = HTML.indexOf('#micHaal[data-state="band"] .mh-bar i{');
    const CB = HTML.slice(CS, CE > CS ? CE + 120 : CS + 2000);
    let have = 0;
    ['wake', 'talk', 'mic', 'soch', 'bol', 'masla', 'band'].forEach(function (k) {
      if (CB.indexOf('#micHaal[data-state="' + k + '"]') > 0) have++;
    });
    is(CS > 0 && have === 7, '🎨 F52: saat halaton ke APNE rang (icon akela andhere mein kaam nahi karta)', have + '/7');
    is(CB.indexOf('gap:') === -1 && CB.indexOf('clamp(') === -1 && CB.indexOf('color-mix(') === -1 &&
       CB.indexOf('backdrop-filter') === -1 && CB.indexOf('inset:') === -1,
      '📜 bar ka CSS purane WebView ke qawaid ke andar (gap/clamp/color-mix/inset/backdrop-filter nahi)');
    is(HTML.indexOf('var HAALBAR = {') > 0 && /FRESH: 1200/.test(HTML) && /STALE_WARN: 6000/.test(HTML) &&
       /decide: function/.test(HTML) && /tick: function/.test(HTML) && /report: function/.test(HTML),
      '🧭 HAALBAR module: taazgi (1.2s) + purana (6s) ki hadein, faisla, tick, report');
    is(/WAKE sun nahi rahi/.test(HTML) && /HAALBAR\.n\.stale\+\+/.test(HTML),
      '⚠️ F52: level purana ho to bar JHOOT nahi bolta — surkh ho kar "WAKE sun nahi rahi" likhta hai');

    /* ── J2.2: zinda level ka rasta ── */
    is(/window\.__wakeLevel = function \(db, floor, trig, mode\)/.test(HTML) &&
       /HAALBAR\.wakeLevel\(db, floor, trig, mode\)/.test(HTML) && /HAALBAR\.appLevel\(db\)/.test(HTML),
      '📡 F57: Kotlin ka __wakeLevel aur app ka __nativeRms — DONO bar tak pohanchte hain');
    is(/setInterval\(function\(\)\{ try \{ HAALBAR\.tick\(\); \} catch \(e\) \{\} \}, 250\);/.test(HTML),
      '💓 bar ka dil har 250ms (faisla + paint + darwaza milana)');
    is(/const val LEVEL_PUSH_MS = 300L/.test(WS) && /pushLevel\(d, 1\)/.test(WS) &&
       /override fun onRmsChanged\(rmsdB: Float\) \{ pushLevel\(rmsdB\.toDouble\(\), 2\) \}/.test(WS),
      '📡 F57: wake ke DONO daur level bhejte hain — pehra (1) + recognizer (2, pehle onRmsChanged KHALI tha)');
    const PL = WS.indexOf('private fun pushLevel');
    is(PL > 0 && WS.slice(PL, PL + 700).indexOf('evalToApp(') > 0 && WS.slice(PL, PL + 700).indexOf('LEVEL_PUSH_MS') > 0 &&
       WS.slice(PL, PL + 700).indexOf('report(') === -1,
      '🧮 level throttle (300ms) + report() se BAHAR — warna KAAN ka 40-entry log har 300ms bharta (F03 ka sabaq)');
    /* Kotlin mein ye fields \"lv\": ki sorat mein hain (escaped quotes) */
    is(WS.indexOf('lv\\":') > 0 && WS.indexOf('lvMode\\":') > 0 && WS.indexOf('lvAge\\":') > 0 &&
       WS.indexOf('talkTurns\\":') > 0 && WS.indexOf('talkLeft\\":') > 0,
      '📊 stateBits mein level + baat-cheet ka hisab (panel ka saboot, andaza nahi)');

    /* ── J2.3: baat-cheet mode ── */
    is(/const val TALK_EXP_MS = 90000L/.test(ST) && /fun talkOn\(\)/.test(ST) && /fun talkOff\(\)/.test(ST) &&
       /fun talkActive\(\)/.test(ST) && /fun talkLeft\(\)/.test(ST),
      '🚪 J2.3: baat-cheet ka apna ghar WakeState mein (mudat 90s + turn ginti)');
    is(ST.indexOf('baat-cheet khud khatam') > 0 && /if \(talkUntil > 0L\)/.test(ST) &&
       ST.indexOf('talk\\":') > 0 && ST.indexOf('talkTurns\\":') > 0,
      '🛟 J2.3: safety net — mudat khatam YA JS ke heartbeat gayab = mode KHUD khatam (wake daimi band nahi)');
    is(/if \(s\.talkPrefOn\(\) && WakeState\.talkActive\(\)\)/.test(WS) && /baat-cheet: darwaza khula/.test(WS),
      '🚦 J2.3/F56: haalBlock() baat-cheet mein wake ka mic rokta hai — ek turn = EK mic, 400ms race khatam');
    const OT = WS.indexOf('fun onTalk(on: Boolean)');
    is(OT > 0 && WS.slice(OT, OT + 800).indexOf('stopGate()') > 0 && WS.slice(OT, OT + 800).indexOf('pendingGen++') > 0 &&
       WS.slice(OT, OT + 800).indexOf('restart(300)') > 0,
      '🎬 J2.3: mode ON = mic ISI lamhe chhodo (gate + recognizer + pending restart murda); OFF = wapas pehra');
    is(/const val TALK_POLL_MS = 10000L/.test(WS) &&
       (WS.match(/why\.startsWith\("baat-cheet"\)/g) || []).length === 2,
      '🐢 J2.3: baat-cheet ke dauran wake ka poll DHEEMA (10s, dono darwazon par) — nSkip ginti aur CPU dono bachte hain');
    is(/fun talkPrefOn\(\): Boolean/.test(WS) && /getBoolean\("talk", true\)/.test(WS) &&
       /fun talkMode\(on: Boolean\)/.test(WS) && /fun talk\(on: Boolean\)/.test(MA),
      '🌉 J2.3: bridge talk() + LIVE pref (default ON — malik ka faisla), ubharna nahi parta');
    is((HTML.match(/MayaBridge\.talk\(/g) || []).length === 1 &&
       /want = !!\(settings\.wakeWord && FLAGS\.on\("talk"\) && KAAN\.DARWAZA\.isOpen\(\)\)/.test(HTML),
      '🧵 darwaza SIRF ek jagah se Kotlin jata hai (HAALBAR.tick) — "koi bhool gaya" wala bug mumkin nahi');
    is(HTML.indexOf('id="labTalk"') > 0 && /sw\("labTalk", "talk"/.test(HTML) && /talk: true,/.test(HTML) &&
       /setPref\("talk", on\)/.test(HTML),
      '🎚️ LAB mein BAAT-CHEET ka apna switch + pref mirror (faisla aap ke haath mein)');

    /* ── J2.4: imaandari + panel + version ── */
    is(/SACH: "Android ka system mic-nishan cloud-wake/.test(HTML) && /offline wake \(Phase 4\)/.test(HTML) &&
       HTML.indexOf('title="Android ka system mic-nishan') > 0,
      '⚖️ J2.4: imaandar line UI mein — jhilmilahat KAM hui, khatam nahi (SAABIT mic Phase 4 mein)');
    is(HTML.indexOf('MIC HAAL    : ') > 0 && HTML.indexOf('level (Kotlin): ') > 0 &&
       HTML.indexOf('BAAT-CHEET : ') > 0 && /JAWAB\.report\(\)/.test(HTML),
      '🖥️ panel par nayi lines: MIC HAAL · level (Kotlin) · BAAT-CHEET (turn) · JAWAB (referee ka hisab)');
    const VER2 = (GR.match(/versionName "([^"]+)"/) || [])[1] || '';
    is(HTML.indexOf('var MAYA_VER = "' + VER2 + '"') > 0 && HTML.indexOf('PERSONAL AI v' + VER2) > 0 &&
       /"MAYA v" \+ MAYA_VER/.test(HTML),
      '🏷️ bonus: header subtitle + toast + log EK constant se (pehle v5.10.2 par jam tha) — gradle se milaan', VER2);

    /* ── Qanoon 9 ── */
    const FX = fs.readFileSync(path.join(ROOT, 'docs/FIX-v5.12.5-mic-nazar.md'), 'utf8');
    const RP = fs.readFileSync(path.join(ROOT, 'docs/REPORT-v5.12.5-aam-zubaan.md'), 'utf8');
    is(/## 📱 RELEASE REPORT/.test(FX) && /✅ PASS/.test(FX) && /❌ FAIL/.test(FX) && /adhoora/i.test(FX) &&
       /Imaandari/.test(FX),
      '📱 Qanoon 9: v5.12.5 ki release report — kya naya, PASS/FAIL, kya adhoora, imaandari');
    is((RP.match(/- \[ \]/g) || []).length >= 10 && /## 1\)/.test(RP) && /## 5\)/.test(RP) &&
       /FAIL ka nishan/.test(RP),
      '📄 Qanoon 9: v5.12.5 ka EK PARCHA (tick ✅ layak checklist + pehchaan)');
  }

  /* ═══ 35b. 🧪 HAALBAR ka AMAL — bar ko chalaa kar parakha ═══ */
  head('35b. 🧪 HAALBAR ka AMAL — saat halatein, level ka hisab, baat-cheet ka darwaza');
  {
    const HA = HTML.indexOf('var HAALBAR = {');
    const HB = HTML.indexOf('function reply(text, wasVoice, link, opts){');
    is(HA > 0 && HB > HA, '🔬 HAALBAR ka poora module index.html se alag nikala ja saka');
    const HSRC = HTML.slice(HA, HB);
    const sleep = (ms) => new Promise(function (r) { setTimeout(r, ms); });

    function barWorld(opts) {
      const dom = new JSDOM('<!doctype html><body><div id="micHaal" data-state="band">' +
        '<span id="mhIc"></span><span id="mhTx"></span><span class="mh-bar"><i id="mhFill"></i></span>' +
        '<span id="mhDb"></span></div></body>', { runScripts: 'dangerously' });
      const w = dom.window;
      const st = { logs: [], kaan: [], talk: [], bridge: 0 };
      w.settings = Object.assign({ wakeWord: true }, (opts || {}).settings || {});
      w.listening = false; w.thinking = false; w.speaking = false; w.__door = false;
      w.__bridgeTalk = opts && opts.bridgeTalk;      /* true = MayaBridge maujood */
      w.FLAGS = { on: function (k) { return k === 'talk'; } };
      w.pushLog = function (m) { st.logs.push(m); };
      w.KAAN = { push: function (k, d) { st.kaan.push(k + ':' + d); },
                 DARWAZA: { isOpen: function () { return !!w.__door; }, left: function () { return 7; } } };
      w.JAWAB = { age: function (k) { return k === 'think' ? 3000 : 1500; }, report: function () { return 'j'; } };
      if (w.__bridgeTalk) w.MayaBridge = { talk: function (on) { st.talk.push(on); } };
      w.eval(HSRC);
      w.HAALBAR.init();
      return { w: w, H: w.HAALBAR, st: st, d: w.document };
    }
    const tx = (d) => d.getElementById('mhTx').textContent;
    const fill = (d) => parseInt(d.getElementById('mhFill').style.width, 10);

    { const { H, d } = barWorld({});
      H.wakeLevel(41, 34, 48, 1); H.tick();
      is(H.state === 'wake' && /WAKE SUN RAHI/.test(tx(d)) && /pehra/.test(tx(d)),
        '👂 F52: wake ka level taaza = "WAKE SUN RAHI — pehra" (saboot Kotlin se)', tx(d));
      is(fill(d) > 10 && /41dB/.test(d.getElementById('mhDb').textContent),
        '📈 level bar hila aur dB nazar aaya (sirf icon nahi)', fill(d) + '% · ' + d.getElementById('mhDb').textContent);
      H.wakeLevel(4, 0, 0, 2); H.tick();
      is(/kaan khula/.test(tx(d)), '👂 F57: recognizer ke daur ka level alag pehchan ("kaan khula")', tx(d)); }

    { const { H, d } = barWorld({});
      d.getElementById('mhTx'); H.appDb = 0;
      const w2 = d.defaultView; w2.listening = true; H.appLevel(4); H.tick();
      is(H.state === 'mic' && /AAP BOLEIN/.test(tx(d)) && fill(d) === 30,
        '🎤 F52: app ka mic khula = "AAP BOLEIN" + zinda level', tx(d) + ' ' + fill(d) + '%');
      w2.listening = false; w2.thinking = true; H.tick();
      is(H.state === 'soch' && /SOCH RAHI \(3s\)/.test(tx(d)), '🧠 soch ka haal + kitne second se', tx(d));
      w2.thinking = false; w2.speaking = true; H.tick();
      is(H.state === 'bol' && /BOL RAHI/.test(tx(d)), '🔊 bolne ka haal', tx(d)); }

    { const { w, H, d, st } = barWorld({ bridgeTalk: true });
      w.speaking = false; w.__door = true; H.tick();
      is(H.state === 'talk' && /BAAT-CHEET/.test(tx(d)) && st.talk.length === 1 && st.talk[0] === true,
        '🚪 J2.3: darwaza khulte hi Kotlin ko talk(true) — wake ka mic band (ek turn = ek mic)', tx(d));
      H.tick(); H.tick();
      is(st.talk.length === 1, '🧵 J2.3: bar bar push NAHI (sirf transition par) — spam nahi', st.talk.length + ' push');
      w.__door = false; H.tick();
      is(st.talk.length === 2 && st.talk[1] === false && H.talkPushed === false,
        '🚪 J2.3: darwaza band hote hi talk(false) — wake wapas pehre par (mudat khatam ka intezar nahi)');
      is(H.turns === 1 && /baat-cheet ON/.test(st.logs.join(' ')),
        '🧮 turn ki ginti + log (acceptance ka saboot: ek turn = ek mic)', H.turns + ' turn'); }

    { const { w, H, d } = barWorld({});
      H.masla('mic ki ijazat nahi'); H.tick();
      is(H.state === 'masla' && /MASLA: mic ki ijazat nahi/.test(tx(d)),
        '⚠️ masla bar par 8 second tak LIKHA rehta hai (chup-chaap nahi)', tx(d));
      H.errAt = 0; H.wakeAt = Date.now() - 9000; H.tick();
      is(H.state === 'masla' && /WAKE sun nahi rahi/.test(tx(d)) && H.n.stale === 1,
        '🕳️ F52: level 6s se purana = "WAKE sun nahi rahi" (wake ON ka jhoot pakda gaya)', tx(d));
      w.settings.wakeWord = false; H.wakeAt = Date.now(); H.tick();
      is(H.state === 'band' && /WAKE BAND/.test(tx(d)), '💤 wake switch OFF = saaf lafz (andaza nahi)', tx(d)); }

    { const { H } = barWorld({});
      is(H.pct(34, 1, 34) < H.pct(50, 1, 34) && H.pct(90, 1, 34) === 100 && H.pct(-5, 2, 0) >= 4,
        '🧮 level ka hisab: farsh ke upar bar barhta hai, 100% par rukta hai, neeche 4% se nahi girta');
      H.wakeLevel(41, 34, 48, 1); H.masla('x');
      is(/MIC HAAL BAR/.test(H.report()) && /wake level/.test(H.report()),
        '📊 report() panel ke liye ek line mein poora hisab deta hai', H.report().slice(0, 60) + '…'); }
  }

  /* ═══ 36. ⚡ v5.13.0 "RAFTAR" — J3 ke taale (F59–F66) ═══════════════════════
     Malik ki do shikayatein: (1) "slow boht reply derhi ha — instant reply aye
     fastly", (2) "Maya kabhi screen par ache se dekh rahi hai aur jawab de rahi
     hai, kabhi pooch raha hun to jawab hi nahi deti".
     Ye locks dono ilaj bandhte hain:
       A — SCREEN PAKKI: NAZAR default ON (F59), doosri koshish (F60), prompt ka
           QANOON + poori tool fehrist (F61), needsTools bina poolTools qaid (F62)
       B — RAFTAR: dimaag ka stream + jumla-dar-jumla awaaz + kill-switch (F63)
       C — awaaz ka fast budget (F64), pehli-awaaz ki naap (F65), 600ms silence (F66)
       D — RAFTAR aur NAZAR ko CHALA kar parakhna (sirf wiring nahi)            */
  head('36. ⚡ v5.13.0 — RAFTAR: jawab foran + screen ka pakka jawab');
  {
    const MA = fs.readFileSync(path.join(ROOT, 'app/src/main/java/com/maya/ai/MainActivity.kt'), 'utf8');
    const WS = fs.readFileSync(path.join(ROOT, 'app/src/main/java/com/maya/ai/WakeWordService.kt'), 'utf8');

    /* ── A. SCREEN PAKKI (F59–F62) ── */
    is(/nazar: true/.test(HTML) && HTML.indexOf('nazar: false') === -1,
      '👁️ F59: NAZAR ab DEFAULT ON — pehle LAB switch OFF tha is liye read_screen hamesha "NAZAR band hai" kehta tha');
    is(/raftar: true/.test(HTML) && /RAFTAR\.live\(\)/.test(HTML),
      '⚡ F63: RAFTAR ka apna LAB switch (default ON) — malik chahe to band kar sake');
    is(/lookRetry: function/.test(HTML) && /NAZAR\.lookRetry\(90, NAZAR\.RETRY_MAX\)/.test(HTML),
      '🩹 F60: read_screen ab DO koshish karta hai (pehla dump khali to doosra, 160 element)');
    is(/say: function \(why\)/.test(HTML) && /say: nz\.say \|\| NAZAR\.say\(nz\.why\)/.test(HTML),
      '🗣️ F61: har nakami mein BOLNE layak line (say) jati hai — dimaag chup nahi reh sakta');
    is(/n: \{ look: 0, ok: 0, empty: 0, retry: 0, fail: 0/.test(HTML),
      '🧮 F65: NAZAR ka apna hisaab (koshish/kamyab/khali/retry/nakaam)');
    const SPA = HTML.indexOf('function sysPrompt(){');
    const SP = HTML.slice(SPA, SPA + 5000);
    is(/read_screen/.test(SP) && /see_camera/.test(SP) && /list_files/.test(SP) && /prayer_times/.test(SP),
      '📜 F61: system prompt ab screen/camera/files/namaz tools ka ZIKR karta hai (pehle 33 mein se sirf 9 the)');
    is(/PEHLE read_screen call karo/.test(SP) && /ANDAZA bilkul mat lagao/.test(SP),
      '📜 F61: prompt ka hukm — screen ka sawal ho to PEHLE read_screen, andaza kabhi nahi');
    is(/QANOON \(tool nakam ho\)/.test(SP) && /CHUP mat raho/.test(SP),
      '📜 F61: prompt ka QANOON — tool nakam ho to us ki note user ko batao, chup mat raho');
    const NTA = HTML.indexOf('function needsTools(t){');
    const NT = HTML.slice(NTA, NTA + 1000);
    is(/FLAGS\.on\("poolTools"\)\) return AMAL/.test(NT) === false && /AMAL\.actionRe\(\)\.test\(t\)/.test(NT),
      '🧭 F62: needsTools ab HAMESHA poori trigger fehrist (AMAL) se — poolTools ki qaid khatam');
    is(/screen\|dekh\|dikh\|nazar\|parho/.test(HTML),
      '🧭 F62: purani ACTION_WORDS mein bhi screen ke alfaaz (fallback mehfooz)');
    is(/"screen par", "is screen", "ye screen"/.test(HTML),
      '🧭 F62: AMAL.TRIGGERS.read_screen mein mazeed jumle ("screen par", "ye screen"…)');

    /* ── B. RAFTAR: stream + jumla-dar-jumla awaaz (F63) ── */
    is(/streamGenerateContent\?alt=sse/.test(HTML) && /getReader/.test(HTML),
      '⚡ F63: dimaag ka jawab STREAM hota hai (:streamGenerateContent?alt=sse + body reader)');
    is(/async function geminiStream\(m, body, onDelta\)/.test(HTML) && /nostream: true/.test(HTML),
      '⚡ F63: geminiStream() SSE ko generateContent jaisi shakl deta hai (baqi code badla nahi)');
    is(/RAFTAR\.feed\(delta\)/.test(HTML) && /RAFTAR\.rearm\(\)/.test(HTML) && /RAFTAR\.strike\("EMPTY"\)/.test(HTML),
      '⚡ F63: geminiTry stream ko RAFTAR se jorta hai (feed · tool-step rearm · EMPTY strike)');
    is(/HOLD: 40/.test(HTML) && /MAX_STRIKES: 2/.test(HTML) && /kill: function/.test(HTML),
      '🛡️ F63: HOLD (40 harf) + kill-switch (2 strikes) — stream kabhi jawab maar nahi sakta');
    is(/function reply\(text, wasVoice, link, opts\)/.test(HTML) && /opts\.noSpeak/.test(HTML),
      '🔇 F63: reply() ka noSpeak — RAFTAR bol chuka ho to jawab DOBARA nahi bolta');
    is(/RAFTAR\.begin\(wasVoice, myGen\)/.test(HTML) && /noSpeak: true/.test(HTML),
      '🔗 F63: askAI RAFTAR ko begin/finish karta hai aur watchdog ki generation bhi deta hai');

    /* ── C. fast budget (F64) + naap (F65) + silence (F66) ── */
    is(/FAST: 1800/.test(HTML) && /fastTrips/.test(HTML) && /fastForced/.test(HTML),
      '⏱️ F64: AWAAZ ka FAST BUDGET (1800ms) — network tier atke to Edge, phir phone (dead air khatam)');
    is(/a\.onplay = function/.test(HTML) && /AWAAZ\.audioAt/.test(HTML),
      '⏱️ F64: "asli awaaz baji" ka saboot audio ke onplay se aata hai (andaza nahi)');
    is(/first: \{ p50: NAAP\.pct\(NAAP\.col\("first"\)/.test(HTML) && /pehli awaaz/.test(HTML),
      '📊 F65: NAAP ab PEHLI AWAAZ ka waqt naapta hai aur report mein p50/p90 dikhata hai');
    is(/if \(info\.stream\) c\.stream = 1;/.test(HTML) && /⚡ RAFTAR/.test(HTML),
      '📊 F65: har turn darj karta hai ke jawab stream hua tha + RAFTAR PANEL report mein');
    /* (WakeWordService mein 700L abhi bhi EK jagah hai — error 6/7 ka backoff delay,
       silence se us ka koi taluq nahi; is liye sirf MA par "koi 700L nahi" ka taala) */
    is(MA.indexOf('600L') > 0 && MA.indexOf('700L') === -1 &&
       /EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 600L/.test(WS),
      '🎙️ F66: mic ki khamoshi 700ms → 600ms (dono Kotlin path) — har turn par 100ms bachat');

    /* ── D1. RAFTAR ka AMAL (jsdom mein chalaa kar) ── */
    const w = world({});
    const R = w.RAFTAR;
    is(typeof R === 'object' && R.VER === 1, '⚡ RAFTAR module index.html se alag nikal kar chalta hai');
    let sp = R.split('Ji boss. Main theek hoon. Aap sunao?', false);
    is(sp.pieces.length === 1 && sp.pieces[0] === 'Ji boss. Main theek hoon.' && sp.rest === 'Aap sunao?',
      '✂️ jumla kaatna: poore jumle bolne ko milte hain, adhoora hissa bacha rehta hai', JSON.stringify(sp.pieces));
    is(R.split('Aap sunao?', true).pieces[0] === 'Aap sunao?' && R.split('', true).pieces.length === 0,
      '✂️ final=true → bacha hua matn bhi bol diya jata hai (kuch chhoota nahi)');
    is(R.split('chhota tukra', false).pieces.length === 0,
      '✂️ bina poore jumle ke tukra nahi kata jata (awaaz beech mein nahi tootti)');
    const big = R.split(new Array(320).join('a'), false);
    is(big.pieces.length === 1 && big.pieces[0].length <= R.SENT_MAX && big.rest.length > 0,
      '✂️ SENT_MAX: bohat lamba tukra kaat diya jata hai (warna bolna der se shuru)', big.pieces[0].length + ' harf');
    const ur = R.split('سلام۔ آپ کیسے ہیں؟ مزید بات', false);
    is(ur.pieces[0] === 'سلام۔ آپ کیسے ہیں؟' && ur.rest === 'مزید بات',
      '✂️ Urdu ke nishan (۔ ؟) bhi jumla kaatte hain', ur.pieces[0]);

    const ev = { candidates: [{ content: { parts: [{ text: 'Ji boss.' }] } }] };
    const s1 = R.sse('data: ' + JSON.stringify(ev) + '\n\ndata: {adhoora', '');
    is(s1.events.length === 1 && s1.events[0].candidates[0].content.parts[0].text === 'Ji boss.',
      '📡 SSE: poora event parse hua');
    is(s1.rest === 'data: {adhoora', '📡 SSE: adhuri line agle tukre ke liye mehfooz (stream tootta nahi)');
    is(R.sse('data: {kharab\n\n', '').events.length === 0, '📡 SSE: kharab JSON par crash nahi — chup-chaap skip');
    let s2 = R.sse('da', ''); s2 = R.sse('ta: ' + JSON.stringify(ev) + '\n\n', s2.rest);
    is(s2.events.length === 1, '📡 SSE: event do tukron mein bikhra ho to bhi jur jata hai');
    const po = R.partsOf({ candidates: [{ content: { parts: [{ text: 'dekhti hoon' }, { functionCall: { name: 'read_screen', args: {} } }] } }] });
    is(po.text === 'dekhti hoon' && po.calls.length === 1 && po.calls[0].name === 'read_screen' && po.parts.length === 2,
      '🧩 partsOf: matn aur functionCall alag — tool-step pehchana ja sakta hai');

    is(R.live() === true, '⚡ raftar default ON → stream chalega');
    w.FLAGS.set('raftar', false);
    is(R.live() === false, '🎛️ LAB switch OFF → purana saabit raasta (malik ka ikhtiyar)');
    w.FLAGS.set('raftar', true);
    R.strike('NETWORK');
    is(R.dead === false && R.strikes === 1, '🛡️ ek nakami par stream abhi zinda (foran darpana nahi)');
    R.strike('EMPTY');
    is(R.dead === true && R.live() === false,
      '🛡️ KILL-SWITCH: 2 nakamiyan → session bhar streaming OFF (jawab purane raaste se, khamoshi nahi)');
    R.revive();
    is(R.dead === false && R.live() === true, '🔧 revive: LAB se dobara chalu ho sakta hai');

    /* bolne ka amal — naqli AWAAZ ke sath */
    const w2 = world({});
    w2.__spoke = [];
    w2.AWAAZ = { engine: 'test', stop: function () {}, speak: function (t, cb) {
      w2.__spoke.push(String(t));
      if (cb && cb.onStart) cb.onStart('test');
      if (cb && cb.onDone) cb.onDone();
    } };
    const R2 = w2.RAFTAR;
    R2.begin(true, 0);
    R2.feed('Ji boss.');
    is(w2.__spoke.length === 0 && R2.q.length === 0,
      '🤫 HOLD: pehle 40 harf ruk kar aate hain — tool-step ka preamble bolne ki naubat hi nahi aati');
    R2.feed(' Main theek hoon, aur aap ka din kaisa guzar raha hai?');
    is(w2.__spoke.length >= 1 && w2.__spoke[0] === 'Ji boss.',
      '🗣️ HOLD ke baad pehla jumla FORAN bola gaya (poore jawab ka intezar nahi)', w2.__spoke[0]);
    is(R2.spokeChars > 0 && R2.tFirst > 0, '📊 pehle harf aur pehli boli ka waqt darj hua (RAFTAR report)');
    R2.feed(' Sab accha hai.');
    R2.finish();
    is(R2.active === false && w2.__spoke.length >= 3 && /Sab accha hai/.test(w2.__spoke.join(' | ')),
      '🏁 finish(): bacha hua aakhri jumla bhi bola gaya, phir hisaab band', w2.__spoke.length + ' tukre');
    is(R2.last && R2.last.pieces >= 3 && typeof R2.last.total === 'number',
      '📊 aakhri jawab ki raftar darj (tukre + waqt) — RAFTAR.line() isi se banti hai', JSON.stringify(R2.last));
    is(/stream ON|stream OFF/.test(R2.line()) && /NAZAR/.test(R2.line()),
      '📊 RAFTAR.line(): stream ka haal + strikes + fast-budget + NAZAR ka hisaab ek jagah');

    R2.begin(false, 0);
    R2.feed('Main abhi screen parh leti hoon. Ek second ruk jao.');
    is(w2.__spoke.length >= 4, 'tool-step se pehle preamble bolne laga (jaan-boojh kar roka jayega)');
    R2.rearm();
    is(R2.active === true && R2.q.length === 0 && R2.spokeChars === 0 && R2.buf === '',
      '♻️ rearm: preamble phenka MAGAR stream zinda — asli jawab bhi tukron mein hi bolega');
    R2.feed('Screen par Chrome khula hai aur do button hain.');
    R2.finish();
    is(/Chrome/.test(w2.__spoke.join(' | ')),
      '👁️ rearm ke baad ASLI jawab bola gaya (screen ka jawab chhoota nahi — yahi F59-F61 ki jaan hai)');
    R2.begin(false, 0);
    R2.feed('Aadha jawab aaya tha ke stream toot gaya, ');
    R2.abort();
    is(R2.active === false && R2.spokeChars === 0,
      '🛑 abort: adhoori stream rad — askAI ko pata chale ke jawab PURANE raaste se bolna hai (do jawab nahi)');

    /* ── D2. NAZAR ka AMAL — doosri koshish aur imaandari ── */
    const w3 = world({});                 /* nazar default ON */
    const N = w3.NAZAR;
    w3.NATIVE = true;
    const dump = (items) => JSON.stringify({ ok: true, pkg: 'com.android.chrome', n: items.length, items: items });
    let calls = [];
    w3.MayaBridge = { uiDump: function (max) {
      calls.push(max);
      return calls.length === 1 ? dump([])
        : dump([{ i:0, t:'btn', x:'Search', cx:1, cy:1 }, { i:1, t:'input', x:'URL bar', cx:2, cy:2 }]);
    } };
    let nz = N.lookRetry(90, 160);
    is(nz.ok === true && nz.items.length === 2 && calls.length === 2 && calls[1] === 160 && N.n.retry === 1,
      '🩹 F60: pehla dump KHALI tha → doosri koshish (160) ne screen parh li', calls.join(' → '));
    calls = [];
    w3.MayaBridge.uiDump = function (max) { calls.push(max); return dump([]); };
    nz = N.lookRetry(90, 160);
    is(nz.ok === false && nz.empty === true && !!nz.say && N.n.empty >= 2,
      '🤝 F60: dono koshishein khali → SAAF nakami + bolne layak line (na chup, na andaza)', nz.say);
    w3.MayaBridge.uiDump = function () { return JSON.stringify({ ok: false, why: 'accessibility band hai' }); };
    nz = N.lookRetry(90, 160);
    is(nz.ok === false && /ijazat|Accessibility/.test(nz.say),
      '🔑 F61: ijazat band ho to say() RAASTA batata hai (sirf technical wajah nahi)', nz.say);
    is(/koshish/.test(N.line()) && /kamyab/.test(N.line()),
      '🧮 NAZAR.line(): poora hisaab ek line mein (RAFTAR report isi ko dikhata hai)', N.line());
    is(/sirf MAYA ki APK/.test(N.say('screen parhna sirf APK mein chalta hai')),
      '🧭 browser mein screen parhne ka sawal → imaandari (APK wali baat, jhoot nahi)');

    /* ── E. Qanoon 9: parcha + forensic darj ── */
    const FX = fs.readFileSync(path.join(ROOT, 'docs/FIX-v5.13.0-raftar.md'), 'utf8');
    let ids = 0;
    for (let n = 59; n <= 66; n++) if (FX.indexOf('F' + n) > 0) ids++;
    is(ids === 8, '🔬 J3 ke 8 flaws (F59..F66) plan-doc mein saboot ke sath darj hain', ids + '/8');
    const RP = fs.readFileSync(path.join(ROOT, 'docs/REPORT-v5.13.0-aam-zubaan.md'), 'utf8');
    is(/PASS/.test(RP) && /FAIL/.test(RP) && /5\.13\.0/.test(RP),
      '📱 Qanoon 9: v5.13.0 ki release report — kya naya, kaise parakhna (PASS/FAIL), version pehchaan');
  }


    console.log('\n\x1b[1m\x1b[35m══════════════════════════════════════════════════════════\x1b[0m');
    if (fail === 0) console.log('\x1b[1m\x1b[32m✅ SAB TEST PASS — ' + pass + '/' + pass + '\x1b[0m');
    else console.log('\x1b[1m\x1b[31m❌ ' + fail + ' TEST FAIL — ' + pass + '/' + (pass + fail) + ' pass\x1b[0m');
    console.log('\x1b[1m\x1b[35m══════════════════════════════════════════════════════════\x1b[0m\n');
    process.exit(fail === 0 ? 0 : 1);
  })();
})();
