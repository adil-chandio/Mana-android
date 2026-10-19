/* ---------- AI TOOLS (Gemini function calling — Phase 3) ---------- */
var TOOL_DECLS = [
  { name: "set_alarm", description: "Phone par REAL alarm lagata hai (24h format). Jab user kahe jaga dena / uthana / alarm.",
    parameters: { type: "OBJECT", properties: { hour: { type: "INTEGER", description: "0-23" }, minute: { type: "INTEGER", description: "0-59" }, message: { type: "STRING", description: "Alarm ka label" } }, required: ["hour", "minute"] } },
  { name: "set_timer", description: "System timer (seconds mein) — screen band ho to bhi bajta hai.",
    parameters: { type: "OBJECT", properties: { seconds: { type: "INTEGER" }, label: { type: "STRING" } }, required: ["seconds"] } },
  { name: "set_reminder", description: "Reminder — X minutes baad notification + bol kar yaad dilata hai.",
    parameters: { type: "OBJECT", properties: { minutes: { type: "NUMBER" }, text: { type: "STRING", description: "Kya yaad dilana hai" } }, required: ["minutes", "text"] } },
  { name: "open_app", description: "App kholta hai. Available: whatsapp, youtube, instagram, telegram, facebook, gmail, maps, play store, google, netflix, spotify, snapchat, twitter, tiktok, daraz",
    parameters: { type: "OBJECT", properties: { app: { type: "STRING" } }, required: ["app"] } },
  { name: "play_youtube", description: "YouTube/YT Music par search page kholta hai. `query` mein SIRF search text do (gaane/video ka naam) — KABHI video ID, URL, ya channel nahi. App khud search page banati hai.",
    parameters: { type: "OBJECT", properties: { query: { type: "STRING" } }, required: ["query"] } },
  { name: "search_web", description: "Google search kholta hai.",
    parameters: { type: "OBJECT", properties: { query: { type: "STRING" } }, required: ["query"] } },
  { name: "call_contact", description: "Contact list se NAAM dhoond kar seedha CALL lagata hai (bina tap). Jaise: 'Ali ko call lagao'",
    parameters: { type: "OBJECT", properties: { name: { type: "STRING", description: "Contact ka naam" } }, required: ["name"] } },
  { name: "message_contact", description: "Contact ko WhatsApp/SMS message: naam se number dhoond kar chat kholti hai message type ho chuka hota hai. Jaise: 'bhai ko whatsapp karo main aa raha hoon'",
    parameters: { type: "OBJECT", properties: { name: { type: "STRING" }, text: { type: "STRING", description: "Message" }, app: { type: "STRING", description: "whatsapp ya sms (default whatsapp)" } }, required: ["name", "text"] } },
  { name: "call_number", description: "Phone dial karta hai (number se).",
    parameters: { type: "OBJECT", properties: { number: { type: "STRING" } }, required: ["number"] } },
  { name: "send_sms", description: "SMS screen kholta hai number ke saath.",
    parameters: { type: "OBJECT", properties: { number: { type: "STRING" }, text: { type: "STRING" } }, required: ["number"] } },
  { name: "run_javascript", description: "Chhota JavaScript chala kar koi bhi calculation, list-process, ya data-parse karo. Input variable mein raw data milta hai. console.log() se debug. Return final value. (Termux-style code runner)",
    parameters: { type: "OBJECT", properties: { code: { type: "STRING", description: "JS code — input variable available, return se jawab do" }, input: { type: "STRING", description: "Raw data/string jo code ko chahiye (optional)" } }, required: ["code"] } },
  { name: "web_fetch", description: "Koi bhi public URL khol kar uska text padho (rates, news, wikipedia, koi bhi page). Sirf simple pages; apps/login wale nahi.",
    parameters: { type: "OBJECT", properties: { url: { type: "STRING" } }, required: ["url"] } },
  { name: "diary_write", description: "User ki diary (roznamcha) mein entry likho — 'aaj ye hua', events, kharcha, kuch bhi.",
    parameters: { type: "OBJECT", properties: { entry: { type: "STRING" } }, required: ["entry"] } },
  { name: "diary_search", description: "Diary mein talash karo — date, keyword, ya pichle hafte ki entries.",
    parameters: { type: "OBJECT", properties: { query: { type: "STRING", description: "keyword ya 'kal' 'pichle hafte' jaisa lafz" } }, required: ["query"] } },
  { name: "web_search", description: "Internet par talaash (DuckDuckGo engine). Top 5 results with titles+links.",
    parameters: { type: "OBJECT", properties: { query: { type: "STRING" } }, required: ["query"] } },
  { name: "wiki_search", description: "Wikipedia se kisi bhi topic ki summary (Urdu/English wikipedia auto).",
    parameters: { type: "OBJECT", properties: { query: { type: "STRING" } }, required: ["query"] } },
  { name: "list_files", description: "Phone ki files list: downloads, pictures, music, videos",
    parameters: { type: "OBJECT", properties: { folder: { type: "STRING", description: "downloads|pictures|music|videos" } }, required: ["folder"] } },
  { name: "open_file", description: "Pehle list_files se list lo, phir naam se file kholo (PDF, photo, video — jo bhi).",
    parameters: { type: "OBJECT", properties: { name: { type: "STRING" } }, required: ["name"] } },
  { name: "share_file", description: "File share karne ka menu kholo (naam se).",
    parameters: { type: "OBJECT", properties: { name: { type: "STRING" } }, required: ["name"] } },
  { name: "search_memory", description: "MAYA ki poori yaaddasht mein talash — facts, diary, purani chats.",
    parameters: { type: "OBJECT", properties: { query: { type: "STRING" } }, required: ["query"] } },
  { name: "create_skill", description: "NAYA SKILL seekho (self-learning): jab koi naya tareeqa/pattern kaam kare to usko skill bana kar yaad rakho taake agli baar behtar ho.",
    parameters: { type: "OBJECT", properties: { name: { type: "STRING" }, when: { type: "STRING", description: "regex pattern — kab ye skill use ho" }, prompt: { type: "STRING", description: "is skill ke instructions" } }, required: ["name", "when", "prompt"] } },
  { name: "prayer_times", description: "Namaz ke waqt lauta deta hai (Fajr se Isha) — settings wale sheher ke liye.",
    parameters: { type: "OBJECT", properties: {} } },
  { name: "read_messages", description: "Aaye hue naye WhatsApp/Telegram messages padhta hai.",
    parameters: { type: "OBJECT", properties: {} } },
  { name: "reply_message", description: "Kisi ke aaye hue message ka jawab bhehta hai: 'Ali ko reply karo ki main aa raha hoon'.",
    parameters: { type: "OBJECT", properties: { name: { type: "STRING" }, text: { type: "STRING" } }, required: ["name", "text"] } },
  { name: "schedule_message", description: "Baad ke waqt par message khud bhejta hai. minutes = kitne minute baad.",
    parameters: { type: "OBJECT", properties: { minutes: { type: "NUMBER" }, name: { type: "STRING" }, text: { type: "STRING" } }, required: ["minutes", "name", "text"] } },
  { name: "torch_control", description: "Phone ki torch/light on-off.",
    parameters: { type: "OBJECT", properties: { on: { type: "BOOLEAN" } }, required: ["on"] } },
  { name: "volume_control", description: "Phone volume set karo (0-100).",
    parameters: { type: "OBJECT", properties: { percent: { type: "INTEGER" } }, required: ["percent"] } },
  { name: "brightness_control", description: "Screen brightness (5-100).",
    parameters: { type: "OBJECT", properties: { percent: { type: "INTEGER" } }, required: ["percent"] } },
  { name: "get_weather", description: "Current mausam lauta deta hai (default sheher settings wala).",
    parameters: { type: "OBJECT", properties: { city: { type: "STRING" } } } },
  { name: "battery_status", description: "Phone battery ka status.", parameters: { type: "OBJECT", properties: {} } },
  { name: "save_memory", description: "Zaroori cheez hamesha ke liye yaad rakhta hai (birthday, appointment, pasand, naam).",
    parameters: { type: "OBJECT", properties: { fact: { type: "STRING" } }, required: ["fact"] } },
  { name: "recall_memory", description: "Yaad rakhi hui sab baatein lauta deta hai.", parameters: { type: "OBJECT", properties: {} } },
  { name: "read_screen", description: "NAZAR: abhi phone ki SCREEN par kya nazar aa raha hai — poori fehrist (buttons, likhne ke khane, matn). Jab user poochhe 'screen par kya hai', 'kya dikh raha hai', 'kaunse buttons hain', ya jab kisi app ko chalane se pehle dekhna zaroori ho. NOTE: ye sirf DEKHTA hai, kuch dabata nahi.",
    parameters: { type: "OBJECT", properties: {} } },
  { name: "see_camera", description: "AANKHEIN: camera khol kar tasveer lo aur usay DEKH kar sawal ka jawab do. Jab user kahe 'ye dekho', 'ye kya hai', 'is bill ka total', 'ye likha kya hai', 'ye dawa kis liye hai' — yani jab jawab ke liye DEKHNA zaroori ho.",
    parameters: { type: "OBJECT", properties: { question: { type: "STRING", description: "User ka asal sawal — tasveer ke sath yehi poocha jayega" } }, required: ["question"] } },
  { name: "see_image", description: "AANKHEIN: gallery se tasveer chun kar dekho. Jab user kahe 'gallery wali photo dekho' / 'ye screenshot parho'.",
    parameters: { type: "OBJECT", properties: { question: { type: "STRING", description: "User ka asal sawal" } }, required: ["question"] } },
  { name: "notify", description: "Turant notification bhejta hai screen par.",
    parameters: { type: "OBJECT", properties: { title: { type: "STRING" }, message: { type: "STRING" } }, required: ["title", "message"] } },
  { name: "maya_act", description: "AMAL: kisi doosri app ke screen element par TAP karo, text field mein TYPE karo, swipe, SCROLL (neeche/upar/side), ya back. find mein wahi matn do jo SCREEN par likha hai (Maya pehle use dhoondh kar verify karti hai — andha tap kabhi nahi). Sirf user ke saaf hukm par; banking/finance apps aur password/OTP fields hamesha refused hain. action=stop se foran band.",
    parameters: { type: "OBJECT", properties: { action: { type: "STRING", description: "tap | type | swipe | scroll | back | stop" }, find: { type: "STRING", description: "screen par wahi matn — button/field ka label (tap/type ke liye)" }, text: { type: "STRING", description: "sirf action=type ke liye" }, dir: { type: "STRING", description: "sirf action=scroll: down (neeche dekhna) | up (upar) | left | right" }, index: { type: "INTEGER", description: "same naam ke multiple elements mein kaunsa (0=default)" }, x1: { type: "INTEGER" }, y1: { type: "INTEGER" }, x2: { type: "INTEGER" }, y2: { type: "INTEGER" }, ms: { type: "INTEGER" } }, required: ["action"] } }
];
async function execTool(name, args){
  args = args || {};
  var out;

  /* ═══ 🛡️ P3 LAGAAM — amal se PEHLE teen pehredaar ═══ */
  if (typeof RAILS !== "undefined" && FLAGS.on("ijazat")) {
    var _g = RAILS.check(name, args);
    if (!_g.ok) {
      var _r = { ok: false, done: false, state: "failed", sure: true, note: _g.why, sach: "ROKA GAYA. " + _g.why };
      try { pushLog("RAILS: " + name + " roka gaya"); TRACE.tool(name, _r); } catch (e) {}
      return _r;
    }
  }
  if (typeof IJAZAT !== "undefined" && IJAZAT.need(name)) {
    var _yes = false;
    try { _yes = await IJAZAT.ask(name, args); } catch (e) { _yes = false; }
    if (!_yes) {
      var _n = { ok: false, done: false, state: "failed", sure: true, note: "user ne ijazat nahi di",
                 sach: "User ne IJAZAT NAHI DI. Ye kaam nahi hua \u2014 aur ye bilkul theek hai. Zid mat karo." };
      try { TRACE.tool(name, _n); } catch (e) {}
      return _n;
    }
  }
  var _before;
  try { _before = LEDGER.snap(name, args); } catch (e) {}

  try {
  /* 🖐 AMAL (maya_act) — device control. Guards Kotlin mein; yahan
     sirf pre-flight status + bridge call. Text KABHI note/log nahi hota. */
  if (name === "maya_act") {
    var _act = String(args.action || "tap");
    if (_act === "stop") { MAYA_AMAL.stop(); return { ok: true, done: true, state: "done", note: "automation foran band" }; }
    if (!MAYA_AMAL.can()) return { ok: false, done: false, state: "failed", sure: true,
      note: "Accessibility band — Settings > Accessibility > MAYA AutoSend ON karo",
      sach: "Automation IMKANAT nahi rakhta abhi. Accessibility service ke bagair koi tap/type nahi ho sakta." };
    var _st = MAYA_AMAL.status();
    if (_st.killedCooldown) return { ok: false, done: false, state: "failed", sure: true,
      note: "kill-switch cooldown chal raha hai — thodi der baad naya hukm",
      sach: "STOP ke baad 60s cooldown — ye suraksha hai, kami nahi." };
    var _j = MAYA_AMAL.act(args);
    return { ok: !!_j.ok, done: false, state: _j.ok ? "started" : "failed",
      note: _j.ok ? ("queue x" + (_j.queued || 1) + " — verified tap/type; STOP notification ya 'ruk jao' se foran band") : (_j.why || "roka gaya"),
      sach: _j.ok ? "Action queue ho gaya, natija HUD log mein aayega." : ("REFUSED: " + (_j.why || "guard") + ". Zid mat karo.") };
  }
    if (name === "set_alarm") {
      var hr = Math.max(0, Math.min(23, parseInt(args.hour, 10) || 0));
      var mi = Math.max(0, Math.min(59, parseInt(args.minute, 10) || 0));
      var ar = 0;
      if (NATIVE) { try { ar = parseInt(window.MayaBridge.setAlarm(hr, mi, String(args.message || "MAYA Alarm")), 10) || 0; } catch(e){} }
      out = ar === 2 ? { done: true, how: "silent system alarm", time: pad2(hr) + ":" + pad2(mi) }
           : ar === 1 ? { done: true, how: "clock app prefilled khula — save dabana hai", time: pad2(hr) + ":" + pad2(mi) }
           : { done: false, note: "alarm app nahi mila (browser mode)" };
    } else if (name === "set_timer") {
      var sec = Math.max(5, Math.min(86400, parseInt(args.seconds, 10) || 60));
      var lbl = String(args.label || (sec + " sec timer"));
      var okT = false;
      if (NATIVE) { try { okT = window.MayaBridge.setTimer(sec, "MAYA: " + lbl) === true; } catch(e){} }
      if (!okT) startTimer(sec, lbl);
      out = { done: true, how: okT ? "system timer" : "in-app timer" };
    } else if (name === "set_reminder") {
      var mins = Math.max(0.1, Math.min(1440, parseFloat(args.minutes) || 5));
      startTimer(Math.round(mins * 60), mins + " min reminder", String(args.text || "Reminder"));
      out = { done: true, note: "app khuli rahe to notification + awaz dono aayenge" };
    } else if (name === "open_app") {
      var a = String(args.app || "").toLowerCase().trim();
      var rec = APPS[a];
      if (rec) { openURL(rec.s); out = { done: true, app: a }; }
      else out = { done: false, available: Object.keys(APPS).join(", ") };
    } else if (name === "play_youtube") {
      var qy = String(args.query || "").trim();
      if (qy) out = { done: true, msg: await ytPlay(qy) };
      else out = { done: false, note: "query khali" };
    } else if (name === "search_web") {
      var qs = String(args.query || "").trim();
      if (qs) { openURL("https://www.google.com/search?q=" + encodeURIComponent(qs)); out = { done: true }; }
      else out = { done: false };
    } else if (name === "call_number") {
      var n1 = String(args.number || "").replace(/[^\d+]/g, "");
      if (n1.length >= 4) { openURL("tel:" + n1); out = { done: true }; } else out = { done: false, note: "number ghalat" };
    } else if (name === "send_sms") {
      var n2 = String(args.number || "").replace(/[^\d+]/g, "");
      if (n2.length >= 4) { openURL("sms:" + n2); out = { done: true }; } else out = { done: false };
    } else if (name === "create_skill") {
      var sName = String(args.name || "").trim().slice(0, 40);
      var sWhen = String(args.when || "").trim().slice(0, 120);
      var sPrompt = String(args.prompt || "").trim().slice(0, 400);
      if (sName && sPrompt) {
        try { new RegExp(sWhen || sName, "i"); } catch (e) { sWhen = sName; }
        customSkills = customSkills.filter(function(s){ return s.name.toLowerCase() !== sName.toLowerCase(); });
        customSkills.push({ name: sName, when: sWhen || sName, prompt: sPrompt });
        saveSkills();
        pushLog("SKILL LEARNED: " + sName);
        out = { learned: true, total: customSkills.length };
      } else out = { learned: false };
    } else if (name === "prayer_times") {
      var pt = await prayerTimes();
      out = pt ? { city: settings.city, timings: pt } : { error: "namaz times nahi mile — internet check" };
    } else if (name === "read_messages") {
      if (!NATIVE) out = { error: "sirf APK" };
      else if (!notifAccessOk()) out = { error: "notification access permission chahiye — user se bolo Settings > Notification Access > MAYA ON kare" };
      else {
        try { out = { messages: JSON.parse(window.MayaBridge.notifHistory() || "[]").slice(-8) }; } catch(e){ out = { messages: [] }; }
      }
    } else if (name === "reply_message") {
      if (!NATIVE) out = { done: false, note: "sirf APK" };
      else {
        var rok = false;
        try { rok = window.MayaBridge.notifReply(String(args.name || ""), String(args.text || "")) === 1; } catch(e){}
        out = rok ? { done: true, how: "whatsapp draft + autosend" } : { done: false, note: "reply nahi bhej saki — contact/accessibility check" };
      }
    } else if (name === "schedule_message") {
      var mins2 = Math.max(1, Math.min(2880, parseFloat(args.minutes) || 10));
      var id2 = "t" + Date.now();
      schedTasks[id2] = { kind: "message", name: String(args.name || ""), text: String(args.text || ""), at: Date.now() + mins2 * 60000 };
      saveSched();
      var osk = false;
      if (NATIVE) { try { osk = window.MayaBridge.scheduleTask(id2, Math.round(mins2 * 60000)) === true; } catch(e){} }
      out = osk ? { done: true, note: mins2 + " min baad WhatsApp draft+autosend khulega (phone unlocked ho to)" }
                : { done: false, note: "scheduler nahi chala — app khuli rakho" };
    } else if (name === "torch_control") {
      var ot1 = false;
      if (NATIVE) { try { ot1 = window.MayaBridge.torch(args.on === true) === true; } catch(e){} }
      out = ot1 ? { done: true } : { done: false, note: "torch nahi chali (sirf APK)" };
    } else if (name === "volume_control") {
      var ov1 = -1;
      if (NATIVE) { try { ov1 = parseInt(window.MayaBridge.volume(Math.max(0, Math.min(100, parseInt(args.percent, 10) || 50))), 10); } catch(e){} }
      out = ov1 >= 0 ? { done: true, level: ov1 } : { done: false };
    } else if (name === "brightness_control") {
      var ob1 = -1;
      if (NATIVE) { try { ob1 = parseInt(window.MayaBridge.brightness(Math.max(5, Math.min(100, parseInt(args.percent, 10) || 50))), 10); } catch(e){} }
      out = ob1 === -2 ? { done: false, note: "permission dialog khula hai — allow kar ke dobara" } : (ob1 >= 0 ? { done: true, level: ob1 } : { done: false });
    } else if (name === "web_search") {
      out = await webSearch(String(args.query || ""));
    } else if (name === "wiki_search") {
      out = await wikiLookup(String(args.query || ""));
    } else if (name === "list_files") {
      out = await listFilesAction(String(args.folder || "downloads"));
    } else if (name === "open_file") {
      var fo = fileFind(String(args.name || ""));
      if (!fo && NATIVE) { await listFilesAction("downloads"); fo = fileFind(String(args.name || "")); }
      if (fo) { var oko = false; try { oko = window.MayaBridge.openFile(fo.uri, fo.type) === true; } catch(e){} out = oko ? { done: true, file: fo.name } : { done: false, note: "kholne wala app nahi mila" }; }
      else out = { done: false, note: "file nahi mili — pehle list_files se check karo" };
    } else if (name === "share_file") {
      var fs2 = fileFind(String(args.name || ""));
      if (fs2) { var oks = false; try { oks = window.MayaBridge.shareFile(fs2.uri, fs2.type) === true; } catch(e){} out = oks ? { done: true } : { done: false }; }
      else out = { done: false, note: "file nahi mili" };
    } else if (name === "search_memory") {
      var sq = String(args.query || "").toLowerCase().trim();
      var hits = [];
      facts.forEach(function(f){ if (!sq || f.toLowerCase().indexOf(sq) >= 0) hits.push("FACT: " + f); });
      diary.forEach(function(d){ if (!sq || d.text.toLowerCase().indexOf(sq) >= 0) hits.push("DIARY: " + d.text); });
      chatHist.slice(-200).forEach(function(h){ if (sq && h.text.toLowerCase().indexOf(sq) >= 0) hits.push((h.role === "user" ? "USER: " : "MAYA: ") + h.text.slice(0, 150)); });
      out = { matches: hits.slice(0, 12), total: hits.length };
    } else if (name === "run_javascript") {
      out = await sandboxRun(String(args.code || ""), String(args.input || ""));
    } else if (name === "web_fetch") {
      var wurl = String(args.url || "");
      if (!/^https?:\/\//.test(wurl)) { out = { error: "poora URL do (https://...)" }; }
      else {
        var wtxt = "";
        if (NATIVE && window.MayaBridge.httpGet) {
          var wr = JSON.parse(window.MayaBridge.httpGet(wurl, ""));
          if (wr.status >= 200 && wr.status < 300) wtxt = htmlToText(wr.body).slice(0, 3000);
        } else {
          try {
            var wf = await fetch(wurl);
            if (wf.ok) wtxt = htmlToText(await wf.text()).slice(0, 3000);
          } catch (e) {}
        }
        out = wtxt ? { ok: true, text: wtxt } : { error: "page nahi khul saka (site block ya JS-only page ho sakta hai)" };
      }
    } else if (name === "diary_write") {
      var de = String(args.entry || "").trim().slice(0, 400);
      if (de) {
        diary.push({ t: Date.now(), text: de });
        saveDiary(); hudRefresh();
        out = { written: true, total: diary.length };
      } else out = { written: false };
    } else if (name === "diary_search") {
      var dq = String(args.query || "").toLowerCase().trim();
      var cutoff = 0;
      if (/kal|yesterday/.test(dq)) cutoff = Date.now() - 172800000;
      if (/hafte|week/.test(dq)) cutoff = Date.now() - 604800000;
      var hits = diary.filter(function(d){
        if (d.t < cutoff && cutoff) return false;
        return !dq || d.text.toLowerCase().indexOf(dq) >= 0 || new Date(d.t).toLocaleDateString().toLowerCase().indexOf(dq) >= 0;
      }).slice(-8).map(function(d){
        return new Date(d.t).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) + ": " + d.text;
      });
      out = { entries: hits, total: diary.length };
    } else if (name === "call_contact") {
      if (!NATIVE) { out = { done: false, note: "sirf APK mein" }; }
      else {
        try {
          var cr = JSON.parse(window.MayaBridge.contactsSearch(String(args.name || "")));
          if (cr.error === "permission") out = { done: false, note: "contacts permission ka dialog aaya hai — allow kar ke dobara bolo" };
          else if (!cr.matches || !cr.matches.length) out = { done: false, note: "is naam ka contact nahi mila" };
          else if (cr.matches.length > 1) out = { done: false, note: "ek se zyada matches mile — user se poocho kaunsa (number bhi batao)", matches: cr.matches.slice(0, 4) };
          else {
            var cc = cr.matches[0];
            var okc = false;
            try { okc = window.MayaBridge.autoCall(cc.number) === true; } catch(e){}
            out = okc ? { done: true, who: cc.name, number: cc.number, how: "call lag gayi (auto)" }
                      : { done: false, who: cc.name, note: "phone/call permission ka dialog aaya — allow kar ke dobara bolo" };
          }
        } catch(e){ out = { error: String(e && e.message || e) }; }
      }
    } else if (name === "message_contact") {
      if (!NATIVE) { out = { done: false, note: "sirf APK mein" }; }
      else {
        try {
          var mr = JSON.parse(window.MayaBridge.contactsSearch(String(args.name || "")));
          if (mr.error === "permission") out = { done: false, note: "contacts permission ka dialog aaya hai — allow kar ke dobara bolo" };
          else if (!mr.matches || !mr.matches.length) out = { done: false, note: "contact nahi mila" };
          else if (mr.matches.length > 1) out = { done: false, note: "ek se zyada matches — user se poocho kaunsa", matches: mr.matches.slice(0, 4) };
          else {
            var mc = mr.matches[0];
            var txt = String(args.text || "");
            var okm = false;
            if (String(args.app || "whatsapp") === "sms") { try { okm = window.MayaBridge.smsDraft(mc.number, txt) === true; } catch(e){} }
            else {
              var as1 = false;
              try { as1 = window.MayaBridge.accessibilityEnabled() === true; } catch(e){}
              try { okm = window.MayaBridge.openWhatsAppDraft(mc.number, txt, as1) === true; } catch(e){}
            }
            out = okm ? { done: true, who: mc.name, how: "chat khul gaya message type ho chuka" } : { done: false };
          }
        } catch(e){ out = { error: String(e && e.message || e) }; }
      }
    } else if (name === "get_weather") {
      out = await fetchWeather(args.city);
    } else if (name === "battery_status") {
      var bat = null;
      if (NATIVE) { try { bat = JSON.parse(window.MayaBridge.battery()); } catch(e){} }
      if (!bat && navigator.getBattery) { try { var bb = await navigator.getBattery(); bat = { level: Math.round(bb.level * 100), charging: bb.charging }; } catch(e){} }
      out = bat || { error: "battery info nahi mili" };
    } else if (name === "save_memory") {
      var f = String(args.fact || "").trim().slice(0, 200);
      if (f) { facts.unshift(f); saveFacts(); out = { saved: true, total: facts.length }; }
      else out = { saved: false };
    } else if (name === "recall_memory") {
      out = { facts: facts.slice(0, 15), total: facts.length };
    } else if (name === "read_screen") {
      if (typeof NAZAR === "undefined" || !FLAGS.on("nazar")) {
        out = { done: false, note: "NAZAR band hai \u2014 Settings > LAB > 👁️ NAZAR ON karo" };
      } else {
        var nz = NAZAR.look(90);
        out = nz.ok ? { done: true, app: nz.app, count: nz.items.length, screen: NAZAR.forBrain(nz) }
                    : { done: false, note: nz.why };
      }
    } else if (name === "see_camera" || name === "see_image") {
      var vr = AANKH.ask(args.question || args.q || "", name === "see_image" ? "gallery" : "camera");
      out = vr.ok ? { done: true, state: "started", note: vr.note } : { done: false, note: vr.note };
    } else if (name === "notify") {
      var ttl = String(args.title || "MAYA"), msgn = String(args.message || "");
      var okN = false;
      if (NATIVE) { try { window.MayaBridge.notify(ttl, msgn); okN = true; } catch(e){} }
      if (!okN) toast(ttl + ": " + msgn);
      out = { done: true, how: okN ? "notification" : "toast" };
    } else {
      out = { error: "unknown tool: " + name };
    }
  } catch (e) { out = { error: String(e && e.message || e) }; }
  /* 🤝 SACH: har tool ke jawab mein `sure` jur jata hai — kya kaam SACH MEIN hua? */
  try { if (typeof HAQEEQAT !== "undefined" && FLAGS.on("sach")) out = HAQEEQAT.wrap(name, out); } catch (e) {}
  /* 📜 roznamcha + ⟲ undo ki halat + 📊 trace */
  try { LEDGER.push(name, args, out, _before); TRACE.tool(name, out); } catch (e) {}
  return out;
}

