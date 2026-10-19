/* =========== NEVER-STOP BRAIN (Phase 6: Gemini pool -> Groq -> GitHub -> queue) =========== */
var aiState = { provider: "—" };
var modelCooldowns = {};
var lastRetryDelay = 45000;
var geminiBadUntil = 0;

function trySmalltalk(q){
  var t = String(q).toLowerCase().trim();
  if (/^(salam|assalam[ -]?o[ -]?alaikum|asalam[ -]?o[ -]?alaikum|aoa|hello|hi|hey|yo)\??$/.test(t))
    return "Wa alaikum assalam, " + settings.name + "! Hukum karo.";
  if (/^(hello maya|hi maya|hey maya|salam maya)\??$/.test(t)) return "Ji " + settings.name + "? Boliye!";
  if (/^(thanks|thank you|shukriya|jazakallah|shukria)\b[.!]?$/.test(t)) return "Hamesha hazir, " + settings.name + "!";
  if (/^(kaise ho|kya haal hai|how are you|kaise ho aap)\??$/.test(t)) return "Main bilkul tayyar hoon, " + settings.name + "! Aap sunao, kaise ho?";
  if (/^(ok|theek hai|acha|alright|hmm)\??$/.test(t)) return "Ji " + settings.name + ".";
  return null;
}

var MODEL_CACHE = null;
try { MODEL_CACHE = JSON.parse(localStorage.getItem("maya_models") || "null"); } catch(e){}
function saveModelCache(){ try { localStorage.setItem("maya_models", JSON.stringify(MODEL_CACHE)); } catch(e){} }
function modelScore(n){
  var m = n.match(/gemini-(\d+)(?:[.-](\d+))?/);
  if (!m) return -900;
  var s = parseInt(m[1] || "0", 10) * 100 + parseFloat(m[2] || "0");
  if (/flash-lite/.test(n)) s -= 40;
  if (/flash/.test(n)) s += 60;
  if (/pro/.test(n)) s -= 15;
  if (/preview|exp|thinking|8b|live|image|audio|native|tts|embedding|aqa|imagen|veo|gemma|robotics/.test(n)) s -= 800;
  return s;
}
async function resolveModels(){
  if (settings.model !== "auto") return [settings.model];
  var now = Date.now();
  if (MODEL_CACHE && MODEL_CACHE.names && MODEL_CACHE.names.length && now - MODEL_CACHE.ts < 86400000) return MODEL_CACHE.names;
  try {
    var j = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=100&key=" + encodeURIComponent(settings.apikey)).then(function(x){ return x.json(); });
    var names = (j.models || [])
      .filter(function(m){ return (m.supportedGenerationMethods || []).indexOf("generateContent") >= 0; })
      .map(function(m){ return String(m.name || "").replace(/^models\//, ""); })
      .filter(function(n){ return modelScore(n) > -500; });
    names.sort(function(a, b){ return modelScore(b) - modelScore(a); });
    if (!names.length) throw new Error("khali");
    MODEL_CACHE = { names: names.slice(0, 5), ts: now };
    saveModelCache();
    pushLog("MODELS RESOLVED: " + MODEL_CACHE.names[0] + " (+" + (MODEL_CACHE.names.length - 1) + " backup)");
    return MODEL_CACHE.names;
  } catch(e) {
    return MODELS;
  }
}

