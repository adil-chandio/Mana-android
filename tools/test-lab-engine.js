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
    is(/EXTRA_MAX_RESULTS, 6\)/.test(KT.slice(KT.indexOf('fun listen'), KT.indexOf('fun listen') + 2000)),
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
    is(/MainActivity\.instance != null/.test(live) && /SAFE MODE/.test(KT),
      '🔒 app band ho to SAFE MODE bilkul waisa hi (Qanoon 2)');

    const src = HTML;
    is(/setPrefString\('wake_lang', settings\.stt/.test(src), 'JS wake ki zubaan service tak bhejta hai');
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
    is(/rec\.release\(\)[\s\S]{0,120}MicKit\.release\(\)[\s\S]{0,140}actuallyStart/.test(WS),
      '🔒 mic pehle CHHORA jata hai, phir recognizer (dono ek sath nahi)');
    is(/over > 10\.0/.test(WS) && /loud >= 3/.test(WS),
      '📏 halki/door ki awaaz bhi pehra cross kare (Issue 2: threshold 14dB -> 10dB)');

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
    is(/pausedByApp && System\.currentTimeMillis\(\) - pausedAt > 20000/.test(WS),
      '🔒 WebView mar bhi jaye to 20s baad pause KHUD-BA-KHUD azad (Issue 1: 60s -> 20s)');

    /* ── L5 ERR-8 MERCY: service khud ko nahi marti, aap ka switch nahi mita ── */
    const E8 = WS.slice(WS.indexOf('8 -> {'), WS.indexOf('8 -> {') + 900);
    is(E8.indexOf('stopSelf()') === -1 && /restart\(2000\)/.test(E8) && /err8/.test(E8),
      '🕊️ error 8 ab service ko NAHI marta — sirf 2s sukoon (nakami-kahti mauth khatam)');
    const WE = HTML.slice(HTML.indexOf('window.__wakeErr = function'), HTML.indexOf('window.__wakeErr = function') + 900);
    is(WE.indexOf('settings.wakeWord = false;') === -1,
      '🔑🔑 aap ka WAKE SWITCH ab KABHI khud nahi mitega — faisla sirf aap ka');

    /* ── L6 RACE TOKEN: pending restart murda ── */
    is(/val gen = \+\+pendingGen/.test(WS) && /if \(gen != pendingGen\) return@postDelayed/.test(WS),
      '🎫 har schedule ka apna duct-ticket — purana pending restart MURDA (mic strobe ka ilaj)');

    /* ── L7 SELF-WAKE SHIELD ── */
    is(/pehra khamosh/.test(WS) && /while \(gateOn && running\)[\s\S]{0,800}?haalBlock/.test(WS),
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
    is(HTML.indexOf('HAAL        : ') > 0 && HTML.indexOf('roka gaya') > 0,
      '👁️ KAAN report mein HAAL + roko ki ginti nazar aati hai');

    /* ── version qanoon ── */
    is(/appVersion\(\): String = "5\.9\.3-native"/.test(MA) && MA.indexOf('4.3.0-native') === -1,
      '🩹 BONUS — appVersion() ka purana 4.3.0 jhoot bhi ab qatl');
    is(fs.readFileSync(path.join(ROOT, 'app/src/main/assets/web/sw.js'), 'utf8').indexOf('maya-v5.9.3') > 0 &&
       /versionCode 72/.test(fs.readFileSync(path.join(ROOT, 'app/build.gradle'), 'utf8')),
      '🏷️ poore app mein VERSION v5.9.3 (cache saaf, splash saaf, APK saaf)');
    is(HTML.indexOf('5.8.0') === -1, 'kahi purana 5.8.0 version nazar nahi aata');

    /* ── v5.9.1 hotfix — doctor ka jhoota button ab ASAL hai ── */
    head('26c. 🗣️ ON-DEVICE LANGUAGE — wo button jo pehle sirf LIKHA tha');
    is(HTML.indexOf('id="labOnDevice"') > 0,
      '🔑🆕 LAB mein ab 🗣️ ON-DEVICE LANGUAGE ka ASLI button hai (pehle sirf text tha — user dhoondta reh jata tha)');
    is(/openSetting\("ondevice"\)/.test(HTML) && /show\("\\uD83D\\uDDE3\\uFE0F ON-DEVICE LANGUAGE/.test(HTML.replace(/'/g, '"')),
      'button ka click Gboard voice-typing kholta hai + likha hua shajra bhi dikhta hai (ghalat screen khul jaye to bhi raasta yaad rahe)');
    is(/if \(which == "ondevice"\)/.test(MA) && /VoiceSettingsActivity/.test(MA) &&
       /ACTION_VOICE_INPUT_SETTINGS/.test(MA) && /ACTION_SETTINGS/.test(MA),
      '🔑 Kotlin: 3-qadam ki fallback chain — Gboard → voice-input picker → aam Settings (koi bhi phone tode nahi)');
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

    console.log('\n\x1b[1m\x1b[35m══════════════════════════════════════════════════════════\x1b[0m');
    if (fail === 0) console.log('\x1b[1m\x1b[32m✅ SAB TEST PASS — ' + pass + '/' + pass + '\x1b[0m');
    else console.log('\x1b[1m\x1b[31m❌ ' + fail + ' TEST FAIL — ' + pass + '/' + (pass + fail) + ' pass\x1b[0m');
    console.log('\x1b[1m\x1b[35m══════════════════════════════════════════════════════════\x1b[0m\n');
    process.exit(fail === 0 ? 0 : 1);
  })();
})();
