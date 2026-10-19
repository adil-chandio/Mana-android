/* ═══════════════════════════════════════════════════════════════════════════
   🗄️  SETFORM v1 — Settings ka EK hi darwaza   (app v5.9.5)
   ---------------------------------------------------------------------------
   Purana bug (user ne pakda): "girlfriend mode on karta hun, groq key lagata
   hun — thori der baad wo option khud band ho jata hai."

   Asal jarh: SAVE button par DO alag click handler lage hue the.
     handler A  -> keys save kiye, phir loadSettingsForm() chala diya
                   (jisne form ko PURANI settings se dobara likh diya —
                    yaani abhi abhi lagaya hua GF switch wapas off ho gaya)
     handler B  -> ab off ho chuke switch ko parh kar gfMode = false save kar diya

   Yani GF mode, gender, phone, persona, language, proactive — ye SAB
   button se kabhi save ho hi nahi sakte the. Har SAVE par chup-chaap wapas.

   Ilaj (patch nahi, structure): ab ek hi registry SET_FIELDS hai jo load aur
   save DONO chalati hai, aur ek hi handler jo is tarteeb se chalta hai:
        1) collect()  — SAB khane parho
        2) fixKeys()  — galat khane mein pari key sahi jagah bhejo
        3) persist()  — localStorage
        4) apply()    — asraat (theme, awaaz, brain pool, wake service…)
        5) load()     — form dobara likho (ab mehfooz: sab parha ja chuka)
   Naya field add karna = is list mein ek line. Wo khud load bhi hoga aur
   save bhi — dobara kabhi "save hota hi nahi" wala bug mumkin nahi.
   ═══════════════════════════════════════════════════════════════════════════ */

var SET_FIELDS = [
  /* ---- pehchan ---- */
  { id: "sName",       key: "name",           t: "text",  def: "Sir" },
  { id: "sCity",       key: "city",           t: "text",  def: "Hyderabad" },
  { id: "sGender",     key: "gender",         t: "sel",   def: "male" },
  { id: "sAssistName", key: "assistName",     t: "text",  def: "Maya" },
  { id: "sPhone",      key: "phone",          t: "text",  def: "" },

  /* ---- BRAIN POOL ki chaabiyan (sab kai-keys wale) ---- */
  { id: "sKey",        key: "apikey",         t: "keys" },
  { id: "sGqKey",      key: "groqKey",        t: "keys" },
  { id: "sCerebras",   key: "cerebrasKey",    t: "keys" },
  { id: "sMistral",    key: "mistralKey",     t: "keys" },
  { id: "sOpenRouter", key: "orKey",          t: "keys" },
  { id: "sNvidia",     key: "nvidiaKey",      t: "keys" },
  { id: "sZai",        key: "zaiKey",         t: "keys" },
  { id: "sLlm7",       key: "llm7Key",        t: "keys" },
  { id: "sGhKey",      key: "ghKey",          t: "keys" },
  { id: "sTtsKey",     key: "ttsKey",         t: "keys" },

  /* ---- AWAAZ ---- */
  { id: "sVoiceEngine", key: "voiceEngine",   t: "sel",   def: "auto" },
  { id: "sGVoice",      key: "gVoice",        t: "sel",   def: "Kore" },
  { id: "sVoiceMood",   key: "voiceMood",     t: "sel",   def: "auto" },
  { id: "sNeuralWifi",  key: "neuralWifiOnly", t: "check", def: false },
  { id: "sEdgeTts",     key: "edgeTTS",       t: "check", def: true },
  { id: "sEdgeVoice",   key: "edgeVoice",     t: "sel",   def: "" },
  { id: "sFishOn",      key: "fishOn",        t: "check", def: true },
  { id: "sFastShort",   key: "fastShort",     t: "check", def: false },
  { id: "sFishKey",     key: "fishKey",       t: "text",  def: "" },
  /* 🔒 fishVoice SETFORM se BAHAR hai — wo apne change par foran mehfooz hota
     hai. Pehle yahan hone ki wajah se boot par khali dropdown SAVE karte hi
     awaaz ko mita deta tha. */
  { id: "sFishTemp",    key: "fishTemp",      t: "num",   def: 0.35 },
  { id: "sTrustMode",   key: "trustMode",     t: "check", def: false },
  { id: "sWakeDoor",    key: "wakeDoor",      t: "num",   def: 15 },
  { id: "sMicZoom",     key: "micZoom",       t: "num",   def: 0.8 },
  { id: "sMicNear",     key: "micNear",       t: "check", def: true },
  { id: "sStt",         key: "stt",           t: "sel",   def: "ur-PK" },
  { id: "sTts",         key: "tts",           t: "sel",   def: "ur-PK" },
  { id: "sRate",        key: "rate",          t: "num",   def: 1,    out: "rateVal",  dp: 2 },
  { id: "sPitch",       key: "pitch",         t: "num",   def: 1.05, out: "pitchVal", dp: 2 },
  { id: "sVoice",       key: "voiceName",     t: "sel",   def: "" },
  { id: "sVoiceOn",     key: "voiceOn",       t: "check", def: true },

  /* ---- chalne ka andaz ---- */
  { id: "sModel",     key: "model",      t: "sel",   def: "auto" },
  { id: "sAuto",      key: "autoListen", t: "check", def: false },
  { id: "sWake",      key: "wakeWord",   t: "check", def: false },
  { id: "sTurbo",     key: "turbo",      t: "check", def: true },
  { id: "sNotifOn",   key: "notifSpeak", t: "check", def: false },
  { id: "sBatAlert",  key: "batteryAlert", t: "check", def: true },
  { id: "sPersona",   key: "persona",    t: "sel",   def: "maya" },
  { id: "sGf",        key: "gfMode",     t: "check", def: false },
  { id: "sRemember",  key: "remember",   t: "check", def: true },
  { id: "sConvo",     key: "convoMode",  t: "check", def: false },
  { id: "sLang",      key: "lang",       t: "sel",   def: "roman-ur" },
  { id: "sProactive", key: "proactive",  t: "check", def: false },
  { id: "sMusicApp",  key: "musicApp",   t: "sel",   def: "youtube" },
  { id: "sFavSong",   key: "favSong",    t: "text",  def: "" },
  { id: "sYtChannel", key: "ytChannel",  t: "text",  def: "" },

  /* ---- shakl-o-surat ---- */
  { id: "sRadius",   key: "radius",    t: "int",   def: 18, out: "radiusVal" },
  { id: "sFont",     key: "fontScale", t: "num",   def: 1,  out: "fontVal", dp: 2 },
  { id: "sEdgeGlow", key: "edgeGlow",  t: "check", def: false }
];

var SETFORM = {
  /* "a, b\nc" -> "a,b,c" ; ek hi key ho to andar ki spaces bhi saaf */
  keys: function (v) {
    var s = String(v || "").trim().replace(/[\r\n\t;]+/g, ",").replace(/\s*,\s*/g, ",").replace(/^,+|,+$/g, "");
    return s.indexOf(",") < 0 ? s.replace(/\s+/g, "") : s;
  },

  /* ---------- settings ➜ form ---------- */
  load: function () {
    try { awaazFillSelects(); } catch (e) {}
    for (var i = 0; i < SET_FIELDS.length; i++) {
      var f = SET_FIELDS[i], el = null;
      try { el = document.getElementById(f.id); } catch (e) {}
      if (!el) continue;
      var v = settings[f.key];
      try {
        if (f.t === "check") el.checked = (v === undefined || v === null) ? !!f.def : (f.def === true ? v !== false : v === true);
        else if (f.t === "num" || f.t === "int") el.value = (v === undefined || v === null || v === "") ? f.def : v;
        else el.value = (v === undefined || v === null) ? (f.def || "") : v;
        if (f.out) {
          var o = document.getElementById(f.out);
          if (o) o.textContent = f.dp ? Number(el.value).toFixed(f.dp) : String(parseInt(el.value, 10) || f.def);
        }
      } catch (e) {}
    }
    try { paintPool(); } catch (e) {}
    try { paintAwaaz(); } catch (e) {}
  },

  /* ---------- form ➜ settings (SAB kuch, ek hi baar) ---------- */
  collect: function () {
    for (var i = 0; i < SET_FIELDS.length; i++) {
      var f = SET_FIELDS[i], el = null;
      try { el = document.getElementById(f.id); } catch (e) {}
      if (!el) continue;
      try {
        if (f.t === "check") settings[f.key] = !!el.checked;
        else if (f.t === "keys") settings[f.key] = SETFORM.keys(el.value);
        else if (f.t === "num") settings[f.key] = parseFloat(el.value) || f.def;
        else if (f.t === "int") settings[f.key] = parseInt(el.value, 10) || f.def;
        else settings[f.key] = String(el.value || "").trim() || (f.def || "");
      } catch (e) {}
    }
  },

  /* ---------- galat khane mein pari key khud sahi jagah ---------- */
  fixKeys: function () {
    var moved = "";
    var g = settings.apikey || "";
    if (/^gsk_/.test(g)) { settings.groqKey = SETFORM.join(settings.groqKey, g); settings.apikey = ""; moved = "GROQ"; }
    else if (/^(ghp_|github_pat_)/.test(g)) { settings.ghKey = SETFORM.join(settings.ghKey, g); settings.apikey = ""; moved = "GITHUB"; }
    else if (/^csk-/.test(g)) { settings.cerebrasKey = SETFORM.join(settings.cerebrasKey, g); settings.apikey = ""; moved = "CEREBRAS"; }
    else if (/^sk-or-/.test(g)) { settings.orKey = SETFORM.join(settings.orKey, g); settings.apikey = ""; moved = "OPENROUTER"; }
    else if (/^nvapi-/.test(g)) { settings.nvidiaKey = SETFORM.join(settings.nvidiaKey, g); settings.apikey = ""; moved = "NVIDIA"; }
    var q = settings.groqKey || "";
    if (/^AIza/.test(q)) { settings.apikey = SETFORM.join(settings.apikey, q); settings.groqKey = ""; moved = "GEMINI"; }
    return moved;
  },
  join: function (have, add) {
    have = String(have || "").trim();
    if (!have) return add;
    return (have.split(",").indexOf(add) >= 0) ? have : (have + "," + add);
  },

  /* ---------- lagao: asraat ---------- */
  apply: function () {
    /* gender male na ho to GF mode ka koi matlab nahi */
    if (settings.gfMode === true && (settings.gender || "male") !== "male") settings.gfMode = false;

    /* nayi settings = har dimaag aur har awaaz ko naya mauka */
    try { BRAIN.state = {}; BRAIN.save(); } catch (e) {}
    try { AWAAZ.reset(); } catch (e) {}
    try { geminiBadUntil = 0; modelCooldowns = {}; } catch (e) {}
    try { DIMAAG.keyBadUntil = 0; DIMAAG.dayQuotaUntil = 0; DIMAAG.lastCode = ""; } catch (e) {}

    if (typeof NATIVE !== "undefined" && NATIVE) {
      try { window.MayaBridge.notifSpeak(settings.notifSpeak); } catch (e) {}
      try { window.MayaBridge.keepScreenOn(settings.autoListen); } catch (e) {}
    }
    if (settings.autoListen) { try { requestWakeLock(); } catch (e) {} }

    try { applyTheme(); } catch (e) {}
    try { renderThemeUI(); } catch (e) {}
    try { paintPersonas(); } catch (e) {}
    try { renderArtists(); } catch (e) {}
    try { renderFacts(); } catch (e) {}
    try { startProactive(); } catch (e) {}
    try { setOrb("idle"); } catch (e) {}
    try { paintQuick(); } catch (e) {}
    try { greetMiniRefresh(); } catch (e) {}
  },

  /* ---------- poora safar: ek button, ek tarteeb ---------- */
  save: function () {
    var wakeWas = !!settings.wakeWord;

    SETFORM.collect();                    /* 1. SAB parho — pehle */
    var moved = SETFORM.fixKeys();        /* 2. keys sahi jagah */
    var gfWas = settings.gfMode;
    SETFORM.apply();                      /* 3. asraat + gender check */
    saveSettings();                       /* 4. mehfooz karo */
    SETFORM.load();                       /* 5. ab form dobara likho */

    if (wakeWas !== !!settings.wakeWord) { try { setWakeService(!!settings.wakeWord); } catch (e) {} }
    if (moved) toast("Ye " + moved + " key thi — sahi khane mein rakh di ✓");
    else if (gfWas === true && settings.gfMode !== true) toast("Girlfriend mode ke liye Gender = Male chahiye");
    else toast("✅ Settings save ho gayin");
    pushLog("SETTINGS SAVED • " + BRAIN.liveCount() + " dimaag zinda" + (settings.gfMode ? " • GF ON" : ""));
  }
};

/* purane naam zinda rakho — baqi code inhe bulata hai */
function loadSettingsForm(){ SETFORM.load(); }
function loadV4Form(){ SETFORM.load(); }

$("#saveSettings").addEventListener("click", function(){ SETFORM.save(); });
$("#sRate").addEventListener("input", function(){ $("#rateVal").textContent = Number(this.value).toFixed(2); });
$("#sPitch").addEventListener("input", function(){ $("#pitchVal").textContent = Number(this.value).toFixed(2); });

(function(_cs){ if (_cs) _cs.addEventListener("click", function(){
  customSkills = []; saveSkills(); refreshSkillList(); toast("Custom skills khatam");
}); })($("#clearSkills"));
function refreshSkillList(){
  var el = $("#skillList"); if (!el) return;
  el.textContent = "Built-in: 8 ON ✓ | Custom (khud seekhe): " + customSkills.length +
    (customSkills.length ? " — " + customSkills.map(function(s){ return s.name; }).join(", ") : "");
}
refreshSkillList();

$("#clearFacts").addEventListener("click", function(){
  facts = []; saveFacts(); toast("Memory bank khali kar diya"); pushLog("MEMORY BANK WIPED");
});
$("#clearChat").addEventListener("click", function(){
  chatHist = []; persistChat(); log.innerHTML = "";
  DIMAAG.historySuspect = false; DIMAAG.lastCode = "";
  addBubble("ai", "Memory wipe complete, " + settings.name + ". Taaza shuruaat karein?");
  toast("Chat history clear"); hudRefresh();
});

function refreshHandsFreeStatus(){
  var ns = $("#notifStatus"); if (ns && NATIVE) { try { ns.textContent = "Reader: " + (window.MayaBridge.notifEnabled() ? "\u2705 ON" : "OFF — button dabao"); } catch(e){} }
  if (!NATIVE) { var b1 = $("#batStatus"), a1 = $("#asStatus"); if (b1) b1.textContent = "Status: sirf APK mein"; if (a1) a1.textContent = "Status: sirf APK mein"; return; }
  try { $("#batStatus").textContent = "Status: " + (window.MayaBridge.batteryUnrestricted() ? "✅ SHIELDED (unrestricted)" : "⚠️ NOT shielded — button dabao"); } catch(e){}
  try { $("#asStatus").textContent = "Status: " + (window.MayaBridge.accessibilityEnabled() ? "✅ AUTO-SEND ON" : "OFF — button dabao aur MAYA AutoSend ON karo"); } catch(e){}
}
