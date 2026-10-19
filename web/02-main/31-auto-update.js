/* ═══════════════════════════════════════════════════════════════════════════
   📡 UPDATE-CHECK — naya APK aaya? (Roadmap Phase 5 · auto-updates ka pehla qadam)
   ---------------------------------------------------------------------------
   GitHub Releases se `releases/latest` uthata hai (public API — koi key nahi,
   koi paisa nahi). Tag (v5.10.1) ko apni version se milata hai:
     • naya ho → 🔄 card + HUD log + (APK mein) notification + seedha download link
     • sab theek → kuch nahi (silent — shor bilkul nahi)
   Auto-check: boot ke 12s baad, roz max 1 dafa. Button: LAB → 🔄 APP UPDATE.

   VERSION YAHAN EK JAGAH: UPDATE_CHECK.VER — baqi sab (build.gradle,
   package.json, sw.js, hudBuild) is se match karne hain (test-invariants).
   ═══════════════════════════════════════════════════════════════════════════ */
var UPDATE_CHECK = {
  VER: "5.10.1",
  REPO: "adil-chandio/Mana-android",
  KEY: "maya_update",
  COOLDOWN_MS: 21600000,   /* auto-check: 6 ghante */
  state: null,

  load: function () {
    if (UPDATE_CHECK.state) return UPDATE_CHECK.state;
    var s = { checkedAt: 0, latest: "", notified: "" };
    try { s = JSON.parse(localStorage.getItem(UPDATE_CHECK.KEY)) || s; } catch (e) {}
    UPDATE_CHECK.state = s;
    return s;
  },
  save: function () {
    try { localStorage.setItem(UPDATE_CHECK.KEY, JSON.stringify(UPDATE_CHECK.state)); } catch (e) {}
  },

  /* "v5.10.1" → [5,10,1] */
  parse: function (tag) {
    var m = String(tag || "").match(/(\d+)\.(\d+)\.(\d+)/);
    return m ? [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)] : null;
  },
  newer: function (latestTag, curVer) {
    var a = UPDATE_CHECK.parse(latestTag), b = UPDATE_CHECK.parse(curVer);
    if (!a || !b) return false;
    for (var i = 0; i < 3; i++) {
      if (a[i] > b[i]) return true;
      if (a[i] < b[i]) return false;
    }
    return false;
  },

  /* JSON body lo — APK mein native bridge (CORS-free), web mein fetch */
  fetchLatest: function () {
    var url = "https://api.github.com/repos/" + UPDATE_CHECK.REPO + "/releases/latest";
    if (typeof NATIVE !== "undefined" && NATIVE && window.MayaBridge && window.MayaBridge.httpGet) {
      return Promise.resolve(window.MayaBridge.httpGet(url, ""));
    }
    return fetch(url).then(function (r) { return r.text(); });
  },

  setHint: function (txt) {
    try {
      var el = document.getElementById("updHint");
      if (el) el.textContent = txt;
    } catch (e) {}
  },

  check: function (silent) {
    var s = UPDATE_CHECK.load();
    if (!silent && s.checkedAt && Date.now() - s.checkedAt < 30000) {
      /* button spam guard: 30 sec */
      return Promise.resolve(null);
    }
    UPDATE_CHECK.setHint("check ho raha hai...");
    return UPDATE_CHECK.fetchLatest().then(function (body) {
      var j = JSON.parse(body || "{}");
      var tag = j.tag_name || "";
      s.checkedAt = Date.now();
      s.latest = tag;
      UPDATE_CHECK.save();
      if (tag && UPDATE_CHECK.newer(tag, UPDATE_CHECK.VER)) {
        var link = j.html_url || ("https://github.com/" + UPDATE_CHECK.REPO + "/releases");
        UPDATE_CHECK.setHint("🔄 NAYA VERSION: " + tag + " (aap ke paas " + UPDATE_CHECK.VER + ") — click: download");
        try { pushLog("UPDATE: naya version " + tag + " available — " + link); } catch (e) {}
        try {
          var bh = document.getElementById("updHint");
          if (bh) bh.onclick = function () { try { openURL(link); } catch (e) { try { window.open(link, "_blank"); } catch (e2) {} } };
        } catch (e) {}
        /* APK mein notification — roz sirf 1 dafa per version */
        if (s.notified !== tag) {
          try {
            if (NATIVE && window.MayaBridge && window.MayaBridge.notify) {
              window.MayaBridge.notify("🔄 MAYA UPDATE", "Version " + tag + " aaya hai — Settings → LAB → 🔄 APP UPDATE");
            }
          } catch (e) {}
          s.notified = tag;
          UPDATE_CHECK.save();
        }
        return { update: true, tag: tag, link: link };
      }
      UPDATE_CHECK.setHint("✅ Aap ke paas sab se naya version hai (" + UPDATE_CHECK.VER + ")");
      if (!silent) { try { pushLog("UPDATE: sab se naya version (" + UPDATE_CHECK.VER + ")"); } catch (e) {} }
      return { update: false, tag: tag };
    }).catch(function (e) {
      UPDATE_CHECK.setHint("⚠️ Check nahi ho saka (internet?) — baad mein dobara");
      if (!silent) { try { pushLog("UPDATE: check nakaam — " + (e && e.message || e)); } catch (e2) {} }
      return null;
    });
  },

  boot: function () {
    try {
      setTimeout(function () {
        var s = UPDATE_CHECK.load();
        if (Date.now() - s.checkedAt < UPDATE_CHECK.COOLDOWN_MS) return;
        UPDATE_CHECK.check(true);
      }, 12000);
    } catch (e) {}
  }
};

/* button wiring (LAB → 🔄 APP UPDATE) */
try {
  var _updBtn = document.getElementById("btnUpdCheck");
  if (_updBtn) _updBtn.onclick = function () { UPDATE_CHECK.check(false); };
} catch (e) {}
try { UPDATE_CHECK.boot(); } catch (e) {}
