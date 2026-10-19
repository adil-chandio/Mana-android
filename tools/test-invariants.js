/*
 * test-invariants.js — AMAL QANOON 4: wo baatein jo KABHI nahi toot saktin
 *
 * 3 hisse:
 *   🔒 SECURITY  — keystore/password kabhi code mein wapas na aaye
 *   🏷️ VERSION   — sab jagah EK version (test-lab bhi lock karta hai, ye cross-check)
 *   🛡️ SAFETY    — guardrails + naye features ke taale (SMART_PRO, scroll, update)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
function is(cond, msg) {
  if (cond) { pass++; console.log('  \u2705 ' + msg); }
  else { fail++; console.log('  \u274C ' + msg); }
}

console.log('\n\ud83e\udee1 INVARIANTS — jo kabhi nahi toot saktin');

/* ═══ 1. SECURITY ═══ */
const gradle = read('app/build.gradle');
const gitignore = read('.gitignore');
is(!/maya2026adil/.test(gradle), 'build.gradle mein password NAHI hai');
is(!/storePassword\s+"/.test(gradle), 'build.gradle mein plain-text storePassword NAHI');
is(/keystore\.properties/.test(gradle) || /MAYA_KEYSTORE_/.test(gradle), 'signing keystore.properties / CI env se aata hai');
is(/keystore\.properties/.test(gitignore) && /\*\.keystore/.test(gitignore), '.gitignore: keystore.properties + *.keystore blocked');
let tracked = '';
try {
  tracked = execFileSync('git', ['ls-files', 'app/maya.keystore'], { cwd: ROOT, encoding: 'utf8' }).trim();
} catch (e) { tracked = 'ERR'; }
is(tracked === '', 'maya.keystore git mein TRACKED nahi hai');
const wf = read('.github/workflows/build-apk.yml');
is(/npm test/.test(wf) && /needs: test/.test(wf), 'CI: APK build SE PEHLE npm test gate hai');

/* ═══ 2. VERSION — sab jagah ek ═══ */
const pkgVer = JSON.parse(read('package.json')).version;
const updVer = (read('web/02-main/31-auto-update.js').match(/VER: "([^"]+)"/) || [])[1];
const gradleVer = (gradle.match(/versionName "([^"]+)"/) || [])[1];
const swCache = (read('app/src/main/assets/web/sw.js').match(/maya-v([\d.]+)/) || [])[1];
const hudVer = (read('web/03-obsidian.js').match(/hudBuild"\).textContent = "v([^"]+)"/) || [])[1];
const appVer = (read('app/src/main/java/com/maya/ai/MainActivity.kt').match(/appVersion\(\): String = "([^"]+)-native"/) || [])[1];
is(!!pkgVer && pkgVer === updVer && pkgVer === gradleVer && pkgVer === swCache && pkgVer === hudVer && pkgVer === appVer,
   'VERSION ek jaisa: ' + pkgVer + ' (package.json · UPDATE_CHECK · gradle · sw.js · hud · Kotlin)');

/* ═══ 3. SAFETY + NAYE FEATURES ═══ */
const act = read('app/src/main/java/com/maya/ai/MayaAct.kt');
is(/BLOCKED_PKGS/.test(act) && /MAX_PER_MINUTE = 10/.test(act), 'MayaAct: banking block + rate limit zinda');
is(/ruk jao/.test(read('web/02-main/21-amal-tools.js')), 'kill words ("ruk jao") zinda');

const smart = read('web/02-main/30-smart-pro.js');
is(/MAX_PER_DAY: 3/.test(smart) && /QUIET_START: 23/.test(smart) && /IDLE_MIN_MS/.test(smart),
   'SMART_PRO: roz max 3 + quiet hours + idle gate');
is(/reasonSchedule/.test(smart) && /reasonHabit/.test(smart) && /reasonMorning/.test(smart),
   'SMART_PRO: wajah-based (schedule · aadat · morning) — random nahi');
let proLinesFound = false;
fs.readdirSync(path.join(ROOT, 'web')).forEach(function () {});
['web/03-obsidian.js'].concat(fs.readdirSync(path.join(ROOT, 'web', '02-main')).map(function (f) { return 'web/02-main/' + f; }))
  .forEach(function (f) { if (/var PRO_LINES = \[/.test(read(f))) proLinesFound = true; });
is(!proLinesFound, 'purana RANDOM PRO_LINES engine MITA hua (bay-maqsaad shor khatam)');

is(/"scroll \| type/.test(read('web/02-main/12-tools.js')) || /tap \| type \| swipe \| scroll \| back \| stop/.test(read('web/02-main/12-tools.js')),
   'maya_act TOOL_DECL: scroll + dir registered');
is(/"scroll" ->/.test(act) && /optString\("dir"/.test(act), 'Kotlin MayaAct: direction scroll implemented');

is(/UPDATE_CHECK = \{/.test(read('web/02-main/31-auto-update.js')) && /btnUpdCheck/.test(read('web/00-head.html')),
   'UPDATE-CHECK: engine + LAB button dono maujood');
is(/MAX: 1000/.test(read('web/02-main/17-ijazat-ledger.js')), 'LEDGER.MAX = 1000 (aadat mining ke liye)');

/* ═══ 4. UPDATE-SAFE APK (settings kabhi na udein) ═══ */
is(/debug\.keystore/.test(wf) && /actions\/cache/.test(wf),
   'CI: debug keystore CACHED — har APK ek hi key (update install, settings safe)');
const wfRel = read('.github/workflows/release-apk.yml');
is(/debug\.keystore/.test(wfRel) && /actions\/cache/.test(wfRel),
   'release-apk.yml: wohi cached key (dono workflows ek signature)');
is(/labBackup/.test(read('web/00-head.html')) && /saveTextToDownloads/.test(read('app/src/main/java/com/maya/ai/MainActivity.kt')) && /readText/.test(read('app/src/main/java/com/maya/ai/MainActivity.kt')),
   'SETTINGS BACKUP/RESTORE zinda (LAB buttons + Kotlin file I/O)');
is(/settingsBackup|labBackup/.test(read('web/02-main/25-lab-ui.js')) && /maya-settings/i.test(read('web/02-main/25-lab-ui.js')),
   'BACKUP/RESTORE handlers wired (maya-settings*.json)');
is(/downloadApk/.test(read('app/src/main/java/com/maya/ai/MainActivity.kt')) && /installApk/.test(read('app/src/main/java/com/maya/ai/MainActivity.kt')),
   'ONE-TAP UPDATE: downloadApk + installApk bridge zinda');
is(/REQUEST_INSTALL_PACKAGES/.test(read('app/src/main/AndroidManifest.xml')),
   'manifest: REQUEST_INSTALL_PACKAGES (install prompt)');
is(/verOf/.test(read('web/02-main/31-auto-update.js')) && /version:\\s\*/.test(read('web/02-main/31-auto-update.js')),
   'UPDATE detect: floating "latest" tag — notes se version (fallback chain)');
is(/version: \$VER/.test(wf),
   'release notes mein version line (app update check padhta hai)');
is(/SIGNATURE LOCK/.test(wf) && /SIGNATURE LOCK/.test(wfRel) && /apksigner/.test(wf),
   'SIGNATURE LOCK gate — APK ke asle cert se pin check (dono workflows)');
let pinState = 'missing';
try {
  const pinTxt = read('docs/signing-cert-sha256.txt');
  pinState = /[0-9a-f]{64}/.test(pinTxt) ? 'locked' : 'garbage';
} catch (e) { pinState = 'missing'; }
is(pinState === 'locked' || pinState === 'missing',
   'SIGNATURE PIN — ya 64-hex locked, ya bootstrap mode (missing); garbage kabhi nahi');
is(/pin bootstrap/.test(wf) && /pin bootstrap/.test(wfRel),
   'auto-pin bootstrap — CI khud pin commit karta hai ([skip ci])');

console.log('');
if (fail) {
  console.log('\u274C INVARIANTS — ' + fail + ' toot gayin / ' + pass + ' zinda');
  process.exit(1);
}
console.log('\u2705 SAB TEST PASS — ' + pass + '/' + (pass + fail));
