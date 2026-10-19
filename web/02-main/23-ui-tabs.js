/* ---------- HUD ---------- */
function hudRefresh(){
  var wk = $("#hudWake"); if (wk) wk.textContent = settings.wakeWord ? "ON \uD83D\uDC42" : "OFF";
  var ai = $("#hudAI"); if (ai) ai.textContent = (settings.apikey || settings.groqKey || settings.ghKey) ? aiState.provider : "NO KEY";
  var mem = $("#hudMem"); if (mem) mem.textContent = facts.length + "F • " + diary.length + "D • " + chatHist.length + "M";
  var tm = $("#hudTimers"); if (tm) tm.textContent = String(timers.length);
  var au = $("#hudAuto"); if (au) au.textContent = settings.autoListen ? "ON" : "OFF";
}
function clockTick(){
  var c = $("#hudClock"), d = $("#hudDate");
  var n = new Date();
  if (c) c.textContent = n.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit", second:"2-digit"});
  if (d) d.textContent = n.toLocaleDateString("en-GB", {weekday:"short", day:"numeric", month:"short"});
}
setInterval(clockTick, 1000); clockTick();
if (navigator.getBattery) navigator.getBattery().then(function(b){
  var paint = function(){
    var v = $("#hudBat"), c = $("#hudCharge");
    if (v) v.textContent = Math.round(b.level * 100) + "%";
    if (c) c.textContent = b.charging ? "⚡ CHARGING" : "DISCHARGING";
  };
  paint();
  b.addEventListener("levelchange", paint);
  b.addEventListener("chargingchange", paint);
}).catch(function(){});

/* PWA install prompt */
window.addEventListener("beforeinstallprompt", function(e){
  e.preventDefault(); deferredInstall = e;
  var b = $("#installBtn"); if (b) b.classList.add("show");
});
$("#installBtn").addEventListener("click", async function(){
  if (!deferredInstall) return;
  deferredInstall.prompt();
  await deferredInstall.userChoice;
  deferredInstall = null;
  $("#installBtn").classList.remove("show");
});

/* SW registration */
try {
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").then(function(){ pushLog("SERVICE WORKER: ACTIVE (OFFLINE OK)"); }).catch(function(){});
  }
} catch (e) {}

/* ---------- COMMANDS TAB ---------- */
var CMDS = [
  { g:"📱 PHONE CONTROL", items:[
    { c:"open whatsapp", run:true }, { c:"open youtube", run:true }, { c:"open instagram", run:true },
    { c:"open telegram", run:true }, { c:"open gmail", run:true }, { c:"open maps", run:true },
    { c:"open play store", run:true }, { c:"open google", run:true }
  ]},
  { g:"🔍 SEARCH & MEDIA", items:[
    { c:"search karo [kuch bhi]", run:false }, { c:"search karo pakistan cricket news", run:true },
    { c:"youtube pe [gaana] chalao", run:false }, { c:"youtube pe lofi beats chalao", run:true }
  ]},
  { g:"⏰ TIME & TIMERS", items:[
    { c:"waqt kya hua", run:true }, { c:"aaj ki tareekh", run:true },
    { c:"subah 6 baje alarm lagao", run:true },
    { c:"[paanch] minute ka timer lagao", run:false }, { c:"1 minute ka timer lagao", run:true },
    { c:"battery kitni hai", run:true }
  ]},
  { g:"📞 CALLS & MESSAGES", items:[
    { c:"call karo [number]", run:false }, { c:"message [number]", run:false }
  ]},
  { g:"🧷 MEMORY — Maya yaad rakhegi", items:[
    { c:"maya, yaad rakhna ki mera birthday 14 august hai", run:true },
    { c:"kya yaad hai?", run:true }
  ]},
  { g:"🧠 SMART — bas bolo, AI khud karegi (key chahiye)", items:[
    { c:"maya, kal subah 7 baje jaga dena", run:true },
    { c:"maya, bhai ko message bhejna hai", run:true },
    { c:"maya, 10 minute baad yaad dilana paani peena hai", run:true },
    { c:"mausam kaisa hai", run:true },
    { c:"good morning maya", run:true }
  ]},
  { g:"🧠 AI CHAT — kuch bhi poocho (free key ke saath)", items:[
    { c:"aaj karachi ka mausam kaisa hoga?", run:true },
    { c:"mujhe ek chhoti shayari sunao", run:true },
    { c:"main english bolna kaise improve karoon?", run:true },
    { c:"ek minute ke liye mujhe hasao", run:true }
  ]}
];
function renderCmds(filter){
  var host = $("#cmdList"); host.innerHTML = "";
  var f = (filter || "").toLowerCase();
  CMDS.forEach(function(grp){
    var items = grp.items.filter(function(it){ return !f || it.c.toLowerCase().indexOf(f) >= 0 || grp.g.toLowerCase().indexOf(f) >= 0; });
    if (!items.length) return;
    var d = document.createElement("div"); d.className = "grp";
    var h = document.createElement("h3"); h.textContent = grp.g; d.appendChild(h);
    items.forEach(function(it){
      var row = document.createElement("div"); row.className = "cmd";
      var code = document.createElement("code"); code.textContent = it.c; row.appendChild(code);
      if (it.run) {
        var btn = document.createElement("button"); btn.textContent = "▶ RUN";
        btn.onclick = function(){
          showTab("tab-chat");
          setTimeout(function(){ handleUserText(it.c.replace(/\[(.*?)\]/g, "$1"), false); }, 250);
        };
        row.appendChild(btn);
      } else {
        var tip = document.createElement("span"); tip.style.cssText = "font-size:10px;color:var(--dim);flex:none"; tip.textContent = "replace";
        row.appendChild(tip);
      }
      d.appendChild(row);
    });
    host.appendChild(d);
  });
}
$("#cmdFilter").addEventListener("input", function(){ renderCmds(this.value); });

$("#hudWakeChip").addEventListener("click", function(){
  settings.wakeWord = !settings.wakeWord; saveSettings();
  setWakeService(settings.wakeWord);
  var sw = $("#sWake"); if (sw) sw.checked = settings.wakeWord;
});

/* HUD quick actions */
document.querySelectorAll(".qactions button").forEach(function(b){
  b.addEventListener("click", function(){
    showTab("tab-chat");
    setTimeout(function(){ handleUserText(b.dataset.cmd, false); }, 250);
  });
});

/* ---------- SETTINGS TAB ---------- */
