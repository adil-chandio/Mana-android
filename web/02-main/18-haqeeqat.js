/* ═══════════════════════════════════════════════════════════════════════════
   🤝  HAQEEQAT  —  "SACH BOLO" ka nizam                        (app v5.9.5)
   ---------------------------------------------------------------------------
   ASAL MASLA (aap ki apni chat se — 5 dafa):

     AAP : "Hi send karo jaake"
     MAYA: "Done, Sir! ... 'Hi' type ho chuka hai."
     AAP : "Hi type NAHI karna, SEND karna hai"
     MAYA: "abhi turant send kar diya"        <- JHOOT
     AAP : "Nhi hua"   ... (paanch dafa)

   JARH — code mein saaf likhi hui thi:

     out = { done: true, how: "chat khul gaya message type ho chuka" }
                  ^^^^        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                  jhoot        aur khud IQRAR ke sirf TYPE hua

   Aur Kotlin ka openWhatsAppDraft() `true` lautata hai jab INTENT chal jaye —
   na ke jab message BHEJ diya jaye. Tool ne dimaag se jhoot bola, dimaag ne
   aap se. Aur prompt mein sach bolne ka koi qanoon tha hi nahi (grep = 0).

   ILAJ — teen tehen:
     1. HAQEEQAT.wrap()  har tool ke jawab mein `sure` jorta hai
                         (kya hum YAQEEN se keh sakte hain ke KAAM HO GAYA?)
     2. Prompt ka qanoon  sure:false -> kamyabi ka daawa MANA
     3. POST-CHECK        jawab bahar jane se PEHLE app KHUD jaanchti hai.
                          Model par bharosa nahi — jaanch.
   ═══════════════════════════════════════════════════════════════════════════ */
var HAQEEQAT = {
  /* Har tool ka sach. `sure` = "kaam HO GAYA" ka yaqeen.
       done    -> ho gaya, yaqeen hai            (torch jal gayi, brightness set)
       typed   -> likha gaya, BHEJA NAHI         (WhatsApp / SMS ka draft)
       started -> chala diya, natija maloom nahi (app khola, video chalayi)
       queued  -> baad mein hoga                 (alarm, reminder, schedule)
       info    -> sirf maloomat                  (mausam, battery, search) */
  STATE: {
    /* yaqeen wale — inka nateeja hum khud dekh lete hain */
    torch_control: "done", volume_control: "done", brightness_control: "done",
    save_memory: "done", diary_write: "done", create_skill: "done", notify: "done",
    /* likha gaya, BHEJA NAHI — yehi sab se bara jhoot tha */
    message_contact: "typed", reply_message: "typed", send_sms: "typed",
    share_file: "typed",
    /* chala diya, natija maloom nahi */
    open_app: "started", play_youtube: "started", search_web: "started",
    see_camera: "started", see_image: "started",
    open_file: "started", call_contact: "started", call_number: "started",
    /* baad mein */
    set_alarm: "queued", set_timer: "queued", set_reminder: "queued",
    schedule_message: "queued",
    /* sirf maloomat */
    get_weather: "info", battery_status: "info", prayer_times: "info",
    web_search: "info", wiki_search: "info", web_fetch: "info",
    run_javascript: "info", list_files: "info", diary_search: "info",
    search_memory: "info", recall_memory: "info", read_messages: "info",
    read_screen: "info"
  },
  SURE: { done: true, info: true, queued: true, typed: false, started: false },

  /* insani zubaan mein — model isi ko dohrata hai */
  SAY: {
    typed:   "LIKHA GAYA hai magar BHEJA NAHI. User ko batao ke chat khul gayi aur matn type ho gaya, ab SEND ka button dabana hoga.",
    started: "CHALA DIYA hai magar tasdeeq nahi ke sach much khula/chala. 'Ho gaya' mat kaho — 'khol raha hoon / chala raha hoon' kaho.",
    done:    "SACH MEIN HO GAYA — yaqeen se bata sakte ho.",
    queued:  "SET HO GAYA hai, waqt par khud chalega.",
    info:    "Sirf maloomat hai."
  },

  wrap: function (name, out) {
    var o = (out && typeof out === "object") ? out : { done: !!out };
    var st = HAQEEQAT.STATE[name] || "started";
    var failed = (o.error !== undefined) || (o.done === false) || (o.ok === false);
    if (failed) {
      o.ok = false; o.state = "failed"; o.sure = true;
      o.sach = "NAKAAM. " + (o.note || o.error || "wajah maloom nahi") +
               " — user ko SAAF batao ke ye kaam NAHI hua aur kyun. Kamyabi ka daawa bilkul MANA hai.";
      return o;
    }
    o.ok = true;
    o.state = st;
    o.sure = HAQEEQAT.SURE[st] === true;
    o.sach = HAQEEQAT.SAY[st] || HAQEEQAT.SAY.started;
    if (!o.sure) HAQEEQAT.pending = { name: name, state: st, at: (new Date()).getTime() };
    return o;
  },
  pending: null,

  /* ─── POST-CHECK: model par bharosa nahi, JAANCH ───
     Aakhri amal `sure:false` tha aur jawab mein "bhej diya / ho gaya" likha hai?
     To ye jhoot hai — app khud theek kar degi. */
  LIE: /(bhej\s*d[iy]|bhej\s*chuk|send\s*(kar\s*)?d[iy]|sent\b|ho\s*gaya\s*hai|ho\s*ga?ya\b|kar\s*d[iy]a\b|kar\s*di\b|chal\s*rah[ai]\s*hai|lag\s*gay[ai]|khul\s*gay[ai]|set\s*kar\s*d[iy]|done\b|\u092d\u0947\u091c\s*\u0926|\u0939\u094b\s*\u0917\u092f|\u0915\u0930\s*\u0926\u093f|\u0628\u06BE\u06CC\u062C\s*\u062F|\u06C1\u0648\s*\u06AF\u06CC)/i,

  FIX: {
    typed: function (n) {
      return "Chat khol kar matn type kar diya hai, " + n + " \u2014 ab screen par SEND ka button dabana hoga. " +
             "Ya Settings mein AutoSend ON kar do, phir main khud bhej diya karungi.";
    },
    started: function (n) {
      return "Khol raha hoon, " + n + " \u2014 screen par dekh lo. Agar na khule to phir se bolna.";
    },
    failed: function (n, why) {
      return "Ye kaam nahi hua, " + n + (why ? (" \u2014 " + why) : "") + ". Dobara koshish karun?";
    }
  },

  /* jawab bahar jane se pehle: jhoot to nahi? */
  /* Maya ne kaha "Aankhein mode activate kar rahi hoon 👀" magar KOI TOOL CHALA
     HI NAHI — ye bhi jhoot hai. Pehle guard sirf tab lagta tha jab koi tool
     sure:false ke sath chala ho. Ab "kuch kiya hi nahi" bhi pakra jata hai. */
  DOING: /(dekh\s*rah[ai]|nazar\s*rakh|aankhein|vision|camera\s*(khol|se)|screen\s*(khol|dekh|par nazar)|photo\s*(khich|le rah)|activate\s*kar|khol\s*rah[ai]|kar\s*rah[ai]\s*hoon|shuru\s*kar\s*rah)/i,
  noTool: function (text) {
    /* Sirf tab jab hum YAQEEN se jaante hain ke is turn mein koi tool nahi chala:
       turn track hua ho, koi tool na chala ho, aur koi pending amal bhi na ho. */
    if (typeof TRACE === "undefined" || !TRACE.cur) return null;
    if (TRACE.cur.tools && TRACE.cur.tools.length) return null;
    if (HAQEEQAT.pending) return null;
    var t = String(text || "");
    if (!HAQEEQAT.DOING.test(t)) return null;
    var nm = "";
    try { nm = (settings && settings.name) || "Boss"; } catch (e) { nm = "Boss"; }
    if (/aankhein|vision|camera|screen|photo|dekh\s*rah/i.test(t)) {
      return "Main dekh sakti hoon, " + nm + " \u2014 magar camera KHOLNA parega. " +
             "Bolo \u201Ccamera se dekho\u201D to main camera khol dungi, phir photo khinch kar bata dungi. " +
             "Screen ka screenshot main abhi nahi le sakti.";
    }
    return "Ruko " + nm + " \u2014 maine abhi asal mein kuch kiya nahi. Dobara saaf bolo to kar deti hoon.";
  },

  check: function (text) {
    HAQEEQAT.caught = false;
    if (!FLAGS.on("sach")) return text;
    /* pehle: koi tool chala hi nahi magar daawa kar rahi hai? */
    var nt = HAQEEQAT.noTool(text);
    if (nt) {
      HAQEEQAT.caught = true;
      if (typeof pushLog === "function") pushLog("SACH: bina tool ke daawa pakra");
      return nt;
    }
    var p = HAQEEQAT.pending;
    if (!p) return text;
    /* purana amal (30 sec se zyada) ab is jawab se muta'alliq nahi */
    if ((new Date()).getTime() - p.at > 30000) { HAQEEQAT.pending = null; return text; }
    var t = String(text || "");
    if (!HAQEEQAT.LIE.test(t)) return t;                 /* koi daawa hi nahi — theek hai */
    var nm = "";
    try { nm = (settings && settings.name) || "Boss"; } catch (e) { nm = "Boss"; }
    HAQEEQAT.caught = true;
    HAQEEQAT.pending = null;
    if (typeof pushLog === "function") pushLog("SACH: jhoota daawa pakra (" + p.name + "/" + p.state + ")");
    try { NAAP.cur && (NAAP.cur.lie = p.name); } catch (e) {}
    return (HAQEEQAT.FIX[p.state] || HAQEEQAT.FIX.started)(nm);
  },
  caught: false,
  clear: function () { HAQEEQAT.pending = null; },

  /* prompt mein jane wala qanoon (~70 token) */
  rule: function () {
    if (!FLAGS.on("sach")) return "";
    return "\n\u2696\uFE0F SACH KA QANOON (sab se ahem): kisi bhi kaam ki KAMYABI ka daawa " +
           "SIRF tab karo jab tool ka jawab sure:true ho. Agar sure:false ho to us ke 'sach' " +
           "field mein likhi baat HU-BA-HU maano \u2014 misaal ke tor par WhatsApp/SMS ka matn " +
           "sirf TYPE hota hai, BHEJA NAHI JATA. 'bhej diya' / 'ho gaya' kehna JHOOT hai. " +
           "Sach bolna kabhi buri baat nahi \u2014 jhoot bolna hamesha buri baat hai.";
  }
};

