/* ═══════════════════════════════════════════════════════════════════════════
   🎙️  AWAAZ ENGINE v6  —  MAYA ki awaaz ka WAHID rasta   (app v4.2.0)
   ---------------------------------------------------------------------------
   Kyun bana: purana code 4 adhoore TTS raste chala raha tha, Gemini ka raw PCM
   bina WAV header ke <audio> ko deta tha (isi liye neural awaaz kabhi bolti hi
   nahi thi), ek third-party TTS CORS se red error deta tha, aur ek TTS function
   call to hota tha magar kahin define hi nahi tha.
   Ab: EK darwaza -> AWAAZ.speak(). Har nakami ka NAAM. Khamoshi kabhi nahi.
   Tiers:  1) 🎭 Gemini TTS   2) 🌊 Edge TTS (optional)   3) 📱 Device TTS
   Tafseel: docs/AWAAZ-ENGINE-ARCHITECTURE.md
   ═══════════════════════════════════════════════════════════════════════════ */

/* 30 Gemini prebuilt awaazein  (g: f = zanana, m = mardana) */
var GEMINI_VOICES = [
  { id:"Kore",         g:"f", label:"🌸 Kore — garam aur pyari" },
  { id:"Zephyr",       g:"f", label:"☀️ Zephyr — roshan, khush-mizaj" },
  { id:"Leda",         g:"f", label:"🌿 Leda — narm, jawan" },
  { id:"Aoede",        g:"f", label:"🎶 Aoede — halki, behti hui" },
  { id:"Autonoe",      g:"f", label:"💫 Autonoe — chamakdar" },
  { id:"Callirrhoe",   g:"f", label:"🕊️ Callirrhoe — sukoon bhari" },
  { id:"Despina",      g:"f", label:"🍃 Despina — hamwaar, aaram-deh" },
  { id:"Erinome",      g:"f", label:"🔷 Erinome — saaf aur seedhi" },
  { id:"Gacrux",       g:"f", label:"🎓 Gacrux — thehri, tajarba-kaar" },
  { id:"Laomedeia",    g:"f", label:"🎉 Laomedeia — chulbuli" },
  { id:"Pulcherrima",  g:"f", label:"💃 Pulcherrima — jazbaati" },
  { id:"Sulafat",      g:"f", label:"🔥 Sulafat — garam-josh" },
  { id:"Vindemiatrix", g:"f", label:"🤍 Vindemiatrix — meharban" },
  { id:"Achernar",     g:"f", label:"🌙 Achernar — bohat narm" },
  { id:"Puck",         g:"m", label:"🎭 Puck — shararti, upbeat" },
  { id:"Charon",       g:"m", label:"📖 Charon — pur-sukoon, malumati" },
  { id:"Fenrir",       g:"m", label:"⚡ Fenrir — josheela" },
  { id:"Orus",         g:"m", label:"🏛️ Orus — mazboot, ba-raob" },
  { id:"Enceladus",    g:"m", label:"🌬️ Enceladus — sargoshi jaisi" },
  { id:"Iapetus",      g:"m", label:"💎 Iapetus — saaf, khanakti" },
  { id:"Umbriel",      g:"m", label:"😌 Umbriel — bay-fikr" },
  { id:"Algieba",      g:"m", label:"🎩 Algieba — hamwaar, shaista" },
  { id:"Algenib",      g:"m", label:"🪨 Algenib — bhari, khurdri" },
  { id:"Rasalgethi",   g:"m", label:"🧠 Rasalgethi — ilmi" },
  { id:"Achird",       g:"m", label:"🤝 Achird — dostana" },
  { id:"Schedar",      g:"m", label:"⚖️ Schedar — thehra hua" },
  { id:"Alnilam",      g:"m", label:"🎯 Alnilam — pur-aetmaad" },
  { id:"Sadaltager",   g:"m", label:"📚 Sadaltager — sanjeeda" },
  { id:"Sadachbia",    g:"m", label:"✨ Sadachbia — zinda-dil" },
  { id:"Zubenelgenubi",g:"m", label:"🗣️ Zubenelgenubi — aam bol-chaal" }
];

/* Mood = Gemini ko diya jane wala andaaz ka hukm (yahi "mazedar awaaz" ka raaz hai) */
var VOICE_MOODS = [
  { id:"auto",     label:"🪄 Auto — persona ke mutabiq", p:"" },
  { id:"warm",     label:"🤗 Warm — pyar bhari",         p:"Say this warmly and affectionately, like a close friend who cares" },
  { id:"cheerful", label:"😄 Cheerful — khush",          p:"Say this cheerfully, with a bright smile in your voice" },
  { id:"calm",     label:"😌 Calm — pur-sukoon",         p:"Say this calmly and softly, at a relaxed pace" },
  { id:"pro",      label:"💼 Pro — professional",        p:"Say this in a crisp, confident, professional tone" },
  { id:"hype",     label:"🔥 Hype — josheela",           p:"Say this with high energy and excitement" },
  { id:"whisper",  label:"🤫 Whisper — sargoshi",        p:"Whisper this softly and gently" },
  { id:"news",     label:"📰 News — anchor",             p:"Read this clearly like a professional news anchor" },
  { id:"funny",    label:"🎭 Funny — shararti",          p:"Say this playfully with a mischievous, teasing tone" }
];

/* Persona -> default mood (jab mood = auto ho) */
var PERSONA_MOOD = { maya:"warm", friday:"pro", jarvis:"pro", venom:"funny", gf:"warm", coach:"hype", teacher:"calm" };

