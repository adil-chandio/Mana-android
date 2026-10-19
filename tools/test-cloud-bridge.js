#!/usr/bin/env node
/* ============================================================================
   MAYA — CLOUD BRIDGE TEST (WAQT 3-B) — NTFY + MEMORY CLOUD
   ----------------------------------------------------------------------------
   Locks:
     • NTFY: topic-guard, no hardcoded topic, hooks wired (pro/battery/safety)
     • MEMCLOUD: AES-GCM + PBKDF2, encrypt-before-push, whitelist-only yaad,
       keys/tokens KABHI cloud par nahi, crypto.subtle guard
     • settings wiring (DEFAULTS + SET_FIELDS + HTML rows + LAB handlers)
     • ES5 safe (purane WebView)
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

var ntfy = read('web/02-main/32-ntfy-bridge.js');
var mem = read('web/02-main/33-memory-cloud.js');
var amal = read('web/02-main/21-amal-tools.js');
var pro = read('web/02-main/30-smart-pro.js');
var lab = read('web/02-main/25-lab-ui.js');
var core = read('web/02-main/00-core.js');
var form = read('web/02-main/24-setform.js');
var head = read('web/00-head.html');

console.log('\n\u001B[35m\u001B[1m===== \uD83C\uDF10 CLOUD BRIDGE — NTFY + MEMORY CLOUD =====\u001B[0m');

/* ── 1. NTFY ── */
console.log('\n1. \uD83D\uDD14 NTFY — free alerts');
is(/var NTFY = \{/.test(ntfy), 'NTFY module maujood');
is(/ntfyOn/.test(ntfy) && /ntfyTopic/.test(ntfy), 'NTFY ready(): switch + topic dono check');
is(/\^\[A-Za-z0-9_-\]\{6,64\}\$/.test(ntfy), 'topic format guard (random topic, 6-64 harf)');
is(/https:\/\/ntfy\.sh\//.test(ntfy), 'ntfy.sh endpoint');
is(ntfy.indexOf('maya-7f3k9x2') < 0 || /Math\.random/.test(ntfy), 'koi hardcoded topic nahi (sirf example)');
is(/__ntfyPro/.test(ntfy) && /__ntfyPro/.test(pro), 'proactive hook wired (SMART_PRO → NTFY)');
is(/__ntfyBattery/.test(ntfy) && /__ntfyBattery/.test(amal), 'battery hook wired (AMAL-tools → NTFY)');
is(/__ntfySafety/.test(ntfy) && /__ntfySafety/.test(amal), 'safety-stop hook wired (kill-switch → NTFY)');
is(/NTFY\.send/.test(ntfy) && /ready\(\)/.test(ntfy), 'send() ready-guard ke bagair nahi');

/* ── 2. MEMCLOUD ── */
console.log('\n2. \u2601\uFE0F MEMORY CLOUD — encrypted yaad backup');
is(/var MEMCLOUD = \{/.test(mem), 'MEMCLOUD module maujood');
is(/AES-GCM/.test(mem) && /PBKDF2/.test(mem), 'AES-GCM + PBKDF2 (mazboot encryption)');
is(/subtle/.test(mem) && /crypto\.subtle/.test(mem), 'crypto.subtle guard — bina encryption plaintext KABHI nahi');
is(mem.indexOf('MEMCLOUD.subtle()') >= 0 && /if \(!MEMCLOUD\.subtle\(\)\)/.test(mem), 'backup subtle-check ke bagair nahi');
is(/MEMCLOUD\.encrypt/.test(mem) && /_gh\("PUT"/.test(mem), 'backup: encrypt → PUT (ciphertext hi jata hai)');
var encIdx = mem.indexOf('MEMCLOUD.encrypt');
var putIdx = mem.indexOf('_gh("PUT"');
is(encIdx > 0 && putIdx > encIdx, 'taqreeb: encrypt PEHLE, PUT BAAD mein', 'enc@' + encIdx + ' put@' + putIdx);
is(/MEMCLOUD\.decrypt/.test(mem), 'restore: decrypt (cloud code se)');
is(/YAAD_KEYS: \["maya_facts", "maya_diary", "maya_summary", "maya_ledger"\]/.test(mem), 'yaad whitelist — sirf facts/diary/summary/ledger');
is(!/YAAD_KEYS: \[[^\]]*(ghKey|apikey|groqKey|fishKey|ttsKey)/.test(mem), 'keys/tokens whitelist mein NAHI');
is(/indexOf\(k\) < 0/.test(mem), 'restore par bhi whitelist — anjaan key andar nahi');
is(/120000|12000/.test(mem), 'PBKDF2 iterations mojood');
is(/getRandomValues/.test(mem), 'har backup ka salt/IV random');

/* ── 3. Settings wiring ── */
console.log('\n3. \u2699\uFE0F Settings + LAB wiring');
is(/ntfyTopic:""/.test(core) && /ntfyOn:false/.test(core) && /cloudCode:""/.test(core), 'DEFAULTS: ntfyTopic + ntfyOn + cloudCode');
is(/sNtfyTopic/.test(form) && /sNtfyOn/.test(form) && /sCloudCode/.test(form), 'SET_FIELDS: teeno fields');
is(/id="sNtfyTopic"/.test(head) && /id="sNtfyOn"/.test(head) && /id="sCloudCode"/.test(head), 'HTML rows: topic + switch + cloud code');
is(/id="labNtfyTest"/.test(head) && /id="labCloudBackup"/.test(head) && /id="labCloudRestore"/.test(head) && /id="labCloudInfo"/.test(head), 'LAB buttons: test + backup + restore + info');
is(/\$\("#labNtfyTest"\)/.test(lab) && /\$\("#labCloudBackup"\)/.test(lab) && /\$\("#labCloudRestore"\)/.test(lab), 'handlers wired (25-lab-ui.js)');
is(/confirm\(/.test(lab), 'restore se pehle confirm (data badal sakta hai)');

/* ── 4. ES5 safety ── */
console.log('\n4. \uD83D\uDD12 ES5 — purane WebView');
function es5Safe(src, name) {
  var bad = /\blet\s|\bconst\s|=>|`/.test(src);
  is(!bad, name + ' ES5-safe (let/const/arrow/template nahi)');
}
es5Safe(ntfy, '32-ntfy-bridge.js');
es5Safe(mem, '33-memory-cloud.js');

console.log('');
if (fail) {
  console.log('\u001B[31m\u001B[1m\u274C ' + fail + ' TEST FAIL — ' + pass + '/' + (pass + fail) + ' pass\u001B[0m');
  process.exit(1);
} else {
  console.log('\u001B[32m\u001B[1m\u2705 SAB TEST PASS — ' + pass + '/' + (pass + fail) + '\u001B[0m');
}
