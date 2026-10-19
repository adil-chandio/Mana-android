/* ═══════════════════════════════════════════════════════════════════════════
   🔔 NTFY BRIDGE — WAQT 3-B · free alerts phone ke bahar
   ---------------------------------------------------------------------------
   ntfy.sh (0 paisa, koi signup nahi) par Maya ke ahem paighaam bhej do —
   doosre phone/laptop/browser par aa jayenge (ntfy app ya web).
   PRIVACY: topic AAP ka raaz hai — random rakhein (jaise "maya-7f3k9x2q").
   ntfy topics unlisted hain magar jo naam jaane woh parh sakta hai — isliye
   default OFF, aur sensitive matn (OTP/password) kabhi nahi bhejte.
   Settings: settings.ntfyOn + settings.ntfyTopic.
   ═══════════════════════════════════════════════════════════════════════════ */
var NTFY = {
  MAX_CHARS: 900,           /* lamba matn kaat do — alert hai, kitaab nahi */

  ready: function () {
    try {
      return !!(settings && settings.ntfyOn && settings.ntfyTopic &&
                /^[A-Za-z0-9_-]{6,64}$/.test(String(settings.ntfyTopic)));
    } catch (e) { return false; }
  },

  /* Ek alert bhejo. Kabhi app ko nahi rokti — nakaam par sirf log. */
  send: function (title, text) {
    if (!NTFY.ready()) return false;
    try {
      var body = String(text || "");
      if (body.length > NTFY.MAX_CHARS) body = body.slice(0, NTFY.MAX_CHARS) + "…";
      var url = "https://ntfy.sh/" + encodeURIComponent(String(settings.ntfyTopic));
      /* ntfy CORS allow karta hai — plain POST + Title header (preflight OK) */
      var done = false;
      try {
        fetch(url, {
          method: "POST",
          headers: { "Title": String(title || "MAYA").slice(0, 80), "Tags": "robot" },
          body: body
        }).then(function (r) {
          if (!r.ok) { try { pushLog("NTFY: HTTP " + r.status); } catch (e) {} }
        }).catch(function (e) {
          try { pushLog("NTFY: nakaam — " + (e && e.message || e)); } catch (e2) {}
        });
        done = true;
      } catch (e) { done = false; }
      if (!done) return false;
      try { pushLog("NTFY: " + title + " → " + String(settings.ntfyTopic).slice(0, 3) + "…"); } catch (e) {}
      return true;
    } catch (e) { return false; }
  },

  /* ═══ 🧪 LAB report + test ═══ */
  report: function () {
    var L = ["\uD83D\uDD14 NTFY BRIDGE", ""];
    if (!NTFY.ready()) {
      L.push("  \u26A0\uFE0F abhi band hai");
      L.push("");
      L.push("  Kholne ka tarika:");
      L.push("  1. ntfy.sh app install karo (Play Store — free) ya ntfy.sh kholein");
      L.push("  2. Apna topic chuno — MISAL: maya-" + Math.random().toString(36).slice(2, 10));
      L.push("  3. Settings mein wohi topic likhein + switch ON");
      L.push("");
      L.push("  \uD83D\uDD12 Yaad rakhein: topic AAP ka raaz hai — kisi ko mat batana.");
      return L.join("\n");
    }
    L.push("  \u2705 ON — topic: " + String(settings.ntfyTopic).slice(0, 3) + "\u2026 (" + String(settings.ntfyTopic).length + " harf)");
    L.push("  Kahan se aate hain: proactive paighaam · battery alert · AMAL safety stop");
    L.push("");
    L.push("  \uD83E\uDDEA NEECHE TEST button se abhi ek alert bhej kar dekh lein.");
    return L.join("\n");
  },

  test: function (cb) {
    var ok = NTFY.send("MAYA TEST \u2705", "Salaam! Yeh Maya ka test alert hai — NTFY bridge chal raha hai. \uD83E\uDD16");
    if (cb) {
      cb(ok
        ? "\uD83D\uDD14 NTFY TEST \u2014 alert bhej diya!\n\n  Ntfy app/web mein \"MAYA TEST \u2705\" aana chahiye.\n  Na aaye? Topic check karein + internet dekhein."
        : "\u274C NTFY test nahi gaya.\n\n  Pehle Settings mein topic likhein + switch ON karein.");
    }
    return ok;
  }
};

/* ═══ HOOKS — jahan ahem waqiat hote hain, wahan se alert ═══ */
/* Battery alert (21-amal-tools battery-full se call hota hai) */
window.__ntfyBattery = function (pct) {
  try { NTFY.send("MAYA \u2014 BATTERY \u26A1", "Battery alert: " + pct + "% \u2014 charger ka khayal rakhein."); } catch (e) {}
};
/* Proactive message (30-smart-pro se) */
window.__ntfyPro = function (msg) {
  try { NTFY.send("MAYA \u2014 SOCH RAHI THI \uD83D\uDD6F", String(msg || "")); } catch (e) {}
};
/* AMAL safety stop (21-amal-tools kill-switch se) */
window.__ntfySafety = function (why) {
  try { NTFY.send("MAYA \u2014 SAFETY STOP \u1F6D1", "Automation ruk gayi: " + (why || "surkhi").slice(0, 120)); } catch (e) {}
};
