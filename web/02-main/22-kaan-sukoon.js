/* ---------- WAKE WORD ('Maya' / 'Boss') ---------- */
/* ═══════════════════════════════════════════════════════════════════════════
   👂  KAAN  —  wake word ka asal ilaj                          (v5.9.5)
   ---------------------------------------------------------------------------
   User: "background mein mic on/off hota hai, magar 'Maya' bolne par kuch
          nahi hota."

   SAAT bug the — aur sab se bara ye ke HUM ANDHE THE: service kabhi nahi
   batati thi ke usne KYA SUNA ya KYA ERROR aaya.

     1. koi diagnostics nahi                  -> ab har cheez darj hoti hai
     2. Kotlin ka `isWake` bana kar CHHOR      -> ab faisla YAHAN hota hai
        diya jata tha (dead variable)
     3. Urdu ka check "\\u0645..." literal      -> ab asli harf
        matn tha, kabhi match hi nahi hota
     4. MAX_RESULTS = 1                        -> 6 (SUNO ka sabaq)
     5. zubaan "en-IN" hard-code               -> settings se
     6. NO_MATCH par 250ms mein restart ->     -> backoff 0.7s se 3.5s
        Android background mic ko throttle
        kar deta hai (yehi "on/off" ki wajah)
     7. matching bohat sakht                   -> fuzzy + kai shaklein

   Ab Kotlin BEWAQOOF hai (sirf report karta hai) aur faisla YAHAN hota hai —
   yani aage tuning ke liye NAYI APK nahi banani paregi.
   ═══════════════════════════════════════════════════════════════════════════ */
/* ═══════════ 🎚️ SUKOON (P9) — audio referee: ek waqt mein EK cheez ═══════════
   Char jang-boot jo ye sulhaata hai:
   (1) mic khulte hi Android AUDIO FOCUS le leta hai -> Maya ki awaaz KAT-ti
       thi (greeting "MAYA onl—" wala masla). Kotlin ko pata hi nahi tha ke
       Maya bol rahi hai (speaking flag sirf JS mein tha).
   (2) wake service ka aur tap-to-speak ka SpeechRecognizer LADTE the —
       mic ek waqt mein ek hi hota hai -> mic on/off strobe.
   (3) wohi jang error 8 (RECOGNIZER_BUSY) deti thi -> service khud ko maar
       kar AAP KA WAKE SWITCH bhi mita deti thi. Ab err8 = sirf 2s sukoon.
   (4) speaker se Maya ki awaaz VAD ko lagti -> self-wake loop ka khatra.
   Hal: HAAL — KHALI / BOL_RAHI / APP_SUN — bridge se Kotlin tak, aur
   Kotlin ka mic HAAR darwaze par pehle HAAL poochhta hai (restart,
   actuallyStart, VAD gate, watchdog). */
var SUKOON = {
  haal: "KHALI",
  tailMs: 550,          /* echo tail — WakeWordService.ECHO_TAIL_MS se match */
  _tailT: null,
  _bolT: null,         /* wake-regression: max-speech watchdog (45s) */
  _native: function (h) {
    try { if (window.MayaBridge && window.MayaBridge.setHaal) window.MayaBridge.setHaal(h); } catch (e) {}
    try { if (typeof KAAN !== "undefined" && KAAN.push) KAAN.push("haal", h); } catch (e) {}
  },
  set: function (h) {
    if (SUKOON.haal === h) return;
    SUKOON.haal = h;
    SUKOON._native(h);
  },
  /* Aawaaz SHURU — fetch ki 1-2 second bhi cover (waise mic kaat sakta hai) */
  bolStart: function () {
    if (SUKOON._tailT) { clearTimeout(SUKOON._tailT); SUKOON._tailT = null; }
    SUKOON.set("BOL_RAHI");
    /* wake-regression: agar __nativeTtsDone kabhi na aaye (Edge TTS switch
       / WebView juggling / callback lost) to BOL_RAHI HAMESHA ke liye atak
       jata tha -> Kotlin har mic-darwaza band. 45s se lambi sachi speech
       kabhi nahi hoti — watchdog sirf atka hua state torta hai. */
    if (SUKOON._bolT) { clearTimeout(SUKOON._bolT); SUKOON._bolT = null; }
    SUKOON._bolT = setTimeout(function () {
      if (SUKOON.haal === "BOL_RAHI") {
        try { pushLog("SUKOON: TTS watchdog — 45s BOL_RAHI atka tha, khud azad"); } catch (e) {}
        try { if (typeof speaking !== "undefined") speaking = false; } catch (e) {}
        SUKOON.bolEnd();
      }
    }, 45000);
  },
  /* Aawaaz khatam — speaker ki goonj ka 550ms tail, phir KHALI.
     Magar isi dauran mic khul gaya ho to haath mat ghumao. */
  bolEnd: function () {
    if (SUKOON._bolT) { clearTimeout(SUKOON._bolT); SUKOON._bolT = null; }
    try { if (typeof speaking !== "undefined") speaking = false; } catch (e) {}
    if (SUKOON._tailT) clearTimeout(SUKOON._tailT);
    SUKOON._tailT = setTimeout(function () {
      if (SUKOON.haal === "BOL_RAHI") SUKOON.set("KHALI");
    }, SUKOON.tailMs);
  },
  sunStart: function () {
    if (SUKOON._tailT) { clearTimeout(SUKOON._tailT); SUKOON._tailT = null; }
    SUKOON.set("APP_SUN");
  },
  sunEnd: function () { SUKOON.set("KHALI"); }
};

var KAAN = {
  MAX: 40,
  log: [],
  heard: 0, woke: 0, errs: 0, starts: 0, skips: 0, err8: 0,
  lastErr: 0, lastAt: 0,

  /* "Maya" ki har mumkin shakl — Roman, Urdu, Devanagari */
  WAKE: /(^|[^a-z])(m[aeiy]{1,3}y?[aeiou]{0,2}|maiya|mahiya|mayaa|maja|mya|my a|boss|bass|baas|\u0645\u0627\u06CC\u0627|\u0645\u0627\u06CC\u06C1|\u092E\u093E\u092F\u093E|\u092E\u0948\u092F\u093E)([^a-z]|$)/i,
  /* saaf "maya/boss" — sab se pukhta */
  SURE: /(^|[^a-z])(maya|maaya|mayaa|boss|\u0645\u0627\u06CC\u0627|\u092E\u093E\u092F\u093E)([^a-z]|$)/i,

  /* ═══ 🚪 DARWAZA — "Maya" ke bagair kuch nahi (P8a) ═══
     Aap ki farmaish: "yeh karo" par KUCH NA HO. Sirf "Maya yeh karo" chale.
     Aur jaagne ke baad chand second tak baat bina "Maya" kahe chalti rahe. */
  DARWAZA: {
    until: 0,
    secs: function () {
      var s = (typeof settings === "object" && settings) ? settings : {};
      var n = parseInt(s.wakeDoor, 10);
      if (isNaN(n)) n = 15;
      if (n < 0) n = 0;
      if (n > 60) n = 60;
      return n;                       /* 0 = har baar "Maya" kehna paregi */
    },
    open: function () {
      var n = KAAN.DARWAZA.secs();
      KAAN.DARWAZA.until = n ? ((new Date()).getTime() + n * 1000) : 0;
      return n;
    },
    isOpen: function () {
      return KAAN.DARWAZA.until > 0 && (new Date()).getTime() < KAAN.DARWAZA.until;
    },
    left: function () {
      if (!KAAN.DARWAZA.isOpen()) return 0;
      return Math.ceil((KAAN.DARWAZA.until - (new Date()).getTime()) / 1000);
    },
    close: function () { KAAN.DARWAZA.until = 0; },
    /* ye lafz sunte hi darwaza foran band */
    BAS: /^\s*(bas|bus|theek hai|thik hai|khatam|band karo|shukriya|thanks|thank you|bye|ok bye|so jao|chup)\s*[.!]?\s*$/i
  },

  /* wake word SHURU mein hona chahiye — beech ya aakhir mein nahi.
     "Maya yeh karo" ✅   ·   "chalo Maya yeh karo" ❌   ·   "yeh karo" ❌ */
  FILLER: /^(hey|hay|hi|hello|o|arey|are|oye|acha|suno|sun)$/i,
  atStart: function (t) {
    var q = String(t || "").trim().toLowerCase();
    q = q.replace(/^[\s,."'\u060C\u061F!?-]+/, "");
    var w = q.split(/\s+/);
    var i = 0;
    /* "hey Maya" / "o Maya" chalega, magar "chalo Maya yeh karo" NAHI */
    if (w.length > 1 && KAAN.FILLER.test(w[0])) i = 1;
    var first = w[i] || "";
    return KAAN.SURE.test(first) || KAAN.WAKE.test(first);
  },

  push: function (kind, data) {
    KAAN.log.unshift({ t: (new Date()).getTime(), k: kind, d: String(data || "").slice(0, 90) });
    if (KAAN.log.length > KAAN.MAX) KAAN.log.length = KAAN.MAX;
    KAAN.lastAt = (new Date()).getTime();
    if (kind === "err") { KAAN.errs++; KAAN.lastErr = parseInt(String(data).split("|")[0], 10) || 0; }
    if (kind === "err8") KAAN.err8++;                 /* 🕊️ P9 — mic-masroof ki ginti (ab khatarnak nahi) */
    if (kind === "skip") KAAN.skips++;                /* 🎚️ P9 — HAAL ki wajah se roka gaya mic */
    if (kind === "start") KAAN.starts++;
    if (kind === "heard") KAAN.heard++;
    if (kind === "wake") KAAN.woke++;
  },

  /* saare andazon mein se koi wake word hai? */
  match: function (alts) {
    var i, a;
    for (i = 0; i < alts.length; i++) {
      a = String(alts[i] || "");
      if (KAAN.SURE.test(a)) return { hit: a, sure: true, idx: i };
    }
    for (i = 0; i < alts.length; i++) {
      a = String(alts[i] || "");
      if (KAAN.WAKE.test(a)) return { hit: a, sure: false, idx: i };
    }
    return null;
  },

  ERRNAME: { 1: "network timeout", 2: "network", 3: "audio", 4: "server", 5: "client",
             6: "koi awaaz nahi (khamoshi)", 7: "samajh nahi aaya", 8: "recognizer busy",
             9: "permission nahi" },

  report: function () {
    var L = ["\uD83D\uDC42 WAKE WORD ka haal", ""], i, e, d;
    L.push("  switch      : " + ((settings && settings.wakeWord) ? "ON" : "OFF"));
    L.push("  suna        : " + KAAN.heard + " dafa");
    L.push("  JAAGI       : " + KAAN.woke + " dafa");
    L.push("  nakami      : " + KAAN.errs + (KAAN.lastErr ? ("   (aakhri: " + KAAN.lastErr + " \u2014 " + (KAAN.ERRNAME[KAAN.lastErr] || "?") + ")") : ""));
    L.push("  mic chala   : " + KAAN.starts + " dafa");
    /* 🎚️ P9 SUKOON — ab NAZAR aata hai mic ne kyun nahi khula (andha nahi rahenge) */
    L.push("  HAAL        : " + (typeof SUKOON !== "undefined" ? SUKOON.haal : "?") +
           "   (awaaz kabhi nahi kategi — sirf KHALI par mic khulta hai)");
    L.push("  roka gaya   : " + KAAN.skips + " dafa (Maya bol rahi thi / app ka mic)  ·  err8 maaf: " + KAAN.err8);
    L.push("");
    if (!KAAN.log.length) {
      L.push("  \u26A0\uFE0F Service se ABHI TAK KUCH NAHI aaya.");
      L.push("");
      L.push("  Iska matlab ya to:");
      L.push("   \u2022 wake word switch OFF hai, ya");
      L.push("   \u2022 mic ki ijazat nahi mili, ya");
      L.push("   \u2022 purani APK hai (v5.9.5 se pehle diagnostics thi hi nahi)");
      return L.join("\n");
    }
    L.push("  \u2500\u2500 aakhri " + Math.min(KAAN.log.length, 22) + " waqiat \u2500\u2500");
    for (i = 0; i < KAAN.log.length && i < 22; i++) {
      e = KAAN.log[i];
      d = new Date(e.t);
      var hh = (d.getHours() < 10 ? "0" : "") + d.getHours() + ":" +
               (d.getMinutes() < 10 ? "0" : "") + d.getMinutes() + ":" +
               (d.getSeconds() < 10 ? "0" : "") + d.getSeconds();
      var ico = e.k === "wake" ? "\u2705" : (e.k === "heard" ? "\uD83D\uDC42" : (e.k === "err" ? "\u26A0\uFE0F" : "\u25B6\uFE0F"));
      var txt = e.d;
      if (e.k === "err") {
        var c = parseInt(String(e.d).split("|")[0], 10);
        txt = c + " \u2014 " + (KAAN.ERRNAME[c] || "?") + "  (lagatar " + (String(e.d).split("|")[1] || "1") + ")";
      }
      L.push("  " + hh + " " + ico + " " + txt);
    }
    L.push("");
    L.push("  \uD83D\uDC42 = suna   \u2705 = JAAGI   \u26A0\uFE0F = nakami   \u25B6\uFE0F = mic chala");
    return L.join("\n");
  },

  /* ═══ 🩺 KAAN DOCTOR (P8b) — asal wajah, andaza nahi ═══ */
  ERRSVC: function (svc) {
    if (!svc) return "pata nahi chala";
    if (/googlequicksearchbox|google\.android\.tts|GoogleRecognition/i.test(svc)) return "Google \u2705";
    if (/AiAi|SystemIntelligence|systemui/i.test(svc)) return "Android System Intelligence \u26A0\uFE0F";
    return svc.split("/")[0];
  },
  doctor: function () {
    var L = ["\uD83E\uDE7A KAAN DOCTOR", ""], d = null;
    try { d = JSON.parse(window.MayaBridge.micDoctor()); } catch (e) { d = null; }
    if (!d) {
      L.push("  \u26A0\uFE0F Sirf APK mein chalta hai (ya purani APK hai).");
      return L.join("\n");
    }
    var bad = [];
    L.push("  " + (d.mic ? "\u2705" : "\u274C") + " Mic ki ijazat        : " + (d.mic ? "mili hui" : "NAHI MILI"));
    if (!d.mic) bad.push("mic");
    L.push("  " + (d.avail ? "\u2705" : "\u274C") + " Recognition service  : " + (d.avail ? "maujood" : "MAUJOOD NAHI"));

    var svcName = KAAN.ERRSVC(d.svc);
    L.push("  " + (d.aiai ? "\u274C" : "\u2705") + " Phone ka voice input : " + svcName);
    if (d.aiai) {
      bad.push("aiai");
      L.push("     \u26A0\uFE0F YEHI SAB SE BARA MASLA HAI. Android 12+ par ye service");
      L.push("        SpeechRecognizer ke sath theek kaam NAHI karti.");
    }
    L.push("  " + (d.ondevice ? "\u2705" : "\u26A0\uFE0F") + " On-device recognizer : " + (d.ondevice ? "maujood (offline chalega)" : "nahi \u2014 language pack download karna paregi"));
    if (!d.ondevice) bad.push("ondevice");
    L.push("  " + (d.gtts === "enabled" ? "\u2705" : "\u274C") + " Speech by Google app : " + d.gtts);
    if (d.gtts !== "enabled") bad.push("gtts");
    L.push("  \uD83C\uDFAF Abhi chal raha hai   : " + (d.using || "-"));
    L.push("  " + (d.battOk ? "\u2705" : "\u26A0\uFE0F") + " Battery optimization : " + (d.battOk ? "MAYA azad hai" : "MAYA par lagi hai \u2014 service mar sakti hai"));
    if (!d.battOk) bad.push("batt");
    L.push("  " + (d.wakeOn ? "\u2705" : "\u26A0\uFE0F") + " Wake service         : " + (d.wakeOn ? "chal rahi hai" : "band hai"));
    L.push("");
    L.push("  \uD83D\uDCCA suna " + KAAN.heard + " \u00B7 JAAGI " + KAAN.woke + " \u00B7 nakami " + KAAN.errs + " \u00B7 mic " + KAAN.starts);
    L.push("");
    if (!bad.length) {
      L.push("  \u2705 Sab theek hai. Agar phir bhi na jaage to \uD83E\uDDEA MIC TEST chalao.");
    } else {
      L.push("  \uD83D\uDC49 KYA KARNA HAI:");
      if (bad.indexOf("aiai") >= 0) L.push("     \u2022 [VOICE INPUT] dabao \u2192 \"Speech Recognition & Synthesis\" chuno");
      /* v5.9.5 — pehle yahan purane bracket-button ka hawala likha hota tha magar
         aisa button kahin THA HI NAHI (user dhoondta reh jata). Ab neeche ASLI
         button hai: 🗣️ */
      if (bad.indexOf("ondevice") >= 0) L.push("     \u2022 neeche \uD83D\uDDE3\uFE0F ON-DEVICE LANGUAGE button dabao \u2192 \u0627\u0631\u062F\u0648 + English (India) download karo (offline chalegi)");
      if (bad.indexOf("gtts") >= 0) L.push("     \u2022 Play Store \u2192 \"Speech Recognition & Synthesis\" install/enable karo");
      if (bad.indexOf("batt") >= 0) L.push("     \u2022 [BATTERY] dabao \u2192 MAYA ko \"Unrestricted\" karo");
      if (bad.indexOf("mic") >= 0) L.push("     \u2022 Mic ki ijazat do");
    }
    return L.join("\n");
  },

  /* ═══ 🧪 MIC TEST (P8c) ═══ */
  micTest: function (cb) {
    var r = null;
    try { r = JSON.parse(window.MayaBridge.micTest(5000, +((settings && settings.micZoom) || 0.8))); }
    catch (e) { r = { ok: false, why: "sirf APK mein" }; }
    var L = ["\uD83C\uDFA4 MIC TEST", ""];
    if (!r.ok) {
      L.push("  \u274C " + (r.why || "nakaam"));
      cb(L.join("\n")); return;
    }
    L.push("  Kamre ka shor   : " + r.floor + " dB" + (r.floor < 45 ? "   (khamosh \u2705)" : "   (shor hai \u26A0\uFE0F)"));
    L.push("  Aap ki awaaz    : " + r.peak + " dB");
    L.push("  Farq (SNR)      : " + r.snr + " dB   " + (r.snr >= 20 ? "\u2705 behtareen" : (r.snr >= 12 ? "\u26A0\uFE0F theek" : "\u274C bohat kam")));
    L.push("  Bolne ke lamhe  : " + r.voiced + " / " + r.frames);
    L.push("");
    L.push("  \u2500\u2500 is device par kya chala \u2500\u2500");
    L.push("  " + (r.zoom ? "\u2705" : "\u274C") + " Mic ZOOM (background rad)");
    L.push("  " + (r.dir ? "\u2705" : "\u274C") + " Mic ka rukh aap ki taraf");
    L.push("  " + (r.ns ? "\u2705" : "\u274C") + " Noise suppressor");
    L.push("  " + (r.agc ? "\u2705" : "\u274C") + " Auto gain (awaaz barabar)");
    L.push("  " + (r.aec ? "\u2705" : "\u274C") + " Echo canceler (apni awaaz na sune)");
    L.push("");
    if (r.snr >= 20) L.push("  \uD83D\uDC49 Aap ki awaaz saaf pohanch rahi hai.");
    else if (r.snr >= 12) L.push("  \uD83D\uDC49 Thora qareeb aa kar boliye, ya zoom barhao.");
    else L.push("  \uD83D\uDC49 Bohat shor hai ya awaaz door se aa rahi hai. Qareeb aa kar boliye.");
    cb(L.join("\n"));
  }
};

/* Kotlin ki har report yahan aati hai (v5.9.5) */
window.__wakeLog = function (kind, data) {
  try { KAAN.push(String(kind || "?"), data); } catch (e) {}
  try { if (typeof WAKE_DOT !== "undefined" && WAKE_DOT.log) WAKE_DOT.log(String(kind || "")); } catch (e) {}
};

/* wake-regression: listening indicator — Kotlin service ke __wakeLog
   events se chalta hai (gate/start = sun rahi, voice = awaaz mili,
   skip/err/sulah = intezar). Mic ki ASLI halat nazar aati hai. */
var WAKE_DOT = {
  el: null, t: null,
  ensure: function () {
    if (WAKE_DOT.el || !NATIVE) return WAKE_DOT.el;
    try {
      var st = document.createElement("style");
      st.textContent = "#wakeDot{position:fixed;right:6px;top:26px;z-index:998;display:none;align-items:center;gap:5px;padding:2px 7px;border-radius:9px;background:rgba(10,10,16,.92);border:1px solid rgba(255,122,26,.4);color:var(--accent2);font:9px/1.4 monospace;cursor:default}#wakeDot i{width:6px;height:6px;border-radius:50%;background:#39D98A;display:inline-block;animation:wakePulse 1.4s ease-in-out infinite}@keyframes wakePulse{0%,100%{opacity:.35;transform:scale(.8)}50%{opacity:1;transform:scale(1.25)}}#wakeDot.dim i{background:#8a8a96;animation:none}#wakeDot.loud i{background:#FFD166;animation-duration:.5s}";
      document.head.appendChild(st);
      var d = document.createElement("div");
      d.id = "wakeDot"; d.innerHTML = "<i></i><span>MAYA SUN RAHI</span>";
      document.body.appendChild(d);
      WAKE_DOT.el = d;
    } catch (e) {}
    return WAKE_DOT.el;
  },
  set: function (mode, txt) {
    try {
      var el = WAKE_DOT.ensure();
      if (!NATIVE || !settings.wakeWord) { if (el) el.style.display = "none"; return; }
      if (!el) return;
      el.style.display = "flex";
      el.className = mode || "";
      el.querySelector("span").textContent = txt || "MAYA SUN RAHI";
      if (WAKE_DOT.t) { clearTimeout(WAKE_DOT.t); WAKE_DOT.t = null; }
      if (mode === "dim") WAKE_DOT.t = setTimeout(function () { WAKE_DOT.set("", "MAYA SUN RAHI"); }, 4000);
    } catch (e) {}
  },
  log: function (kind) {
    if (kind === "gate" || kind === "start") WAKE_DOT.set("", "MAYA SUN RAHI");
    else if (kind === "voice") WAKE_DOT.set("loud", "AWAAZ MILI\u2026");
    else if (kind === "skip" || kind === "err" || kind === "err8" || kind === "sulah") WAKE_DOT.set("dim", "INTEZAAR\u2026");
  }
};

/* Kotlin ab SAARE andaze bhejta hai — faisla yahan hota hai */
window.__wakeHeard = function (payload) {
  var alts = [];
  try { alts = JSON.parse(payload); } catch (e) { alts = [String(payload || "")]; }
  if (!alts || !alts.length) return;

  KAAN.push("heard", alts.join(" | "));
  if (speaking || thinking || listening) return;      /* pehle se masroof */

  /* 🚪 "bas" / "theek hai" -> darwaza foran band */
  var i;
  for (i = 0; i < alts.length; i++) {
    if (KAAN.DARWAZA.BAS.test(String(alts[i] || ""))) {
      if (KAAN.DARWAZA.isOpen()) {
        KAAN.DARWAZA.close();
        KAAN.push("shut", "\"" + alts[i] + "\" \u2014 darwaza band");
        try { chime(520, 0.09); } catch (e) {}
      }
      return;
    }
  }

  /* ═══ SAKHT DARWAZA — do hi raaste andar aane ke ═══ */
  var m = null, viaDoor = false;

  /* raasta 1: kisi bhi andaze ke SHURU mein "Maya" */
  for (i = 0; i < alts.length; i++) {
    if (KAAN.atStart(alts[i])) { m = { hit: String(alts[i]), idx: i }; break; }
  }

  /* raasta 2: darwaza pehle se khula hai (jaagne ke baad chand second) */
  if (!m && KAAN.DARWAZA.isOpen()) {
    /* darwaza khula hai — jo behtareen andaza mila wohi hukm samjho.
       (SUNO maujood ho to wo chune, warna pehla.) */
    var pk = "";
    try { if (typeof SUNO !== "undefined") pk = SUNO.pick(alts); } catch (e) { pk = ""; }
    m = { hit: String(pk || alts[0] || ""), idx: 0 };
    viaDoor = true;
  }

  if (!m) {
    /* 🔒 "Maya" nahi kaha aur darwaza band hai -> BILKUL KUCH NAHI */
    KAAN.push("skip", "koi \"Maya\" nahi \u2014 chup rahi");
    return;
  }

  KAAN.push("wake", (viaDoor ? "\uD83D\uDEAA " : "") + m.hit + (m.idx ? ("  #" + (m.idx + 1)) : ""));

  var cmd = viaDoor ? m.hit : stripWake(m.hit);
  var open = KAAN.DARWAZA.open();

  if (cmd && cmd.replace(/[^a-z\u0600-\u06FF\u0900-\u097F]/gi, "").length >= 3) {
    handleUserText(cmd, true);                        /* "Maya <hukm>" -> seedha kaam */
    return;
  }
  /* sirf "Maya" -> Ji Boss + suno */
  try { chime(880, 0.1); chime(1175, 0.16, 0.12); } catch (e) {}
  try { statusText.textContent = "\uD83D\uDC42 JI " + String(settings.name || "BOSS").toUpperCase() + "? BOLIYE..."; } catch (e) {}
  addBubble("ai", "\uD83D\uDC42 Ji " + settings.name + "? Boliye..." + (open ? ("  \uD83D\uDEAA " + open + "s") : ""));
  setTimeout(startListening, 400);
};

window.__wakeErr = function(code){
  /* 🕊️ P9 — user ka wake switch KABHI khud mat mitao. Pehle yahan
     settings.wakeWord = false ho jata tha — isi liye "wake ON karo to baad
     mein apne aap band mila" karta tha. Ab: sirf batao, faisla aap ka. */
  pushLog("WAKE ALERT: code " + code + " — LAB mein KAAN DOCTOR dekho");
  toast("Wake word masla (code " + code + ") — 🩺 KAAN DOCTOR par wajah likhi hai");
};

