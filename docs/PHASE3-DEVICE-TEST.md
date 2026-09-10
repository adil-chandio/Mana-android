# Phase 3 — 5.17.2 / 84 device-test candidate

Date: 2026-09-10. User approved a higher-code test APK and physical voice/wake/latency checks after Phases 1 and 2.

**Status: development candidate built and CI-verified; awaiting the user's in-place install and physical-device results.** This is not a Stable release, a signed updater feed, proof of audible playback, or a measured speed/wake improvement.

## What this candidate contains

- Phase 1 bounded chat requests, proper STOP/new-input cancellation and state cleanup; old replies/tools cannot continue the owned AI turn.
- Phase 2 saved Fish reference preservation, safe library selection/SUNO persistence, no implicit default speaker, independent text and speech errors, and speech-only retry.
- Version **5.17.2 / code 84 / minSdk 26**, package `com.maya.ai`. Higher than the affected installed code83.
- Splash/header/HUD/debug labels now follow the release metadata. The badge says script loaded, not that the phone's voice/wake tests passed. Historical documentation is marked historical.
- Settings > **SHOW DEVICE TEST STATUS**: explicit, local, read-only snapshot of build, current boolean state, selected-reference *state* (not the ID/name), coarse timing markers and wake counters. No chat, raw errors/transcripts, keys, voice IDs, audio, auto-copy, network call or diagnostic upload.
- Reproduced and guarded one wake safety issue: `__wakeHeard` could dispatch a queued native command after wake was switched OFF. It now checks the switch before processing. This is not native recognizer tuning or proof that foreground/background wake works on the phone.

Native wake engine, Fish stream player, selected/free model, signer configuration, updater trust and automation confirmations are unchanged in this phase. No new default voice or paid provider is introduced.

## Installation — preserve the existing app/data

1. Use only this candidate's verified artifact, not an older code83 ZIP or historical Release.
2. Install **over** the existing MAYA app. Android should offer an update, not require uninstalling. Existing development signing key is retained; actual installed-phone compatibility still must be checked.
3. **If Android rejects the APK, stop. Do not uninstall, clear storage, change signer, bypass signature verification, or repeatedly force installation.** Report only the installer message.
4. Reopen MAYA and confirm the header says 5.17.2; the new Device Test Status / MAYA Updates should identify code84. Check chats, memories and settings locally. Do not share keys or private settings dumps.
5. Keep the saved Fish library voice if its reference exists. If missing/invalid, choose the Hindi female voice yourself from Audio Library. A display name alone cannot recover a lost ID; there is no automatic first-result/default substitution.

**Why manual:** the installed development app lacks the configured update trust/signing bootstrap. Native Update Center remains deliberately unconfigured; no secure in-app delivery is claimed. Workflow/signing activation is a separate blocked gate. This candidate is still signed with the existing **public development identity**, not a new production key.

## First smoke test — send these results before exhaustive tests

Start with the app visible and wake OFF. Do not clear keys or change providers.

1. Type a harmless non-action question in Chat, then a different one in Home. Does the answer appear and does thinking end? If Fish fails, does the text remain?
2. In Fish settings, tap SUNO. Do you actually hear the intended selected voice? A configured label/HTTP200/playing event alone does not answer this.
3. Tap the mic and ask another harmless question. Does the final transcript appear? Does text follow? Do you hear the same Fish voice?
4. If any step fails: stop repeating it, open **Settings > SHOW DEVICE TEST STATUS**, and report the visible error plus that limited snapshot. Do not send API keys, full Doctor/LAB logs, chat history or audio recordings.

A good first response can simply say: installed version; old data retained yes/no; typed Chat/Home yes/no; SUNO heard yes/no; mic text/audio yes/no.

## Safety and recovery matrix

| Check | Expected | Phone result |
|---|---|---|
| In-place 83 → 84 | Same package/signer, old chat/memory/settings retained | PENDING |
| Chat + Home typing | Text appears independently of Fish; no indefinite thinking | PENDING |
| Fish SUNO and saved ID after restart | User hears the intended voice; no silent selection change | PENDING |
| Tap → final transcript → text → Fish | Separate input/text/output stages; selected speaker unchanged | PENDING |
| STOP during AI/preparing/playing | Old answer/audio/tool chain stays stopped | PENDING |
| Immediate A → B / mic after error | Late A cannot overwrite B or close its microphone | PENDING |
| Retry voice only | No duplicate answer, new AI call or tool replay | PENDING |
| Offline/free-provider refusal | Clear bounded failure, text remains; no paid/different-voice fallback | PENDING |
| Wake ON, app visible | Bare Maya listens; Maya + harmless question reaches chat | PENDING |
| Wake OFF | No buffered wake command/handoff is executed | PENDING |
| Screen locked (separate test) | Record actual behavior/limitations, not inferred from foreground | PENDING |
| Real call/audio focus interruption | No stale Fish resume; microphone/selected voice remain usable | PENDING |

Test only harmless questions; do not use calls, payments, messages, deletions or other side effects to measure latency. STOP cannot undo a native action already dispatched. Existing independent utility/photo/reminder subsystems are not all controlled by the chat-turn lifecycle.

## Latency procedure — after smoke tests pass

Record phone model/Android version, network type, recognition language and wake state manually. Do not change the chosen Fish voice to improve a measurement. Use five typed and five tap-to-speak trials, alternating them if practical.

Use the same short question shape but a **unique test tag each time**, e.g. “Aasman neela kyun dikhta hai? Sirf ek jumla. Test alfa”, then bravo, charlie, etc. Repeating identical text can hit the reply cache and falsely make AI/network latency look faster. Record cached/local answers separately; do not mix them into uncached timing claims.

| Trial | Origin / unique tag | Final transcript delay | Text arrival | Audible speech starts | Fish request→playing marker | Cache/local? / error |
|---|---|---|---|---|---|---|
| 1–10 | Typed or tap, alternating | Spoken only | From send/speech end; state reference used | Actual hearing; do not substitute a UI event | Optional Device Test snapshot | Preserve failures |

Use a stopwatch/observation for actual audible timing; mark estimates as estimates. The snapshot only exposes the last available existing timing markers: speech-end→final, Fish request→native playing, final→native playing. It does **not** independently measure audible output or typed-send→text, pair every record across retries/auditions, or calculate a median. Local answers can leave the last AI record referring to an earlier request. Missing markers mean unknown, not zero. Take the snapshot immediately after the trial you are reporting.

Report median and worst measured delay separately for typed/tap, with failures and cache hits counted separately. Stop repeated requests if the free provider refuses service; do not enable a paid model. No latency number is recorded as a phone result until the user provides it.

## Wake procedure — only after text/voice smoke tests

- Enable wake **while the Activity is visible**, with Android mic permission allowed. Record foreground notification/error behavior; do not infer service health from the switch alone.
- Test bare “Maya”, then “Maya” plus a harmless question. Test after a reply and after silence; use only languages actually spoken/configured on the phone. Keep foreground versus locked-screen results separate.
- Test follow-up window 0 and 15 seconds explicitly. With 0, a fresh command requires Maya each time; with 15, commands during the open follow-up window are intentionally accepted.
- Switch wake OFF and check that a late callback cannot act. Re-enable only explicitly.
- Locked-screen/background test is separate and optional if Android denies microphone/foreground-service permission. Record the restriction rather than bypassing OS safeguards. Activity-destroyed/force-stopped hotword execution is **not promised** and the app is not auto-launched to execute commands.

Wake counters in Device Test Status are only callbacks observed by the current WebView session, not an OS service-health probe. Full existing KAAN/Doctor logs can contain transcripts/private data: do not share them automatically.

## Automated evidence (initial receipt)

- Added failing regressions first: visible stale version labels, missing test snapshot/identity, and the reproducible wake-OFF late-command path.
- `npm test`: **1,132 checks pass** (previous 1,122 + one wake guard case + nine candidate/report checks), plus CSS/syntax validation. These are controlled checks, not phone acceptance.
- JS/public and Android-packaged assets must match `tools/sync-version.cjs --check`.
- Native CI [34466017402](https://github.com/adil-chandio/Mana-android/actions/runs/34466017402) passed: **42/42 JVM tests**, zero failures/skips, actual APK package/version/minSdk/debug and signing checks. Source `5e7795fa41bde9c1405495fb6afcd5f3d1fa249b`.
- No emulator, connected phone, live Fish synthesis or measured recognition/wake/latency evidence is available in this sandbox.

## Release hold

The draft PR remains unmerged. Phase 3 is **waiting for device feedback**, not complete just because an APK builds. Stable, configured updater bootstrap and later signed release publication require separate activation and acceptance. Never offer the affected code83 artifact again.

## Verified development artifact — manual install only

- [Download MAYA-APK ZIP](https://github.com/adil-chandio/Mana-android/actions/runs/34466017402/artifacts/10147599144). GitHub login may be required. Extract `app-debug.apk`; install it over the existing app. Do not use an older run's similarly named artifact.
- Source: `5e7795fa41bde9c1405495fb6afcd5f3d1fa249b`; build run `34466017402`; job `102834666675`.
- Artifact ID `10147599144`; API reports ZIP size **5,658,416 bytes**, not expired at this receipt.
- CI-verified identity: `com.maya.ai`, **5.17.2 / 84**, minSdk26, development/debug APK.
- APK SHA-256 from CI: `2d22a9583c179d7fc03d5359d174914aca5329e6e493b5471b6a39f64bd87f73` (APK, not ZIP).
- CI-verified development signer SHA-256: `ba5f9e07a474cad5f8d8123c79e618f1a76976d7561d901d4df3f5a3da32d24a`, unchanged from the previously distributed development candidate. Actual phone compatibility/retention is still pending.
- Update trust remains **false**. No production key, configured bootstrap, signed release metadata or Stable publication.
- Local `gh run download` could not retrieve the redirected artifact blob (EOF from storage endpoint). No local downloaded-binary/checksum inspection or attached APK is claimed; the identity/signature/hash receipt is from CI. The verified artifact link above is the delivery path.
- Non-fatal action-deprecation/cache-restore warnings remain. Pre-existing local workflow edits were not staged or pushed.

Subsequent documentation-only commits do not change this binary. **Phase 3 is not accepted/completed until physical results arrive.** All entries in the phone result matrix remain PENDING.
