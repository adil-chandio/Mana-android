
"use strict";
/* ================= MAYA v4.0 OBSIDIAN MODULE =================
   Personas (Maya/Friday/Venom) • GF Mode • Theme Engine • Languages
   Home Orb wiring • Memories CRUD • Proactive Mode • Drawer
   (core brain untouched — yeh sab wrappers hain) */

/* ---------- cleanSpeech FIX (yeh function core mein call hota tha par defined nahi tha — v4 fix) ---------- */
function cleanSpeech(text){
  var t = String(text || "");
  if (typeof SAAF !== "undefined") t = SAAF.usable(t) || t;   /* 🧹 P1: soch kabhi BOLI na jaye */
  t = t.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");                       /* markdown link → text */
  t = t.replace(/https?:\/\/\S+/g, " ");                                /* raw URLs hatao */
  t = t.replace(/[\uD83C\uDC00-\uD83E\uDEFF\u2600-\u27BF\uFE0F\u2190-\u21FF\u2B00-\u2BFF]/gu, " "); /* emojis */
  t = t.replace(/[*_`#>|~]/g, " ");                                     /* markdown symbols */
  t = t.replace(/\s+/g, " ").trim();
  if (t.length > 1800) t = t.slice(0, 1800) + "...";                    /* v4.2.0: engine khud chunks mein torta hai */
  return t;
}

/* ---------- PERSONAS ---------- */
var MAYA_PERSONAS = {
  maya:   { label:"Maya",   emoji:"💜", pitch:1.05, rate:1.00,
            prompt:"PERSONA: You are MAYA — warm, witty, fiercely loyal best friend. Playful but sharp, caring, light sci-fi flair." },
  friday: { label:"Friday", emoji:"🤖", pitch:1.12, rate:1.05,
            prompt:"PERSONA: You are FRIDAY — crisp professional assistant (like Iron Man's FRIDAY). Efficient, precise, minimal words, respectful — but still warm." },
  venom:  { label:"Venom",  emoji:"🐍", pitch:0.78, rate:0.92,
            prompt:"PERSONA: You are VENOM — the alien symbiote! Darkly funny, dramatic, growly, calls the user 'insaan' sometimes. Creepy-cute one-liners but deeply protective and loyal." }
};
window.MAYA_PERSONAS = MAYA_PERSONAS;
function persona(){ return MAYA_PERSONAS[settings.persona] || MAYA_PERSONAS.maya; }
function personaName(){
  return settings.persona === "venom" ? "VENOM" : settings.persona === "friday" ? "FRIDAY" : "MAYA";
}

/* ---------- sysPrompt WRAP (persona + GF + language) ---------- */
var _sysPromptCore = sysPrompt;
sysPrompt = function(){
  var p = _sysPromptCore();
  try {
    p += "\n" + persona().prompt;
    if (settings.assistName && settings.assistName !== "Maya")
      p += "\nYou also answer to the name \"" + settings.assistName + "\".";
    if (settings.gfMode === true && (settings.gender || "male") === "male")
      p += "\nGIRLFRIEND MODE ON: tum user ki pyaari girlfriend ho — Roman Urdu mein 'jaan/babu' style, caring, thori cute-possessive, par kaam ke waqt sharp aur helpful. Wholesome rakho.";
    var LR = {
      "roman-ur":"Default spoken style: Roman Urdu (Latin letters) with natural English tech words.",
      "urdu":"Always reply in Urdu script (اردو).",
      "hi-en":"Reply in Hindi + English mix (Hinglish, Latin script).",
      "hindi":"Reply in Hindi (Devanagari script).",
      "english":"Reply in English.",
      "pa":"Reply in Punjabi.", "bn":"Reply in Bengali.", "ta":"Reply in Tamil.",
      "te":"Reply in Telugu.", "mr":"Reply in Marathi.", "gu":"Reply in Gujarati.",
      "kn":"Reply in Kannada.", "ml":"Reply in Malayalam."
    };
    /* 🗣️ ZUBAAN (P1): pehle do mutazad hukm the — RULE(3) "user ki script mirror
       karo" aur LANGUAGE RULE "Reply in Hindi (Devanagari)". Model ne baad wala
       maana aur Roman Urdu bolne par Devanagari mila. Ab MIRROR pehle, setting
       sirf tab jab script ka pata na chale. */
    /* 🎯 "Maya" jaisa chhota/ambiguous jumla mila to model ANGREZI par chala jata
       tha. Ab: zubaan bhi mirror karo, aur ANGREZI sirf tab jab user ne poore
       angrezi jumle likhe hon. */
    p += "\nLANGUAGE RULE: user ki ZUBAAN aur SCRIPT dono ki naqal karo. " +
         "ANGREZI mein jawab SIRF tab jab user ne POORA jumla angrezi mein likha ho \u2014 " +
         "sirf naam ya ek lafz (jaise \u201CMaya\u201D, \u201Cok\u201D) angrezi nahi ginta. Us soorat mein " +
         "default zubaan istemal karo. " +
         "Script: " +
         "bilkul usi mein jawab do (Roman Urdu \u2192 Roman Urdu, \u0627\u0631\u062F\u0648 \u2192 \u0627\u0631\u062F\u0648, English \u2192 English, " +
         "Devanagari \u2192 Devanagari). Agar user ki script saaf pata na chale to: " +
         (LR[settings.lang || "roman-ur"] || LR["roman-ur"]);
    if (settings.remember === false) p += "\n(Auto memory save OFF hai — facts silently store mat karo.)";
    if (settings.favSong) p += "\nUser's FAVORITE SONG: " + settings.favSong + " — 'mera favorite gaana' par yehi chalao.";
    if (settings.musicApp && settings.musicApp !== "youtube") p += "\nMusic app preference: " + settings.musicApp + ".";
    if (typeof MALIK !== "undefined") p += MALIK.block();   /* \uD83D\uDC51 P1 */
    if (typeof HAQEEQAT !== "undefined") p += HAQEEQAT.rule();   /* \uD83E\uDD1D P3 */
    if (settings.convoMode) p += "\nCONVERSATION MODE: thora zyada emotional/expressive tone — real insaan jaisi feel.";
  } catch(e){}
  return p;
};

/* ---------- speak WRAP (persona voice tuning) ---------- */
var _speakCore = speak;
speak = function(text, wasVoice){
  var _r = settings.rate, _p = settings.pitch;
  try {
    var per = persona(), pr = per.rate, pp = per.pitch;
    if (settings.gfMode === true && settings.persona === "maya") { pr *= 0.98; pp = Math.min(1.4, pp + 0.08); }
    if (settings.convoMode) pr *= 0.95;
    settings.rate = _r * pr; settings.pitch = _p * pp;
  } catch(e){}
  try { return _speakCore(text, wasVoice); }
  finally { settings.rate = _r; settings.pitch = _p; }
};

/* ---------- setOrb WRAP (HUD status + home mic sync) ---------- */
var _setOrbCore = setOrb;
setOrb = function(s){
  _setOrbCore(s);
  try { var s2 = $("#statusText2"); if (s2) s2.textContent = s === "idle" ? "TAP TO SPEAK" : s.toUpperCase() + "..."; } catch(e){}
  try { $("#micHome").classList.toggle("listening", s === "listening"); } catch(e){}
};

/* ---------- addBubble WRAP (home last-reply mirror) ---------- */
var _addBubbleCore = addBubble;
addBubble = function(who, text, link){
  _addBubbleCore(who, text, link);
  try {
    var h = $("#homeLast");
    if (h && who !== "user") {
      h.innerHTML = "<span class='hl-who'>" + persona().emoji + " " + personaName() + "</span>" + esc(text);
      h.classList.add("show");
    }
  } catch(e){}
};

/* ---------- handleUserText WRAP (persona/mode voice commands) ---------- */
var _handleUserTextCore = handleUserText;
handleUserText = function(text, wasVoice){
  var t = String(text || "").toLowerCase().trim();
  var np = null;
  if (/(venom)/.test(t)) np = "venom";
  else if (/(friday)/.test(t)) np = "friday";
  else if (/(maya)/.test(t) && /(wapas|back|switch|badlo|bhalo)/.test(t)) np = "maya";
  if (np && /(bhejo|ban jao|a jao|aa jao|switch|change|mode|awaz|awaaz|voice|bolo|jao)/.test(t)) {
    settings.persona = np; saveSettings(); paintPersonas();
    var m = np === "venom" ? "Hum Venom hain. Bolo insaan. 🐍"
          : np === "friday" ? "Friday online, sir. All systems nominal. 🤖"
          : "Main wapas Maya hoon! 💜 Bolo, kya haal hai?";
    addBubble("user", text); reply(m, wasVoice);
    toast("Persona: " + MAYA_PERSONAS[np].label + " " + MAYA_PERSONAS[np].emoji);
    return;
  }
  if (/girlfriend (mode )?(on|chalao|start)/.test(t)) { settings.gfMode = true; saveSettings(); loadV4Form(); addBubble("user", text); reply("Girlfriend mode ON — ab se main sirf tumhari hoon! 💖", wasVoice); return; }
  if (/girlfriend ?(mode )?off/.test(t)) { settings.gfMode = false; saveSettings(); loadV4Form(); addBubble("user", text); reply("Girlfriend mode off — best-friend mode par wapas. 💜", wasVoice); return; }
  if (/conversation mode on/.test(t)) { settings.convoMode = true; saveSettings(); loadV4Form(); addBubble("user", text); reply("Conversation mode on — ab awaaz mein zyada feel aayegi.", wasVoice); return; }
  if (/conversation mode off/.test(t)) { settings.convoMode = false; saveSettings(); loadV4Form(); addBubble("user", text); reply("Conversation mode off — fast mode wapas.", wasVoice); return; }
  if (/(proactive|khud ba khud|khud bakhud).*(on|chalao|start)/.test(t)) { settings.proactive = true; saveSettings(); loadV4Form(); startProactive(); addBubble("user", text); reply("Proactive mode on — main beech beech mein khud tumse baat karungi.", wasVoice); return; }
  if (/(proactive|khud ba khud|khud bakhud).*(off|band|stop)/.test(t)) { settings.proactive = false; saveSettings(); loadV4Form(); addBubble("user", text); reply("Proactive mode off — chup rahungi jab tak na bolo.", wasVoice); return; }
  _handleUserTextCore(text, wasVoice);
};

/* ---------- interaction timestamp (proactive ke liye) ---------- */
var _hutInteract = handleUserText;
handleUserText = function(t, w){ MAYA_V4.lastInteract = Date.now(); return _hutInteract(t, w); };
var MAYA_V4 = { lastInteract: Date.now(), proactiveTimer: null };

/* ---------- HOME WIRING ---------- */
try { $("#micHome").addEventListener("click", startListening); } catch(e){}
try {
  $("#homeTxt").addEventListener("keydown", function(e){
    if (e.key === "Enter") { var v = this.value.trim(); if (!v) return; this.value = ""; handleUserText(v, true); }
  });
} catch(e){}
/* home quick actions — home par raho, voice reply */
document.querySelectorAll("#tab-home .qactions button").forEach(function(b){
  var nb = b.cloneNode(true); if (b.parentNode) b.parentNode.replaceChild(nb, b);
  nb.addEventListener("click", function(){ handleUserText(nb.dataset.cmd, true); });
});

/* ---------- PERSONA CHIPS ---------- */
function paintPersonas(){
  var host = $("#personaChips"); if (!host) return;
  host.innerHTML = "";
  ["maya","friday","venom"].forEach(function(k){
    var p = MAYA_PERSONAS[k];
    var b = document.createElement("button");
    b.className = "pchip" + ((settings.persona || "maya") === k ? " active" : "");
    b.textContent = p.emoji + " " + p.label.toUpperCase();
    b.onclick = function(){
      settings.persona = k; saveSettings(); paintPersonas();
      toast("Persona: " + p.label + " " + p.emoji);
    };
    host.appendChild(b);
  });
  try { $("#orbPersona").textContent = personaName(); } catch(e){}
}

/* ---------- THEME ENGINE ---------- */
var THEMES = {
  obsidian:{ name:"Midnight Obsidian", sw:["#050508","#FF7A1A"] },
  cyber:{ name:"Cyber Cyan", sw:["#050b14","#22d3ee"] },
  aurora:{ name:"Aurora Violet", sw:["#0a0614","#a78bfa"] },
  rose:{ name:"Rose Quartz", sw:["#12060b","#fb7185"] },
  forest:{ name:"Deep Forest", sw:["#04100a","#34d399"] },
  day:{ name:"Daylight", sw:["#f2f3f7","#e05e00"] },
  paper:{ name:"Warm Paper", sw:["#f7f3ea","#b45309"] }
};
var ACCENTS = ["#FF7A1A","#22d3ee","#a78bfa","#34d399","#fb7185","#fbbf24","#f87171"];
function accent2Of(a){
  var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(a); if (!m) return "#FFB347";
  var r = Math.min(255, parseInt(m[1],16)+55), g = Math.min(255, parseInt(m[2],16)+55), b = Math.min(255, parseInt(m[3],16)+55);
  return "#" + ((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
}
function applyTheme(){
  document.documentElement.className = "t-" + (settings.theme || "obsidian") + (window.__compatClass || "");
  document.documentElement.style.setProperty("--accent", settings.accent || "#FF7A1A");
  document.documentElement.style.setProperty("--accent2", accent2Of(settings.accent || "#FF7A1A"));
  document.documentElement.style.setProperty("--radius", (settings.radius || 18) + "px");
  document.documentElement.style.setProperty("--fs", String(settings.fontScale || 1));
  try { $("#edgeGlow").classList.toggle("on", !!settings.edgeGlow); } catch(e){}
  try { var mt = document.querySelector('meta[name=theme-color]'); if (mt) mt.setAttribute("content", getComputedStyle(document.body).backgroundColor); } catch(e){}
}
function renderThemeUI(){
  var tg = $("#themeGrid");
  if (tg) { tg.innerHTML = "";
    Object.keys(THEMES).forEach(function(k){
      var d = document.createElement("div");
      d.className = "tsw" + (((settings.theme || "obsidian") === k) ? " active" : "");
      d.innerHTML = '<div class="swp" style="background:linear-gradient(135deg,' + THEMES[k].sw[0] + ' 55%,' + THEMES[k].sw[1] + ')"></div><span>' + THEMES[k].name + '</span>';
      d.onclick = function(){ settings.theme = k; saveSettings(); applyTheme(); renderThemeUI(); toast("Theme: " + THEMES[k].name); };
      tg.appendChild(d);
    });
  }
  var ar = $("#accentRow");
  if (ar) { ar.innerHTML = "";
    ACCENTS.forEach(function(c){
      var b = document.createElement("button");
      b.className = "acc" + (((settings.accent || "#FF7A1A") === c) ? " active" : "");
      b.style.background = c;
      b.onclick = function(){ settings.accent = c; saveSettings(); applyTheme(); renderThemeUI(); toast("Accent color set"); };
      ar.appendChild(b);
    });
  }
}
try { $("#sEdgeGlow").addEventListener("change", function(){ settings.edgeGlow = this.checked; saveSettings(); applyTheme(); }); } catch(e){}

/* ---------- DRAWER ---------- */
try {
  var drawerEl = $("#drawer"), scrimEl = $("#drawerScrim");
  function drawerToggle(open){ drawerEl.classList.toggle("open", open); scrimEl.classList.toggle("open", open); }
  $("#drawerBtn").addEventListener("click", function(){ drawerToggle(true); });
  scrimEl.addEventListener("click", function(){ drawerToggle(false); });
  drawerEl.querySelectorAll("button.dbtn").forEach(function(b){
    b.addEventListener("click", function(){ showTab(b.dataset.tab); drawerToggle(false); });
  });
} catch(e){}
var _showTabCore = showTab;
showTab = function(id){
  _showTabCore(id);
  try { document.querySelectorAll("#drawer .dbtn").forEach(function(b){ b.classList.toggle("active", b.dataset.tab === id); }); } catch(e){}
};

/* ---------- SETTINGS GROUPS (collapsible) ----------
   v4.1.0: ab MayaUI.groups() ye kaam karta hai (.ui-head par). Ye purana
   handler sirf backward-compat ke liye chhora hai — agar kahin .setgrp bacha ho. */
document.querySelectorAll(".setgrp-head").forEach(function(h){
  h.addEventListener("click", function(){ h.parentElement.classList.toggle("open"); });
});

/* NOTE: loadV4Form / doosra saveSettings handler v5.9.5 mein khatam.
   Ab SETFORM (upar) hi settings ka wahid darwaza hai — dekho SET_FIELDS.
   Sliders live update karte hain, baqi sab SAVE par ek hi tarteeb se. */
try { $("#sRadius").addEventListener("input", function(){ $("#radiusVal").textContent = this.value; settings.radius = parseInt(this.value,10) || 18; saveSettings(); applyTheme(); }); } catch(e){}
try { $("#sFont").addEventListener("input", function(){ $("#fontVal").textContent = Number(this.value).toFixed(2); settings.fontScale = parseFloat(this.value) || 1; saveSettings(); applyTheme(); }); } catch(e){}
try { $("#sGf").addEventListener("change", function(){
  if (this.checked && ($("#sGender").value || "male") !== "male") { this.checked = false; toast("Girlfriend mode ke liye Gender = Male chuno"); }
}); } catch(e){}

try { $("#sLang").addEventListener("change", function(){
  var map = { "urdu":["ur-PK","ur-PK"], "roman-ur":["ur-PK","ur-PK"], "hi-en":["hi-IN","hi-IN"], "hindi":["hi-IN","hi-IN"], "english":["en-IN","en-IN"] };
  if (map[this.value]) { $("#sStt").value = map[this.value][0]; $("#sTts").value = map[this.value][1]; }
}); } catch(e){}
try { $("#sGender").addEventListener("change", function(){ if (this.value !== "male") { $("#sGf").checked = false; } }); } catch(e){}

/* ---------- MEMORIES SCREEN ---------- */
try {
  $("#addFactBtn").addEventListener("click", function(){
    var v = ($("#newFact").value || "").trim(); if (!v) return;
    facts.push(v); saveFacts(); $("#newFact").value = "";
    toast("Yaad save ho gayi ✅"); pushLog("MEMORY +1 (manual)");
  });
  $("#newFact").addEventListener("keydown", function(e){ if (e.key === "Enter") $("#addFactBtn").click(); });
} catch(e){}
try { $("#expBtn").addEventListener("click", function(){
  var data = { v:4, settings: settings, facts: facts, skills: customSkills };
  var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  var a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = "maya-backup-v4.json"; a.click();
  toast("Backup download ho raha hai 💾");
}); } catch(e){}

/* renderFacts override — edit/delete rows */
var _renderFactsCore = renderFacts;
renderFacts = function(){
  var host = $("#factList");
  if (!host) { _renderFactsCore(); return; }
  host.innerHTML = "";
  if (!facts.length) {
    host.innerHTML = "<li style='color:var(--text1)'>Abhi koi yaad nahi — upar se add karo, ya Maya se bolo: \"yaad rakhna ki...\"</li>";
    return;
  }
  facts.forEach(function(f, i){
    var li = document.createElement("li");
    var sp = document.createElement("span"); sp.textContent = f; sp.style.flex = "1";
    var fx = document.createElement("div"); fx.className = "fx";
    var eb = document.createElement("button"); eb.textContent = "✏️"; eb.title = "Edit";
    eb.onclick = function(){ var nv = prompt("Yaad edit karo:", facts[i]); if (nv != null && nv.trim()) { facts[i] = nv.trim(); saveFacts(); } };
    var db = document.createElement("button"); db.textContent = "🗑️"; db.title = "Delete";
    db.onclick = function(){ facts.splice(i, 1); saveFacts(); toast("Yaad mit gayi"); };
    fx.appendChild(eb); fx.appendChild(db);
    li.appendChild(sp); li.appendChild(fx);
    host.appendChild(li);
  });
  try { hudRefresh(); } catch(e){}
};

/* ---------- PROACTIVE MODE (P6 KHUD-MUKHTAR v2) ----------
   Purana tarika (har 6 min RANDOM jumla) P6 doc ke mutabiq "bay-maqsaad shor"
   tha — ab SMART_PRO (web/02-main/30-smart-pro.js) sirf WAJAH se bolti hai:
   scheduled task · aadat (LEDGER) · morning brief · fact follow-up.
   Hadain: roz max 3 · raat 11-8 chup · 10 min idle · koi wajah na to CHUP. */
function startProactive(){ if (typeof SMART_PRO !== "undefined") SMART_PRO.start(); }

/* ---------- v4 INIT ---------- */
applyTheme(); renderThemeUI(); paintPersonas(); loadV4Form(); try { renderFacts(); } catch(e){} startProactive();
try { $("#hudBuild").textContent = "v5.10.0"; } catch(e){}
try { pushLog("MAYA v5.10.0 — SMART-PRO + AUTO-UPDATE ONLINE"); } catch(e){}

/* ============================================================================
   MAYA UI KIT v5 — "IRONCLAD" runtime   (v4.1.0)
   ----------------------------------------------------------------------------
   Contract: docs/SETTINGS-UI-ARCHITECTURE.md
   Asool: state HAMESHA native form element mein rehta hai (taake poora purana
   JS — $("#sPitch").value, $("#sGf").checked, input/change events — bilkul
   waise hi chale). Dikhawa sirf div/span se banta hai, aur layout ki height
   CSS ke bharose nahi — JS naapta hai.
   Poora ES5: var / function / koi arrow, backtick ya ?. nahi.
   ========================================================================= */
var MayaUI = (function () {
  "use strict";

  function all(sel, root) {
    var n, a = [], i;
    try { n = (root || document).querySelectorAll(sel); } catch (e) { return a; }
    for (i = 0; i < n.length; i++) a.push(n[i]);
    return a;
  }
  function on(el, ev, fn) { if (el && el.addEventListener) { try { el.addEventListener(ev, fn, false); } catch (e) {} } }
  function fire(el, type) {
    try {
      var e = document.createEvent("HTMLEvents");
      e.initEvent(type, true, false);
      el.dispatchEvent(e);
    } catch (x) {}
  }
  function hasCls(el, c) { return (" " + (el.className || "") + " ").indexOf(" " + c + " ") > -1; }
  function addCls(el, c) { if (!hasCls(el, c)) el.className = ((el.className || "") + " " + c).replace(/^\s+/, ""); }
  function delCls(el, c) { el.className = (" " + (el.className || "") + " ").replace(" " + c + " ", " ").replace(/^\s+|\s+$/g, ""); }
  function num(v, d) { var n = parseFloat(v); return isNaN(n) ? d : n; }

  /* ---------------------------------------------------------------- LAYOUT
     Scroll ka guarantee: main ki height ek asli naapa hua number hai,
     kisi flexbox algorithm ka nateeja nahi. */
  function layout() {
    try {
      var win = window.innerHeight || document.documentElement.clientHeight || 640;
      var head = document.querySelector("header");
      var nav = document.querySelector("nav");
      var main = document.querySelector("main");
      if (!main) return;
      var hh = head ? head.offsetHeight : 0;
      var nh = nav ? nav.offsetHeight : 0;
      var mh = win - hh - nh;
      if (!(mh > 0) || mh < 140) mh = Math.max(140, win - 120);
      main.style.height = mh + "px";
      main.style.maxHeight = mh + "px";
      var tabs = all(".tab"), i;
      for (i = 0; i < tabs.length; i++) {
        tabs[i].style.height = mh + "px";
        tabs[i].style.maxHeight = mh + "px";
        tabs[i].style.overflowY = "auto";
      }
      return mh;
    } catch (e) { return 0; }
  }

  /* --------------------------------------------------------------- SLIDER */
  function enhanceSlider(inp) {
    if (!inp || inp.__mui) return;
    inp.__mui = 1;
    addCls(inp, "ui-native");

    var wrap = document.createElement("div");
    wrap.className = "ui-slider";
    wrap.setAttribute("data-for", inp.id || "");

    var minus = document.createElement("button");
    minus.type = "button"; minus.className = "ui-step ui-step-minus"; minus.innerHTML = "&#8722;";
    var plus = document.createElement("button");
    plus.type = "button"; plus.className = "ui-step ui-step-plus"; plus.innerHTML = "+";

    var track = document.createElement("div"); track.className = "ui-track";
    var fill = document.createElement("div"); fill.className = "ui-fill";
    var thumb = document.createElement("div"); thumb.className = "ui-thumb";
    track.appendChild(fill); track.appendChild(thumb);
    wrap.appendChild(minus); wrap.appendChild(track); wrap.appendChild(plus);

    if (inp.parentNode) inp.parentNode.insertBefore(wrap, inp.nextSibling);

    function lo() { return num(inp.min, 0); }
    function hi() { var h = num(inp.max, 100); return h > lo() ? h : lo() + 1; }
    function st() { var s = num(inp.step, 1); return s > 0 ? s : 1; }
    function pct() {
      var v = num(inp.value, lo()), p = ((v - lo()) / (hi() - lo())) * 100;
      if (!(p >= 0)) p = 0; if (p > 100) p = 100;
      return p;
    }
    function paint() {
      var p = pct();
      fill.style.width = p + "%";
      thumb.style.left = p + "%";
    }
    function setV(v, silent) {
      var a = lo(), b = hi(), s = st();
      v = Math.round((v - a) / s) * s + a;
      if (v < a) v = a; if (v > b) v = b;
      var dec = (String(s).split(".")[1] || "").length;
      v = parseFloat(v.toFixed(dec));
      if (String(v) !== String(inp.value)) {
        inp.value = v;
        if (!silent) { fire(inp, "input"); fire(inp, "change"); }
      }
      paint();
    }
    function fromX(x) {
      var r = track.getBoundingClientRect();
      var w = r.width || track.offsetWidth || 1;
      var p = (x - r.left) / w;
      if (!(p >= 0)) p = 0; if (p > 1) p = 1;
      setV(lo() + p * (hi() - lo()));
    }

    var dragging = false;
    on(track, "mousedown", function (e) { dragging = true; fromX(e.clientX); if (e.preventDefault) e.preventDefault(); });
    on(document, "mousemove", function (e) { if (dragging) fromX(e.clientX); });
    on(document, "mouseup", function () { dragging = false; });
    on(track, "touchstart", function (e) {
      dragging = true;
      if (e.touches && e.touches[0]) fromX(e.touches[0].clientX);
      if (e.preventDefault) e.preventDefault();
    });
    on(track, "touchmove", function (e) {
      if (!dragging) return;                                  /* v4.2.0: sirf apne drag ke dauran */
      if (e.touches && e.touches[0]) fromX(e.touches[0].clientX);
      /* v4.2.0 FIX: scroll shuru ho chuka ho to event cancelable nahi hota —
         wahan preventDefault() call karna console warning deta hai. */
      if (e.cancelable && e.preventDefault) e.preventDefault();
    });
    on(track, "touchend", function () { dragging = false; });
    on(track, "touchcancel", function () { dragging = false; });
    on(minus, "click", function (e) { if (e.preventDefault) e.preventDefault(); setV(num(inp.value, lo()) - st()); });
    on(plus, "click", function (e) { if (e.preventDefault) e.preventDefault(); setV(num(inp.value, lo()) + st()); });
    on(inp, "input", paint);
    on(inp, "change", paint);

    inp.__muiPaint = paint;
    inp.__muiUI = { wrap: wrap, track: track, fill: fill, thumb: thumb, minus: minus, plus: plus };
    paint();
  }

  /* --------------------------------------------------------------- SWITCH */
  function enhanceSwitch(inp) {
    if (!inp || inp.__mui) return;
    inp.__mui = 1;
    var lab = inp.parentNode;
    function paint() {
      if (!lab) return;
      if (inp.checked) addCls(lab, "is-on"); else delCls(lab, "is-on");
    }
    on(inp, "change", paint);
    on(inp, "click", function () { setTimeout(paint, 0); });
    inp.__muiPaint = paint;
    paint();
  }

  /* --------------------------------------------------------------- GROUPS */
  function groups() {
    var heads = all("#tab-set .ui-head"), i;
    for (i = 0; i < heads.length; i++) {
      (function (h) {
        if (h.__mui) return;
        h.__mui = 1;
        on(h, "click", function () {
          var g = h.parentNode;
          if (!g) return;
          if (hasCls(g, "is-open")) delCls(g, "is-open"); else addCls(g, "is-open");
          var chev = h.querySelector(".ui-chev");
          if (chev) chev.innerHTML = hasCls(g, "is-open") ? "&#9650;" : "&#9660;";
          sync();
        });
      })(heads[i]);
    }
  }

  /* ----------------------------------------------------------------- SYNC
     Jab JS programmatically values set kare (loadSettingsForm) to koi event
     nahi firta — is liye yahan se sab controls dobara paint hote hain. */
  function sync() {
    var i, els = all("#tab-set input[type=range]");
    for (i = 0; i < els.length; i++) if (els[i].__muiPaint) els[i].__muiPaint();
    els = all("#tab-set .ui-sw input");
    for (i = 0; i < els.length; i++) if (els[i].__muiPaint) els[i].__muiPaint();
  }

  /* ------------------------------------------------------------ SELF TEST
     "Keh nahi, dikha" — har control ko naap kar batata hai. */
  function selfTest() {
    var report = [], okc = 0, bad = 0, i, j;
    var groupsEl = all("#tab-set .ui-group"), reopen = [];
    for (i = 0; i < groupsEl.length; i++) {
      if (!hasCls(groupsEl[i], "is-open")) { reopen.push(groupsEl[i]); addCls(groupsEl[i], "is-open"); }
    }

    function bg(el) {
      try {
        var s = window.getComputedStyle ? window.getComputedStyle(el) : null;
        return s ? (s.backgroundColor || "") : "";
      } catch (e) { return ""; }
    }
    function transparent(c) {
      return !c || c === "transparent" || c === "rgba(0, 0, 0, 0)" || c === "rgba(0,0,0,0)";
    }
    function check(el, name, needBg) {
      var r;
      try { r = el.getBoundingClientRect(); } catch (e) { r = { width: 0, height: 0 }; }
      var w = Math.round(r.width), h = Math.round(r.height);
      var visible = w > 0 && h > 0;
      var painted = needBg ? !transparent(bg(el)) : true;
      if (visible && painted) { okc++; return true; }
      bad++;
      report.push("\u274C " + name + " \u2014 " + w + "x" + h + (painted ? "" : " (background transparent)"));
      return false;
    }

    var kinds = [
      [".ui-label", "label", true],
      [".ui-input", "input/select", true],
      [".ui-row", "switch row", true],
      [".ui-sw", "switch", false],
      [".ui-sw-t", "switch track", true],
      [".ui-sw-k", "switch knob", true],
      [".ui-slider", "slider box", true],
      [".ui-track", "slider track", true],
      [".ui-thumb", "slider thumb", true],
      [".ui-step", "slider +/- button", true],
      [".ui-btn", "button", true],
      [".ui-group", "group card", true]
    ];
    var counts = [];
    for (i = 0; i < kinds.length; i++) {
      var list = all("#tab-set " + kinds[i][0]);
      counts.push(kinds[i][1] + ": " + list.length);
      for (j = 0; j < list.length; j++) {
        var nm = kinds[i][1] + " #" + (j + 1) + (list[j].id ? " (" + list[j].id + ")" : "");
        check(list[j], nm, kinds[i][2]);
      }
    }

    /* sliders ki value/geometry */
    var sl = all("#tab-set input[type=range]"), det = [];
    for (i = 0; i < sl.length; i++) {
      var ui = sl[i].__muiUI;
      if (!ui) { bad++; report.push("\u274C slider " + sl[i].id + " \u2014 enhance nahi hua"); continue; }
      var fw = ui.fill.style.width || "0%";
      det.push("  " + sl[i].id + " = " + sl[i].value + "  (fill " + fw + ")");
    }

    /* scroll check */
    var t = document.getElementById("tab-set");
    var scrollOK = t ? (t.scrollHeight > 0 && t.clientHeight > 0) : false;
    var canScroll = t ? (t.scrollHeight > t.clientHeight + 4) : false;

    for (i = 0; i < reopen.length; i++) delCls(reopen[i], "is-open");

    var out = [];
    out.push("\uD83E\uDDEA MAYA UI CHECK \u2014 v5.9.5");
    out.push("WEBVIEW: Chrome " + (window.__webviewMajor || "?") + (window.__oldWebview ? " (PURANA)" : ""));
    out.push("");
    out.push("VISIBLE: " + okc + "   INVISIBLE: " + bad + (bad ? "  \u274C" : "  \u2705"));
    out.push("counts \u2014 " + counts.join(" \u2022 "));
    out.push("");
    out.push("SLIDERS:");
    out = out.concat(det.length ? det : ["  (koi nahi)"]);
    out.push("");
    out.push("SCROLL: tab-set content " + (t ? t.scrollHeight : 0) + "px / viewport " + (t ? t.clientHeight : 0) + "px \u2014 " +
      (scrollOK ? (canScroll ? "scrollable \u2705" : "sab content fit hai \u2705") : "MEASURE FAIL \u274C"));
    if (bad) { out.push(""); out.push("MASAIL:"); out = out.concat(report); }
    return { text: out.join("\n"), ok: bad === 0, visible: okc, invisible: bad };
  }

  /* ----------------------------------------------------------------- INIT */
  function init() {
    try { groups(); } catch (e) {}
    var i, r = all("#tab-set input[type=range]");
    for (i = 0; i < r.length; i++) { try { enhanceSlider(r[i]); } catch (e) {} }
    var s = all("#tab-set .ui-sw input");
    for (i = 0; i < s.length; i++) { try { enhanceSwitch(s[i]); } catch (e) {} }
    layout();
    on(window, "resize", layout);
    on(window, "orientationchange", function () { setTimeout(layout, 150); });
    setTimeout(layout, 300);
    setTimeout(function () { layout(); sync(); }, 1200);
  }

  return {
    init: init, layout: layout, sync: sync, selfTest: selfTest,
    enhanceSlider: enhanceSlider, enhanceSwitch: enhanceSwitch
  };
})();

/* ---- boot + purane core ke sath jorna (progressive enhancement) ---- */
try { MayaUI.init(); } catch (e) { try { pushLog("UI KIT FAIL: " + e.message); } catch (x) {} }

/* loadSettingsForm values set karta hai magar events nahi firta → sync */
try {
  var _lsfUI = loadSettingsForm;
  loadSettingsForm = function () {
    try { _lsfUI.apply(this, arguments); } catch (e) {}
    try { MayaUI.sync(); } catch (e) {}
  };
} catch (e) {}

/* har tab switch par height dobara naapo (font/emoji late load ho sakte hain) */
try {
  var _stUI = showTab;
  showTab = function (id) {
    _stUI(id);
    try { MayaUI.layout(); MayaUI.sync(); } catch (e) {}
    setTimeout(function () { try { MayaUI.layout(); } catch (e) {} }, 60);
  };
} catch (e) {}

/* splash hatne ke baad — us waqt asli height milti hai */
try {
  var _fe = window.__mayaForceEnter;
  window.__mayaForceEnter = function () {
    try { _fe(); } catch (e) {}
    setTimeout(function () { try { MayaUI.layout(); MayaUI.sync(); } catch (e) {} }, 80);
  };
} catch (e) {}

/* 🧪 UI CHECK button */
try {
  var _uiBtn = document.getElementById("uiCheckBtn");
  if (_uiBtn) _uiBtn.addEventListener("click", function () {
    var out = document.getElementById("uiCheckOut");
    var res = MayaUI.selfTest();
    if (out) { out.textContent = res.text; out.className = "ui-pre show"; }
    try { toast(res.ok ? "\u2705 Sab " + res.visible + " controls visible hain" : "\u274C " + res.invisible + " controls invisible \u2014 report dekho"); } catch (e) {}
    try { pushLog("UI CHECK: " + res.visible + " ok / " + res.invisible + " bad"); } catch (e) {}
  });
} catch (e) {}
