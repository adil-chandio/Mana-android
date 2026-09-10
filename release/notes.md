Development recovery candidate 5.17.2 (84), newer than the user-reported broken 5.17.1 (83). Not device-approved or Stable.

Includes Phase 1 bounded chat requests/STOP cancellation/state cleanup and Phase 2 saved Fish library-reference preservation. Voice failures retain text; Retry voice only does not rerun AI/tools. Missing/invalid voice IDs need explicit selection from Audio Library. No random/default speaker, Edge/device substitution or paid-model fallback.

Current build labels are synchronized. Settings has a manual, read-only DEVICE TEST STATUS snapshot with state, timing markers and wake counters; no keys, chat, voice IDs, audio or upload. Late wake callbacks are ignored when the user has switched wake OFF. The native wake engine and Fish player are not retuned in this candidate; physical wake, speech and latency still require phone testing.

Manual in-place installation is required for this development test while the updater signing/bootstrap remains unconfigured. The package and development signing identity are retained, but actual phone upgrade compatibility and data retention must be confirmed. Never uninstall or clear data to force installation. If Android rejects the update, stop and report the installer message.

No signed updater metadata or Stable release is published. No guaranteed latency or successful on-device playback/wake claim is made from build/tests alone. See docs/PHASE3-DEVICE-TEST.md.
