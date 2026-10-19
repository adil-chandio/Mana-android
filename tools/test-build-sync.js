/*
 * test-build-sync.js — WEB BUILD PIPELINE ka taala (WAQT 1)
 *
 * Qanoon: web/ = SOURCE · index.html (assets + public) = BUILD OUTPUT.
 *   1. dono outputs ek doosre se identical
 *   2. `node build.js --check` pass (web/ se fresh hain)
 *   3. web/ ke 5 parts maujood
 *   4. extract seams salamat: 3 <script> blocks, "use strict" jahan tha
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
function is(cond, msg) {
  if (cond) { pass++; console.log('  \u2705 ' + msg); }
  else { fail++; console.log('  \u274C ' + msg); }
}

console.log('\n\ud83e\uddea BUILD SYNC — web/ \u2192 index.html pipeline');

const PUB = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
const APP = fs.readFileSync(path.join(ROOT, 'app', 'src', 'main', 'assets', 'web', 'index.html'), 'utf8');
is(PUB === APP, 'public/index.html aur assets copy identical hain');

const WEB = path.join(ROOT, 'web');
['00-head.html', '01-boot.js', '03-obsidian.js', '99-tail.html'].forEach(function (f) {
  is(fs.existsSync(path.join(WEB, f)), 'web/' + f + ' maujood hai');
});
is(fs.existsSync(path.join(WEB, '02-main')) && fs.statSync(path.join(WEB, '02-main')).isDirectory(),
   'web/02-main/ (module dir) maujood hai');
const frags = fs.readdirSync(path.join(WEB, '02-main')).filter(function (f) { return f.endsWith('.js'); }).sort();
is(frags.length >= 30, '02-main/ ke fragments: ' + frags.length + ' (kam az kam 30)');
is(frags.join(',') === '00-core.js,01-boot-bridge.js,02-voice-artists.js,03-awaaz.js,04-lab-core.js,05-suno.js,06-boli.js,07-edge-tts.js,08-fish-audio.js,09-api-chat.js,10-local-commands.js,11-timers-weather.js,12-tools.js,13-never-stop.js,14-brain-pool.js,15-dimaag.js,16-nazar-bijli.js,17-ijazat-ledger.js,18-haqeeqat.js,19-amal-engine.js,20-skills-vision.js,21-amal-tools.js,22-kaan-sukoon.js,23-ui-tabs.js,24-setform.js,25-lab-ui.js,26-fish-edge-ui.js,27-studio-diag.js,28-live-badges.js,29-init.js,30-smart-pro.js,31-auto-update.js',
   'fragment ke naam tartib ke saath (32 modules)');

let checkOk = false;
try {
  execFileSync(process.execPath, [path.join(ROOT, 'build.js'), '--check'], { stdio: 'pipe' });
  checkOk = true;
} catch (e) { checkOk = false; }
is(checkOk, 'build.js --check pass: dono outputs web/ se FRESH hain');

/* seams: output mein 3 <script> blocks, aur "use strict" wale blocks zinda */
const opens = (PUB.match(/<script>/g) || []).length;
const closes = (PUB.match(/<\/script>/g) || []).length;
is(opens === 3 && closes === 3, 'output mein 3 <script> blocks (scripts: ' + opens + ')');
is(/<script>\n"use strict";\n\/\* ================= MAYA v2\.1\.1/.test(PUB),
   'main block ka "use strict" + header seam par salamat');
is(/<script>\n"use strict";\n\/\* ================= MAYA v4\.0 OBSIDIAN/.test(PUB),
   'obsidian block ka "use strict" + header seam par salamat');
is(/window\.__errLog = \[\];/.test(PUB), 'boot block (debug eyes) output mein hai');

console.log('');
if (fail) {
  console.log('\u274C BUILD SYNC — ' + fail + ' fail / ' + pass + ' pass');
  process.exit(1);
}
console.log('\u2705 SAB TEST PASS — ' + pass + '/' + (pass + fail));
