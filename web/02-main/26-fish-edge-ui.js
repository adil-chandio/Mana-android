/* ═══ 🐟 FISH — library, test, aur DOCTOR ═══ */
(function(){
  var lb = $("#fishLib"), tb = $("#fishTest"), db = $("#fishDoctor");

  /* 📚 awaaz ki library */
  if (lb) lb.addEventListener("click", function () {
    if (lb.disabled) return;
    var h = $("#fishHint");
    var blk = FISH.block();
    if (blk === "KEY_MISSING" || blk === "BROWSER") {
      if (h) { h.className = "ui-hint warn"; h.textContent = "⚠️ " + FISH.why(blk); }
      return;
    }
    lb.disabled = true;
    var old = lb.textContent;
    lb.textContent = "📚 AA RAHI HAI…";
    if (h) { h.className = "ui-hint"; h.textContent = "📚 Fish se awaazein mangwai ja rahi hain…"; }
    FISH.library("", function (list, code) {
      lb.disabled = false; lb.textContent = old;
      if (!list) {
        if (h) { h.className = "ui-hint warn"; h.textContent = "❌ " + code + " — " + (FISH.lastErr || FISH.why(code)); }
        return;
      }
      fishFillVoices();
      if (h) { h.className = "ui-hint ok"; h.textContent = "✅ " + list.length + " awaazein aa gayin — upar se chuno, phir SUNO dabao, phir SAVE."; }
      pushLog("FISH LIBRARY: " + list.length + " awaazein");
    });
  });

  /* 🎀 pyari zanana awaazein */
  var pb = $("#fishPyari");
  if (pb) pb.addEventListener("click", function () {
    if (pb.disabled) return;
    var h = $("#fishHint");
    var blk = FISH.block();
    if (blk === "KEY_MISSING" || blk === "BROWSER") {
      if (h) { h.className = "ui-hint warn"; h.textContent = "⚠️ " + FISH.why(blk); }
      return;
    }
    pb.disabled = true;
    var old = pb.textContent;
    pb.textContent = "🎀 DHOOND RAHI HOON…";
    if (h) { h.className = "ui-hint"; h.textContent = "🎀 Hindi/Urdu ki zanana awaazein dhoondi ja rahi hain… (5 talash)"; }
    FISH.pyari(function (list, code) {
      pb.disabled = false; pb.textContent = old;
      if (!list || !list.length) {
        if (h) { h.className = "ui-hint warn"; h.textContent = "❌ " + (code || "kuch nahi mila") + " — " + (FISH.lastErr || ""); }
        return;
      }
      fishFillVoices();
      if (h) {
        h.className = "ui-hint ok";
        h.textContent = "🎀 " + list.length + " awaazein — sab se pyari sab se upar. Ek chuno → 🐟 SUNO dabao → pasand aaye to SAVE.";
      }
      pushLog("FISH PYARI: " + list.length + " awaazein");
    });
  });

  /* 🐟 awaaz suno */
  if (tb) tb.addEventListener("click", function () {
    if (tb.disabled) return;
    var h = $("#fishHint");
    var blk = FISH.block();
    if (blk) {
      if (h) { h.className = "ui-hint warn"; h.textContent = "⚠️ " + FISH.why(blk); }
      toast("🐟 " + FISH.why(blk));
      return;
    }
    tb.disabled = true;
    var old = tb.textContent;
    tb.textContent = "🐟 AA RAHI HAI…";
    var mood = AWAAZ.moodId();
    /* 🔊 jo awaaz DROPDOWN mein chuni hai wohi sunao (pehle purani bajti thi) */
    var sel = $("#sFishVoice");
    if (sel && sel.value !== settings.fishVoice) {
      settings.fishVoice = sel.value || "";
      settings.fishVoiceName = (sel.options[sel.selectedIndex] || {}).textContent || "";
      saveSettings();
    }
    if (h) { h.className = "ui-hint"; h.textContent = "🐟 " + (FISH.voiceName() || "auto") + " \u2014 " + mood + " andaaz…"; }
    AWAAZ.stop(); AWAAZ.gen++;
    var gen = AWAAZ.gen, t0 = Date.now();
    var sample = "Assalam-o-alaikum " + ((settings && settings.name) || "Boss") + "! Main " +
                 ((settings && settings.assistName) || "Maya") +
                 " hoon. Ye Fish Audio ki awaaz hai — aur ab main andaaz bhi badal sakti hoon.";
    speaking = true; try { SUKOON.bolStart(); } catch (e) {} setOrb("speaking");
    FISH.speak(sample, mood,
      function () {
        speaking = false; try { SUKOON.bolEnd(); } catch (e) {} setOrb("idle");
        tb.disabled = false; tb.textContent = old;
        if (gen !== AWAAZ.gen) return;
        if (h) {
          h.className = "ui-hint ok";
          h.textContent = "✅ Bol diya — 🎤 " + (FISH.voiceName() || "auto") + "  •  " + mood +
                          " andaaz  •  " + ((Date.now() - t0) / 1000).toFixed(1) + " sec  •  mehfooz ✓";
        }
        pushLog("FISH OK: " + mood + " / " + (FISH.voice() || "default") + " (" + (Date.now() - t0) + "ms)");
        fishPaintHint();
      },
      function (code) {
        speaking = false; try { SUKOON.bolEnd(); } catch (e) {} setOrb("idle");
        tb.disabled = false; tb.textContent = old;
        if (gen !== AWAAZ.gen) return;
        if (h) {
          h.className = "ui-hint warn";
          h.textContent = "❌ " + code + " — " + FISH.why(code) + (FISH.lastErr ? ("\n↳ " + FISH.lastErr) : "");
        }
        pushLog("FISH FAIL: " + code + " — " + (FISH.lastErr || FISH.why(code)));
      });
  });

  /* 🩺 FISH DOCTOR */
  if (db) db.addEventListener("click", function () {
    var el = $("#fishDocOut");
    if (el) { el.classList.add("show"); el.style.display = "block"; }
    if (db.disabled) return;
    db.disabled = true;
    var old = db.textContent;
    db.textContent = "🩺 CHECK HO RAHA HAI…";
    var lines = ["🩺 FISH DOCTOR chal raha hai — thora sabar…"];
    if (el) el.textContent = lines.join("\n");
    FISH.doctor(
      function (line) { lines.push(line); if (el) { el.textContent = lines.join("\n"); el.scrollTop = el.scrollHeight; } },
      function (res) {
        if (el) el.textContent = res.text;
        db.disabled = false; db.textContent = old;
        toast(res.ok ? "🐟 FISH ZINDA HAI" : ("🐟 " + res.verdict));
        pushLog("FISH DOCTOR: " + res.verdict + " (HTTP " + (res.http || "-") + ")");
        fishPaintHint();
      });
  });
})();

/* ═══ 🌊 EDGE AWAAZ SUNO — sunata bhi hai, sach bhi batata hai ═══ */
(function(){
  var eb = $("#edgeTest");
  if (!eb) return;
  eb.addEventListener("click", function () {
    if (eb.disabled) return;
    var h = $("#edgeHint");
    var v = EDGE_TTS.pick();
    if (!EDGE_TTS.native() && (!settings || settings.voiceEngine !== "edge")) {
      if (h) { h.className = "ui-hint warn"; h.textContent = "⚠️ Edge TTS sirf APK mein chalti hai (browser custom WebSocket header nahi bhej sakta). Awaaz Engine ko '🌊 Sirf Edge TTS' karo to browser mein bhi koshish hogi."; }
      toast("🌊 Edge TTS sirf APK mein");
      return;
    }
    eb.disabled = true;
    var old = eb.textContent;
    eb.textContent = "🌊 AA RAHI HAI…";
    if (h) { h.className = "ui-hint"; h.textContent = "🌊 " + v + " se awaaz mangwai ja rahi hai…"; }
    var t0 = Date.now();
    AWAAZ.stop(); AWAAZ.gen++;
    var gen = AWAAZ.gen;
    var sample = "Assalam-o-alaikum " + ((settings && settings.name) || "Boss") + "! Main " +
                 ((settings && settings.assistName) || "Maya") +
                 " hoon. Ye Edge TTS ki awaaz hai — bilkul muft, aur is ki koi rozana hadd nahi.";
    speaking = true; try { SUKOON.bolStart(); } catch (e) {} setOrb("speaking");
    edgeTTS_speak(sample, v, EDGE_TTS.langOf(v),
      EDGE_TTS.rateStr(settings && settings.rate), EDGE_TTS.pitchStr(settings && settings.pitch),
      function () {
        speaking = false; try { SUKOON.bolEnd(); } catch (e) {} setOrb("idle");
        eb.disabled = false; eb.textContent = old;
        if (gen !== AWAAZ.gen) return;
        if (h) { h.className = "ui-hint ok"; h.textContent = "✅ Bol diya — " + v + "  •  " + ((Date.now() - t0) / 1000).toFixed(1) + " sec  •  koi key nahi lagi"; }
        pushLog("EDGE TTS OK: " + v + " (" + (Date.now() - t0) + "ms)");
        edgePaintHint();
      },
      function (code) {
        speaking = false; try { SUKOON.bolEnd(); } catch (e) {} setOrb("idle");
        eb.disabled = false; eb.textContent = old;
        if (gen !== AWAAZ.gen) return;
        var why = AWAAZ.why(code) || code;
        if (h) { h.className = "ui-hint warn"; h.textContent = "❌ " + code + " — " + why + (EDGE_TTS.lastErr ? ("\n↳ " + EDGE_TTS.lastErr) : ""); }
        pushLog("EDGE TTS FAIL: " + code + " — " + (EDGE_TTS.lastErr || why));
      });
  });
})();

(function(){
  var db = $("#awaazDoctor");
  if (db) db.addEventListener("click", function(){
    var el = $("#awaazDocOut");
    el.classList.add("show"); el.style.display = "block";
    if (db.disabled) return;
    db.disabled = true; db.textContent = "🩺 CHECK HO RAHA HAI…";
    var lines = ["🩺 AWAAZ DOCTOR chal raha hai — thora sabar…"];
    el.textContent = lines.join("\n");
    AWAAZ.doctor(
      function (line) { lines.push(line); el.textContent = lines.join("\n"); el.scrollTop = el.scrollHeight; },
      function (res) {
        el.textContent = res.text;
        db.disabled = false; db.textContent = "🩺 GEMINI VOICE KEYS CHECK KARO";
        pushLog("AWAAZ DOCTOR: " + res.verdict);
        if (res.verdict === "OK") { AWAAZ.reset(); toast("✅ Key chal rahi hai — neural awaaz on"); }
        else if (res.verdict === "SAMEPROJECT") toast("Sab keys EK hi project ki hain — alag account chahiye");
        else if (res.verdict === "RESTRICT") toast("Key par API restriction lagani hai");
        else toast("Faisla neeche likha hai");
        paintAwaaz();
      }
    );
  });
})();

(function(){
  var pb = $("#poolCheck");
  if (pb) pb.addEventListener("click", function(){
    var el = $("#poolOut");
    el.classList.add("show"); el.style.display = "block";
    el.textContent = poolReport();
    paintPool();
    toast(BRAIN.liveCount() + " dimaag zinda hain");
  });
})();

(function(_b){ if (_b) _b.addEventListener("click", function(){
  if (!NATIVE) return toast("Sirf APK mein");
  try { window.MayaBridge.requestBatteryUnrestricted(); toast("Prompt aaya — Allow dabao"); setTimeout(refreshHandsFreeStatus, 1500); } catch(e){}
}); })($("#batShield"));
var MAYA_BRAND = "";
try { if (NATIVE && window.MayaBridge.deviceBrand) MAYA_BRAND = String(window.MayaBridge.deviceBrand()).toLowerCase(); } catch(e){}

function brandTips(){
  var tips = "";
  if (/infinix|tecno|itel|hios/.test(MAYA_BRAND)) tips = "Aap ka phone " + MAYA_BRAND.toUpperCase() + " hai — EXTRA step: Phone Settings → Apps → MAYA → Battery → 'Allow background' + Security app mein 'Auto-start' ON karo. Accessibility mein 'Downloaded services/\uD83D\uDCE5' section mein MAYA milega.";
  else if (/xiaomi|redmi|poco/.test(MAYA_BRAND)) tips = "Xiaomi/Redmi: pehle Security app → Permissions → Autostart → MAYA ON. Phir Accessibility mein 'Downloaded apps' se MAYA kholo.";
  else if (/samsung/.test(MAYA_BRAND)) tips = "Samsung: Settings → Accessibility → 'Installed services/Downloaded apps' → MAYA AutoSend.";
  else if (/oppo|realme|vivo/.test(MAYA_BRAND)) tips = MAYA_BRAND.toUpperCase() + ": Settings → Accessibility → 'Downloaded apps' + Security Center mein MAYA ka 'Background/Autostart' allow karo.";
  else tips = "Accessibility list mein 'Downloaded services/apps' section check karo — MAYA wahan milega.";
  return tips;
}

(function(_b){ if (_b) _b.addEventListener("click", function(){
  if (!NATIVE) return toast("Sirf APK mein");
  try { window.MayaBridge.openAppDetails(); toast("⋮ (3 dots) → 'Allow restricted settings' — phir STEP 2"); } catch(e){}
}); })($("#asStep1"));
(function(_b){ if (_b) _b.addEventListener("click", function(){
  if (!NATIVE) return toast("Sirf APK mein");
  try { window.MayaBridge.openAccessibilitySettings(); toast("MAYA AutoSend dhundo → ON karo"); } catch(e){}
}); })($("#asStep2"));
(function(_b){ if (_b) _b.addEventListener("click", function(){
  if (!NATIVE) return toast("Sirf APK mein");
  var ok3 = false;
  try { ok3 = window.MayaBridge.accessibilityEnabled() === true; } catch(e){}
  var el3 = $("#asWizardStatus");
  if (ok3) { el3.textContent = "\u2705 AUTO-SEND READY! Ab bolo: 'bhai ko whatsapp karo...'"; }
  else {
    el3.textContent = "\u274C Abhi bhi ON nahi hua. Aap ka phone: " + (MAYA_BRAND ? MAYA_BRAND.toUpperCase() : "?") + ". " + brandTips() + " | ASLI JUGAAD (PC se ek dafa): PC par 'adb shell settings put secure enabled_accessibility_services com.maya.ai/.AutoSendService' chalao — hamesha ke liye ON! | Ya relax karo: AutoSend ke BINA bhi 95% features hain — message tak khud type hota hai, sirf SEND ka 1 tap aap ko.";
  }
  toast(ok3 ? "READY \u2705" : "Neeche tips dekho");
}); })($("#asStep3"));


(function(_b){ if (_b) _b.addEventListener("click", function(){
  if (!NATIVE) return toast("Sirf APK mein");
  try { window.MayaBridge.openNotifAccess(); toast("Notification Access \u2192 MAYA ON karo"); setTimeout(refreshHandsFreeStatus, 2500); } catch(e){}
}); })($("#readerBtn"));

(function(_b){ if (_b) _b.addEventListener("click", function(){
  if (!NATIVE) return toast("Sirf APK mein");
  try {
    if (window.MayaBridge.accessibilityEnabled()) { toast("Already ON hai ✓"); }
    else { window.MayaBridge.openAccessibilitySettings(); toast("MAYA AutoSend dhoond kar ON karo"); }
    setTimeout(refreshHandsFreeStatus, 2500);
  } catch(e){}
}); })($("#autoSendBtn"));

function renderArtists() {
  var host = $("#artistGrid"); if (!host) return; var html = "";
  Object.keys(VOICE_ARTISTS).forEach(function(id) {
    var a = VOICE_ARTISTS[id]; var sel = (settings.voiceArtist || "maya") === id;
    html += "<button onclick=\"selectArtist('" + id + "')\" style=\"" + (sel ? "background:linear-gradient(135deg,#22d3ee,#a78bfa);color:#0a0f1a;font-weight:700;" : "background:var(--glass);border:1px solid var(--line);color:var(--text);") + "border-radius:8px;padding:8px 6px;font-size:10px;cursor:pointer;border:none;text-align:center;line-height:1.3\">" + a.name + "</button>";
  });
  host.innerHTML = html;
}
window.selectArtist = function(id) { settings.voiceArtist = id; saveSettings(); renderArtists(); toast("Voice: " + VOICE_ARTISTS[id].name.split("—")[0].trim()); };


function setWakeService(on){
  if (!NATIVE) { toast("Wake word sirf APK version mein hai"); return; }
  try {
    window.MayaBridge.setPrefString && (window.MayaBridge.setPrefString('wake_lang', settings.stt || 'en-IN'),
      window.MayaBridge.setPrefString('mic_zoom', String(settings.micZoom === undefined ? 0.8 : settings.micZoom)),
      window.MayaBridge.setPref('sukoon', FLAGS.on('sukoon')),
      window.MayaBridge.setPref('mic_near', settings.micNear !== false)), window.MayaBridge.wakeService(on);
    if (on) { try { if (!window.MayaBridge.batteryUnrestricted()) window.MayaBridge.requestBatteryUnrestricted(); } catch(e){} }
    toast(on ? "\uD83D\uDC42 Wake word ON — ab 'Maya' ya 'Boss' bolo" : "Wake word OFF");
    pushLog("WAKE WORD: " + (on ? "ON" : "OFF"));
  } catch(e){ toast("Wake service start nahi hui"); }
  try { if (typeof WAKE_DOT !== "undefined" && WAKE_DOT.set) WAKE_DOT.set("", ""); } catch (e2) {}
  hudRefresh();
}

