/* ═══════════════════════════════════════════════════════════════════════════
   🎙️  SUNO  —  MAYA aap ki AWAAZ theek samjhe                  (app v5.9.5)
   ---------------------------------------------------------------------------
   ASAL MASLA (aap ki apni chat se):

     aap bole "Funk Taka"      ->  Maya ne suna  "اس لاوا فنک" / "سوری فنک"
     aap bole "Monarch"        ->  Maya ne suna  "موناک" / "منار" / "منا"
     aap bole "reels kholo"    ->  Maya ne suna  "ریلز کھولو"

   Do alag alag kharabiyan thin:

   1. LIKHAWAT — STT ki zubaan `ur-PK` hai, is liye jawab URDU SCRIPT mein
      aata hai. Aap Roman Urdu mein baat karte hain, to chat mein Roman Urdu
      hi likha jana chahiye.

   2. PEHCHAN — English naam (Monarch, Funk Taka, Instagram) Urdu ki awaaz
      mein pis jate hain. Aur Kotlin sirf PEHLA andaza leta tha — Android
      asal mein 3-5 andaze deta hai, baqi phenk diye jate the.

   ILAJ (teen tehen):
     A. Android ke SAARE andaze lo, aur wo chuno jismein sab se zyada
        JAANE-PEHCHANE naam hon.
     B. Urdu script -> Roman Urdu (lafz ki lughat pehle, phir harf ba harf).
     C. Jo naam phir bhi pis gaye, unhen LUGHAT se milaa kar theek karo
        (Monarch / WhatsApp / Instagram / app ke naam / jo aap pehle bol chuke).
   ═══════════════════════════════════════════════════════════════════════════ */
var SUNO = {
  KEY: "maya_suno",

  /* ─── B1. Aam Urdu lafz -> Roman (harf-ba-harf se pehle yehi chalta hai) ─── */
  WORD: {
    "\u06A9\u0631\u0648": "karo", "\u06A9\u0631\u0646\u0627": "karna", "\u06A9\u0631": "kar",
    "\u06C1\u06D2": "hai", "\u06C1\u06CC\u06BA": "hain", "\u06C1\u0648": "ho", "\u06C1\u0648\u06BA": "hoon",
    "\u0645\u06CC\u06BA": "mein", "\u0645\u062C\u06BE\u06D2": "mujhe", "\u0645\u06CC\u0631\u0627": "mera", "\u0645\u06CC\u0631\u06CC": "meri",
    "\u062A\u0645": "tum", "\u062A\u0645\u06C1\u06CC\u06BA": "tumhein", "\u0622\u067E": "aap", "\u0622\u067E\u06A9\u0648": "aapko",
    "\u067E\u0631": "par", "\u06A9\u0648": "ko", "\u0633\u06D2": "se", "\u06A9\u0627": "ka", "\u06A9\u06CC": "ki", "\u06A9\u06D2": "ke",
    "\u0646\u06C1\u06CC\u06BA": "nahi", "\u0646\u06C1": "na", "\u06C1\u0627\u06BA": "haan", "\u062C\u06CC": "ji",
    "\u0627\u0628": "ab", "\u067E\u06BE\u0631": "phir", "\u0627\u0648\u0631": "aur", "\u06CC\u0627": "ya",
    "\u062C\u0627\u0624": "jao", "\u062C\u0627": "ja", "\u062C\u0627\u06A9\u06D2": "jaake",
    "\u0628\u06BE\u06CC\u062C\u0648": "bhejo", "\u0628\u06BE\u06CC\u062C": "bhej", "\u0628\u06BE\u06CC\u062C\u0646\u0627": "bhejna",
    "\u06A9\u06BE\u0648\u0644\u0648": "kholo", "\u06A9\u06BE\u0648\u0644": "khol", "\u06A9\u06BE\u0644\u06CC": "khuli",
    "\u0644\u06AF\u0627\u0624": "lagao", "\u0644\u06AF\u0627": "laga", "\u062F\u0648": "do", "\u062F\u06D2": "de",
    "\u0628\u062A\u0627\u0624": "batao", "\u0628\u0648\u0644\u0648": "bolo", "\u0633\u0646\u0648": "suno", "\u062F\u06CC\u06A9\u06BE\u0648": "dekho",
    "\u06CC\u06C1": "ye", "\u0648\u06C1": "wo", "\u06A9\u06CC\u0627": "kya", "\u06A9\u06CC\u0648\u06BA": "kyun",
    "\u06A9\u06C1\u0627\u06BA": "kahan", "\u06A9\u0648\u0646": "kaun", "\u06A9\u0628": "kab", "\u06A9\u06CC\u0633\u06D2": "kaise",
    "\u06A9\u062A\u0646\u0627": "kitna", "\u0627\u0686\u06BE\u0627": "acha", "\u0679\u06BE\u06CC\u06A9": "theek",
    "\u0686\u0644\u0648": "chalo", "\u062A\u06BE\u0627": "tha", "\u062A\u06BE\u06CC": "thi",
    "\u06AF\u06CC\u0627": "gaya", "\u06AF\u0626\u06CC": "gayi", "\u0631\u06C1\u0627": "raha", "\u0631\u06C1\u06CC": "rahi",
    "\u0644\u0646\u06A9": "link", "\u0645\u06CC\u0633\u062C": "message", "\u0633\u0648\u0646\u06AF": "song",
    "\u0648\u06CC\u0688\u06CC\u0648": "video", "\u0646\u0645\u0628\u0631": "number", "\u0646\u0627\u0645": "naam",
    "\u0635\u0631\u0641": "sirf", "\u0633\u0628": "sab", "\u0627\u0628\u06BE\u06CC": "abhi", "\u0628\u0639\u062F": "baad",
    "\u067E\u06C1\u0644\u06D2": "pehle", "\u0633\u0627\u062A\u06BE": "sath", "\u0628\u06BE\u06CC": "bhi", "\u0628\u0633": "bas",
    "\u0648\u0627\u0644\u0627": "wala", "\u0648\u0627\u0644\u06CC": "wali", "\u0633\u0648\u0631\u06CC": "sorry",
    "\u0679\u06BE\u06CC\u06A9 \u06C1\u06D2": "theek hai", "\u06C1\u0627\u0626\u06D2": "hi", "\u06C1\u0627\u0626\u06CC": "hi",
    "\u0633\u06CC\u0648": "save", "\u0633\u06CC\u0648 \u06C1\u06D2": "save hai",
    /* app aur brand — Urdu likhawat mein */
    "\u0648\u0627\u0679\u0633 \u0627\u06CC\u067E": "WhatsApp", "\u0648\u0627\u0679\u0633\u0627\u06CC\u067E": "WhatsApp",
    "\u06CC\u0648\u0679\u06CC\u0648\u0628": "YouTube", "\u0627\u0646\u0633\u0679\u0627\u06AF\u0631\u0627\u0645": "Instagram",
    "\u0679\u06CC\u0644\u06CC\u06AF\u0631\u0627\u0645": "Telegram", "\u0641\u06CC\u0633 \u0628\u06A9": "Facebook",
    "\u062C\u06CC \u0645\u06CC\u0644": "Gmail", "\u06A9\u0631\u0648\u0645": "Chrome",
    "\u067E\u0644\u06D2 \u0627\u0633\u0679\u0648\u0631": "Play Store", "\u0631\u06CC\u0644\u0632": "reels",
    "\u06AF\u0648\u06AF\u0644": "Google", "\u0645\u0627\u06CC\u0627": "Maya"
  },

  /* ─── B2. Harf ba harf (jab lafz lughat mein na ho) ─── */
  PAIR: [
    ["\u0628\u06BE", "bh"], ["\u067E\u06BE", "ph"], ["\u062A\u06BE", "th"], ["\u0679\u06BE", "th"],
    ["\u062C\u06BE", "jh"], ["\u0686\u06BE", "chh"], ["\u062F\u06BE", "dh"], ["\u0688\u06BE", "dh"],
    ["\u0691\u06BE", "rh"], ["\u06A9\u06BE", "kh"], ["\u06AF\u06BE", "gh"], ["\u0644\u06BE", "lh"],
    ["\u0645\u06BE", "mh"], ["\u0646\u06BE", "nh"], ["\u0631\u06BE", "rh"]
  ],
  CH: {
    "\u0622": "aa", "\u0627": "a", "\u0623": "a", "\u0625": "i", "\u0628": "b", "\u067E": "p",
    "\u062A": "t", "\u0679": "t", "\u062B": "s", "\u062C": "j", "\u0686": "ch", "\u062D": "h",
    "\u062E": "kh", "\u062F": "d", "\u0688": "d", "\u0630": "z", "\u0631": "r", "\u0691": "r",
    "\u0632": "z", "\u0698": "zh", "\u0633": "s", "\u0634": "sh", "\u0635": "s", "\u0636": "z",
    "\u0637": "t", "\u0638": "z", "\u0639": "a", "\u063A": "gh", "\u0641": "f", "\u0642": "q",
    "\u06A9": "k", "\u0643": "k", "\u06AF": "g", "\u0644": "l", "\u0645": "m", "\u0646": "n",
    "\u06BA": "n", "\u06C1": "h", "\u06C3": "h", "\u0647": "h", "\u06BE": "h", "\u0621": "",
    "\u06CC": "i", "\u064A": "i", "\u0626": "y", "\u06D2": "e", "\u0648": "o", "\u0624": "o",
    "\u06C0": "h", "\u0640": ""
  },
  DIA: /[\u064B-\u065F\u0670\u06D6-\u06ED]/g,

  isUrdu: function (t) { return /[\u0600-\u06FF]/.test(String(t || "")); },

  romanWord: function (w) {
    var s = String(w || "").replace(SUNO.DIA, "");
    if (!s) return "";
    if (SUNO.WORD[s]) return SUNO.WORD[s];
    var out = "", i = 0, two, c;
    while (i < s.length) {
      two = s.substr(i, 2);
      var hit = null, j;
      for (j = 0; j < SUNO.PAIR.length; j++) if (SUNO.PAIR[j][0] === two) { hit = SUNO.PAIR[j][1]; break; }
      if (hit !== null) { out += hit; i += 2; continue; }
      c = s.charAt(i);
      out += (SUNO.CH[c] !== undefined) ? SUNO.CH[c] : c;
      i++;
    }
    return out;
  },

  /* Urdu script -> Roman Urdu (lafz ke lafz) */
  roman: function (t) {
    var s = String(t || "");
    if (!SUNO.isUrdu(s)) return s;
    /* pehle do-lafzi naam (waats app -> WhatsApp) */
    var k;
    for (k in SUNO.WORD) {
      if (!Object.prototype.hasOwnProperty.call(SUNO.WORD, k)) continue;
      if (k.indexOf(" ") < 0) continue;
      s = s.split(k).join(" " + SUNO.WORD[k] + " ");
    }
    var parts = s.split(/(\s+)/), out = [], i;
    for (i = 0; i < parts.length; i++) {
      out.push(/^\s+$/.test(parts[i]) ? " " : SUNO.romanWord(parts[i]));
    }
    return out.join("").replace(/\s+/g, " ").trim();
  },

  /* ─── C. LUGHAT — jaane pehchane naam ─── */
  BRAND: ["monarch", "whatsapp", "youtube", "instagram", "telegram", "facebook", "gmail",
          "chrome", "google", "maps", "playstore", "play store", "spotify", "netflix",
          "snapchat", "twitter", "tiktok", "daraz", "messenger", "reels", "mrbeast",
          "maya", "gemini", "settings", "download", "search", "share", "status"],
  seen: null,
  load: function () {
    if (SUNO.seen) return SUNO.seen;
    var out = [];
    try {
      var d = JSON.parse(localStorage.getItem(SUNO.KEY) || "[]");
      if (d && d.length) out = d;
    } catch (e) {}
    SUNO.seen = out;
    return out;
  },
  /* jo naam aap khud Roman mein likh chuke, wo hamesha ke liye yaad */
  learn: function (t) {
    var s = String(t || ""), m = s.match(/[A-Za-z][A-Za-z'.-]{3,20}/g), i, w, L = SUNO.load(), added = 0;
    if (!m) return 0;
    for (i = 0; i < m.length; i++) {
      w = m[i].toLowerCase();
      if (w.length < 4) continue;
      if (SUNO.STOP[w]) continue;
      if (SUNO.BRAND.indexOf(w) >= 0) continue;
      if (L.indexOf(w) >= 0) continue;
      L.push(w); added++;
      if (L.length > 120) L.shift();
    }
    if (added) { SUNO.seen = L; try { localStorage.setItem(SUNO.KEY, JSON.stringify(L)); } catch (e) {} }
    return added;
  },
  STOP: { "karo": 1, "kholo": 1, "bhejo": 1, "lagao": 1, "chalo": 1, "theek": 1, "nahi": 1, "hain": 1,
          "mein": 1, "abhi": 1, "batao": 1, "dekho": 1, "kaise": 1, "kitna": 1, "acha": 1, "haan": 1,
          "song": 1, "link": 1, "message": 1, "video": 1, "number": 1, "naam": 1, "phir": 1, "wala": 1,
          "sorry": 1, "please": 1, "thanks": 1, "hello": 1, "kaun": 1, "kyun": 1, "kahan": 1 },
  lex: function () { return SUNO.BRAND.concat(SUNO.load()); },

  dist: function (a, b) {
    a = String(a); b = String(b);
    var m = a.length, n = b.length, i, j, prev, cur, tmp;
    if (!m) return n;
    if (!n) return m;
    prev = [];
    for (j = 0; j <= n; j++) prev[j] = j;
    for (i = 1; i <= m; i++) {
      cur = [i];
      for (j = 1; j <= n; j++) {
        tmp = (a.charAt(i - 1) === b.charAt(j - 1)) ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + tmp);
      }
      prev = cur;
    }
    return prev[n];
  },

  /* ek lafz ko lughat se milaao (Monarch/Instagram waghera) */
  fixWord: function (w) {
    var s = String(w || ""), low = s.toLowerCase();
    if (low.length < 4) return s;
    if (SUNO.STOP[low]) return s;
    var L = SUNO.lex(), i, best = "", bs = 0, d, sc;
    for (i = 0; i < L.length; i++) {
      /* 4 harf ke lafz (maya/maps) bohat aasani se jeet jate hain aur lambe
         naam (monarch) haar jate hain — is liye chhote lafz nishana nahi bante */
      if (L[i].length < 5) { if (L[i] !== low) continue; }
      if (L[i].charAt(0) !== low.charAt(0)) continue;      /* pehla harf milna chahiye */
      if (L[i] === low) return SUNO.cap(L[i]);
      d = SUNO.dist(low, L[i]);
      sc = 1 - (d / Math.max(low.length, L[i].length));
      if (sc > bs) { bs = sc; best = L[i]; }
    }
    return (bs >= 0.5) ? SUNO.cap(best) : s;
  },
  cap: function (w) {
    var s = String(w || "");
    if (SUNO.BRAND.indexOf(s) < 0) return s;
    if (s === "whatsapp") return "WhatsApp";
    if (s === "youtube") return "YouTube";
    if (s === "mrbeast") return "MrBeast";
    if (s === "play store" || s === "playstore") return "Play Store";
    return s.charAt(0).toUpperCase() + s.slice(1);
  },
  fix: function (t) {
    var parts = String(t || "").split(/(\s+)/), out = [], i;
    for (i = 0; i < parts.length; i++) {
      out.push(/^\s*$/.test(parts[i]) ? parts[i] : SUNO.fixWord(parts[i]));
    }
    return out.join("");
  },

  /* ─── A. Android ke SAARE andazon mein se behtareen chuno ─── */
  score: function (t) {
    var r = SUNO.fix(SUNO.roman(t)).toLowerCase(), L = SUNO.lex(), i, n = 0;
    for (i = 0; i < L.length; i++) if (r.indexOf(L[i]) >= 0) n += L[i].length;
    return n;
  },
  /* Android ke andaze ab { t: "matn", c: 0.87 } ki shakl mein aate hain.
     Purani APK sirf matn bhejti thi — dono chalni chahiyen (Qanoon 2). */
  norm: function (alts) {
    var out = [], i, a;
    for (i = 0; i < (alts || []).length; i++) {
      a = alts[i];
      if (a === null || a === undefined) continue;
      if (typeof a === "string") out.push({ t: a, c: -1 });
      else out.push({ t: String(a.t || ""), c: (typeof a.c === "number") ? a.c : -1 });
    }
    return out;
  },
  lastConf: -1,

  /* behtareen andaza = jaane-pehchane naam (lexicon) + Android ka yaqeen */
  pick: function (alts) {
    var L = SUNO.norm(alts);
    if (!L.length) return "";
    var best = L[0], bs = -1e9, i, sc;
    for (i = 0; i < L.length && i < 6; i++) {
      if (!L[i].t) continue;
      sc = SUNO.score(L[i].t) * 10;                 /* naam sab se ahem */
      if (L[i].c >= 0) sc += L[i].c * 25;           /* phir Android ka yaqeen */
      sc -= i;                                      /* barabar ho to pehla jeete */
      if (sc > bs) { bs = sc; best = L[i]; }
    }
    SUNO.lastConf = best.c;
    return best.t;
  },
  /* kam yaqeen? ghalat kaam karne se behtar hai poochh lena */
  weak: function () { return SUNO.lastConf >= 0 && SUNO.lastConf < 0.35; },

  /* ═══ WAHID DARWAZA: Android ke andaze andar, saaf Roman Urdu bahar ═══ */
  heard: function (alts) {
    var list = (typeof alts === "string") ? [{ t: alts, c: -1 }] : (alts || []);
    var raw = SUNO.pick(list);
    if (!FLAGS.on("suno")) return raw;
    var out = SUNO.fix(SUNO.roman(raw));
    SUNO.last = { raw: raw, out: out, alts: list.length };
    return out;
  },
  last: null
};

