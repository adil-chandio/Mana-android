# Phase 2 — preserve the selected Fish library voice

Date: 2026-09-10. User approved Phase 2 after [Phase 1](PHASE1-RECOVERY.md).

## User clarification and decision

The user tried multiple voices from **Audio Library**, choosing a Hindi female voice they liked. They did not identify a fixed provider-default speaker. The actual last selected ID/name on the phone is still unknown; no settings dump, API key or phone access was requested.

**Keep the saved reference ID exactly when present. Never infer it from a title, select the first result, restore an older different reference over an explicit current blank setting, or substitute Edge/device/another speaker.** A missing ID requires an explicit library choice. This is not a claim that a lost ID or its former audio has been recovered.

## Changes

- Read-only selection classification: valid saved reference; malformed saved reference; saved name with missing ID; or legacy blank/default/unset. Blank alone cannot distinguish the last two historical possibilities, so the UI says so instead of inventing provenance.
- No destructive migration or schema reset. Valid legacy/current `fishVoice` and `fishVoiceName` remain unchanged. A corrupt obsolete `jarvisSettings` record no longer prevents valid current `maya_settings` from loading.
- The selectable blank “Default—Fish chooses” option is now a **disabled setup placeholder**. Streaming and buffered speech both require an explicit reference; `ready()` agrees with `block()`. Invalid stored values are retained but not sent. Native and JS validation both reject non-string, whitespace/control-character and oversized IDs; no silent normalization.
- Picker hydration uses saved settings only, not a stale DOM value. A saved voice absent from the current library remains visible as a saved option. Display names never determine identity.
- One selection commit path for picker change and SUNO. An explicit rendered choice is persisted **before** SUNO validation; empty/unhydrated/invalid DOM cannot erase the saved reference. Storage failure restores the old in-memory selection and does not audition the unsaved choice. General SAVE still excludes the voice picker.
- Library loading remains available without a voice ID. Refresh/ranking never auto-selects a voice. Female/woman no longer match male/man penalties; language/tag ranking uses whole words and is described as a suggestion, not a gender/quality guarantee. Combined multi-search results persist as one list; old responses cannot overwrite newer results. Cancelled searches keep the previous cached list.
- STOP releases library/Doctor/SUNO buttons. Stale audition completion cannot reset the new conversation state. A completed sample reports its snapshotted voice, not a different selection made during playback.
- Voice failure retains the Phase 1 independent text answer. Notices provide **Voice settings** and, for a failed reply, **Retry voice only**. Retry is tied to the failed audio generation and does not call AI, run tools or duplicate chat history. A newer audio generation invalidates an old retry button.
- Fish Doctor now sends the **same selected `reference_id`** and fixed free-model headers. No default synthesis when selection is missing; no key fragments displayed. It distinguishes an audio response from audible playback and no longer claims unlimited quota, a guessed end date or an automatic Edge fallback. JSON/error responses cannot be reported as audio success.

## Validation

- Regression tests added before the runtime edits: 7 of 8 initial cases failed; preserving an off-list reference already passed and was retained.
- `tools/test-fish-selection.cjs`: **25/25 controlled behavioral cases** pass. Includes legacy/current reload, malformed obsolete settings, saved/missing/malformed IDs, off-list preservation, stale DOM, immediate persistence, save failure, no default on either transport, selected-reference Doctor, library races/ranking/cancellation, stopped audition and speech-only retry.
- `npm test`: **1,122 checks pass** (the previous 1,097 plus these 25), with CSS/syntax checks. Existing fixture defaults now explicitly provide a reference for successful Fish speech; the old implicit-default assertion was replaced with an explicit no-substitution check, not removed. Three source guards follow the new commit helper; Doctor assertions now reject unsupported availability/fallback claims.
- Added **4 JVM policy tests**: missing ID, whitespace, control character, oversized ID. Native build/JVM results pending CI for this source at initial receipt.
- `node tools/sync-version.cjs --check` and `git diff --check` pass. Canonical/public HTML and packaged Android copy are synchronized.
- No real synthesis, phone settings inspection, physical speaker identity, recognition, wake or latency measurement was performed. A valid reference format is not proof that Fish still serves that ID or that the account/free model is available.

## Boundaries and next gate

- Fish endpoint and `s2.1-pro-free` are unchanged. No paid API, automatic default selection, voice substitution, uninstall, data clearing or auto-upload.
- No wake engine, streaming player, version or signing/bootstrap changes in this phase. The two pre-existing workflow edits remain excluded.
- Existing binary library/Doctor HTTP uses its bounded legacy bridge. STOP invalidates callbacks/UI; this phase does not add native socket abortion for that separate library transport. Streaming cancellation remains the existing native player implementation.
- Version remains **5.17.1 / 83 for staged development builds**, NOT a new phone-install recommendation. Any distributed successor must be higher than 83 and signing-compatible. Update trust/bootstrap blockers remain.
- Phase 3 needs approval: build a higher-code development candidate for physical streaming, selected-voice, mic/wake and latency acceptance. No Stable promotion based on these tests alone.
