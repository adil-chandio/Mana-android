/* ---------- CONSOLIDATE MEMORY ---------- */
async function consolidateMemory() {
  try {
    if (!settings.apikey || chatHist.length < 40) return;
    var last = parseInt(localStorage.getItem("maya_consol_ts") || "0", 10);
    if (Date.now() - last < 72000000) return;
    localStorage.setItem("maya_consol_ts", String(Date.now()));
  } catch(e) {}
}

/* ---------- INIT ---------- */
renderCmds(""); renderFacts(); loadSettingsForm(); paintQuick(); setOrb("idle");
fillWeatherChip();
setInterval(fillWeatherChip, 1800000);
populateVoiceSelect();
renderArtists();
setTimeout(consolidateMemory, 4000);
if (NATIVE && settings.wakeWord) setTimeout(function(){ try { setWakeService(true); } catch(e){} }, 1500);
setTimeout(refreshHandsFreeStatus, 800);
setInterval(refreshHandsFreeStatus, 10000);
if (NATIVE) {
  $("#installBtn").style.display = "none";
  pushLog("NATIVE BRIDGE: ACTIVE (alarm/timer/notify/battery)");
  var sver = document.querySelector("#splash .ver");
  /* pehle yahan "4.1.0" hard-code tha — diagnostic bhi wohi purana version dikhata tha */
  if (sver && !/^v?\d/.test(sver.textContent || "")) sver.textContent = "MAYA";
}
greetMiniRefresh();
chatHist.slice(-40).forEach(function(h){ addBubble(h.role === "user" ? "user" : "ai", h.text); });
if (!chatHist.length) {
  addBubble("ai", "MAYA online, " + settings.name + "! 🎉 Main aap ki personal AI hoon — mic 🎤 dabao aur bolo, ya type karo. " +
    (settings.apikey ? "Neural link tayyar hai — kuch bhi poocho!" : "Smart banane ke liye ⚙️ Settings → API Keys se FREE Gemini key lo. Aur yaad rakhna kaam bhi karta hoon — kaho: 'yaad rakhna ki ...'"));
}
