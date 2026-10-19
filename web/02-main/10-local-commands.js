/* ---------- LOCAL COMMANDS ---------- */
var APPS = {
  "whatsapp":{s:"https://wa.me/",w:"https://web.whatsapp.com"},
  "youtube":{s:"https://m.youtube.com",w:"https://m.youtube.com"},
  "instagram":{s:"https://www.instagram.com/",w:"https://www.instagram.com"},
  "facebook":{s:"https://m.facebook.com/",w:"https://m.facebook.com"},
  "telegram":{s:"https://web.telegram.org/",w:"https://web.telegram.org"},
  "gmail":{s:"https://mail.google.com/",w:"https://mail.google.com"},
  "maps":{s:"https://maps.google.com/",w:"https://maps.google.com"},
  "play store":{s:"https://play.google.com/store/apps",w:"https://play.google.com"},
  "playstore":{s:"https://play.google.com/store/apps",w:"https://play.google.com"},
  "google":{s:"https://www.google.com",w:"https://www.google.com"},
  "chrome":{s:"https://www.google.com",w:"https://www.google.com"},
  "netflix":{s:"https://www.netflix.com/",w:"https://www.netflix.com"},
  "spotify":{s:"https://open.spotify.com/",w:"https://open.spotify.com"},
  "snapchat":{s:"https://www.snapchat.com/",w:"https://www.snapchat.com"},
  "twitter":{s:"https://x.com/",w:"https://x.com"},
  "x":{s:"https://x.com/",w:"https://x.com"},
  "tiktok":{s:"https://www.tiktok.com/",w:"https://www.tiktok.com"},
  "daraz":{s:"https://www.daraz.pk/",w:"https://www.daraz.pk"}
};
var NUMWORDS = {ek:1,do:2,teen:3,char:4,chaar:4,paanch:5,panch:5,chhe:6,che:6,chah:6,saat:7,aath:8,nau:9,das:10,barah:12,pandrah:15,bees:20,pachees:25,tees:30,chalis:40,pachas:50,sow:100};
function toNum(w){ return /^\d+$/.test(w) ? parseInt(w,10) : (NUMWORDS[w] || null); }

function tryLocal(t, wasVoice){
  wasVoice = (wasVoice !== false);
  var q = t.toLowerCase().trim();

  if (!settings.apikey) {
    if (/^(salam|assalam|hello|hi|hey|aoa)\b/.test(q)) return { reply:"Assalam-o-alaikum " + settings.name + "! Main MAYA hoon — aap ka 0-budget wala personal AI. Hukum karo!" };
    if (/(kaun ho|who are you|tumhara naam|tera naam|introduce yourself|tum kaun)/.test(q)) return { reply:"Main MAYA hoon, " + settings.name + " — aap ka personal AI assistant. Version 2, phase 1 — aur abhi to mainne shuru ki hai!" };
  }

  var mem = memHandle(q);
  if (mem) return { reply: mem };

  /* 🎯 NISHANA — pehle ye regex "Camera khol ke picture lo" ko bhi pakar leta tha
     aur "ke picture lo" ko app ka naam samajh kar bakwas jawab de deta tha.
     Ab: app ka naam LIST mein ho to hi handle karo, warna DIMAAG ko de do
     (dimaag ke paas open_app aur see_camera dono tools hain). */
  var m = q.match(/(?:open|kholo|khol do|khol|launch|chalu karo)\s+(?:the\s+|mera\s+)?([a-z ]+?)(?:\s+app|\s+karo)?\s*$/);
  if (m) {
    var app = m[1].trim();
    if (APPS[app]) return { reply:"Khul raha hai " + app + ", " + settings.name + ".", url:APPS[app].s, link:APPS[app].w };
    var appOne = app.split(/\s+/);
    if (appOne.length === 1 && APPS[appOne[0]]) {
      return { reply:"Khul raha hai " + appOne[0] + ", " + settings.name + ".", url:APPS[appOne[0]].s, link:APPS[appOne[0]].w };
    }
    /* list mein nahi — DIMAAG faisla kare (shayad camera/screenshot/kuch aur maanga hai) */
    return null;
  }

  m = q.match(/(?:youtube|yt|you tube)[^a-z0-9]*(?:pe|par|on)?\s*(.+?)\s*(?:chalao|chala do|laga do|laga|play|baja do|sunao|dikhao)$/) ||
      q.match(/^(.+?)\s*(?:chalao|laga do|play karo)\s*(?:youtube pe|youtube par|on youtube)$/);
  if (m && m[1]) {
    var song = m[1].replace(/^(pe|par|on|karo|play)\s+/,"").trim();
    if (song) {
      ytPlay(song).then(function(t2){ reply(t2, wasVoice); });
      return { reply: "" };
    }
  }

  /* 🎯 NISHANA — "arena agent search karo" par pehle sirf "karo" dhoonda jata tha,
     kyunke regex `search` ke BAAD wala hissa uthata tha aur wahan sirf "karo" bacha
     tha. Ab dono shaklein: "search X" AUR "X search karo". */
  var STOPQ = /^(karo|kar do|kar|do|de|dena|na|hi|ok|okay|please|abhi|bhi|to|se|ka|ki|ke|par|mein|me)$/i;
  var sq = "";
  m = q.match(/^(.{2,60}?)\s+(?:ko\s+)?(?:search|khojo|dhoondo|dhundo)\s*(?:karo|kar do|kar)?\s*$/);
  if (m && m[1]) sq = m[1].trim();
  if (!sq) {
    m = q.match(/(?:search|khojo|dhoondo|dhundo)\s*(?:karo|kar do)?\s*(?:for|about|pe|par)?\s*(.+)/);
    if (m && m[1]) sq = m[1].trim();
  }
  if (sq) {
    sq = sq.replace(/^(google|chrome|browser|internet|web)\s*(par|pe|mein|me|se)?\s*/i, "").trim();
    sq = sq.replace(/\s+(karo|kar do|kar|please|abhi)$/i, "").trim();
    /* bacha hua matn bekaar ho to DIMAAG hi kare — jhoota search nahi */
    if (sq.length >= 2 && !STOPQ.test(sq)) {
      return { reply:"Google par '" + sq + "' dhoond rahi hoon.", url:"https://www.google.com/search?q=" + encodeURIComponent(sq), link:"https://www.google.com/search?q=" + encodeURIComponent(sq) };
    }
    return null;
  }

  if (/(waqt|time|kitne baje|baje h|samay|what time)/.test(q))
    return { reply:"Abhi " + new Date().toLocaleTimeString([], {hour:"numeric", minute:"2-digit"}) + " ka time hai, " + settings.name + "." };
  if (/(tareekh|tareek|date|aaj ka din|kaun sa din)/.test(q))
    return { reply:"Aaj " + new Date().toLocaleDateString("en-GB", {weekday:"long", day:"numeric", month:"long", year:"numeric"}) + " hai." };
  if (/(battery|batteri|battry|charge kitn)/.test(q)) {
    if (NATIVE) {
      try {
        var bi = JSON.parse(window.MayaBridge.battery());
        return { reply:"Battery " + bi.level + "% hai" + (bi.charging ? ", aur charging par hai" : "") + ", " + settings.name + "." };
      } catch(e){}
    }
    if (navigator.getBattery) {
      navigator.getBattery().then(function(b){
        reply("Battery " + Math.round(b.level * 100) + "% hai" + (b.charging ? ", aur charging par hai" : "") + ", " + settings.name + ".", false);
      });
      return { reply:"" };
    }
    return { reply:"Is browser battery status nahi bata sakta, " + settings.name + "." };
  }

  /* REAL ALARM (native) / smart fallback */
  if (/alarm/.test(q)) {
    var am = q.match(/(\d{1,2})(?::(\d{2}))?\s*(?:baje|bajay|bajay ka|o'?clock)/);
    if (am) {
      var hr = parseInt(am[1], 10), mi = am[2] ? parseInt(am[2], 10) : 0;
      if (/(dopahar|shaam|raat|evening|night|afternoon|maghrib)/.test(q)) { if (hr < 12) hr += 12; }
      else if (!/(subah|savere|savera|morning|fajr)/.test(q) && hr >= 1 && hr <= 7) { hr += 12; }
      if (hr >= 24) hr -= 24;
      var hh = (hr < 10 ? "0" : "") + hr, mm = (mi < 10 ? "0" : "") + mi;
      if (NATIVE) {
        try {
          var arL = parseInt(window.MayaBridge.setAlarm(hr, mi, "MAYA Alarm"), 10) || 0;
          if (arL === 2) return { reply:"Alarm set: " + hh + ":" + mm + ", " + settings.name + " — neend achi aaye!" };
          if (arL === 1) return { reply:"Clock app khula " + hh + ":" + mm + " ke saath — bas save dabana, " + settings.name + "." };
        } catch(e){}
      }
      return { reply:"Browser se system alarm nahi laga sakti — " + hh + ":" + mm + " ka khud alarm lagalo. APK version mein ye real alarm ban jata hai!" };
    }
    return { reply:"Alarm kis waqt ka, " + settings.name + "? Bolo: 'subah 6 baje alarm lagao'." };
  }

  if (/(timer|stopwatch)/.test(q)) {
    var tm = q.match(/(\d+|ek|do|teen|char|chaar|paanch|panch|chhe|che|chah|saat|aath|nau|das|barah|pandrah|bees|pachees|tees|chalis|pachas|sow)\s*(second|seconds|sec|minute|minutes|minut|minat|min|ghanta|ghante|ghantay|hour|hours)/);
    if (tm) {
      var n = toNum(tm[1]), unit = tm[2];
      var mult = /sec/.test(unit) ? 1 : (/ghant|hour/.test(unit) ? 3600 : 60);
      var label = n + " " + unit;
      if (NATIVE) {
        try {
          if (window.MayaBridge.setTimer(n * mult, "MAYA: " + label + " timer"))
            return { reply:label + " ka SYSTEM timer set ho gaya, " + settings.name + " — screen band ho to bhi notification aayega!" };
        } catch(e){}
      }
      startTimer(n * mult, label);
      return { reply:label + " ka timer set ho gaya, " + settings.name + "." };
    }
    return { reply:"Timer kitne ka, " + settings.name + "? Bolo: 'paanch minute ka timer lagao'." };
  }

  /* VISION fast path */
  if (/(ye|yeh|ye wali|is)\s*(dekho|chiz)/.test(q) || /(photo|tasveer)\s*(khincho|khich|lo|lena)/.test(q) || /camera khol/.test(q)) {
    if (NATIVE) {
      pendingVisionPrompt = stripped;
      var okc2 = false;
      try { okc2 = window.MayaBridge.takePhoto() === true; } catch(e){}
      return { reply: okc2 ? "Camera khol rahi hoon — photo khincho, main dekh loongi!" : "Camera nahi khul saka." };
    }
  }
  if (/(gallery|gallary)\s*(wali\s*)?(photo|image|tasveer|se)/.test(q) && NATIVE) {
    pendingVisionPrompt = stripped;
    try { window.MayaBridge.pickImage(); } catch(e){}
    return { reply: "Gallery khol rahi hoon — chunko photo." };
  }

  /* TORCH fast path */
  if (/(torch|flash\s?light|phone ki light|lighter)/.test(q) && /(jala|on|chalao|bujha|off|band|bandh)/.test(q)) {
    if (NATIVE) {
      var onT = /(jala|on|chalao)/.test(q);
      var okT2 = false;
      try { okT2 = window.MayaBridge.torch(onT) === true; } catch(e){}
      return { reply: okT2 ? (onT ? "Light jala di, " + settings.name + "!" : "Light band kar di.") : "Torch nahi chali." };
    }
    return { reply: "Torch sirf APK version mein, " + settings.name + "." };
  }

  /* VOLUME fast path */
  if (/(volume|awaaz|awaz|sound)/.test(q) && /(full|max|100|tez|loud|kam|low|down|silent|mute|badha|barha)/.test(q) && NATIVE) {
    var vp = /(kam|low|down|silent|mute)/.test(q) ? 15 : 100;
    try { window.MayaBridge.volume(vp); } catch(e){}
    return { reply: vp === 100 ? "Volume full kar diya!" : "Volume kam kar diya." };
  }

  /* BRIGHTNESS fast path */
  if (/brightness/.test(q) && /(kam|low|zyada|high|full|max|barha|badha)/.test(q) && NATIVE) {
    var bp = /(kam|low)/.test(q) ? 25 : 90;
    var bres = -1;
    try { bres = parseInt(window.MayaBridge.brightness(bp), 10); } catch(e){}
    return { reply: bres === -2 ? "Ek dafa permission allow karo, phir dobara bolo." : (bres >= 0 ? "Brightness set kar di." : "Brightness nahi badal saki.") };
  }

  /* PHONE LOCK */
  if (/(phone|mobile)\s*(lock|band)\s*(karo|kar do|karna)?/.test(q) && NATIVE) {
    var lok = false;
    try { lok = window.MayaBridge.lockScreen() === true; } catch(e){}
    return { reply: lok ? "Lock kar rahi hoon — milte hain " + settings.name + "!" : "Lock ke liye AutoSend (Accessibility) ON hona chahiye." };
  }

  /* MAYA KAHAN HAI — phone dhoondo! */
  if (/(maya\s*kahan|kahan\s*ho|where are you|mujhe dhoondo)/.test(q) && NATIVE) {
    try { window.MayaBridge.volume(100); } catch(e){}
    try { window.MayaBridge.vibrate(400); } catch(e){}
    try {
      window.MayaBridge.torch(true);
      setTimeout(function(){ try { window.MayaBridge.torch(false); } catch(e){} }, 400);
      setTimeout(function(){ try { window.MayaBridge.torch(true); } catch(e){} }, 900);
      setTimeout(function(){ try { window.MayaBridge.torch(false); } catch(e){} }, 1400);
    } catch(e){}
    return { reply: "MAIN YAHAN HOON " + settings.name + "! YAHAN! AWAAZ KA PECHA KARO!" };
  }

  /* NAMAZ fast path */
  if (/(namaz|namaaz|prayer)/.test(q) && /(waqt|time|kab|batao|kitne)/.test(q)) {
    prayerTimes().then(function(p){
      if (p) reply(settings.name + ", " + (settings.city || "Hyderabad") + " ke namaz ke waqt: Fajr " + p.fajr + ", Zohar " + p.dhuhr + ", Asar " + p.asr + ", Maghrib " + p.maghrib + ", Isha " + p.isha + ".", true);
      else reply("Namaz ke waqt nahi mile — internet check karo.", true);
    });
    return { reply: "" };
  }

  /* WHATSAPP READER fast path */
  if (/(nayi?|naye?|sab)?\s*(whatsapp|messages?|khabrein)\s*(sunao|padho|dikhao|batao|kya aaye)/.test(q)) {
    readMessages(wasVoice);
    return { reply: "" };
  }

  /* FILES fast path */
  if (/(downloads?|files?)\s*(mein|main|ka|ki)?\s*(kya|what|list|dikhao|kholo|dhoondo)/.test(q) && NATIVE) {
    listFilesAction("downloads").then(function(r){
      if (r.error) { reply("Files ki permission chahiye — dialog aaya hai, allow kar ke dobara bolo, " + settings.name + ".", wasVoice); return; }
      var names = (r.files || []).slice(0, 6).map(function(f2){ return f2.name; });
      reply((r.files || []).length ? "Downloads mein " + (r.files || []).length + " files hain. Sab se nayi: " + names.join("; ") + "." : "Downloads mein kuch nahi mila, " + settings.name + ".", wasVoice);
    });
    return { reply: "" };
  }
  if (/(latest|aakhiri|new|nayi)\s*(photo|screenshot|picture|tasveer|image)/.test(q) && NATIVE) {
    listFilesAction("pictures").then(function(r){
      var f3 = (r.files || [])[0];
      if (f3) { var okp = false; try { okp = window.MayaBridge.openFile(f3.uri, f3.type) === true; } catch(e){} reply(okp ? "Khol rahi hoon: " + f3.name : "Khol nahi saki.", wasVoice); }
      else reply("Pictures mein kuch nahi mila.", wasVoice);
    });
    return { reply: "" };
  }

  /* DIARY fast path */
  if (/(diary|roznamcha|dairy)/.test(q)) {
    var dm = q.match(/(?:diary|roznamcha|dairy)(?:\s*mein)?\s*(?:likho|likh do|entry karo|note)\s*[:]?\s*(.+)/);
    if (dm) {
      diary.push({ t: Date.now(), text: dm[1].trim().slice(0, 400) });
      saveDiary(); hudRefresh();
      return { reply: "Diary mein likh diya, " + settings.name + " — ab tak " + diary.length + " entries." };
    }
    if (/(padho|kholo|dikhao|kya likha|suna)/.test(q)) {
      var last = diary.slice(-5).map(function(d){ return new Date(d.t).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) + ": " + d.text; });
      return { reply: last.length ? "Aap ki diary ke aakhri " + last.length + " entries: " + last.join("; ") + "." : "Diary abhi khali hai, " + settings.name + ". Bolo: diary mein likho... aur main likh dungi." };
    }
  }

  /* NAAM se call (fast path) */
  m = q.match(/([a-z\u0600-\u06FF][a-z\u0600-\u06FF .]{1,24}?)\s*ko\s*(?:call|phone|missed call|phone call)/);
  if (m && NATIVE && !/\d/.test(m[1])) {
    execTool("call_contact", { name: m[1].trim() }).then(function(r){
      if (r && r.done) reply("Laga rahi hoon call " + r.who + " ko, " + settings.name + ".", wasVoice);
      else if (r && r.matches) reply("Ek se zyada " + m[1].trim() + " mile — poora naam bolo.", wasVoice);
      else reply(r && r.note ? r.note : "Ye naam contact list mein nahi mila, " + settings.name + ".", wasVoice);
    });
    return { reply: "" };
  }
  m = q.match(/(?:call|phone|phone call)\s*(?:karo|karna|kar do)?\s*(?:on|to|par|pe)?\s*(\+?\d[\d\s-]{6,})/);
  if (m) return { reply:"Number dial kar rahi hoon.", url:"tel:" + m[1].replace(/[\s-]/g,""), link:"tel:" + m[1].replace(/[\s-]/g,"") };
  m = q.match(/(?:message|msg|sms)\s*(?:karo|send|bhejo)?\s*(?:on|to|par|pe)?\s*(\+?\d[\d\s-]{6,})/);
  if (m) return { reply:"Message screen khul raha hai.", url:"sms:" + m[1].replace(/[\s-]/g,""), link:"sms:" + m[1].replace(/[\s-]/g,"") };

  /* Phase 3: mausam + routines */
  if (/(mausam|mosam|weather|barish hone|garmi kitn|thand kitn)/.test(q)) {
    fetchWeather().then(function(w){
      if (w && w.temp != null)
        reply(settings.name + ", " + w.city + " mein abhi " + w.temp + " degree hai — " + w.desc + (w.max != null ? ". Aaj high " + w.max + " aur low " + w.min + " degree rahega." : "."), true);
      else reply("Mausam ka data nahi mil pa raha — internet check karo, " + settings.name + ".", true);
    });
    return { reply: "" };
  }
  if (/(good morning|subah bakhair|subah bakhayr|morning maya|morning briefing|din shuru)/.test(q)) {
    morningBrief();
    return { reply: "" };
  }
  if (/(good night|shab bakhair|raat bakhair|so ja|sojta)/.test(q)) {
    var gn = "Shab bakhair, " + settings.name + "! Main aap ke khwaboon ki guard ban kar baithi rahungi.";
    try {
      if (NATIVE) {
        var b = JSON.parse(window.MayaBridge.battery());
        if (!b.charging && b.level < 25) gn = " " + settings.name + ", pehle charger laga lo — battery sirf " + b.level + " percent hai, werna main bhi so jaungi! " + gn;
      }
    } catch(e){}
    return { reply: gn };
  }

  return null;
}

