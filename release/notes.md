Native Update Center: manually check Stable/Beta releases, verify signed metadata and APK identity, download with progress/cancel, then open Android's installer.

A separate MAYA Updates launcher entry works without the WebView UI. Installation is confirmed by the installed version on the next launch. A local test checklist and previewable, manually shared diagnostic are included.

Bootstrap requirement: update trust must be configured at build time. Unconfigured development builds cannot download or install updates through the updater. APK signing-key rotation is not included. The exposed legacy signing identity still needs a separately tested migration.

Voice, wake-word and automation bugs from the audit are NOT fixed in this release.
