/* ═══════════════════════════════════════════════════════════════════════════
   🕯️ SMART-PRO — KHUD-MUKHTAR v2 (P6): wajah se baat, shor se nahi
   ---------------------------------------------------------------------------
   P6 doc ka faisla: purana proactive "har 6 min RANDOM jumla" = bay-maqsaad
   shor. Ab sirf WAJAH hoti hai to hi bolti hai:

     1. ⏰ WAQT   — scheduled task agle ghante mein due (schedTasks.at)
     2. 📊 AADAT  — LEDGER se: koi kaam 3 din ek hi ghante mein karta ho
     3. 🌅 SUBAH  — roz 1 dafa morning brief (mausam + battery) 8-11 baje
     4. 💬 YAAD   — facts se gentle follow-up (roz max 1)

   SAKHT HADEIN (CLAUDE.md "Idle = zero actions"):
     • roz MAX 3 proactive (state maya_pro mein hisaab)
     • raat 11 se subah 8: CHUP (quiet hours)
     • kam az kam 10 min ki khamoshi (lastInteract) + na bol rahi + na soch rahi
     • koi wajah na mile → BILKUL CHUP (random line kabhi nahi)

   Start: startProactive() — 03-obsidian.js isi ko bulata hai (purana naam zinda).
   ═══════════════════════════════════════════════════════════════════════════ */
var SMART_PRO = {
  KEY: "maya_pro",
  MAX_PER_DAY: 3,
  QUIET_START: 23,      /* raat 11 baje se... */
  QUIET_END: 8,         /* ...subah 8 baje tak chup */
  IDLE_MIN_MS: 600000,  /* 10 min khamoshi */
  timer: null,
  state: null,

  load: function () {
    if (SMART_PRO.state) return SMART_PRO.state;
    var s = { day: "", count: 0, lastMs: 0, morningDone: "", factDone: "" };
    try { s = JSON.parse(localStorage.getItem(SMART_PRO.KEY)) || s; } catch (e) {}
    SMART_PRO.state = s;
    return s;
  },
  save: function () {
    try { localStorage.setItem(SMART_PRO.KEY, JSON.stringify(SMART_PRO.state)); } catch (e) {}
  },
  today: function () {
    var d = new Date();
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  },
  /* roz ka hisaab — naya din = counter wapas */
  budget: function () {
    var s = SMART_PRO.load();
    if (s.day !== SMART_PRO.today()) { s.day = SMART_PRO.today(); s.count = 0; SMART_PRO.save(); }
    return SMART_PRO.MAX_PER_DAY - s.count;
  },
  quiet: function () {
    var h = (new Date()).getHours();
    return h >= SMART_PRO.QUIET_START || h < SMART_PRO.QUIET_END;
  },

  /* ── WAJAH #1: scheduled task qareeb ── */
  reasonSchedule: function () {
    try {
      if (typeof schedTasks === "undefined") return null;
      var now = Date.now(), best = null, k;
      for (k in schedTasks) {
        if (!Object.prototype.hasOwnProperty.call(schedTasks, k)) continue;
        var t = schedTasks[k];
        if (!t || !t.at) continue;
        var mins = Math.round((t.at - now) / 60000);
        if (mins > 0 && mins <= 60 && (!best || t.at < best.at)) best = t;
      }
      if (!best) return null;
      var mm = Math.round((best.at - now) / 60000);
      if (best.kind === "message")
        return { id: "sched", msg: settings.name + ", " + mm + " minute baad " + (best.name || "kisi") + " ko message bhejna hai — yaad dilana tha." };
      return { id: "sched", msg: settings.name + ", " + mm + " minute baad ek scheduled kaam due hai." };
    } catch (e) { return null; }
  },

  /* ── WAJAH #2: aadat — LEDGER se (roz 3+ din, ek hi ghante ke halqe mein) ── */
  reasonHabit: function () {
    try {
      if (typeof LEDGER === "undefined") return null;
      LEDGER.load();
      var byHour = {}, i, e, key, h;
      for (i = 0; i < LEDGER.list.length; i++) {
        e = LEDGER.list[i];
        if (!e || !e.t || !e.n) continue;
        var day = new Date(e.t).getDate();
        h = new Date(e.t).getHours();
        key = e.n + "@" + h;
        if (!byHour[key]) byHour[key] = { tool: e.n, hour: h, days: {} };
        byHour[key].days[day] = true;
      }
      var nowH = (new Date()).getHours(), k, best = null;
      for (k in byHour) {
        if (!Object.prototype.hasOwnProperty.call(byHour, k)) continue;
        var b = byHour[k], nd = 0, d;
        for (d in b.days) { if (Object.prototype.hasOwnProperty.call(b.days, d)) nd++; }
        /* abhi ke ghante ke ±1 mein, aur 3 alag dinon ka record */
        if (nd >= 3 && Math.abs(b.hour - nowH) <= 1 && (!best || nd > best.nd)) best = { tool: b.tool, nd: nd };
      }
      if (!best) return null;
      var pretty = String(best.tool).replace(/_/g, " ");
      return { id: "habit", msg: "Waise " + settings.name + ", aap aksar is waqt " + pretty + " karte ho — abhi karna hai?" };
    } catch (e) { return null; }
  },

  /* ── WAJAH #3: subah ka brief — roz 1 dafa, 8-11 baje ── */
  reasonMorning: function () {
    try {
      var h = (new Date()).getHours();
      if (h < 8 || h > 11) return null;
      var s = SMART_PRO.load();
      if (s.morningDone === SMART_PRO.today()) return null;
      var bat = "";
      try { if (NATIVE && window.MayaBridge && window.MayaBridge.battery) { var b = JSON.parse(window.MayaBridge.battery()); if (b && b.level !== undefined) bat = " · battery " + b.level + "%"; } } catch (e) {}
      var w = "";
      try { if (typeof lastWeather !== "undefined" && lastWeather) w = " · mausam " + lastWeather; } catch (e) {}
      s.morningDone = SMART_PRO.today(); SMART_PRO.save();
      return { id: "morning", msg: "Subah bakhair " + settings.name + "! Aaj ka din mubarak ho" + w + bat + "." };
    } catch (e) { return null; }
  },

  /* ── WAJAH #4: facts se follow-up — roz max 1 ── */
  reasonFact: function () {
    try {
      if (!facts || !facts.length) return null;
      var s = SMART_PRO.load();
      if (s.factDone === SMART_PRO.today()) return null;
      s.factDone = SMART_PRO.today(); SMART_PRO.save();
      return { id: "fact", msg: "Waise yaad hai aap ne bataya tha — " + facts[Math.floor(Math.random() * facts.length)] + " — uska kya bana?" };
    } catch (e) { return null; }
  },

  /* ── TICK: gates → wajah dhoondo → bol ── */
  tick: function () {
    try {
      if (!settings.proactive) return;
      if (SMART_PRO.quiet()) return;
      if (SMART_PRO.budget() <= 0) return;
      if (typeof speaking !== "undefined" && speaking) return;
      if (typeof thinking !== "undefined" && thinking) return;
      var st = "idle"; try { st = document.getElementById("orb").dataset.state || "idle"; } catch (e) {}
      if (st === "listening") return;
      if (typeof MAYA_V4 !== "undefined" && Date.now() - MAYA_V4.lastInteract < SMART_PRO.IDLE_MIN_MS) return;
      if (SMART_PRO.load().lastMs && Date.now() - SMART_PRO.load().lastMs < SMART_PRO.IDLE_MIN_MS) return;

      var r = SMART_PRO.reasonSchedule() || SMART_PRO.reasonHabit() || SMART_PRO.reasonMorning() || SMART_PRO.reasonFact();
      if (!r) return;   /* koi wajah nahi → CHUP (random kabhi nahi) */

      var s = SMART_PRO.load();
      s.count++; s.lastMs = Date.now(); SMART_PRO.save();
      try { if (typeof MAYA_V4 !== "undefined") MAYA_V4.lastInteract = Date.now(); } catch (e) {}
      try { pushLog("PROACTIVE [" + r.id + "]: " + r.msg); } catch (e) {}
      try { reply(r.msg, true); } catch (e) {}
      try { if (window.__ntfyPro) window.__ntfyPro(r.msg); } catch (e) {}
    } catch (e) {}
  },

  start: function () {
    if (SMART_PRO.timer) { clearInterval(SMART_PRO.timer); SMART_PRO.timer = null; }
    if (!settings.proactive) return;
    SMART_PRO.timer = setInterval(SMART_PRO.tick, 300000);  /* har 5 min check */
  }
};
