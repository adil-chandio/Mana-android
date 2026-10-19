/* ═══════════════════════════════════════════════════════════════════════════
   🐟  FISH AUDIO  S2.1 Pro  —  BE-HISAAB, FORAN, AUR *ANDAAZ* WAPAS
   ---------------------------------------------------------------------------
   Ye wahi cheez hai jiski Maya ko sab se zyada zaroorat thi.

   Gemini ki awaaz pyari kyun lagti thi? Sirf awaaz ki wajah se nahi — hum use
   LAFZON MEIN HIDAYAT bhejte the: "Say this warmly, like a close friend".
   Edge TTS ye kar hi nahi sakta (Microsoft ne uska SSML sirf pitch/rate tak
   mehdood kar rakha hai) — is liye Edge par aap ke 9 MOOD bekaar ho jate hain.

   Fish S2.1 Pro ye WAPAS le aata hai, aur us se behtar:
       "[whispers sweetly] Salam..."     "[excited] Mubarak ho!"
   Fish ki apni dastavez: "You can use ANY descriptive expression and the model
   will interpret it." Yani hamare mood ka matn seedha bracket mein ja sakta hai.

   Aur:  ~70ms mein pehli awaaz  ·  83 zubanein (Urdu samet, khud pehchan leta
   hai)  ·  koi hard cap nahi (Fair Use)  ·  awaaz ki library + voice cloning.

   PURANA ZAKHM: is app ne fish.audio pehle try kar ke NIKAL diya tha — CORS.
   Wo masla bilkul wohi tha jo Edge ka tha, aur hal bhi wohi hai: Kotlin bridge
   browser ke CORS qanoon ke tabey nahi hota. Do aur pech the, dono hal ho gaye:
     1. `model: s2.1-pro-free` ek CUSTOM header hai -> naya httpBytes() bhejta hai
     2. Fish BINARY MP3 deta hai -> purana bridge use text samajh kar barbaad kar
        deta tha; httpBytes() raw bytes uthata hai.

   IMAANDARI: free tier "Fair Use" par hai, SLA nahi, aur bheje hue jumle model
   behtar banane ke liye rakhe ja sakte hain. Isi liye Fish akela sahara NAHI —
   nakaam ho to seerhi khud Gemini/Edge par gir jati hai, aur 🩺 FISH DOCTOR
   asal HTTP status ke sath sach bata deta hai.
   ═══════════════════════════════════════════════════════════════════════════ */
var FISH = {
  API: "https://api.fish.audio/v1/tts",
  LIB: "https://api.fish.audio/model",
  MODEL: "s2.1-pro-free",
  TIMEOUT: 25000,
  MAXCHARS: 4000,     /* is se lamba matn tukron mein jayega */

  audio: null,
  pend: {},           /* reqId -> { done, fail, to } */
  seq: 0,
  spoke: 0,
  lastErr: "",        /* Fish ka apna message — andaza nahi */
  lastHttp: 0,
  lastMs: 0,
  cool: 0,            /* 429 / 402 ke baad thori der haath na lagao */
  COOL: 300000,
  lib: null,          /* awaaz ki library (jab mangwai jaye) */
  loadLib: function () {
    if (FISH.lib) return FISH.lib;
    try {
      var d = JSON.parse(localStorage.getItem("maya_fishlib") || "null");
      if (d && d.length) FISH.lib = d;
    } catch (e) {}
    return FISH.lib;
  },
  /* chuni hui awaaz ka NAAM (hex id nahi) */
  voiceName: function () {
    var s = (typeof settings === "object" && settings) ? settings : {};
    var id = String(s.fishVoice || "");
    if (!id) return "";
    if (s.fishVoiceName) return s.fishVoiceName;
    var L = FISH.loadLib() || [], i;
    for (i = 0; i < L.length; i++) if (L[i].id === id) return L[i].title;
    return id.slice(0, 8) + "\u2026";
  },

  /* ─── MOOD -> Fish ka [bracket] ishara ───
     Yehi wo pul hai jo aap ke purane 9 mood zinda rakhta hai. */
  /* ⚠️ Ishare CHHOTE rakhe gaye hain. Pehle "[warmly, affectionately, like a
     close friend]" tha — 45 ANGREZI harf, jumle ke bilkul shuru mein. BOLI ke
     baad matn Devanagari hota hai, magar itna lamba angrezi ishara Fish ki
     zubaan-pehchan ko WAPAS ANGREZI par le ja sakta tha. Ab 1-2 lafz. */
  BRACKET: {
    warm:     "[warm]",
    cheerful: "[cheerful]",
    calm:     "[calm, soft]",
    pro:      "[confident]",
    hype:     "[excited]",
    whisper:  "[whisper]",
    news:     "[news tone]",
    funny:    "[playful]"
  },

  /* har code ka insani matlab — DOCTOR aur status yehi bolte hain */
  WHY: {
    OK:       "Fish zinda hai — muft aur be-hisaab",
    KEY_MISSING: "Fish ki key nahi dali (fish.audio/app/api-keys — muft, card nahi lagta)",
    KEY_BAD:  "Key ghalat ya khatam ho gayi (401) — nayi key banao",
    PAYMENT:  "402 — muft window band ho gayi ya balance khatam. Fish ne 31 Aug 2026 wala free daur khatam kar diya lagta hai",
    FORBIDDEN:"403 — is key ko ijazat nahi (shayad free model band hai)",
    RATE:     "429 — Fair Use ki hadd lag gayi, thori der baad khud chal jayega",
    BUSY:     "503 — Fish ka server abhi busy hai",
    NO_AUDIO: "Fish ne 200 to kaha magar audio bheji hi nahi",
    NETWORK:  "Fish tak pohanch nahi hui (internet?)",
    TIMEOUT:  "Fish ne waqt par jawab nahi diya",
    BRIDGE:   "App ka native pul jawab nahi de raha (app dobara kholo)",
    BROWSER:  "Fish sirf APK mein chalta hai — browser ka CORS use rok deta hai",
    DECODE:   "Audio kharab aayi"
  },
  why: function (c) { return FISH.WHY[c] || (c ? ("Error: " + c) : ""); },

  native: function () {
    try { return !!(typeof NATIVE !== "undefined" && NATIVE && window.MayaBridge && window.MayaBridge.httpBytes); }
    catch (e) { return false; }
  },

  key: function () {
    var s = (typeof settings === "object" && settings) ? settings : {};
    return String(s.fishKey || "").trim();
  },
  voice: function () {
    var s = (typeof settings === "object" && settings) ? settings : {};
    return String(s.fishVoice || "").trim();
  },

  /* Chal sakta hai? Sach bolo — jhooti koshish mein waqt zaya na ho. */
  ready: function () {
    var s = (typeof settings === "object" && settings) ? settings : {};
    if (s.fishOn === false) return false;
    if (!FISH.key()) return false;
    if (!FISH.native()) return false;          /* browser mein CORS rokta hai */
    if (Date.now() < FISH.cool) return false;
    return true;
  },
  block: function () {
    var s = (typeof settings === "object" && settings) ? settings : {};
    if (s.fishOn === false) return "OFF";
    if (!FISH.key()) return "KEY_MISSING";
    if (!FISH.native()) return "BROWSER";
    if (Date.now() < FISH.cool) return "RATE";
    return "";
  },

  /* mood ka ishara matn ke shuru mein lagao (Fish ise bolta nahi, samajhta hai) */
  styled: function (text, mood) {
    var tag = FISH.BRACKET[mood] || "";
    var t = String(text || "").trim();
    return tag ? (tag + " " + t) : t;
  },

  /* 🎯 awaaz kitni STHIR (0.25) ya JAZBAATI (0.8) */
  temp: function () {
    var s = (typeof settings === "object" && settings) ? settings : {};
    var v = parseFloat(s.fishTemp);
    if (isNaN(v)) v = 0.35;
    if (v < 0.1) v = 0.1;
    if (v > 0.9) v = 0.9;
    return Math.round(v * 100) / 100;
  },

  /* settings ka rate 1.0 -> speed 1.0 ; hadd 0.5 se 2.0 */
  speed: function (r) {
    var n = +r || 1;
    if (n < 0.5) n = 0.5;
    if (n > 2) n = 2;
    return Math.round(n * 100) / 100;
  },

  body: function (text, mood) {
    var s = (typeof settings === "object" && settings) ? settings : {};
    var o = {
      /* 🗣️ LEHJA: Fish matn se zubaan pehchanta hai. Latin bhejenge to
         ANGREZI lehja aayega. Is liye bolne ke liye Devanagari/Urdu bhejte
         hain — screen par Roman hi rehta hai. */
      text: FISH.styled((typeof BOLI !== "undefined" ? BOLI.say(text, s.tts) : text), mood),
      format: "mp3",
      mp3_bitrate: 128,
      latency: "balanced",
      chunk_length: 300,
      normalize: true,
      /* 🎯 Fish docs: "temperature — higher is more VARIED, lower is more
         CONSISTENT". 0.7 par har turn ka lehja badal jata tha ("alag alag
         accent"). Ab default 0.35 = wohi awaaz, wohi lehja, har dafa. */
      temperature: FISH.temp(),
      top_p: 0.7,
      prosody: { speed: FISH.speed(s.rate), volume: 0, normalize_loudness: true }
    };
    var v = FISH.voice();
    if (v) o.reference_id = v;
    return JSON.stringify(o);
  },

  headers: function () {
    return JSON.stringify({
      "Authorization": "Bearer " + FISH.key(),
      "Content-Type": "application/json",
      "model": FISH.MODEL,
      "Accept": "*/*"
    });
  },

  /* HTTP status -> hamara code. 402 sab se ahem hai: free daur khatam. */
  code: function (status) {
    if (status >= 200 && status < 300) return "OK";
    if (status === 401) return "KEY_BAD";
    if (status === 402) return "PAYMENT";
    if (status === 403) return "FORBIDDEN";
    if (status === 429) return "RATE";
    if (status === 503 || status === 502 || status === 504) return "BUSY";
    if (!status) return "NETWORK";
    return "HTTP_" + status;
  },

  /* Fish ki ghalati ka apna matn nikaalo (JSON: {status,message,reason}) */
  readErr: function (b64) {
    var txt = "";
    try { txt = atob(String(b64 || "").replace(/\s+/g, "")); } catch (e) { return ""; }
    try {
      var j = JSON.parse(txt);
      var m = j.message || j.detail || j.reason || "";
      if (typeof m !== "string") m = JSON.stringify(m);
      return String(m || txt).slice(0, 300);
    } catch (e) { return String(txt).slice(0, 300); }
  },

  /* ─── ek request ─── */
  req: function (method, url, headersJson, body, cb) {
    if (!FISH.native()) { cb(0, "", "", "native bridge nahi"); return; }
    FISH.seq++;
    var id = "f" + FISH.seq + "_" + Date.now();
    FISH.pend[id] = {
      cb: cb,
      to: setTimeout(function () {
        var p = FISH.pend[id];
        delete FISH.pend[id];
        if (p) p.cb(0, "", "", "timeout");
      }, FISH.TIMEOUT + 3000)
    };
    try { window.MayaBridge.httpBytes(method, url, headersJson, body || "", id, FISH.TIMEOUT); }
    catch (e) {
      try { clearTimeout(FISH.pend[id].to); } catch (e2) {}
      delete FISH.pend[id];
      cb(-1, "", "", String(e && e.message ? e.message : e));
    }
  },

  /* base64 MP3 -> bajti hui awaaz */
  play: function (b64, gen, onDone, onFail) {
    var url = "", revoke = false;
    try {
      if (typeof Blob === "function" && typeof URL !== "undefined" && URL.createObjectURL) {
        url = URL.createObjectURL(new Blob([AWAAZ.b64(b64)], { type: "audio/mpeg" }));
        revoke = true;
      } else {
        url = "data:audio/mpeg;base64," + String(b64 || "").replace(/\s+/g, "");
      }
    } catch (e) {
      try { url = "data:audio/mpeg;base64," + String(b64 || "").replace(/\s+/g, ""); }
      catch (e2) { onFail("DECODE"); return; }
    }
    var a;
    try { a = new Audio(); } catch (e) { onFail("DECODE"); return; }
    FISH.audio = a;
    function cleanup() { if (revoke) { try { URL.revokeObjectURL(url); } catch (e) {} } FISH.audio = null; }
    a.onended = function () { cleanup(); if (gen === AWAAZ.gen) onDone(); };
    a.onerror = function () { cleanup(); if (gen === AWAAZ.gen) onFail("DECODE"); };
    a.src = url;
    var pr;
    try { pr = a.play(); } catch (e) { cleanup(); onFail("DECODE"); return; }
    if (pr && pr["catch"]) pr["catch"](function () { onFail("DECODE"); });
  },

  /* ═══ WAHID DARWAZA ═══ */
  speak: function (text, mood, onDone, onFail) {
    var blk = FISH.block();
    if (blk) { FISH.lastErr = FISH.why(blk); onFail(blk === "OFF" ? "OFF" : blk); return; }
    var gen = AWAAZ.gen;
    var list = AWAAZ.chunks(String(text || ""), FISH.MAXCHARS);
    if (!list.length) { onDone(); return; }

    function one(idx) {
      if (gen !== AWAAZ.gen) return;
      if (idx >= list.length) { FISH.spoke++; onDone(); return; }
      var t0 = Date.now();
      FISH.req("POST", FISH.API, FISH.headers(), FISH.body(list[idx], mood), function (status, b64, ctype, err) {
        if (gen !== AWAAZ.gen) return;
        FISH.lastHttp = status;
        FISH.lastMs = Date.now() - t0;
        var c = FISH.code(status);
        if (c !== "OK") {
          FISH.lastErr = FISH.readErr(b64) || err || FISH.why(c);
          if (c === "RATE" || c === "PAYMENT") { FISH.cool = Date.now() + FISH.COOL; FISH.persist(); }
          onFail(c);
          return;
        }
        if (!b64) { FISH.lastErr = FISH.why("NO_AUDIO"); onFail("NO_AUDIO"); return; }
        FISH.lastErr = "";
        FISH.play(b64, gen, function () { one(idx + 1); }, function (cc) { onFail(cc); });
      });
    }
    one(0);
  },

  stop: function () {
    var k;
    for (k in FISH.pend) {
      if (Object.prototype.hasOwnProperty.call(FISH.pend, k)) {
        try { clearTimeout(FISH.pend[k].to); } catch (e) {}
      }
    }
    FISH.pend = {};
    try {
      if (FISH.audio) {
        FISH.audio.pause();
        FISH.audio.onended = null; FISH.audio.onerror = null;
        FISH.audio = null;
      }
    } catch (e) {}
  },

  persist: function () {
    try { localStorage.setItem("maya_fish", JSON.stringify({ c: FISH.cool })); } catch (e) {}
  },
  restore: function () {
    try {
      var d = JSON.parse(localStorage.getItem("maya_fish") || "{}");
      if (d && d.c) FISH.cool = +d.c || 0;
    } catch (e) {}
  },

  /* 🎀 PYARI — kai talash ek sath, phir zanana/Hindi-Urdu wali oopar
     (user ko Gemini ki "Kore" jaisi meethi zanana awaaz chahiye) */
  SWEET: /(female|woman|girl|ladki|aurat|zanana|sweet|soft|cute|warm|gentle|meethi|pyari|didi|behen|lady|she|her|anchor|rj)/i,
  MALEISH: /(male|man|boy|ladka|mard|deep|bass|guy|bhai|sir\b|uncle)/i,
  pyari: function (cb) {
    var qs = ["hindi", "urdu", "female", "indian", "girl"], got = [], seen = {}, left = qs.length, err = "";
    function done() {
      if (--left > 0) return;
      /* score: zanana + pasand + Hindi/Urdu zubaan */
      var i, v, sc;
      for (i = 0; i < got.length; i++) {
        v = got[i];
        sc = 0;
        if (FISH.SWEET.test(v.title + " " + (v.tags || ""))) sc += 60;
        if (FISH.MALEISH.test(v.title + " " + (v.tags || ""))) sc -= 80;
        if (/hi|ur|hin|urd/.test(String(v.langs || ""))) sc += 40;
        sc += Math.min(30, Math.round((v.likes || 0) / 10));
        v.sc = sc;
      }
      got.sort(function (a, b) { return b.sc - a.sc; });
      FISH.lib = got.slice(0, 40);
      cb(FISH.lib, got.length ? "" : (err || "kuch nahi mila"));
    }
    var k;
    for (k = 0; k < qs.length; k++) {
      (function (term) {
        FISH.library(term, function (L, code) {
          if (!L) { err = code || err; return done(); }
          var i;
          for (i = 0; i < L.length; i++) if (!seen[L[i].id]) { seen[L[i].id] = 1; got.push(L[i]); }
          done();
        });
      })(qs[k]);
    }
  },

  /* ─── awaaz ki library (public voices) ─── */
  library: function (q, cb) {
    if (!FISH.key()) { cb(null, "KEY_MISSING"); return; }
    if (!FISH.native()) { cb(null, "BROWSER"); return; }
    /* Fish ki API `language` filter deti hai — ab Hindi/Urdu awaazein saamne aayengi */
    var s0 = (typeof settings === "object" && settings) ? settings : {};
    var lg = /^ur/.test(String(s0.tts || "")) ? "ur" : (/^hi/.test(String(s0.tts || "")) ? "hi" : "en");
    var url = FISH.LIB + "?page_size=40&page_number=1&sort_by=score" +
              "&language=" + lg + (lg === "ur" ? "&language=hi" : "") +
              (q ? ("&title=" + encodeURIComponent(q)) : "");
    FISH.req("GET", url, JSON.stringify({ "Authorization": "Bearer " + FISH.key() }), "", function (status, b64, ctype, err) {
      var c = FISH.code(status);
      if (c !== "OK") { FISH.lastErr = FISH.readErr(b64) || err; cb(null, c); return; }
      var txt = "";
      try { txt = decodeURIComponent(escape(atob(String(b64 || "").replace(/\s+/g, "")))); }
      catch (e) { try { txt = atob(String(b64 || "")); } catch (e2) { txt = ""; } }
      var out = [];
      try {
        var j = JSON.parse(txt), i, m;
        for (i = 0; i < (j.items || []).length; i++) {
          m = j.items[i];
          if (!m || !m._id) continue;
          out.push({
            id: m._id,
            title: String(m.title || "bay-naam"),
            langs: (m.languages || []).join("/"),
            tags: (m.tags || []).join(" ").toLowerCase(),
            likes: +m.like_count || 0
          });
        }
      } catch (e) { cb(null, "DECODE"); return; }
      FISH.lib = out;
      /* 🔒 list mehfooz — restart ke baad bhi awaaz ka NAAM dikhe, hex id nahi */
      try { localStorage.setItem("maya_fishlib", JSON.stringify(out.slice(0, 60))); } catch (e) {}
      cb(out, "");
    });
  },

  /* ─── 🩺 FISH DOCTOR — andaza nahi, SABOOT ─── */
  doctor: function (onLine, onDone) {
    var lines = [];
    function say(s) { lines.push(s); if (onLine) onLine(s); }

    say("🩺 FISH DOCTOR — " + new Date().toLocaleTimeString());
    say("");

    if (!FISH.native()) {
      say("❌ Aap browser mein hain.");
      say("   Fish sirf APK mein chal sakta hai — browser ka CORS qanoon");
      say("   api.fish.audio ko seedha call karne nahi deta.");
      onDone({ verdict: "BROWSER", ok: false, text: lines.join("\n") });
      return;
    }
    if (!FISH.key()) {
      say("❌ Fish ki key nahi dali.");
      say("   fish.audio/app/api-keys se muft banao (credit card nahi lagta),");
      say("   phir upar 🐟 FISH KEY ke khane mein paste kar ke SAVE dabao.");
      onDone({ verdict: "KEY_MISSING", ok: false, text: lines.join("\n") });
      return;
    }

    var k = FISH.key();
    say("🔑 Key: " + k.slice(0, 6) + "…" + k.slice(-4) + "  (" + k.length + " harf)");
    say("🎯 Model: " + FISH.MODEL);
    say("🎙️ Awaaz: " + (FISH.voice() || "(default)"));
    say("");
    say("📡 Fish se sach poocha ja raha hai…");

    var t0 = Date.now();
    FISH.req("POST", FISH.API, FISH.headers(),
      JSON.stringify({ text: "Salam", format: "mp3", latency: "balanced" }),
      function (status, b64, ctype, err) {
        var ms = Date.now() - t0;
        var c = FISH.code(status);
        var msg = (c === "OK") ? "" : (FISH.readErr(b64) || err || "");
        var bytes = 0;
        try { bytes = Math.round(String(b64 || "").length * 3 / 4); } catch (e) {}

        FISH.lastHttp = status;
        say("");
        say("   HTTP " + (status || "—") + "   ·   " + ms + " ms" + (ctype ? ("   ·   " + ctype) : ""));
        if (msg) say("   Fish ka apna message: " + msg);
        say("");

        var verdict = c, ok = false;
        if (c === "OK" && bytes > 500) {
          ok = true; verdict = "OK";
          say("✅ ZINDA HAI. Muft window abhi bhi khuli hai.");
          say("   " + bytes + " bytes ki MP3 " + ms + " ms mein aa gayi.");
          say("   Koi rozana hadd nahi (Fair Use) — Maya ab jitna chahe bole.");
        } else if (c === "OK") {
          verdict = "NO_AUDIO";
          say("⚠️ Fish ne 200 kaha magar audio khaali thi (" + bytes + " bytes).");
        } else if (c === "PAYMENT") {
          say("🚨 YEHI WO DIN THA JIS KA DAR THA.");
          say("   402 ka matlab: s2.1-pro-free ka muft daur BAND ho gaya");
          say("   (blog par 31 August 2026 likha tha) ya balance khatam hai.");
          say("   Maya ko koi nuqsan nahi — awaaz khud 🌊 Edge par chali jayegi,");
          say("   jo abhi bhi muft aur be-hisaab hai.");
        } else if (c === "KEY_BAD") {
          say("❌ Key qubool nahi hui (401).");
          say("   fish.audio/app/api-keys par ja kar nayi key banao.");
          say("   Poori key copy karo — aage peeche space na rahe.");
        } else if (c === "RATE") {
          say("⏳ Fair Use ki hadd (429). Key theek hai, bas abhi bohat");
          say("   request ja chuki hain. Thori der baad khud chal jayegi.");
        } else if (c === "BUSY") {
          say("🌐 Fish ka server busy hai (" + status + "). Aap ka qusoor nahi.");
        } else if (c === "NETWORK") {
          say("📵 Fish tak pohanch hi nahi hui. Internet check karo.");
          if (err) say("   (" + err + ")");
        } else {
          say("❓ Ghair-mutawaqqe jawab: " + c);
        }

        say("");
        say("── Ab kya hoga ──");
        if (ok) say("🐟 Fish pehle bolegi. Nakaam ho to 🎭 Gemini → 🌊 Edge → 📱 phone.");
        else say("🐟 Fish skip hogi. Maya 🎭 Gemini → 🌊 Edge → 📱 phone par bolegi — khamoshi nahi hogi.");

        FISH.lastErr = msg;
        onDone({ verdict: verdict, ok: ok, http: status, ms: ms, bytes: bytes, msg: msg, text: lines.join("\n") });
      });
  },

  status: function () {
    return {
      on: FISH.key() ? true : false,
      ready: FISH.ready(),
      block: FISH.block(),
      native: FISH.native(),
      voice: FISH.voice(),
      spoke: FISH.spoke,
      http: FISH.lastHttp,
      ms: FISH.lastMs,
      err: FISH.lastErr,
      cool: Math.max(0, Math.round((FISH.cool - Date.now()) / 1000))
    };
  }
};

/* Kotlin ke bytes yahan girte hain */
window.__binDone = function (reqId, status, b64, ctype, err) {
  var p = FISH.pend[reqId];
  if (!p) return;                     /* stop() ho chuka — chup raho */
  delete FISH.pend[reqId];
  try { clearTimeout(p.to); } catch (e) {}
  p.cb(+status || 0, String(b64 || ""), String(ctype || ""), String(err || ""));
};

FISH.restore();

