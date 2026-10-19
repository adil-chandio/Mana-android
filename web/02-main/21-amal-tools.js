/* ═══ 🖐 AMAL — Maya ab CHOO sakti hai (Roadmap Phase 1, S3) ═══
   JS sirf pipe hai — saare HARD guards Kotlin (MayaAct) mein:
   banking hard-block, sensitive fields, verify-before-tap, max 3
   attempts, 5s timeout, 10/min rate, touch-abort, kill-switch,
   idle = zero actions. Yahan sirf (1) stop words, (2) bridge call,
   (3) report display. */
var MAYA_AMAL = {
  can: function () {
    try { return !!(typeof NATIVE !== "undefined" && NATIVE && window.MayaBridge && window.MayaBridge.mayaAct); }
    catch (e) { return false; }
  },
  STOP_WORDS: ["ruk jao", "ruk jaa", "rukja", "ruko", "rok do", "stop", "bas karo", "cancel"],
  isStop: function (t) {
    var s = String(t || "").toLowerCase();
    return MAYA_AMAL.STOP_WORDS.some(function (w) { return s === w || s.indexOf(w) === 0; });
  },
  stop: function () {
    try { window.MayaBridge.mayaStop && window.MayaBridge.mayaStop(); } catch (e) {}
    try { pushLog("\uD83D\uDED1 AMAL: STOP — automation foran band"); } catch (e) {}
    try { toast("\uD83D\uDED1 Maya automation band"); } catch (e) {}
    try { if (window.__ntfySafety) window.__ntfySafety("kill-switch / stop hukm"); } catch (e) {}
  },
  act: function (args) {
    if (!MAYA_AMAL.can()) return { ok: false, why: "automation sirf APK + Accessibility ON ke sath chalti hai" };
    try {
      var r = JSON.parse(window.MayaBridge.mayaAct(JSON.stringify(args)) || "{}");
      try { pushLog("\uD83D\uDD90\uFE0F AMAL " + (args.action || "?") + ": " + (r.ok ? "queue ho gaya" : ("roka: " + (r.why || "?")))); } catch (e) {}
      return r;
    } catch (e) { return { ok: false, why: String(e && e.message || e) }; }
  },
  status: function () {
    try { return JSON.parse(window.MayaBridge.mayaStatus() || "{}"); } catch (e) { return {}; }
  }
};
window.__mayaActDone = function (reportJson) {
  try {
    var r = JSON.parse(reportJson || "{}");
    if (r.ok) pushLog("\uD83D\uDD90\uFE0F AMAL \u2713 " + (r.what || ""));
    else if (r.stopped) pushLog("\uD83D\uDED1 AMAL \u26D4 " + (r.why || "stop"));
    else pushLog("\uD83D\uDD90\uFE0F AMAL \u2717 " + (r.why || "nakaam"));
  } catch (e) {}
};

window.__autoSent = function(){
  pushLog("AUTO-SEND \u2713");
  addBubble("ai", "\u2713 Bhej diya, " + settings.name + "!");
  speak("Bhej diya, " + settings.name + "!", lastWasVoice);
};

/* ---------- SCHEDULER (Phase 9) ---------- */
var schedTasks = {};
try { schedTasks = JSON.parse(localStorage.getItem("maya_sched") || "{}"); } catch(e){}
function saveSched(){ try { localStorage.setItem("maya_sched", JSON.stringify(schedTasks)); } catch(e){} }
window.__taskDue = function(id){
  var t = schedTasks[id];
  if (!t) return;
  delete schedTasks[id]; saveSched();
  pushLog("TASK DUE: " + (t.kind || "?"));
  if (t.kind === "message") {
    execTool("call_contact", { name: t.name }).then(function(){
      /* number mil chuka hoga; ab draft+autosend kholein */
    });
    // seedha: naam se number dhoondo
    if (NATIVE) {
      try {
        var r = JSON.parse(window.MayaBridge.contactsSearch(t.name));
        if (r.matches && r.matches.length) {
          var asend = false;
          try { asend = window.MayaBridge.accessibilityEnabled() === true; } catch(e){}
          var ok = window.MayaBridge.openWhatsAppDraft(r.matches[0].number, t.text, asend);
          if (ok) {
            try { window.MayaBridge.notify("\uD83D\uDCE4 MAYA", "Scheduled message " + t.name + " ko bheja gaya"); } catch(e){}
            reply("Waqt ho gaya tha — maine " + r.matches[0].name + " ko message bhej diya: " + t.text, true);
            return;
          }
        }
        try { window.MayaBridge.notify("\uD83D\uDCE4 MAYA", t.name + " ko bhejna tha: " + t.text); } catch(e){}
        reply(settings.name + ", message ka waqt ho gaya tha par phone lock tha shayad — notification mein text rakh diya hai: " + t.text, true);
      } catch(e){}
    }
  }
};

/* ---------- BATTERY FULL ALERT (app khuli ho to) ---------- */
var _batAlerted = false;
setInterval(function(){
  if (!settings.batteryAlert) return;
  try {
    var done = function(b){
      if (b && b.charging && b.level >= 100 && !_batAlerted) {
        _batAlerted = true;
        if (NATIVE) { try { window.MayaBridge.notify("\uD83D\uDD0B MAYA", "Charger nikal do " + settings.name + " — battery full!"); } catch(e){} }
        reply("Charger nikal do " + settings.name + ", battery hundred percent ho gayi hai!", true);
        try { if (window.__ntfyBattery) window.__ntfyBattery(b.level); } catch (e) {}
      }
      if (b && (!b.charging || b.level < 95)) _batAlerted = false;
    };
    if (NATIVE) { done(JSON.parse(window.MayaBridge.battery())); }
    else if (navigator.getBattery) { navigator.getBattery().then(done); }
  } catch(e){}
}, 60000);

/* ---------- WEB SHARK (Phase 8): search + wiki ---------- */
async function nativeGet(url){
  if (NATIVE && window.MayaBridge.httpGet) {
    try { var r = JSON.parse(window.MayaBridge.httpGet(url, "")); return { status: r.status, body: r.body || "" }; } catch(e){ return { status: 0, body: "" }; }
  }
  try { var f = await fetch(url); return { status: f.status, body: f.ok ? await f.text() : "" }; } catch(e){ return { status: 0, body: "" }; }
}
async function webSearch(q){
  var res = await nativeGet("https://html.duckduckgo.com/html/?q=" + encodeURIComponent(q));
  var html = res.body || "";
  var results = [];
  var re = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  var m;
  while ((m = re.exec(html)) && results.length < 5) {
    var link = m[1];
    var dm = /[?&]uddg=([^&]+)/.exec(link);
    if (dm) { try { link = decodeURIComponent(dm[1]); } catch(e){} }
    var title = htmlToText(m[2]).slice(0, 120);
    if (title && link.indexOf("http") === 0) results.push({ title: title, url: link });
  }
  return results.length ? { results: results } : { error: "kuch nahi mila" };
}
async function wikiLookup(q){
  var lang = /[\u0600-\u06FF]/.test(q) ? "ur" : "en";
  var res = await nativeGet("https://" + lang + ".wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(q.trim().replace(/\s+/g, "_")));
  if (res.status !== 200 || !res.body) return { error: "page nahi mila" };
  try {
    var j = JSON.parse(res.body);
    return { title: j.title, extract: String(j.extract || "").slice(0, 1200) };
  } catch(e){ return { error: "parse" }; }
}

/* ---------- FILE MANAGER helpers (Phase 8) ---------- */
function fileFind(name){
  name = String(name || "").toLowerCase().trim();
  for (var i = 0; i < _fileIndex.length; i++) if (_fileIndex[i].name.toLowerCase().indexOf(name) >= 0) return _fileIndex[i];
  return null;
}
async function listFilesAction(folder){
  if (!NATIVE) return { error: "sirf APK mein" };
  try { window.MayaBridge.requestFilesPerms(); } catch(e){}
  try {
    var r = JSON.parse(window.MayaBridge.listFiles(folder));
    if (r.error) return r;
    _fileIndex = r.files || [];
    return r;
  } catch(e){ return { error: "list fail" }; }
}

/* ---------- AGENT MODE: JS Sandbox (safe cage — no DOM, no data access) ---------- */
function sandboxRun(code, input){
  return new Promise(function(resolve){
    var workerSrc = 'self.onmessage=function(e){var logs=[];var console={log:function(){for(var i=0;i<arguments.length;i++)logs.push(String(arguments[i]))}};' +
      'Promise.resolve().then(function(){var AF=Object.getPrototypeOf(async function(){}).constructor;var fn=new AF("input","console","\"use strict\";"+e.data.code);return fn(e.data.input)})' +
      '.then(function(r){var o;try{o=typeof r==="string"?r:JSON.stringify(r)}catch(x){o=String(r)}self.postMessage({ok:true,result:o,logs:logs.slice(0,5)})})' +
      '.catch(function(err){self.postMessage({ok:false,error:String(err&&err.message||err),logs:logs.slice(0,5)})})};';
    var finish = function(o){ resolve(o); };
    try {
      if (typeof Worker === "undefined") throw new Error("no-worker");
      var w = new Worker(URL.createObjectURL(new Blob([workerSrc], { type: "application/javascript" })));
      var to = setTimeout(function(){ try { w.terminate(); } catch(e){} finish({ error: "timeout (8s) — code atka" }); }, 8000);
      w.onmessage = function(ev){
        clearTimeout(to);
        try { w.terminate(); } catch(e){}
        finish(ev.data && ev.data.ok ? { result: ev.data.result, logs: ev.data.logs } : { error: ev.data ? ev.data.error : "fail", logs: ev.data && ev.data.logs });
      };
      w.onerror = function(){
        clearTimeout(to);
        try { w.terminate(); } catch(e){}
        finish({ error: "code error" });
      };
      w.postMessage({ code: code, input: input });
    } catch (e) {
      /* Fallback: bina worker (old WebView) — try/catch cage */
      try {
        var AF2 = Object.getPrototypeOf(async function(){}).constructor;
        var fn2 = new AF2("input", "console", '"use strict";' + code);
        Promise.resolve().then(function(){ return fn2(input); }).then(function(r){
          var o; try { o = typeof r === "string" ? r : JSON.stringify(r); } catch(x){ o = String(r); }
          finish({ result: o });
        }).catch(function(err){ finish({ error: String(err && err.message || err) }); });
      } catch (err2){ finish({ error: String(err2 && err2.message || err2) }); }
    }
  });
}
function htmlToText(h){
  return String(h).replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\s+/g, " ").trim();
}

/* ---------- YOUTUBE (Issue 4: app-built search URL — koi video-ID nahi) ----------
   Pehle native search se PEHLA video-ID utha kar seedha watch-page kholta tha —
   "play a good song" par random purana viral video chal jata tha. Ab LLM sirf
   search text deta hai (strict JSON contract) aur app KHUD search page banata hai. */
async function ytPlay(query){
  var q = String(query || "").trim();
  if (!q) return "Kya chalana hai, " + settings.name + "?";
  q = q.replace(/https?:\/\/\S+/gi, " ").replace(/\b[a-zA-Z0-9_-]{11}\b/g, " ")
       .replace(/\s+/g, " ").trim();
  if (!q) return "Gaane ya video ka naam bolo, " + settings.name + " — link/ID nahi.";
  pushLog("YT PLAY: " + q);
  var music = String(settings.musicApp) === "ytmusic";
  var url = music
    ? "https://music.youtube.com/search?q=" + encodeURIComponent(q)
    : "https://www.youtube.com/results?search_query=" + encodeURIComponent(q);
  openURL(url);
  return (music ? "YouTube Music search khol rahi hoon" : "YouTube search khol rahi hoon") +
    ", " + settings.name + " — jo pasand aaye dabana.";
}

