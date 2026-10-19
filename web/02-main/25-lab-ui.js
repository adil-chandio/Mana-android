/* ═══ 🧪 MAYA LAB — switches, baseline, harvest, diagnostic ═══ */
function labPaint(){
  var f = FLAGS.load(), n, h;
  n = $("#labNaap");  if (n) n.checked = f.naap === true;
  n = $("#labSaaf");  if (n) n.checked = f.saaf === true;
  n = $("#labMalik"); if (n) n.checked = f.malik === true;
  n = $("#labPool");  if (n) n.checked = f.poolTools === true;
  n = $("#labSuno");  if (n) n.checked = f.suno === true;
  n = $("#labSach");  if (n) n.checked = f.sach === true;
  n = $("#labBoli");  if (n) n.checked = f.boli === true;
  n = $("#labIjazat"); if (n) n.checked = f.ijazat === true;
  n = $("#labBijli"); if (n) n.checked = f.bijli === true;
  n = $("#labNazar"); if (n) n.checked = f.nazar === true;
  n = $("#labSukoon"); if (n) n.checked = f.sukoon === true;
  h = $("#labHint");
  if (h) {
    var on = [];
    if (f.naap) on.push("📊 naap");
    if (f.saaf) on.push("🧹 saaf");
    if (f.malik) on.push("👑 malik");
    if (f.poolTools) on.push("⚡ amal");
    if (f.suno) on.push("🎙️ suno");
    if (f.sach) on.push("🤝 sach");
    if (f.boli) on.push("🗣️ boli");
    if (f.ijazat) on.push("🛡️ ijazat");
    if (f.bijli) on.push("⚡ bijli");
    if (f.nazar) on.push("👁️ nazar");
    h.className = "ui-hint" + (on.length ? " ok" : "");
    h.textContent = on.length ? ("Chalu: " + on.join(" · ") + "   •   " + NAAP.hist.length + " turn (is session mein naape)")
                              : "Sab band — Maya bilkul purane tareeqe par chal rahi hai.";
  }
}
(function(){
  function sw(id, key, note){
    var el = $("#" + id);
    if (!el) return;
    el.addEventListener("change", function(){
      FLAGS.set(key, el.checked);
      labPaint();
      toast((el.checked ? "✅ ON — " : "⭕ OFF — ") + note);
    });
  }
  sw("labNaap",  "naap",  "📊 naap");
  sw("labSaaf",  "saaf",  "🧹 saaf zubaan");
  sw("labMalik", "malik", "👑 malik profile");
  sw("labPool",  "poolTools", "⚡ tools har dimaag ko");
  sw("labSuno",  "suno", "🎙️ awaaz Roman Urdu mein");
  sw("labSach",  "sach", "🤝 jhoot band");
  sw("labBoli",  "boli", "🗣️ hamare lehje mein");
  sw("labIjazat","ijazat", "🛡️ lagaam");
  sw("labBijli", "bijli", "⚡ 50ms amal");
  sw("labNazar", "nazar", "👁️ screen parhna");
  /* 🎚️ P9 SUKOON — gate Kotlin mein yeh pref LIVE parhta hai: toggle par turant mirror */
  sw("labSukoon", "sukoon", "🎚️ awaaz+mic sukoon");
  var labSukoonMirror = function () {
    try {
      if (window.MayaBridge && window.MayaBridge.setPref) window.MayaBridge.setPref("sukoon", FLAGS.on("sukoon"));
    } catch (e) {}
  };
  labSukoonMirror();                                       /* boot par */
  var lsk = $("#labSukoon");
  if (lsk) lsk.addEventListener("change", labSukoonMirror); /* toggle par */

  function show(txt){
    var el = $("#labOut");
    if (!el) return;
    el.classList.add("show"); el.style.display = "block";
    el.textContent = txt;
    el.scrollTop = 0;
  }

  var kd = $("#labKaanDoc");
  if (kd) kd.addEventListener("click", function(){ show(KAAN.doctor()); });

  var mt = $("#labMicTest");
  if (mt) mt.addEventListener("click", function(){
    if (mt.disabled) return;
    mt.disabled = true;
    var old = mt.textContent;
    mt.textContent = "🎤 BOLIYE… (5 sec)";
    show("🎤 MIC TEST chal raha hai…\n\n  Pehla 1 second CHUP raho (kamre ka shor naapa jayega),\n  phir aam awaaz mein boliye: \"Maya kaise ho\"");
    setTimeout(function(){
      KAAN.micTest(function(txt){
        mt.disabled = false; mt.textContent = old;
        show(txt);
        pushLog("MIC TEST done");
      });
    }, 400);
  });

  var sv = $("#setVoice");
  if (sv) sv.addEventListener("click", function(){
    try { window.MayaBridge.openSetting("voice"); } catch (e) { toast("Sirf APK mein"); }
  });
  var sb2 = $("#setBatt");
  if (sb2) sb2.addEventListener("click", function(){
    try { window.MayaBridge.openSetting("battery"); } catch (e) { toast("Sirf APK mein"); }
  });

  /* 🗣️ v5.9.5 — jo cheez doctor sirf LIKHTA tha, ab MAUJOOD hai */
  var lod = $("#labOnDevice");
  if (lod) lod.addEventListener("click", function(){
    var ok = false;
    try { ok = window.MayaBridge.openSetting("ondevice") === true; } catch (e) {}
    /* Likha hua shajra bhi saath — koi ghalat screen khul jaye to raasta yaad rahe */
    show("\uD83D\uDDE3\uFE0F ON-DEVICE LANGUAGE\n\n" +
      "Jo screen khuli us mein dhoondo:\n" +
      "  Gboard \u2192 Voice typing \u2192 'Faster voice typing' ON\n" +
      "  phir 'Offline speech recognition' par dabao \u2192 ALL list se:\n" +
      "     \u0627\u0631\u062F\u0648 (Urdu)  +  English (India)   DOWNLOAD\n\n" +
      "(har zubaan ~80MB — Wi-Fi par khoob hoga)\n\n" +
      "Agar woh screen na khuli to chhota raasta:\n" +
      "  Settings \u2192 System \u2192 Languages & input \u2192 On-screen keyboard\n" +
      "  \u2192 Gboard \u2192 Voice typing \u2192 Faster voice typing ON\n\n" +
      "Ho jaye to MAYA band karo \u2192 dobara kholo \u2192 \uD83E\uDE7A KAAN DOCTOR mein\n" +
      "'On-device recognizer: maujood' likhna chahiye.");
    if (!ok) { try { window.MayaBridge.openSetting("voice"); } catch (e2) { toast("Settings khol nahi saki — manual raasta upar"); } }
  });

  var kb = $("#labKaan");
  if (kb) kb.addEventListener("click", function(){ show(KAAN.report()); });

  var nb = $("#labNazarTest");
  if (nb) nb.addEventListener("click", function(){
    if (!NAZAR.can()) {
      show("\uD83D\uDC41\uFE0F Screen parhna sirf APK mein chalta hai.\n\n" +
           "Aur uske liye Accessibility ON honi chahiye:\n" +
           "Settings \u2192 Accessibility \u2192 MAYA AutoSend \u2192 ON\n\n" +
           "\u26A0\uFE0F Agar pehle se ON thi to bhi ek dafa OFF kar ke dobara ON karo \u2014\n" +
           "   is version mein service ka config badla hai.");
      return;
    }
    var t0 = (new Date()).getTime();
    var r = NAZAR.look(90);
    var ms = (new Date()).getTime() - t0;
    show(NAZAR.forEye(r) + "\n\n  \u23F1\uFE0F " + ms + "ms   \u00B7   dimaag ko ~" + NAZAR.tokens(r) + " token jayenge");
    pushLog("NAZAR: " + (r.ok ? (r.app + " \u2014 " + r.items.length + " cheezein " + ms + "ms") : ("nakaam \u2014 " + r.why)));
    /* v5.10.1 — accessibility OFF ka seedha ilaaj: ek tap mein settings khol do
       (video review: user khud Digital Assistant settings dhoondh raha tha) */
    if (!r.ok && /accessibility/i.test(String(r.why || ""))) {
      try {
        if (window.confirm("MAYA AutoSend accessibility OFF hai.\n\nAccessibility settings abhi kholun?")) {
          window.MayaBridge.openSetting("accessibility");
          toast("\u2699\uFE0F Accessibility settings khul gayi \u2014 MAYA AutoSend ON karo");
        }
      } catch (e) {}
    }
  });

  var lb = $("#labLedger");
  if (lb) lb.addEventListener("click", function(){
    show(LEDGER.today() + "\n\n\u27F2 \"wapas karo\" bolo to aakhri wapas-hone-laiq kaam palat dungi.");
  });

  var b = $("#labBaseline");
  if (b) b.addEventListener("click", function(){ show(NAAP.report()); });

  b = $("#labHarvest");
  if (b) b.addEventListener("click", function(){ show(HARVEST.report()); });

  /* ===== SETTINGS BACKUP / RESTORE (v5.10.2) =====
     Uninstall se pehle backup, naye install mein ek tap restore.
     Sab localStorage keys (settings + keys + ledger + chat) ek JSON mein. */
  b = $("#labBackup");
  if (b) b.addEventListener("click", function(){
    if (!NATIVE || !window.MayaBridge.saveTextToDownloads) { toast("Backup sirf APK mein hai"); return; }
    try {
      var dump = {}, i, k;
      for (i = 0; i < localStorage.length; i++) {
        k = localStorage.key(i);
        dump[k] = localStorage.getItem(k);
      }
      dump.__mayaBackup = { ver: (typeof UPDATE_CHECK !== "undefined" ? UPDATE_CHECK.VER : "?"), at: (new Date()).toISOString(), keys: localStorage.length };
      var name = "maya-settings-" + (new Date()).toISOString().slice(0, 10) + ".json";
      var r = JSON.parse(window.MayaBridge.saveTextToDownloads(name, JSON.stringify(dump)));
      if (r && r.ok) {
        show("\uD83D\uDCE6 SETTINGS BACKUP — tayyar!\n\n  File: " + (r.name || name) + "\n  Jagah: Download folder\n  Cheezein: " + localStorage.length + " (settings, keys, ledger, sab)\n\n" +
             "\uD83D\uDCA1 Yaad rakhein: file khud Download folder mein hai — chahein to WhatsApp/Drive par bhi rakh lein.\n" +
             "\uD83D\uDD04 Jab app dobara install karein: \uD83D\uDCE5 SETTINGS RESTORE dabao — sab wapas.");
        pushLog("BACKUP: " + name + " save ho gayi (" + localStorage.length + " keys)");
      } else {
        show("\u274C Backup nahi ban saki: " + ((r && r.why) || "wajah maloom nahi") + "\n\nStorage permission check karo ya dobara koshish karo.");
      }
    } catch (e) { show("\u274C Backup error: " + e.message); }
  });

  b = $("#labRestore");
  if (b) b.addEventListener("click", function(){
    if (!NATIVE || !window.MayaBridge.readText) { toast("Restore sirf APK mein hai"); return; }
    try {
      var list = JSON.parse(window.MayaBridge.listFiles("downloads"));
      var files = (list && list.files) || [], i, pick = null;
      for (i = 0; i < files.length; i++) {
        if (/maya-settings/i.test(files[i].name || "") && /\.json$/i.test(files[i].name || "")) { pick = files[i]; break; }
      }
      if (!pick) {
        show("\uD83D\uDCE5 Koi backup file nahi mili.\n\n  Download folder mein 'maya-settings-....json' honi chahiye.\n  Pehle \uD83D\uDCE6 SETTINGS BACKUP se banai thi?");
        return;
      }
      var raw = JSON.parse(window.MayaBridge.readText(pick.uri));
      if (!raw || !raw.ok) { show("\u274C File parh nahi saki: " + ((raw && raw.why) || "?")); return; }
      var dump = JSON.parse(raw.text || "{}");
      var n = 0, k;
      for (k in dump) {
        if (k === "__mayaBackup") continue;
        localStorage.setItem(k, dump[k]); n++;
      }
      show("\u2705 RESTORE ho gaya! (" + n + " cheezein wapas)\n\n  File: " + (pick.name || "") + "\n  Backup: " + ((dump.__mayaBackup && dump.__mayaBackup.at) || "?") + "\n\n  App dobara khul rahi hai — settings lag jayengi...");
      pushLog("RESTORE: " + (pick.name || "?") + " se " + n + " cheezein wapas");
      setTimeout(function(){ try { location.reload(); } catch (e) {} }, 1200);
    } catch (e) { show("\u274C Restore error: " + e.message); }
  });

  /* ===== NTFY + MEMORY CLOUD (WAQT 3-B) ===== */
  b = $("#labNtfyTest");
  if (b) b.addEventListener("click", function(){
    if (typeof NTFY !== "undefined" && NTFY.test) NTFY.test(function (msg) { show(msg); });
  });

  /* ===== MEGA DOCTOR + ONBOARDING (WAQT 4-A) ===== */
  b = $("#labMegaDoc");
  if (b) b.addEventListener("click", function(){
    if (typeof MAYADOCTOR !== "undefined" && MAYADOCTOR.mega) {
      show(MAYADOCTOR.mega());
      try { pushLog("MEGA DOCTOR: report bani"); } catch (e) {}
    }
  });

  b = $("#labOnboard");
  if (b) b.addEventListener("click", function(){
    if (typeof ONBOARD !== "undefined" && ONBOARD.start) {
      try { settings.onboarded = false; saveSettings(); } catch (e) {}
      ONBOARD.start();
    }
  });

  b = $("#labCloudInfo");
  if (b) b.addEventListener("click", function(){
    if (typeof MEMCLOUD !== "undefined" && MEMCLOUD.report) show(MEMCLOUD.report());
  });

  b = $("#labCloudBackup");
  if (b) b.addEventListener("click", function(){
    if (typeof MEMCLOUD !== "undefined" && MEMCLOUD.backup) MEMCLOUD.backup(function (msg) { show(msg); });
  });

  b = $("#labCloudRestore");
  if (b) b.addEventListener("click", function(){
    if (typeof MEMCLOUD !== "undefined" && MEMCLOUD.restore) {
      try {
        if (!window.confirm("Cloud backup se yaad wapas aayengi (facts/diary).\nMojoooda yaad badal sakti hain. Jaari rakhein?")) return;
      } catch (e) {}
      MEMCLOUD.restore(function (msg) { show(msg); });
    }
  });

  b = $("#labDiag");
  if (b) b.addEventListener("click", function(){
    var txt = DIAG.build();
    show(txt);
    var ok = DIAG.copy(txt);
    toast(ok ? "📋 Copy ho gaya — ab paste kar do" : "⚠️ Copy nahi hua — upar se khud copy karo");
    pushLog("DIAGNOSTIC copy" + (ok ? " ✅" : " (manual)"));
  });

  b = $("#labClear");
  if (b) b.addEventListener("click", function(){
    NAAP.clear(); labPaint(); show("🗑️ Naap ka data mit gaya. Ab se nayi ginti shuru.");
    toast("🗑️ Naap saaf");
  });
})();

