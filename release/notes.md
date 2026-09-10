Voice/wake testing candidate 5.17.1 (83), not device-approved Stable.

Fish Audio now uses native progressive MP3 playback instead of waiting for a complete base64 audio download. The selected reference voice, mood/prosody and existing s2.1-pro-free model are retained. Explicit Fish/Neural selections do not switch to Edge, phone or another provider on failure; Auto with configured Fish also stays on Fish. Server/network latency still applies; no instant-response guarantee is made.

Wake STT no longer waits behind the AudioRecord amplitude gate that consumed the first syllable. Duplicate mic restarts, stale recognizer/TTS callbacks and multilingual wake-prefix stripping are guarded. Tap-to-speak remains explicit and takes priority. Background recognition remains subject to Android/provider restrictions; a destroyed app is not automatically relaunched.

Duration-only local timings distinguish recognition finalization, text response and real Fish playback start. Verify these improvements on the actual phone; compiled tests do not establish end-to-end latency or wake reliability.

Update activation is still required: unconfigured development APKs show the Update Center but cannot fetch signed updates. A manually installed, compatible signing-configured bootstrap is needed first. Never uninstall/clear app data to force installation. The legacy Android signing key is exposed; this change does not repair that identity.
