
"use strict";
/* ================= MAYA v2.1.1 — Doctor Build ================= */
window.__mayaJSOK = true;
try { document.getElementById("dbgBadge").textContent = "v5.13.0 OK \u2713"; } catch(e){}
try { if (window.MayaBridge && window.MayaBridge.markAlive) window.MayaBridge.markAlive(); } catch(e){}

/* ---------- SETTINGS (v1 migration ke saath) ---------- */
var DEFAULTS = { name:"Sir", apikey:"", groqKey:"", ghKey:"", cerebrasKey:"", mistralKey:"", orKey:"", nvidiaKey:"", zaiKey:"", llm7Key:"", ttsKey:"", voiceEngine:"auto", gVoice:"Kore", voiceMood:"auto", neuralWifiOnly:false, neuralMaxChars:1400, edgeTTS:true, edgeVoice:"", fishKey:"", fishVoice:"", fishVoiceName:"", fishTemp:0.35, fishOn:true, trustMode:false, fastShort:false, wakeDoor:15, micZoom:0.8, micNear:true, ttsModel:"", city:"Hyderabad", stt:"ur-PK", tts:"ur-PK", rate:1.0, pitch:1.05, voiceName:"", voiceArtist:"maya", model:"auto", autoListen:false, voiceOn:true, wakeWord:false, turbo:true, notifSpeak:false, batteryAlert:true, gender:"male", phone:"", musicApp:"youtube", favSong:"", ytChannel:"", assistName:"Maya", gfMode:false, persona:"maya", remember:true, convoMode:false, lang:"roman-ur", proactive:false, theme:"obsidian", accent:"#FF7A1A", radius:18, fontScale:1, edgeGlow:false, ntfyTopic:"", ntfyOn:false, cloudCode:"" };
var settings = Object.assign({}, DEFAULTS);
try {
  var s1 = JSON.parse(localStorage.getItem("maya_settings") || "null");
  var s0 = JSON.parse(localStorage.getItem("jarvisSettings") || "null"); // v1 se upgrade
  [s0, s1].forEach(function(src){ if (src) Object.keys(src).forEach(function(k){ settings[k] = src[k]; }); });
} catch(e){}
function saveSettings(){
  localStorage.setItem("maya_settings", JSON.stringify(settings));
  /* v5.12.0 — wake service ko hamesha wahi zubaan do jo UI dikha raha hai.
     Video review (2026-10-19): wake_lang "hi-IN" atka tha jabke settings
     "ur-PK" dikha raha thi. Service har start par ye pref padhti hai —
     sirf sync rakhna zaroori hai. */
  try {
    if (typeof NATIVE !== "undefined" && NATIVE && window.MayaBridge && window.MayaBridge.setPrefString) {
      window.MayaBridge.setPrefString("wake_lang", settings.stt || "en-IN");
    }
  } catch (e) {}
}

/* ---------- MEMORY ---------- */
var facts = [];
try { facts = JSON.parse(localStorage.getItem("maya_facts") || "[]"); } catch(e){}
function saveFacts(){ localStorage.setItem("maya_facts", JSON.stringify(facts.slice(0, 100))); renderFacts(); hudRefresh(); }

/* ---------- SMART DIARY (Phase 7) ---------- */
var diary = [];
try { diary = JSON.parse(localStorage.getItem("maya_diary") || "[]"); } catch(e){}
function saveDiary(){ try { localStorage.setItem("maya_diary", JSON.stringify(diary.slice(-1000))); } catch(e){} }
var memorySummary = "";
try { memorySummary = localStorage.getItem("maya_summary") || ""; } catch(e){}
var _fileIndex = [];
var replyCache = {};
try { replyCache = JSON.parse(localStorage.getItem("maya_cache") || "{}"); } catch(e){}
function cacheKey(t){ return String(t).toLowerCase().replace(/[^a-z0-9\u0600-\u06FF\u0900-\u097F ]/g, "").replace(/\s+/g, " ").trim(); }
var ACTION_WORDS = /(alarm|timer|reminder|call|phone|whatsapp|message|sms|open|khol|chalao|play|baja|download|file|pdf|photo|screenshot|search|khojo|dhoond|wiki|wikipedia|fetch|yaad rakh|diary|battery|mausam|weather|share|youtube|google|average|nikalo|calculate|convert|kitna|kitne)/i;
/* Purani ACTION_WORDS regex haath se likhi thi aur 33 mein se 12 tools use
   NAZAR HI NAHI AATE the (brightness/torch/volume/reminder/namaz…). Ab har
   tool apne trigger khud deta hai — AMAL.TRIGGERS — aur regex UNHI se banti hai. */
function needsTools(t){
  try {
    if (typeof AMAL === "object" && AMAL && FLAGS.on("poolTools")) return AMAL.actionRe().test(t);
  } catch (e) {}
  return ACTION_WORDS.test(t);
}

function cachePut(k, v){ var ks = Object.keys(replyCache); if (ks.length > 60) { for (var i = 0; i < 15; i++) delete replyCache[ks[i]]; } replyCache[k] = { t: Date.now(), text: v }; try { localStorage.setItem("maya_cache", JSON.stringify(replyCache)); } catch(e){} }

/* ---------- CHAT HISTORY ---------- */
var chatHist = [];
try { chatHist = JSON.parse(localStorage.getItem("maya_chat") || "[]"); } catch(e){}
function persistChat(){ try { localStorage.setItem("maya_chat", JSON.stringify(chatHist.slice(-300))); } catch(e){} }

/* ---------- DOM ---------- */
var $ = function(s){ return document.querySelector(s); };
var orb = $("#orb"), statusText = $("#statusText"), interimEl = $("#interim"),
    log = $("#log"), txt = $("#txt"), statusPill = $("#statusPill"),
    micBtn = $("#micBtn"), dot = $("#dot"), chatState = $("#chatState");

/* ---------- STATE ---------- */
var listening = false, speaking = false, thinking = false;
var timers = [], modelIdx = 0;
var MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
var audioCtx = null, wakeLock = null, deferredInstall = null;

/* ---------- HELPERS ---------- */
function esc(s){ return String(s).replace(/[&<>"']/g, function(c){
  return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c];
});}
function toast(msg){
  var t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toast._h); toast._h = setTimeout(function(){ t.classList.remove("show"); }, 2400);
}
function now(){ return new Date().toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"}); }
var sysLogs = [];
function pushLog(msg){
  sysLogs.unshift({ t: now(), m: msg });
  sysLogs = sysLogs.slice(0, 12);
  var ul = $("#syslog"); if (!ul) return;
  ul.innerHTML = sysLogs.map(function(l){ return "<li>[" + esc(l.t) + "] <b>" + esc(l.m) + "</b></li>"; }).join("");
}

/* ---------- TABS ---------- */
function showTab(id){
  document.querySelectorAll(".tab").forEach(function(t){ t.classList.toggle("active", t.id === id); });
  document.querySelectorAll("nav button").forEach(function(b){ b.classList.toggle("active", b.dataset.tab === id); });
}
document.querySelectorAll("nav button").forEach(function(b){
  b.addEventListener("click", function(){ showTab(b.dataset.tab); });
});

