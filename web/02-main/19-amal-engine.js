/* ═══════════════════════════════════════════════════════════════════════════
   ⚡  AMAL ENGINE — P2a: TOOLS AB HAR DIMAAG KO                  (app v5.9.5)
   ---------------------------------------------------------------------------
   ASAL MASLA (aap ke apne device se sabit):

     tool wale turn : 0 / 12        <- ek bhi tool nahi chala
     DIMAAG: GEMINI × 1, Groq × 8, Mistral × 3
     LOG: BRAIN GEMINI: QUOTA_DAY (5 dafa)

   Gemini — MAYA ka WAHID tool-wala dimaag — ka din ka quota khatam tha. Baqi
   11 turn Groq aur Mistral ne diye, aur unhe `tools` bheje HI NAHI jate the.
   Magar prompt unhe tools ka HUKM deta tha. Natija: Maya ne kaam karne ke
   bajaye kaam ka BAYAN likh diya —
       "ठीक है, जान!"  (brightness 100 hui hi nahi)
       play_youtube(query="Funk        <- matn mein, kata hua
       "WhatsApp access disable hai"   <- ye jhoot tha

   ILAJ: Groq · Cerebras · Mistral · OpenRouter · NVIDIA · GitHub — sab
   OpenAI-shakl function calling jante hain. Bas jora nahi gaya tha.
   Ek tool registry -> do tarjume (Gemini ka + OpenAI ka).

   1 tool-wala dimaag  ->  7 tool-wale dimaag.
   ═══════════════════════════════════════════════════════════════════════════ */
var AMAL = {
  /* Gemini ka schema BARE HARF mein hai (OBJECT/STRING), OpenAI ko chhote chahiye */
  lc: function (sch) {
    if (!sch || typeof sch !== "object") return sch;
    var out = {}, k, v;
    for (k in sch) {
      if (!Object.prototype.hasOwnProperty.call(sch, k)) continue;
      v = sch[k];
      if (k === "type" && typeof v === "string") out[k] = v.toLowerCase();
      else if (k === "properties" && v && typeof v === "object") {
        out[k] = {};
        var pk;
        for (pk in v) if (Object.prototype.hasOwnProperty.call(v, pk)) out[k][pk] = AMAL.lc(v[pk]);
      }
      else if (k === "items") out[k] = AMAL.lc(v);
      else out[k] = v;
    }
    return out;
  },

  _oai: null,
  /* OpenAI-shakl tool list (ek dafa banti hai, phir yaad rehti hai) */
  openaiTools: function () {
    if (AMAL._oai) return AMAL._oai;
    var out = [], i, d;
    for (i = 0; i < TOOL_DECLS.length; i++) {
      d = TOOL_DECLS[i];
      out.push({
        type: "function",
        function: {
          name: d.name,
          description: String(d.description || "").slice(0, 300),
          parameters: AMAL.lc(d.parameters) || { type: "object", properties: {} }
        }
      });
    }
    AMAL._oai = out;
    return out;
  },

  /* jin providers ne `tools` par 400 diya, unhe yaad rakho — dobara na maro */
  bad: {},
  poolOn: function (p) {
    if (!FLAGS.on("poolTools")) return false;
    if (!p || p.kind !== "openai") return false;      /* gemini ka apna raasta hai */
    if (AMAL.bad[p.id]) return false;
    return true;
  },
  markBad: function (id, why) {
    AMAL.bad[id] = true;
    if (typeof pushLog === "function") pushLog("AMAL: " + id + " tools nahi leta (" + String(why || "").slice(0, 40) + ")");
  },

  /* ─── tool calls chalao aur nateeje wapas do (OpenAI shakl) ─── */
  runCalls: async function (calls) {
    var out = [], i, c, name, args, res;
    for (i = 0; i < calls.length && i < 4; i++) {
      c = calls[i];
      name = (c && c.function && c.function.name) || "";
      args = {};
      try { args = JSON.parse((c.function && c.function.arguments) || "{}"); } catch (e) { args = {}; }
      args = AMAL.alias(name, args);
      if (typeof pushLog === "function") pushLog("AI TOOL: " + name + " (pool)");
      try { NAAP.mark("tool"); NAAP.cur && (NAAP.cur.tool = name); } catch (e) {}
      try { res = await execTool(name, args); }
      catch (e) { res = { error: String((e && e.message) || e) }; }
      out.push({
        role: "tool",
        tool_call_id: c.id || ("call_" + i),
        name: name,
        content: JSON.stringify(res === undefined ? { done: true } : res).slice(0, 900)
      });
    }
    return out;
  },

  /* ─── ARG ALIAS — model 'level' likhta hai, execTool 'percent' maangta hai ───
     Ye BUG 8 tha: screenshot mein brightness_control(level=100) aaya tha. */
  ALIAS: {
    brightness_control: { percent: ["level", "value", "brightness", "pct", "amount", "percentage"] },
    volume_control:     { percent: ["level", "value", "volume", "vol", "pct", "percentage"] },
    torch_control:      { on: ["state", "enable", "enabled", "value", "status"] },
    set_timer:          { seconds: ["sec", "secs", "duration", "time"] },
    set_reminder:       { minutes: ["mins", "min", "delay"], text: ["message", "msg", "what", "note"] },
    play_youtube:       { query: ["q", "song", "search", "name", "title", "video"] },
    search_web:         { query: ["q", "search", "text"] },
    web_search:         { query: ["q", "search", "text"] },
    wiki_search:        { query: ["q", "topic", "term"] },
    open_app:           { app: ["name", "application", "package"] },
    call_contact:       { name: ["contact", "person", "who"] },
    message_contact:    { name: ["contact", "person", "to"], message: ["text", "msg", "body"] },
    notify:             { text: ["message", "msg", "body", "title"] },
    run_javascript:     { code: ["js", "script", "expression"] },
    web_fetch:          { url: ["link", "site", "address"] },
    see_camera:         { question: ["q", "prompt", "text", "ask", "query"] },
    see_image:          { question: ["q", "prompt", "text", "ask", "query"] }
  },
  alias: function (name, args) {
    var map = AMAL.ALIAS[name];
    if (!map || !args) return args || {};
    var want, alts, j;
    for (want in map) {
      if (!Object.prototype.hasOwnProperty.call(map, want)) continue;
      if (args[want] !== undefined && args[want] !== null && args[want] !== "") continue;
      alts = map[want];
      for (j = 0; j < alts.length; j++) {
        if (args[alts[j]] !== undefined && args[alts[j]] !== null && args[alts[j]] !== "") {
          args[want] = args[alts[j]];
          break;
        }
      }
    }
    /* "100%" -> 100 */
    if (args.percent !== undefined && typeof args.percent === "string") {
      var n = parseInt(String(args.percent).replace(/[^0-9-]/g, ""), 10);
      if (!isNaN(n)) args.percent = n;
    }
    if (args.on !== undefined && typeof args.on === "string") {
      args.on = /^(on|true|1|yes|haan|jala|chalu)$/i.test(args.on.trim());
    }
    return args;
  },

  /* ═══ ROUTER KI LUGHAT — ab TOOLS khud apne lafz laate hain ═══
     Purana ACTION_WORDS haath se likha tha aur 33 mein se 12 tools use nazar
     hi nahi aate the (brightness / torch / volume / reminder / namaz …).
     Ab har tool apne trigger deta hai aur regex UNHI se banti hai. */
  TRIGGERS: {
    brightness_control: ["brightness", "britness", "brightnes", "brighness", "chamak", "roshni", "raushni", "screen light", "dim karo", "bright karo"],
    volume_control:     ["volume", "awaaz", "awaz", "aawaz", "sound", "speaker", "mute", "vol "],
    torch_control:      ["torch", "flash", "flashlight", "batti", "light on", "light off", "roshni karo"],
    lock_screen:        ["lock karo", "screen lock", "phone lock"],
    set_timer:          ["timer", "count down", "countdown"],
    set_alarm:          ["alarm", "jaga dena", "jagana", "uthana"],
    set_reminder:       ["reminder", "yaad dila", "yaad dilana", "yaad karana", "remind"],
    get_weather:        ["mausam", "weather", "garmi", "sardi", "barish", "temperature"],
    battery_status:     ["battery", "batri", "charge", "charging"],
    prayer_times:       ["namaz", "azan", "azaan", "fajr", "zuhr", "asr", "maghrib", "isha", "prayer"],
    run_javascript:     ["calculate", "kitna", "kitne", "percent", "hisab", "jama", "average", "convert", "nikalo", "table"],
    wiki_search:        ["wikipedia", "wiki", "kaun hai", "kaun tha", "kya hota hai"],
    web_search:         ["search", "talash", "dhoond", "khojo", "internet par", "google par", "pata karo", "dekho k"],
    web_fetch:          ["site parho", "page parho", "link parho", "url", "rate kya", "is website"],
    search_memory:      ["yaad hai", "yaad tha", "maine kaha tha", "pehle bataya"],
    recall_memory:      ["kya yaad", "sab yaad", "yaaddasht", "memory dikhao"],
    save_memory:        ["yaad rakh", "yaad rakhna", "note kar lo"],
    diary_write:        ["diary", "roznamcha", "aaj ye hua"],
    diary_search:       ["diary mein", "pichle hafte", "kal kya hua"],
    list_files:         ["files", "download", "photo", "picture", "video", "music"],
    open_file:          ["file kholo", "pdf", "photo kholo"],
    maya_act:           ["dabao", "tap karo", "tap kar", "dab do", "likh do", "type karo", "likho wahan", "screen par likho", "button dabao", "ruk jao", "ruk jaa", "ruko", "rok do", "stop automation"],
    share_file:         ["share karo", "bhejo file"],
    open_app:           ["kholo", "khol do", "open", "app "],
    play_youtube:       ["gana", "gaana", "song", "video", "youtube", "yt ", "baja", "chalao", "lagao"],
    search_web:         ["google kholo", "browser"],
    call_contact:       ["call karo", "phone karo", "mila do", "call kar"],
    call_number:        ["number par call", "dial"],
    message_contact:    ["message karo", "whatsapp karo", "msg karo", "message kar"],
    send_sms:           ["sms", "text bhejo"],
    reply_message:      ["reply karo", "jawab do", "reply kar"],
    read_messages:      ["message parho", "kya message", "naye message", "whatsapp dekho"],
    schedule_message:   ["baad mein bhejna", "baad message"],
    create_skill:       ["seekh lo", "ye tareeqa", "aaindah aise"],
    notify:             ["notification", "notify", "screen par dikha"],
    see_camera:         ["ye dekho", "yeh dekho", "ye kya hai", "camera khol", "photo khincho", "is bill", "ye likha", "parh kar batao", "dekh kar batao", "ye dawa"],
    see_image:          ["gallery", "gallary", "screenshot", "gallery wali", "photo dekho"],
    read_screen:        ["screen par kya", "kya dikh raha", "screen dekho", "screen parho", "kaunse button", "screen par abhi"]
  },
  _re: null,
  actionRe: function () {
    if (AMAL._re) return AMAL._re;
    var words = [], k, i, w;
    for (k in AMAL.TRIGGERS) {
      if (!Object.prototype.hasOwnProperty.call(AMAL.TRIGGERS, k)) continue;
      for (i = 0; i < AMAL.TRIGGERS[k].length; i++) {
        w = String(AMAL.TRIGGERS[k][i]).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (words.indexOf(w) < 0) words.push(w);
      }
    }
    words.sort(function (a, b) { return b.length - a.length; });
    AMAL._re = new RegExp("(" + words.join("|") + ")", "i");
    return AMAL._re;
  },
  /* kaunsa tool? (sirf naapne aur test ke liye — faisla dimaag hi karta hai) */
  guess: function (text) {
    var t = String(text || "").toLowerCase(), best = "", blen = 0, k, i, w;
    for (k in AMAL.TRIGGERS) {
      if (!Object.prototype.hasOwnProperty.call(AMAL.TRIGGERS, k)) continue;
      for (i = 0; i < AMAL.TRIGGERS[k].length; i++) {
        w = String(AMAL.TRIGGERS[k][i]).toLowerCase();
        if (t.indexOf(w) >= 0 && w.length > blen) { best = k; blen = w.length; }
      }
    }
    return best;
  }
};

/* --- OpenAI-shakl providers ab BRAIN POOL sambhalta hai --- */
function brainAsk(p, ki, msgs){
  return new Promise(function (res) {
    BRAIN.ask(p, ki, msgs, function (err, out) { res(err ? null : out); });
  });
}

/* --- Main: kabhi rukne wala nahi --- */
async function askAI(wasVoice){
  DIMAAG.reset();
  var lu = DIMAAG.lastUser();
  if (lu) {
    var ck = cacheKey(lu);
    var cv = replyCache[ck];
    if (cv && Date.now() - cv.t < 21600000 && cv.text) {
      pushLog("CACHE HIT (turant)");
      DIMAAG.log("CACHE", null, "yaad tha");
      reply(cv.text, wasVoice);
      return;
    }
  }
  thinking = true; setOrb("thinking");
  geminiChat.keyErr = false;
  geminiChat.toolsUsed = false;

  /* Issue 3 latency: per-turn timing markers in the system log
     (t0 = askAI entry, t1 = brain answer ready). */
  try { pushLog("T: brain start"); } catch (e) {}
  var need = lu ? needsTools(lu) : false;
  var tBrain0 = (new Date()).getTime();
  var all = BRAIN.plan(need), keyed = [], keyless = [], i;
  for (i = 0; i < all.length; i++) (all[i].p.keyless ? keyless : keyed).push(all[i]);
  /* 4 keyed koshishein, phir keyless teh — jo hamesha zinda hoti hai */
  /* Issue 3: fewer serial brain attempts per turn. Default keeps the
     battle-tested 4-keyed chain; settings.fastShort tightens it to 2. */
  var order = (settings.fastShort === true ? keyed.slice(0, 2) : keyed.slice(0, 4)).concat(keyless);
  var msgs = DIMAAG.msgs(need);
  var out = null;

  for (i = 0; i < order.length && !out; i++) {
    var it = order[i];
    if (it.p.kind === "gemini") { try { out = await geminiChat(); } catch (e) { DIMAAG.log("Gemini", "NETWORK", String(e && e.message || e).slice(0, 60)); } }
    else { try { out = await brainAsk(it.p, it.ki, msgs); } catch (e) { DIMAAG.log(it.p.name, "NETWORK", String(e && e.message || e).slice(0, 60)); } }
  }

  if (out) {
    askAI._retried = false;
    try {
      NAAP.mark("brain");
      var _bn = aiState.provider || BRAIN.lastUsed || "?";
      NAAP.cur && (NAAP.cur.brain = _bn);
      TRACE.brain(_bn, (NAAP.cur && NAAP.cur.m.brain) || 0);
    } catch (e) {}   /* 📊 P0 */
    thinking = false; setOrb("idle");
    if (lu && !geminiChat.toolsUsed && out.length < 400) cachePut(cacheKey(lu), out);
    reply(out, wasVoice);
    return;
  }
  thinking = false; setOrb("idle");

  var code = DIMAAG.verdict() || DIMAAG.lastCode;
  DIMAAG.lastCode = code;
  var loc0 = DIMAAG.localAnswer(lu);
  if (loc0) { DIMAAG.log("LOCAL", null, "offline jawab"); aiState.provider = "LOCAL"; reply(loc0, wasVoice); return; }

  var worthRetry = (code === "QUOTA" || code === "SERVER" || code === "NETWORK" || code === "TIMEOUT" || code === "EMPTY");
  if (worthRetry && !askAI._retried && navigator.onLine !== false) {
    askAI._retried = true;
    var wait = Math.min(Math.max(lastRetryDelay || 30000, 5000), 45000);
    aiState.provider = "COOLDOWN";
    toast("Sab " + order.length + " dimaag thak gaye — " + Math.round(wait / 1000) + "s baad KHUD dobara try karungi");
    pushLog("RETRY IN " + Math.round(wait / 1000) + "s (" + code + ")");
    setTimeout(function(){ askAI(wasVoice); }, wait);
    return;
  }
  askAI._retried = false;
  aiState.provider = "—";

  try { NAAP.cur && (NAAP.cur.err = code); } catch (e) {}   /* 📊 P0 */
  reply(DIMAAG.failMessage(), wasVoice);
}

function openURL(u){ var w = window.open(u, "_blank"); if (!w) { try { location.href = u; } catch(e){} } }

