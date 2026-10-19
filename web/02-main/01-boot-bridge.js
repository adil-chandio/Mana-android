/* ---------- SPLASH / BOOT (Doctor Build — fail-proof) ---------- */
var booted = false;
function finishBoot(){
  try { $("#splash").classList.add("gone"); $("#app").classList.add("on"); } catch(e){ __mayaForceEnter(); }
  try {
    pushLog("MAYA v5.11.0 — SYSTEMS ONLINE  (SMART-PRO: wajah se baat)");
    pushLog(settings.apikey ? "NEURAL LINK: READY" : "NEURAL LINK: NO API KEY");
    pushLog("MEMORY BANK: " + facts.length + " FACTS");
    if (window.MayaBridge) pushLog("NATIVE BRIDGE: ACTIVE");
    if (window.__oldWebview) pushLog("OLD WEBVIEW: Chrome " + window.__webviewMajor + " — update karo!");
  } catch(e){}
  /* v4.1.0: purana WebView par non-blocking warning (2.5s baad) */
  if (window.__oldWebview) setTimeout(function(){
    try { toast("⚠ Purana WebView (Chrome " + window.__webviewMajor + ") — Play Store se 'Android System WebView' update karo"); } catch(e){}
  }, 2500);
  try { if (settings.voiceOn) speak("Maya online. Sab systems ready, " + settings.name + ".", false); } catch(e){}
  try { greetMiniRefresh(); } catch(e){}
  /* SAFE MODE (v3.0): v2.9 jaisi stability — boot par auto-listening/pending_wake band.
     Wake word ab bhi kaam karta hai jab app khuli ho (Settings se ON karo). */
}
$("#bootBtn").addEventListener("click", function(){
  if (booted) return; booted = true;
  try {
    ensureAudio();
    var lines = ["CALIBRATING VOICE ENGINE", "LOADING MEMORY BANK", "ESTABLISHING NEURAL LINK", "ALL SYSTEMS ONLINE"];
    var i = 0;
    var iv = setInterval(function(){
      try {
        if (i < lines.length) { $("#bootLine").textContent = lines[i]; chime([520, 660, 880][i % 3], 0.09); i++; }
        else { clearInterval(iv); finishBoot(); }
      } catch (err) { clearInterval(iv); window.onerror(String(err), "", "boot"); finishBoot(); }
    }, 520);
  } catch (err) {
    window.onerror(String(err), "", "boot-click");
    finishBoot();
  }
});
/* Safety net: 9s mein boot na ho to khud andar */
setTimeout(function(){ if (!booted) { booted = true; finishBoot(); } }, 9000);
/* ALWAYS-ON: 1.2s mein khud andar — INITIALIZE ki zaroorat nahi! */
setTimeout(function(){ if (!booted) { booted = true; finishBoot(); } }, 1200);
function greetMiniRefresh(){
  var h = new Date().getHours();
  var p = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : h < 21 ? "Good evening" : "Good night";
  $("#greetMini").textContent = p + ", " + settings.name;
}

/* ---------- AUDIO ---------- */
function ensureAudio(){
  if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){} }
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
}
function chime(freq, dur, delay){
  ensureAudio(); if (!audioCtx) return;
  try {
    var t0 = audioCtx.currentTime + (delay || 0);
    var o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = "sine"; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (dur || 0.3));
    o.connect(g); g.connect(audioCtx.destination);
    o.start(t0); o.stop(t0 + (dur || 0.3) + 0.05);
  } catch(e){}
}
function bootChime(){ chime(440, 0.18); chime(587, 0.18, 0.16); chime(880, 0.35, 0.32); }
function alarmBeep(){ for (var i = 0; i < 3; i++) chime(880, 0.42, i * 0.6); }

async function requestWakeLock(){
  try {
    if ("wakeLock" in navigator && settings.autoListen && !wakeLock) wakeLock = await navigator.wakeLock.request("screen");
  } catch(e){}
}
document.addEventListener("visibilitychange", function(){ if (document.visibilityState === "visible") requestWakeLock(); });

/* ---------- NATIVE BRIDGE (APK build — window.MayaBridge) ---------- */
var NATIVE = !!(window.MayaBridge);
var lastWasVoice = false;
window.__nativeTtsDone = function(v2){ /* v5.9.5 unified handler — old version dropped callbacks */
  try { var _why = String(v2 || "");
    if (_why && _why !== "done" && typeof pushLog === "function") pushLog("TTS: device tier " + _why);
  } catch(e){}
  speaking = false;
  try { SUKOON.bolEnd(); } catch (e) {}
  try { if (AWAAZ.deviceDone) AWAAZ.deviceDone(); } catch (e) {}
  afterSpeak(lastWasVoice);
};
/* v5.9.5: Kotlin 12s utterance watchdog — system TTS ka onDone/onError bhool jaye
   (Tecno/HiOS par aam) to JS khud azaad ho jata hai, mic-pipeline atki nahi. */
window.__nativeTtsWatch = function(ms){
  try {
    if (window.__ttsWatchT) { clearTimeout(window.__ttsWatchT); window.__ttsWatchT = null; }
    window.__ttsWatchT = setTimeout(function(){
      window.__ttsWatchT = null;
      if (typeof speaking !== "undefined" && speaking) {
        try { pushLog("TTS: native utterance watchdog — atka device TTS azaad"); } catch(e){}
        window.__nativeTtsDone("watchdog");
      }
    }, ms || 12000);
  } catch(e){}
};
window.__nativeTtsStatus = function(s){
  try { pushLog("TTS ENGINE: " + s + " — on-device awaaz is session mein off"); } catch(e){}
};
/* 🎙️ Android ab SAARE andaze bhejta hai (pehle sirf pehla aata tha).
   SUNO un mein se behtareen chunta hai, Roman Urdu banata hai, aur
   pise hue naam (Monarch / Instagram / Funk Taka) theek karta hai. */
window.__nativeSpeech = function(text, altsJson){
  listening = false; try { SUKOON.sunEnd(); } catch (e) {} setOrb("idle");
  var alts = [];
  try { if (altsJson) alts = JSON.parse(altsJson); } catch (e) { alts = []; }
  if (!alts.length && text) alts = [text];
  var said = text || "";
  try {
    if (typeof SUNO !== "undefined") {
      said = SUNO.heard(alts);
      /* 🎯 P8b — Android ka yaqeen bohat kam? ghalat kaam karne se behtar poochh lo */
      if (SUNO.weak() && FLAGS.on("suno")) {
        pushLog("SUNO: kam yaqeen (" + SUNO.lastConf.toFixed(2) + ") \u2014 poochh rahi hoon");
        addBubble("ai", "\uD83D\uDC42 Theek se sunai nahi diya \u2014 \u201C" + said + "\u201D kaha tha? Dobara boliye.");
        try { if (typeof AWAAZ === "object") AWAAZ.speak("Theek se sunai nahi diya, dobara boliye", {}); } catch (e) {}
        return;
      }
      if (SUNO.last && SUNO.last.raw !== said && typeof pushLog === "function")
        pushLog("SUNO: \"" + String(SUNO.last.raw).slice(0, 26) + "\" -> \"" + String(said).slice(0, 26) + "\"");
    }
  } catch (e) { said = text || ""; }
  if (said && said.trim()) handleUserText(said.trim(), true);
};
window.__nativePartial = function(t){ try { interimEl.textContent = t || ""; } catch(e){} };
window.__nativeRms = function(db){
  try {
    /* Issue 2 mic pickup: log amplitude every 12th RMS sample (~every 3s)
       so weak-pickup complaints can be verified from the system log. */
    if (!window.__rmsLogT) window.__rmsLogT = 0;
    window.__rmsLogT++;
    if (window.__rmsLogT % 12 === 0) try { pushLog("MIC: " + Math.round(db || 0) + " dB (alive)"); } catch (e) {}
    var pct = Math.max(4, Math.min(100, Math.round(((db || 0) + 2) * 5)));
    document.querySelectorAll(".micbar").forEach(function(el){ el.style.width = pct + "%"; });
  } catch(e){}
};
window.__nativeSpeechErr = function(code){
  listening = false; try { SUKOON.sunEnd(); } catch (e) {} setOrb("idle"); interimEl.textContent = "";
  var m = { 1:"Network timeout", 2:"Network error", 3:"Mic masla", 4:"Recognizer busy", 5:"Voice service error", 6:"Koi awaz nahi mili", 7:"Mic permission nahi" }[code] || "Voice error";
  toast(m);
  addBubble("ai", m + ". " + (code === 5 || code === 2 ? "Google app / voice service check karo aur dobara try karo." : "Dobara try karo, " + settings.name + "."));
};

/* ---------- TTS ---------- */
var synth = window.speechSynthesis;
var voices = [];
function loadVoices(){ voices = synth ? synth.getVoices() : []; }
if (synth) { loadVoices(); synth.onvoiceschanged = loadVoices; }
function pickVoice(lang){
  var base = (lang || "ur").split("-")[0].toLowerCase();
  for (var i = 0; i < voices.length; i++) {
    var vl = (voices[i].lang || "").replace("_","-").toLowerCase();
    if (vl === String(lang).toLowerCase()) return voices[i];
    if (vl.indexOf(base) === 0 && base !== "en") return voices[i];
  }
  if (base === "en") for (var j = 0; j < voices.length; j++) if ((voices[j].lang||"").toLowerCase().indexOf("en") === 0) return voices[j];
  return null;
}
