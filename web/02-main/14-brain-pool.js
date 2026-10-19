/* ═══════════════════════════════════════════════════════════════════════════
   🧠🔥  BRAIN POOL v3  —  "quota khatam" ka mustaqil ilaj   (app v5.9.5)
   ---------------------------------------------------------------------------
   Kyun bana: ek ya do provider par tikna = unke quota ki qaid. v5.9.5 se pehle Groq
   ne 16 August 2026 ko apne purane Llama 3.x models band kar diye the — hamara
   default wahi tha, is liye "backup brain bhi thak gaya" aata tha.

   Ab MAYA ke paas 10 dimaag hain, teen tehon mein:
     TEH 1  KEYED   — Gemini, Groq, Cerebras, Mistral, OpenRouter, GitHub, NVIDIA, Z.ai
     TEH 2  KEYLESS — LLM7.io aur Pollinations: koi signup nahi, koi key nahi
     TEH 3  LOCAL   — waqt/tareekh/hisab/yaad-dasht

   Teen chaabiyan jo "unlimited" banati hain:
     1. HAR key field mein KAI keys daali ja sakti hain (comma ya nayi line se
        alag). 3 Gemini keys = 3 guna quota. Quota lagte hi agli key.
     2. Model auto-discovery — provider ka /models endpoint parh kar chalta hai,
        is liye koi model band ho jaye to app nahi marti (Groq wala hadsa dobara nahi).
     3. Keyless teh hamesha zinda — chahe koi key na ho, MAYA phir bhi sochti hai.

   Cooldown localStorage mein mehfooz hai, is liye app band kar ke kholne par
   bhi wo provider dobara nahi chhera jata jiska quota khatam hai.
   Tafseel: docs/BRAIN-POOL-ARCHITECTURE.md
   ═══════════════════════════════════════════════════════════════════════════ */

var BRAINS = [
  { id:"groq", name:"Groq", icon:"⚡", kind:"openai", keyField:"groqKey", pri:10, speed:"bijli",
    url:"https://api.groq.com/openai/v1/chat/completions",
    modelsUrl:"https://api.groq.com/openai/v1/models",
    models:["openai/gpt-oss-120b","qwen/qwen3.6-27b","moonshotai/kimi-k2-instruct","openai/gpt-oss-20b","groq/compound-mini"],
    free:"30/min · 1000/din har model", signup:"console.groq.com" },

  { id:"cerebras", name:"Cerebras", icon:"🚀", kind:"openai", keyField:"cerebrasKey", pri:12, speed:"bijli",
    url:"https://api.cerebras.ai/v1/chat/completions",
    modelsUrl:"https://api.cerebras.ai/v1/models",
    models:["gpt-oss-120b","llama-3.3-70b","qwen-3-235b-a22b-instruct-2507"],
    free:"~10 lakh token roz", signup:"cloud.cerebras.ai" },

  { id:"gemini", name:"Google Gemini", icon:"💎", kind:"gemini", keyField:"apikey", pri:5, tools:true, speed:"tez",
    free:"15/min · 250-1500/din", signup:"aistudio.google.com" },

  { id:"mistral", name:"Mistral", icon:"🇪🇺", kind:"openai", keyField:"mistralKey", pri:30,
    url:"https://api.mistral.ai/v1/chat/completions",
    modelsUrl:"https://api.mistral.ai/v1/models",
    models:["mistral-small-latest","mistral-medium-latest","open-mistral-nemo"],
    free:"~1 arab token mahina", signup:"console.mistral.ai" },

  { id:"openrouter", name:"OpenRouter", icon:"🔀", kind:"openai", keyField:"orKey", pri:40,
    url:"https://openrouter.ai/api/v1/chat/completions",
    models:["openai/gpt-oss-120b:free","deepseek/deepseek-chat-v3-0324:free","meta-llama/llama-4-scout:free","qwen/qwen3.6-plus:free"],
    free:"20/min · 50/din", signup:"openrouter.ai" },

  { id:"github", name:"GitHub Models", icon:"🐙", kind:"openai", keyField:"ghKey", pri:50,
    url:"https://models.github.ai/inference/chat/completions",
    models:["openai/gpt-4.1-mini","openai/gpt-4o-mini","openai/gpt-4.1"],
    free:"15/min · 150/din", signup:"github.com/settings/tokens" },

  { id:"nvidia", name:"NVIDIA NIM", icon:"🟩", kind:"openai", keyField:"nvidiaKey", pri:60,
    url:"https://integrate.api.nvidia.com/v1/chat/completions",
    modelsUrl:"https://integrate.api.nvidia.com/v1/models",
    models:["openai/gpt-oss-120b","meta/llama-3.3-70b-instruct","qwen/qwen2.5-72b-instruct"],
    free:"~40/min", signup:"build.nvidia.com" },

  { id:"zai", name:"Z.ai GLM", icon:"🇨🇳", kind:"openai", keyField:"zaiKey", pri:70,
    url:"https://api.z.ai/api/paas/v4/chat/completions",
    models:["glm-4.5-flash","glm-4-flash"],
    free:"GLM Flash muft", signup:"z.ai" },

  /* ── TEH 2: KEYLESS — koi signup nahi, hamesha zinda ── */
  { id:"llm7", name:"LLM7", icon:"🆓", kind:"openai", keyless:true, key:"unused", keyField:"llm7Key", pri:80,
    url:"https://api.llm7.io/v1/chat/completions",
    modelsUrl:"https://api.llm7.io/v1/models",
    models:["gpt-oss:20b","mistral-Nemo-Instruct-2407","deepseek-v3-0324","gpt-4o-mini"],
    free:"bina key 10/min · token se 120/min", signup:"token.llm7.io (marzi se)" },

  { id:"pollen", name:"Pollinations", icon:"🌸", kind:"openai", keyless:true, key:"", keyField:"pollenKey", pri:90,
    url:"https://text.pollinations.ai/openai",
    models:["openai","openai-fast","mistral"],
    free:"koi signup nahi, koi key nahi", signup:"—" }
];

var BRAIN = {
  VER: 3,
  state: {},          /* id|keyIdx -> { cool:ts, why:"" } ; localStorage mein mehfooz */
  models: {},         /* id -> auto-discover ki hui model list */
  lastUsed: "",
  reqSeq: 0,
  waiting: {},        /* bridge ke async jawab */

  /* ---------- mehfooz halat (app band ho kar khulne par bhi yaad) ---------- */
  load: function () {
    try {
      var raw = JSON.parse(localStorage.getItem("maya_brainpool") || "{}");
      if (raw && raw.state) BRAIN.state = raw.state;
      if (raw && raw.models) BRAIN.models = raw.models;
    } catch (e) {}
  },
  save: function () {
    try { localStorage.setItem("maya_brainpool", JSON.stringify({ state: BRAIN.state, models: BRAIN.models, ts: Date.now() })); } catch (e) {}
  },
  st: function (id, ki) {
    var k = id + "|" + (ki || 0);
    if (!BRAIN.state[k]) BRAIN.state[k] = { cool: 0, why: "" };
    return BRAIN.state[k];
  },
  chill: function (id, ki, ms, why) {
    var s = BRAIN.st(id, ki);
    s.cool = Date.now() + ms; s.why = why || "";
    BRAIN.save();
  },
  free: function (id, ki) { var s = BRAIN.st(id, ki); s.cool = 0; s.why = ""; BRAIN.save(); },
  cool: function (id, ki) { return Math.max(0, BRAIN.st(id, ki).cool - Date.now()); },

  byId: function (id) { for (var i = 0; i < BRAINS.length; i++) if (BRAINS[i].id === id) return BRAINS[i]; return null; },

  /* ---------- KAI KEYS: "a, b\nc" -> ["a","b","c"]  (yahi 3 guna quota deta hai) ---------- */
  keys: function (p) {
    if (p.keyless) return [p.key || ""];
    var raw = String((settings && settings[p.keyField]) || "");
    var parts = raw.split(/[\s,;]+/), out = [], i;
    for (i = 0; i < parts.length; i++) { var k = parts[i].trim(); if (k.length > 0) out.push(k); }
    return out;
  },

  /* ---------- kaun sa brain abhi tayyar hai ---------- */
  ready: function (p, ki) {
    if (navigator.onLine === false) return "OFFLINE";
    var ks = BRAIN.keys(p);
    if (!p.keyless && !ks.length) return "KEY_MISSING";
    if (BRAIN.cool(p.id, ki || 0) > 0) return BRAIN.st(p.id, ki || 0).why || "QUOTA";
    return "";
  },

  /* ---------- koshish ki tarteeb: har provider ki har key, behtareen pehle ---------- */
  plan: function (needTools) {
    var out = [], i, j;
    for (i = 0; i < BRAINS.length; i++) {
      var p = BRAINS[i], ks = BRAIN.keys(p);
      /* Gemini ka DIN ka quota khatam? Poora dimaag skip — warna har turn
         2-4 second zaya hote hain (asli device par p90 31s ka bara sabab) */
      if (p.kind === "gemini" && typeof DIMAAG === "object" && DIMAAG &&
          Date.now() < (DIMAAG.dayQuotaUntil || 0)) continue;
      for (j = 0; j < ks.length; j++) {
        if (BRAIN.ready(p, j)) continue;
        var pri = p.pri + j * 2;                                  /* pehli key ko tarjeeh */
        if (needTools && p.tools) pri -= 100;                      /* tool wala kaam Gemini ko */
        if (needTools && !p.tools) pri += 5;
        out.push({ p: p, ki: j, pri: pri });
      }
    }
    out.sort(function (a, b) { return a.pri - b.pri; });
    return out;
  },

  /* ---------- ek HTTP POST: APK mein bridge (CORS nahi, UI jam nahi), warna XHR ---------- */
  post: function (url, auth, payload, timeoutMs, cb) {
    var done = false;
    function finish(status, body) { if (done) return; done = true; cb(status, body); }

    if (typeof NATIVE !== "undefined" && NATIVE && window.MayaBridge && window.MayaBridge.httpPostAsync) {
      var id = "r" + (++BRAIN.reqSeq) + "_" + Date.now();
      BRAIN.waiting[id] = function (status, body) { delete BRAIN.waiting[id]; finish(status, body); };
      setTimeout(function () { if (BRAIN.waiting[id]) { delete BRAIN.waiting[id]; finish(0, "timeout"); } }, timeoutMs + 3000);
      try { window.MayaBridge.httpPostAsync(url, auth, payload, id, timeoutMs); }
      catch (e) { delete BRAIN.waiting[id]; finish(0, String(e && e.message || e)); }
      return;
    }
    var xhr = new XMLHttpRequest();
    try {
      xhr.open("POST", url, true);
      xhr.setRequestHeader("Content-Type", "application/json");
      if (auth) xhr.setRequestHeader("Authorization", auth);
      xhr.timeout = timeoutMs;
    } catch (e) { finish(0, "open fail"); return; }
    xhr.ontimeout = function () { finish(0, "timeout"); };
    xhr.onerror = function () { finish(0, "network"); };
    xhr.onload = function () { finish(xhr.status, xhr.responseText || ""); };
    try { xhr.send(payload); } catch (e) { finish(0, "send fail"); }
  },

  /* ---------- OpenAI-shakl provider se baat ---------- */
  /* kaunsa model kitna sochta hai */
  REASONER: /gpt-oss|qwen\s*3|qwen3|qwq|deepseek-?r1|r1-|reason|thinking|magistral|phi-?4-reason/i,
  budget: function (model) {
    return BRAIN.REASONER.test(String(model || "")) ? 1400 : 400;
  },

  ask: function (p, ki, msgs, cb, step) {
    step = step || 0;
    var keys = BRAIN.keys(p);
    var key = keys[ki] || "";
    var model = (BRAIN.models[p.id] && BRAIN.models[p.id][0]) || p.models[0];
    /* 🪙 TOKEN BUDGET (P1): reasoning models pehle SOCHTE hain. 320 mein unki
       soch hi khatam ho jati thi aur jawab kabhi aata hi nahi tha — screenshot
       wala 'band na hua <think>' isi ka natija tha. */
    var reqBody = {
      model: model, messages: msgs, temperature: 0.7, max_tokens: BRAIN.budget(model), stream: false
    };
    /* ⚡ P2a — ab is dimaag ko bhi TOOLS milte hain (pehle sirf Gemini ko milte the) */
    /* 🧭 kai-qadam wale hukm ("play store kholo AUR search karo") ke liye 4 qadam */
    var useTools = (typeof AMAL === "object" && AMAL && AMAL.poolOn(p) && step < 4);
    if (useTools) { reqBody.tools = AMAL.openaiTools(); reqBody.tool_choice = "auto"; }
    var payload = JSON.stringify(reqBody);
    var auth = key ? ("Bearer " + key) : "";
    DIMAAG.calls++;
    BRAIN.post(p.url, auth, payload, 22000, function (status, body) {
      var data = null;
      try { data = JSON.parse(body); } catch (e) {}
      if (status >= 200 && status < 300) {
        var out = null, m0 = null;
        try { m0 = data.choices[0].message; } catch (e) {}

        /* ⚡ P2a — dimaag ne tool maanga? Chalao aur nateeja wapas do */
        var tcalls = (m0 && m0.tool_calls && m0.tool_calls.length) ? m0.tool_calls : null;
        if (useTools && tcalls) {
          BRAIN.free(p.id, ki);
          geminiChat.toolsUsed = true;
          AMAL.runCalls(tcalls).then(function (results) {
            var next = msgs.slice(0);
            next.push({ role: "assistant", content: m0.content || "", tool_calls: tcalls });
            for (var z = 0; z < results.length; z++) next.push(results[z]);
            BRAIN.ask(p, ki, next, cb, step + 1);
          }, function () { cb("EMPTY"); });
          return;
        }

        try { out = m0.content; } catch (e) {}
        /* 🧹 andar ki soch yahin kaat do — khali bacha to AGLA DIMAAG (P1) */
        if (out && typeof SAAF !== "undefined") { var _c = SAAF.usable(out); if (SAAF.cut && FLAGS.on("saaf")) { try { NAAP.cur && (NAAP.cur.saafHit = SAAF.cut); } catch (e) {} } out = _c; }
        if (out && String(out).trim()) {
          BRAIN.free(p.id, ki);
          BRAIN.lastUsed = p.id;
          DIMAAG.ok(p.icon + " " + p.name);
          cb(null, String(out).trim());
          return;
        }
        DIMAAG.log(p.name, "EMPTY", model);
        cb("EMPTY"); return;
      }
      var msg = "";
      try { msg = String((data && (data.error && (data.error.message || data.error)) || data.message) || body).slice(0, 110); } catch (e) { msg = String(body).slice(0, 110); }
      var code = DIMAAG.classify(status, { error: { message: msg, code: status } });

      /* 402 = ab paisa maang raha hai (Cerebras ne asli device par diya).
         Ye ek minute mein theek nahi hoga — 6 ghante ke liye so jao. */
      if (status === 402) {
        BRAIN.chill(p.id, ki, 21600000, "PAID");
        DIMAAG.log(p.name, "PAID", msg.slice(0, 60));
        cb("PAID"); return;
      }

      /* ⚡ P2a — is provider ne `tools` qubool nahi kiya? Bina tools DOBARA
         koshish karo, aur aage ke liye yaad rakh lo. Dimaag marna nahi chahiye. */
      if (useTools && (status === 400 || status === 422) ) {
        AMAL.markBad(p.id, msg);
        BRAIN.ask(p, ki, msgs, cb, 9);          /* step 9 = tools band */
        return;
      }

      /* model band ho gaya? list dobara nikaalo — Groq wala hadsa dobara na ho */
      if ((code === "MODEL_404" || code === "BAD_REQUEST") && /model|decommission|deprecat|not found|does not exist/i.test(msg)) {
        DIMAAG.log(p.name, "MODEL", model + " → " + msg.slice(0, 50));
        BRAIN.dropModel(p, model);
        BRAIN.discover(p, key);
        cb("MODEL"); return;
      }
      if (code === "QUOTA") { BRAIN.chill(p.id, ki, DIMAAG.isDayQuota(data || {}) ? 3600000 : 90000, "QUOTA"); }
      else if (code === "KEY_BAD") { BRAIN.chill(p.id, ki, 1800000, "KEY_BAD"); }
      else if (code === "SERVER") { BRAIN.chill(p.id, ki, 120000, "SERVER"); }
      DIMAAG.log(p.name + (keys.length > 1 ? " key" + (ki + 1) : ""), code, msg);
      cb(code);
    });
  },

  /* ---------- mara hua model list se nikaalo ---------- */
  dropModel: function (p, model) {
    var list = BRAIN.models[p.id] || p.models.slice(0);
    var out = [], i;
    for (i = 0; i < list.length; i++) if (list[i] !== model) out.push(list[i]);
    if (!out.length) out = p.models.slice(0);
    BRAIN.models[p.id] = out;
    BRAIN.save();
  },

  /* ---------- /models se zinda models ka pata (deprecation-proof) ---------- */
  discover: function (p, key) {
    if (!p.modelsUrl || BRAIN.discover._busy === p.id) return;
    BRAIN.discover._busy = p.id;
    var xhr = new XMLHttpRequest();
    var useBridge = (typeof NATIVE !== "undefined" && NATIVE && window.MayaBridge && window.MayaBridge.httpGet);
    function handle(txt) {
      BRAIN.discover._busy = "";
      var j = null;
      try { j = JSON.parse(txt); } catch (e) { return; }
      var arr = (j && (j.data || j.models)) || [];
      var ids = [], i;
      for (i = 0; i < arr.length; i++) { var id = arr[i].id || arr[i].name; if (id) ids.push(String(id).replace(/^models\//, "")); }
      if (!ids.length) return;
      /* pehle wo jo hamari pasandeeda list mein hain, phir baqi */
      var pick = [], j2;
      for (i = 0; i < p.models.length; i++) for (j2 = 0; j2 < ids.length; j2++) if (ids[j2] === p.models[i]) pick.push(ids[j2]);
      for (i = 0; i < ids.length && pick.length < 6; i++) if (pick.indexOf(ids[i]) < 0 && !/whisper|tts|embed|guard|image|vision|rerank/i.test(ids[i])) pick.push(ids[i]);
      if (pick.length) { BRAIN.models[p.id] = pick; BRAIN.save(); pushLog("BRAIN " + p.name + ": " + pick.length + " zinda models mile"); }
    }
    if (useBridge) {
      try { handle(window.MayaBridge.httpGet(p.modelsUrl, key ? "Bearer " + key : "")); } catch (e) { BRAIN.discover._busy = ""; }
      return;
    }
    try {
      xhr.open("GET", p.modelsUrl, true);
      if (key) xhr.setRequestHeader("Authorization", "Bearer " + key);
      xhr.timeout = 10000;
      xhr.onload = function () { handle(xhr.responseText || ""); };
      xhr.onerror = function () { BRAIN.discover._busy = ""; };
      xhr.ontimeout = function () { BRAIN.discover._busy = ""; };
      xhr.send();
    } catch (e) { BRAIN.discover._busy = ""; }
  },

  /* ---------- Settings/Doctor ke liye poori tasveer ---------- */
  status: function () {
    var out = [], i, j;
    for (i = 0; i < BRAINS.length; i++) {
      var p = BRAINS[i], ks = BRAIN.keys(p), rows = [];
      if (!ks.length) rows.push({ ki: 0, state: "NO_KEY", cool: 0 });
      for (j = 0; j < ks.length; j++) {
        var c = BRAIN.cool(p.id, j);
        rows.push({ ki: j, state: c > 0 ? (BRAIN.st(p.id, j).why || "COOL") : "LIVE", cool: Math.round(c / 1000) });
      }
      out.push({ id: p.id, name: p.name, icon: p.icon, keyless: !!p.keyless, keys: ks.length, free: p.free, signup: p.signup, rows: rows });
    }
    return out;
  },
  liveCount: function () {
    var n = 0, i, j;
    for (i = 0; i < BRAINS.length; i++) {
      var ks = BRAIN.keys(BRAINS[i]);
      for (j = 0; j < ks.length; j++) if (!BRAIN.ready(BRAINS[i], j)) n++;
    }
    return n;
  }
};
BRAIN.load();

/* bridge ka async jawab yahan aata hai (base64 → text) */
window.__httpDone = function (id, status, b64) {
  var cb = BRAIN.waiting[id];
  if (!cb) return;
  var txt = "";
  try { txt = decodeURIComponent(escape(atob(String(b64 || "")))); }
  catch (e) { try { txt = atob(String(b64 || "")); } catch (e2) { txt = ""; } }
  cb(status, txt);
};

