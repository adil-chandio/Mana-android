# 5.17.3 / code85 — development wake-recovery candidate

Preserves working typed Chat and the exact user-selected Fish library reference. The user reports code84 typed Chat responds in under one second and the chosen voice plays, but hands-free wake did not respond. This is not a measured subsecond voice claim.

Reproduced a cancellation bug: stopping a SUNO audition stopped its resources but left the JavaScript speaking/exclusion state active. Central STOP now releases that state with the existing echo tail, without releasing an active tap microphone or allowing an old callback to finish a newer utterance. Pending/live Fish output is not cleared merely because a playing event is absent.

Wake service/recognizer startup, permission failures and blocked reasons now have fixed-field native diagnostics. MIC READY requires a recent guarded native ready callback; the old timer-generated listening claim is removed. Permission requests run on the UI thread. Wake activation no longer auto-opens battery settings during foreground microphone acquisition; explicit battery settings remain available. Delayed startup/deadline work is fenced against wake OFF/newer starts.

Manual in-place development install only; never uninstall or clear data to force an update. Secure Update Center trust remains unconfigured. No paid or different-speaker fallback, signed updater metadata, or Stable publication. See docs/WAKE-RECOVERY-5.17.3.md for evidence and phone acceptance gates. Physical wake, retention and spoken latency remain pending.
