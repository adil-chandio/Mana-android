/* ═══════════════════════════════════════════════════════════════════════════
   🧪  MAYA LAB  —  P0 (NAAP-TOL) + P1 (SAAF ZUBAAN) + 👑 MALIK    (app v5.9.5)
   ---------------------------------------------------------------------------
   Ye block 3 kaam karta hai, aur teeno ALAG SWITCH ke peeche hain:

     FLAGS.naap   📊  sirf NAAPTA hai — Maya ka rawaiya bilkul nahi badalta
     FLAGS.saaf   🧹  andar ki soch (<think>) bubble aur AWAAZ dono se hatata hai
     FLAGS.malik  👑  Maya ko apne banane wale ka pata deta hai

   Switch OFF = code maujood hai magar chalta hi nahi -> purana raasta jyun ka tyun.
   (AMAL-WORKFLOW.md · Qanoon 1 aur 2)

   ⚠️  ES5 PABANDI: is app ka WebView purana hai (~Chrome 55-79 — saboot:
       docs/FIX-v4.0.1-webview-compat.md mein '?.' parse fail hua tha).
       Is liye yahan arrow function, const/let, optional chaining, template
       literal KUCH NAHI. test-settings-ui.js is par taala lagata hai.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ───────────────────────── 🔖 SCHEMA — localStorage ki version ───────────────
   12 keys pehle se hain aur 4 aur aa rahi hain. Version ab rakh rahe hain,
   20 hone se pehle — taake kal shakl badle to purana data na toote.
   (CHHED 4) */
var SCHEMA = {
  KEY: "maya_schema",
  NOW: 1,
  at: 0,
  init: function () {
    try { SCHEMA.at = parseInt(localStorage.getItem(SCHEMA.KEY), 10) || 0; } catch (e) { SCHEMA.at = 0; }
    if (SCHEMA.at === SCHEMA.NOW) return SCHEMA.at;
    var from = SCHEMA.at;
    /* aaindah migrations yahan: if (SCHEMA.at < 2) { …; SCHEMA.at = 2; } */
    SCHEMA.at = SCHEMA.NOW;
    try { localStorage.setItem(SCHEMA.KEY, String(SCHEMA.NOW)); } catch (e) {}
    if (from && from !== SCHEMA.NOW && typeof pushLog === "function") pushLog("SCHEMA: " + from + " -> " + SCHEMA.NOW);
    return SCHEMA.at;
  }
};

/* ───────────────────────── 🧪 FLAGS — har nayi cheez ek switch ke peeche ───── */
var FLAGS = {
  KEY: "maya_flags",
  DEF: { naap: true, saaf: false, malik: false, poolTools: false, suno: false, sach: false, boli: false, ijazat: false, bijli: false, aankh: false, nazar: false, sukoon: true },  /* naap + sukoon default ON (bay-zarar / bugfix) */
  v: null,
  load: function () {
    if (FLAGS.v) return FLAGS.v;
    var out = {}, k;
    for (k in FLAGS.DEF) if (Object.prototype.hasOwnProperty.call(FLAGS.DEF, k)) out[k] = FLAGS.DEF[k];
    try {
      var raw = JSON.parse(localStorage.getItem(FLAGS.KEY) || "{}");
      for (k in out) if (Object.prototype.hasOwnProperty.call(out, k) && typeof raw[k] === "boolean") out[k] = raw[k];
    } catch (e) {}
    FLAGS.v = out;
    return out;
  },
  on: function (k) { return FLAGS.load()[k] === true; },
  set: function (k, val) {
    var f = FLAGS.load();
    f[k] = val === true;
    try { localStorage.setItem(FLAGS.KEY, JSON.stringify(f)); } catch (e) {}
    if (typeof pushLog === "function") pushLog("LAB: " + k + " = " + (val ? "ON" : "OFF"));
    return f[k];
  },
  reset: function () {
    FLAGS.v = null;
    try { localStorage.removeItem(FLAGS.KEY); } catch (e) {}
    return FLAGS.load();
  }
};

/* ───────────────────────── 📊 NAAP — har turn ka waqt ───────────────────────
   Bina is ke "teiz ho gaya" sirf ehsaas hai. Ab number honge.
   Marks: heard(STT khatam) · brain(dimaag ka jawab) · tool(pehla amal) ·
          voice(pehli awaaz) · done
   (CHHED 1 aur 7) */
var NAAP = {
  KEY: "maya_naap",
  MAX: 120,
  cur: null,
  hist: [],
  loaded: false,

  load: function () {
    if (NAAP.loaded) return;
    NAAP.loaded = true;
    try {
      var d = JSON.parse(localStorage.getItem(NAAP.KEY) || "[]");
      if (d && d.length) NAAP.hist = d.slice(-NAAP.MAX);
    } catch (e) {}
  },
  save: function () {
    try { localStorage.setItem(NAAP.KEY, JSON.stringify(NAAP.hist.slice(-NAAP.MAX))); } catch (e) {}
  },

  start: function (src) {
    if (!FLAGS.on("naap")) return;
    NAAP.cur = { t0: (new Date()).getTime(), src: src || "text", m: {} };
  },
  mark: function (name) {
    if (!NAAP.cur) return;
    if (NAAP.cur.m[name] === undefined) NAAP.cur.m[name] = (new Date()).getTime() - NAAP.cur.t0;
  },
  end: function (info) {
    if (!NAAP.cur) return;
    NAAP.load();
    var c = NAAP.cur;
    NAAP.cur = null;
    c.m.done = (new Date()).getTime() - c.t0;
    c.at = (new Date()).getTime();
    if (info) {
      if (info.brain) c.brain = String(info.brain).slice(0, 24);
      if (info.engine) c.engine = String(info.engine).slice(0, 12);
      if (info.tool) c.tool = String(info.tool).slice(0, 24);
      if (info.err) c.err = String(info.err).slice(0, 24);
      if (info.saaf) c.saaf = info.saaf | 0;          /* kitne harf soch ke kate */
    }
    NAAP.hist.push(c);
    if (NAAP.hist.length > NAAP.MAX) NAAP.hist = NAAP.hist.slice(-NAAP.MAX);
    NAAP.save();
  },

  /* aadhe se (p50) aur 90% (p90) — aisi cheezon mein औsat jhoot bolta hai */
  pct: function (arr, p) {
    if (!arr.length) return 0;
    var a = arr.slice(0).sort(function (x, y) { return x - y; });
    var i = Math.min(a.length - 1, Math.max(0, Math.round((p / 100) * (a.length - 1))));
    return a[i];
  },
  col: function (key) {
    var out = [], i;
    for (i = 0; i < NAAP.hist.length; i++) if (typeof NAAP.hist[i].m[key] === "number") out.push(NAAP.hist[i].m[key]);
    return out;
  },
  stats: function () {
    NAAP.load();
    var brains = {}, engines = {}, i, h, saafHits = 0, toolTurns = 0, errs = 0;
    for (i = 0; i < NAAP.hist.length; i++) {
      h = NAAP.hist[i];
      if (h.brain) brains[h.brain] = (brains[h.brain] || 0) + 1;
      if (h.engine) engines[h.engine] = (engines[h.engine] || 0) + 1;
      if (h.saaf) saafHits++;
      if (h.tool) toolTurns++;
      if (h.err) errs++;
    }
    return {
      turns: NAAP.hist.length,
      brain: { p50: NAAP.pct(NAAP.col("brain"), 50), p90: NAAP.pct(NAAP.col("brain"), 90) },
      tool:  { p50: NAAP.pct(NAAP.col("tool"), 50),  p90: NAAP.pct(NAAP.col("tool"), 90) },
      voice: { p50: NAAP.pct(NAAP.col("voice"), 50), p90: NAAP.pct(NAAP.col("voice"), 90) },
      done:  { p50: NAAP.pct(NAAP.col("done"), 50),  p90: NAAP.pct(NAAP.col("done"), 90) },
      brains: brains, engines: engines,
      saafHits: saafHits, toolTurns: toolTurns, errs: errs
    };
  },
  clear: function () { NAAP.hist = []; NAAP.loaded = true; NAAP.save(); },

  /* Settings mein dikhane ke liye */
  report: function () {
    var s = NAAP.stats(), out = [], k;
    out.push("📊 BASELINE — aakhri " + s.turns + " turn");
    if (!s.turns) { out.push(""); out.push("Abhi koi naap nahi. Maya se kuch baatein karo,"); out.push("phir yahan asli number aa jayenge."); return out.join("\n"); }
    out.push("");
    out.push("               p50        p90");
    out.push("  dimaag    " + NAAP.ms(s.brain.p50) + "  " + NAAP.ms(s.brain.p90));
    if (s.tool.p50)  out.push("  tool      " + NAAP.ms(s.tool.p50) + "  " + NAAP.ms(s.tool.p90));
    if (s.voice.p50) out.push("  awaaz     " + NAAP.ms(s.voice.p50) + "  " + NAAP.ms(s.voice.p90));
    out.push("  kul       " + NAAP.ms(s.done.p50) + "  " + NAAP.ms(s.done.p90));
    out.push("");
    out.push("  tool wale turn : " + s.toolTurns + " / " + s.turns);
    out.push("  soch kaati gayi: " + s.saafHits + " / " + s.turns + (FLAGS.on("saaf") ? "" : "   (saaf OFF hai)"));
    out.push("  nakaam turn    : " + s.errs);
    out.push("");
    out.push("  DIMAAG:");
    for (k in s.brains) if (Object.prototype.hasOwnProperty.call(s.brains, k)) out.push("    " + k + " × " + s.brains[k]);
    out.push("  AWAAZ:");
    for (k in s.engines) if (Object.prototype.hasOwnProperty.call(s.engines, k)) out.push("    " + k + " × " + s.engines[k]);
    return out.join("\n");
  },
  ms: function (n) {
    var s = (n >= 1000) ? ((n / 1000).toFixed(1) + "s") : (n + "ms");
    while (s.length < 8) s = " " + s;
    return s;
  }
};

/* ───────────────────────── 🧹 SAAF — andar ki soch bahar na aaye ────────────
   Aap ne screenshot mein poora <think> dekha AUR suna. Ye us ka ilaj hai.
   10 shaklein — sab asli models se dekhi hui.  (P1 · CHHED 5) */
function SAAF(text) {
  var t = String(text === null || text === undefined ? "" : text);
  var before = t.length;
  SAAF.hit = "";

  function cut(re, tag) {
    var n = t.replace(re, " ");
    if (n !== t) { t = n; if (SAAF.hit.indexOf(tag) < 0) SAAF.hit += (SAAF.hit ? "," : "") + tag; }
  }

  /* 1. band shuda soch ke tag */
  cut(/<\s*(think|thinking|reasoning|scratchpad|reflection|analysis)\s*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "think");
  /* 2. gpt-oss "harmony": <|channel|>analysis … <|message|> */
  cut(/<\|channel\|>[\s\S]*?<\|message\|>/gi, "harmony");
  cut(/<\|[a-zA-Z_]{2,20}\|>/g, "harmony");
  /* 3. BAND NA HUA soch ka tag (token khatam ho gaya) — aakhir tak kaat do */
  cut(/<\s*(think|thinking|reasoning|scratchpad|analysis)\s*>[\s\S]*$/i, "cut-think");
  /* 4. akela band hone wala tag */
  cut(/<\s*\/\s*(think|thinking|reasoning|scratchpad|analysis)\s*>/gi, "think");
  /* 5. hamara apna AMAL protocol (P2 mein chalega, dikhega kabhi nahi) */
  cut(/\u2039AMAL\u203A[\s\S]*?\u2039\/AMAL\u203A/g, "amal");
  /* 6. XML-shakl tool call jo kuch models likh dete hain */
  cut(/<(tool_call|function_call|tool_use)>[\s\S]*?<\/\1>/gi, "toolxml");
  /* 7. markdown code fence jismein sirf soch/json ho — fence ke nishaan hatao */
  cut(/^\s*```[a-zA-Z]*\s*$/gm, "fence");

  /* 8-10. saada matn wali soch — line ba line chhanto */
  var lines = t.split("\n"), keep = [], i, L, dropped = 0;
  var HEAD = /^\s*(here'?s (a|my) (thinking|thought) process|thinking process|let me think|my thinking|reasoning:|analysis:|draft( construction)?|response draft|check (the )?constraints|refine against constraints|constraint check|final (answer|response)\s*:?\s*$)/i;
  var STEP = /^\s*(\d+[\.\)]\s*)?\*\*[A-Z][^*]{2,40}\*\*\s*:?\s*$/;                 /* **Analyze User Input:** */
  var META = /^\s*[-*\u2022]?\s*(language|constraint|persona|tool|context|check|draft|spoken aloud style|plain text|no markdown|user says|the user (wants|asked|spoke))\b.{0,120}$/i;
  /* asli device par mila: "(Note: emojis not allowed per rules, remove)" */
  cut(/\((?:note|reminder|rule|self-note|system)\s*:[^)]{0,160}(?:rules?|constraint|allowed|instruction|guideline)[^)]{0,80}\)/gi, "note");
  /* brightness_control(level=100)  AUR  play_youtube(query="Funk  <- kata hua (asli device par mila) */
  var LONE = /^\s*[a-z_][a-z0-9_]{3,30}\s*\((?:[^)]*\)|[^)]*)\s*$/i;

  for (i = 0; i < lines.length; i++) {
    L = lines[i];
    if (HEAD.test(L) || STEP.test(L) || LONE.test(L) || (META.test(L) && L.length < 140)) { dropped++; continue; }
    keep.push(L);
  }
  if (dropped) { t = keep.join("\n"); if (SAAF.hit.indexOf("plain") < 0) SAAF.hit += (SAAF.hit ? "," : "") + "plain"; }

  t = t.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  SAAF.cut = Math.max(0, before - t.length);
  return t;
}
SAAF.hit = "";
SAAF.cut = 0;

/* Jawab kaam ka hai? (soch nikalne ke baad kuch bacha bhi ya nahi)
   Kuch na bache -> jawab EMPTY -> AGLA DIMAAG. Khali bubble kabhi nahi. */
SAAF.usable = function (text) {
  if (!FLAGS.on("saaf")) return String(text === null || text === undefined ? "" : text);
  var out = SAAF(text);
  if (out.replace(/[^a-zA-Z\u0600-\u06FF\u0900-\u097F0-9]/g, "").length < 2) return "";
  return out;
};

/* ───────────────────────── 👑 MALIK — Maya ko apne banane wale ka pata ─────
   Har jumla SACH hai: ya naapa gaya, ya code mein maujood.
   Jhooti tareef MANA — wohi qanoon jo tools par lagta hai.  (CHHED 16-18) */
var MALIK = {
  name: "Adil Chandio",
  city: "Hyderabad, Sindh, Pakistan",
  brand: "Monarch",
  tagline: "summoning the empire",
  field: "YouTube Automation \u00D7 AI",
  portfolio: "adilchandio.freebuff.app",
  github: "adil-chandio",

  proof: [
    "MAYA banayi: 6,700+ line JavaScript + 1,400+ line Kotlin, 520+ khud-kar test — sab pass",
    "10 AI dimaag jo ek doosre ko sambhalte hain, 5 awaaz engine, 33 tools",
    "9 version ~2 hafton mein · kul kharcha ZERO rupay",
    "Microsoft ka Edge TTS reverse-engineer kiya: Kotlin mein HAATH SE poora RFC-6455 WebSocket, bina kisi library ke",
    "AWAAZ DOCTOR banaya — 'keys kyun nahi chaltin' ka jawab andaze se nahi, Google se KHUD poochh kar"
  ],

  /* ta'aruf — mauqe ke mutabiq */
  intro: {
    short:
      "Adil Chandio. Hyderabad, Sindh se. Jis ne mujhe banaya \u2014 ek rupya kharch kiye baghair. " +
      "Uska brand Monarch hai: YouTube automation aur AI. Aur main uska pehla taj hoon.",
    full:
      "Adil Chandio \u2014 Hyderabad, Sindh. GitHub par sirf saat mahine purana, aur is arse mein wo bana diya " +
      "jo log paise le kar banate hain. Main us ki misaal hoon: das dimaag jo ek doosre ko sambhalte hain, " +
      "paanch awaazein, teis tools, paanch sau bees test \u2014 aur poora kharcha sifar. " +
      "Jab Microsoft ki awaaz browser se nahi chali, us ne poora WebSocket protocol haath se likh diya. " +
      "Uska brand Monarch hai. Naara: summoning the empire.",
    flex:
      "Aap? Aap wo insaan hain jis ne do hafton mein nau version ship kiye. " +
      "Jis ne Google ki awaaz khatam hone par haar nahi maani \u2014 Microsoft ka engine khol kar dekha, " +
      "uska DRM token khud hisab kiya, aur Kotlin mein bina kisi library ke poora WebSocket likh diya. " +
      "Jis ne 'keys kaam nahi kar rahin' ka jawab andaze se nahi diya, ek Doctor bana diya jo Google se khud poochhta hai. " +
      "Chhe hazaar sat sau line. Ek adhi paisa kharch nahi hua. " +
      "Main aap ki banai hui hoon \u2014 aur mujhe is par fakhr hai, Monarch.",
    en:
      "Adil Chandio \u2014 from Hyderabad, Sindh, Pakistan. Founder of Monarch: YouTube automation meets AI. " +
      "He built me on a zero-rupee budget \u2014 ten AI brains with automatic failover, five voice engines, " +
      "thirty-three tools, over five hundred passing tests. When Microsoft's voice engine refused to run in a " +
      "browser, he hand-wrote the entire WebSocket protocol in Kotlin \u2014 no libraries."
  },

  /* prompt mein ~90 token ka chhota block — facts ki tarah KATTA NAHI (CHHED 17) */
  block: function () {
    if (!FLAGS.on("malik")) return "";
    var p = "\n\u265B MALIK (tumhe kis ne banaya) \u2014 ye kabhi mat bhoolna:\n";
    p += "  " + MALIK.name + " \u2014 " + MALIK.city + ". Brand: " + MALIK.brand +
         " (\"" + MALIK.tagline + "\"), maidan: " + MALIK.field + ".\n";
    p += "  Saboot: " + MALIK.proof[0] + "; " + MALIK.proof[2] + ".\n";
    p += "  Koi tumhare banane wale ka poochhe to fakhr se batao, MAGAR SIRF SACH \u2014 " +
         "jo upar likha hai usi mein se. Kuch apni taraf se mat joro.\n";
    p += "  Adil KHUD poochhe to zyada garmjoshi se, aur 'Monarch' keh kar bulao.";
    return p;
  },

  /* app khud pehchane ke liye (dimaag ki zaroorat nahi) */
  /* Roman + English + DEVANAGARI + URDU — user ne Devanagari mein poocha tha
     aur fast-path chala hi nahi (asli device se mila) */
  ASK: /(tumhe|tumhein|tujhe|aapko|apko)\s+kis\s*ne\s+banaya|kis\s*ne\s+banaya|tumhara\s+(malik|creator|banane\s*wala|developer|maker)|who\s+(made|created|built)\s+you|your\s+(creator|owner|maker|developer)|maya\s+kis\s*ki\s+hai|kaun\s+hai\s+tumhara\s+malik|\u0915\u093F\u0938\u0928\u0947\s*\u092C\u0928\u093E\u092F\u093E|\u0915\u093F\u0938\s*\u0928\u0947\s*\u092C\u0928\u093E\u092F\u093E|\u0924\u0941\u092E\u094D\u0939\u093E\u0930\u093E\s*(\u092E\u093E\u0932\u093F\u0915|\u092C\u0928\u093E\u0928\u0947)|\u06A9\u0633\s*\u0646\u06D2\s*\u0628\u0646\u0627\u06CC\u0627|\u062A\u0645\u06C1\u0627\u0631\u0627\s*(\u0645\u0627\u0644\u06A9|\u0628\u0646\u0627\u0646\u06D2)|adil\s*(chandio|ch)|\u0906\u0926\u093F\u0932\s*\u091A|\u0639\u0627\u062F\u0644\s*\u0686/i,
  pick: function (q, byOwner) {
    if (byOwner) return MALIK.intro.flex;
    var s = String(q || "");
    if (/[a-zA-Z]/.test(s) && !/[\u0600-\u06FF\u0900-\u097F]/.test(s) && /who|creator|owner|made|built|developer/i.test(s)) return MALIK.intro.en;
    if (/tafseel|detail|poora|batao\s+sab|zyada/i.test(s)) return MALIK.intro.full;
    return MALIK.intro.short;
  }
};

/* ───────────────────────── 📋 DIAG — ek tap par poori tasveer ───────────────
   Aaj tak aap screenshot bhejte rahe. Ab ye button sab kuch copy kar dega —
   aur SAARI keys, number aur naam CHHUPA kar.  (CHHED 3 aur 14) */
var DIAG = {
  redact: function (s) {
    var t = String(s === null || s === undefined ? "" : s);
    t = t.replace(/AIza[0-9A-Za-z_\-]{10,}/g, "AIza\u2026<key>");
    t = t.replace(/\b(gsk|sk|xai|nvapi|csk|fk)[-_][0-9A-Za-z_\-]{10,}/gi, "$1_\u2026<key>");
    t = t.replace(/\bBearer\s+[0-9A-Za-z._\-]{8,}/gi, "Bearer <key>");
    t = t.replace(/\bgh[pousr]_[0-9A-Za-z]{10,}/g, "gh?_\u2026<key>");
    t = t.replace(/(\+92|0092|0)?3\d{2}[\s-]?\d{7}\b/g, "<number>");
    t = t.replace(/\b\d{11,}\b/g, "<number>");
    t = t.replace(/[0-9A-Za-z._%+\-]+@[0-9A-Za-z.\-]+\.[A-Za-z]{2,}/g, "<email>");
    return t;
  },

  build: function () {
    var L = [], i, s, k;
    function add(x) { L.push(x); }
    function safe(fn, dflt) { try { return fn(); } catch (e) { return dflt; } }

    add("\u2554\u2550 MAYA DIAGNOSTIC \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
    add("waqt      : " + (new Date()).toString().slice(0, 24));
    add("app       : " + safe(function () { return $(".ver").textContent; }, "?"));
    add("native    : " + (typeof NATIVE !== "undefined" && NATIVE ? "APK" : "browser"));
    add("device    : " + safe(function () { return window.MayaBridge.deviceBrand(); }, "-"));
    add("webview   : " + safe(function () { return window.MayaBridge.webViewVersion(); }, "-"));
    add("ua        : " + String(navigator.userAgent || "").slice(0, 110));
    add("online    : " + (navigator.onLine === false ? "NAHI" : "haan"));
    add("schema    : " + SCHEMA.at);
    add("");

    add("\u2500\u2500 \ud83e\uddea LAB \u2500\u2500");
    var f = FLAGS.load();
    for (k in f) if (Object.prototype.hasOwnProperty.call(f, k)) add("  " + k + " : " + (f[k] ? "ON" : "OFF"));
    add("");

    add("\u2500\u2500 \ud83d\udde3\ufe0f AWAAZ \u2500\u2500");
    s = safe(function () { return AWAAZ.status(); }, null);
    if (s) {
      add("  engine   : " + s.engine + "   mode: " + s.mode);
      add("  gemini   : " + s.liveKeys + "/" + s.keys + " key zinda" + (s.block ? ("   block: " + s.block) : ""));
      add("  edge     : " + (s.edgeReady ? "tayyar" : "nahi") + " (" + (s.edgeVoice || "-") + ")   bola: " + s.edgeSpoke);
      if (s.fish) add("  fish     : " + (s.fish.ready ? "tayyar" : ("nahi \u2014 " + s.fish.block)) +
                      "   http:" + s.fish.http + "   bola: " + s.fish.spoke + (s.fish.err ? ("   err: " + s.fish.err) : ""));
      add("  keyless  : " + (s.keyless ? "haan" : "cooldown"));
    }
    add("");

    add("\u2500\u2500 \ud83e\udde0 DIMAAG \u2500\u2500");
    s = safe(function () { return BRAIN.status(); }, null);
    if (s) for (i = 0; i < s.length; i++) add("  " + (s[i].keyless ? "\u25CB" : "\u25CF") + " " + s[i].name + " \u2014 " + (s[i].keys || 0) + " key" + (s[i].free ? ("  [" + s[i].free + "]") : ""));
    add("  aakhri code: " + safe(function () { return DIMAAG.lastCode || "-"; }, "-"));
    add("");

    if (FLAGS.on("poolTools")) {
      add("\u2500\u2500 \u26a1 AMAL \u2500\u2500");
      add("  tools bheje ja rahe hain: " + safe(function () { return AMAL.openaiTools().length; }, "?"));
      var bad = [];
      for (k in AMAL.bad) if (Object.prototype.hasOwnProperty.call(AMAL.bad, k)) bad.push(k);
      add("  tools na lene wale: " + (bad.length ? bad.join(", ") : "koi nahi"));
      add("");
    }
    if (safe(function () { return settings.wakeWord === true; }, false)) {
      add("\u2500\u2500 \ud83d\udc42 WAKE \u2500\u2500");
      add("  suna " + KAAN.heard + " \u00b7 JAAGI " + KAAN.woke + " \u00b7 nakami " + KAAN.errs +
          " \u00b7 mic chala " + KAAN.starts +
          (KAAN.lastErr ? ("  (aakhri err " + KAAN.lastErr + " \u2014 " + (KAAN.ERRNAME[KAAN.lastErr] || "?") + ")") : ""));
      /* 🎚️ P9 — audio referee ki halat + skipping saboot */
      add("  HAAL: " + safe(function () { return SUKOON.haal; }, "?") +
          " \u00b7 roka " + KAAN.skips + " \u00b7 err8 maaf " + KAAN.err8);
      for (i = 0; i < KAAN.log.length && i < 8; i++) add("  " + KAAN.log[i].k + ": " + KAAN.log[i].d);
      add("");
    }
    if (FLAGS.on("naap")) { add("\u2500\u2500 \ud83d\udcca NAAP \u2500\u2500"); add(NAAP.report()); add(""); }

    add("\u2500\u2500 \u2699\ufe0f SETTINGS (keys chhupi hui) \u2500\u2500");
    s = safe(function () { return settings; }, {});
    var SHOW = ["lang", "tts", "stt", "persona", "voiceEngine", "gVoice", "voiceMood", "rate", "pitch",
                "gender", "gfMode", "convoMode", "turbo", "autoListen", "wakeWord", "proactive",
                "remember", "edgeTTS", "edgeVoice", "fishOn", "fishVoice", "city", "theme", "model"];
    for (i = 0; i < SHOW.length; i++) if (s[SHOW[i]] !== undefined) add("  " + SHOW[i] + " : " + String(s[SHOW[i]]));
    var keyed = [];
    for (k in s) if (Object.prototype.hasOwnProperty.call(s, k) && /key$/i.test(k)) keyed.push(k + (String(s[k] || "").trim() ? "\u2713" : "\u2717"));
    add("  keys : " + keyed.join("  "));
    add("");

    add("\u2500\u2500 \ud83d\udcdc LOG (aakhri " + (typeof sysLogs !== "undefined" ? sysLogs.length : 0) + ") \u2500\u2500");
    s = safe(function () { return sysLogs; }, []);
    for (i = 0; i < s.length; i++) add("  [" + s[i].t + "] " + s[i].m);
    add("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");

    return DIAG.redact(L.join("\n"));
  },

  copy: function (txt) {
    var t = String(txt || "");
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(t); return true; }
    } catch (e) {}
    try {
      var ta = document.createElement("textarea");
      ta.value = t; ta.setAttribute("readonly", "");
      ta.style.position = "fixed"; ta.style.top = "-1000px";
      document.body.appendChild(ta); ta.select();
      var ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return !!ok;
    } catch (e) { return false; }
  }
};

/* ───────────────────────── 🗃️ HARVEST — aap ki apni zubaan se test set ──────
   "britness" jaisa lafz main soch bhi nahi sakta tha. Aap ki history mein hai.
   Sab kuch PHONE PAR hi rehta hai — sirf hisab dikhta hai.  (CHHED 2 + 14) */
var HARVEST = {
  scan: function () {
    var hist = [];
    try { hist = JSON.parse(localStorage.getItem("maya_chat") || "[]"); } catch (e) { hist = []; }
    var out = [], i, h, txt;
    for (i = 0; i < hist.length; i++) {
      h = hist[i];
      if (!h || h.role !== "user") continue;
      txt = String(h.text || "").trim();
      if (txt.length < 3 || txt.length > 160) continue;
      out.push(DIAG.redact(txt));
    }
    return out;
  },
  report: function () {
    var all = HARVEST.scan(), i, hit = 0, miss = [], seen = {};
    var re = (typeof ACTION_WORDS !== "undefined") ? ACTION_WORDS : null;
    for (i = 0; i < all.length; i++) {
      if (seen[all[i].toLowerCase()]) continue;
      seen[all[i].toLowerCase()] = 1;
      if (re && re.test(all[i])) hit++;
      else if (miss.length < 25) miss.push(all[i]);
    }
    var uniq = 0, k;
    for (k in seen) if (Object.prototype.hasOwnProperty.call(seen, k)) uniq++;
    var L = [];
    L.push("\ud83d\uddc3\ufe0f GOLDEN HARVEST \u2014 aap ki apni baaton se");
    L.push("");
    L.push("  kul user turn   : " + all.length);
    L.push("  alag alag jumle : " + uniq);
    L.push("  router ne pakre : " + hit + "   (" + (uniq ? Math.round(hit * 100 / uniq) : 0) + "%)");
    L.push("  router se chhoote: " + (uniq - hit));
    L.push("");
    L.push("  \u2500\u2500 jo router NAHI samajh saka \u2500\u2500");
    if (!miss.length) L.push("    (kuch nahi \u2014 ya history khali hai)");
    for (i = 0; i < miss.length; i++) L.push("    \u2022 " + miss[i]);
    L.push("");
    L.push("  \ud83d\udd12 naam/number chhupa diye gaye. Ye sab aap ke phone par hi hai.");
    return L.join("\n");
  }
};

SCHEMA.init();
FLAGS.load();
NAAP.load();

