#!/usr/bin/env node
'use strict';
// Release tooling: private material is read only from the process environment.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const REPO = 'adil-chandio/Mana-android';
const PACKAGE = 'com.maya.ai';
const MAX_APK = 150 * 1024 * 1024;

function publicKey(privatePem) {
  const key = crypto.createPrivateKey(privatePem || '');
  if (key.asymmetricKeyType !== 'rsa' || key.asymmetricKeyDetails.modulusLength < 3072)
    throw Error('Metadata signing requires an RSA key of at least 3072 bits');
  return crypto.createPublicKey(key).export({ type: 'spki', format: 'der' }).toString('base64');
}
function validate(m) {
  if (m.schema !== 1 || m.repository !== REPO || m.packageName !== PACKAGE) throw Error('Wrong update protocol or application');
  if (!/^\d+\.\d+\.\d+$/.test(m.versionName) || !Number.isInteger(m.versionCode) || m.versionCode < 1 || m.versionCode > 2100000000) throw Error('Invalid version');
  if (!['stable', 'beta'].includes(m.channel)) throw Error('Invalid channel');
  if (m.tag !== `v${m.versionName}-${m.channel}.${m.versionCode}`) throw Error('Invalid release tag');
  if (!Number.isInteger(m.minSdk) || m.minSdk < 26 || m.minSdk > 1000) throw Error('Invalid minimum Android');
  if (!Number.isInteger(m.apkSize) || m.apkSize < 1 || m.apkSize > MAX_APK) throw Error('Invalid APK size');
  if (![m.sha256, m.signerSha256].every(v => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v))) throw Error('Invalid hash');
  if (m.apkUrl !== `https://github.com/${REPO}/releases/download/${m.tag}/MAYA.apk`) throw Error('Wrong APK URL');
  if (typeof m.notes !== 'string' || m.notes.length < 1 || m.notes.length > 6000) throw Error('Invalid release notes');
  if (!Array.isArray(m.tests) || m.tests.length < 1 || m.tests.length > 20 || !m.tests.every(t => typeof t === 'string' && t.length > 0 && t.length <= 300)) throw Error('Invalid test checklist');
  if (typeof m.commit !== 'string' || !/^[a-f0-9]{40}$/.test(m.commit)) throw Error('Invalid source commit');
  return m;
}
function signManifest(m, privatePem) {
  validate(m);
  publicKey(privatePem);
  const bytes = Buffer.from(JSON.stringify(m, null, 2) + '\n');
  if (bytes.length > 65536) throw Error('Metadata too large');
  return { bytes, signature: crypto.sign('RSA-SHA256', bytes, privatePem) };
}
function inspectApk(apk, buildTools) {
  const badging = cp.execFileSync(path.join(buildTools, 'aapt'), ['dump', 'badging', apk], { encoding: 'utf8' });
  const pkg = /package: name='([^']+)' versionCode='([^']+)' versionName='([^']+)'/.exec(badging);
  const sdk = /sdkVersion:'(\d+)'/.exec(badging);
  if (!pkg || !sdk || /application-debuggable/.test(badging)) throw Error('Invalid or debuggable APK');
  const output = cp.execFileSync(path.join(buildTools, 'apksigner'), ['verify', '--verbose', '--print-certs', apk], { encoding: 'utf8' });
  const signers = [...output.matchAll(/^Signer #(\d+) certificate SHA-256 digest: ([a-fA-F0-9]{64})$/gm)];
  if (signers.length !== 1) throw Error('Expected exactly one verified APK signer');
  return { packageName: pkg[1], versionCode: Number(pkg[2]), versionName: pkg[3], minSdk: Number(sdk[1]), signerSha256: signers[0][2].toLowerCase() };
}
function prepare({ apk, channel, out, buildTools, commit, privatePem, expectedSigner }) {
  const version = JSON.parse(fs.readFileSync('release/version.json', 'utf8'));
  const inspected = inspectApk(apk, buildTools);
  if (inspected.packageName !== PACKAGE || inspected.versionCode !== version.versionCode || inspected.versionName !== version.versionName || inspected.minSdk !== version.minSdk) throw Error('APK identity does not match release/version.json');
  if (!/^[a-f0-9]{64}$/.test(expectedSigner || '') || expectedSigner !== inspected.signerSha256) throw Error('APK signer does not match the explicitly configured installed-app identity');
  const info = fs.statSync(apk);
  if (info.size < 1 || info.size > MAX_APK) throw Error('APK size exceeds policy');
  const tag = `v${version.versionName}-${channel}.${version.versionCode}`;
  const m = validate({ schema: 1, repository: REPO, packageName: PACKAGE, ...version, channel, tag,
    apkUrl: `https://github.com/${REPO}/releases/download/${tag}/MAYA.apk`, apkSize: info.size,
    sha256: crypto.createHash('sha256').update(fs.readFileSync(apk)).digest('hex'), signerSha256: inspected.signerSha256,
    notes: fs.readFileSync('release/notes.md', 'utf8').trim(), tests: JSON.parse(fs.readFileSync('release/tests.json', 'utf8')), commit });
  const signed = signManifest(m, privatePem);
  fs.mkdirSync(out, { recursive: true });
  fs.copyFileSync(apk, path.join(out, 'MAYA.apk'));
  fs.writeFileSync(path.join(out, 'update.json'), signed.bytes);
  fs.writeFileSync(path.join(out, 'update.sig'), signed.signature);
  console.log(`Prepared ${tag}. Signed metadata + verified APK. No release was published by this command.`);
}
module.exports = { validate, publicKey, signManifest, inspectApk, prepare };
if (require.main === module) {
  try {
    if (process.argv[2] === 'public-key') console.log(publicKey(process.env.MAYA_UPDATE_SIGNING_KEY));
    else if (process.argv[2] === 'prepare') prepare({ apk: process.argv[3], channel: process.argv[4], out: process.argv[5], buildTools: process.env.MAYA_BUILD_TOOLS, commit: process.env.GITHUB_SHA,
      privatePem: process.env.MAYA_UPDATE_SIGNING_KEY, expectedSigner: process.env.MAYA_EXPECTED_APK_CERT_SHA256 });
    else throw Error('Usage: update-release.cjs public-key | prepare <apk> <stable|beta> <output-dir>');
  } catch (e) { console.error(`Release preparation failed: ${e.message}`); process.exitCode = 1; }
}
