# Legacy containment and core repairs — 5.39.0 (110)

This implements the first safety/core slice from the15 September whole-project review. It does NOT claim the entire33-item review is closed or that full Agent1/media/GitHub/multifile Builder is complete.

## Native capability quarantine

- Main's annotated JavaScript surface is reduced from72 to25 methods, checked against `LegacyCapabilities.bridgeExports`. Call/SMS/contact lookup, AutoSend, notification replies/collection controls, screen dump/raw actions, scheduling, photo/file/media, generic GET/POST/binary proxy, Edge/device speech and broad settings/permission launchers are no longer exported to WebView.
- The retained JS HTTP POST path admits only the current native-issued Fish Talk session and its bounded `ft_` request IDs. Typed Chat continues to use its native-only transport. Unowned JS speech recognition is denied; native one-shot dictation retains its own port/lease.
- Voice preferences exposed through the bridge are allowlisted/validated, limited to the visible settings context. They cannot write arbitrary trust/autosend/key fields. HAAL values are fixed and active capture/speech phases require the Talk owner. Runtime Wake cannot start over a Talk/primary mic owner through this bridge.
- `AutoSendService`, `MayaNotifService`, `ScheduledReceiver` and `BootReceiver` are disabled in the manifest. Native compile-time gates also deny queue admission, legacy screen reads/gestures, notification collection and scheduled actions even if an object is instantiated. These gates cannot be changed by a JS trust preference.
- The retired Accessibility descriptor no longer requests window content, view IDs or gestures. The generic FileProvider is narrowed from the entire cache to `legacy_media/`; the separately verified update provider is unchanged.
- App-manifest platform permission declarations are reduced from19 to7: INTERNET, RECORD_AUDIO, POST_NOTIFICATIONS, WAKE_LOCK, FOREGROUND_SERVICE, FOREGROUND_SERVICE_MICROPHONE and REQUEST_INSTALL_PACKAGES. Retired contact/call/media/settings/exact-alarm/boot/battery-exemption capabilities are not requested. Dependencies may contribute their own merged declarations; tests independently reject the retired permission set.
- Main and Updates remain launcher entries. Old Chat/Agent Activities remain internal compatibility classes, not exported duplicate launchers that cannot access the default Main-host account path.

This intentionally disables unsafe/unqualified features; it is not a claim those phone/media features have been safely implemented. Existing OS grants are not used to revive them. No permission, Accessibility, notification access, provider or installer activation was performed by the agent.

## Host boundary hardening

Only the exact packaged HTTPS document and exact android_asset fallback are allowed internal main-frame navigation. Arbitrary file/host paths, subframes, ungestured external navigation and non-HTTPS external targets are blocked. File-universal/file-JS/content access and automatic JS windows are disabled.

A native-only CSP blocks connect/frame/object/worker/media/form destinations while allowing the packaged scripts/styles/images required by the shell. Native configured Chat and dedicated Fish transports are not WebView network requests. The existing HTTPS asset loader remains primary. Actual Android WebView/CSP/file-fallback behavior still requires physical qualification; DOM/source tests are not a rendering-security certification.

This is a smaller defended compatibility bridge, NOT the final origin-scoped message bridge/native secret-store migration. Credentials still live in the existing legacy settings store, and broad application backup policy is not solved by this slice. No keys/reference/history were erased to accomplish containment.

## Fish-only active output

Main and Wake no longer initialize legacy device TTS. The retired notification service does not initialize TTS, collect incoming text or speak. In the restricted native host, the old AWAAZ/device/browser synthesis path returns a fixed retired notice; app-generated chimes are suppressed. Primary Talk and native Sunao keep their existing saved Fish body/reference/model and strict exclusive player.

FISH.native recognizes the dedicated Talk interface even though the old generic binary proxy is no longer exposed. Legacy Library/test/probe and alternate-output buttons are hidden/disabled in native settings with a clear containment notice; this does not modify the saved Fish selection or keys. Use native setup/Sunao or Talk rather than the old generic speaker test. System speech-recognition tones are not globally muted or promised absent.

## Retired web entry points

- Legacy plaintext backup no longer serializes settings/keys or downloads JSON; it directs the owner to explicit native encrypted saved-work backup.
- The scheduled-message callback cannot invoke `call_contact`, send a message or restart old approvals. Stored task data is not deleted.
- Proactive initialization cancels its old timer and never activates unsolicited speech. The undefined-variable defect was removed by retiring that path, not making it silently talk again.
- Legacy Vision returns unavailable without model discovery or image upload; old photo results are rejected before reading or decoding media bytes in Main. There is no repeated model/image upload loop or full-image UI-thread decode through this retired path.
- Unowned code execution and legacy code execution in the restricted native host are refused before constructing a worker. The unowned UI-realm fallback is removed. Existing owned browser-worker behavior remains historical, not a qualified native runtime. The real native Builder stays static, JS/network/file/bridge-free.

## Current core repairs

- `prepareConfiguredChat` settles the current UI owner with MAIN_TRANSITION if the document epoch changes, rather than consuming its timeout and dropping the terminal callback. Pending state/draft retention and late duplicate callback behavior are covered.
- Numeric settings use finite-number parsing instead of truthiness defaults, so zero values survive Save; invalid/empty/nonfinite values use explicit defaults.
- Talk accepts absent/null/empty tool fields as no tools, still rejects actual calls, wrong roles/multiple choices/truncated or reasoning output. This closes concrete parser inconsistencies without authorizing actions; complete native/JS parser consolidation remains future work.
- Talk records speech onset before ready and does not rearm silence after it. Nonblank partial input also supplies onset evidence. The independent hard input deadline remains.
- Talk language/model and mic-permission errors retain useful fixed causes rather than being flattened into one generic message. Input-service selection unification is NOT claimed complete.
- Saved legacy Auto Listen/Proactive/notification flags cannot block the protected native idle/Talk path when the corresponding runtime capabilities are quarantined. Actual mic/service/speech/request/action ownership checks remain. ResearchBackend also uses actual-idle readiness, but its AI transport still requires Cloudflare; it is not silently rerouted to a different provider or budget.

## Verification scope

Added9 native containment/policy/service tests parameterized for API28 and34, plus4 Main surface/lifecycle/URI/resource tests. Added11 controlled JS containment tests and5 Talk parser/onset/error cases. Existing legacy helper tests are explicitly historical/mock semantics, not current native capability or physical-safety proof; two obsolete Vision assertions now verify no upload.

Tests cover exact annotated exports, disabled components, retired permissions, no revived timestamp-based autosend, denied queue/screen/gesture calls, no notification text/TTS collection, no scheduled actions, cache-provider narrowing, exact trusted documents, host-epoch callback/timeout settlement, unowned HTTP/mic denial, native CSP configuration, secret-free export retirement, no Vision POSTs, no unsafe fallback code execution, zero roundtrips and Fish-only active paths.

Final exact-head CI/native count/artifact/signer details are in the delivery receipt. No real AI/Fish/screen/call/message/image/permission/deployment request or phone acceptance test was run. Declared API34 coverage is simulation, not a TECNO test.

## Review closure and remaining work

- Contained/retired: dangerous legacy activation paths behind R05–R17; duplicate launchers R22; broad cache sharing R31; boot resurrection entry R28. The original algorithms were not certified for reactivation.
- Repaired with targeted coverage: R03 pending UI settlement, R18 numeric zeros, R21 onset handling; R20 parser shape/empty-tool parity improved but not fully consolidated.
- Still open: common AI routing for Agent/Builder (R01), canonical typed/Talk context (R02), one input policy (R04), native credential/backup migration (R14), full origin-scoped bridge, broader services/phone adapters/media/GitHub/runtime Builder, trusted signing/updater, SDK/physical acceptance and release-test ledger cleanup.

Selected Fish reference/key, existing AI account/model/budgets, Cloudflare Chat OFF, APK identity and snapshots are preserved. App runtime must be updated in place; never uninstall or Clear Data. This is a containment/core-repair release, not an error-free/full-project, always-listening or unlimited-free claim.
