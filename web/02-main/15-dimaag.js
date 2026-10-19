/* ═══════════════════════════════════════════════════════════════════════════
   🧠  DIMAAG ENGINE v2  —  MAYA ka sochne ka wahid rasta   (app v5.9.5)
   ---------------------------------------------------------------------------
   Purane code ke 3 asli bugs jinki wajah se "Sab free brains busy" bar bar aata tha:

   B1  HTTP 400 ko "key ka masla" samjha jata tha -> geminiBadUntil = +10 MINUTE.
       400 asal mein aksar KHARAB REQUEST hoti hai (history ka pehla turn "model"
       ho, ya tool schema). Yaani ek ghalat request poore Gemini ko 10 minute ke
       liye band kar deti thi. Groq key na ho to seedha "sab busy".

   B2  chatHist.slice(-8) ka pehla turn "model" ho sakta hai. Gemini multi-turn
       history "user" se shuru maangta hai -> 400 -> (B1 ki wajah se) blackout.
       Char baat-cheet ke baad ye HAR DAFA hota tha. Yahi "bar bar" ki wajah.

   B3  resolveModels() 5 model deta tha aur har ek par poori koshish hoti thi ->
       ek sawal = 5 requests -> free quota 5 guna tez khatam.

   Ab: har koshish ka record, har nakami ka naam, 400 par khud-marammat (history
   saaf kar ke bina tools dobara), quota-samajh cooldown, aur aakhir mein bhi
   kuch na kuch kaam ka jawab. Tafseel: docs/DIMAAG-ENGINE-ARCHITECTURE.md
   ═══════════════════════════════════════════════════════════════════════════ */

var DIMAAG = {
  VER: 2,
  report: [],          /* aakhri sawal ki har koshish: {who, code, info, ms} */
  provider: "—",       /* aakhri kamyab dimaag */
  lastOk: 0,           /* kab aakhri asli jawab aaya */
  lastCode: "",        /* aakhri nakami ka code */
  keyBadUntil: 0,      /* sirf ASLI key masle par */
  dayQuotaUntil: 0,    /* per-day quota khatam */
  historySuspect: false,
  fixes: 0,            /* kitni dafa khud marammat ki */
  calls: 0,

  WHY: {
    KEY_MISSING: "Koi AI key nahi hai",
    KEY_BAD: "Gemini key ghalat ya band hai",
    QUOTA: "Free quota abhi khatam hai",
    QUOTA_DAY: "Aaj ka free quota khatam ho gaya",
    BAD_REQUEST: "Request kharab thi (chat history ya tools)",
    MODEL_404: "Ye model is key par nahi milta",
    SERVER: "Google/provider ka server abhi kharab hai",
    NETWORK: "Internet tak baat nahi pahunchi",
    TIMEOUT: "Jawab waqt par nahi aaya",
    OFFLINE: "Phone offline hai",
    EMPTY: "Jawab khali aaya"
  },
  why: function (c) { return DIMAAG.WHY[c] || (c ? ("Error: " + c) : ""); },

  reset: function () { DIMAAG.report = []; },
  log: function (who, code, info) {
    DIMAAG.report.push({ who: who, code: code || "OK", info: info || "" });
    if (DIMAAG.report.length > 12) DIMAAG.report.shift();
    if (code) DIMAAG.lastCode = code;
    try { pushLog("BRAIN " + who + ": " + (code || "OK") + (info ? " (" + info + ")" : "")); } catch (e) {}
  },
  ok: function (who) {
    DIMAAG.provider = who; DIMAAG.lastOk = Date.now(); DIMAAG.lastCode = "";
    DIMAAG.report.push({ who: who, code: "OK", info: "" });
    try { aiState.provider = who; } catch (e) {}
  },

  /* ── HTTP jawab ka sahi tashkhees (B1 ka ilaj) ── */
  classify: function (status, data) {
    var err = (data && data.error) || {};
    var msg = String(err.message || "");
    var st = String(err.status || "");
    if (status === 401 || st === "UNAUTHENTICATED") return "KEY_BAD";
    if (/api[ _-]?key not valid|api_key_invalid|invalid api key|api key expired/i.test(msg)) return "KEY_BAD";
    if (status === 403 || st === "PERMISSION_DENIED") return /quota|billing|exhaust/i.test(msg) ? "QUOTA" : "KEY_BAD";
    if (status === 429 || st === "RESOURCE_EXHAUSTED") return "QUOTA";
    if (status === 404 || st === "NOT_FOUND") return "MODEL_404";
    if (status === 400) return /api[ _-]?key/i.test(msg) ? "KEY_BAD" : "BAD_REQUEST";
    if (status >= 500) return "SERVER";
    if (!status) return "NETWORK";
    return "HTTP_" + status;
  },

  /* Google jo intezaar maangta hai wohi karo (andaza nahi) */
  retryDelay: function (data) {
    try {
      var d = (data.error && data.error.details) || [];
      for (var i = 0; i < d.length; i++) {
        var m = /(\d+(?:\.\d+)?)s/.exec(String(d[i].retryDelay || ""));
        if (m) return Math.ceil(parseFloat(m[1])) * 1000;
      }
    } catch (e) {}
    var s = JSON.stringify(data || {});
    var m2 = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(s);
    return m2 ? Math.ceil(parseFloat(m2[1])) * 1000 : 0;
  },
  isDayQuota: function (data) {
    return /PerDay|per day|GenerateRequestsPerDay|daily limit/i.test(JSON.stringify(data || {}));
  },

  /* ── History ki safai (B2 ka ilaj) ──
     Gemini multi-turn history "user" se shuru aur "user" par khatam maangta hai. */
  contents: function (limit) {
    var h = chatHist.slice(-(limit || 8)), i;
    while (h.length && h[0].role !== "user") h.shift();          /* pehla turn hamesha user */
    var out = [], prev = null;
    for (i = 0; i < h.length; i++) {
      var t = String(h[i].text || "").trim();
      if (!t) continue;
      var role = h[i].role === "model" ? "model" : "user";
      if (prev && prev.role === role) { prev.parts[0].text += "\n" + t; continue; }  /* lagatar same role merge */
      prev = { role: role, parts: [{ text: t }] };
      out.push(prev);
    }
    while (out.length && out[out.length - 1].role !== "user") out.pop();  /* aakhri turn user */
    if (!out.length) {
      var lu = DIMAAG.lastUser();
      if (lu) out.push({ role: "user", parts: [{ text: lu }] });
    }
    return out;
  },
  /* OpenAI-shakl messages (poore pool ke liye ek hi jagah bante hain) */
  msgs: function (needTools) {
    var sys = sysPrompt();
    if (needTools) sys += " NOTE: Is waqt phone ke tools available nahi — phone ke kaam (app kholna, alarm, timer, call) app khud handle karta hai. Aap sirf baat-cheet aur maloomat ka jawab do, chhota aur kaam ka.";
    var out = [{ role: "system", content: sys }];
    var c = DIMAAG.contents(8), i;
    for (i = 0; i < c.length; i++) out.push({ role: c[i].role === "model" ? "assistant" : "user", content: c[i].parts[0].text });
    return out;
  },

  lastUser: function () {
    for (var i = chatHist.length - 1; i >= 0; i--) if (chatHist[i].role === "user") return chatHist[i].text;
    return "";
  },

  /* ── Kya abhi neural dimaag try karna banta hai? ── */
  geminiReady: function () {
    if (!settings.apikey) return "KEY_MISSING";
    if (navigator.onLine === false) return "OFFLINE";
    if (Date.now() < DIMAAG.keyBadUntil) return "KEY_BAD";
    if (Date.now() < DIMAAG.dayQuotaUntil) return "QUOTA_DAY";
    return "";
  },

  /* ── Header pill ka SACH (I4 ka ilaj — ab sirf navigator.onLine nahi) ── */
  pill: function () {
    if (navigator.onLine === false) return "OFFLINE";
    if (Date.now() < DIMAAG.keyBadUntil) return "KEY MASLA";
    if (Date.now() < DIMAAG.dayQuotaUntil) return "QUOTA KHATAM";
    if (DIMAAG.lastOk && Date.now() - DIMAAG.lastOk < 900000) return "AI ONLINE • " + DIMAAG.provider;
    if (DIMAAG.lastCode === "QUOTA") return "AI BUSY";
    if (DIMAAG.lastCode) return "AI: " + DIMAAG.lastCode;
    var live = BRAIN.liveCount();
    if (live === 0) return "SAB THAKE";
    return "AI READY • " + live + " DIMAAG";
  },

  /* ── Sab fail? Phir bhi kuch kaam ka jawab (khali haath nahi bhejte) ── */
  localAnswer: function (q) {
    var t = String(q || "").toLowerCase();
    try {
      if (/(waqt|time|kitne baje|baj)/.test(t)) return "Abhi " + new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) + " baj rahe hain, " + settings.name + ".";
      if (/(tareekh|date|aaj kaun|kaun sa din|today)/.test(t)) return "Aaj " + new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) + " hai.";
      var mm = t.replace(/[^0-9+\-*/(). ]/g, "").trim();
      if (/^[0-9][0-9+\-*/(). ]{2,}$/.test(mm) && /[+\-*/]/.test(mm)) {
        var v = Function('"use strict";return (' + mm + ')')();
        if (typeof v === "number" && isFinite(v)) return "Jawab: " + (Math.round(v * 1e6) / 1e6);
      }
      if (typeof facts !== "undefined" && facts.length) {
        var words = t.split(/\s+/).filter(function (w) { return w.length > 3; });
        for (var i = 0; i < facts.length; i++) {
          var f = String(facts[i]).toLowerCase();
          for (var j = 0; j < words.length; j++) if (f.indexOf(words[j]) >= 0)
            return "Mujhe itna yaad hai, " + settings.name + ": " + facts[i];
        }
      }
    } catch (e) {}
    return null;
  },

  /* ── Nakami ka insani jawab + agla qadam (ek jumla 5 wajahon ke liye NAHI) ── */
  failMessage: function () {
    var n = settings.name;
    var code = DIMAAG.lastCode;
    var hasBackup = !!(settings.groqKey || settings.ghKey);
    if (navigator.onLine === false)
      return "Internet nahi hai, " + n + ". Local commands chal rahe hain — waqt, battery, alarm, timer, app kholna. Net aate hi main wapas.";
    if (code === "KEY_MISSING")
      return "Mere sab " + BRAINS.length + " dimaag abhi band hain, " + n + ". Settings (⚙️) → API KEYS mein koi bhi FREE key daal do — Groq (console.groq.com) sab se tez hai, Cerebras roz 10 lakh token deta hai. Ek key = poora dimaag wapas.";
    if (code === "KEY_BAD")
      return "Gemini key kaam nahi kar rahi, " + n + ". aistudio.google.com se nayi FREE key banao aur Settings → API KEYS mein paste kar do." + (hasBackup ? " Backup brain bhi jawab nahi de raha." : " Ya phir Groq ki free key daal do — wo backup ban jayegi.");
    if (code === "QUOTA_DAY")
      return "Aaj ke liye mere " + BRAIN.liveCount() + " zinda dimaagon ka quota khatam, " + n + ". Do minute ka pakka ilaj: Settings → API KEYS mein Cerebras (cloud.cerebras.ai — roz 10 LAKH token) ya Mistral (console.mistral.ai — mahina 1 ARAB token) ki free key daal do. Ya kisi bhi key ke saamne comma laga kar DOOSRI key daal do — quota dugna ho jata hai.";
    if (code === "QUOTA")
      return "Free quota ek minute ke liye bhar gaya hai, " + n + ". Main khud dobara koshish kar rahi hoon — ya " + (hasBackup ? "backup brain" : "Groq ki free key") + " se foran jawab mil jayega.";
    if (code === "SERVER")
      return "Google ka server abhi kharab hai, " + n + " — meri ya aapki koi ghalti nahi. Thori der mein theek ho jayega.";
    if (code === "BAD_REQUEST")
      return "Meri request mein kharabi thi, " + n + ". Maine history saaf kar ke dobara koshish ki phir bhi nahi bani — Settings → CHAT HISTORY CLEAR se poori history reset kar do, foran theek ho jayega.";
    if (code === "NETWORK" || code === "TIMEOUT")
      return "Network tak baat nahi pahunchi, " + n + ". Signal check karo — local commands chal rahe hain.";
    return "Abhi koi dimaag jawab nahi de paya, " + n + " (" + (DIMAAG.why(code) || "wajah maloom nahi") + "). Settings → DOCTOR mein poori tafseel hai. Local commands chal rahe hain: waqt, battery, alarm, timer, app kholna.";
  },

  /* ── Kai providers ki nakami mein se ASAL masla chuno.
        (warna "Groq key nahi hai" jaisi mamooli baat asli SERVER/QUOTA masle ko dhak deti hai) ── */
  RANK: ["QUOTA_DAY", "KEY_BAD", "QUOTA", "SERVER", "BAD_REQUEST", "MODEL_404", "TIMEOUT", "NETWORK", "EMPTY", "OFFLINE", "KEY_MISSING"],
  verdict: function () {
    var have = {}, i;
    for (i = 0; i < DIMAAG.report.length; i++) if (DIMAAG.report[i].code && DIMAAG.report[i].code !== "OK") have[DIMAAG.report[i].code] = 1;
    for (i = 0; i < DIMAAG.RANK.length; i++) if (have[DIMAAG.RANK[i]]) return DIMAAG.RANK[i];
    for (i = 0; i < DIMAAG.report.length; i++) if (DIMAAG.report[i].code !== "OK") return DIMAAG.report[i].code;
    return "";
  },

  /* ── Doctor ke liye poora record ── */
  lines: function () {
    var out = ["── DIMAAG ENGINE v" + DIMAAG.VER + " ──"];
    out.push("AAKHRI DIMAAG: " + DIMAAG.provider + (DIMAAG.lastOk ? "  (" + Math.round((Date.now() - DIMAAG.lastOk) / 1000) + "s pehle)" : "  (abhi tak koi jawab nahi)"));
    out.push("HALAT: " + DIMAAG.pill());
    if (DIMAAG.lastCode) out.push("AAKHRI MASLA: " + DIMAAG.lastCode + " — " + DIMAAG.why(DIMAAG.lastCode));
    if (Date.now() < DIMAAG.keyBadUntil) out.push("KEY BLACKOUT: " + Math.round((DIMAAG.keyBadUntil - Date.now()) / 1000) + "s");
    if (Date.now() < DIMAAG.dayQuotaUntil) out.push("DAY QUOTA: " + Math.round((DIMAAG.dayQuotaUntil - Date.now()) / 60000) + " min");
    out.push("KHUD-MARAMMAT: " + DIMAAG.fixes + " dafa" + (DIMAAG.historySuspect ? "  (history shak ke daere mein)" : ""));
    out.push("KUL CALLS: " + DIMAAG.calls);
    if (DIMAAG.report.length) {
      out.push("AAKHRI SAWAL KI KOSHISHEN:");
      for (var i = 0; i < DIMAAG.report.length; i++) {
        var r = DIMAAG.report[i];
        out.push("  " + (r.code === "OK" ? "✅" : "❌") + " " + r.who + ": " + r.code + (r.info ? " — " + r.info : ""));
      }
    }
    return out;
  }
};

/* --- Provider 1: Gemini pool (tools ke saath) --- */
async function geminiChat(){
  var gate = DIMAAG.geminiReady();
  if (gate) { DIMAAG.log("GEMINI", gate); return null; }

  /* B3: 5 nahi, sirf 2 model — ek sawal par quota 5 guna zaya nahi hota */
  var all = await resolveModels();
  var models = all.slice(0, 2);
  var quotaHit = false;

  for (var i = 0; i < models.length; i++) {
    var m = models[i];
    if (Date.now() < (modelCooldowns[m] || 0)) { DIMAAG.log("GEMINI/" + m, "QUOTA", "cooldown"); continue; }
    var got = await geminiTry(m, false);
    if (got && got.text) { DIMAAG.ok("GEMINI"); return got.text; }
    var code = got ? got.code : "EMPTY";

    /* B1+B2 ka ilaj: 400 par KEY blackout NAHI — history saaf kar ke bina tools dobara */
    if (code === "BAD_REQUEST") {
      DIMAAG.historySuspect = true;
      var fixed = await geminiTry(m, true);          /* sirf aakhri sawal, koi tool nahi */
      if (fixed && fixed.text) {
        DIMAAG.fixes++;
        DIMAAG.log("GEMINI/" + m, null, "khud marammat: history saaf kar ke chal gaya");
        DIMAAG.ok("GEMINI");
        return fixed.text;
      }
      DIMAAG.log("GEMINI/" + m, (fixed && fixed.code) || "BAD_REQUEST", "marammat bhi nahi chali");
      continue;
    }
    if (code === "KEY_BAD") { DIMAAG.keyBadUntil = Date.now() + 600000; geminiChat.keyErr = true; return null; }
    if (code === "QUOTA") { quotaHit = true; if (got.dayQuota) { DIMAAG.dayQuotaUntil = Date.now() + 3600000; DIMAAG.lastCode = "QUOTA_DAY"; return null; } continue; }
    if (code === "MODEL_404") { if (!geminiChat._r404) { geminiChat._r404 = true; MODEL_CACHE = null; saveModelCache(); return await geminiChat(); } continue; }
  }
  geminiChat._r404 = false;
  if (quotaHit) DIMAAG.lastCode = "QUOTA";
  return null;
}
geminiChat.keyErr = false;

/* Ek model par ek koshish. plain = true -> koi tool nahi, sirf aakhri sawal. */
async function geminiTry(m, plain){
  var url = "https://generativelanguage.googleapis.com/v1beta/models/" + m + ":generateContent?key=" + encodeURIComponent(settings.apikey);
  var contents = plain ? [{ role: "user", parts: [{ text: DIMAAG.lastUser() }] }] : DIMAAG.contents(8);
  if (!contents.length) return { code: "BAD_REQUEST", info: "khali history" };
  /* 🧭 kai-qadam wale hukm ("play store kholo AUR search karo") — 2 se 4 qadam */
  var maxSteps = (_activeSkill && _activeSkill.deep) ? 5 : (FLAGS.on("sach") ? 4 : 2);

  for (var step = 0; step < maxSteps + 1; step++) {
    var body = {
      systemInstruction: { parts: [{ text: sysPrompt() }] },
      contents: contents,
      generationConfig: { temperature: 0.7, maxOutputTokens: 280 }
    };
    if (/2\.5|gemini-3/.test(m)) body.generationConfig.thinkingConfig = { thinkingBudget: 0 };
    if (!plain && step < maxSteps) body.tools = [{ functionDeclarations: TOOL_DECLS }];

    var res, data = {};
    DIMAAG.calls++;
    try {
      res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    } catch (e) { DIMAAG.log("GEMINI/" + m, "NETWORK", String(e && e.message || e).slice(0, 60)); return { code: "NETWORK" }; }
    try { data = await res.json(); } catch (e) { data = {}; }

    if (!res.ok) {
      var code = DIMAAG.classify(res.status, data);
      var info = String((data.error && data.error.message) || "").slice(0, 90);
      if (code === "QUOTA") {
        var d = DIMAAG.retryDelay(data) || 50000;
        modelCooldowns[m] = Date.now() + d;
        lastRetryDelay = d;
        DIMAAG.log("GEMINI/" + m, "QUOTA", Math.round(d / 1000) + "s" + (DIMAAG.isDayQuota(data) ? " · PER-DAY" : ""));
        return { code: "QUOTA", dayQuota: DIMAAG.isDayQuota(data) };
      }
      DIMAAG.log("GEMINI/" + m, code, info);
      return { code: code, info: info };
    }

    var cand = data.candidates && data.candidates[0];
    var parts = (cand && cand.content && cand.content.parts) || [];
    var fnCalls = parts.filter(function (p) { return p.functionCall; });
    if (fnCalls.length && step < maxSteps) {
      geminiChat.toolsUsed = true;
      contents.push({ role: "model", parts: parts });
      for (var fc = 0; fc < fnCalls.length; fc++) {
        var name = fnCalls[fc].functionCall.name;
        pushLog("AI TOOL: " + name);
        try { NAAP.mark("tool"); NAAP.cur && (NAAP.cur.tool = name); } catch (e) {}   /* 📊 P0 */
        var result;
        try { result = await execTool(name, fnCalls[fc].functionCall.args || {}); }
        catch (e) { result = { error: String(e && e.message || e) }; }
        contents.push({ role: "user", parts: [{ functionResponse: { name: name, response: result } }] });
      }
      continue;
    }
    var out = parts.map(function (p) { return p.text || ""; }).join("").trim();
    if (out && typeof SAAF !== "undefined") out = SAAF.usable(out);      /* 🧹 P1 */
    if (out) return { text: out };
    /* khali jawab: aksar MAX_TOKENS soch mein khatam — thora sa aur maango */
    var fr = String((cand && cand.finishReason) || "");
    DIMAAG.log("GEMINI/" + m, "EMPTY", fr || "no parts");
    return { code: "EMPTY", info: fr };
  }
  return { code: "EMPTY", info: "steps khatam" };
}

