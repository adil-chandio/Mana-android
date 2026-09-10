#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   tools/test-brain-engine.js — DIMAAG ENGINE v2 ka saboot
   ------------------------------------------------------------------------
   Asli engine code public/index.html se nikal kar jsdom mein chalta hai,
   fetch naqli hai. Jin 3 bugs ki wajah se "Sab free brains busy" bar bar
   aata tha, un teenon ka apna test hai:

     B1  400 -> 10 minute ka Gemini blackout  (ab nahi hona chahiye)
     B2  history ka pehla turn "model" -> 400 (ab saaf ho kar jati hai)
     B3  ek sawal par 5 model = 5 request    (ab zyada se zyada 2)

     node tools/test-brain-engine.js
   ════════════════════════════════════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');

let pass = 0, fail = 0;
const is = (c, name, info) => {
  if (c) { pass++; console.log('  \x1b[32m✅\x1b[0m ' + name + (info ? '  \x1b[2m— ' + info + '\x1b[0m' : '')); }
  else { fail++; console.log('  \x1b[31m❌\x1b[0m ' + name + (info ? '  \x1b[33m— ' + info + '\x1b[0m' : '')); }
};
const head = (t) => console.log('\n\x1b[1m' + t + '\x1b[0m');

/* ── engine source nikaalo ── */
const A = HTML.indexOf('var BRAINS = [');
const B = HTML.indexOf('function openURL(u){');
if (A < 0 || B < 0 || B < A) { console.error('BRAIN POOL / DIMAAG source nahi mila'); process.exit(1); }
const ENGINE = HTML.slice(A, B);

/* 🧪 MAYA LAB (FLAGS/SAAF/NAAP/MALIK) — engine ab isay bhi chhoota hai */
const LA = HTML.indexOf('var SCHEMA = {');
const LB = HTML.indexOf('var AWAAZ = {');
if (LA < 0 || LB < 0 || LB < LA) { console.error('MAYA LAB source nahi mila'); process.exit(1); }
const LAB = HTML.slice(LA, LB);

/* ── naqli duniya ── */
function makeWorld(opts = {}) {
  const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'dangerously', url: 'https://appassets.androidplatform.net/' });
  const w = dom.window;
  const state = { fetches: [], logs: [], replies: [], toasts: [] };

  w.settings = Object.assign({ name: 'Sir', apikey: 'K', groqKey: '', ghKey: '', groqModel: 'llama', turbo: false, model: 'auto' }, opts.settings || {});
  w.chatHist = opts.chatHist || [{ role: 'user', text: 'salam' }];
  w.facts = opts.facts || [];
  w.replyCache = {};
  w.modelCooldowns = {};
  w.lastRetryDelay = 45000;
  w.geminiBadUntil = 0;
  w.MODEL_CACHE = { names: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.0-pro'], ts: Date.now() };
  w.MODELS = ['gemini-2.5-flash'];
  w.TOOL_DECLS = [{ name: 'tool_x' }];
  w._activeSkill = null;
  w.NATIVE = false;
  w.thinking = false;
  w.aiState = { provider: '—' };
  w.sysPrompt = () => 'SYS';
  w.pushLog = (m) => state.logs.push(m);
  w.toast = (m) => state.toasts.push(m);
  w.setOrb = () => {};
  w.cacheKey = (t) => String(t).toLowerCase().trim();
  w.cachePut = (k, v) => { w.replyCache[k] = { t: Date.now(), text: v }; };
  w.needsTools = () => false;
  w.execTool = async () => ({ ok: true });
  w.saveModelCache = () => {};
  w.resolveModels = async () => w.MODEL_CACHE.names;
  w.reply = (t) => state.replies.push(t);

  /* naqli fetch */
  const plan = opts.plan || [{ status: 200, body: okBody('theek hai') }];
  let n = 0;
  w.fetch = async (url, init) => {
    const body = init && init.body ? JSON.parse(init.body) : null;
    state.fetches.push({ url, body, model: /models\/([^:]+):/.exec(url)?.[1] });
    const r = typeof plan === 'function' ? plan(state.fetches.length, state) : (plan[n] || plan[plan.length - 1]);
    n++;
    if (r.throw) throw new Error(r.throw);
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      json: async () => r.body,
      text: async () => JSON.stringify(r.body || {}),
      clone() { return this; }
    };
  };

  /* naqli XMLHttpRequest — BRAIN POOL isi se baat karta hai */
  const pool = opts.pool || (() => ({ status: 0, body: 'network' }));
  state.pool = [];
  w.XMLHttpRequest = function () {
    const self = this;
    this.open = (m, u) => { self._u = u; };
    this.setRequestHeader = (k, v) => { if (/^authorization$/i.test(k)) self._auth = v; };
    this.send = (b) => {
      let parsed = null; try { parsed = JSON.parse(b); } catch (e) {}
      state.pool.push({ url: self._u, auth: self._auth || '', body: parsed });
      const r = pool(state.pool.length, state, { url: self._u, auth: self._auth || '', body: parsed }) || { status: 0, body: '' };
      setTimeout(() => {
        self.status = r.status;
        self.responseText = typeof r.body === 'string' ? r.body : JSON.stringify(r.body || {});
        if (r.status === 0 && self.onerror) self.onerror();
        else if (self.onload) self.onload();
      }, 0);
    };
  };
  try { w.localStorage.clear(); } catch (e) {}

  w.eval(LAB);

  w.eval(ENGINE);
  return { w, state, D: w.DIMAAG, B: w.BRAIN };
}
const poolOk = (t) => ({ choices: [{ message: { content: t } }] });
const poolErr = (m) => ({ error: { message: m } });
const okBody = (t) => ({ candidates: [{ content: { parts: [{ text: t }] } }] });
const errBody = (status, message, extra = {}) => ({ error: Object.assign({ code: status, message, status: extra.st || '' }, extra.raw || {}) });

(async function run() {
  console.log('\n\x1b[1m\x1b[36m══════════════════════════════════════════════════════════\x1b[0m');
  console.log('\x1b[1m  🧠  DIMAAG ENGINE v2 — SABOOT\x1b[0m');
  console.log('\x1b[1m\x1b[36m══════════════════════════════════════════════════════════\x1b[0m');

  /* ─── B2: HISTORY SAFAI ─── */
  head('1. B2 — history ka pehla turn hamesha "user" (400 ki asal jarh)');
  {
    const { D } = makeWorld({
      chatHist: [
        { role: 'model', text: 'main maya hoon' },   /* <- yahi 400 karata tha */
        { role: 'user', text: 'kya haal' },
        { role: 'model', text: 'theek' },
        { role: 'user', text: 'aaj mausam?' }
      ]
    });
    const c = D.contents(8);
    is(c[0].role === 'user', 'pehla turn user hai (leading model turn hat gaya)', c[0].role);
    is(c[c.length - 1].role === 'user', 'aakhri turn bhi user hai', c[c.length - 1].role);
    is(c.length === 3, 'baqi history bachi rahi', c.length + ' turns');
    let alt = true;
    for (let i = 1; i < c.length; i++) if (c[i].role === c[i - 1].role) alt = false;
    is(alt, 'roles alternate karte hain (user/model/user)');
  }
  {
    const { D } = makeWorld({
      chatHist: [
        { role: 'user', text: 'ek' }, { role: 'user', text: 'do' },
        { role: 'model', text: 'ji' }, { role: 'user', text: 'teen' }
      ]
    });
    const c = D.contents(8);
    is(c.length === 3 && c[0].parts[0].text === 'ek\ndo', 'lagatar same-role turns merge hote hain', c[0].parts[0].text.replace('\n', '|'));
  }
  {
    const { D } = makeWorld({ chatHist: [{ role: 'model', text: 'sirf model' }] });
    const c = D.contents(8);
    is(c.length === 0 || c[0].role === 'user', 'sirf-model history par bhi kharab payload nahi banta', c.length + ' turns');
  }
  {
    const { D } = makeWorld({ chatHist: [{ role: 'user', text: '' }, { role: 'user', text: 'asli sawal' }] });
    is(D.contents(8).length === 1, 'khali matn wale turns nikal jate hain');
    is(D.lastUser() === 'asli sawal', 'lastUser() sahi jawab deta hai');
  }

  /* ─── B1: 400 ab key ka masla NAHI ─── */
  head('2. B1 — 400 se ab 10 minute ka blackout NAHI hota');
  {
    /* pehli request 400, marammat wali chal jati hai */
    const { w, state, D } = makeWorld({
      plan: (n) => n === 1
        ? { status: 400, body: errBody(400, 'Please ensure that multiturn requests ends with a user role', { st: 'INVALID_ARGUMENT' }) }
        : { status: 200, body: okBody('marammat ke baad jawab') },
      chatHist: [{ role: 'model', text: 'x' }, { role: 'user', text: 'sawal' }]
    });
    const out = await w.geminiChat();
    is(out === 'marammat ke baad jawab', '400 ke baad khud marammat kar ke jawab aaya', String(out).slice(0, 30));
    is(D.keyBadUntil === 0, 'KEY blackout NAHI laga (purana bug)', 'keyBadUntil=' + D.keyBadUntil);
    is(D.fixes === 1, 'khud-marammat gini gayi', String(D.fixes));
    is(D.historySuspect === true, 'history par shak darj hua');
    const fixReq = state.fetches[1];
    is(!fixReq.body.tools, 'marammat wali request bina tools jati hai');
    is(fixReq.body.contents.length === 1 && fixReq.body.contents[0].role === 'user', 'marammat mein sirf aakhri sawal jata hai');
    is(D.provider === 'GEMINI' && D.lastOk > 0, 'kamyabi darj hui');
  }
  {
    const { D } = makeWorld();
    is(D.classify(400, errBody(400, 'Invalid JSON payload')) === 'BAD_REQUEST', '400 = BAD_REQUEST (KEY_BAD nahi)');
    is(D.classify(400, errBody(400, 'API key not valid. Please pass a valid API key.')) === 'KEY_BAD', 'sirf asli key message par KEY_BAD');
    is(D.classify(401, {}) === 'KEY_BAD', '401 = KEY_BAD');
    is(D.classify(403, errBody(403, 'permission denied', { st: 'PERMISSION_DENIED' })) === 'KEY_BAD', '403 = KEY_BAD');
    is(D.classify(403, errBody(403, 'Quota exceeded for quota metric')) === 'QUOTA', '403 + quota lafz = QUOTA');
    is(D.classify(429, {}) === 'QUOTA', '429 = QUOTA');
    is(D.classify(404, {}) === 'MODEL_404', '404 = MODEL_404');
    is(D.classify(503, {}) === 'SERVER', '503 = SERVER');
    is(D.classify(0, {}) === 'NETWORK', 'network fail = NETWORK');
  }

  /* ─── B3: quota bachao ─── */
  head('3. B3 — ek sawal par 5 model nahi, zyada se zyada 2');
  {
    const { w, state } = makeWorld({ plan: () => ({ status: 500, body: errBody(500, 'server') }) });
    await w.geminiChat();
    is(state.fetches.length <= 2, 'zyada se zyada 2 model try hue (quota 5 guna zaya nahi)', state.fetches.length + ' requests');
    const models = new Set(state.fetches.map(f => f.model));
    is(models.size === state.fetches.length, 'har request alag model par');
  }

  /* ─── QUOTA ─── */
  head('4. QUOTA — Google jo waqt maange wohi maano');
  {
    const raw = { error: { code: 429, message: 'Resource exhausted', status: 'RESOURCE_EXHAUSTED', details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '31s' }] } };
    const { w, D } = makeWorld({ plan: () => ({ status: 429, body: raw }) });
    is(D.retryDelay(raw) === 31000, 'retryDelay Google ke jawab se parhi jati hai', '31s');
    await w.geminiChat();
    is(D.lastCode === 'QUOTA', 'code = QUOTA', D.lastCode);
    is(w.modelCooldowns['gemini-2.5-flash'] > Date.now(), 'us model par cooldown laga');
    is(w.lastRetryDelay === 31000, 'auto-retry ka waqt Google wala hai', w.lastRetryDelay + 'ms');
    is(D.dayQuotaUntil === 0, 'per-minute quota ko per-day nahi samjha');
  }
  {
    const raw = { error: { code: 429, message: 'Quota exceeded for GenerateRequestsPerDayPerProjectPerModel', status: 'RESOURCE_EXHAUSTED' } };
    const { w, D, state } = makeWorld({ plan: () => ({ status: 429, body: raw }) });
    is(D.isDayQuota(raw) === true, 'per-day quota pehchana gaya');
    await w.geminiChat();
    is(D.dayQuotaUntil > Date.now(), 'din bhar ke liye Gemini rok diya', Math.round((D.dayQuotaUntil - Date.now()) / 60000) + ' min');
    is(D.lastCode === 'QUOTA_DAY', 'code = QUOTA_DAY', D.lastCode);
    is(state.fetches.length === 1, 'per-day quota par doosra model try hi nahi kiya (bekaar request nahi)', state.fetches.length + ' request');
    is(D.geminiReady() === 'QUOTA_DAY', 'agla sawal Gemini ko chherta bhi nahi');
  }

  /* ─── KEY_BAD ─── */
  head('5. KEY — asli key masla hi blackout karta hai');
  {
    const { w, D, state } = makeWorld({ plan: () => ({ status: 401, body: errBody(401, 'API key not valid') }) });
    await w.geminiChat();
    is(D.keyBadUntil > Date.now(), 'asli key masle par blackout laga', Math.round((D.keyBadUntil - Date.now()) / 60000) + ' min');
    is(state.fetches.length === 1, 'kharab key ke sath doosra model try nahi kiya');
    is(D.geminiReady() === 'KEY_BAD', 'agli dafa gate band');
    is(w.geminiChat.keyErr === true, 'keyErr flag set');
  }

  /* ─── GATES ─── */
  head('6. GATES — bekaar request kabhi nahi');
  {
    const t = async (settings, want, name, prep) => {
      const { w, D, state } = makeWorld({ settings });
      if (prep) prep(w, D);
      is(D.geminiReady() === want, name, D.geminiReady() || '(chalega)');
      await w.geminiChat();
      if (want) is(state.fetches.length === 0, '  → koi request nahi gayi', state.fetches.length + '');
    };
    await t({ apikey: '' }, 'KEY_MISSING', 'key nahi → KEY_MISSING');
    await t({}, '', 'sab theek → chalega');
    {
      const { w, D, state } = makeWorld();
      Object.defineProperty(w.navigator, 'onLine', { value: false, configurable: true });
      is(D.geminiReady() === 'OFFLINE', 'offline → OFFLINE');
      await w.geminiChat();
      is(state.fetches.length === 0, '  → offline par request nahi jati');
    }
  }

  /* ─── TOOLS ─── */
  head('7. TOOLS — function calling zinda hai');
  {
    const toolCall = { candidates: [{ content: { parts: [{ functionCall: { name: 'tool_x', args: {} } }] } }] };
    const { w, state } = makeWorld({ plan: (n) => n === 1 ? { status: 200, body: toolCall } : { status: 200, body: okBody('tool ke baad jawab') } });
    const out = await w.geminiChat();
    is(out === 'tool ke baad jawab', 'tool chalne ke baad asli jawab aata hai');
    is(state.fetches.length === 2, 'tool result ke sath dobara poocha gaya');
    const second = state.fetches[1].body.contents;
    is(second[second.length - 1].parts[0].functionResponse, 'functionResponse history mein gaya');
    is(w.geminiChat.toolsUsed === true, 'toolsUsed flag laga');
  }
  {
    /* tool crash ho jaye to bhi chain na toote */
    const toolCall = { candidates: [{ content: { parts: [{ functionCall: { name: 'tool_x', args: {} } }] } }] };
    const { w } = makeWorld({ plan: (n) => n === 1 ? { status: 200, body: toolCall } : { status: 200, body: okBody('phir bhi jawab') } });
    w.execTool = async () => { throw new Error('tool toot gaya'); };
    const out = await w.geminiChat();
    is(out === 'phir bhi jawab', 'tool crash hone par bhi jawab milta hai');
  }

  /* ─── FALLBACK LADDER ─── */
  head('8. LADDER — Gemini → Groq → GitHub');
  {
    const { w, D, state } = makeWorld({
      settings: { apikey: 'AIzaKKKKKKKKKK', groqKey: 'gsk_GGGGGGGGGG' },
      plan: [{ status: 500, body: errBody(500, 'down') }],
      pool: (n, st, req) => /groq/.test(req.url) ? { status: 200, body: poolOk('groq ka jawab') } : { status: 0, body: '' }
    });
    await w.askAI(false);
    is(state.replies[0] === 'groq ka jawab', 'Gemini gira to Groq ne sambhala', state.replies[0]);
    is(/GROQ/i.test(D.provider), 'provider Groq darj hua', D.provider);
    is(D.report.some(r => /GEMINI/.test(r.who) && r.code === 'SERVER'), 'Gemini ki nakami report mein hai');
  }
  {
    const { w, state } = makeWorld({
      settings: { apikey: 'AIzaKKKKKKKKKK', groqKey: 'gsk_GGGGGGGGGG', ghKey: 'github_pat_HHHH' },
      plan: [{ status: 500, body: errBody(500, 'down') }],
      pool: (n, st, req) => /models\.github\.ai/.test(req.url) ? { status: 200, body: poolOk('github ka jawab') } : { status: 500, body: poolErr('down') }
    });
    await w.askAI(false);
    is(state.replies[0] === 'github ka jawab', 'Groq bhi gira to GitHub Models ne sambhala', state.replies[0]);
  }

  /* ─── ASAL SHIKAYAT: "Sab free brains busy" ─── */
  head('9. NAKAMI KA PAIGHAM — ek jumla 5 wajahon ke liye NAHI');
  {
    const seen = new Set();
    const cases = [
      ['KEY_MISSING', { apikey: '', groqKey: '', ghKey: '' }, /Settings.*API KEYS|key hi nahi/i],
      ['KEY_BAD', { apikey: 'K' }, /key kaam nahi kar rahi|nayi FREE key/i],
      ['QUOTA_DAY', { apikey: 'K' }, /quota khatam.*(cerebras|mistral|comma)/is],
      ['QUOTA', { apikey: 'K' }, /ek minute|dobara koshish/i],
      ['SERVER', { apikey: 'K' }, /server abhi kharab/i],
      ['BAD_REQUEST', { apikey: 'K' }, /history/i],
      ['NETWORK', { apikey: 'K' }, /Network tak baat nahi/i]
    ];
    for (const [code, settings, re] of cases) {
      const { D } = makeWorld({ settings });
      D.lastCode = code;
      const msg = D.failMessage();
      is(re.test(msg), code + ' → apna alag paigham', msg.slice(0, 58) + '…');
      is(!seen.has(msg), '  → paigham pehle wale se alag hai');
      seen.add(msg);
      is(!/Sab free brains is waqt busy/.test(msg), '  → purana "sab free brains busy" nahi');
    }
    const { w, D } = makeWorld();
    Object.defineProperty(w.navigator, 'onLine', { value: false, configurable: true });
    is(/Internet nahi hai/.test(D.failMessage()), 'offline ka apna paigham');
    is(HTML.indexOf('Sab free brains is waqt busy hain') < 0, 'purana jumla code se hi nikal gaya');
  }

  /* ─── LOCAL BRAIN ─── */
  head('10. LOCAL BRAIN — khali haath kabhi nahi');
  {
    const { D } = makeWorld({ facts: ['Boss ka birthday 14 August hai'] });
    is(/baj rahe hain/.test(D.localAnswer('abhi kitne baje hain') || ''), 'waqt ka jawab local milta hai');
    is(/hai/.test(D.localAnswer('aaj ki tareekh kya hai') || ''), 'tareekh ka jawab local milta hai');
    is(/28/.test(D.localAnswer('12 + 16') || ''), 'chhota hisab local hota hai', D.localAnswer('12 + 16'));
    is(/14 August/.test(D.localAnswer('mera birthday kab hai') || ''), 'yaad-dasht se jawab milta hai');
    is(D.localAnswer('quantum physics samjhao') === null, 'jo local na ho uske liye null (jhoot nahi bolti)');
  }
  {
    /* sab brain fail + local jawab mumkin -> local hi bolti hai */
    const { w, state } = makeWorld({
      settings: { apikey: 'K' },
      chatHist: [{ role: 'user', text: 'abhi kitne baje hain' }],
      plan: () => ({ status: 401, body: errBody(401, 'API key not valid') })
    });
    w.askAI._retried = false;
    await w.askAI(false);
    is(/baj rahe hain/.test(state.replies[0] || ''), 'sab brain fail hone par bhi kaam ka jawab mila', (state.replies[0] || '').slice(0, 40));
  }

  /* ─── EXPLICIT RETRY ONLY ─── */
  head('11. EXPLICIT RETRY — failures are notices, never scheduled actions');
  {
    const { w, state } = makeWorld({ settings: { apikey: 'K' }, plan: () => ({ status: 401, body: errBody(401, 'API key not valid') }) });
    w.askAI._retried = false;
    await w.askAI(false);
    is(state.toasts.filter(t => /dobara try/.test(t)).length === 0, 'key kharab hai to bekaar 45s intezaar nahi karati');
    is(state.replies.length === 0 && state.toasts.some(t => /no automatic retry/.test(t)), 'failure shown separately from model answers');
  }
  {
    const { w, state } = makeWorld({ settings: { apikey: 'K' }, plan: () => ({ status: 503, body: errBody(503, 'overloaded') }) });
    w.askAI._retried = false;
    await w.askAI(false);
    is(state.toasts.some(t => /no automatic retry/.test(t)) && !state.toasts.some(t => /KHUD dobara/.test(t)), 'server failure asks for explicit retry, no background action', state.toasts[0]);
  }
  {
    /* asal masla "Groq key nahi hai" jaisi mamooli baat mein dab na jaye */
    const { D } = makeWorld();
    D.report = [{ who: 'GEMINI', code: 'SERVER' }, { who: 'GROQ', code: 'KEY_MISSING' }, { who: 'GITHUB', code: 'KEY_MISSING' }];
    is(D.verdict() === 'SERVER', 'verdict() asal masla chunta hai, KEY_MISSING nahi', D.verdict());
    D.report = [{ who: 'GEMINI', code: 'QUOTA' }, { who: 'GROQ', code: 'SERVER' }];
    is(D.verdict() === 'QUOTA', 'zyada ahem masla pehle', D.verdict());
    D.report = [{ who: 'GEMINI', code: 'KEY_MISSING' }, { who: 'GROQ', code: 'KEY_MISSING' }];
    is(D.verdict() === 'KEY_MISSING', 'sach much koi key na ho to KEY_MISSING hi', D.verdict());
    D.report = [{ who: 'GEMINI', code: 'OK' }];
    is(D.verdict() === '', 'kamyabi par koi masla nahi');
  }

  /* ─── CACHE ─── */
  head('12. CACHE — wahi sawal dobara = 0 request');
  {
    const { w, state } = makeWorld({ chatHist: [{ role: 'user', text: 'pakistan ka capital' }] });
    await w.askAI(false);
    const n1 = state.fetches.length;
    await w.askAI(false);
    is(n1 === 1 && state.fetches.length === 1, 'doosri dafa koi network call nahi', state.fetches.length + ' calls');
    is(state.replies.length === 2, 'phir bhi dono dafa jawab mila');
  }

  /* ─── PILL (I4) ─── */
  head('13. HEADER PILL — ab jhoot nahi bolta');
  {
    const { w, D } = makeWorld({ settings: { apikey: '', groqKey: '', ghKey: '' } });
    is(/^AI READY • [1-9]\d* DIMAAG$/.test(D.pill()), 'bina kisi key ke bhi keyless dimaag zinda dikhte hain', D.pill());
    w.settings.apikey = 'K';
    is(/^AI READY/.test(D.pill()) && !/ONLINE/.test(D.pill()), 'key hai magar abhi koi jawab nahi aaya → AI READY (AI ONLINE nahi)', D.pill());
    D.lastOk = Date.now(); D.provider = 'GEMINI';
    is(/^AI ONLINE/.test(D.pill()), 'asli jawab ke baad hi AI ONLINE', D.pill());
    D.lastOk = Date.now() - 1000000; D.lastCode = 'QUOTA';
    is(D.pill() === 'AI BUSY', 'purana jawab + quota → AI BUSY', D.pill());
    D.keyBadUntil = Date.now() + 60000;
    is(D.pill() === 'KEY MASLA', 'key kharab → KEY MASLA', D.pill());
    Object.defineProperty(w.navigator, 'onLine', { value: false, configurable: true });
    is(D.pill() === 'OFFLINE', 'offline → OFFLINE', D.pill());
  }

  /* ─── DOCTOR ─── */
  head('14. DOCTOR — poora record');
  {
    const { w, D } = makeWorld({ plan: () => ({ status: 500, body: errBody(500, 'down') }) });
    await w.geminiChat();
    const L = D.lines().join('\n');
    is(/DIMAAG ENGINE v2/.test(L), 'Doctor mein DIMAAG block hai');
    is(/AAKHRI MASLA: SERVER/.test(L), 'aakhri masla likha hai');
    is(/KOSHISHEN/.test(L) && /❌/.test(L), 'har koshish ka natija likha hai');
    is(/KUL CALLS: \d+/.test(L), 'kitni requests gayin ye bhi');
  }

  /* ═══════════════ BRAIN POOL v3 ═══════════════ */
  head('15. BRAIN POOL — registry aur mare hue model');
  {
    const { w } = makeWorld();
    const ids = w.BRAINS.map(b => b.id);
    is(ids.length >= 10, 'kam se kam 10 dimaag registry mein', ids.length + ' mile');
    is(ids.indexOf('groq') >= 0 && ids.indexOf('cerebras') >= 0 && ids.indexOf('mistral') >= 0, 'Groq + Cerebras + Mistral maujood');
    is(ids.indexOf('llm7') >= 0 && ids.indexOf('pollen') >= 0, 'do keyless dimaag maujood');
    const keyless = w.BRAINS.filter(b => b.keyless);
    is(keyless.length >= 2, 'keyless teh mein 2+ provider', keyless.map(b => b.id).join(','));
    const gq = w.BRAINS.filter(b => b.id === 'groq')[0];
    is(gq.models.indexOf('llama-3.3-70b-versatile') < 0, 'Groq ka MARA HUA llama-3.3-70b hata diya gaya');
    is(gq.models.indexOf('llama-3.1-8b-instant') < 0, 'Groq ka MARA HUA llama-3.1-8b hata diya gaya');
    is(gq.models[0] === 'openai/gpt-oss-120b', 'Groq default ab zinda model hai', gq.models[0]);
    is(w.BRAINS.every(b => b.keyless || b.keyField), 'har keyed provider ka apna key field hai');
    is(w.BRAINS.every(b => b.kind !== 'openai' || /^https:\/\//.test(b.url)), 'har openai provider ka https url hai');
  }

  head('16. KAI KEYS — quota dugna tigna');
  {
    const { w, B } = makeWorld({ settings: { groqKey: 'gsk_aaaaaaaaaa, gsk_bbbbbbbbbb\ngsk_cccccccccc' } });
    const ks = B.keys(w.BRAINS.filter(b => b.id === 'groq')[0]);
    is(ks.length === 3, 'comma + nayi line se 3 keys nikalin', ks.length + '');
    is(ks[1] === 'gsk_bbbbbbbbbb', 'doosri key theek se cut hui', ks[1]);
    const short = B.keys({ keyField: 'ghKey' });
    is(short.length === 0, 'khaali/chhoti key ginti mein nahi aati');
    const plan = B.plan(false).filter(x => x.p.id === 'groq');
    is(plan.length === 3, 'plan mein Groq ki teenon keys alag koshish hain', plan.length + '');
    B.chill('groq', 0, 60000, 'QUOTA');
    is(B.plan(false).filter(x => x.p.id === 'groq').length === 2, 'quota wali key plan se nikal gayi');
    is(B.ready(w.BRAINS.filter(b => b.id === 'groq')[0], 0) === 'QUOTA', 'us key ka halat QUOTA batata hai');
  }

  head('17. COOLDOWN — app band ho kar khulne par bhi yaad');
  {
    const { w, B } = makeWorld({ settings: { groqKey: 'gsk_aaaaaaaaaa' } });
    B.chill('groq', 0, 3600000, 'QUOTA');
    const saved = w.localStorage.getItem('maya_brainpool');
    is(!!saved && /groq/.test(saved), 'cooldown localStorage mein mehfooz hai');
    B.state = {}; B.load();
    is(B.cool('groq', 0) > 3000000, 'restart ke baad bhi cooldown yaad raha', Math.round(B.cool('groq', 0) / 1000) + 's');
    B.free('groq', 0);
    is(B.cool('groq', 0) === 0, 'free() cooldown khatam kar deta hai');
  }

  head('18. KEYLESS FLOOR — bina kisi key ke bhi jawab');
  {
    const { w, state } = makeWorld({
      settings: { apikey: '', groqKey: '', ghKey: '' },
      plan: [{ status: 429, body: errBody(429, 'quota') }],
      pool: (n, st, req) => /llm7/.test(req.url) ? { status: 200, body: poolOk('bina key ka jawab') } : { status: 0, body: '' }
    });
    await w.askAI(false);
    is(state.replies.length === 1, 'jawab mila');
    is(/bina key ka jawab/.test(state.replies[0]), 'keyless dimaag ne jawab diya', state.replies[0]);
    is(state.pool.some(r => /llm7\.io/.test(r.url)), 'LLM7 ko sach much call kiya gaya');
    is(state.fetches.length === 0, 'key nahi thi to Gemini ko chhera hi nahi');
  }

  head('19. POOL WALK — ek girta hai to agla uthta hai');
  {
    const { w, state, B } = makeWorld({
      settings: { apikey: '', groqKey: 'gsk_aaaaaaaaaa', cerebrasKey: 'csk_bbbbbbbbbb' },
      pool: (n, st, req) => {
        if (/groq/.test(req.url)) return { status: 429, body: poolErr('rate limit') };
        if (/cerebras/.test(req.url)) return { status: 200, body: poolOk('cerebras bola') };
        return { status: 0, body: '' };
      }
    });
    await w.askAI(false);
    is(/cerebras bola/.test(state.replies[0] || ''), 'Groq gira to Cerebras ne uthaya', state.replies[0]);
    is(state.pool[0] && /groq/.test(state.pool[0].url), 'sab se tez (Groq) ko pehle try kiya');
    is(B.cool('groq', 0) > 0, 'gire hue Groq ko cooldown mil gaya');
    is(B.cool('cerebras', 0) === 0, 'kamyab Cerebras azaad hai');
    is(B.lastUsed === 'cerebras', 'lastUsed sahi provider par set hai', B.lastUsed);
  }

  head('20. MARA HUA MODEL — khud ko theek kar leta hai');
  {
    const { w, B } = makeWorld({ settings: { groqKey: 'gsk_aaaaaaaaaa' } });
    const gq = w.BRAINS.filter(b => b.id === 'groq')[0];
    const before = (B.models.groq || gq.models).length;
    B.dropModel(gq, gq.models[0]);
    is((B.models.groq || []).length === before - 1, 'mara hua model list se nikla');
    is((B.models.groq || []).indexOf(gq.models[0]) < 0, 'wo dobara pehla nahi rahega');
    is(/dropModel/.test(HTML) && /decommission|deprecat/.test(HTML), 'deprecation ka jawab code mein maujood hai');
  }

  head('21. AUTH + PAYLOAD — provider ko theek shakl mein baat');
  {
    const { w, state } = makeWorld({
      settings: { apikey: '', groqKey: 'gsk_aaaaaaaaaa' },
      pool: () => ({ status: 200, body: poolOk('ok') })
    });
    await w.askAI(false);
    const r = state.pool[0];
    is(r.auth === 'Bearer gsk_aaaaaaaaaa', 'Bearer header theek gaya', r.auth);
    is(Array.isArray(r.body.messages) && r.body.messages[0].role === 'system', 'system message pehle hai');
    is(r.body.messages.some(m => m.role === 'user'), 'user ka sawal saath gaya');
    is(!r.body.messages.some(m => m.role === 'model'), 'gemini wala "model" role kabhi nahi bheja');
    is(r.body.stream === false, 'stream band hai');
  }

  head('22. STATUS — Settings/Doctor ke liye sacchi tasveer');
  {
    const { w, B } = makeWorld({ settings: { apikey: '', groqKey: 'gsk_aaaaaaaaaa' } });
    const st = B.status();
    is(st.length === w.BRAINS.length, 'har dimaag ka row hai');
    const g = st.filter(x => x.id === 'groq')[0];
    is(g.rows[0].state === 'LIVE', 'key wala dimaag LIVE dikhta hai');
    const m = st.filter(x => x.id === 'mistral')[0];
    is(m.rows[0].state === 'NO_KEY', 'bina key wala NO_KEY dikhta hai');
    is(B.liveCount() >= 3, 'keyless ki wajah se hamesha 3+ zinda', B.liveCount() + '');
    B.chill('groq', 0, 60000, 'QUOTA');
    is(B.status().filter(x => x.id === 'groq')[0].rows[0].state === 'QUOTA', 'cooldown status mein nazar aata hai');
  }

  /* ─── SOURCE ─── */
  head('23. SOURCE — purane bug wapas na aayen');
  {
    is(!/geminiBadUntil = Date\.now\(\) \+ 600000/.test(HTML), 'purana "400 → 10 min blackout" code nikal gaya');
    is(/res\.status === 400 \|\| res\.status === 403/.test(HTML) === false, 'purani ghalat classify line nikal gayi');
    is(/DIMAAG\.contents\(8\)/.test(HTML), 'saaf ki hui history hi bheji jati hai');
    is(/statusPill\.textContent = \(NATIVE \? "APK • " : ""\) \+ DIMAAG\.pill\(\)/.test(HTML), 'header pill DIMAAG se juda hai');
    is(/DIMAAG\.lines\(\)/.test(HTML), 'Doctor DIMAAG report chhapta hai');
    is((HTML.match(/async function askAI/g) || []).length === 1, 'askAI sirf ek dafa');
    is((HTML.match(/async function geminiChat/g) || []).length === 1, 'geminiChat sirf ek dafa');
    is(!/llama-3\.3-70b-versatile|llama-3\.1-8b-instant/.test(HTML), 'Groq ke mare hue model kahin bache nahi');
    is(!/function openaiCompatChat/.test(HTML), 'purana openaiCompatChat nikal gaya');
    is((HTML.match(/var BRAINS = \[/g) || []).length === 1, 'BRAINS registry sirf ek dafa');
    is(/window\.__httpDone/.test(HTML), 'bridge ka async jawab wala hook maujood hai');
    is(/httpPostAsync/.test(fs.readFileSync(path.join(ROOT, 'app/src/main/java/com/maya/ai/MainActivity.kt'), 'utf8')), 'Kotlin bridge mein httpPostAsync maujood hai');
    is(/id="poolCheck"/.test(HTML) && /id="sCerebras"/.test(HTML), 'Settings mein pool panel + naye key fields hain');
  }

  console.log('\n\x1b[1m\x1b[36m══════════════════════════════════════════════════════════\x1b[0m');
  if (fail === 0) console.log('\x1b[1m\x1b[32m✅ SAB TEST PASS — ' + pass + '/' + pass + '\x1b[0m');
  else console.log('\x1b[1m\x1b[31m❌ ' + fail + ' TEST FAIL — ' + pass + '/' + (pass + fail) + ' pass\x1b[0m');
  console.log('\x1b[1m\x1b[36m══════════════════════════════════════════════════════════\x1b[0m\n');
  process.exit(fail === 0 ? 0 : 1);
})();
