#!/usr/bin/env node
'use strict';
// Run only after restoring authorized GitHub environment-secret access.
// The private key lives in memory and GitHub Secrets, never in this repository.
const crypto = require('node:crypto');
const cp = require('node:child_process');
const { publicKey } = require('./update-release.cjs');
const repo = 'adil-chandio/Mana-android';
const environment = 'maya-release';
function gh(args, input) {
  return cp.execFileSync('gh', args, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}
try {
  if (process.argv[2] !== '--create-once') throw Error('Explicit provisioning required: node tools/setup-update-trust.cjs --create-once');
  gh(['api', `repos/${repo}/environments/${environment}`]);
  const existing = gh(['api', '--paginate', `repos/${repo}/environments/${environment}/secrets?per_page=100`, '--jq', '.secrets[].name']).trim().split(/\r?\n/);
  if (existing.includes('MAYA_UPDATE_SIGNING_KEY')) throw Error('Signing secret already exists. Never replace the trust root of installed apps without a migration.');
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 3072 });
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const fingerprint = crypto.createHash('sha256').update(Buffer.from(publicKey(pem), 'base64')).digest('hex');
  gh(['secret', 'set', 'MAYA_UPDATE_SIGNING_KEY', '--repo', repo, '--env', environment], pem);
  console.log(`Metadata signing key saved in the ${environment} GitHub environment. Public fingerprint: ${fingerprint}`);
  console.log('Record this public fingerprint with your bootstrap build. Keep the GitHub secret unchanged for subsequent updates.');
  console.log('No APK signing key was changed, no branch pushed, and no release published. Configure APK signing separately.');
} catch (_) {
  // Do not dump child-process buffers or private material on any failure.
  console.error('Trust setup stopped. Check GitHub environment/secret permissions and whether the signing secret already exists. Do not retry an uncertain write before checking the secret metadata; never replace an installed trust root.');
  process.exitCode = 1;
}
