# Voice/wake candidate 5.17.1 (83)

## User-observed problem and approved constraints

The user selected Fish Audio. Typed chat replies arrive in approximately 1–2 seconds; tap-to-speak appears to think for over 10 seconds, and wake does not work reliably. This is user-reported timing, not a captured device trace. Keep the selected voice; do not substitute Edge, Android TTS, another speaker, or a paid model to make a latency claim.

## Changes

- Fish replies use Media3 progressive MP3 playback of the existing HTTPS synthesis POST. The old path read the entire MP3, base64-encoded it, passed it through the WebView and only then played it. Streaming can start while subsequent audio is still arriving; no measured phone speedup is claimed yet.
- Selected `reference_id`, mood, temperature and prosody are snapshotted for an utterance. The same `s2.1-pro-free` model and balanced quality/latency setting remain. Provider processing segments are 100 characters (within the documented 100–300 range). No separate request is issued per provider segment.
- Explicit Fish/Neural modes do not fall through to other output providers. Auto with a configured Fish account also stays on Fish. An unavailable selected voice displays an error with an explicit retry instruction; no automatic retry/fallback spends additional quota. Existing other users' explicitly chosen Edge/device modes are not removed.
- The fixed native Fish endpoint rejects redirects, paid/unrecognized models, missing voice IDs, multi-speaker/reference uploads and arbitrary forwarded headers. One POST per stream, no seek/re-POST or automatic load retry. Connection/read/startup/utterance and byte limits; explicit cancellation disconnects the current request. No disk audio cache.
- Actual native `playing` events drive Fish latency reporting, rather than marking voice as started before HTTP synthesis. Local duration-only `VOICE TIMING` entries separate speech-end → final transcript, final transcript → reply, and Fish request/final transcript → playing. These markers do not capture transcripts, audio, credentials or automatically upload diagnostics. Other existing app logs may still contain user text: preview anything you choose to share.
- Media3 automatic audio focus uses media usage with speech content. Focus loss stops the utterance instead of resuming unexpectedly. Only one native Fish player owns output; wake remains blocked during active Fish output, including long replies.
- Wake no longer gates STT behind an AudioRecord amplitude detector that consumed the beginning of “Maya” before starting recognition. Existing mic-near/zoom settings are retained, not silently reset. Direct wake recognition can increase recognition activity/power use; it is not a zero-battery hardware hotword engine.
- Recognizer generation/terminal guards reject old callbacks; tap-to-speak synchronously cancels/destroys the wake recognizer before acquiring input. Wake sessions have a deadline; permission errors stop safely. Unsupported/unavailable on-device input languages can use the existing Google/default recognition path on a subsequent wake session. This changes speech *input* handling, not the selected Fish *output voice*.
- A single guarded scheduled mic start replaces toggle-prone duplicate completion callbacks. Old device-TTS watchdogs cannot finish newer Fish speech. Whole-word Roman/Urdu/Hindi wake matching and prefix stripping agree; bare wake listens once even with the follow-up window set to zero.

## Limits that still need device evidence

Android `SpeechRecognizer` is not a dedicated always-on hotword engine. Recognition service availability, supported languages, silence detection, restart gaps, microphone permissions, battery restrictions and background WebView scheduling vary by phone. No app auto-launch or autonomous command execution was added: if the Activity is destroyed, existing safe mode still does not execute captured speech. Foreground wake success is not proof of locked-screen/destroyed-app wake support.

Fish free-tier queue/network/generation delay remains outside this code's control. Smaller segments and early playback are mechanisms, not evidence that every reply starts in 1–2 seconds. No API key or phone was available for live Fish playback here. Compare the same short question at least five times by typing and five times by speaking; record median and worst-case timings, actual selected voice, and foreground versus locked-screen wake results.

Do not reduce safety confirmations, truncate what the user said, synthesize an unrelated canned answer, or change the selected voice to hide a delay.

## Validation and rollout

- Local suites include production-JS streaming event tests (playing before EOF, failure without fallback, stop/late callbacks, stable voice/prosody across chunks), wake/mic lifecycle tests and existing updater/security suites.
- Native JVM request-policy tests cover fixed free model, selected voice, header injection, body limits and no arbitrary forwarded headers. Native compilation, those tests, aapt identity checks and apksigner verification run in the existing build job.
- These tests do **not** exercise real MP3 decoding/Android audio focus, a live Fish endpoint, physical microphone recognition, OEM background policy or an in-place phone upgrade. The checklist in `release/tests.json` is mandatory before claiming device approval.
- Version 83 is above the user's reported development build 82. Package and development signing identity remain unchanged; actual phone data retention must still be tested. Never uninstall or clear data to force installation.
- **Secure in-app distribution is still blocked.** The user's development 5.17.0 has no pinned metadata trust key. A configured bootstrap must be manually installed before future signed updates can arrive inside Update Center. Workflow-file permission and environment signing configuration remain pending; no production metadata key was generated and no signed updater release was published by this change. See `UPDATE-CENTER.md` and the workflow proposals in `docs/workflows/`.

## Provider reference checked during implementation

Fish's [Text to Speech API reference](https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech) documents MP3 output, `reference_id`, `s2.1-pro-free`, segment limits and latency modes. It also states that unrecognized/omitted model headers default to `s2.1-pro`; the native policy explicitly prevents that paid-model fallback. Provider terms/availability may change: an error is not permission to switch plans or voices.
