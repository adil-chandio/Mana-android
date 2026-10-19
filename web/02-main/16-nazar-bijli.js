/* ═══════════════════════════════════════════════════════════════════════════
   👁️  NAZAR  —  Maya screen PARH sakti hai                     (P7a · v5.9.5)
   ---------------------------------------------------------------------------
   Ye P7 ka PEHLA qadam hai: Maya screen ko DEKHTI hai, magar CHHUTI NAHI.

   Kyun pehle sirf dekhna?
     Agar wo screen theek nahi parh pati, to tap karna KHATARNAK hai. Pehle
     aap apni aankhon se tasdeeq kar lo ke wo Chrome/Instagram sahih parh rahi
     hai — PHIR usay haath lagane ki ijazat dena.  (AMAL-WORKFLOW · Qanoon 3)

   Kotlin (AutoSendService.dumpScreen) motay tor par chhaan kar deta hai:
   sirf nazar aane wale, dabne/likhne/scroll hone wale, ya matn wale node.
   Yahan JS mein DOOSRI chhanti hoti hai — kyunke prompt ka budget hi sab
   kuch hai (CHHED 9: 33 tools ka JSON hi 1989 token kha jata tha).
   ═══════════════════════════════════════════════════════════════════════════ */
var NAZAR = {
  MAXITEMS: 40,          /* dimaag ko itne se zyada element bhejna bekaar hai */
  MAXLABEL: 52,
  last: null,

  can: function () {
    try { return !!(typeof NATIVE !== "undefined" && NATIVE && window.MayaBridge && window.MayaBridge.uiDump); }
    catch (e) { return false; }
  },

  /* Kotlin se raw dump */
  raw: function (max) {
    if (!NAZAR.can()) return { ok: false, why: "screen parhna sirf APK mein chalta hai" };
    var s = "";
    try { s = window.MayaBridge.uiDump(max || 90); } catch (e) { return { ok: false, why: String(e && e.message || e) }; }
    try { return JSON.parse(s || "{}"); } catch (e) { return { ok: false, why: "jawab kharab aaya" }; }
  },

  /* aam apps jinhe hum naam se pehchante hain */
  APPNAME: {
    "com.android.chrome": "Chrome", "com.whatsapp": "WhatsApp",
    "com.instagram.android": "Instagram", "com.google.android.youtube": "YouTube",
    "com.android.vending": "Play Store", "org.telegram.messenger": "Telegram",
    "com.facebook.katana": "Facebook", "com.google.android.gm": "Gmail",
    "com.maya.ai": "MAYA", "com.android.settings": "Settings",
    "com.google.android.apps.nexuslauncher": "Home screen",
    "com.transsion.hilauncher": "Home screen"
  },
  appOf: function (pkg) {
    var p = String(pkg || "");
    if (NAZAR.APPNAME[p]) return NAZAR.APPNAME[p];
    var bits = p.split(".");
    return bits.length ? (bits[bits.length - 1] || p) : p;
  },

  /* ─── DOOSRI CHHANTI: dohre hataao, jama karo, kaato ─── */
  compact: function (items) {
    var out = [], seen = {}, i, it, key, dup = {};
    items = items || [];
    /* pehle ek jaise labels gino (Instagram ke 12 "reel" waghera) */
    for (i = 0; i < items.length; i++) {
      key = (items[i].t || "") + "|" + (items[i].x || "");
      dup[key] = (dup[key] || 0) + 1;
    }
    for (i = 0; i < items.length && out.length < NAZAR.MAXITEMS; i++) {
      it = items[i];
      var lbl = String(it.x || "").replace(/\s+/g, " ").trim();
      if (lbl.length > NAZAR.MAXLABEL) lbl = lbl.slice(0, NAZAR.MAXLABEL) + "\u2026";
      key = (it.t || "") + "|" + lbl;
      /* bina naam ka aam matn kisi kaam ka nahi */
      if (!lbl && it.t === "text") continue;
      if (seen[key]) continue;
      seen[key] = 1;
      out.push({
        i: out.length,
        t: it.t || "text",
        x: lbl || (it.id ? ("#" + it.id) : "(bay-naam)"),
        id: it.id || "",
        n: dup[key] > 1 ? dup[key] : 0,
        cx: it.cx, cy: it.cy,
        e: it.e ? 1 : 0, s: it.s ? 1 : 0
      });
    }
    return out;
  },

  /* ─── screen ko ek dafa parho ─── */
  look: function (max) {
    var r = NAZAR.raw(max);
    if (!r.ok) { NAZAR.last = null; return { ok: false, why: r.why || "screen nahi mili" }; }
    var items = NAZAR.compact(r.items || []);
    var res = {
      ok: true,
      app: NAZAR.appOf(r.pkg),
      pkg: r.pkg || "",
      items: items,
      total: r.n || (r.items || []).length,
      at: (new Date()).getTime()
    };
    NAZAR.last = res;
    return res;
  },

  ICON: { input: "\u270F\uFE0F", btn: "\uD83D\uDD18", toggle: "\u2611\uFE0F", scroll: "\u2195\uFE0F", text: "\u00B7" },

  /* ─── dimaag ke liye: chhota, saaf matn ─── */
  forBrain: function (r) {
    r = r || NAZAR.last;
    if (!r || !r.ok) return "";
    var L = ["SCREEN: " + r.app], i, it;
    for (i = 0; i < r.items.length; i++) {
      it = r.items[i];
      L.push("[" + it.i + "] " + it.t + (it.n ? (" \u00D7" + it.n) : "") + "  " + it.x);
    }
    if (r.total > r.items.length) L.push("(" + (r.total - r.items.length) + " aur cheezein bhi hain)");
    return L.join("\n");
  },

  /* ─── aap ke liye: parhne mein khoobsurat ─── */
  forEye: function (r) {
    r = r || NAZAR.last;
    if (!r) return "\uD83D\uDC41\uFE0F Abhi screen nahi parhi.";
    if (!r.ok) return "\uD83D\uDC41\uFE0F Screen nahi parh saki\n\n\u26A0\uFE0F " + (r.why || "wajah maloom nahi");
    var L = ["\uD83D\uDC41\uFE0F SCREEN PAR ABHI \u2014 " + r.app, ""], i, it;
    if (!r.items.length) { L.push("  (kuch nazar nahi aa raha)"); return L.join("\n"); }
    for (i = 0; i < r.items.length; i++) {
      it = r.items[i];
      L.push("  " + (NAZAR.ICON[it.t] || "\u00B7") + " [" + it.i + "] " + it.x +
             (it.n ? ("   \u00D7" + it.n) : "") + (it.id ? ("   #" + it.id) : ""));
    }
    L.push("");
    L.push("  " + r.items.length + " cheezein dikhayi" + (r.total > r.items.length ? ("  (kul " + r.total + ")") : ""));
    L.push("");
    L.push("  \u270F\uFE0F likhne ka khana   \uD83D\uDD18 button   \u2611\uFE0F toggle   \u2195\uFE0F scroll   \u00B7 matn");
    L.push("  \uD83D\uDD12 Maya ne kuch CHHUA nahi \u2014 sirf DEKHA hai.");
    return L.join("\n");
  },

  /* ─── prompt ka budget: ~4 harf = 1 token ─── */
  tokens: function (r) {
    var t = NAZAR.forBrain(r);
    return Math.ceil(t.length / 4);
  }
};

/* ═══════════════════════════════════════════════════════════════════════════
   ⚡  BIJLI  +  👁️  AANKHEIN                              (P4 · app v5.9.5)
   ═══════════════════════════════════════════════════════════════════════════

   ⚡ BIJLI — phone control 50ms mein, DIMAAG se PEHLE
   ---------------------------------------------------
   Aaj:  aap bolte ho -> dimaag sochta hai (2.6s p50, 13.2s p90) -> tool chalta hai
   Kal:  🟢 SABZ tools ke liye dimaag ka INTEZAR HI NAHI

       "torch on karo"
          40ms   🔦 TORCH ON        <- ho gaya, LLM ne abhi kuch nahi kiya
         900ms   "Ho gaya boss."    <- dimaag sirf JUMLA banata hai

   Aur sab se bari baat: ye INTERNET KE BAGAIR bhi chalta hai. Airplane mode
   mein bhi torch, brightness, volume, timer, battery — sab kaam karenge.

   Hifazat:
     * sirf 🟢 SABZ tools (IJAZAT ke darje se) — surkh/zard kabhi nahi
     * yaqeen (confidence) kam ho to kuch na karo, purana raasta chale
     * ek hukm = ek amal (dimaag ne bhi wohi tool chalaya to dobara na ho)
     * LEDGER + ⟲ UNDO pehle se maujood hain (P3), yani wapas bhi ho sakta hai

   👁️ AANKHEIN — Maya DEKH sakti hai
   ----------------------------------
   Ye taqat pehle se maujood thi magar sirf ek TANG regex par chalti thi
   (`ye dekho` / `photo khincho`), aur TOOL nahi thi — is liye dimaag khud
   kabhi camera nahi khol sakta tha. Ab:
     * `see_camera` aur `see_image` asli TOOLS hain (33 -> 35)
     * dimaag khud faisla kar sakta hai ke "is bill ka total" ke liye dekhna parega
     * sawal yaad rehta hai, aur jawab usi sawal ka aata hai
   ═══════════════════════════════════════════════════════════════════════════ */
var BIJLI = {
  /* Sirf ye tools — sab 🟢 SABZ, sab wapas ho sakte hain, sab offline chalte hain */
  OK: { torch_control: 1, brightness_control: 1, volume_control: 1,
        set_timer: 1, battery_status: 1 },

  /* Har tool ka apna naqsha: kya pehchanna hai aur args kaise nikalne hain.
     `re` = hukm ka nishan · `args` = matn se args nikalne wala */
  RULES: [
    { t: "torch_control", re: /\b(torch|flash ?light|flash|batti|light)\b/i,
      args: function (q) {
        if (/\b(off|band|bujha|bandh|nahi)\b/i.test(q)) return { on: false };
        if (/\b(on|jala|chalu|karo|kar do|open)\b/i.test(q)) return { on: true };
        return null;
      } },
    { t: "brightness_control", re: /\b(brightness|britness|brightnes|brighness|chamak|roshni|raushni)\b/i,
      args: function (q) { return BIJLI.pct(q); } },
    { t: "volume_control", re: /\b(volume|awaaz|awaz|aawaz|sound|vol)\b/i,
      args: function (q) { return BIJLI.pct(q); } },
    { t: "set_timer", re: /\b(timer)\b/i,
      args: function (q) {
        var m = /(\d{1,3})\s*(minute|min|mint|m\b)/i.exec(q);
        if (m) return { seconds: parseInt(m[1], 10) * 60 };
        m = /(\d{1,4})\s*(second|sec|s\b)/i.exec(q);
        if (m) return { seconds: parseInt(m[1], 10) };
        return null;
      } },
    { t: "battery_status", re: /\b(battery|batri|batery|charge|charging)\b/i,
      args: function (q) { return /\b(kitni|kitna|status|kya|check|dikhao|bata)\b/i.test(q) ? {} : null; } }
  ],

  /* "100%" · "50 kar do" · "full" · "poori" · "aadhi" · "kam/zyada" */
  pct: function (q) {
    var m = /(\d{1,3})\s*(%|percent|fisad)?/.exec(q);
    if (m && m[1] !== undefined) {
      var n = parseInt(m[1], 10);
      if (n >= 0 && n <= 100) return { percent: n };
    }
    if (/\b(full|poori|pura|poora|max|maximum|sab se zyada)\b/i.test(q)) return { percent: 100 };
    if (/\b(aadhi|aadha|half|beech)\b/i.test(q)) return { percent: 50 };
    if (/\b(kam|neeche|dheemi|low|min|minimum)\b/i.test(q)) return { percent: 20 };
    if (/\b(zyada|barhao|barha|upar|tez|high)\b/i.test(q)) return { percent: 90 };
    return null;
  },

  /* Hukm se tool + args nikalo. Yaqeen na ho to null — purana raasta chalega. */
  match: function (text) {
    if (!FLAGS.on("bijli")) return null;
    var q = String(text || "");
    if (q.length > 90) return null;                 /* lamba jumla = baat-cheet, hukm nahi */
    if (/\?$/.test(q.trim()) && !/battery|kitni/i.test(q)) return null;
    var i, r, a;
    for (i = 0; i < BIJLI.RULES.length; i++) {
      r = BIJLI.RULES[i];
      if (!r.re.test(q)) continue;
      a = r.args(q);
      if (a === null) return null;                  /* tool to mila, magar args nahi — dimaag hi kare */
      /* dohri hifazat: darja SABZ hi hona chahiye */
      if (typeof IJAZAT !== "undefined" && IJAZAT.T[r.t] !== 1) return null;
      if (!BIJLI.OK[r.t]) return null;
      return { tool: r.t, args: a };
    }
    return null;
  },

  /* jo abhi BIJLI se chala — dimaag dobara na chalaye */
  last: null,
  mark: function (tool) { BIJLI.last = { t: tool, at: (new Date()).getTime() }; },
  dupe: function (tool) {
    if (!BIJLI.last) return false;
    if (BIJLI.last.t !== tool) return false;
    return ((new Date()).getTime() - BIJLI.last.at) < 8000;
  },

  /* jab internet hi na ho — Maya phir bhi kaam kare aur khud jumla bana le */
  SAY: {
    torch_control: function (a, o) { return a.on ? "Torch on kar di." : "Torch band kar di."; },
    brightness_control: function (a, o) { return "Chamak " + ((o && o.level !== undefined) ? o.level : a.percent) + " kar di."; },
    volume_control: function (a, o) { return "Awaaz " + ((o && o.level !== undefined) ? o.level : a.percent) + " kar di."; },
    set_timer: function (a, o) { return (a.seconds >= 60 ? (Math.round(a.seconds / 60) + " minute") : (a.seconds + " second")) + " ka timer laga diya."; },
    battery_status: function (a, o) { return o && o.percent !== undefined ? ("Battery " + o.percent + " percent hai" + (o.charging ? ", charge ho rahi hai." : ".")) : "Battery ka pata nahi chala."; }
  },
  say: function (tool, args, out) {
    var f = BIJLI.SAY[tool];
    var base = f ? f(args, out) : "Ho gaya.";
    var nm = "";
    try { nm = (settings && settings.name) ? (" " + settings.name) : ""; } catch (e) {}
    return base.replace(/\.$/, "") + "," + nm + " \u26A1";
  }
};

/* ─────────────────────────── 👁️ AANKHEIN ─────────────────────────── */
var AANKH = {
  waiting: null,          /* { q: "sawal", at: waqt } */
  ask: function (q, from) {
    if (!NATIVE) return { ok: false, note: "camera sirf APK mein" };
    AANKH.waiting = { q: String(q || ""), at: (new Date()).getTime() };
    var ok = false;
    try {
      if (from === "gallery") { window.MayaBridge.pickImage(); ok = true; }
      else ok = window.MayaBridge.takePhoto() === true;
    } catch (e) { ok = false; }
    if (!ok) { AANKH.waiting = null; return { ok: false, note: "camera nahi khul saka" }; }
    return { ok: true, state: "started",
             note: from === "gallery" ? "gallery khul gayi — photo chuno" : "camera khul gaya — photo khincho" };
  },
  /* sawal yaad rehta hai taake jawab usi ka aaye */
  prompt: function () {
    var q = (AANKH.waiting && AANKH.waiting.q) || "";
    AANKH.waiting = null;
    if (!q) return "Ye dekho aur mukhtasir batao ye kya hai \u2014 Roman Urdu mein, 2 jumle.";
    return q + "\n\n(Tasveer dekh kar jawab do. Roman Urdu mein, mukhtasir \u2014 2-3 jumle. " +
           "Agar tasveer mein likha hua hai to wo parh kar batao. Agar hisab maanga gaya hai to hisab karo.)";
  }
};

