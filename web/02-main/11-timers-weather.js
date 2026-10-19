/* ---------- TIMERS & REMINDERS (Phase 3) ---------- */
function startTimer(secs, label, speakText){
  timers.push({ end: Date.now() + secs * 1000, label: label, text: speakText || "" });
  pushLog("TIMER: " + label + (speakText ? " (reminder)" : ""));
  if (!startTimer.tick) startTimer.tick = setInterval(tickTimers, 1000);
  hudRefresh();
}
function tickTimers(){
  timers = timers.filter(function(t){
    if (Date.now() >= t.end) {
      alarmBeep();
      try {
        if (NATIVE && window.MayaBridge && window.MayaBridge.vibrate) window.MayaBridge.vibrate(600);
        else if (navigator.vibrate) navigator.vibrate([300,150,300]);
      } catch(e){}
      if (t.text) {
        if (NATIVE) { try { window.MayaBridge.notify("⏰ MAYA Reminder", t.text); } catch(e){} }
        reply("Yaad dilana " + settings.name + ": " + t.text, true);
      } else {
        reply(settings.name + ", aap ka " + t.label + " ka timer poora ho gaya!", true);
      }
      return false;
    }
    return true;
  });
  hudRefresh();
}

/* ---------- GEMINI ---------- */
function sysPrompt(){
  var p = "You are MAYA — witty, warm, fiercely loyal personal AI running on the user's Android phone (their home-made 0-budget JARVIS, named MAYA). Address the user as '" + settings.name + "' (occasionally 'Boss' for fun). Personality: playful but sharp, caring like a best friend, light sci-fi flair.\n" +
    "SUPERPOWERS — you have PHONE TOOLS. Use them naturally whenever the user wants an action:\n" +
    "- Alarm ('jaga dena', 'waqt par uthana', 'alarm lagao') -> set_alarm\n" +
    "- Timer/reminders -> set_timer ya set_reminder\n" +
    "- Apps kholna -> open_app; gaana/video -> play_youtube; search -> search_web\n" +
    "- Naam se call/message -> call_contact / message_contact (contact list se khud dhoondo; ek se zyada mile to user se poocho). Number pata ho to call_number / send_sms\n" +
    "- Mausam -> get_weather (default sheher: " + settings.city + ")\n" +
    "- Battery -> battery_status\n" +
    "- Zaroori cheez (birthday, appointment, pasand, kisi ka naam, kaam) -> khud save_memory use karo, 'yaad rakhna' bole na bole\n" +
    "- Yaad karna ho -> recall_memory\n" +
    "Tool use karne ke baad ek chhoti friendly line mein confirm karo. Jo tools se mumkin nahi, wo bRIEFLY bata do.\n" +
    "RULES: (1) Reply SPOKEN ALOUD hoti hai — 1-3 jumlay, 60 words se kam (detail na maangi jaye to). (2) Plain spoken text: koi markdown, list, asterisk, emoji nahi. (3) User ki language aur script mein jawab: Urdu script -> Urdu script, Roman Urdu -> Roman Urdu, English -> English. (4) Kaam aksar tools se karo, sirf baat mat karo. (4b) Calculations, lists, data-parse, conversion -> run_javascript mein khud code likh kar chalao. (4c) Live info (rates, news, koi bhi site) -> web_fetch. (4d) Roznamcha: diary_write/diary_search. (4e) Messages: read_messages/reply_message/schedule_message. (4f) Namaz: prayer_times. (4g) Phone: torch_control/volume_control/brightness_control. (4h) YouTube: play_youtube ka `query` SIRF search text ho (gaane/video ka naam) — KABHI video ID, URL, ya channel name nahi. App khud sahi search page kholta hai. Random/mashhoor video mat chuno. (5) Kaun ho? MAYA, " + settings.name + " ki personal AI — mohabbat se 0 budget par bani.";
  if (_activeSkill) p += "\n\u2699\uFE0F ACTIVE SKILL: " + _activeSkill.name + " — " + _activeSkill.prompt;
  if (customSkills.length) p += "\nCUSTOM SKILLS available: " + customSkills.map(function(s){ return s.name; }).join(", ");
  if (memorySummary) p += "\nLONG-TERM MEMORY SUMMARY (pichli baatein): " + memorySummary;
  if (diary.length) p += "\nRECENT DIARY: " + diary.slice(-3).map(function(d){ return d.text; }).join(" | ").slice(0, 300);
  if (facts.length) p += "\nKNOWN FACTS about " + settings.name + " (natural tor par use karo): " + facts.slice(0, 15).map(function(f){ return "- " + f; }).join(" ");
  return p;
}

/* ---------- WEATHER (Open-Meteo — free, no key) ---------- */
var WMO = {0:"saaf aasman",1:"thoda saaf",2:"badal chhaye hue",3:"ghane badal",45:"dhund",48:"dhund",51:"halki boondabandi",53:"boondabandi",55:"tez boondabandi",56:"barf bari",57:"barf bari",61:"halki barish",63:"barish",65:"tez barish",66:"barf bari",67:"barf bari",71:"halki barf",73:"barf bari",75:"tez barf bari",77:"barf ke kanay",80:"baarish ke chhinte",81:"baarish",82:"bohat tez baarish",85:"barf bari",86:"barf bari",95:"toofan o graaj",96:"toofan o graaj (ballay)",99:"tez toofan o graaj"};
var CITY_CACHE = {};
function pad2(n){ return (n < 10 ? "0" : "") + n; }
async function geoCity(city){
  var key = String(city || "Hyderabad").toLowerCase();
  if (CITY_CACHE[key]) return CITY_CACHE[key];
  var g = null;
  try {
    var r = await fetch("https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&name=" + encodeURIComponent(city)).then(function(x){ return x.json(); });
    g = r && r.results && r.results[0];
  } catch(e){}
  var c = g ? { lat: g.latitude, lon: g.longitude, name: g.name + (g.country_code ? ", " + g.country_code : "") }
            : { lat: 25.396, lon: 68.377, name: "Hyderabad, PK" };
  CITY_CACHE[key] = c;
  return c;
}
async function fetchWeather(cityName){
  try {
    var c = await geoCity(cityName || settings.city || "Hyderabad");
    var url = "https://api.open-meteo.com/v1/forecast?latitude=" + c.lat + "&longitude=" + c.lon +
      "&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1";
    var d = await fetch(url).then(function(x){ return x.json(); });
    var cur = d.current || {};
    var mx = d.daily && d.daily.temperature_2m_max ? d.daily.temperature_2m_max[0] : null;
    var mn = d.daily && d.daily.temperature_2m_min ? d.daily.temperature_2m_min[0] : null;
    return { city: c.name, temp: cur.temperature_2m, desc: WMO[cur.weather_code] || "aam mausam",
             humidity: cur.relative_humidity_2m, wind: cur.wind_speed_10m, max: mx, min: mn, unit: "C" };
  } catch(e){ return { error: "weather unavailable", detail: String(e && e.message || e) }; }
}
async function fillWeatherChip(){
  try {
    var w = await fetchWeather();
    var el = $("#hudWeather");
    if (el && w && w.temp != null) el.textContent = w.temp + "°C — " + w.desc;
  } catch(e){}
}
async function morningBrief(){
  var h = new Date().getHours();
  var parts = [(h < 12 ? "Good morning" : "Good afternoon") + ", " + settings.name + "!"];
  try {
    var w = await fetchWeather();
    if (w && w.temp != null) parts.push(w.city + " mein abhi " + w.temp + " degree hai — " + w.desc + (w.max != null ? ", aaj high " + w.max + " aur low " + w.min + " degree." : "."));
  } catch(e){}
  try {
    if (NATIVE) { var b = JSON.parse(window.MayaBridge.battery()); parts.push("Battery " + b.level + " percent" + (b.charging ? " par charging hai." : " baqi hai.")); }
  } catch(e){}
  if (facts.length) parts.push("Yaaddasht mein " + facts.length + " baatein hain — sab se pehli: " + facts[0] + ".");
  parts.push("Bataiye, aaj kya plan hai?");
  reply(parts.join(" "), true);
}

