#!/usr/bin/env node
/* ============================================================================
   MAYA — SETTINGS UI FUNCTIONAL TEST  (v4.1.0 IRONCLAD)
   ----------------------------------------------------------------------------
   jsdom mein poori index.html load kar ke asal mein check karta hai:
     • dono copies (public/ aur app assets) byte-for-byte same hain
     • koi ES6+ syntax nahi jo purane WebView ka script tor de
     • har slider enhance hua (track + fill + thumb + −/+ bane)
     • − / + buttons se value badalti hai aur input/change event firta hai
     • switch toggle par native checkbox.checked badalta hai + is-on class lagti hai
     • MayaUI.layout() ne main/tab ki height px mein set ki
     • saare zaroori setting IDs maujood hain (purana save/load JS na toote)
     • Settings markup mein koi banned inline style nahi

   Chalane ka tareeqa:
     npm i --no-save jsdom
     node tools/test-settings-ui.js
   ========================================================================= */
'use strict';

var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..');
var PUB = path.join(ROOT, 'public', 'index.html');
var APP = path.join(ROOT, 'app', 'src', 'main', 'assets', 'web', 'index.html');

var pass = 0, fail = 0;
function ok(name, extra) { pass++; console.log('  \u2705 ' + name + (extra ? '  \u2014 ' + extra : '')); }
function no(name, extra) { fail++; console.log('  \u274C ' + name + (extra ? '  \u2014 ' + extra : '')); }
function is(cond, name, extra) { cond ? ok(name, extra) : no(name, extra); }
function section(t) { console.log('\n' + t); }

/* ---------------------------------------------------------- 1. FILE CHECKS */
section('1. FILES');
var html = fs.readFileSync(PUB, 'utf8');
is(fs.existsSync(APP) && fs.readFileSync(APP, 'utf8') === html,
   'public/index.html aur app assets copy identical hain');

section('2. SYNTAX (purane WebView ka script na toote)');
var scripts = [];
html.replace(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g, function (m, code) { scripts.push(code); return m; });
is(scripts.length >= 2, 'inline scripts mile', scripts.length + ' script blocks');
var syntaxBad = 0;
scripts.forEach(function (code, i) {
  try { new Function(code); } catch (e) { syntaxBad++; console.log('     script #' + (i + 1) + ': ' + e.message); }
});
is(syntaxBad === 0, 'har inline script parse hota hai');
/* comments + string literals hata do — warna apne hi comment ka lafz "token" ban jata hai */
function stripCode(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')          // block comments
    .replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ')  // line comments
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')        // "strings"
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")        // 'strings'
    /* regex literals — inke andar ` ya => jaise tokens jhoota alarm dete hain */
    .replace(/([(,=:[!&|?{};+]\s*)\/(?![*\/])(?:\\.|\[(?:\\.|[^\]\\])*\]|[^\/\\\n])+\/[gimsuy]*/g, '$1/RE/');
}
var joined = stripCode(scripts.join('\n'));
var rawJoined = scripts.join('\n');
is(!/\\u\{/.test(rawJoined.replace(/\/\*[\s\S]*?\*\//g, ' ')),
   'koi ES6 \\u{...} code-point escape nahi (Chrome <44 ise tor deta hai)');
is(!/=>/.test(joined), 'koi arrow function nahi');
is(!/(^|[^.\w])(const|let)\s+[A-Za-z_$]/.test(joined), 'koi const/let nahi');
is(!/\?\./.test(joined), 'koi optional chaining nahi');
is(!/`/.test(joined), 'koi template literal nahi');

/* ------------------------------------------------------------- 3. MARKUP */
section('3. SETTINGS MARKUP');
var setSection = html.slice(html.indexOf('id="tab-set"'), html.indexOf('</section>', html.indexOf('id="tab-set"')));
var NEEDED_IDS = ['sName', 'sGender', 'sPhone', 'sCity', 'sMusicApp', 'sFavSong', 'sYtChannel',
  'sAssistName', 'sPersona', 'sGf', 'sRemember', 'sConvo', 'sLang', 'sProactive', 'sAuto', 'sWake',
  'sVoiceOn', 'sNotifOn', 'sBatAlert', 'sStt', 'sTts', 'sVoice', 'sPitch', 'sRate', 'sRadius',
  'sFont', 'sEdgeGlow', 'sKey', 'sModel', 'sGqKey',  'sGhKey', 'sCerebras', 'sMistral', 'sOpenRouter', 'sNvidia', 'sZai', 'sLlm7', 'sTtsKey', 'sTurbo',
  'sVoiceEngine', 'sGVoice', 'sVoiceMood', 'sNeuralWifi', 'sEdgeTts',
  'saveSettings', 'pitchVal', 'rateVal', 'radiusVal', 'fontVal', 'themeGrid', 'accentRow',
  'artistGrid', 'diagOut', 'keyTestOut', 'notifStatus', 'batStatus', 'asStatus', 'uiCheckBtn'];
var missingIds = NEEDED_IDS.filter(function (id) { return setSection.indexOf('id="' + id + '"') === -1; });
is(missingIds.length === 0, 'saare ' + NEEDED_IDS.length + ' setting IDs maujood hain',
   missingIds.length ? 'missing: ' + missingIds.join(', ') : '');
is(!/style="[^"]*color-mix|style="[^"]*accent-color|style="[^"]*display:\s*grid/.test(setSection),
   'settings markup mein koi banned inline style nahi');

/* --------------------------------------------------------- 4. LIVE DOM */
section('4. LIVE DOM (jsdom)');
var JSDOM;
try { JSDOM = require('jsdom').JSDOM; }
catch (e) { console.log('  \u26A0 jsdom nahi mila — `npm i --no-save jsdom` chalao'); process.exit(2); }

var dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'https://localhost/',
  virtualConsole: new (require('jsdom').VirtualConsole)()   // app ke apne warnings chhupa do
});
var win = dom.window, doc = win.document;

/* jsdom layout nahi karta — getBoundingClientRect ko CSS ke hisaab se naqli
   size do taake geometry logic test ho sake (visibility ka asli test device
   par 🧪 UI CHECK karta hai). */
var rectFor = function (el) {
  var st = win.getComputedStyle(el);
  if (st.display === 'none') return { width: 0, height: 0, left: 0, top: 0, right: 0, bottom: 0 };
  var w = parseFloat(st.width) || 300, h = parseFloat(st.height) || parseFloat(st.minHeight) || 24;
  return { width: w, height: h, left: 0, top: 0, right: w, bottom: h };
};
win.Element.prototype.getBoundingClientRect = function () { return rectFor(this); };

setTimeout(function () {
  var MayaUI = win.MayaUI;
  is(!!MayaUI, 'MayaUI module load hua');
  if (!MayaUI) { done(); return; }

  /* --- sliders --- */
  section('5. SLIDERS');
  var ranges = doc.querySelectorAll('#tab-set input[type=range]');
  is(ranges.length === 4, '4 sliders mile', ranges.length + ' mile');
  var sliderBad = 0;
  Array.prototype.forEach.call(ranges, function (r) {
    var ui = r.__muiUI;
    if (!ui) { sliderBad++; console.log('     ' + r.id + ': enhance nahi hua'); return; }
    var haveAll = ui.track && ui.fill && ui.thumb && ui.minus && ui.plus;
    if (!haveAll) { sliderBad++; console.log('     ' + r.id + ': adhoora DOM'); }
  });
  is(sliderBad === 0, 'har slider ka custom DOM bana (track + fill + thumb + \u2212/+)');

  var pitch = doc.getElementById('sPitch');
  var before = parseFloat(pitch.value);
  var evInput = 0, evChange = 0;
  pitch.addEventListener('input', function () { evInput++; });
  pitch.addEventListener('change', function () { evChange++; });
  pitch.__muiUI.plus.click();
  var afterPlus = parseFloat(pitch.value);
  is(Math.abs(afterPlus - (before + 0.05)) < 1e-6, '+ button se value barhti hai',
     before + ' \u2192 ' + afterPlus);
  is(evInput > 0 && evChange > 0, 'input + change events firte hain (purana JS chalta rahega)',
     'input=' + evInput + ' change=' + evChange);
  pitch.__muiUI.minus.click();
  is(Math.abs(parseFloat(pitch.value) - before) < 1e-6, '\u2212 button se value ghatti hai',
     afterPlus + ' \u2192 ' + pitch.value);
  is(doc.getElementById('pitchVal').textContent.indexOf(String(before.toFixed(2))) === 0,
     'label ka value readout update hua', '#pitchVal = ' + doc.getElementById('pitchVal').textContent);

  /* clamp check */
  var radius = doc.getElementById('sRadius');
  for (var i = 0; i < 50; i++) radius.__muiUI.plus.click();
  is(parseFloat(radius.value) === 24, 'slider max par ruk jata hai (clamp)', 'sRadius = ' + radius.value);
  for (var j = 0; j < 60; j++) radius.__muiUI.minus.click();
  is(parseFloat(radius.value) === 4, 'slider min par ruk jata hai (clamp)', 'sRadius = ' + radius.value);
  is(radius.__muiUI.fill.style.width === '0%', 'min par fill 0% hai', 'fill = ' + radius.__muiUI.fill.style.width);

  /* thumb position */
  radius.value = 14; radius.__muiPaint();
  is(radius.__muiUI.thumb.style.left === '50%', 'thumb sahi jagah par hai (14/4..24 = 50%)',
     'left = ' + radius.__muiUI.thumb.style.left);

  /* --- switches --- */
  section('6. SWITCHES');
  var sws = doc.querySelectorAll('#tab-set .ui-sw input');
  is(sws.length >= 11, 'sab switches mile', sws.length + ' switches');
  var gf = doc.getElementById('sGf');
  var wasOn = gf.checked;
  var chg = 0;
  gf.addEventListener('change', function () { chg++; });
  gf.checked = !wasOn;
  gf.dispatchEvent(new win.Event('change'));
  is(gf.checked === !wasOn, 'checkbox state badalta hai');
  is((gf.parentNode.className.indexOf('is-on') > -1) === gf.checked,
     'is-on class checkbox ke sath sync hai', 'class = "' + gf.parentNode.className + '"');
  var trackEl = gf.parentNode.querySelector('.ui-sw-t');
  var knobEl = gf.parentNode.querySelector('.ui-sw-k');
  is(!!trackEl && !!knobEl, 'switch ka track + knob DOM maujood hai');

  /* --- layout --- */
  section('7. MEASURED LAYOUT');
  win.innerHeight = 800;
  var mh = MayaUI.layout();
  var main = doc.querySelector('main');
  var tabSet = doc.getElementById('tab-set');
  is(/px$/.test(main.style.height) && parseFloat(main.style.height) > 100,
     'main ki height px mein set hui', 'main = ' + main.style.height);
  is(/px$/.test(tabSet.style.height) && parseFloat(tabSet.style.height) > 100,
     'tab ki height px mein set hui', '#tab-set = ' + tabSet.style.height);
  is(tabSet.style.overflowY === 'auto', 'tab par overflow-y:auto laga hai');
  win.innerHeight = 500;
  MayaUI.layout();
  is(parseFloat(main.style.height) < mh, 'resize par height dobara naapi jati hai',
     mh + 'px \u2192 ' + main.style.height);

  /* --- groups --- */
  section('8. GROUPS');
  var grp = doc.getElementById('grp-voice');
  var head = grp.querySelector('.ui-head');
  var openBefore = grp.className.indexOf('is-open') > -1;
  head.click();
  is((grp.className.indexOf('is-open') > -1) !== openBefore, 'group header click par khulta/band hota hai');
  is(win.getComputedStyle(grp.querySelector('.ui-body')).display === 'block',
     'khulne par body display:block hoti hai');

  /* --- self test --- */
  section('9. SELF TEST API');
  var res = MayaUI.selfTest();
  is(res && typeof res.text === 'string' && res.text.indexOf('UI CHECK') > -1, 'selfTest() report deta hai');
  is(res.visible > 40, 'selfTest ne 40+ controls naape', res.visible + ' visible / ' + res.invisible + ' invisible');

  /* --- AWAAZ studio (v4.2.0) --- */
  section('10. AWAAZ STUDIO');
  try { win.loadSettingsForm(); } catch (e) { console.log('     loadSettingsForm: ' + e.message); }
  var gv = doc.getElementById('sGVoice'), vm = doc.getElementById('sVoiceMood');
  is(gv && gv.options.length === 30, 'voice picker mein 30 awaazein bhar gayin', gv ? gv.options.length + ' options' : 'select hi nahi');
  is(vm && vm.options.length >= 9, 'mood picker bhar gaya', vm ? vm.options.length + ' options' : 'select hi nahi');
  is(gv && gv.value === 'Kore', 'settings ki chuni hui awaaz select par lagi', gv && gv.value);
  var eng = doc.getElementById('sVoiceEngine');
  is(eng && eng.options.length === 6, 'engine ke 6 mode (auto/neural/fish/edge/device/off)', eng ? eng.options.length + '' : '-');
  var engVals = eng ? Array.prototype.map.call(eng.options, function (o) { return o.value; }).join(',') : '';
  is(engVals === 'auto,neural,fish,edge,device,off', 'fish + edge dono mode picker mein hain', engVals);
  is(!!doc.getElementById('sFishKey') && !!doc.getElementById('sFishOn'), '\uD83D\uDC1F Fish key ka khana + switch maujood');
  var fv = doc.getElementById('sFishVoice');
  is(!!fv && fv.options.length >= 1 && fv.options[0].value === '', 'Fish awaaz picker maujood (pehla = default)', fv ? fv.options[0].textContent.slice(0, 22) : '-');
  is(!!doc.getElementById('fishLib') && !!doc.getElementById('fishTest') && !!doc.getElementById('fishDoctor'),
     'Fish ke teeno button: LIBRARY / SUNO / DOCTOR');
  is(!!doc.getElementById('fishDocOut'), 'Fish Doctor ka jawab dikhane ki jagah maujood');
  var ev = doc.getElementById('sEdgeVoice');
  is(!!ev && ev.options.length > 5, 'Edge awaaz picker bhar gaya', ev ? ev.options.length + ' options' : 'nadarad');
  is(!!ev && ev.options[0].value === '', 'Edge picker ka pehla option Auto hai', ev ? ev.options[0].textContent.slice(0, 24) : '-');
  is(!!doc.getElementById('edgeTest'), 'EDGE AWAAZ SUNO button maujood', 'button');
  is(eng && eng.value === (win.settings.voiceEngine || 'auto'), 'engine mode form par load hua', eng && eng.value);
  try { win.loadSettingsForm(); } catch (e) {}
  is(gv && gv.options.length === 30, 'dobara load par options duplicate nahi hote', gv ? gv.options.length + '' : '-');
  var hint = doc.getElementById('awaazStatus');
  is(hint && hint.textContent && hint.textContent !== '\u2014', 'AWAAZ status line likhi gayi', hint && hint.textContent.slice(0, 46));
  is(!!win.AWAAZ && win.AWAAZ.VER >= 7, 'AWAAZ engine v7+ load hua');
  is(typeof win.paintAwaaz === 'function' && typeof win.awaazBadge === 'function', 'badge + status painter maujood');
  /* save -> settings mein sach much pahunchta hai */
  gv.value = 'Puck'; vm.value = 'whisper'; eng.value = 'device';
  doc.getElementById('sNeuralWifi').checked = true;
  try { doc.getElementById('saveSettings').click(); } catch (e) { console.log('     save: ' + e.message); }
  is(win.settings.gVoice === 'Puck' && win.settings.voiceMood === 'whisper', 'awaaz + mood save hue', win.settings.gVoice + '/' + win.settings.voiceMood);
  is(win.settings.voiceEngine === 'device' && win.settings.neuralWifiOnly === true, 'engine mode + WiFi-only save hue');
  is(win.AWAAZ.moodId() === 'whisper' && win.AWAAZ.voiceId() === 'Puck', 'engine ne nayi settings foran uthayin');

  /* --- SETFORM (v4.5.0): jo bug user ne pakda tha --- */
  section('11. SETFORM — SAVE par kuch bhi chup-chaap reset na ho');
  is(Array.isArray(win.SET_FIELDS) && win.SET_FIELDS.length >= 40, 'SET_FIELDS registry maujood', (win.SET_FIELDS || []).length + ' fields');
  is(!!win.SETFORM && typeof win.SETFORM.save === 'function', 'SETFORM.save() wahid darwaza hai');

  /* har registry field ka DOM element sach much maujood ho */
  var ghayb = (win.SET_FIELDS || []).filter(function (f) { return !doc.getElementById(f.id); });
  is(ghayb.length === 0, 'registry ka har field DOM mein maujood', ghayb.map(function (f) { return f.id; }).join(', ') || 'sab mile');

  /* ── ASAL BUG: GF mode + Groq key ek saath, phir save ── */
  doc.getElementById('sGender').value = 'male';
  doc.getElementById('sGf').checked = true;
  doc.getElementById('sGqKey').value = 'gsk_test_key_123456';
  doc.getElementById('sProactive').checked = true;
  doc.getElementById('sAssistName').value = 'Mana';
  doc.getElementById('sPhone').value = '03001234567';
  doc.getElementById('sLang').value = 'urdu';
  try { doc.getElementById('saveSettings').click(); } catch (e) { console.log('     save: ' + e.message); }

  is(win.settings.gfMode === true, '🔥 GF MODE save hua (purana bug: chup-chaap false ho jata tha)', String(win.settings.gfMode));
  is(win.settings.groqKey === 'gsk_test_key_123456', '  → saath mein Groq key bhi save hui', win.settings.groqKey);
  is(win.settings.proactive === true, '  → proactive bhi bacha');
  is(win.settings.assistName === 'Mana', '  → naam bhi bacha', win.settings.assistName);
  is(win.settings.phone === '03001234567', '  → phone bhi bacha');
  is(win.settings.lang === 'urdu', '  → language bhi bachi');
  is(doc.getElementById('sGf').checked === true, '  → save ke baad switch ON hi raha (form wapas nahi palta)');

  /* dobara save karne par bhi wahi rahe (pehle yahan reset hota tha) */
  try { doc.getElementById('saveSettings').click(); } catch (e) {}
  is(win.settings.gfMode === true, 'doosri dafa SAVE par bhi GF mode zinda');
  is(win.settings.groqKey === 'gsk_test_key_123456', 'doosri dafa SAVE par key bhi zinda');

  /* ek hi save handler — do handler hi asal bug the */
  var srcAll = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');
  is((srcAll.match(/\$\("#saveSettings"\)\.addEventListener/g) || []).length === 1,
     'SAVE button par sirf EK handler (do handler hi asal bug the)');
  is(!/function loadV4Form\(\)\{\n  try \{/.test(srcAll), 'purana loadV4Form nikal gaya');

  /* kai keys */
  doc.getElementById('sKey').value = 'AIzaKey_One, AIzaKey_Two';
  try { doc.getElementById('saveSettings').click(); } catch (e) {}
  is(win.settings.apikey === 'AIzaKey_One,AIzaKey_Two', 'Gemini khane mein kai keys comma se save hueen', win.settings.apikey);
  is(win.BRAIN.keys(win.BRAINS.filter(function (b) { return b.id === 'gemini'; })[0]).length === 2, '  → BRAIN POOL ne dono keys pakar leen');

  /* galat khane mein key -> khud sahi jagah */
  doc.getElementById('sKey').value = 'gsk_ye_groq_ki_key_hai';
  doc.getElementById('sGqKey').value = '';
  try { doc.getElementById('saveSettings').click(); } catch (e) {}
  is(win.settings.groqKey === 'gsk_ye_groq_ki_key_hai', 'Gemini khane mein pari GROQ key khud sahi jagah chali gayi', win.settings.groqKey);
  is(win.settings.apikey === '', '  → Gemini khana khaali ho gaya');

  /* gender male na ho to GF mode ka koi matlab nahi */
  doc.getElementById('sGender').value = 'female';
  doc.getElementById('sGf').checked = true;
  try { doc.getElementById('saveSettings').click(); } catch (e) {}
  is(win.settings.gfMode === false, 'Gender female par GF mode khud band (aur wajah batai gayi)');

  /* 🕸️ P6 KHUD-MUKHTAR — poori page boot kar ke (sirf source nahi, ASAL dom) */
  section('12. \uD83D\uDD78\uFE0F KHUD-MUKHTAR (P6) BOOT');
  is(!!win.KHUD, '🕸️ KHUD module poori app ke boot par zinda (koi script nahi toota)');
  is(win.FLAGS.DEF.khud === false, '🔑 khud default OFF — pehle sabit ho, phir chale (Qanoon 1)');
  is(!!doc.getElementById('labKhud'), 'LAB mein 🕸️ KHUD-MUKHTAR ka switch maujood');
  is(doc.getElementById('labKhud').checked === false, '   → aur shuru mein band dikhta hai (jhooti halat nahi)');
  is(!!doc.getElementById('labKhudReport') && !!doc.getElementById('labKhudDry') && !!doc.getElementById('labHaal'),
     'teen button: HAAL report · DRY-RUN · ABHI KA HAAL');
  /* switch ON → asli rawaiya */
  win.FLAGS.set('khud', true);
  doc.getElementById('labKhud').checked = true;
  doc.getElementById('labKhud').dispatchEvent(new win.Event('change'));
  is(win.KHUD.timer !== null, '🔑 switch ON → KHUD ki jhonk chalu (aur purani 6-min chatter band)');
  is(doc.getElementById('labKhudReport').textContent.indexOf('KHUD-MUKHTAR') > 0, 'button ka label saaf hai');
  doc.getElementById('labKhudReport').click();
  var out = doc.getElementById('labOut').textContent;
  is(out.indexOf('KHUD-MUKHTAR') > 0 && out.indexOf('KHAMOSH GHANTE') > 0 && out.indexOf('SURKH') > 0,
     '🕸️ report chalti hai — qanoon apne andar likha (andhi khud-mukhtari nahi)');
  doc.getElementById('labKhudDry').click();
  is(doc.getElementById('labOut').textContent.indexOf('DRY-RUN') > 0, '⚗️ DRY-RUN chalta hai (karega kuch nahi)');
  doc.getElementById('labHaal').click();
  is(doc.getElementById('labOut').textContent.indexOf('ABHI KA HAAL') > 0, '👁️ HAAL button abhi ka haal dikhata hai');
  is(win.KHUD.HAAL.context().indexOf('ABHI KA HAAL') > 0, '🧠 dimaag ko HAAL ja raha hai (prompt line)');
  win.FLAGS.set('khud', false);
  doc.getElementById('labKhud').checked = false;
  doc.getElementById('labKhud').dispatchEvent(new win.Event('change'));
  is(win.KHUD.timer === null && win.KHUD.HAAL.context() === '', '🔒 switch OFF → timer murda, prompt saaf (Qanoon 1)');

  /* 🗣️ v5.10.1 — ON-DEVICE LANGUAGE ka panel (aap ki video wala bug) */
  section('13. \uD83D\uDDE3\uFE0F ON-DEVICE PANEL (v5.10.1)');
  is(!!doc.getElementById('labOnDeviceBox'), '🆕 panel ka apna ghar hai (labOut ke bharose nahi)');
  var oldSrc = srcAll.slice(srcAll.indexOf('var lod = $("#labOnDevice")'), srcAll.indexOf('function onDevicePanel'));
  is(oldSrc.indexOf('KAAN.onDevice()') > 0 && oldSrc.indexOf('openSettingNamed') < 0,
     '🔑 button ab pehle PHONE KI FEHRIST mangta hai (screen ka naam poochhe bagair kholna khatam)');
  doc.getElementById('labOnDevice').click();
  var box = doc.getElementById('labOnDeviceBox');
  is(box.style.display === 'block' && box.textContent.indexOf('purani hai') > 0,
     '🔒 bina bridge (purani APK) → imaandari: "ye APK purani hai" + likha hua raasta');
  /* ab ASLI APK jaisa: bridge maujood — aap ka phone (Google Go, Gboard Go, AiAi nahi) */
  win.MayaBridge = {
    onDeviceMap: function () {
      return JSON.stringify({ sdk: 33, aiai: false, goog: false, ondevice: false, using: 'default',
        svc: 'com.google.android.apps.searchlite/x',
        srv: [{ pkg: 'com.google.android.apps.searchlite', label: 'Google Go', comp: 'a/b' }],
        kb: ['com.google.android.inputmethod.latin.go'], asst: 'Google Go' });
    },
    openSettingNamed: function (k) { win.__opened = k; return k === 'voiceservices' ? 'com.android.settings/.Settings$VoiceInputSettingsActivity' : null; },
    openSetting: function () { return false; }
  };
  doc.getElementById('labOnDevice').click();
  is(box.textContent.indexOf('GBOARD GO') > 0 && box.textContent.indexOf('Google Go') > 0,
     '📋 panel phone ki ASLI fehrist dikhata hai (keyboard + assistant ka naam)');
  is(box.textContent.indexOf('Digital assistant') > 0 && box.textContent.indexOf('HAL NAHI HOTA') > 0,
     '🛑 video ka sabak likha hua: assistant wali screen se ye masla hal NAHI hota');
  var pbtns = box.querySelectorAll('button');
  is(pbtns.length >= 4, 'har darwaze ka apna ASLI button', pbtns.length + ' button');
  var voc = null;
  for (var bi = 0; bi < pbtns.length; bi++) if (pbtns[bi].textContent.indexOf('Voice input') > 0) voc = pbtns[bi];
  is(!!voc, '🎙️ voice-input darwaze ka button maujood');
  if (voc) {
    voc.click();
    is(win.__opened === 'voiceservices', '🔑 button ne wahi darwaza maanga (koi andhi chain nahi)');
    is(doc.getElementById('labOut').textContent.indexOf('VoiceInputSettingsActivity') > 0,
       '🤝 jo screen khuli us ka NAAM likha gaya — "jo screen khuli us mein dhoondo" wala jhoot khatam');
  }
  var gd = null;
  for (var gi = 0; gi < pbtns.length; gi++) if (pbtns[gi].textContent.indexOf('Gboard Go') > 0) gd = pbtns[gi];
  if (gd) {
    win.__opened = null;
    gd.click();
    is(win.__opened === 'gboardvoice', '   → Gboard Go ka button bhi SAHI darwaza maangta hai');
    var lo = doc.getElementById('labOut').textContent;
    is(lo.indexOf('is phone par wo screen maujood nahi') > 0 && lo.indexOf('On-screen keyboard') > 0,
       '🤝 screen na khuli to JHOOT nahi bolta: saaf "maujood nahi" + manual raasta MEHFOOZ (toast 2 sec mein urr jata hai)');
  }

  /* 🛑 v5.10.2 — ghalat (assistant) screen par ab jhoota mashwara NAHI.
     Aap ka saboot: "✅ Jo screen khuli: com.android.settings/.Settings$ManageAssistActivity
     ☝️ Us mein dhoondo: Voice typing → Faster voice typing …" */
  section('14. \uD83D\uDED1 ASSISTANT SCREEN PAR SACH (v5.10.2)');
  win.MayaBridge = {
    onDeviceMap: function () {
      return JSON.stringify({ sdk: 33, aiai: false, goog: false, ondevice: false, using: 'default',
        svc: 'com.google.android.tts/.SpeechRecognitionService',
        srv: [{ pkg: 'com.google.android.tts', label: 'Speech Recognition and Synthesis', comp: 'a/b' }],
        kb: ['com.google.android.inputmethod.latin'], asst: 'Google Go', play: true });
    },
    openSettingNamed: function (k) {
      win.__opened = k;
      if (k === 'voiceservices') return 'com.android.settings/.Settings$ManageAssistActivity';
      if (k === 'gboardvoice') return 'com.google.android.inputmethod.latin/.VoiceSettingsActivity';
      if (String(k).indexOf('appinfo:') === 0) return 'com.android.settings/.Settings$AppDetailsActivity';
      return null;
    }
  };
  doc.getElementById('labOnDevice').click();
  var box2 = doc.getElementById('labOnDeviceBox'), out = doc.getElementById('labOut');
  var bs = box2.querySelectorAll('button'), voc2 = null, gb2 = null, ai2 = null, q;
  for (q = 0; q < bs.length; q++) {
    var tt = bs[q].textContent;
    if (tt.indexOf('Voice input') > 0) voc2 = bs[q];
    else if (tt.indexOf('Voice typing settings') > 0) gb2 = bs[q];
    else if (tt.indexOf('app-info') > 0) ai2 = bs[q];
  }
  is(!!voc2 && !!gb2 && !!ai2, '🆕 teeno darwaze bane (voice input / Gboard voice typing / app-info)');
  voc2.click();
  is(win.__opened === 'voiceservices', '   → button ne wahi darwaza maanga (koi andhi chain nahi)');
  is(out.textContent.indexOf('ManageAssistActivity') > 0 && out.textContent.indexOf('HOTA HI NAHI') > 0,
     '🛑 OEM ne assistant screen thons di to JS KHUD pehchan kar saaf kehta hai (Kotlin block ka doosra qila)');
  is(out.textContent.indexOf('Us mein dhoondo: Voice typing') === -1,
     '🔑🆕 ghalat screen par "Voice typing dhoondo" wala jhoota mashwara KHATAM (aap ka pakda hua bug)');
  gb2.click();
  is(out.textContent.indexOf('VoiceSettingsActivity') > 0 && out.textContent.indexOf('Faster voice typing') > 0,
     '✅ sahi screen par wahi mashwara jo us screen par SACH hai (har darwaze ka apna hint)');
  ai2.click();
  is(out.textContent.indexOf('AppDetailsActivity') > 0 && out.textContent.indexOf('Clear data') > 0,
     '📦 app-info ka apna hint: "Clear data NAHI karna" (warna pack urr jate hain)');

  done();
}, 400);

function done() {
  console.log('\n' + '='.repeat(58));
  console.log(fail === 0
    ? '\u2705 SAB TEST PASS \u2014 ' + pass + '/' + (pass + fail)
    : '\u274C ' + fail + ' TEST FAIL \u2014 ' + pass + '/' + (pass + fail) + ' pass');
  console.log('='.repeat(58));
  process.exit(fail === 0 ? 0 : 1);
}
