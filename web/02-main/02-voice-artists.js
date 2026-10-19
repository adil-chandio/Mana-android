/* =========== VOICE ARTISTS (Edge Neural TTS jugaad — premium, free) =========== */
var VOICE_ARTISTS = {
  auto:   { name: "🤖 AUTO — Gemini detect", auto: true, geminiVoice: "Kore" },
  maya:   { name: "🌸 MAYA — warm female", geminiVoice: "Kore", sample: "Assalam-o-alaikum! Main Maya hoon, aap ki personal AI dost." },
  zephyr: { name: "☀️ ZEPHYR — bright female", geminiVoice: "Zephyr", sample: "Hello! I am Zephyr, bright and ready to help!" },
  leda:   { name: "🌿 LEDA — gentle female", geminiVoice: "Leda", sample: "Hi there! I am Leda, your gentle assistant." },
  puck:   { name: "🎭 PUCK — upbeat", geminiVoice: "Puck", sample: "Hey! Puck here, ready to make your day!" },
  charon: { name: "📖 CHARON — calm male", geminiVoice: "Charon", sample: "Greetings. I am Charon, at your service." },
  fenrir: { name: "⚡ FENRIR — energetic", geminiVoice: "Fenrir", sample: "Hello! Fenrir here, let us go!" },
  sulafat:{ name: "🎵 SULAFAT — warm", geminiVoice: "Sulafat", sample: "Hi! Sulafat here, with a warm voice for you." },
  enceladus:{ name: "🌙 ENCELADUS — soft", geminiVoice: "Enceladus", sample: "Hello... I am Enceladus, soft and gentle." },
  orus:   { name: "🔮 ORUS — firm", geminiVoice: "Orus", sample: "Orus here. Firm and clear, at your command." },
  aoede:  { name: "🎶 AOODEE — breezy", geminiVoice: "Aoede", sample: "Hi! Aoede here, light and breezy!" }
};

function currentArtist(text) {
  var id = settings.voiceArtist || "maya";
  if (id !== "auto" && VOICE_ARTISTS[id] && VOICE_ARTISTS[id].geminiVoice) return VOICE_ARTISTS[id];
  if (/[\u0600-\u06FF]/.test(text)) return VOICE_ARTISTS.maya;
  if (/[\u0900-\u097F]/.test(text)) return VOICE_ARTISTS.maya;
  return VOICE_ARTISTS.maya;
}

