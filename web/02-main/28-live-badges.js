/* ---------- AWAAZ ka live badge + status (sach hi dikhta hai) ---------- */
function awaazBadge(){
  if (!settings.voiceOn || settings.voiceEngine === "off") return "🔇 AWAAZ: OFF";
  var st = AWAAZ.status();
  if (st.engine === "fish") return "🐟 AWAAZ: FISH";
  if (st.engine === "neural") return "🎭 AWAAZ: NEURAL";
  if (st.engine === "edge") return "🌊 AWAAZ: EDGE";
  if (st.engine === "device") return "📱 AWAAZ: PHONE";
  return st.ready ? "🎭 AWAAZ: NEURAL" : "📱 AWAAZ: PHONE";
}
function awaazFillSelects(){
  var vs = $("#sGVoice"), ms = $("#sVoiceMood"), i, o;
  if (vs && !vs.options.length) {
    for (i = 0; i < GEMINI_VOICES.length; i++) {
      o = document.createElement("option");
      o.value = GEMINI_VOICES[i].id;
      o.textContent = GEMINI_VOICES[i].label + (GEMINI_VOICES[i].g === "f" ? "  (F)" : "  (M)");
      vs.appendChild(o);
    }
  }
  if (ms && !ms.options.length) {
    for (i = 0; i < VOICE_MOODS.length; i++) {
      o = document.createElement("option");
      o.value = VOICE_MOODS[i].id; o.textContent = VOICE_MOODS[i].label;
      ms.appendChild(o);
    }
  }
  edgeFillVoices();
  fishFillVoices();
  try { labPaint(); } catch (e) {}
}

/* 🌊 EDGE ka awaaz-picker. "auto" pehle — zubaan/persona dekh kar khud chunta hai. */
function edgeFillVoices(){
  var es = $("#sEdgeVoice"), i, o, L;
  if (!es || typeof EDGE_TTS !== "object" || !EDGE_TTS) return;
  var keep = es.value || (typeof settings === "object" && settings ? (settings.edgeVoice || "") : "");
  L = EDGE_TTS.live || EDGE_TTS.VOICES;
  es.innerHTML = "";
  o = document.createElement("option");
  o.value = ""; o.textContent = "🪄 Auto — zubaan aur persona ke hisaab se";
  es.appendChild(o);
  for (i = 0; i < L.length; i++) {
    o = document.createElement("option");
    o.value = L[i].id;
    o.textContent = L[i].label + "   (" + L[i].id + ")";
    es.appendChild(o);
  }
  es.value = keep;
  if (es.value !== keep) es.value = "";
  edgePaintHint();
}

/* Sach bolne wala hint — jhoothi tasalli nahi */
function edgePaintHint(){
  var h = $("#edgeHint");
  if (!h || typeof EDGE_TTS !== "object" || !EDGE_TTS) return;
  var v = EDGE_TTS.pick();
  if (EDGE_TTS.native()) {
    h.className = "ui-hint ok";
    h.textContent = "✅ Chalne ko tayyar — abhi: " + v + (EDGE_TTS.spoke ? ("  •  " + EDGE_TTS.spoke + " dafa bol chuki") : "") + "  •  koi key nahi, koi hadd nahi";
  } else {
    h.className = "ui-hint warn";
    h.textContent = "⚠️ Sirf APK mein chalti hai — browser ka WebSocket Microsoft ke zaroori headers nahi bhej sakta. Abhi ki pasand: " + v;
  }
}
/* 🐟 FISH ka awaaz picker — library aa jaye to usse, warna sirf "default" */
function fishFillVoices(){
  var fs = $("#sFishVoice"), i, o, L;
  if (!fs || typeof FISH !== "object" || !FISH) return;
  /* 🔒 settings hamesha SACH hai — dropdown nahi. (Pehle boot ke waqt dropdown
     khali hota tha aur SAVE dabate hi fishVoice "" ho kar KHO jati thi.) */
  var sv = (typeof settings === "object" && settings) ? settings : {};
  var keep = sv.fishVoice || fs.value || "";
  L = FISH.loadLib() || [];
  fs.innerHTML = "";
  o = document.createElement("option");
  o.value = ""; o.textContent = "🪄 Default awaaz (Fish khud chunta hai)";
  fs.appendChild(o);
  for (i = 0; i < L.length; i++) {
    o = document.createElement("option");
    o.value = L[i].id;
    o.textContent = L[i].title + (L[i].langs ? ("  [" + L[i].langs + "]") : "") + (L[i].likes ? ("  ❤" + L[i].likes) : "");
    fs.appendChild(o);
  }
  /* jo awaaz mehfooz hai wo list mein na ho to bhi zinda rahe */
  if (keep) {
    var found = false;
    for (i = 0; i < fs.options.length; i++) if (fs.options[i].value === keep) { found = true; break; }
    if (!found) {
      o = document.createElement("option");
      o.value = keep;
      o.textContent = "🎙️ " + (sv.fishVoiceName || (keep.slice(0, 8) + "\u2026")) + "   (mehfooz)";
      fs.appendChild(o);
    }
  }
  fs.value = keep;
  if (fs.value !== keep) fs.value = keep;

  /* 🔒 awaaz chunte hi FORAN mehfooz — SAVE dabane ka intezar nahi.
     (User ne awaaz chuni, app band ki, aur setting kho gayi — yehi bug tha.) */
  if (!fs.__wired) {
    fs.__wired = true;
    fs.addEventListener("change", function () {
      var id = fs.value || "";
      var nm = "";
      var LL = FISH.loadLib() || [], z;
      for (z = 0; z < LL.length; z++) if (LL[z].id === id) { nm = LL[z].title; break; }
      settings.fishVoice = id;
      settings.fishVoiceName = nm;
      saveSettings();
      pushLog("FISH AWAAZ: " + (nm || id || "auto") + " (mehfooz)");
      toast(id ? ("\uD83C\uDFA4 " + (nm || "awaaz") + " \u2014 mehfooz \u2713") : "\uD83E\uDE84 Auto awaaz");
      fishPaintHint();
    });
  }
  fishPaintHint();
}

/* Sach bolne wala hint */
function fishPaintHint(){
  var h = $("#fishHint");
  if (!h || typeof FISH !== "object" || !FISH) return;
  var st = FISH.status();
  if (st.ready) {
    h.className = "ui-hint ok";
    var vn = FISH.voiceName();
    h.textContent = "✅ Tayyar" + (vn ? ("  •  🎤 " + vn) : "  •  🪄 auto awaaz") +
                    (st.spoke ? ("  •  " + st.spoke + " dafa boli") : "") +
                    "  •  lehja: " + (FISH.temp() <= 0.4 ? "sthir" : "jazbaati");
  } else {
    h.className = "ui-hint warn";
    h.textContent = "⚠️ " + FISH.why(st.block || "KEY_MISSING");
  }
}

/* ---------- BRAIN POOL ka live naqsha ---------- */
function paintPool(){
  try {
    var live = BRAIN.liveCount();
    var el = $("#poolLive"); if (el) el.textContent = String(live);
    var h = $("#poolHint");
    if (h) h.className = "ui-hint" + (live >= 2 ? " ok" : (live === 1 ? " warn" : ""));
  } catch (e) {}
}
function poolReport(){
  var st = BRAIN.status(), out = [], i, j;
  out.push("🧠 BRAIN POOL v" + BRAIN.VER + " — " + BRAIN.liveCount() + " dimaag zinda\n");
  for (i = 0; i < st.length; i++) {
    var p = st[i], line = p.icon + " " + p.name;
    if (p.keyless) line += "  [bina key]";
    var tags = [];
    for (j = 0; j < p.rows.length; j++) {
      var r = p.rows[j];
      if (r.state === "LIVE") tags.push("✅ key" + (r.ki + 1));
      else if (r.state === "NO_KEY") tags.push("— key nahi");
      else tags.push("⏳ key" + (r.ki + 1) + " " + r.state + (r.cool ? " " + r.cool + "s" : ""));
    }
    out.push(line + "\n     " + tags.join("  ") + "\n     " + p.free + (p.signup && p.signup !== "—" ? "  ·  " + p.signup : ""));
  }
  out.push("\n💡 Kisi bhi key ke saamne comma laga kar doosri key daalo — quota dugna.");
  return out.join("\n");
}

function paintAwaaz(){
  try {
    var st = AWAAZ.status();
    var el = $("#awaazStatus");
    if (el) {
      var line;
      if (!settings.voiceOn || st.mode === "off") line = "🔇 Maya khamosh hai";
      else if (st.mode === "device") line = "📱 Phone ki awaaz — 0 data, foran";
      else if (st.ready) line = "🎭 Gemini neural tayyar — <b>" + st.voice + "</b> · " + st.mood + " · " + st.liveKeys + "/" + st.keys + " key zinda";
      else if (st.keyless) line = "🌸 Muft neural awaaz chalegi — " + st.why + (st.cooldown ? " (" + st.cooldown + "s)" : "");
      else line = "📱 Abhi phone ki awaaz — " + st.why + (st.cooldown ? " (" + st.cooldown + "s)" : "");
      el.innerHTML = line;
      el.className = "ui-hint" + (st.ready && st.mode !== "device" ? " ok" : (st.mode === "off" ? "" : " warn"));
    }
    var vp = $("#voicePool");
    if (vp) {
      var rows = AWAAZ.keyReport(), out = [], i;
      out.push("🎙️ AWAAZ POOL v" + AWAAZ.VER);
      if (!rows.length) out.push("  💎 Gemini TTS — koi key nahi");
      for (i = 0; i < rows.length; i++)
        out.push("  💎 Gemini key" + rows[i].i + (rows[i].now ? " (abhi yahi)" : "") + " — " + (rows[i].state === "LIVE" ? "✅ LIVE" : "⏳ " + rows[i].state + " " + rows[i].cool + "s"));
      out.push("  🌸 Muft neural (bina key) — " + (st.keyless ? "✅ LIVE" : "⏳ " + Math.round((AWAAZ.pollenBad - Date.now()) / 1000) + "s"));
      out.push("  📱 Phone ki awaaz — ✅ hamesha");
      out.push("");
      out.push("💡 Gemini TTS ka muft quota sirf ~15 request ROZ hai.");
      out.push("   Quota KEY par nahi, PROJECT par lagta hai — is liye EK HI account");
      out.push("   ki 3 keys ka koi faida nahi. ALAG Google account se key banao.");
      out.push("   Neeche 🩺 button se pata chal jayega ke asal masla kya hai.");
      vp.textContent = out.join("\n");
    }
    var w = $("#awaazWhy");
    if (w) {
      w.textContent = st.engine === "-" ? "Test karo — niche likha aayega ke kis engine ne bola."
        : ("Aakhri dafa: " + (st.engine === "neural" ? "🎭 NEURAL (" + st.voice + ")" : st.engine === "free" ? "🌸 MUFT NEURAL" : st.engine === "edge" ? "🌊 EDGE" : st.engine === "device" ? "📱 PHONE" : "🔇 OFF")
           + (st.err ? " — " + AWAAZ.why(st.err) : "") + " · cache " + st.cache + " (" + st.cacheHits + " hits)");
    }
    var mu = $("#qMute"); if (mu) mu.textContent = awaazBadge();
  } catch (e) {}
}

