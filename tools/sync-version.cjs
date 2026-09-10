#!/usr/bin/env node
'use strict';
// public/ is the editable web source. Android receives exact packaged copies.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
process.chdir(root);
const v = JSON.parse(fs.readFileSync('release/version.json', 'utf8'));
if (!/^\d+\.\d+\.\d+$/.test(v.versionName) || !Number.isInteger(v.versionCode) || v.versionCode < 1 || v.versionCode > 2100000000 || v.minSdk !== 26)
  throw Error('Invalid release/version.json');
const check = process.argv.includes('--check');
function output(file, value) {
  const old = fs.existsSync(file) ? fs.readFileSync(file) : null;
  const next = Buffer.from(value);
  if (old && old.equals(next)) return;
  if (check) throw Error(`Out of sync: ${file}. Run npm run version:sync.`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, next);
}
let html = fs.readFileSync('public/index.html', 'utf8');
html = html.replace(/<span data-build-version>v[^<]+<\/span>/g, `<span data-build-version>v${v.versionName}</span>`)
  .replace(/var MAYA_BUILD = \{ versionName: "[^"]+", versionCode: \d+ \};/, `var MAYA_BUILD = { versionName: "${v.versionName}", versionCode: ${v.versionCode} };`)
  .replace(/MAYA v\d+\.\d+\.\d+/g, `MAYA v${v.versionName}`)
  .replace(/v\d+\.\d+\.\d+ · OK/g, `v${v.versionName} · OK`)
  .replace(/"v\d+\.\d+\.\d+ OK/g, `"v${v.versionName} OK`)
  .replace(/textContent = "v\d+\.\d+\.\d+"/g, `textContent = "v${v.versionName}"`);
output('public/index.html', html);
output('public/sw.js', fs.readFileSync('public/sw.js', 'utf8').replace(/var CACHE = 'maya-v[^']+';/, `var CACHE = 'maya-v${v.versionName}';`));
for (const file of ['index.html', 'sw.js', 'manifest.json', 'favicon.svg', 'icons/icon-96.svg', 'icons/icon-192.svg', 'icons/icon-512.svg']) {
  const bytes = file === 'index.html' ? html : fs.readFileSync(`public/${file}`);
  output(`app/src/main/assets/web/${file}`, bytes);
}
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')); pkg.version = v.versionName;
output('package.json', JSON.stringify(pkg, null, 2) + '\n');
if (fs.existsSync('package-lock.json')) {
  const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
  lock.version = v.versionName; lock.packages[''].version = v.versionName;
  output('package-lock.json', JSON.stringify(lock, null, 2) + '\n');
}
console.log(`Version and packaged web assets ${check ? 'verified' : 'synced'}: ${v.versionName} (${v.versionCode})`);
