/* ═══════════════════════════════════════════════════════════════════════════
   🌊  EDGE TTS  —  MUFT · BE-HISAAB · ASLI NEURAL AWAAZ
   ---------------------------------------------------------------------------
   Ye wahi engine hai jo Microsoft Edge ke "Read aloud" ke peeche chalta hai:
   Azure ki 300+ neural awaazein, 50+ zabanein — koi API key nahi, koi signup
   nahi, koi rozana ki hadd nahi. Maya ke liye sab se ahem: ASLI URDU awaazein
   (ur-PK-UzmaNeural / ur-PK-AsadNeural) — Microsoft ki apni live list se
   lafz-ba-lafz tasdeeq shuda.

   YE PEHLE KYUN NAHI CHALTA THA (asal wajah, andaza nahi)
   -------------------------------------------------------
   Microsoft ka WebSocket handshake in headers ke bagair qubool nahi karta:
       Origin: chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold
       User-Agent: ...Edg/143.0.0.0       Pragma / Cache-Control
   Browser ka `new WebSocket(url)` API custom headers bhejne hi NAHI deta —
   ye JavaScript ki apni hadd hai, hamara bug nahi. Is liye purana JS wala
   Edge code WebView mein hamesha khamoshi se mar jata tha (default OFF pada tha).

   ILAJ: WebSocket ab KOTLIN mein hai (MainActivity.kt -> object EdgeTts).
   Native side par header ki koi pabandi nahi. JS sirf SSML banata hai, Kotlin
   MP3 wapas deta hai. Browser mein (jahan bridge nahi) purana WS raasta
   fallback ke taur par maujood hai — wo sirf Edge browser mein chalega.
   ═══════════════════════════════════════════════════════════════════════════ */
var EDGE_TTS = {
  token: "6A5AA1D4EAFF4E9FB37E23D68491D6F4",
  wss: "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1",
  ver: "1-143.0.3650.75",
  TIMEOUT: 20000,
  audio: null,
  ws: null,
  pend: {},          /* reqId -> { done, fail, to } — native bridge ke chalte kaam */
  seq: 0,
  spoke: 0,          /* kitni dafa Edge ne sach much awaaz di */
  lastErr: "",       /* aakhri asal ghalati ka matn (status yahi sach dikhata hai) */
  live: null,        /* Microsoft se aayi live awaaz list (jab mil jaye) */

  /* Maya ke liye chuni hui awaazein. ur-PK / ur-IN wale Microsoft ki
     live voices/list se lafz-ba-lafz tasdeeq shuda hain. */
  VOICES: [
    { id: "ur-PK-UzmaNeural",               label: "🇵🇰 Uzma — Urdu (Pakistan)",    lang: "ur-PK", g: "f" },
    { id: "ur-PK-AsadNeural",               label: "🇵🇰 Asad — Urdu (Pakistan)",    lang: "ur-PK", g: "m" },
    { id: "ur-IN-GulNeural",                label: "🇮🇳 Gul — Urdu (India)",        lang: "ur-IN", g: "f" },
    { id: "ur-IN-SalmanNeural",             label: "🇮🇳 Salman — Urdu (India)",     lang: "ur-IN", g: "m" },
    { id: "hi-IN-SwaraNeural",              label: "🇮🇳 Swara — Hindi",             lang: "hi-IN", g: "f" },
    { id: "hi-IN-MadhurNeural",             label: "🇮🇳 Madhur — Hindi",            lang: "hi-IN", g: "m" },
    { id: "en-IN-NeerjaNeural",             label: "🇮🇳 Neerja — English (India)",  lang: "en-IN", g: "f" },
    { id: "en-IN-PrabhatNeural",            label: "🇮🇳 Prabhat — English (India)", lang: "en-IN", g: "m" },
    { id: "en-US-AvaMultilingualNeural",    label: "🌍 Ava — Multilingual",         lang: "en-US", g: "f" },
    { id: "en-US-EmmaMultilingualNeural",   label: "🌍 Emma — Multilingual",        lang: "en-US", g: "f" },
    { id: "en-US-AndrewMultilingualNeural", label: "🌍 Andrew — Multilingual",      lang: "en-US", g: "m" },
    { id: "en-US-AriaNeural",               label: "🇺🇸 Aria — English (US)",       lang: "en-US", g: "f" },
    { id: "en-GB-SoniaNeural",              label: "🇬🇧 Sonia — English (UK)",      lang: "en-GB", g: "f" }
  ],

  /* Kotlin ka bridge maujood hai? Sirf tab Edge sach much chal sakta hai. */
  native: function () {
    try { return !!(typeof NATIVE !== "undefined" && NATIVE && window.MayaBridge && window.MayaBridge.edgeTts); }
    catch (e) { return false; }
  },

  xml: function (t) {
    return String(t === null || t === undefined ? "" : t)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  },

  /* settings ka rate 1.0 -> "+0%" , 1.2 -> "+20%"  (Edge ki hadd ke andar) */
  rateStr: function (r) {
    var n = Math.round(((+r || 1) - 1) * 100);
    if (n > 100) n = 100;
    if (n < -50) n = -50;
    return (n >= 0 ? "+" : "") + n + "%";
  },
  /* settings ka pitch 1.05 -> "+2Hz" , 1.5 -> "+25Hz" */
  pitchStr: function (p) {
    var n = Math.round(((+p || 1) - 1) * 50);
    if (n > 50) n = 50;
    if (n < -50) n = -50;
    return (n >= 0 ? "+" : "") + n + "Hz";
  },
  langOf: function (v) {
    var m = /^([a-z]{2}-[A-Za-z]{2,4})-/.exec(String(v || ""));
    return m ? m[1] : "en-US";
  },
  has: function (id) {
    var i, L = EDGE_TTS.live || EDGE_TTS.VOICES;
    for (i = 0; i < L.length; i++) if (L[i].id === id) return true;
    return false;
  },

  /* Kaunsi awaaz bolegi?   user ki pasand  >  zubaan + persona  >  Uzma
     Maya larki hai — default zanana. Jarvis / Friday par mardana. */
  pick: function () {
    var s = (typeof settings === "object" && settings) ? settings : {};
    var chosen = String(s.edgeVoice || "").trim();
    if (chosen && EDGE_TTS.has(chosen)) return chosen;
    if (chosen && /^[a-z]{2}-[A-Za-z]{2,4}-[A-Za-z]+Neural$/.test(chosen)) return chosen;

    var per = String(s.persona || "maya");
    var want = (per === "jarvis" || per === "friday") ? "m" : "f";
    var lang = String(s.tts || "ur-PK");
    var base = lang.split("-")[0];
    var i, first = "", v;
    for (i = 0; i < EDGE_TTS.VOICES.length; i++) {
      v = EDGE_TTS.VOICES[i];
      if (v.lang === lang) { if (v.g === want) return v.id; if (!first) first = v.id; }
    }
    for (i = 0; i < EDGE_TTS.VOICES.length; i++) {
      v = EDGE_TTS.VOICES[i];
      if (v.lang.split("-")[0] === base) { if (v.g === want) return v.id; if (!first) first = v.id; }
    }
    return first || "ur-PK-UzmaNeural";
  },

  ssml: function (text, voice, lang, rate, pitch) {
    return "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='" +
      EDGE_TTS.xml(lang || EDGE_TTS.langOf(voice)) + "'><voice name='" + EDGE_TTS.xml(voice) +
      "'><prosody pitch='" + EDGE_TTS.xml(pitch || "+0Hz") + "' rate='" + EDGE_TTS.xml(rate || "+0%") +
      "'>" + EDGE_TTS.xml(text) + "</prosody></voice></speak>";
  },

  /* base64 MP3 -> bajti hui awaaz. Blob na mile to data: URL par gir jao. */
  playB64: function (b64, onDone, onFail) {
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
    if (!url) { onFail("DECODE"); return; }
    var a;
    try { a = new Audio(); } catch (e) { onFail("AUDIO_BLOCKED"); return; }
    EDGE_TTS.audio = a;
    function cleanup() {
      if (revoke) { try { URL.revokeObjectURL(url); } catch (e) {} }
      EDGE_TTS.audio = null;
    }
    a.onended = function () { cleanup(); onDone(); };
    a.onerror = function () { cleanup(); onFail("AUDIO_BLOCKED"); };
    a.src = url;
    var pr;
    try { pr = a.play(); } catch (e) { cleanup(); onFail("AUDIO_BLOCKED"); return; }
    if (pr && pr["catch"]) pr["catch"](function () { onFail("AUDIO_BLOCKED"); });
  },

  /* Microsoft se poori live awaaz list (sirf native; koi key nahi lagti) */
  refresh: function (cb) {
    if (!EDGE_TTS.native() || !window.MayaBridge.edgeVoices) { if (cb) cb(null); return; }
    var raw;
    try { raw = window.MayaBridge.edgeVoices(); } catch (e) { if (cb) cb(null); return; }
    try {
      var r = JSON.parse(raw);
      if (+r.status !== 200) { if (cb) cb(null); return; }
      var arr = JSON.parse(r.body), out = [], i, v;
      for (i = 0; i < arr.length; i++) {
        v = arr[i];
        if (!v || !v.ShortName) continue;
        out.push({
          id: v.ShortName,
          label: String(v.FriendlyName || v.ShortName).replace(/^Microsoft\s+/, "").replace(/\s+Online \(Natural\)/, ""),
          lang: v.Locale,
          g: (String(v.Gender) === "Female" ? "f" : "m")
        });
      }
      if (out.length) { EDGE_TTS.live = out; if (cb) cb(out); return; }
    } catch (e) {}
    if (cb) cb(null);
  }
};

/* Kotlin ka jawab yahan girta hai: window.__edgeDone(reqId, ok, base64Mp3 | error) */
window.__edgeDone = function (reqId, ok, payload) {
  var p = EDGE_TTS.pend[reqId];
  if (!p) return;                                   /* stop() ho chuka — chup raho */
  delete EDGE_TTS.pend[reqId];
  try { clearTimeout(p.to); } catch (e) {}
  if (!ok) { EDGE_TTS.lastErr = String(payload || "edge nakaam"); p.fail("NETWORK"); return; }
  EDGE_TTS.lastErr = "";
  EDGE_TTS.playB64(payload, function () { EDGE_TTS.spoke++; p.done(); }, p.fail);
};

function edgeTTS_stop() {
  var k;
  for (k in EDGE_TTS.pend) {
    if (Object.prototype.hasOwnProperty.call(EDGE_TTS.pend, k)) {
      try { clearTimeout(EDGE_TTS.pend[k].to); } catch (e) {}
    }
  }
  EDGE_TTS.pend = {};
  try {
    if (EDGE_TTS.audio) {
      EDGE_TTS.audio.pause();
      EDGE_TTS.audio.onended = null; EDGE_TTS.audio.onerror = null;
      EDGE_TTS.audio = null;
    }
  } catch (e) {}
  try {
    if (EDGE_TTS.ws) {
      EDGE_TTS.ws.onmessage = null; EDGE_TTS.ws.onerror = null; EDGE_TTS.ws.onclose = null;
      EDGE_TTS.ws.close(); EDGE_TTS.ws = null;
    }
  } catch (e) {}
}

/* ═══ WAHID DARWAZA: native pehle, browser WS sirf majboori mein ═══ */
function edgeTTS_speak(text, voiceName, lang, rate, pitch, onDone, onFail) {
  var voice = voiceName || EDGE_TTS.pick();
  var ssml = EDGE_TTS.ssml(text, voice, lang || EDGE_TTS.langOf(voice), rate, pitch);
  var fired = false;
  function done() { if (!fired) { fired = true; onDone(); } }
  function fail(c) { if (!fired) { fired = true; onFail(c || "NETWORK"); } }

  if (EDGE_TTS.native()) {
    EDGE_TTS.seq++;
    var id = "e" + EDGE_TTS.seq + "_" + Date.now();
    EDGE_TTS.pend[id] = {
      done: done, fail: fail,
      to: setTimeout(function () {
        delete EDGE_TTS.pend[id];
        EDGE_TTS.lastErr = "Edge ne waqt par jawab nahi diya";
        fail("TIMEOUT");
      }, EDGE_TTS.TIMEOUT)
    };
    try { window.MayaBridge.edgeTts(ssml, id, EDGE_TTS.TIMEOUT - 3000); }
    catch (e) {
      try { clearTimeout(EDGE_TTS.pend[id].to); } catch (e2) {}
      delete EDGE_TTS.pend[id];
      EDGE_TTS.lastErr = String(e && e.message ? e.message : e);
      fail("BRIDGE");
    }
    return;
  }
  edgeTTS_ws(ssml, done, fail);
}

/* ─── BROWSER FALLBACK ───────────────────────────────────────────────────────
   Sirf Microsoft Edge browser mein chalta hai. Chrome / Firefox / WebView mein
   Microsoft handshake rad kar deta hai (custom header ja hi nahi sakta) — phir
   bhi rakha hai taake app browser mein bhi poori koshish kare, aur nakami par
   asal wajah EDGE_TTS.lastErr mein likh jaye. */
async function edgeTTS_ws(ssml, onDone, onFail) {
  try {
    if (typeof WebSocket !== "function" || typeof crypto === "undefined" || !crypto.subtle) { onFail("MODEL"); return; }
    var sec = Math.floor(Date.now() / 1000);
    var ticks = ((sec - (sec % 300)) + 11644473600) * 1e7;
    var buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ticks.toFixed(0) + EDGE_TTS.token));
    var arr = new Uint8Array(buf), hex = "", i;
    for (i = 0; i < arr.length; i++) hex += (arr[i] < 16 ? "0" : "") + arr[i].toString(16);
    var cid = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()) + String(Math.random())).replace(/[^a-f0-9]/g, "");
    var url = EDGE_TTS.wss + "?TrustedClientToken=" + EDGE_TTS.token + "&Sec-MS-GEC=" + hex.toUpperCase() +
              "&Sec-MS-GEC-Version=" + EDGE_TTS.ver + "&ConnectionId=" + cid;
    var ws = new WebSocket(url);
    EDGE_TTS.ws = ws;
    var chunks = [], done = false;
    var to = setTimeout(function () {
      if (!done) { done = true; try { ws.close(); } catch (e) {} onFail("TIMEOUT"); }
    }, 12000);
    ws.onopen = function () {
      /* Timestamp ki wahi shakl jo edge-tts bhejta hai. ssml message ke
         timestamp par aakhir mein ek fazool "Z" lagta hai — ye Microsoft ki
         apni aadat hai, ise hataao to server chup ho jata hai. */
      var ts = new Date().toUTCString().replace("GMT", "GMT+0000 (Coordinated Universal Time)");
      ws.send("X-Timestamp:" + ts + "\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n" +
        "{\"context\":{\"synthesis\":{\"audio\":{\"metadataoptions\":{\"sentenceBoundaryEnabled\":\"false\",\"wordBoundaryEnabled\":\"false\"},\"outputFormat\":\"audio-24khz-48kbitrate-mono-mp3\"}}}}\r\n");
      ws.send("X-RequestId:" + cid + "\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:" + ts + "Z\r\nPath:ssml\r\n\r\n" + ssml);
    };
    ws.onmessage = function (ev) {
      if (done) return;
      if (typeof ev.data === "string") {
        if (ev.data.indexOf("Path:turn.end") >= 0) {
          done = true; clearTimeout(to);
          try { ws.close(); } catch (e) {}
          EDGE_TTS.ws = null;
          if (!chunks.length) { onFail("NO_AUDIO"); return; }
          var b, a2;
          try { b = new Blob(chunks, { type: "audio/mpeg" }); a2 = new Audio(URL.createObjectURL(b)); }
          catch (e) { onFail("DECODE"); return; }
          EDGE_TTS.audio = a2;
          a2.onended = function () { EDGE_TTS.audio = null; EDGE_TTS.spoke++; onDone(); };
          a2.onerror = function () { EDGE_TTS.audio = null; onFail("AUDIO_BLOCKED"); };
          var pp;
          try { pp = a2.play(); } catch (e) { onFail("AUDIO_BLOCKED"); return; }
          if (pp && pp["catch"]) pp["catch"](function () { onFail("AUDIO_BLOCKED"); });
        }
      } else if (ev.data && ev.data.arrayBuffer) {
        ev.data.arrayBuffer().then(function (ab) {
          if (ab.byteLength > 2) {
            var hlen = new DataView(ab).getUint16(0);
            if (ab.byteLength > hlen + 2) chunks.push(ab.slice(hlen + 2));
          }
        });
      }
    };
    ws.onerror = function () {
      if (!done) { done = true; clearTimeout(to); EDGE_TTS.lastErr = "browser ka WebSocket custom header nahi bhej sakta"; onFail("NETWORK"); }
    };
    ws.onclose = function () {
      if (!done) { done = true; clearTimeout(to); EDGE_TTS.lastErr = "browser ka WebSocket custom header nahi bhej sakta"; onFail("NETWORK"); }
    };
  } catch (e) { onFail("NETWORK"); }
}

