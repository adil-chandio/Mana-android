#!/usr/bin/env node
/* ============================================================================
   MAYA — ONBOARDING + MEGA DOCTOR TEST (WAQT 4-A)
   Locks:
     • wizard: APK-only auto-start, skip-able, onboarded flag, settings save
     • permissions rows → asle bridges (micPerm/requestMicPerm/notif/a11y/batt)
     • MEGA DOCTOR: versions + masked keys + services + UI + shareable text
     • keys masked (report mein raw keys kabhi nahi)
     • ES5 safe
   ========================================================================= */
'use strict';

var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..');
function read(f) { return fs.readFileSync(path.join(ROOT, f), 'utf8'); }

var pass = 0, fail = 0;
function is(cond, name, extra) {
  if (cond) { pass++; console.log('  \u2705 ' + name + (extra ? '  \u2014 ' + extra : '')); }
  else { fail++; console.log('  \u274C ' + name + (extra ? '  \u2014 ' + extra : '')); }
}

var ob = read('web/02-main/34-onboard.js');
var init = read('web/02-main/29-init.js');
var lab = read('web/02-main/25-lab-ui.js');
var head = read('web/00-head.html');
var kt = read('app/src/main/java/com/maya/ai/MainActivity.kt');

console.log('\n\u001B[35m\u001B[1m===== \uD83C\uDF05 ONBOARDING + \uD83E\uDE7A MEGA DOCTOR =====\u001B[0m');

console.log('\n1. \uD83C\uDF05 Onboarding wizard');
is(/var ONBOARD = \{/.test(ob), 'ONBOARD module maujood');
is(/settings\.onboarded/.test(ob), 'onboarded flag — dobara kabhi nahi');
is(/typeof NATIVE === "undefined" \|\| !NATIVE\) return false/.test(ob), 'sirf APK — jsdom/tests kabhi block nahi');
is(/ONBOARD\.maybeStart/.test(init), 'boot par auto-start (29-init.js)');
is(/ONBOARD\.close\(false\)/.test(ob) && /skip/.test(ob), 'har step skip-able');
is(/requestMicPerm/.test(ob) && /openNotifAccess/.test(ob) && /requestBatteryUnrestricted/.test(ob) && /openAccessibilitySettings/.test(ob), 'permission rows → asle bridges');
is(/micPerm/.test(kt) && /requestMicPerm/.test(kt), 'Kotlin: micPerm + requestMicPerm bridge');
is(/saveSettings\(\)/.test(ob), 'name/keys save hote hain');
is(/id="labOnboard"/.test(head) && /labOnboard/.test(lab), 'LAB se dobara chalane ka button');

console.log('\n2. \uD83E\uDE7A MEGA DOCTOR');
is(/var MAYADOCTOR = \{/.test(ob), 'MAYADOCTOR module maujood');
is(/mega: function/.test(ob), 'mega() report builder');
is(/UPDATE_CHECK\.VER/.test(ob) && /appVersion/.test(ob), 'versions (web + native)');
is(/slice\(0, 3\)/.test(ob), 'keys MASKED (sirf 3 harf + aakhir 2)');
is(!/line\("  Groq[^"]*"\s*\+\s*settings\.groqKey/.test(ob), 'raw keys report mein NAHI');
is(/accessibilityEnabled/.test(ob) && /notifEnabled/.test(ob) && /batteryUnrestricted/.test(ob), 'services checks (a11y/notif/battery)');
is(/MayaUI\.selfTest/.test(ob), 'UI selfTest included');
is(/__errLog/.test(ob), 'console errors count');
is(/id="labMegaDoc"/.test(head) && /labMegaDoc/.test(lab), 'LAB button + handler wired');

console.log('\n3. \uD83D\uDD12 ES5 + safety');
is(!/\blet\s|\bconst\s|=>|`/.test(ob), '34-onboard.js ES5-safe');
is(/try \{/.test(ob), 'defensive try/catch (kabhi boot nahi todta)');

console.log('');
if (fail) {
  console.log('\u001B[31m\u001B[1m\u274C ' + fail + ' TEST FAIL — ' + pass + '/' + (pass + fail) + ' pass\u001B[0m');
  process.exit(1);
} else {
  console.log('\u001B[32m\u001B[1m\u2705 SAB TEST PASS — ' + pass + '/' + (pass + fail) + '\u001B[0m');
}
