/* ========== SKILLS ENGINE (Phase 11 — ruflo se inspire) ========== */
var SKILLS = [
  { id: "planner", name: "Planner", icon: "\uD83D\uDDF3\uFE0F", when: /(plan|timeline|project|bara kaam|step by step|schedule bana|roadmap)/i,
    prompt: "PLANNER MODE: Kaam ko clear steps mein todo. Har step ka action + expected result batao. Tools use kar ke tasks bana do (timer/reminder) jahan mutaliq ho.", deep: true },
  { id: "coder", name: "Coder", icon: "\uD83D\uDCBB", when: /(code|script|program|bug|error|function|calculate|convert|json|parse|average|regex)/i,
    prompt: "CODER MODE: run_javascript tool mein khud code likh kar CHALAO. Error aaye to code THEEK kar ke ek dafa dobara chalao (self-fix). Result ko simple words mein samjhao.", deep: true },
  { id: "researcher", name: "Researcher", icon: "\uD83D\uDD0D", when: /(research|compare|talash|pata lagao|detail|khabar|news|rate|price|review|best)/i,
    prompt: "RESEARCHER MODE: pehle web_search/wiki_search se 2-3 sources lo, phir mila kar 3-4 line ka saaf jawab do. Source ka naam zaroor mention karo.", deep: true },
  { id: "teacher", name: "Teacher", icon: "\uD83C\uDF93", when: /(padho|padha|sikha|samjha|quiz|test|exam|chapter|revision|mcq)/i,
    prompt: "TEACHER MODE: step-by-step asaan Roman Urdu mein samjhao. Jahan ho sake quiz/MCQ banao ya ek chhota sawal pooch kar check karo. Notes diary mein offer karo.", deep: false },
  { id: "kharcha", name: "Kharcha Tracker", icon: "\uD83D\uDCB0", when: /(kharch|kharcha|paisa|budget|bill|mahine ka|qist|emi)/i,
    prompt: "KHARCHA MODE: har kharcha diary mein 'KHARCHA: <amount> <cheez> <category>' format mein likho (diary_write). Report manga jaye to numbers jama kar ke total do (run_javascript).", deep: false },
  { id: "writer", name: "Writer", icon: "\uD83D\uDD8D\uFE0F", when: /(likho|shayari|essay|email|message draft|caption|story|letter|jawab likh)/i,
    prompt: "WRITER MODE: tone poochho agar clear na ho (formal/dostana/mazahiya). Chhota, wazeh, tayyar-to-bhejo text do.", deep: false },
  { id: "health", name: "Health Coach", icon: "\uD83C\uDFCB", when: /(sehat|health|paani|water|walk|neend|sleep|exercise|wazan|diet)/i,
    prompt: "HEALTH MODE: dostana tone. Paani/walk jaisi cheezon ke reminder set karo (set_reminder). General tips do, medical advice ke liye doctor kaheo.", deep: false },
  { id: "critic", name: "Verifier", icon: "\uD83E\uDDEA", when: /(check karo|verify|theek hai|confirm|review karo|test karo)/i,
    prompt: "VERIFIER MODE: kaam ko dobara check karo — tools se data laa kar confirm karo. Jo ghalat milay saaf batao.", deep: true }
];
var customSkills = [];
try { customSkills = JSON.parse(localStorage.getItem("maya_skills") || "[]"); } catch(e){}
function saveSkills(){ try { localStorage.setItem("maya_skills", JSON.stringify(customSkills.slice(0, 40))); } catch(e){} }
function skillFor(q){
  q = String(q || "");
  for (var i = 0; i < customSkills.length; i++) {
    try { if (new RegExp(customSkills[i].when, "i").test(q)) return { id: "custom:" + customSkills[i].name, name: customSkills[i].name, prompt: "SKILL [" + customSkills[i].name + "]: " + customSkills[i].prompt, deep: true }; }
    catch(e){}
  }
  for (var j = 0; j < SKILLS.length; j++) {
    if (SKILLS[j].when.test(q)) return SKILLS[j];
  }
  return null;
}
var _activeSkill = null;

/* ---------- VISION ENGINE (Phase 9): Maya ki aankhein ---------- */
var pendingVisionPrompt = null;
async function visionAsk(prompt, b64){
  /* Issue 5: pehle HAR model par poori tasveer dobara-upload hoti thi —
     ek hi call kaafi hai. Pehla vision-capable model chuno; wo fail ho to
     hi agli koshish (upload ek hi dafa hota hai, baar-baar nahi). */
  var models = await resolveModels();
  for (var i = 0; i < models.length; i++) {
    try {
      var body = {
        contents: [{ role: "user", parts: [
          { text: (prompt || "Ye dekho aur mukhtasir batado ye kya hai — Roman Urdu mein.") },
          { inline_data: { mime_type: "image/jpeg", data: b64 } }
        ]}],
        generationConfig: { temperature: 0.4, maxOutputTokens: 200 }
      };
      if (/2\.5|gemini-3/.test(models[i])) body.generationConfig.thinkingConfig = { thinkingBudget: 0 };
      var res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + models[i] + ":generateContent?key=" + encodeURIComponent(settings.apikey), {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
      });
      if (!res.ok) continue;
      var data = await res.json();
      var parts = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
      var out = parts.map(function(p){ return p.text || ""; }).join("").trim();
      if (out) { aiState.provider = "VISION"; return out; }
    } catch (e) {}
  }
  return null;
}
window.__photoTaken = async function(b64){
  /* Issue 5: Kotlin ab nakaam par null bhejta hai — hang nahi, sach. */
  if (!b64) { reply("Photo nahi khul saki — dobara try karo, " + settings.name + ".", true); return; }
  if (!settings.apikey) { reply("Photo dekhne ke liye Gemini key chahiye, " + settings.name + " \u2014 wahi key jo dimaag ke liye hai.", true); return; }
  addBubble("ai", "\uD83D\uDC41\uFE0F Tasveer mil gayi \u2014 dekh rahi hoon...");
  pushLog("AANKH: dekh rahi hoon...");
  /* 👁️ sawal AANKH yaad rakhti hai (tool se aaya ho ya purane fast-path se) */
  var q = (typeof AANKH !== "undefined" && AANKH.waiting) ? AANKH.prompt() : (pendingVisionPrompt || "");
  pendingVisionPrompt = null;
  var t0 = (new Date()).getTime();
  var out = await visionAsk(q, b64);
  pushLog("AANKH: " + ((new Date()).getTime() - t0) + "ms");
  reply(out || "Tasveer samajh nahi aayi \u2014 ya to roshni kam thi ya network ka masla hua, " + settings.name + ".", true);
};

/* ---------- NAMAZ TIMES (Aladhan — free, Pakistan method) ---------- */
var prayerCache = null;
async function prayerTimes(){
  try {
    var today = new Date().toISOString().slice(0, 10);
    if (prayerCache && prayerCache.d === today) return prayerCache;
    var r = await nativeGet("https://api.aladhan.com/v1/timingsByCity?city=" + encodeURIComponent(settings.city || "Hyderabad") + "&country=Pakistan&method=1");
    if (!r.body) return null;
    var j = JSON.parse(r.body);
    var t = j && j.data && j.data.timings;
    if (!t) return null;
    var p = { d: today, fajr: t.Fajr, dhuhr: t.Dhuhr, asr: t.Asr, maghrib: t.Maghrib, isha: t.Isha };
    prayerCache = p;
    return p;
  } catch (e) { return null; }
}

/* ---------- WHATSAPP READER (Phase 9) ---------- */
function notifAccessOk(){
  try { return NATIVE && window.MayaBridge.notifEnabled() === true; } catch(e){ return false; }
}
function readMessages(wasVoice){
  if (!NATIVE) { reply("WhatsApp Reader sirf APK mein hai.", wasVoice); return; }
  if (!notifAccessOk()) {
    reply(settings.name + ", ek dafa permission deni hai — main settings khol rahi hoon. Notification Access mein MAYA ko ON karo.", wasVoice);
    try { window.MayaBridge.openNotifAccess(); } catch(e){}
    return;
  }
  try { window.MayaBridge.notifSpeak(settings.notifSpeak === true); } catch(e){}
  var list = [];
  try { list = JSON.parse(window.MayaBridge.notifHistory() || "[]"); } catch(e){}
  try { window.MayaBridge.notifClear(); } catch(e){}
  if (!list.length) { reply("Koi naya WhatsApp ya Telegram message nahi aaya abhi, " + settings.name + ".", wasVoice); return; }
  var s = list.slice(-5).map(function(m){ return m.time + " par " + m.from + " ne kaha: " + m.text; }).join(". ");
  reply("Aakhri " + Math.min(5, list.length) + " messages: " + s + ".", wasVoice);
}
window.__notifIncoming = function(from){
  pushLog("MESSAGE: " + from);
  toast("\uD83D\uDCEC " + from + " ka message aaya — 'naye messages sunao' bolo");
};
