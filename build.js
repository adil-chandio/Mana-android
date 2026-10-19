#!/usr/bin/env node
/*
 * MAYA WEB BUILD — web/ se index.html banata hai (WAQT 1 · TEAM STRUCTURE)
 *
 * ─────────────────────────────────────────────────────────────────────
 * DHANCHA (strangler — AMAL Qanoon 2):
 *
 *   web/                    ← SOURCE (team YAHAN likhega)
 *     00-head.html            doctype → pehle <script> se pehle (markup + CSS)
 *     01-boot.js              script block 1 (debug bootstrap) ka andar ka JS
 *     02-main/                script block 2 — 30 modules (sorted concat
 *       00-core.js…29-init.js   EK hi <script> tag ke andar — hoisting safe)
 *     03-obsidian.js          script block 3 (OBSIDIAN UI module) ka andar ka JS
 *     03-obsidian.js          script block 3 (OBSIDIAN UI module) ka andar ka JS
 *     99-tail.html            </body></html>
 *
 *   build.js                ← ye file: parts → poora index.html
 *     app/src/main/assets/web/index.html   (APK ka source of truth)
 *     public/index.html                    (PWA deploy copy)
 *
 * ─────────────────────────────────────────────────────────────────────
 * QANOON: pehla split "verbatim contiguous slices" hai — koi code shift
 * nahi. build.js output BYTE-IDENTICAL hai (tools/test-build-sync.js
 * cmp se saboot deta hai). Kuch bhi tootne ka imkan nahi.
 *
 * USAGE:
 *   node build.js            → assemble + dono jagah likho
 *   node build.js --check    → sirf verify (CI): web/ se dono fresh hain?
 *   node build.js --extract  → (SIRF ek dafa) current index.html → web/ parts
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const WEB = path.join(ROOT, 'web');
const APP_OUT = path.join(ROOT, 'app', 'src', 'main', 'assets', 'web', 'index.html');
const PUB_OUT = path.join(ROOT, 'public', 'index.html');

const HEAD = '00-head.html';
const TAIL = '99-tail.html';
const OPEN = '<script>';
const CLOSE = '</script>';

/* Script parts ka tartib — naam se sort (01, 02, 03 ...)
 *
 *   ek FILE  (jaise 01-boot.js)  = ek poora <script> block
 *   ek DIR   (jaise 02-main/)    = ek <script> block, andar ke sorted
 *     .js fragments ek sath jod kar (function hoisting wahi rahe —
 *     is liye 02-main/ ke fragments KABHI alag script tags nahi bante)
 */
function scriptParts() {
  return fs.readdirSync(WEB)
    .filter(function (f) {
      return /^\d\d-/.test(f) && (f.endsWith('.js') || fs.statSync(path.join(WEB, f)).isDirectory());
    })
    .sort();
}

function blockContent(name) {
  const p = path.join(WEB, name);
  if (fs.statSync(p).isDirectory()) {
    return fs.readdirSync(p).filter(function (f) { return f.endsWith('.js'); }).sort()
      .map(function (f) { return fs.readFileSync(path.join(p, f), 'utf8'); })
      .join('');
  }
  return fs.readFileSync(p, 'utf8');
}

/* Original file ka fabric:
 *   head + OPEN+p1+CLOSE + GAP + OPEN+p2+CLOSE + GAP + OPEN+p3+CLOSE + tail
 * GAP = "\n\n" (</script> ke baad ek blank line, phir <script>)
 * tail = "\n</body>\n</html>\n"
 * Part file (.js) = OPEN aur CLOSE ke DARMiyan ke EXACT bytes
 * (yani "\n" se shuru, "\n" par khatam)                                    */
const GAP = '\n\n';

function assemble() {
  const parts = scriptParts();
  if (!parts.length) throw new Error('web/ mein koi script part nahi mila');
  let out = fs.readFileSync(path.join(WEB, HEAD), 'utf8');
  parts.forEach(function (p, i) {
    out += OPEN + blockContent(p) + CLOSE;
    out += (i < parts.length - 1) ? GAP : '';
  });
  out += fs.readFileSync(path.join(WEB, TAIL), 'utf8');
  return out;
}

function writeOutputs(html) {
  fs.writeFileSync(APP_OUT, html);
  fs.writeFileSync(PUB_OUT, html);
  /* sw.js + manifest.json — assets → public copy (PWA deploy) */
  const assetsDir = path.dirname(APP_OUT);
  ['sw.js', 'manifest.json'].forEach(function (f) {
    const s = path.join(assetsDir, f);
    if (fs.existsSync(s)) fs.copyFileSync(s, path.join(ROOT, 'public', f));
  });
}

/* ── --extract: current index.html → web/ parts (one-time bootstrap) ── */
function extract() {
  if (fs.existsSync(path.join(WEB, '02-main')) || fs.existsSync(path.join(WEB, '02-main.js'))) {
    console.error('⚠️ web/ pehle se bana hua hai — extract khatarnak hai (overwrite). Band.');
    process.exit(1);
  }
  const src = fs.readFileSync(APP_OUT, 'utf8');

  const starts = [];
  let idx = 0;
  while (true) {
    const i = src.indexOf(OPEN, idx);
    if (i < 0) break;
    starts.push(i);
    idx = i + 1;
  }
  if (starts.length !== 3) {
    console.error('UMMEED: 3 <script> blocks · MILA: ' + starts.length + ' — extract band');
    process.exit(1);
  }
  const bodyEnd = src.indexOf('</body>');
  if (bodyEnd < 0) { console.error('</body> nahi mila'); process.exit(1); }

  /* contiguous slices — in ka join hamesha byte-identical */
  const head = src.slice(0, starts[0]);

  function blockInner(start) {
    const closeAt = src.indexOf(CLOSE, start + OPEN.length);
    return src.slice(start + OPEN.length, closeAt);
  }
  function blockAfter(start) {
    const closeAt = src.indexOf(CLOSE, start + OPEN.length);
    return closeAt + CLOSE.length; // index just after </script>
  }

  const p1 = blockInner(starts[0]);
  const p2 = blockInner(starts[1]);
  const p3 = blockInner(starts[2]);
  const tail = src.slice(blockAfter(starts[2]));

  fs.mkdirSync(WEB, { recursive: true });
  fs.writeFileSync(path.join(WEB, HEAD), head);
  fs.writeFileSync(path.join(WEB, '01-boot.js'), p1);
  fs.writeFileSync(path.join(WEB, '02-main.js'), p2); /* legacy shape — ab 02-main/ dir use hota hai */
  fs.writeFileSync(path.join(WEB, '03-obsidian.js'), p3);
  fs.writeFileSync(path.join(WEB, TAIL), tail);

  /* GAP verify — agar original mein blank line ke bajaye kuch aur ho to
     assemble ghalat hoga, is liye yahan hi sach check karo */
  const gap1 = src.slice(blockAfter(starts[0]), starts[1]);
  const gap2 = src.slice(blockAfter(starts[1]), starts[2]);
  if (gap1 !== GAP || gap2 !== GAP) {
    console.error('⚠️ GAP wahi nahi jo ummeed thi — build.js ka GAP badlo');
    console.error('gap1=' + JSON.stringify(gap1) + ' gap2=' + JSON.stringify(gap2));
    process.exit(1);
  }

  console.log('✅ EXTRACT — web/ parts ban gaye:');
  console.log('   00-head.html · 01-boot.js · 02-main.js · 03-obsidian.js · 99-tail.html');
}

/* ── main ── */
const mode = process.argv[2] || '';
if (mode === '--extract') {
  extract();
  process.exit(0);
}

const html = assemble();

if (mode === '--check') {
  let ok = true;
  const app = fs.readFileSync(APP_OUT, 'utf8');
  const pub = fs.readFileSync(PUB_OUT, 'utf8');
  if (app !== html) {
    console.error('❌ assets/web/index.html web/ se PURANA hai — `node build.js` chalao');
    ok = false;
  }
  if (pub !== html) {
    console.error('❌ public/index.html web/ se PURANA hai — `node build.js` chalao');
    ok = false;
  }
  if (ok) console.log('✅ BUILD CHECK — web/ se dono index.html fresh + identical');
  process.exit(ok ? 0 : 1);
}

writeOutputs(html);
console.log('✅ BUILD — index.html ban gaya (' + html.length + ' bytes) → assets + public');
