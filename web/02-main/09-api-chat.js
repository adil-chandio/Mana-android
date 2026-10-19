/* ---------- PUBLIC API: poori app sirf isi se bolti hai ---------- */
function speak(text, wasVoice) {
  var clean = cleanSpeech(text);
  lastWasVoice = wasVoice;
  if (!clean) { AWAAZ.stop(); afterSpeak(wasVoice); return; }
  try { SUKOON.bolStart(); } catch (e) {}   /* 🎚️ fetch ki 1-2s bhi cover — mic abhi nahi khul sakta */
  AWAAZ.speak(clean, {
    onStart: function (eng) {
      speaking = true; try { SUKOON.bolStart(); } catch (e) {} setOrb("speaking");
      try { NAAP.mark("voice"); NAAP.cur && (NAAP.cur.engine = eng || AWAAZ.engine); } catch (e) {}   /* 📊 P0 */
    },
    onDone: function () {
      speaking = false; try { SUKOON.bolEnd(); } catch (e) {}
      try { NAAP.end({ engine: AWAAZ.engine, saaf: (NAAP.cur && NAAP.cur.saafHit) || 0 }); } catch (e) {}  /* 📊 P0 */
      afterSpeak(wasVoice);
    }
  });
}

/* purana naam — kuch jagah abhi bhi call hota hai */
function nativeSpeak(clean, wasVoice) {
  lastWasVoice = wasVoice;
  AWAAZ.stop(); AWAAZ.gen++;
  AWAAZ.setEngine("device");
  speaking = true; try { SUKOON.bolStart(); } catch (e) {} setOrb("speaking");
  AWAAZ.device(String(clean || ""), function () { speaking = false; try { SUKOON.bolEnd(); } catch (e) {} afterSpeak(wasVoice); });
}

function afterSpeak(wasVoice){
  setOrb("idle");
  if (!wasVoice) return;
  /* 🚪 P8a — YEHI wo bug tha: wake mode ON hote hi Maya HAR jawab ke baad khud
     sunna shuru kar deti thi, bina "Maya" kahe. Ab sirf tab jab DARWAZA khula ho. */
  if (settings.wakeWord) {
    try {
      if (typeof KAAN !== "undefined" && KAAN.DARWAZA.isOpen()) {
        KAAN.DARWAZA.open();                       /* baat chal rahi hai -> waqt barha do */
        setTimeout(startListening, 350);
      }
    } catch (e) {}
    return;
  }
  if (settings.autoListen) setTimeout(startListening, 350);
}

function reply(text, wasVoice, link){
  /* 🤝 SACH — model par bharosa nahi, JAANCH. Aakhri amal sure:false tha aur
     jawab mein "bhej diya / ho gaya" likha hai? To app KHUD theek kar degi. */
  try { if (typeof HAQEEQAT !== "undefined") text = HAQEEQAT.check(text); } catch (e) {}
  addBubble("ai", text, link);
  chatHist.push({ role:"model", text:text }); persistChat();
  speak(text, wasVoice);
}

/* ---------- TEST VOICE (AWAAZ SUNO) — bolta bhi hai, batata bhi hai ---------- */
function testMayaVoice() {
  var vId = AWAAZ.voiceId(), mId = AWAAZ.moodId();
  var vLabel = vId, i;
  for (i = 0; i < GEMINI_VOICES.length; i++) if (GEMINI_VOICES[i].id === vId) vLabel = GEMINI_VOICES[i].label;
  var sample = "Assalam-o-alaikum " + (settings.name || "Boss") + "! Main " + (settings.assistName || "Maya") +
               " hoon, aap ki apni AI. Ye meri awaaz hai — " + vId + ". Kaisi lagi?";
  AWAAZ.speak(sample, {
    onStart: function (eng) {
      speaking = true; try { SUKOON.bolStart(); } catch (e) {} setOrb("speaking");
      toast(eng === "fish" ? "🐟 Fish Audio..." : (eng === "neural" ? "🎭 Neural awaaz aa rahi hai..." : (eng === "edge" ? "🌊 Edge TTS..." : "📱 Phone ki awaaz")));
      pushLog("VOICE TEST: " + eng + " / " + vId + " / " + mId);
    },
    onDone: function () {
      speaking = false; try { SUKOON.bolEnd(); } catch (e) {} setOrb("idle");
      var st = AWAAZ.status();
      if (st.engine === "neural") toast("🎭 NEURAL bola — " + vLabel);
      else toast("📱 PHONE ki awaaz — " + (st.why || "neural abhi maujood nahi"));
      paintAwaaz();
    }
  });
}

/* ---------- STT ---------- */
var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
var rec = null;
function startListening(){
  if (NATIVE) {
    if (listening) { stopListening(); return; }
    if (thinking) return;
    ensureAudio(); chime(660, 0.08);
    listening = true; try { SUKOON.sunStart(); } catch (e) {} setOrb("listening"); interimEl.textContent = "🎧 Native mic sun raha hai...";
    try { window.MayaBridge.listen(settings.stt); }
    catch(e){ listening = false; try { SUKOON.sunEnd(); } catch (e) {} setOrb("idle"); toast("Mic start nahi ho saka"); }
    return;
  }
  if (!SR) { reply("Sir, is browser mein voice input support nahi — Chrome try karo. Filhaal type kar ke baat kar sakte hain.", false); return; }
  if (listening) { stopListening(); return; }
  if (thinking) return;
  ensureAudio(); chime(660, 0.08);
  try { rec = new SR(); } catch(e){ return; }
  rec.lang = settings.stt; rec.interimResults = true; rec.maxAlternatives = 1;
  listening = true; try { SUKOON.sunStart(); } catch (e) {} setOrb("listening"); interimEl.textContent = "";
  rec.onresult = function(e){
    var fin = "", intr = "";
    for (var i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) fin += e.results[i][0].transcript;
      else intr += e.results[i][0].transcript;
    }
    if (intr) interimEl.textContent = intr;
    if (fin && fin.trim()) { interimEl.textContent = ""; handleUserText(fin.trim(), true); }
  };
  rec.onerror = function(e){
    listening = false; try { SUKOON.sunEnd(); } catch (e) {} setOrb("idle"); interimEl.textContent = "";
    var m = {
      "not-allowed": "Mic ki permission nahi mili — browser settings mein microphone allow karo (page HTTPS par hona chahiye).",
      "service-not-allowed": "Mic service blocked — page ko Chrome mein HTTPS par kholo.",
      "audio-capture": "Microphone nahi mil raha.",
      "no-speech": "",
      "language-not-supported": "Is zubaan ka voice support nahi — Settings mein Hindi (hi-IN) ya English (en-IN) select karo."
    }[e.error] || "Voice error — dobara try karo.";
    if (m) { addBubble("ai", m); pushLog("MIC ERROR: " + e.error); }
  };
  rec.onend = function(){ listening = false; try { SUKOON.sunEnd(); } catch (e) {} interimEl.textContent = ""; if (!speaking) setOrb("idle"); };
  try { rec.start(); } catch(e){ listening = false; try { SUKOON.sunEnd(); } catch (e) {} }
}
function stopListening(){
  if (NATIVE) { try { window.MayaBridge.stopListen(); } catch(e){} }
  if (rec) { try { rec.stop(); } catch(e){} }
  listening = false; try { SUKOON.sunEnd(); } catch (e) {} setOrb("idle");
}

/* ---------- ORB / STATUS ---------- */
function setOrb(state){
  if (orb) orb.dataset.state = state;
  setCharState(state);
  micBtn.classList.toggle("listening", state === "listening");
  dot.className = "dot" + (state === "listening" ? " listening" : state === "thinking" ? " thinking" : "");
  var map = { idle:"MAYA READY", listening:"SUN RAHI HOON...", thinking:"SOCH RAHI HOON...", speaking:"BOL RAHI HOON..." };
  chatState.textContent = map[state] || "MAYA READY";
  statusText.textContent = state === "idle" ? "TAP TO SPEAK" : map[state] || "";
  statusPill.textContent = (NATIVE ? "APK • " : "") + DIMAAG.pill();
  statusPill.classList.toggle("ok", DIMAAG.lastOk > 0 && Date.now() - DIMAAG.lastOk < 900000);
  hudRefresh();
}
var mayaChar = document.getElementById("mayaChar");
var charStatusEl = document.getElementById("charStatus");
function setCharState(state){
  if (!mayaChar) return;
  mayaChar.dataset.state = state;
  var labels = { idle:"TAP TO SPEAK", listening:"\uD83D\uDC42\uFE0F LISTENING...", thinking:"\uD83E\uDDE0 THINKING...", speaking:"\uD83D\uDDE3\uFE0F SPEAKING..." };
  if (charStatusEl) charStatusEl.textContent = labels[state] || "TAP TO SPEAK";
  var hairs = mayaChar.querySelectorAll(".char-hair");
  var hc = { idle:"#22d3ee", listening:"#34d399", thinking:"#fbbf24", speaking:"#818cf8" };
  hairs.forEach(function(h){ h.style.fill = hc[state] || hc.idle; });
  var ribbons = mayaChar.querySelectorAll(".char-hair-ribbon");
  var rc = { idle:"#f472b6", listening:"#34d399", thinking:"#fbbf24", speaking:"#a78bfa" };
  ribbons.forEach(function(r){ r.style.fill = rc[state] || rc.idle; });
}
if (mayaChar) { mayaChar.addEventListener("click", function(){ startListening(); }); mayaChar.dataset.state = "idle"; }

/* ---------- CHAT UI ---------- */
var BUBBLE_SAY = [];      /* index -> asal matn (escaping ke jhamele se bachne ke liye) */
function addBubble(who, text, link){
  var row = document.createElement("div");
  row.className = "row " + (who === "user" ? "me" : "ai");
  var b = document.createElement("div"); b.className = "bubble";
  var label = who === "user" ? esc(settings.name).toUpperCase() : "MAYA";
  if (who !== "user" && typeof SAAF !== "undefined") { var _s = SAAF.usable(text); if (_s) text = _s; }   /* 🧹 P1: soch kabhi DIKHE na */
  b.innerHTML = "<span class='who'>" + label + "</span>" + esc(text) +
    (link ? "<br><a href='" + esc(link) + "' target='_blank' rel='noopener'>🔗 Open karo</a>" : "");
  if (who !== "user") {
    /* 📊 TRACE — kaunse dimaag ne socha, kaunsa tool chala, kis awaaz ne bola */
    try {
      var _tl = (typeof TRACE !== "undefined") ? TRACE.line() : "";
      if (_tl) {
        var tc = document.createElement("div");
        tc.className = "ui-hint";
        tc.style.cssText = "margin-top:7px;font-size:9.5px;opacity:.62;letter-spacing:.3px";
        tc.textContent = _tl;
        b.appendChild(tc);
      }
    } catch (e) {}
    var idx = BUBBLE_SAY.push(String(text || "")) - 1;      /* v4.2.0: dobara suno */
    var sb = document.createElement("button");
    sb.type = "button"; sb.className = "say-btn"; sb.textContent = "🔊";
    sb.setAttribute("data-say", String(idx));
    sb.setAttribute("aria-label", "Ye jawab dobara suno");
    b.appendChild(sb);
  }
  row.appendChild(b); log.appendChild(row);
  while (log.children.length > 80) log.removeChild(log.firstChild);
  log.scrollTop = log.scrollHeight;
}
/* ek hi listener poore chat par (bubbles aate jate rehte hain) */
(function(){
  if (!log) return;
  log.addEventListener("click", function (e) {
    var t = e.target;
    if (!t || !t.getAttribute) return;
    var i = t.getAttribute("data-say");
    if (i === null) return;
    var txt = BUBBLE_SAY[parseInt(i, 10)];
    if (!txt) return;
    if (t.getAttribute("data-on") === "1") {           /* dobara dabao = rok do */
      AWAAZ.stop(); speaking = false; try { SUKOON.bolEnd(); } catch (e) {} setOrb("idle"); t.textContent = "🔊"; t.removeAttribute("data-on"); return;
    }
    var prev = log.querySelector(".say-btn[data-on='1']");
    if (prev) { prev.textContent = "🔊"; prev.removeAttribute("data-on"); }
    t.textContent = "⏹"; t.setAttribute("data-on", "1");
    speak(txt, false);
    var watch = setInterval(function () {
      if (!speaking) { clearInterval(watch); t.textContent = "🔊"; t.removeAttribute("data-on"); }
    }, 400);
  });
})();

/* ---------- MAIN HANDLER ---------- */
function stripWake(t){ return t.replace(/^\s*(hey\s+)?(maya|maywa|mya|maaya|boss)[\s,.!:-]*/i, "").trim(); }
function handleUserText(text, wasVoice){
  var stripped = stripWake(text) || text;
  /* 🛑 AMAL kill words — pehle STOP, phir kuch aur (guardrail) */
  try { if (typeof MAYA_AMAL !== "undefined" && MAYA_AMAL.isStop(stripped)) { MAYA_AMAL.stop(); return; } } catch (e) {}
  addBubble("user", stripped);
  chatHist.push({ role:"user", text:stripped }); persistChat();
  /* 🎙️ jo naam aap KHUD likhte ho (Monarch, Funk Taka…) wo hamesha ke liye yaad —
     agli dafa awaaz se bologe to SUNO unhen pehchan lega */
  try { if (typeof SUNO !== "undefined" && !wasVoice) SUNO.learn(stripped); } catch (e) {}
  try { if (typeof HAQEEQAT !== "undefined") HAQEEQAT.clear(); } catch (e) {}
  try { if (typeof TRACE !== "undefined") TRACE.start(); } catch (e) {}
  if (typeof NAAP !== "undefined") NAAP.start(wasVoice ? "voice" : "text");   /* 📊 P0 */

  /* ⟲ / 📜 — ye do sawal app khud jaanti hai */
  if (typeof LEDGER !== "undefined" && FLAGS.on("ijazat")) {
    if (LEDGER.ASK_TODAY.test(stripped)) { reply(LEDGER.today(), wasVoice); return; }
    if (LEDGER.ASK_UNDO.test(stripped)) {
      LEDGER.undo().then(function (r) { reply(r.say, wasVoice); });
      return;
    }
  }

  /* ⚡ BIJLI — 🟢 SABZ kaam DIMAAG SE PEHLE, ~50ms mein. Internet ke bina bhi. */
  if (typeof BIJLI !== "undefined") {
    var _bm = BIJLI.match(stripped);
    if (_bm) {
      (function (m) {
        var t0 = (new Date()).getTime();
        BIJLI.mark(m.tool);
        try { NAAP.mark("tool"); NAAP.cur && (NAAP.cur.tool = m.tool); } catch (e) {}
        execTool(m.tool, m.args).then(function (out) {
          var ms = (new Date()).getTime() - t0;
          pushLog("BIJLI: " + m.tool + " " + ms + "ms (dimaag se pehle)");
          var okb = !!(out && out.ok !== false && out.done !== false);
          if (!okb) { askAI(wasVoice); return; }          /* nakaam? dimaag ko de do */
          try { NAAP.mark("brain"); NAAP.cur && (NAAP.cur.brain = "\u26A1 BIJLI"); TRACE.brain("\u26A1 BIJLI", ms); } catch (e) {}
          reply(BIJLI.say(m.tool, m.args, out), wasVoice);
        }, function () { askAI(wasVoice); });
      })(_bm);
      return;
    }
  }

  /* 👑 MALIK — "tumhe kis ne banaya?" ka jawab dimaag se poochhne ki zaroorat nahi */
  if (typeof MALIK !== "undefined" && FLAGS.on("malik") && MALIK.ASK.test(stripped)) {
    NAAP.mark("brain");
    reply(MALIK.pick(stripped, false), wasVoice);
    pushLog("MALIK: ta'aruf diya");
    return;
  }

  var local = tryLocal(stripped, wasVoice);
  if (local) {
    if (local.reply !== "") {
      if (local.url) setTimeout(function(){ openURL(local.url); }, 900);
      reply(local.reply, wasVoice, local.link);
      pushLog("CMD: " + stripped.slice(0, 34));
    }
    return;
  }
  _activeSkill = skillFor(stripped);
  var st = trySmalltalk(stripped);
  if (st) { reply(st, wasVoice); return; }
  if (!settings.apikey && !settings.groqKey && !settings.ghKey) {
    reply("Ye sawal ke liye mujhe dimaag chahiye, " + settings.name + " — Settings (⚙️) mein FREE Gemini ya Groq key daalo (2 minute ka kaam). Local commands chal rahe hain!", wasVoice);
    return;
  }
  askAI(wasVoice);
}

/* ---------- MEMORY ---------- */
function memHandle(q){
  var m = q.match(/(?:yaad rakhna hai ki|yaad rakhna|yaad rakho|yad rakho|yaad karo|yaad karna hai|remember that|remember|note karo|note down|note)\s*[:\-]?\s+(.{2,200})/i);
  if (m) {
    facts.unshift(m[1].trim()); saveFacts();
    pushLog("MEMORY SAVED: " + m[1].trim().slice(0, 26));
    return "Yaad rakh liya, " + settings.name + " 🧷 — " + m[1].trim();
  }
  if (/(kya yaad|kuch yaad|yaad kya hai|yaad hai|what do you remember|zehan mein kya)/.test(q)) {
    if (!facts.length) return "Abhi mera memory bank khali hai, " + settings.name + ". Kaho: 'yaad rakhna ki ...' aur main hamesha ke liye yaad rakh lungi.";
    return "Mujhe ye " + facts.length + " cheezein yaad hain: " + facts.slice(0, 8).join("; ") + ".";
  }
  return null;
}
function renderFacts(){
  var ul = $("#factList"); if (!ul) return;
  ul.innerHTML = facts.length ? "" : "<li style='border:none;background:none;color:var(--dim);font-size:12px'>— Khali —</li>";
  facts.forEach(function(f, idx){
    var li = document.createElement("li");
    li.innerHTML = "<span>" + esc(f) + "</span>";
    var del = document.createElement("button"); del.textContent = "🗑️"; del.title = "Delete";
    del.onclick = function(){ facts.splice(idx, 1); saveFacts(); toast("Memory delete ho gayi"); };
    li.appendChild(del); ul.appendChild(li);
  });
}

