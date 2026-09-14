#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { validate, signManifest, publicKey, prepare, inspectApk } = require('./update-release.cjs');
process.chdir(path.resolve(__dirname, '..'));
let passed = 0;
function test(name, f) { f(); passed++; console.log(`  PASS ${name}`); }
const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 3072 });
const pem = pair.privateKey.export({ type: 'pkcs8', format: 'pem' }); // Ephemeral test key; never persisted.
const base = { schema: 1, repository: 'adil-chandio/Mana-android', packageName: 'com.maya.ai', versionName: '5.17.0', versionCode: 82, channel: 'beta', tag: 'v5.17.0-beta.82', minSdk: 26, apkUrl: 'https://github.com/adil-chandio/Mana-android/releases/download/v5.17.0-beta.82/MAYA.apk', apkSize: 1024, sha256: 'a'.repeat(64), signerSha256: 'b'.repeat(64), notes: 'A test release', tests: ['Test update installation'], commit: 'c'.repeat(40) };
test('valid signed protocol', () => assert.equal(validate(base).versionCode, 82));
const signed = signManifest(base, pem);
test('signature verifies exact metadata bytes', () => assert(crypto.verify('RSA-SHA256', signed.bytes, pair.publicKey, signed.signature)));
test('tampering fails signature verification', () => assert(!crypto.verify('RSA-SHA256', Buffer.concat([signed.bytes, Buffer.from(' ')]), pair.publicKey, signed.signature)));
test('wrong public key fails', () => {
  const other = crypto.generateKeyPairSync('rsa', { modulusLength: 3072 });
  assert(!crypto.verify('RSA-SHA256', signed.bytes, other.publicKey, signed.signature));
});
test('SPKI public key round-trip', () => assert(crypto.verify('RSA-SHA256', signed.bytes, crypto.createPublicKey({ key: Buffer.from(publicKey(pem), 'base64'), type: 'spki', format: 'der' }), signed.signature)));
test('missing signing key fails closed', () => assert.throws(() => publicKey('')));
test('weak signing key rejected', () => {
  const weak = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' });
  assert.throws(() => publicKey(weak), /3072/);
});
for (const [field, value] of [
  ['schema', 2], ['repository', 'someone/else'], ['packageName', 'com.fake'], ['versionName', '../evil'], ['versionCode', 0], ['versionCode', 1.2], ['versionCode', '82'], ['versionCode', 2100000001],
  ['channel', 'nightly'], ['tag', 'v5.17.0-stable.82'], ['minSdk', 25], ['minSdk', '26'], ['apkUrl', 'http://github.com/a.apk'], ['apkUrl', 'https://evil.example/app.apk'],
  ['apkSize', 0], ['apkSize', 151 * 1024 * 1024], ['sha256', 'garbage'], ['signerSha256', ''], ['notes', ''], ['notes', 'x'.repeat(6001)], ['tests', []], ['tests', ['x'.repeat(301)]], ['tests', [3]], ['commit', 'main']
]) test(`reject invalid ${field}: ${String(value).slice(0, 30)}`, () => assert.throws(() => validate({ ...base, [field]: value })));
test('stable uses its own signed tag and URL', () => {
  const m = { ...base, channel: 'stable', tag: 'v5.17.0-stable.82', apkUrl: base.apkUrl.replace('-beta.', '-stable.') };
  assert.equal(validate(m).channel, 'stable');
});
test('version and packaged assets agree', () => cp.execFileSync(process.execPath, ['tools/sync-version.cjs', '--check']));
const html = fs.readFileSync('public/index.html', 'utf8');
const begin = html.indexOf('/* Native update navigation;');
const end = html.indexOf('/* ---------- SETTINGS', begin);
function ui(bridge) {
  const dom = new JSDOM('<button id="openUpdatesBtn"></button><div id="updateCenterHint"></div>', { runScripts: 'outside-only' });
  if (bridge) dom.window.MayaBridge = bridge;
  dom.window.eval(html.slice(begin, end));
  dom.window.document.getElementById('openUpdatesBtn').click();
  return dom;
}
test('web/PWA button explains bootstrap requirement without navigation', () => {
  const d = ui(); assert.match(d.window.document.getElementById('updateCenterHint').textContent, /updater-enabled/); d.window.close();
});
test('older bridge cannot trigger downloads', () => { const d = ui({}); assert.match(d.window.document.getElementById('updateCenterHint').textContent, /older APKs/); d.window.close(); });
test('native button only opens native screen with zero arguments', () => {
  let calls = 0; const d = ui({ openUpdates(...args) { calls++; assert.equal(args.length, 0); } }); assert.equal(calls, 1); d.window.close();
});
test('native bridge failure leaves recovery instructions', () => {
  const d = ui({ openUpdates() { throw Error('unavailable'); } }); assert.match(d.window.document.getElementById('updateCenterHint').textContent, /launcher/); d.window.close();
});
// These are wiring checks, NOT a substitute for Android runtime/native behavior tests.
const mani = fs.readFileSync('app/src/main/AndroidManifest.xml', 'utf8');
const activity = fs.readFileSync('app/src/main/java/com/maya/ai/update/UpdateActivity.kt', 'utf8');
const repo = fs.readFileSync('app/src/main/java/com/maya/ai/update/UpdateRepository.kt', 'utf8');
// Reviewable proposals; activation requires GitHub workflows permission.
// This validates their content, NOT proof that the remote pipeline is activated.
const workflow = fs.readFileSync('docs/workflows/release-apk.yml', 'utf8');
test('separate native recovery activity is registered', () => assert.match(mani, /android:name="\.update.UpdateActivity"/));
test('dedicated file provider identity avoids camera provider merge', () => assert.match(mani, /android:name="\.update.UpdateFileProvider"/));
test('provider exposes only updates subdirectory', () => {
  const xml = fs.readFileSync('app/src/main/res/xml/update_file_paths.xml', 'utf8'); assert.match(xml, /path="updates\/"/); assert(!xml.includes('external-path'));
});
test('install permission and Android installer wiring exist', () => { assert.match(mani, /REQUEST_INSTALL_PACKAGES/); assert.match(activity, /canRequestPackageInstalls/); assert.match(activity, /application\/vnd.android.package-archive/); });
test('activity has no automatic release check on create/resume', () => {
  assert(!activity.slice(activity.indexOf('override fun onCreate'), activity.indexOf('private fun buildUi')).includes('repository.check(')); assert(!activity.includes('override fun onResume'));
});
test('downloads cancel when screen is backgrounded', () => assert.match(activity, /override fun onStop[\s\S]*?cancel\(\)/));
test('no authentication token used by native updater', () => { assert(!repo.includes('Authorization')); assert(!repo.includes('GH_TOKEN')); });
test('proposed publishing runs tests and builds release, not debug', () => { assert.match(workflow, /npm test/); assert.match(workflow, /testDebugUnitTest assembleRelease/); assert(!workflow.includes('assembleDebug')); });
test('proposed publication is draft until uploads finish and never clobbers', () => {
  assert(workflow.indexOf('--draft ') < workflow.indexOf('gh release upload')); assert(workflow.indexOf('gh release upload') < workflow.indexOf('--draft=false')); assert(!workflow.includes('--clobber'));
});
test('proposed release key and APK signer configuration fail closed', () => { assert.match(workflow, /MAYA_UPDATE_SIGNING_KEY/); assert.match(workflow, /MAYA_EXPECTED_APK_CERT_SHA256/); assert.match(fs.readFileSync('app/build.gradle', 'utf8'), /Release requires signing secrets/); });
// Exercise publisher orchestration with fake Android CLI tools, not real APK verification.
const tmp = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'maya-publisher-test-'));
try {
  const version = JSON.parse(fs.readFileSync('release/version.json', 'utf8'));
  const apk = path.join(tmp, 'input.apk'); fs.writeFileSync(apk, 'DUMMY APK FOR TOOLING TEST');
  function fakeTool(name, output) {
    const file = path.join(tmp, name);
    fs.writeFileSync(file, '#!/usr/bin/env node\nprocess.stdout.write(' + JSON.stringify(output) + ');\n'); fs.chmodSync(file, 0o700);
  }
  const badging = `package: name='com.maya.ai' versionCode='${version.versionCode}' versionName='${version.versionName}'\nsdkVersion:'${version.minSdk}'\n`;
  fakeTool('aapt', badging);
  fakeTool('apksigner', 'Signer #1 certificate SHA-256 digest: ' + 'b'.repeat(64) + '\n');
  const args = { apk, channel: 'beta', out: path.join(tmp, 'output'), buildTools: tmp, commit: 'c'.repeat(40), privatePem: pem, expectedSigner: 'b'.repeat(64) };
  test('publisher prepares complete signed assets (mock Android tools)', () => {
    prepare(args);
    const b = fs.readFileSync(path.join(args.out, 'update.json')), sig = fs.readFileSync(path.join(args.out, 'update.sig'));
    assert(crypto.verify('RSA-SHA256', b, pair.publicKey, sig));
    assert.equal(JSON.parse(b).sha256, crypto.createHash('sha256').update(fs.readFileSync(apk)).digest('hex'));
    assert(fs.readFileSync(path.join(args.out, 'MAYA.apk')).equals(fs.readFileSync(apk)));
  });
  test('publisher rejects unexpected APK certificate', () => assert.throws(() => prepare({ ...args, expectedSigner: 'd'.repeat(64) }), /signer/));
  test('publisher rejects debug artifacts', () => {
    fakeTool('aapt', badging + 'application-debuggable\n'); assert.throws(() => inspectApk(apk, tmp), /debuggable/);
  });
  test('publisher rejects a different APK identity', () => {
    fakeTool('aapt', badging.replace('com.maya.ai', 'com.other')); assert.throws(() => prepare(args), /identity/);
  });
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
// Provisioning tests use a fake gh executable. No GitHub writes or production keys.
const setupTmp = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'maya-trust-setup-test-'));
try {
  const calls = path.join(setupTmp, 'calls.txt');
  fs.writeFileSync(path.join(setupTmp, 'gh'), String.raw`#!/usr/bin/env node
const fs = require('node:fs'), crypto = require('node:crypto'), a = process.argv.slice(2);
fs.appendFileSync(process.env.MAYA_TEST_CALLS, a.join(' ') + '\n');
if (a[0] === 'api' && a.includes('--paginate')) {
  if (!a.includes('.secrets[].name')) process.exit(9);
  console.log(process.env.MAYA_TEST_SCENARIO === 'existing' ? 'OTHER_SECRET\nMAYA_UPDATE_SIGNING_KEY' : 'OTHER_SECRET');
} else if (a[0] === 'api') {
  if (process.env.MAYA_TEST_SCENARIO === 'denied') process.exit(1);
  console.log('{}');
} else if (a[0] === 'secret' && a[1] === 'set') {
  if (process.env.MAYA_TEST_SCENARIO === 'write-fails') process.exit(1);
  const key = crypto.createPrivateKey(fs.readFileSync(0, 'utf8'));
  if (key.asymmetricKeyType !== 'rsa' || key.asymmetricKeyDetails.modulusLength < 3072) process.exit(9);
} else process.exit(9);
`);
  fs.chmodSync(path.join(setupTmp, 'gh'), 0o700);
  function provision(scenario, explicit = true) {
    fs.writeFileSync(calls, '');
    const run = cp.spawnSync(process.execPath, ['tools/setup-update-trust.cjs', ...(explicit ? ['--create-once'] : [])], {
      encoding: 'utf8', env: { PATH: setupTmp + path.delimiter + process.env.PATH, MAYA_TEST_CALLS: calls, MAYA_TEST_SCENARIO: scenario }
    });
    assert(!((run.stdout || '') + (run.stderr || '')).includes('PRIVATE KEY'));
    return { ...run, calls: fs.readFileSync(calls, 'utf8') };
  }
  test('trust setup requires explicit provisioning', () => { const r = provision('missing', false); assert.equal(r.status, 1); assert.equal(r.calls, ''); });
  test('trust setup stops before key creation when access is denied', () => { const r = provision('denied'); assert.equal(r.status, 1); assert(!r.calls.includes('secret set')); });
  test('trust setup checks all secret pages and refuses an existing root', () => { const r = provision('existing'); assert.equal(r.status, 1); assert(r.calls.includes('--paginate')); assert(!r.calls.includes('secret set')); });
  test('trust setup sends a strong ephemeral key over stdin (mock GitHub)', () => { const r = provision('missing'); assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /Public fingerprint: [a-f0-9]{64}/); assert(r.calls.includes('secret set MAYA_UPDATE_SIGNING_KEY')); });
  test('failed trust-secret write is not reported as success', () => { const r = provision('write-fails'); assert.equal(r.status, 1); assert(!r.stdout.includes('saved')); });
} finally { fs.rmSync(setupTmp, { recursive: true, force: true }); }
console.log(`UPDATE JS/RELEASE TESTS PASS — ${passed}/${passed}. Android JVM/device tests are separate.`);
