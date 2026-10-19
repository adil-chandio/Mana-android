/* ═══════════════════════════════════════════════════════════════════════════
   🛡️  IJAZAT + 📜 LEDGER + ⟲ UNDO + 📊 TRACE            (P3 · app v5.9.5)
   ---------------------------------------------------------------------------
   AMAL-WORKFLOW.md ka usool: "P3 (LAGAAM) P4/P6 (zyada taqat) se PEHLE."

   Ab tak Maya har tool chup-chaap chala deti thi — brightness bhi, aur kisi ko
   CALL bhi. Brightness ghalat ho to koi baat nahi, magar Maya "Ali" samajh kar
   raat 3 baje "Ammi" ko call laga de to wo WAPAS NAHI ho sakta.

   Is liye har tool ka apna DARJA:
     🟢 SABZ   foran, bina poochhe          (torch, brightness, timer, mausam)
     🟡 ZARD   kar do magar bata kar + ⟲    (alarm, app kholna, diary, memory)
     🔴 SURKH  pehle SAAF IJAZAT             (call, SMS, WhatsApp, file share)

   ⚡ TRUST MODE = aap khud kaho to surkh bhi zard ban jayen. Faisla aap ka.

   Saath: har amal LEDGER mein darj (aaj kya kya kiya), ⟲ UNDO, aur RAILS
   (rate limit + OTP/paisa ka pehra).
   ═══════════════════════════════════════════════════════════════════════════ */
var IJAZAT = {
  T: {
    /* 🟢 SABZ — sirf phone ki setting, 1 second mein wapas */
    torch_control: 1, volume_control: 1, brightness_control: 1, set_timer: 1,
    get_weather: 1, battery_status: 1, prayer_times: 1, run_javascript: 1,
    wiki_search: 1, web_search: 1, search_memory: 1, recall_memory: 1,
    diary_search: 1, list_files: 1, notify: 1,
    read_screen: 1,                       /* 🟢 sirf PARHTA hai, kuch chhuta nahi */
    /* 🟡 ZARD — phone ki halat / aap ka data. Bata kar karo, wapas ho sake */
    set_alarm: 2, set_reminder: 2, open_app: 2, play_youtube: 2, search_web: 2,
    web_fetch: 2, diary_write: 2, save_memory: 2, create_skill: 2,
    open_file: 2, read_messages: 2, schedule_message: 2,
    maya_act: 2,                         /* 🖐 AMAL — confirm-first, guards Kotlin mein */
    see_camera: 2, see_image: 2,          /* 🟡 camera khulta hai, aap dekh kar dabate ho */
    /* 🔴 SURKH — PHONE SE BAHAR nikal jata hai. Wapas NAHI hota. */
    call_contact: 3, call_number: 3, message_contact: 3, send_sms: 3,
    reply_message: 3, share_file: 3
  },
  NAME: { 1: "\uD83D\uDFE2 SABZ", 2: "\uD83D\uDFE1 ZARD", 3: "\uD83D\uDD34 SURKH" },

  tier: function (name) {
    var t = IJAZAT.T[name] || 2;
    /* ⚡ TRUST MODE: surkh -> zard */
    if (t === 3 && IJAZAT.trust()) t = 2;
    return t;
  },
  trust: function () {
    try { return settings && settings.trustMode === true; } catch (e) { return false; }
  },
  need: function (name) {
    if (!FLAGS.on("ijazat")) return false;
    return IJAZAT.tier(name) === 3;
  },

  /* insani zubaan mein: ye kaam kya karega */
  what: function (name, args) {
    var a = args || {};
    if (name === "call_contact") return "\uD83D\uDCDE " + (a.name || "?") + " ko CALL lagani hai";
    if (name === "call_number") return "\uD83D\uDCDE " + (a.number || "?") + " par CALL lagani hai";
    if (name === "message_contact") return "\uD83D\uDCAC " + (a.name || "?") + " ko bhejna hai: \u201C" + String(a.text || "").slice(0, 60) + "\u201D";
    if (name === "reply_message") return "\uD83D\uDCAC " + (a.name || a.to || "?") + " ko jawab: \u201C" + String(a.text || a.message || "").slice(0, 60) + "\u201D";
    if (name === "send_sms") return "\u2709\uFE0F SMS " + (a.number || "?") + " par: \u201C" + String(a.text || "").slice(0, 60) + "\u201D";
    if (name === "share_file") return "\uD83D\uDCC1 File share karni hai: " + (a.name || "?");
    return name + " chalana hai";
  },

  /* ─── inline ijazat card — jawab aane tak intezar ─── */
  pend: null,
  ask: function (name, args) {
    return new Promise(function (resolve) {
      var done = false;
      function finish(yes) {
        if (done) return;
        done = true;
        try { clearTimeout(to); } catch (e) {}
        try { if (row && row.parentNode) row.parentNode.removeChild(row); } catch (e) {}
        IJAZAT.pend = null;
        if (typeof pushLog === "function") pushLog("IJAZAT: " + name + " \u2014 " + (yes ? "HAAN" : "NAHI"));
        resolve(yes);
      }
      var row, to;
      try {
        row = document.createElement("div");
        row.className = "row ai";
        var b = document.createElement("div");
        b.className = "bubble";
        b.innerHTML = "<span class='who'>\uD83D\uDD34 IJAZAT</span>" +
          esc(IJAZAT.what(name, args)) +
          "<div style='margin-top:9px;display:flex;gap:8px'>" +
          "<button type='button' class='ui-btn' data-ij='1' style='margin:0;min-height:40px'>\u2705 HAAN, KARO</button>" +
          "<button type='button' class='ui-btn ui-btn-ghost' data-ij='0' style='margin:0;min-height:40px'>\u274C NAHI</button>" +
          "</div><div class='ui-hint' style='margin-top:6px'>15 second mein jawab na mila to khud-ba-khud NAHI.</div>";
        row.appendChild(b);
        log.appendChild(row);
        log.scrollTop = log.scrollHeight;
        b.addEventListener("click", function (e) {
          var t = e.target;
          if (!t || !t.getAttribute) return;
          var v = t.getAttribute("data-ij");
          if (v === null) return;
          finish(v === "1");
        });
      } catch (e) { finish(false); return; }
      IJAZAT.pend = finish;
      /* jawab na aaye to DEFAULT = NAHI (workflow: timeout par mana) */
      to = setTimeout(function () { finish(false); }, 15000);
    });
  }
};

/* ───────────────────── 🛡️ RAILS — be-lagam taqat nahi ───────────────────── */
var RAILS = {
  hits: {},
  /* OTP / password / paisa kabhi kisi ko na jaye — ye sab se bara khatra hai */
  SECRET: /\b(otp|o\.t\.p|one[\s-]?time|password|pass\s*word|pin\s*code|cvv|card\s*number|account\s*number|iban|verification\s*code|\u0631\u0645\u0632|\u067E\u0627\u0633 ?\u0648\u0631\u0688)\b/i,
  DIGITS: /\b\d{4,8}\b/,
  OUT: { message_contact: 1, send_sms: 1, reply_message: 1, share_file: 1 },

  check: function (name, args) {
    if (!FLAGS.on("ijazat")) return { ok: true };
    var a = args || {};
    /* 1. raaz bahar na jaye */
    if (RAILS.OUT[name]) {
      var txt = String(a.text || a.message || "");
      if (RAILS.SECRET.test(txt) || (RAILS.SECRET.test(txt) && RAILS.DIGITS.test(txt))) {
        return { ok: false, why: "Is message mein OTP/password jaisi cheez lag rahi hai \u2014 main aise paighaam KABHI nahi bhejti. Aap khud bhejein." };
      }
    }
    /* 2. surkh tools par rate limit — loop mein 50 call na lag jayen */
    if (IJAZAT.T[name] === 3) {
      var now = (new Date()).getTime();
      var last = RAILS.hits[name] || 0;
      if (now - last < 45000 && !IJAZAT.trust()) {
        return { ok: false, why: "Abhi " + Math.round((45000 - (now - last)) / 1000) + " second pehle yehi kaam kiya tha \u2014 dobara karne se rok rahi hoon. Phir se bolo to kar dungi." };
      }
      RAILS.hits[name] = now;
    }
    return { ok: true };
  }
};

/* ───────────────── 📜 LEDGER — har amal ka roznamcha + ⟲ undo ───────────── */
var LEDGER = {
  KEY: "maya_ledger",
  MAX: 1000,   /* P6: aadat mining ke liye kai din ka data — 60 se barhaya */
  list: null,
  /* jo halat hum ne KHUD set ki — undo isi se hota hai */
  known: {},

  load: function () {
    if (LEDGER.list) return LEDGER.list;
    var d = [];
    try { d = JSON.parse(localStorage.getItem(LEDGER.KEY) || "[]"); } catch (e) { d = []; }
    LEDGER.list = d;
    return d;
  },
  save: function () {
    try { localStorage.setItem(LEDGER.KEY, JSON.stringify(LEDGER.list.slice(-LEDGER.MAX))); } catch (e) {}
  },

  /* amal se PEHLE ki halat — sirf wahi jo hum jaante hain (jhoot nahi bolte) */
  snap: function (name, args) {
    if (name === "brightness_control") return LEDGER.known.brightness;
    if (name === "volume_control") return LEDGER.known.volume;
    if (name === "torch_control") return LEDGER.known.torch;
    return undefined;
  },
  remember: function (name, args, out) {
    var a = args || {}, o = out || {};
    if (name === "brightness_control") LEDGER.known.brightness = (o.level !== undefined) ? o.level : a.percent;
    if (name === "volume_control") LEDGER.known.volume = (o.level !== undefined) ? o.level : a.percent;
    if (name === "torch_control") LEDGER.known.torch = (a.on === true || a.on === "on");
  },

  push: function (name, args, out, before) {
    if (!FLAGS.on("ijazat")) return;
    LEDGER.load();
    LEDGER.list.push({
      t: (new Date()).getTime(),
      n: name,
      a: LEDGER.tiny(args),
      ok: !!(out && out.ok !== false),
      st: (out && out.state) || "",
      tier: IJAZAT.T[name] || 2,
      b: before
    });
    if (LEDGER.list.length > LEDGER.MAX) LEDGER.list = LEDGER.list.slice(-LEDGER.MAX);
    LEDGER.remember(name, args, out);
    LEDGER.save();
  },
  tiny: function (a) {
    var o = {}, k, v;
    for (k in (a || {})) {
      if (!Object.prototype.hasOwnProperty.call(a, k)) continue;
      v = a[k];
      o[k] = (typeof v === "string") ? v.slice(0, 40) : v;
    }
    return o;
  },

  /* "aaj kya kya kiya?" */
  today: function () {
    LEDGER.load();
    var d0 = new Date(); d0.setHours(0, 0, 0, 0);
    var t0 = d0.getTime(), out = [], i, e, hh;
    for (i = 0; i < LEDGER.list.length; i++) if (LEDGER.list[i].t >= t0) out.push(LEDGER.list[i]);
    if (!out.length) return "Aaj abhi tak maine koi kaam nahi kiya.";
    var L = ["\uD83D\uDCDC AAJ ke kaam \u2014 " + out.length + " amal", ""];
    for (i = out.length - 1; i >= 0 && i >= out.length - 15; i--) {
      e = out[i];
      hh = new Date(e.t);
      L.push("  " + (hh.getHours() < 10 ? "0" : "") + hh.getHours() + ":" +
             (hh.getMinutes() < 10 ? "0" : "") + hh.getMinutes() + "  " +
             (e.ok ? "\u2705" : "\u274C") + " " + IJAZAT.NAME[e.tier] + " " + e.n +
             (e.st ? ("  (" + e.st + ")") : ""));
    }
    return L.join("\n");
  },

  /* ⟲ jo wapas ho sakta hai */
  UNDOABLE: { brightness_control: 1, volume_control: 1, torch_control: 1 },
  lastUndoable: function () {
    LEDGER.load();
    var i;
    for (i = LEDGER.list.length - 1; i >= 0; i--) {
      if (LEDGER.UNDOABLE[LEDGER.list[i].n] && LEDGER.list[i].ok) return LEDGER.list[i];
    }
    return null;
  },
  undo: async function () {
    var e = LEDGER.lastUndoable();
    if (!e) return { ok: false, say: "Abhi koi aisa kaam nahi hua jo main wapas kar sakun." };
    if (e.b === undefined || e.b === null) {
      return { ok: false, say: "Ye kaam wapas nahi kar sakti \u2014 mujhe nahi pata is se pehle kya halat thi. Aap khud value bata do to set kar dungi." };
    }
    var args = {};
    if (e.n === "torch_control") args.on = !!e.b;
    else args.percent = e.b;
    try {
      var r = await execTool(e.n, args);
      var okr = !!(r && r.ok !== false);
      return { ok: okr, say: okr ? ("\u27F2 Wapas kar diya \u2014 " + e.n + " ab " + (e.n === "torch_control" ? (e.b ? "on" : "off") : e.b) + ".")
                                 : "Wapas karne ki koshish nakaam rahi." };
    } catch (err) { return { ok: false, say: "Wapas karne mein masla aaya." }; }
  },
  ASK_UNDO: /(wapas karo|wapas kar do|undo|palat do|pehle jaisa|cancel karo|\u0648\u0627\u067E\u0633 \u06A9\u0631|\u0935\u093E\u092A\u0938 \u0915\u0930)/i,
  ASK_TODAY: /(aaj kya kya kiya|aaj kya kiya|kya kya kiya|kaam ka hisab|ledger|roznamcha dikhao|\u0622\u062C \u06A9\u06CC\u0627 \u06A9\u06CC\u0627)/i
};

/* ───────────────── 📊 TRACE — nazar aane wala saboot ───────────────── */
var TRACE = {
  cur: null,
  start: function () { TRACE.cur = { tools: [], brain: "", ms: 0, t0: (new Date()).getTime() }; },
  brain: function (name, ms) {
    if (!TRACE.cur) TRACE.start();
    if (name && name !== "-" && name !== "\u2014") { TRACE.cur.brain = String(name); TRACE.cur.ms = ms || 0; }
  },
  tool: function (name, out) {
    if (!TRACE.cur) TRACE.start();
    TRACE.cur.tools.push({ n: name, ok: !!(out && out.ok !== false), s: (out && out.state) || "" });
  },
  line: function () {
    if (!FLAGS.on("ijazat")) return "";
    var parts = [], i, t;
    /* dimaag ka naam RENDER par nahi parhte — jab jawab aaya tha tab DARJ kiya tha.
       (Pehle har chip par sirf "🧠 —" dikhta tha.) */
    if (TRACE.cur && TRACE.cur.brain) {
      parts.push("\uD83E\uDDE0 " + TRACE.cur.brain + (TRACE.cur.ms ? (" " + TRACE.cur.ms + "ms") : ""));
    }
    if (TRACE.cur && TRACE.cur.tools.length) {
      for (i = 0; i < TRACE.cur.tools.length && i < 4; i++) {
        t = TRACE.cur.tools[i];
        parts.push((t.ok ? "\uD83D\uDD27" : "\u26A0\uFE0F") + " " + t.n + (t.s ? (" \u00B7 " + t.s) : ""));
      }
    }
    try { if (AWAAZ.engine && AWAAZ.engine !== "-" && AWAAZ.engine !== "off") parts.push("\uD83D\uDDE3\uFE0F " + AWAAZ.engine); } catch (e) {}
    /* kuch bhi asli na ho to chip dikhao hi mat (pehle khali "🧠 —" dikhta tha) */
    if (!parts.length) return "";
    if (parts.length === 1 && parts[0].indexOf("\uD83D\uDDE3") === 0) return "";
    return parts.join("   ");
  },
  clear: function () { TRACE.cur = null; }
};

