/* ═══════════════════════════════════════════════════════════════════════════
   🌅 ONBOARDING WIZARD + 🩺 MEGA DOCTOR — WAQT 4-A (v5.12.0)
   ---------------------------------------------------------------------------
   ONBOARD: pehli dafa app khule to ek friendly wizard — naam, ijazaat,
   (optional) keys, bas. Har step skip-able. settings.onboarded = true par
   dobara kabhi nahi.
   MAYADOCTOR.mega(): sab checks EK shareable report mein — masla ho to yeh
   report bhejein, 90% haal wahan mil jata hai.

   Rule: wizard sirf APK + pehli dafa (tests/jsdom ko kabhi block nahi).
   ═══════════════════════════════════════════════════════════════════════════ */
var ONBOARD = {
  step: 0,

  /* wizard tabhi jab: APK + pehli dafa + settings load ho chuke */
  maybeStart: function () {
    try {
      if (typeof NATIVE === "undefined" || !NATIVE) return false;
      if (settings && settings.onboarded) return false;
      ONBOARD.start();
      return true;
    } catch (e) { return false; }
  },

  start: function () {
    try {
      var ov = document.createElement("div");
      ov.id = "onboardOv";
      ov.style.cssText = "position:fixed;left:0;top:0;right:0;bottom:0;z-index:9999;" +
        "background:rgba(8,8,14,.97);color:#eee;font:14px/1.6 sans-serif;" +
        "overflow:auto;padding:18px;-webkit-overflow-scrolling:touch;";
      document.body.appendChild(ov);
      ONBOARD.el = ov;
      ONBOARD.step = 0;
      ONBOARD.render();
    } catch (e) {}
  },

  close: function (done) {
    try {
      settings.onboarded = true;
      saveSettings();
    } catch (e) {}
    try { if (ONBOARD.el && ONBOARD.el.parentNode) ONBOARD.el.parentNode.removeChild(ONBOARD.el); } catch (e) {}
    ONBOARD.el = null;
    try { toast(done ? "\uD83C\uDF1F MAYA tayyar hai, " + settings.name + "!" : "Theek hai — baad mein Settings se poora kar lein"); } catch (e) {}
    try { pushLog("ONBOARD: " + (done ? "poora hua" : "skip")); } catch (e) {}
  },

  permRow: function (icon, title, hint, statusFn, actionFn, actionLabel) {
    var st = false;
    try { st = !!statusFn(); } catch (e) {}
    return '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;margin:8px 0;' +
      'background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:10px">' +
      '<div style="font-size:20px">' + icon + '</div>' +
      '<div style="flex:1;min-width:0"><b>' + title + '</b><br><small style="opacity:.7">' + hint + '</small></div>' +
      '<button onclick="ONBOARD.act(\'' + actionFn + '\')" style="flex:none;padding:8px 12px;border-radius:8px;border:none;' +
      'cursor:pointer;font-weight:700;background:' + (st ? '#1d4d33' : '#7a4a12') + ';color:#fff">' +
      (st ? '\u2705 HO GAYA' : actionLabel) + '</button></div>';
  },

  act: function (which) {
    try {
      if (which === "mic") { if (window.MayaBridge && window.MayaBridge.requestMicPerm) window.MayaBridge.requestMicPerm(); }
      else if (which === "notif") { if (window.MayaBridge && window.MayaBridge.openNotifAccess) window.MayaBridge.openNotifAccess(); }
      else if (which === "batt") { if (window.MayaBridge && window.MayaBridge.requestBatteryUnrestricted) window.MayaBridge.requestBatteryUnrestricted(); }
      else if (which === "a11y") { if (window.MayaBridge && window.MayaBridge.openAccessibilitySettings) window.MayaBridge.openAccessibilitySettings(); }
    } catch (e) {}
    setTimeout(function () { try { ONBOARD.render(); } catch (e) {} }, 600);
  },

  render: function () {
    if (!ONBOARD.el) return;
    var ov = ONBOARD.el, s = ONBOARD.step, html = "";
    html += '<div style="max-width:520px;margin:0 auto">';
    html += '<div style="opacity:.55;font-size:11px;letter-spacing:2px">MAYA · ONBOARDING · ' + (s + 1) + '/5</div>';

    if (s === 0) {
      html += '<h2 style="margin:10px 0 6px">\uD83D\uDC4B Salaam! Main <span style="color:#FF7A1A">MAYA</span> hoon</h2>';
      html += '<p style="opacity:.85">Aap ki personal AI — bolti hai, sunti hai, kaam karti hai. 2 minute mein tayyar karte hain.</p>';
      html += '<div style="margin:16px 0"><b>Main aap ko kya bulaun?</b>' +
        '<input id="obName" value="' + obEsc(String(settings.name || "Sir")) + '" maxlength="20" ' +
        'style="width:100%;padding:12px;margin-top:8px;border-radius:8px;border:1px solid #444;background:#14141c;color:#eee;font-size:16px"></div>';
      html += obBtn("SHURU KARO \u2192", "ONBOARD.next()");
    } else if (s === 1) {
      html += '<h2 style="margin:10px 0 6px">\uD83D\uDD10 Ijazaat <small style="opacity:.6">(jo ho sake abhi — baad mein bhi ho jayengi)</small></h2>';
      html += ONBOARD.permRow("\uD83C\uDF99\uFE0F", "Mic", "sunne ke liye zaroori", function () { return window.MayaBridge && window.MayaBridge.micPerm && window.MayaBridge.micPerm(); }, "mic", "IJAZAT DO");
      html += ONBOARD.permRow("\uD83D\uDD14", "Notifications", "alerts + timer", function () { return window.MayaBridge && window.MayaBridge.notifEnabled && window.MayaBridge.notifEnabled(); }, "notif", "SETTINGS");
      html += ONBOARD.permRow("\uD83D\uDD0B", "Battery (unrestricted)", "wake word ke liye", function () { return window.MayaBridge && window.MayaBridge.batteryUnrestricted && window.MayaBridge.batteryUnrestricted(); }, "batt", "ALLOW");
      html += ONBOARD.permRow("\u267F\uFE0F", "Accessibility (AutoSend)", "screen parhna + taps", function () { return window.MayaBridge && window.MayaBridge.accessibilityEnabled && window.MayaBridge.accessibilityEnabled(); }, "a11y", "SETTINGS");
      html += obBtn("AAGE \u2192", "ONBOARD.next()");
    } else if (s === 2) {
      html += '<h2 style="margin:10px 0 6px">\uD83D\uDD11 Keys <small style="opacity:.6">(optional — free hain)</small></h2>';
      html += '<p style="opacity:.8">Bina keys ke bhi Maya chalti hai (keyless dimaag). Keys se tez + smart.</p>';
      html += obFld("Gemini / Groq key", "obKey", "AI dimaag ke liye — console.groq.com (free)");
      html += obFld("Fish Audio key", "obFish", "awaaz ke liye — fish.audio (free)");
      html += '<p style="opacity:.6;font-size:12px">\uD83D\uDD12 Keys sirf aap ke phone mein rehti hain — kabhi cloud par nahi.</p>';
      html += obBtn("INHEIN YAAD RAKHO", "ONBOARD.saveKeys()");
      html += obBtn("BAAD MEIN", "ONBOARD.next()", true);
    } else if (s === 3) {
      html += '<h2 style="margin:10px 0 6px">\uD83C\uDFB5 Awaaz</h2>';
      html += '<p style="opacity:.85">Abhi <b>' + obEsc(String(settings.voiceArtist === "maya" ? "Maya (default)" : (settings.voiceArtist || "Maya"))) + '</b> selected hai. ' +
        '30 se zyada awaazein Settings mein hain — abhi default theek hai.</p>';
      html += obBtn("THEEK HAI \u2192", "ONBOARD.next()");
    } else {
      html += '<h2 style="margin:10px 0 6px">\uD83C\uDF1F Tayyar hai!</h2>';
      html += '<p style="opacity:.85">Mic dabao ya "Maya" bolo — aur poochh lo jo chahein. ' +
        'Settings mein sab kuch mil jayega: wake word, automation, cloud backup, alerts.</p>';
      html += '<p style="opacity:.6;font-size:12px">\uD83C\uDFA1 Tip: LAB → 📦 SETTINGS BACKUP zaroor karein — phir kabhi koi fikar nahi.</p>';
      html += obBtn("MAYA KO JAGAO \uD83D\uDD25", "ONBOARD.close(true)");
    }

    html += '<div style="margin-top:14px;text-align:center">' +
      '<button onclick="ONBOARD.close(false)" style="background:none;border:none;color:#888;cursor:pointer;font-size:12px">skip — baad mein</button></div>';
    html += '</div>';
    ov.innerHTML = html;
  },

  next: function () {
    try {
      if (ONBOARD.step === 0) {
        var n = (document.getElementById("obName") || {}).value;
        if (n && String(n).trim()) { settings.name = String(n).trim().slice(0, 20); saveSettings(); }
      }
    } catch (e) {}
    ONBOARD.step = Math.min(ONBOARD.step + 1, 4);
    ONBOARD.render();
  },

  saveKeys: function () {
    try {
      var k = (document.getElementById("obKey") || {}).value;
      var f = (document.getElementById("obFish") || {}).value;
      if (k && String(k).trim()) { settings.groqKey = String(k).trim(); }
      if (f && String(f).trim()) { settings.fishKey = String(f).trim(); }
      saveSettings();
    } catch (e) {}
    ONBOARD.next();
  }
};

/* chhote HTML helpers (sirf wizard ke liye) */
function obEsc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }
function obBtn(label, fn, ghost) {
  return '<button onclick="' + fn + '" style="display:block;width:100%;padding:13px;margin:8px 0;border-radius:10px;' +
    'border:' + (ghost ? '1px solid #444' : 'none') + ';cursor:pointer;font-size:15px;font-weight:700;' +
    (ghost ? 'background:none;color:#ccc' : 'background:linear-gradient(135deg,#FF7A1A,#FFB347);color:#16161c') + '">' + label + '</button>';
}
function obFld(label, id, hint) {
  return '<div style="margin:10px 0"><b>' + label + '</b>' +
    '<input id="' + id + '" type="password" style="width:100%;padding:11px;margin-top:6px;border-radius:8px;' +
    'border:1px solid #444;background:#14141c;color:#eee" placeholder="paste here">' +
    '<small style="opacity:.6">' + hint + '</small></div>';
}

/* ═══════════════════════════════════════════════════════════════════════════
   🩺 MAYADOCTOR — MEGA REPORT: sab checks ek jagah, share karne laayak
   ═══════════════════════════════════════════════════════════════════════════ */
var MAYADOCTOR = {
  mega: function () {
    var L = [], i;
    function line(s) { L.push(s); }
    function yes(b) { return b ? "\u2705" : "\u274C"; }

    line("\uD83E\uDE7A MAYA MEGA DOCTOR — poora checkup");
    line("Tareekh: " + new Date().toLocaleString());
    line("========================================");
    line("");
    line("\u2014 VERSIONS \u2014");
    try { line("  App (web)      : v" + (typeof UPDATE_CHECK !== "undefined" ? UPDATE_CHECK.VER : "?")); } catch (e) {}
    try { line("  App (native)   : " + (window.MayaBridge && window.MayaBridge.appVersion ? window.MayaBridge.appVersion() : "browser")); } catch (e) {}
    try { line("  WebView        : Chrome " + (window.__webviewMajor || "?")); } catch (e) {}
    line("");
    line("\u2014 KEYS (masked) \u2014");
    function kstat(k, label) {
      var v = settings[k];
      line("  " + label + " : " + (v ? "\u2705 " + String(v).slice(0, 3) + "\u2026" + String(v).slice(-2) : "\u26AA nahi"));
    }
    kstat("groqKey", "Groq        ");
    kstat("apikey", "Gemini      ");
    kstat("fishKey", "Fish Audio  ");
    kstat("ghKey", "GitHub      ");
    kstat("ttsKey", "Gemini TTS  ");
    line("");
    line("\u2014 AWAAZ + DIMAAG \u2014");
    try { line("  Voice engine   : " + (settings.voiceEngine || "auto") + " · artist: " + (settings.voiceArtist || "maya")); } catch (e) {}
    try { if (typeof AWAAZ !== "undefined" && AWAAZ.state) line("  AWAAZ status   : " + AWAAZ.state().join(" · ")); } catch (e) {}
    try { if (typeof BRAINPOOL !== "undefined" && BRAINPOOL.status) line("  Brain pool     : " + BRAINPOOL.status().join(" · ")); } catch (e) {}
    line("");
    line("\u2014 SERVICES \u2014");
    try { line("  Mic permission : " + yes(window.MayaBridge && window.MayaBridge.micPerm && window.MayaBridge.micPerm())); } catch (e) {}
    try { line("  Notifications  : " + yes(window.MayaBridge && window.MayaBridge.notifEnabled && window.MayaBridge.notifEnabled())); } catch (e) {}
    try { line("  Battery free   : " + yes(window.MayaBridge && window.MayaBridge.batteryUnrestricted && window.MayaBridge.batteryUnrestricted())); } catch (e) {}
    try { line("  Accessibility  : " + yes(window.MayaBridge && window.MayaBridge.accessibilityEnabled && window.MayaBridge.accessibilityEnabled())); } catch (e) {}
    try { line("  Wake word      : " + (settings.wakeWord ? "\u2705 ON" : "\u26AA off")); } catch (e) {}
    try { line("  NTFY alerts    : " + (typeof NTFY !== "undefined" && NTFY.ready() ? "\u2705 ON" : "\u26AA off")); } catch (e) {}
    try { line("  Memory cloud   : " + (settings.cloudCode && settings.ghKey ? "\u2705 tayyar" : "\u26AA setup baqi")); } catch (e) {}
    line("");
    line("\u2014 UI \u2014");
    try {
      var r = MayaUI.selfTest();
      line("  Controls       : " + r.visible + " visible · " + r.invisible + " invisible " + (r.ok ? "\u2705" : "\u274C"));
    } catch (e) { line("  Controls       : selfTest fail"); }
    try {
      var errs = (window.__errLog || []).length;
      line("  Console errors : " + errs + " " + (errs === 0 ? "\u2705" : "\u26A0\uFE0F (Settings → badge tap)"));
    } catch (e) {}
    line("");
    line("\u2014 KUL MISRA \u2014");
    try {
      var bad = 0, tot = 0;
      var checks = [
        [typeof UPDATE_CHECK !== "undefined", "version"],
        [window.MayaBridge, "native bridge"],
        [(window.__errLog || []).length === 0, "console saaf"]
      ];
      for (i = 0; i < checks.length; i++) { tot++; if (!checks[i][0]) bad++; }
      line("  " + (bad === 0 ? "\u2705 Sab theek chal raha hai!" : "\u26A0\uFE0F " + bad + "/" + tot + " cheezein check karein"));
    } catch (e) {}
    line("");
    line("\u2014 YE REPORT BHEJEIN \u2014");
    line("  Masle par yehi report copy kar ke bhejein — sab kuch is mein hai.");
    line("  (Keys masked hain — safe hai.)");
    return L.join("\n");
  }
};
