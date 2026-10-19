/* ═══════════════════════════════════════════════════════════════════════════
   🗣️  BOLI  —  LEHJA (accent) ka asal ilaj                      (app v5.9.5)
   ---------------------------------------------------------------------------
   ASAL MASLA — awaaz ka nahi, MATN ka tha.

   Fish Audio ki apni dastavez:
       "The model DETECTS THE LANGUAGE of the input text and generates
        audio in that language."

   Aur hum Fish ko ye bhejte the:
       text: "Ho gaya boss, brightness set kar di"
              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
              LATIN harf -> Fish samajhta hai ANGREZI -> ANGREZI LEHJA

   Awaaz (voice) chahe kitni bhi Hindustani ho, matn Latin hoga to lehja
   angrezi hi rahega. Yehi wajah thi ke "hamare accent mein nahi bol rahi".

   ILAJ: SCREEN par Roman Urdu hi rahega (aap ne yehi maanga tha), magar
   BOLNE ke liye matn Devanagari (hi-IN) ya Urdu script (ur-PK) mein badla
   jayega. Ye SUNO ka bilkul ulta hai:

       SUNO :  Urdu script  ->  Roman     (aap ki awaaz ko likhne ke liye)
       BOLI :  Roman        ->  Devanagari/Urdu  (Maya ke bolne ke liye)

   Brand ke naam (WhatsApp, YouTube, Monarch) Latin hi rehte hain — Fish
   unhen theek parhta hai, aur baqi matn Devanagari hone ki wajah se poora
   jumla Hindustani lehje mein aata hai.
   ═══════════════════════════════════════════════════════════════════════════ */
var BOLI = {
  /* Latin hi rehne dena — inhen badla to Fish inhen bhi bigar dega */
  KEEP: /^(whatsapp|youtube|instagram|telegram|facebook|gmail|chrome|google|maps|playstore|spotify|netflix|snapchat|twitter|tiktok|daraz|messenger|reels|monarch|mrbeast|maya|wifi|bluetooth|ok|hi|sms|app|link|url|pdf|mp3|ai|api|tv|pc|gb|mb|km|kg|am|pm)$/i,

  /* ─── Aam Roman Urdu lafz -> Devanagari (yehi 90% matn dhaant lete hain) ─── */
  D: {
    "ho":"हो","hai":"है","hain":"हैं","hun":"हूँ","hoon":"हूँ","hu":"हूँ","tha":"था","thi":"थी","the":"थे",
    "kar":"कर","karo":"करो","karna":"करना","kar di":"कर दी","kardi":"कर दी","kardiya":"कर दिया",
    "kiya":"किया","ki":"की","ka":"का","ke":"के","ko":"को","se":"से","par":"पर","mein":"में","me":"में",
    "aur":"और","ya":"या","nahi":"नहीं","na":"ना","haan":"हाँ","han":"हाँ","ji":"जी","bilkul":"बिल्कुल",
    "ab":"अब","abhi":"अभी","phir":"फिर","pehle":"पहले","baad":"बाद","aaj":"आज","kal":"कल","raat":"रात",
    "subah":"सुबह","sham":"शाम","waqt":"वक़्त","din":"दिन",
    "main":"मैं","mai":"मैं","mera":"मेरा","meri":"मेरी","mere":"मेरे","mujhe":"मुझे","mujh":"मुझ",
    "aap":"आप","aapka":"आपका","aapki":"आपकी","aapko":"आपको","tum":"तुम","tumhara":"तुम्हारा","tumhein":"तुम्हें",
    "hum":"हम","hamara":"हमारा","hamari":"हमारी","wo":"वो","woh":"वो","ye":"ये","yeh":"ये","us":"उस","is":"इस",
    "kya":"क्या","kyun":"क्यों","kyu":"क्यों","kaise":"कैसे","kaisa":"कैसा","kaisi":"कैसी",
    "kahan":"कहाँ","kaun":"कौन","kab":"कब","kitna":"कितना","kitni":"कितनी","kitne":"कितने",
    "acha":"अच्छा","accha":"अच्छा","achi":"अच्छी","theek":"ठीक","thik":"ठीक","sahi":"सही","galat":"ग़लत",
    "chalo":"चलो","chal":"चल","chalao":"चलाओ","chala":"चला","raha":"रहा","rahi":"रही","rahe":"रहे",
    "gaya":"गया","gayi":"गई","gaye":"गए","diya":"दिया","di":"दी","do":"दो","de":"दे","dena":"देना",
    "lo":"लो","le":"ले","liya":"लिया","laga":"लगा","lagao":"लगाओ","lagi":"लगी",
    "bhejo":"भेजो","bhej":"भेज","bheja":"भेजा","bheji":"भेजी","bhejta":"भेजता",
    "kholo":"खोलो","khol":"खोल","khula":"खुला","khuli":"खुली","band":"बंद",
    "batao":"बताओ","bata":"बता","bataya":"बताया","bolo":"बोलो","bol":"बोल","bola":"बोला",
    "suno":"सुनो","sun":"सुन","suna":"सुना","dekho":"देखो","dekh":"देख","dekha":"देखा",
    "samajh":"समझ","samjha":"समझा","pata":"पता","malum":"मालूम","yaad":"याद",
    "chahiye":"चाहिए","chahta":"चाहता","chahti":"चाहती","zaroori":"ज़रूरी","zaroor":"ज़रूर",
    "sab":"सब","kuch":"कुछ","koi":"कोई","har":"हर","bhi":"भी","sirf":"सिर्फ़","bas":"बस","phir se":"फिर से",
    "bohat":"बहुत","bahut":"बहुत","thora":"थोड़ा","thoda":"थोड़ा","zyada":"ज़्यादा","kam":"कम",
    "sath":"साथ","liye":"लिए","wala":"वाला","wali":"वाली","wale":"वाले",
    "boss":"बॉस","sir":"सर","jaan":"जान","yaar":"यार","bhai":"भाई","dost":"दोस्त",
    "shukriya":"शुक्रिया","sorry":"सॉरी","please":"प्लीज़","maaf":"माफ़",
    "salam":"सलाम","assalam":"अस्सलाम","alaikum":"अलैकुम","namaste":"नमस्ते",
    "awaaz":"आवाज़","awaz":"आवाज़","gana":"गाना","gaana":"गाना","song":"सॉन्ग","video":"वीडियो",
    "message":"मैसेज","msg":"मैसेज","call":"कॉल","phone":"फ़ोन","number":"नंबर","naam":"नाम",
    "alarm":"अलार्म","timer":"टाइमर","battery":"बैटरी","mausam":"मौसम","garmi":"गर्मी","sardi":"सर्दी",
    "brightness":"ब्राइटनेस","volume":"वॉल्यूम","torch":"टॉर्च","screen":"स्क्रीन","light":"लाइट",
    "search":"सर्च","open":"ओपन","send":"सेंड","type":"टाइप","save":"सेव","set":"सेट",
    "kaam":"काम","madad":"मदद","masla":"मसला","koshish":"कोशिश","tayyar":"तैयार",
    "khatam":"ख़त्म","shuru":"शुरू","poora":"पूरा","aadha":"आधा",
    "paani":"पानी","khana":"खाना","ghar":"घर","bahar":"बाहर","andar":"अंदर","upar":"ऊपर","neeche":"नीचे",
    "namaz":"नमाज़","fajr":"फ़ज्र","zuhr":"ज़ुहर","asr":"अस्र","maghrib":"मग़रिब","isha":"इशा"
  },

  /* ─── Harf ba harf (jab lafz lughat mein na ho) ─── */
  CONS: [
    ["chh","छ"],["sh","श"],["ch","च"],["kh","ख"],["gh","घ"],["th","थ"],["dh","ध"],["ph","फ"],
    ["bh","भ"],["jh","झ"],["zh","ज़"],["ng","ंग"],["ny","न्य"],
    ["k","क"],["q","क़"],["g","ग"],["j","ज"],["z","ज़"],["t","त"],["d","द"],["n","न"],["p","प"],
    ["f","फ़"],["b","ब"],["m","म"],["y","य"],["r","र"],["l","ल"],["v","व"],["w","व"],["s","स"],
    ["h","ह"],["x","क्स"],["c","क"]
  ],
  VOW: [
    ["aa","आ","ा"],["ai","ऐ","ै"],["au","औ","ौ"],["ee","ई","ी"],["oo","ऊ","ू"],
    ["a","अ",""],["i","इ","ि"],["u","उ","ु"],["e","ए","े"],["o","ओ","ो"]
  ],

  deva: function (word) {
    var w = String(word || "").toLowerCase();
    if (BOLI.D[w]) return BOLI.D[w];
    var out = "", i = 0, j, hit, prevCons = false;
    while (i < w.length) {
      hit = null;
      for (j = 0; j < BOLI.VOW.length; j++) {
        if (w.substr(i, BOLI.VOW[j][0].length) === BOLI.VOW[j][0]) { hit = BOLI.VOW[j]; break; }
      }
      if (hit) {
        out += prevCons ? hit[2] : hit[1];
        i += hit[0].length; prevCons = false; continue;
      }
      hit = null;
      for (j = 0; j < BOLI.CONS.length; j++) {
        if (w.substr(i, BOLI.CONS[j][0].length) === BOLI.CONS[j][0]) { hit = BOLI.CONS[j]; break; }
      }
      if (hit) {
        if (prevCons) out += "\u094D";                    /* do consonant lagataar -> virama */
        out += hit[1];
        i += hit[0].length; prevCons = true; continue;
      }
      out += w.charAt(i); i++; prevCons = false;
    }
    return out;
  },

  /* Devanagari -> Urdu script (ur-PK ke liye) */
  DU: {
    "अ":"ا","आ":"آ","इ":"ا","ई":"ای","उ":"ا","ऊ":"او","ए":"ای","ऐ":"ای","ओ":"او","औ":"او",
    "क":"ک","ख":"کھ","ग":"گ","घ":"گھ","च":"چ","छ":"چھ","ज":"ج","झ":"جھ","ट":"ٹ","ठ":"ٹھ",
    "ड":"ڈ","ढ":"ڈھ","त":"ت","थ":"تھ","द":"د","ध":"دھ","न":"ن","प":"پ","फ":"پھ","ब":"ب",
    "भ":"بھ","म":"م","य":"ی","र":"ر","ल":"ل","व":"و","श":"ش","ष":"ش","स":"س","ह":"ہ",
    "ज़":"ز","फ़":"ف","क़":"ق","ग़":"غ","ख़":"خ","ड़":"ڑ","ढ़":"ڑھ",
    "ा":"ا","ि":"","ी":"ی","ु":"","ू":"و","े":"ے","ै":"ے","ो":"و","ौ":"و","ं":"ں","ँ":"ں","्":"","ः":"",
    "ऑ":"آ","ॉ":"و","ऍ":"ا","ॅ":"","़":"","ृ":"ر","ऋ":"ر"
  },
  urdu: function (word) {
    var d = BOLI.deva(word), out = "", i = 0, two;
    while (i < d.length) {
      two = d.substr(i, 2);
      if (BOLI.DU[two] !== undefined) { out += BOLI.DU[two]; i += 2; continue; }
      var c = d.charAt(i);
      out += (BOLI.DU[c] !== undefined) ? BOLI.DU[c] : c;
      i++;
    }
    return out;
  },

  /* ═══ WAHID DARWAZA — bolne wala matn ═══
     lang: "hi-IN" -> Devanagari · "ur-PK" -> Urdu script · warna jyun ka tyun */
  say: function (text, lang) {
    var t = String(text || "");
    if (!FLAGS.on("boli")) return t;
    var L = String(lang || "");
    if (!/^hi|^ur/.test(L)) return t;
    if (!/[A-Za-z]/.test(t)) return t;                  /* pehle se Devanagari/Urdu hai */
    var toUrdu = /^ur/.test(L);
    var parts = t.split(/([^A-Za-z']+)/), out = [], i, w;
    for (i = 0; i < parts.length; i++) {
      w = parts[i];
      if (!/[A-Za-z]/.test(w)) { out.push(w); continue; }
      if (BOLI.KEEP.test(w)) { out.push(w); continue; }   /* brand ka naam Latin hi rahe */
      out.push(toUrdu ? BOLI.urdu(w) : BOLI.deva(w));
    }
    var res = out.join("");
    BOLI.last = { from: t, to: res, lang: L };
    return res;
  },
  last: null
};

var AWAAZ = {
  VER: 7,
  API: "https://generativelanguage.googleapis.com/v1beta/models/",
  MODELS: ["gemini-2.5-flash-preview-tts", "gemini-3.1-flash-tts-preview", "gemini-2.5-pro-preview-tts"],

  /* Gemini TTS ka free quota sirf ~15 request ROZ ka hai. Is liye:
     (a) pehla tukra chhota (jaldi bole), baqi BARE (kam requests) — ek jawab
         pehle 4-5 request leta tha, ab aksar 1;
     (b) neeche ek KEYLESS neural awaaz maujood hai jab Gemini ka din khatam ho. */
  CHUNK: 420,          /* purana — ab CHUNK1/CHUNKN chalte hain */
  CHUNK1: 300,         /* pehla tukra: foran shuru ho */
  CHUNKN: 1500,        /* baqi tukre: kam request = zyada din chalega */

  /* ─── KEYLESS NEURAL (Pollinations openai-audio) — koi key nahi, koi signup nahi ─── */
  POLLEN_URL: "https://text.pollinations.ai/openai",
  POLLEN_VOICE: { Kore:"nova", Puck:"fable", Charon:"onyx", Aoede:"shimmer", Fenrir:"echo", Leda:"coral", Orus:"alloy", Zephyr:"sage" },
  POLLEN_COOL: 600000,
  CACHE_MAX: 12,       /* aakhri itni clips yaad rakho */
  TIMEOUT: 25000,
  COOLDOWN: 90000,     /* 429 ke baad itni der Gemini ko haath na lagao */

  audio: null,         /* abhi bajta hua <audio> */
  gen: 0,              /* har naye speak par barhta hai -> purane callbacks mar jate hain */
  xhrs: [],            /* chalte hue requests (stop par abort) */
  flight: {},          /* key -> [callbacks]  (do dafa same clip na mangwao) */
  cache: [],           /* [{ k, url }] LRU */
  model: "",           /* jo model chal gaya wo yaad */
  keyBad: false,        /* purana flag — ab sirf jab SAB keys mar jayen */
  cooldownUntil: 0,
  ki: 0,                /* is waqt kaun si TTS key chal rahi hai */
  kstate: {},           /* key index -> { cool:ts, why:"" }  (localStorage mein mehfooz) */
  pollenBad: 0,         /* keyless neural ka cooldown */
  engine: "-",         /* aakhri engine jo asal mein bola: neural | edge | device | off */
  err: "",             /* aakhri nakami ka code */
  errText: "",
  spoke: 0,            /* kitni dafa neural bola (Doctor ke liye) */
  edgeSpoke: 0,        /* kitni dafa EDGE bola */
  fishSpoke: 0,        /* kitni dafa FISH boli */
  edgeVoiceUsed: "",   /* aakhri Edge awaaz jo asal mein chali */
  cacheHits: 0,

  /* ---------- settings ka ek hi tarjuma ---------- */
  cfg: function () {
    var s = (typeof settings === "object" && settings) ? settings : {};
    var mode = s.voiceEngine || "auto";
    if (s.voiceOn === false) mode = "off";
    return {
      on: s.voiceOn !== false,
      mode: mode,                    /* auto | neural | fish | edge | device | off */
      key: AWAAZ.keyAt(AWAAZ.ki),
      keys: AWAAZ.keyList(),
      voice: s.gVoice || "Kore",
      mood: s.voiceMood || "auto",
      wifiOnly: s.neuralWifiOnly === true,
      maxChars: +(s.neuralMaxChars || 1400),
      edge: (s.edgeTTS !== false) || mode === "edge",   /* ab default ON — kyunke ab sach much chalta hai */
      fish: (s.fishOn !== false) || mode === "fish",    /* key ho to sab se pehle yehi */
      persona: s.persona || "maya"
    };
  },

  /* ---------- TTS ki KAI keys (ttsKey pehle, phir main Gemini keys) ---------- */
  keyList: function () {
    var s = (typeof settings === "object" && settings) ? settings : {};
    var raw = String(s.ttsKey || "") + "," + String(s.apikey || "");
    var parts = raw.split(/[\s,;]+/), out = [], i;
    for (i = 0; i < parts.length; i++) {
      var k = parts[i].trim();
      if (k && out.indexOf(k) < 0) out.push(k);
    }
    return out;
  },
  keyAt: function (i) { var L = AWAAZ.keyList(); return L[i] || L[0] || ""; },
  kst: function (i) { if (!AWAAZ.kstate[i]) AWAAZ.kstate[i] = { cool: 0, why: "" }; return AWAAZ.kstate[i]; },
  kchill: function (i, ms, why) { var st = AWAAZ.kst(i); st.cool = Date.now() + ms; st.why = why; AWAAZ.persist(); },
  kfree: function (i) { var st = AWAAZ.kst(i); st.cool = 0; st.why = ""; AWAAZ.persist(); },

  /* agli zinda key par jao; koi na bache to false */
  nextKey: function () {
    var L = AWAAZ.keyList(), i;
    for (i = 0; i < L.length; i++) {
      var j = (AWAAZ.ki + 1 + i) % L.length;
      if (AWAAZ.kst(j).cool < Date.now()) { AWAAZ.ki = j; return true; }
    }
    return false;
  },
  liveKeys: function () {
    var L = AWAAZ.keyList(), n = 0, i;
    for (i = 0; i < L.length; i++) if (AWAAZ.kst(i).cool < Date.now()) n++;
    return n;
  },

  /* halat app band hone par bhi yaad rahe (din ka quota subah tak yaad) */
  persist: function () {
    try { localStorage.setItem("maya_awaaz", JSON.stringify({ k: AWAAZ.kstate, p: AWAAZ.pollenBad, m: AWAAZ.model })); } catch (e) {}
  },
  restore: function () {
    try {
      var j = JSON.parse(localStorage.getItem("maya_awaaz") || "{}");
      if (j.k) AWAAZ.kstate = j.k;
      if (j.p) AWAAZ.pollenBad = j.p;
      if (j.m) AWAAZ.model = j.m;
    } catch (e) {}
  },
  /* nayi settings = sab ko naya mauka */
  reset: function () {
    AWAAZ.kstate = {}; AWAAZ.ki = 0; AWAAZ.pollenBad = 0;
    AWAAZ.keyBad = false; AWAAZ.cooldownUntil = 0; AWAAZ.err = ""; AWAAZ.errText = "";
    AWAAZ.persist(); AWAAZ.paint();
  },

  isWifi: function () {
    try {
      var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (!c || !c.type) return true;                    /* pata hi nahi to rok mat */
      return c.type === "wifi" || c.type === "ethernet" || c.type === "unknown";
    } catch (e) { return true; }
  },

  /* ---------- kyun neural nahi chal sakta? "" = chal sakta hai ---------- */
  blockReason: function (text) {
    var c = AWAAZ.cfg();
    if (c.mode === "off") return "OFF";
    if (c.mode === "device") return "DEVICE_MODE";
    if (navigator.onLine === false) return "OFFLINE";
    if (!c.key) return "KEY_MISSING";
    if (AWAAZ.liveKeys() === 0) return AWAAZ.keyBad ? "KEY_BAD" : "QUOTA";
    if (Date.now() < AWAAZ.cooldownUntil) return "QUOTA";
    if (c.wifiOnly && !AWAAZ.isWifi()) return "MOBILE_DATA";
    if (text && text.length > c.maxChars) return "TOO_LONG";
    return "";
  },

  /* ---------- har code ka insani matlab ---------- */
  WHY: {
    OFF: "Awaaz band hai (Settings se on karo)",
    DEVICE_MODE: "Aap ne sirf phone ki awaaz chuni hai",
    KEY_MISSING: "Gemini key nahi hai — muft neural awaaz chal rahi hai",
    KEY_BAD: "Gemini key nahi chal rahi — 🩺 KEYS CHECK KARO dabao, asal wajah pata chal jayegi",
    OFFLINE: "Internet nahi hai",
    QUOTA: "Gemini TTS ka quota khatam — muft neural awaaz chal rahi hai",
    MOBILE_DATA: "Mobile data par neural band hai (WiFi-only on hai)",
    TOO_LONG: "Jawab bohat lamba tha",
    TIMEOUT: "Google ne waqt par jawab nahi diya",
    NETWORK: "Network reach nahi hua",
    MODEL: "Ye TTS model is key par nahi chalta",
    BRIDGE: "App ka native pul jawab nahi de raha (app dobara kholo)",
    EDGE_MODE: "Aap ne Edge TTS chuna hai — Gemini ka quota bach raha hai",
    NO_AUDIO: "Google ne audio nahi bheji",
    DECODE: "Audio kharab aayi",
    AUDIO_BLOCKED: "Phone ne audio bajane nahi di",
    QUOTA_DAY: "Gemini TTS ka aaj ka quota khatam (free tier ~15/din) — 🩺 button se poori wajah dekho",
    HTTP_402: "Muft awaaz ka credit khatam",
    SEND: "Request bheji nahi ja saki"
  },
  why: function (code) { return AWAAZ.WHY[code] || (code ? ("Error: " + code) : ""); },

  /* ---------- base64 -> bytes ---------- */
  b64: function (b64) {
    var bin = atob(String(b64 || "").replace(/\s+/g, ""));
    var n = bin.length, out = new Uint8Array(n);
    for (var i = 0; i < n; i++) out[i] = bin.charCodeAt(i) & 255;
    return out;
  },

  /* ---------- mime se sample rate (hard-code mat karo warna awaaz teez/dheemi) ---------- */
  rateOf: function (mime) {
    var m = /rate=(\d+)/i.exec(String(mime || ""));
    return m ? parseInt(m[1], 10) : 24000;
  },

  /* ═══ YEHI ASAL FIX: raw PCM par 44-byte WAV header ═══
     Gemini deta hai: audio/L16;codec=pcm;rate=24000  = s16le, mono, 24 kHz.
     Bina header ke koi <audio> ise nahi bajata. */
  wav: function (pcm, rate, channels, bits) {
    rate = rate || 24000; channels = channels || 1; bits = bits || 16;
    var blockAlign = channels * bits / 8;
    var out = new Uint8Array(44 + pcm.length);
    var dv = new DataView(out.buffer);
    function s(off, str) { for (var i = 0; i < str.length; i++) dv.setUint8(off + i, str.charCodeAt(i)); }
    s(0, "RIFF");
    dv.setUint32(4, 36 + pcm.length, true);
    s(8, "WAVE");
    s(12, "fmt ");
    dv.setUint32(16, 16, true);              /* fmt chunk size */
    dv.setUint16(20, 1, true);               /* PCM */
    dv.setUint16(22, channels, true);
    dv.setUint32(24, rate, true);
    dv.setUint32(28, rate * blockAlign, true);
    dv.setUint16(32, blockAlign, true);
    dv.setUint16(34, bits, true);
    s(36, "data");
    dv.setUint32(40, pcm.length, true);
    out.set(pcm, 44);
    return out;
  },

  /* ---------- jawab mein se audio part dhoondo ---------- */
  pickAudio: function (data) {
    try {
      var parts = data.candidates[0].content.parts;
      for (var i = 0; i < parts.length; i++) {
        var d = parts[i].inlineData || parts[i].inline_data;
        if (d && d.data) return { data: d.data, mimeType: d.mimeType || d.mime_type || "" };
      }
    } catch (e) {}
    return null;
  },

  /* ---------- awaaz + mood ---------- */
  voiceId: function () {
    var want = AWAAZ.cfg().voice;
    for (var i = 0; i < GEMINI_VOICES.length; i++) if (GEMINI_VOICES[i].id === want) return want;
    return "Kore";
  },
  moodId: function () {
    var c = AWAAZ.cfg();
    if (c.mood && c.mood !== "auto") return c.mood;
    return PERSONA_MOOD[c.persona] || "warm";
  },
  moodPrompt: function (mood) {
    for (var i = 0; i < VOICE_MOODS.length; i++) if (VOICE_MOODS[i].id === mood) return VOICE_MOODS[i].p;
    return "";
  },
  /* Gemini ko diya jane wala matn: andaaz ka hukm + zubaan ka ishara + asal jumla */
  prompt: function (text, mood) {
    var tip = AWAAZ.moodPrompt(mood);
    var urdu = /[\u0600-\u06FF]/.test(text);
    var hindi = /[\u0900-\u097F]/.test(text);
    var lang = urdu ? " Speak natural Urdu." : (hindi ? " Speak natural Hindi." : "");
    if (!tip && !lang) return text;
    return (tip || "Say this naturally") + "." + lang + " Text: " + text;
  },

  /* ---------- lambe matn ko jumlon par toro ---------- */
  chunks: function (text, max) {
    max = max || AWAAZ.CHUNK;
    text = String(text || "").trim();
    if (!text) return [];
    if (text.length <= max) return [text];
    var sent = [], cur = "", i, ch;
    for (i = 0; i < text.length; i++) {
      ch = text.charAt(i); cur += ch;
      if (ch === "." || ch === "!" || ch === "?" || ch === "\u06D4" || ch === "\n") { sent.push(cur); cur = ""; }
    }
    if (cur) sent.push(cur);
    var out = [], buf = "";
    for (i = 0; i < sent.length; i++) {
      var s = sent[i];
      while (s.length > max) {                         /* ek hi bohat lamba jumla */
        var cut = s.lastIndexOf(" ", max);
        if (cut < max * 0.5) cut = max;
        out.push(s.slice(0, cut).trim());
        s = s.slice(cut);
      }
      if (buf && (buf + s).length > max) { out.push(buf.trim()); buf = s; }
      else buf += s;
    }
    if (buf.trim()) out.push(buf.trim());
    var clean = [];
    for (i = 0; i < out.length; i++) if (out[i]) clean.push(out[i]);
    return clean;
  },

  /* ---------- cache (LRU) ---------- */
  cacheGet: function (k) {
    for (var i = 0; i < AWAAZ.cache.length; i++) if (AWAAZ.cache[i].k === k) {
      var hit = AWAAZ.cache.splice(i, 1)[0];
      AWAAZ.cache.push(hit);
      return hit.url;
    }
    return null;
  },
  cachePut: function (k, url) {
    AWAAZ.cache.push({ k: k, url: url });
    while (AWAAZ.cache.length > AWAAZ.CACHE_MAX) {
      var old = AWAAZ.cache.shift();
      try { URL.revokeObjectURL(old.url); } catch (e) {}
    }
  },

  /* mara hua TTS model list se nikaalo (deprecation khud sanbhalo) */
  dropModel: function (m) {
    var out = [], i;
    for (i = 0; i < AWAAZ.MODELS.length; i++) if (AWAAZ.MODELS[i] !== m) out.push(AWAAZ.MODELS[i]);
    if (out.length) AWAAZ.MODELS = out;
    if (AWAAZ.model === m) AWAAZ.model = "";
    AWAAZ.persist();
  },

  /* pehla tukra chhota (foran bole), baqi bare (kam request = quota bacha) */
  chunkPlan: function (text) {
    var head = AWAAZ.chunks(text, AWAAZ.CHUNK1);
    if (!head.length) return [];
    if (head.length === 1) return head;
    var first = head[0];
    var rest = String(text).slice(first.length);
    return [first].concat(AWAAZ.chunks(rest, AWAAZ.CHUNKN));
  },

  /* POST: APK mein BRAIN ka async bridge (CORS nahi), warna seedha XHR */
  post: function (url, body, timeoutMs, cb) {
    if (typeof BRAIN !== "undefined" && BRAIN && BRAIN.post) { BRAIN.post(url, "", body, timeoutMs, cb); return; }
    var done = false, xhr = new XMLHttpRequest();
    function fin(st, t) { if (!done) { done = true; cb(st, t); } }
    try {
      xhr.open("POST", url, true);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.timeout = timeoutMs;
    } catch (e) { fin(0, "open"); return; }
    xhr.ontimeout = function () { fin(0, "timeout"); };
    xhr.onerror = function () { fin(0, "network"); };
    xhr.onload = function () { fin(xhr.status, xhr.responseText || ""); };
    try { xhr.send(body); } catch (e) { fin(0, "send"); }
  },

  /* ═══ KEYLESS NEURAL — Gemini ka din khatam? phir bhi asli awaaz ═══ */
  pollen: function (text, onDone, onFail) {
    if (Date.now() < AWAAZ.pollenBad) { onFail("QUOTA"); return; }
    var gen = AWAAZ.gen;
    var v = AWAAZ.POLLEN_VOICE[AWAAZ.voiceId()] || "nova";
    var list = AWAAZ.chunkPlan(text);
    if (!list.length) { onDone(); return; }

    function one(idx) {
      if (gen !== AWAAZ.gen) return;
      if (idx >= list.length) { AWAAZ.spoke++; onDone(); return; }
      var key = "pollen|" + v + "|" + list[idx];
      var hit = AWAAZ.cacheGet(key);
      if (hit) { AWAAZ.cacheHits++; AWAAZ.play(hit, gen, function () { one(idx + 1); }, function (c) { onFail(c); }); return; }
      var body = JSON.stringify({
        model: "openai-audio", modalities: ["text", "audio"],
        audio: { voice: v, format: "mp3" },
        messages: [{ role: "user", content: list[idx] }]
      });
      AWAAZ.post(AWAAZ.POLLEN_URL, body, 25000, function (status, txt) {
        if (gen !== AWAAZ.gen) return;
        if (status < 200 || status >= 300) {
          if (status === 429 || status === 402) AWAAZ.pollenBad = Date.now() + AWAAZ.POLLEN_COOL;
          AWAAZ.persist(); onFail(status ? ("HTTP_" + status) : "NETWORK"); return;
        }
        var d = null, b64 = "";
        try { d = JSON.parse(txt); b64 = d.choices[0].message.audio.data; } catch (e) {}
        if (!b64) { onFail("NO_AUDIO"); return; }
        var url;
        try { url = URL.createObjectURL(new Blob([AWAAZ.b64(b64)], { type: "audio/mpeg" })); }
        catch (e) { onFail("DECODE"); return; }
        AWAAZ.cachePut(key, url);
        AWAAZ.play(url, gen, function () { one(idx + 1); }, function (c) { onFail(c); });
      });
    }
    one(0);
  },

  /* ---------- model ki tarteeb: jo chala tha wo pehle ---------- */
  modelOrder: function () {
    var first = AWAAZ.model || (typeof settings === "object" && settings ? settings.ttsModel : "") || "";
    var list = [], i;
    if (first) list.push(first);
    for (i = 0; i < AWAAZ.MODELS.length; i++) if (AWAAZ.MODELS[i] !== first) list.push(AWAAZ.MODELS[i]);
    return list;
  },

  /* ═══ ek clip mangwao (cache + de-dupe + WAV) ═══ */
  fetchClip: function (text, opt, onOk, onErr) {
    var c = AWAAZ.cfg();
    var model = opt.model;
    var key = model + "|" + opt.voice + "|" + opt.mood + "|" + text;

    var hit = AWAAZ.cacheGet(key);
    if (hit) { AWAAZ.cacheHits++; onOk(hit, model, true); return; }

    if (AWAAZ.flight[key]) { AWAAZ.flight[key].push({ ok: onOk, err: onErr }); return; }
    AWAAZ.flight[key] = [{ ok: onOk, err: onErr }];
    function settle(err, url) {
      var subs = AWAAZ.flight[key] || []; delete AWAAZ.flight[key];
      for (var i = 0; i < subs.length; i++) {
        if (err) subs[i].err(err, model); else subs[i].ok(url, model, false);
      }
    }

    var body = {
      contents: [{ parts: [{ text: opt.prompt }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: opt.voice } } }
      }
    };

    var xhr = new XMLHttpRequest();
    AWAAZ.xhrs.push(xhr);
    function drop() { for (var i = 0; i < AWAAZ.xhrs.length; i++) if (AWAAZ.xhrs[i] === xhr) { AWAAZ.xhrs.splice(i, 1); break; } }
    try {
      xhr.open("POST", AWAAZ.API + encodeURIComponent(model) + ":generateContent", true);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.setRequestHeader("x-goog-api-key", AWAAZ.keyAt(AWAAZ.ki) || c.key);
      xhr.timeout = AWAAZ.TIMEOUT;
    } catch (e) { drop(); settle("SEND"); return; }

    xhr.ontimeout = function () { drop(); settle("TIMEOUT"); };
    xhr.onerror = function () { drop(); settle("NETWORK"); };
    xhr.onload = function () {
      drop();
      var st = xhr.status;
      AWAAZ.lastHttp = st;
      var msg = "";
      try { msg = String(JSON.parse(xhr.responseText).error.message || ""); } catch (e) { msg = String(xhr.responseText || "").slice(0, 200); }
      var ki = AWAAZ.ki;
      /* 403 aksar QUOTA hota hai, kharab key nahi — purana code ise maut samajhta tha */
      if (st === 401 || (st === 403 && /api key|invalid|unregistered|permission denied/i.test(msg) && !/quota|rate|exceed/i.test(msg))) {
        AWAAZ.kchill(ki, 1800000, "KEY_BAD");
        if (AWAAZ.liveKeys() === 0) AWAAZ.keyBad = true;
        settle("KEY_BAD"); return;
      }
      if (st === 429 || st === 403) {
        /* "per day" wala quota kal tak — Gemini TTS free tier sirf ~15/din deta hai */
        var day = /per day|daily|PerDay|exhausted/i.test(msg);
        AWAAZ.kchill(ki, day ? 3600000 : AWAAZ.COOLDOWN, day ? "QUOTA_DAY" : "QUOTA");
        if (AWAAZ.liveKeys() === 0) AWAAZ.cooldownUntil = Date.now() + (day ? 3600000 : AWAAZ.COOLDOWN);
        settle(day ? "QUOTA_DAY" : "QUOTA"); return;
      }
      if (st === 400 || st === 404) {
        if (/model|not found|not supported|deprecat/i.test(msg)) { AWAAZ.dropModel(model); }
        settle("MODEL"); return;
      }
      if (st < 200 || st >= 300) { settle("HTTP_" + st); return; }
      var data = null;
      try { data = JSON.parse(xhr.responseText); } catch (e) { settle("DECODE"); return; }
      var part = AWAAZ.pickAudio(data);
      if (!part) { settle("NO_AUDIO"); return; }
      var url;
      try {
        var wav = AWAAZ.wav(AWAAZ.b64(part.data), AWAAZ.rateOf(part.mimeType), 1, 16);
        url = URL.createObjectURL(new Blob([wav], { type: "audio/wav" }));
      } catch (e) { settle("DECODE"); return; }
      AWAAZ.model = model;
      AWAAZ.kfree(AWAAZ.ki);
      try { if (typeof settings === "object" && settings) { settings.ttsModel = model; saveSettings(); } } catch (e) {}
      AWAAZ.cachePut(key, url);
      settle(null, url);
    };
    try { xhr.send(JSON.stringify(body)); } catch (e) { drop(); settle("SEND"); }
  },

  /* ---------- ek url bajao ---------- */
  play: function (url, gen, onEnd, onErr) {
    var a;
    try { a = new Audio(); } catch (e) { onErr("AUDIO_BLOCKED"); return; }
    AWAAZ.audio = a;
    a.onended = function () { if (gen === AWAAZ.gen) onEnd(); };
    a.onerror = function () { if (gen === AWAAZ.gen) onErr("AUDIO_BLOCKED"); };
    a.src = url;
    var p;
    try { p = a.play(); } catch (e) { onErr("AUDIO_BLOCKED"); return; }
    if (p && p["catch"]) p["catch"](function () { if (gen === AWAAZ.gen) onErr("AUDIO_BLOCKED"); });
  },

  /* ═══ TIER 1 — Gemini neural (chunks + prefetch, is liye beech mein khamoshi nahi) ═══ */
  neural: function (text, onDone, onFail) {
    var gen = AWAAZ.gen;
    var voice = AWAAZ.voiceId(), mood = AWAAZ.moodId();
    var list = AWAAZ.chunkPlan(text);
    if (!list.length) { onDone(); return; }

    function grab(idx, cb) {
      var models = AWAAZ.modelOrder(), at = 0, keyTries = 0;
      function go() {
        var m = models[at];
        if (!m) { cb("MODEL"); return; }
        AWAAZ.fetchClip(list[idx], { voice: voice, mood: mood, model: m, prompt: AWAAZ.prompt(list[idx], mood) },
          function (url) { cb(null, url); },
          function (code) {
            /* quota/key ka masla? AGLI KEY par jao — 3 keys = 3 guna awaaz */
            if ((code === "QUOTA" || code === "QUOTA_DAY" || code === "KEY_BAD") && keyTries < AWAAZ.keyList().length - 1 && AWAAZ.nextKey()) {
              keyTries++; go(); return;
            }
            /* model ka masla? agla model — chahe koi model pehle chal chuka ho
               (purana `!AWAAZ.model` shart is fallback ko band kar deti thi) */
            if ((code === "MODEL" || code === "NO_AUDIO") && at + 1 < models.length) { at++; go(); return; }
            cb(code);
          });
      }
      go();
    }

    function step(idx) {
      if (gen !== AWAAZ.gen) return;
      if (idx >= list.length) { AWAAZ.spoke++; onDone(); return; }
      grab(idx, function (err, url) {
        if (gen !== AWAAZ.gen) return;
        if (err) { onFail(err); return; }
        if (idx + 1 < list.length) grab(idx + 1, function () {});    /* prefetch */
        AWAAZ.play(url, gen, function () { step(idx + 1); }, function (code) { onFail(code); });
      });
    }
    step(0);
  },

  /* ═══ TIER 0 — 🐟 FISH AUDIO (be-hisaab + MOOD zinda) ═══
     Ye Gemini se bhi PEHLE hai — sirf tab jab key mojood ho. Wajah: Gemini ka
     roz ka quota ~15 hai, Fish ka koi nahi; aur Fish andaaz (mood) bhi samajhta
     hai jo Edge par mar jata hai. Key na ho to ye teh khud ko skip kar deti hai. */
  fishReady: function () {
    try { return typeof FISH === "object" && FISH && FISH.ready(); } catch (e) { return false; }
  },
  fish: function (text, onDone, onFail) {
    if (typeof FISH !== "object" || !FISH) { onFail("MODEL"); return; }
    var gen = AWAAZ.gen;
    FISH.speak(text, AWAAZ.moodId(),
      function () { if (gen === AWAAZ.gen) { AWAAZ.fishSpoke++; onDone(); } },
      function (code) { if (gen === AWAAZ.gen) onFail(code || "NETWORK"); });
  },

  /* ═══ TIER 2 — EDGE TTS (muft, BE-HISAAB, asli Urdu awaaz) ═══
     Gemini ka roz ka quota ~15 request hai. Edge ka koi quota hi nahi. Is liye
     Edge ab Gemini ke foran baad bolta hai — muft-neural se pehle, robot se
     bohat pehle. Sharat sirf ek: Kotlin ka bridge maujood ho, kyunke browser
     mein Microsoft handshake rad kar deta hai aur wahan waqt zaya karna
     bewaqoofi hai (deikho EDGE_TTS ka header comment). */
  edgeReady: function () {
    try {
      if (typeof EDGE_TTS !== "object" || !EDGE_TTS) return false;
      if (EDGE_TTS.native()) return true;
      var s = (typeof settings === "object" && settings) ? settings : {};
      return s.voiceEngine === "edge";     /* browser mein sirf jab user khud kahe */
    } catch (e) { return false; }
  },
  edge: function (text, onDone, onFail) {
    if (typeof edgeTTS_speak !== "function") { onFail("MODEL"); return; }
    var gen = AWAAZ.gen;
    var s = (typeof settings === "object" && settings) ? settings : {};
    var v = EDGE_TTS.pick();
    AWAAZ.edgeVoiceUsed = v;
    var spoken = (typeof BOLI !== "undefined") ? BOLI.say(text, EDGE_TTS.langOf(v)) : text;
    edgeTTS_speak(spoken, v, EDGE_TTS.langOf(v), EDGE_TTS.rateStr(s.rate), EDGE_TTS.pitchStr(s.pitch),
      function () { if (gen === AWAAZ.gen) { AWAAZ.edgeSpoke++; onDone(); } },
      function (code) { if (gen === AWAAZ.gen) onFail(code || "NETWORK"); });
  },

  /* ═══ TIER 3 — phone ki apni awaaz (0 data, 0 latency, hamesha maujood) ═══ */
  device: function (text, onDone) {
    var gen = AWAAZ.gen;
    var s = (typeof settings === "object" && settings) ? settings : {};
    AWAAZ.deviceDone = function () { if (gen === AWAAZ.gen) { AWAAZ.deviceDone = null; onDone(); } };
    if (typeof NATIVE !== "undefined" && NATIVE && window.MayaBridge && window.MayaBridge.speak) {
      try { window.MayaBridge.speak(text, s.tts || "ur-PK", s.rate || 1, s.pitch || 1.05, s.voiceName || ""); return; }
      catch (e) { AWAAZ.deviceDone = null; onDone(); return; }
    }
    if (typeof synth === "undefined" || !synth) { AWAAZ.deviceDone = null; onDone(); return; }
    try { synth.cancel(); } catch (e) {}
    var u;
    try { u = new SpeechSynthesisUtterance(text); } catch (e) { AWAAZ.deviceDone = null; onDone(); return; }
    u.lang = s.tts || "ur-PK";
    try {
      if (s.voiceName && typeof voices !== "undefined") {
        for (var i = 0; i < voices.length; i++) if (voices[i].name === s.voiceName) { u.voice = voices[i]; u.lang = voices[i].lang; break; }
      } else if (typeof pickVoice === "function") { var pv = pickVoice(u.lang); if (pv) u.voice = pv; }
    } catch (e) {}
    u.rate = s.rate || 1; u.pitch = s.pitch || 1.05;
    u.onend = function () { if (gen === AWAAZ.gen) { AWAAZ.deviceDone = null; onDone(); } };
    u.onerror = function () { if (gen === AWAAZ.gen) { AWAAZ.deviceDone = null; onDone(); } };
    try { synth.speak(u); } catch (e) { AWAAZ.deviceDone = null; onDone(); }
  },

  /* ---------- nakami darj karo (chup-chaap fail MANA hai) ---------- */
  note: function (code) {
    AWAAZ.err = code || "";
    AWAAZ.errText = AWAAZ.why(code);
    if (code && typeof pushLog === "function") pushLog("AWAAZ: " + code + " — " + AWAAZ.errText);
    AWAAZ.paint();
  },
  setEngine: function (e) { AWAAZ.engine = e; AWAAZ.paint(); },

  /* ---------- badge + settings ka live status ---------- */
  paint: function () {
    try { if (typeof paintAwaaz === "function") paintAwaaz(); } catch (e) {}
  },

  /* ═══ WAHID DARWAZA ═══
     cb = { onStart:function(engine){}, onDone:function(){} } */
  speak: function (text, cb) {
    cb = cb || {};
    AWAAZ.stop();
    AWAAZ.gen++;
    var gen = AWAAZ.gen;
    var c = AWAAZ.cfg();
    text = String(text || "").trim();
    if (!text) { if (cb.onDone) cb.onDone(); return; }

    var finished = false;
    function done() {
      if (finished || gen !== AWAAZ.gen) return;
      finished = true;
      if (cb.onDone) cb.onDone();
    }
    function useDevice() {
      if (gen !== AWAAZ.gen) return;
      try { if (typeof pushLog === "function") pushLog("AWAAZ chain: device tier (on-phone TTS)"); } catch (e) {}
      AWAAZ.setEngine("device");
      if (cb.onStart) cb.onStart("device");
      AWAAZ.device(text, done);
    }

    if (!c.on || c.mode === "off") { AWAAZ.setEngine("off"); done(); return; }

    /* ─── SEERHI: 1) Gemini neural   2) EDGE (be-hisaab)   3) muft neural   4) phone ───
       Har teh apni nakami agli teh ko de deti hai — khamoshi kabhi nahi hoti.
       EDGE ab muft-neural se PEHLE hai: uska koi quota nahi, asli Urdu awaaz
       deta hai, aur Pollinations ke muqable bohat kam nakaam hota hai. */
    function usePollen(why) {
      if (gen !== AWAAZ.gen) return;
      try { if (why && typeof pushLog === "function") pushLog("AWAAZ chain: free-neural tier (" + why + ")"); } catch (e) {}
      if (Date.now() < AWAAZ.pollenBad || c.mode === "device") { useDevice(); return; }
      AWAAZ.setEngine("free");
      if (cb.onStart) cb.onStart("free");
      AWAAZ.pollen(text, done, function () { useDevice(); });
    }
    function useEdge(why) {
      if (gen !== AWAAZ.gen) return;
      try { if (why && typeof pushLog === "function") pushLog("AWAAZ chain: Edge tier (" + why + ")"); } catch (e) {}
      if (c.mode === "device" || !c.edge || !AWAAZ.edgeReady()) { usePollen(why); return; }
      AWAAZ.setEngine("edge");
      if (cb.onStart) cb.onStart("edge");
      AWAAZ.edge(text, done, function (code) {
        try { if (typeof pushLog === "function") pushLog("AWAAZ: Edge nakaam " + code + (EDGE_TTS.lastErr ? " — " + EDGE_TTS.lastErr : "")); } catch (e) {}
        usePollen(code || "EDGE_FAIL");
      });
    }

    /* 🐟 TEH 0 — Fish: be-hisaab, foran, aur MOOD samajhti hai */
    function useFish(next) {
      if (gen !== AWAAZ.gen) return;
      /* Issue 3 fast path (opt-in): short spoken replies go straight to
         Edge/device instead of waiting on a Fish Audio HTTP round-trip. */
      if (settings.fastShort === true && text.length <= 60) { next(); return; }
      if (c.mode === "device" || !c.fish || !AWAAZ.fishReady()) { next(); return; }
      AWAAZ.setEngine("fish");
      if (cb.onStart) cb.onStart("fish");
      AWAAZ.fish(text, done, function (code) {
        if (gen !== AWAAZ.gen) return;
        AWAAZ.fishErr = code;
        if (typeof pushLog === "function") pushLog("FISH: " + code + " — " + (FISH.lastErr || FISH.why(code)));
        next();
      });
    }

    /* Mode "edge" = Gemini ko haath hi mat lagao, uska roz ka quota bacha rahe */
    if (c.mode === "edge") { AWAAZ.note(""); useEdge("EDGE_MODE"); return; }

    /* Mode "fish" = sirf Fish, phir Edge — Gemini ka quota poora bacha rahe */
    if (c.mode === "fish") {
      AWAAZ.note("");
      useFish(function () { useEdge("FISH_MODE"); });
      return;
    }

    /* Gemini par jane se pehle bhi Fish ko mauqa — wo be-hisaab hai */
    function afterFish() {
      if (gen !== AWAAZ.gen) return;
      var block = AWAAZ.blockReason(text);
      if (block) {
        AWAAZ.note(block === "DEVICE_MODE" ? "" : block);
        /* sirf ye teen wajahen sach much neural rokti hain */
        if (block === "DEVICE_MODE" || block === "OFFLINE" || block === "MOBILE_DATA") { useDevice(); return; }
        useEdge(block);          /* KEY_MISSING / KEY_BAD / QUOTA / TOO_LONG -> EDGE, phir muft */
        return;
      }
      AWAAZ.note("");
      AWAAZ.setEngine("neural");
      if (cb.onStart) cb.onStart("neural");
      AWAAZ.neural(text, done, function (code) {
        if (gen !== AWAAZ.gen) return;
        AWAAZ.note(code);
        useEdge(code);
      });
    }
    useFish(afterFish);
    return;
  },

  /* ---------- sab kuch rok do ---------- */
  stop: function () {
    AWAAZ.gen++;
    AWAAZ.deviceDone = null;
    try { if (AWAAZ.audio) { AWAAZ.audio.pause(); AWAAZ.audio.onended = null; AWAAZ.audio.onerror = null; AWAAZ.audio = null; } } catch (e) {}
    for (var i = 0; i < AWAAZ.xhrs.length; i++) { try { AWAAZ.xhrs[i].abort(); } catch (e) {} }
    AWAAZ.xhrs = [];
    AWAAZ.flight = {};
    try { if (typeof edgeTTS_stop === "function") edgeTTS_stop(); } catch (e) {}
    try { if (typeof FISH === "object" && FISH) FISH.stop(); } catch (e) {}
    try { if (typeof NATIVE !== "undefined" && NATIVE && window.MayaBridge && window.MayaBridge.stopSpeak) window.MayaBridge.stopSpeak(); } catch (e) {}
    try { if (typeof synth !== "undefined" && synth) synth.cancel(); } catch (e) {}
  },

  /* ---------- Doctor / status ke liye ---------- */
  status: function () {
    var c = AWAAZ.cfg();
    var block = AWAAZ.blockReason("");
    return {
      engine: AWAAZ.engine,
      mode: c.mode,
      voice: AWAAZ.voiceId(),
      mood: AWAAZ.moodId(),
      model: AWAAZ.model || c.key ? (AWAAZ.model || "auto") : "-",
      ready: !block,
      block: block,
      why: AWAAZ.why(block || AWAAZ.err),
      err: AWAAZ.err,
      cache: AWAAZ.cache.length,
      cacheHits: AWAAZ.cacheHits,
      keys: AWAAZ.keyList().length,
      liveKeys: AWAAZ.liveKeys(),
      keyless: Date.now() >= AWAAZ.pollenBad,
      edgeOn: c.edge,
      edgeReady: AWAAZ.edgeReady(),
      edgeNative: (typeof EDGE_TTS === "object" && EDGE_TTS) ? EDGE_TTS.native() : false,
      edgeVoice: (typeof EDGE_TTS === "object" && EDGE_TTS) ? EDGE_TTS.pick() : "",
      edgeSpoke: AWAAZ.edgeSpoke,
      fish: (typeof FISH === "object" && FISH) ? FISH.status() : null,
      fishSpoke: AWAAZ.fishSpoke,
      cooldown: Math.max(0, Math.round((AWAAZ.cooldownUntil - Date.now()) / 1000))
    };
  },

  /* ═══════════════════════════════════════════════════════════════════════
     🩺 AWAAZ DOCTOR — "3 nayi keys lagayin, ek bhi nahi chali" ka jawab
     -----------------------------------------------------------------------
     Google ke do usool jo har banda pehli dafa mein pakda jata hai:

     1) QUOTA KEY PAR NAHI, **PROJECT PAR** LAGTA HAI.
        AI Studio mein "Create API key" teen dafa dabao to teenon keys aksar
        EK HI project mein banti hain — aur teenon EK HI quota pool se peeti
        hain. Is liye 3 nayi keys = wahi purana khatam quota. Faida sirf tab
        hai jab keys ALAG Google ACCOUNT (ya alag project) se banai jayen.

     2) 19 June 2026 se "unrestricted" keys Gemini par BLOCK hain.
        Cloud Console se bani key jispar API restriction nahi lagi, wo
        403/PERMISSION_DENIED deti hai — chahe abhi banai ho.

     Is liye ye Doctor har key ko DO dafa aazmata hai:
        a) ListModels  -> key khud zinda hai? (restriction/ghalat key pakadta hai)
        b) ek chhoti TTS request -> TTS ka quota bacha hai?
     Aur phir sab keys ke natije mila kar SAAF batata hai ke asal masla kya hai.
     Andaza nahi — Google ka apna jawab dikhata hai.
     ═══════════════════════════════════════════════════════════════════════ */

  /* GET: APK mein bridge (CORS nahi), warna XHR */
  get: function (url, key, cb) {
    if (typeof NATIVE !== "undefined" && NATIVE && window.MayaBridge && window.MayaBridge.httpGet) {
      var txt = "";
      try { txt = window.MayaBridge.httpGet(url + (url.indexOf("?") < 0 ? "?" : "&") + "key=" + encodeURIComponent(key), ""); }
      catch (e) { cb(0, ""); return; }
      cb(txt ? 200 : 0, txt || "");
      return;
    }
    var xhr = new XMLHttpRequest();
    try {
      xhr.open("GET", url, true);
      xhr.setRequestHeader("x-goog-api-key", key);
      xhr.timeout = 15000;
    } catch (e) { cb(0, ""); return; }
    xhr.ontimeout = function () { cb(0, "timeout"); };
    xhr.onerror = function () { cb(0, "network"); };
    xhr.onload = function () { cb(xhr.status, xhr.responseText || ""); };
    try { xhr.send(); } catch (e) { cb(0, "send"); }
  },

  /* Google ke jawab ka insani tarjuma */
  readErr: function (status, txt) {
    var msg = "";
    try { msg = String(JSON.parse(txt).error.message || ""); } catch (e) { msg = String(txt || "").slice(0, 200); }
    var low = msg.toLowerCase();
    var tag = "", fix = "";
    if (status === 0) { tag = "NET"; fix = "Internet ya firewall — request Google tak pahunchi hi nahi."; }
    else if (status >= 200 && status < 300) { tag = "OK"; }
    else if (/limit:\s*0/.test(low)) { tag = "LIMIT0"; fix = "Is project ka free quota ZERO hai. Google ab billing link kiye bagair kuch projects ko 0 deta hai. Alag Google ACCOUNT se nayi key banao."; }
    else if (/api key not valid|invalid api key|api_key_invalid/.test(low)) { tag = "BADKEY"; fix = "Key ghalat likhi gayi ya delete ho chuki hai. Dobara copy karo (aage/peeche space na ho)."; }
    else if (/permission|restrict|blocked|forbidden|consumer/.test(low) || status === 403) { tag = "RESTRICT"; fix = "19 June 2026 se Google 'unrestricted' keys block karta hai. Cloud Console -> Credentials -> is key par API restriction = 'Generative Language API' laga do. Ya AI Studio se nayi key banao."; }
    else if (/per day|daily|exhaust/.test(low)) { tag = "DAYQUOTA"; fix = "Aaj ka quota khatam (Gemini TTS free tier ~15 request ROZ). Pacific midnight par reset hota hai."; }
    else if (status === 429 || /quota|rate/.test(low)) { tag = "QUOTA"; fix = "Quota khatam ya bohat tez requests. Yaad rahe: quota KEY par nahi, PROJECT par lagta hai."; }
    else if (status === 404 || /not found|not supported/.test(low)) { tag = "MODEL"; fix = "Ye TTS model is key par maujood nahi. MAYA khud doosra model dhoondegi."; }
    else if (status >= 500) { tag = "SERVER"; fix = "Google ka apna server masla — thori der baad."; }
    else { tag = "HTTP_" + status; fix = ""; }
    return { tag: tag, status: status, msg: msg.slice(0, 160), fix: fix };
  },

  /* zinda TTS model dhoondo (naam badal jaye to bhi app na mare) */
  findTtsModels: function (key, cb) {
    AWAAZ.get("https://generativelanguage.googleapis.com/v1beta/models", key, function (st, txt) {
      if (st < 200 || st >= 300) { cb(null, AWAAZ.readErr(st, txt)); return; }
      var j = null; try { j = JSON.parse(txt); } catch (e) {}
      var arr = (j && j.models) || [], out = [], i;
      for (i = 0; i < arr.length; i++) {
        var nm = String(arr[i].name || "").replace(/^models\//, "");
        if (/tts/i.test(nm)) out.push(nm);
      }
      cb(out, null);
    });
  },

  /* ek key ka poora muaina */
  probeKey: function (key, cb) {
    var r = { key: key, tail: key.slice(-6), list: null, tts: null, models: [] };
    AWAAZ.findTtsModels(key, function (models, err) {
      if (err) { r.list = err; cb(r); return; }
      r.list = { tag: "OK", status: 200, msg: "", fix: "" };
      r.models = models || [];
      var model = r.models[0] || AWAAZ.MODELS[0];
      r.model = model;
      var body = JSON.stringify({
        contents: [{ parts: [{ text: "Salam" }] }],
        generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } } }
      });
      AWAAZ.postKeyed(AWAAZ.API + encodeURIComponent(model) + ":generateContent", key, body, 20000, function (st, txt) {
        r.tts = AWAAZ.readErr(st, txt);
        cb(r);
      });
    });
  },

  /* key wala POST — APK mein bridge se (CORS bilkul nahi) */
  postKeyed: function (url, key, body, timeoutMs, cb) {
    if (typeof NATIVE !== "undefined" && NATIVE && window.MayaBridge && window.MayaBridge.httpPostAsync && typeof BRAIN !== "undefined") {
      BRAIN.post(url + (url.indexOf("?") < 0 ? "?" : "&") + "key=" + encodeURIComponent(key), "", body, timeoutMs, cb);
      return;
    }
    var done = false, xhr = new XMLHttpRequest();
    function fin(st, t) { if (!done) { done = true; cb(st, t); } }
    try {
      xhr.open("POST", url, true);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.setRequestHeader("x-goog-api-key", key);
      xhr.timeout = timeoutMs;
    } catch (e) { fin(0, "open"); return; }
    xhr.ontimeout = function () { fin(0, "timeout"); };
    xhr.onerror = function () { fin(0, "network"); };
    xhr.onload = function () { fin(xhr.status, xhr.responseText || ""); };
    try { xhr.send(body); } catch (e) { fin(0, "send"); }
  },

  /* SAB keys ka muaina + ek saaf faisla */
  doctor: function (onLine, onDone) {
    var keys = AWAAZ.keyList();
    if (!keys.length) { onDone({ rows: [], verdict: "NOKEY", text: "Koi Gemini key hi nahi lagi." }); return; }
    var rows = [], i = 0;
    function next() {
      if (i >= keys.length) { onDone(AWAAZ.verdict(rows)); return; }
      onLine("🔍 KEY " + (i + 1) + "/" + keys.length + " (…" + keys[i].slice(-6) + ") check ho rahi hai…");
      AWAAZ.probeKey(keys[i], function (r) {
        r.n = i + 1;
        rows.push(r);
        onLine(AWAAZ.rowText(r));
        i++; next();
      });
    }
    next();
  },

  rowText: function (r) {
    var L = [];
    L.push("");
    L.push("━━━ KEY " + r.n + "  (…" + r.tail + ") ━━━");
    if (r.list.tag !== "OK") {
      L.push("  Key khud   : ❌ " + r.list.tag + (r.list.status ? " (" + r.list.status + ")" : ""));
      if (r.list.msg) L.push("               " + r.list.msg);
      if (r.list.fix) L.push("  ➜ " + r.list.fix);
      return L.join("\n");
    }
    L.push("  Key khud   : ✅ zinda — Google ne " + r.models.length + " TTS model dikhaye");
    if (r.tts.tag === "OK") L.push("  TTS        : ✅ CHAL RAHI HAI (" + r.model + ")");
    else {
      L.push("  TTS        : ❌ " + r.tts.tag + " (" + r.tts.status + ") — " + r.model);
      if (r.tts.msg) L.push("               " + r.tts.msg);
      if (r.tts.fix) L.push("  ➜ " + r.tts.fix);
    }
    return L.join("\n");
  },

  /* sab natije mila kar ASAL masle ka naam */
  verdict: function (rows) {
    var ok = [], i, tags = {}, ttsTags = {};
    for (i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (r.list.tag === "OK" && r.tts && r.tts.tag === "OK") ok.push(r.n);
      tags[r.list.tag] = (tags[r.list.tag] || 0) + 1;
      if (r.tts) ttsTags[r.tts.tag] = (ttsTags[r.tts.tag] || 0) + 1;
    }
    var out = [], v = "";
    out.push("");
    out.push("═══════════ FAISLA ═══════════");
    if (ok.length) {
      v = "OK";
      out.push("✅ " + ok.length + "/" + rows.length + " key CHAL RAHI HAI (key " + ok.join(", ") + ").");
      out.push("   Gemini ki asli awaaz tayyar hai.");
    } else if (tags.RESTRICT || ttsTags.RESTRICT) {
      v = "RESTRICT";
      out.push("🔒 ASAL MASLA: KEY PAR RESTRICTION NAHI LAGI.");
      out.push("   19 June 2026 se Google un keys ko block karta hai jinpar");
      out.push("   API restriction set nahi. Nayi key bhi isi liye nahi chalti.");
      out.push("");
      out.push("   ILAJ (2 minute):");
      out.push("   • Key AI STUDIO se banao: aistudio.google.com/apikey");
      out.push("     (wahan se bani keys khud restricted hoti hain)");
      out.push("   • Ya Cloud Console → Credentials → key → API restrictions");
      out.push("     → 'Restrict key' → Generative Language API");
    } else if (tags.BADKEY) {
      v = "BADKEY";
      out.push("✍️ ASAL MASLA: KEY THEEK SE COPY NAHI HUI.");
      out.push("   Google keh raha hai 'API key not valid'.");
      out.push("   Poori key copy karo — 'AIza' se shuru hoti hai, ~39 harf.");
    } else if (ttsTags.LIMIT0 || tags.LIMIT0) {
      v = "LIMIT0";
      out.push("🚫 ASAL MASLA: IS PROJECT KA FREE QUOTA **ZERO** HAI.");
      out.push("   Google ne is project ko free tier diya hi nahi (limit: 0).");
      out.push("   Nayi keys banane se kuch nahi hoga — wo bhi isi project ki hain.");
      out.push("");
      out.push("   ILAJ: BILKUL ALAG GOOGLE ACCOUNT se sign-in kar ke");
      out.push("   aistudio.google.com/apikey se nayi key banao.");
    } else if (rows.length > 1 && (ttsTags.QUOTA || ttsTags.DAYQUOTA) === rows.length) {
      v = "SAMEPROJECT";
      out.push("🎯 ASAL MASLA: AAP KI SAB KEYS EK HI PROJECT KI HAIN.");
      out.push("");
      out.push("   Google ka quota KEY par nahi, **PROJECT** par lagta hai.");
      out.push("   AI Studio mein 'Create API key' baar baar dabane se sab keys");
      out.push("   EK HI project mein banti hain — aur ek hi quota pool se peeti hain.");
      out.push("   Is liye " + rows.length + " nayi keys = wahi purana khatam quota.");
      out.push("");
      out.push("   ILAJ (yehi kaam karta hai):");
      out.push("   • Har key ALAG GOOGLE ACCOUNT se banao (Gmail badal kar),");
      out.push("     aistudio.google.com/apikey — har account = apna quota.");
      out.push("   • Ya AI Studio mein 'Create API key in new project' chuno.");
      out.push("");
      out.push("   Tab tak 🌸 MUFT NEURAL awaaz chalti rahegi — bina kisi key ke.");
    } else if (ttsTags.DAYQUOTA || ttsTags.QUOTA) {
      v = "QUOTA";
      out.push("⏳ ASAL MASLA: TTS KA QUOTA KHATAM HAI (key theek hai).");
      out.push("   Gemini TTS free tier sirf ~15 request ROZ deta hai.");
      out.push("   Pacific midnight (PK time ~12:00 din) par reset hota hai.");
      out.push("");
      out.push("   ILAJ: kisi ALAG Google account se ek aur key bana kar");
      out.push("   isi khane mein comma laga kar daal do.");
      out.push("   Tab tak 🌸 MUFT NEURAL awaaz chalti rahegi.");
    } else if (tags.NET || (rows[0] && rows[0].tts && rows[0].tts.tag === "NET")) {
      v = "NET";
      out.push("📡 ASAL MASLA: REQUEST GOOGLE TAK PAHUNCH HI NAHI RAHI.");
      out.push("   Internet, DNS ya firewall dekho.");
    } else {
      v = "OTHER";
      out.push("❔ Google ka jawab upar likha hai — wahi asal wajah hai.");
    }
    out.push("");
    out.push("🌸 Yaad rahe: chahe koi Gemini key na chale, MAYA phir bhi");
    out.push("   MUFT NEURAL awaaz se bolti hai — aap kabhi khamosh nahi rahenge.");
    var head = ["🩺 AWAAZ DOCTOR — " + rows.length + " key ka muaina"];
    return { rows: rows, verdict: v, text: head.concat(rows.map(AWAAZ.rowText)).concat(out).join("\n") };
  },

  /* Settings/Doctor ke liye har TTS key ka haal */
  keyReport: function () {
    var L = AWAAZ.keyList(), out = [], i;
    for (i = 0; i < L.length; i++) {
      var st = AWAAZ.kst(i), c = Math.max(0, st.cool - Date.now());
      out.push({ i: i + 1, state: c > 0 ? (st.why || "COOL") : "LIVE", cool: Math.round(c / 1000), now: i === AWAAZ.ki });
    }
    return out;
  }
};
AWAAZ.restore();   /* pichhli dafa ka quota/cooldown yaad karo */

/* Boot par Microsoft se poori live awaaz list — sirf APK mein, background mein */
setTimeout(function () {
  try {
    if (typeof EDGE_TTS === "object" && EDGE_TTS && EDGE_TTS.native()) {
      EDGE_TTS.refresh(function (L) {
        if (L && typeof edgeFillVoices === "function") edgeFillVoices();
      });
    }
  } catch (e) {}
}, 2500);


/* Kotlin ka TTS-done callback ab engine ko jata hai */
/* v5.9.5: purani doosri __nativeTtsDone definition HATAI gayi — ye upar wali (line ~1443) ko overwrite kar deti thi aur SUKOON/afterSpeak kabhi nahi chalte the. Ek hi unified handler ab sab karta hai. */

/* purane naam zinda rahen (baqi code inhen call karta hai) */
function geminiTTS_stop() { AWAAZ.stop(); }

