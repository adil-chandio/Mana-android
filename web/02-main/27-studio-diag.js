/* ---------- VOICE STUDIO (Phase 3.5) ---------- */
function populateVoiceSelect(){
  var sel = $("#sVoice"); if (!sel) return;
  var list = [];
  try {
    if (NATIVE) {
      var arr = JSON.parse(window.MayaBridge.ttsVoices() || "[]");
      arr.forEach(function(v){ list.push({ name: v.name, label: v.name + " [" + v.locale + (v.network ? " • ONLINE-NATURAL" : "") + "]" }); });
    } else if (synth) {
      loadVoices();
      voices.forEach(function(v){ list.push({ name: v.name, label: v.name + " [" + v.lang + "]" }); });
    }
  } catch(e){}
  sel.innerHTML = '<option value="">Auto (engine default)</option>' +
    list.map(function(v){ return '<option value="' + esc(v.name) + '">' + esc(v.label) + "</option>"; }).join("");
  sel.value = settings.voiceName || "";
  settings._voiceCount = list.length;
}
$("#sPitch").addEventListener("input", function(){ $("#pitchVal").textContent = Number(this.value).toFixed(2); });
(function(_b){ if (_b) _b.addEventListener("click", function(){
  var sample = "Assalam-o-alaikum " + settings.name + "! Main Maya hoon — abhi aap meri nayi awaaz test kar rahe hain. Kaisi lag rahi hoon?";
  var vName = $("#sVoice").value, rate = parseFloat($("#sRate").value) || 1, pit = parseFloat($("#sPitch").value) || 1.05;
  if (NATIVE) {
    try { window.MayaBridge.speak(sample, settings.tts, rate, pit, vName); toast("Testing selected voice..."); return; } catch(e){}
  }
  if (synth) {
    try {
      synth.cancel();
      var u = new SpeechSynthesisUtterance(sample);
      u.lang = settings.tts; u.rate = rate; u.pitch = pit;
      loadVoices();
      if (vName) for (var i = 0; i < voices.length; i++) if (voices[i].name === vName) { u.voice = voices[i]; break; }
      else { var pv = pickVoice(settings.tts); if (pv) u.voice = pv; }
      synth.speak(u);
      toast("Testing selected voice...");
    } catch(e){ toast("Is browser mein TTS nahi"); }
  } else toast("Awaz engine nahi mila");
}); })($("#testVoice"));

/* ---------- DIAGNOSTICS ---------- */
(function(_b){ if (_b) _b.addEventListener("click", function(){
  var out = [];
  out.push("MAYA v5.9.5 — DOCTOR REPORT");
  out.push("TIME: " + new Date().toLocaleString());
  out.push("UA: " + String(navigator.userAgent).slice(0, 90));
  out.push("WEBVIEW: Chrome " + window.__webviewMajor + (window.__oldWebview ? " (PURANA < 87 — update karo!)" : " (OK ✅)"));
  out.push("NATIVE WEBVIEW PKG: " + (window.MayaBridge && window.MayaBridge.webViewVersion ? window.MayaBridge.webViewVersion() : "n/a (web mode)"));
  out.push("UI KIT: v5 IRONCLAD" + (function(){ try { var r = MayaUI.selfTest(); return " \u2014 " + r.visible + " controls visible, " + r.invisible + " invisible " + (r.ok ? "\u2705" : "\u274C"); } catch(e){ return " \u2014 selfTest fail"; } })());
  out.push("MIN WEBVIEW: Chrome 55+ (app script), 87+ (best look)");
  out.push("CSS COMPAT: color-mix " + (window.__noColorMix ? "NO (fallback chal raha)" : "YES") +
           " • accent-color " + (window.__noAccentCol ? "NO (fallback)" : "YES") +
           " • flex-gap " + (window.__noFlexGap ? "NO (margin fallback)" : "YES"));
  try { out.push("SETTINGS SCROLL: " + (function(){ var t = document.getElementById("tab-set");
        return t ? (t.scrollHeight > t.clientHeight ? "scrollable ✅ (" + t.scrollHeight + "/" + t.clientHeight + "px)" : "content fits (" + t.scrollHeight + "px)") : "n/a"; })()); } catch (e) {}
  out.push("MAYA BRIDGE (APK): " + (window.MayaBridge ? "YES ✅" : "NO — web/PWA mode"));
  try { localStorage.setItem("_mayaT", "1"); localStorage.removeItem("_mayaT"); out.push("STORAGE: OK ✅"); }
  catch (e) { out.push("STORAGE: FAIL ❌ — " + e.message); }
  out.push("WEB TTS: " + (window.speechSynthesis ? "available" : "not available"));
  out.push("WEB STT: " + ((window.SpeechRecognition || window.webkitSpeechRecognition) ? "available" : "not available"));
  try {
    var ac = new (window.AudioContext || window.webkitAudioContext)();
    out.push("AUDIO: OK ✅ (" + ac.state + ")");
    if (ac.close) ac.close();
  } catch (e) { out.push("AUDIO: FAIL ❌"); }
  if (window.MayaBridge) {
    try { out.push("NATIVE BATTERY: " + window.MayaBridge.battery()); } catch (e) { out.push("NATIVE BATTERY: FAIL ❌"); }
    try { window.MayaBridge.speak("Diagnostic test complete, " + settings.name + ".", settings.tts, settings.rate); out.push("NATIVE TTS: TEST BOLA ✅"); } catch (e) { out.push("NATIVE TTS: FAIL ❌"); }
  }
  out.push("WAKE WORD: " + (settings.wakeWord ? "ON" : "OFF") + (NATIVE ? "" : " (sirf APK)"));
  out.push("TTS VOICES: " + (settings._voiceCount != null ? settings._voiceCount : "0") + " available");
  (function(){
    out.push("");
    out.push(poolReport());
  })();
  (function(){
    var L = DIMAAG.lines();
    out.push("");
    for (var i = 0; i < L.length; i++) out.push(L[i]);
    out.push("");
  })();
  (function(){
    var a = AWAAZ.status();
    out.push("");
    out.push("── AWAAZ ENGINE v" + AWAAZ.VER + " ──");
    out.push("MODE: " + a.mode + "  |  AAKHRI ENGINE: " + a.engine);
    out.push("VOICE: " + a.voice + "  |  MOOD: " + a.mood);
    out.push("MODEL: " + (AWAAZ.model || "abhi tay nahi"));
    out.push("NEURAL READY: " + (a.ready ? "HAAN ✅" : "NAHI — " + a.why));
    if (a.cooldown) out.push("COOLDOWN: " + a.cooldown + "s");
    out.push("CACHE: " + a.cache + " clips, " + a.cacheHits + " hits, " + AWAAZ.spoke + " neural clips bole");
    out.push("");
  })();
  out.push("LAST ERROR: " + (window.__mayaErr || "koi nahi ✅"));
  if (window.__errLog && window.__errLog.length) {
    out.push("CONSOLE ERRORS (" + window.__errLog.length + "):");
    for (var _e = Math.max(0, window.__errLog.length - 5); _e < window.__errLog.length; _e++) out.push("  • " + window.__errLog[_e]);
  }
  var el = $("#diagOut");
  el.style.display = "block";
  el.textContent = out.join("\n");
  toast("Diagnostics tayyar — screenshot kar lena");
}); })($("#diagBtn"));

/* ---------- CHAT EVENTS ---------- */
if (orb) orb.addEventListener("click", startListening);
micBtn.addEventListener("click", startListening);
(function(_b){ if (_b) _b.addEventListener("click", function(){
  if (!NATIVE) return toast("Vision sirf APK mein");
  pendingVisionPrompt = "Ye photo dekho aur mukhtasir Roman Urdu mein batado ye kya hai, kya likha hai.";
  var okc = false;
  try { okc = window.MayaBridge.takePhoto() === true; } catch(e){}
  if (okc) toast("Camera khol rahi hoon — khincho! 📸");
}); })($("#camBtn"));
$("#send").addEventListener("click", sendText);
txt.addEventListener("keydown", function(e){ if (e.key === "Enter") sendText(); });
function sendText(){
  var v = txt.value.trim(); if (!v) return;
  txt.value = ""; stopListening(); handleUserText(v, false);
}
$("#qStop").addEventListener("click", function(){
  stopListening();
  geminiTTS_stop();
  if (NATIVE) { try { window.MayaBridge.stopSpeak(); } catch(e){} }
  if (synth) try { synth.cancel(); } catch(e){}
  speaking = false; try { SUKOON.bolEnd(); } catch (e) {} thinking = false; setOrb("idle");
});
$("#qAuto").addEventListener("click", function(){
  settings.autoListen = !settings.autoListen; saveSettings(); paintQuick();
  if (NATIVE) { try { window.MayaBridge.keepScreenOn(settings.autoListen); } catch(e){} }
  if (settings.autoListen) requestWakeLock();
  else if (wakeLock) { try { wakeLock.release(); wakeLock = null; } catch(e){} }
});
$("#qMute").addEventListener("click", function(){
  settings.voiceOn = !settings.voiceOn; saveSettings(); paintQuick(); paintAwaaz();
  if (!settings.voiceOn) { AWAAZ.stop(); speaking = false; try { SUKOON.bolEnd(); } catch (e) {} setOrb("idle"); }
});
function paintQuick(){
  var a = $("#qAuto"), mu = $("#qMute");
  a.textContent = "🔁 AUTO: " + (settings.autoListen ? "ON" : "OFF");
  a.classList.toggle("on", settings.autoListen);
  mu.textContent = awaazBadge();
  mu.classList.toggle("on", !settings.voiceOn);
  hudRefresh();
}

