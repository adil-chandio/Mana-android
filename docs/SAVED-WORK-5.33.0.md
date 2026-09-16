# Maya 5.33.0 (104): explicit encrypted saved work and portable backups

## Implemented user flow

Settings → **Saved work & backups** is a dedicated native Settings category. Back returns to Settings home, then the same permanent Direct/Agent/Builder workspace. Merely starting Maya never opens the saved list, creates a vault key, saves a conversation or adds saved data to AI context.

1. **Save current workspace** captures completed Direct messages, the current composer draft and the current Builder editor's single index.html, if present. A named confirmation shows the exact inclusion counts. Changes to the workspace during that review reject the save. Each save is a new snapshot, not silent overwrite.
2. **Review saved snapshot** displays the actual messages/draft/code. **Open locally** separately confirms replacement of the temporary workspace. Existing tasks, approvals, proposals and previews are discarded; Direct consent is OFF. It restores no operation, Send, Fish playback, code execution or automatic preview. Direct messages are admitted to the visible timeline exactly once. Existing context limits still apply at Context/Send, including a refusal if a saved assistant reply is too long for the request envelope.
3. **Delete this snapshot** requires confirmation and checks the archive revision to prevent a stale dialog deleting against a changed archive. Deletion does not touch the active workspace, identity or original settings.
4. **Delete all saved work** explicitly removes this vault's encryption key and local archive. It is also the recovery path for an unreadable/corrupt/lost-key vault. This is destructive, not repair/decryption; exported backups plus their separate password are required for recovery. It does not delete provider records or external copies.
5. **Export encrypted backup** accepts and verifies a new password, encrypts one saved snapshot off the UI thread, then separately asks to copy encrypted text to Android's clipboard. Passwords are not copied. The owner must paste/save that text elsewhere; clipboard copy is not a verified external backup, and no backup file or cloud upload is automatically created.
6. **Import encrypted backup text** starts with empty fields and never reads the clipboard automatically. The owner pastes ciphertext and supplies the password. Decryption/format validation happens locally before a full data review. A separate **Import snapshot** adds a new ID without overwriting existing data. It does not automatically open the snapshot or add AI context.

## Data policy and boundaries

- At most **10 snapshots / 512 KiB total plaintext archive**. No silent eviction, truncation or automatic save. Each draft ≤2,000 characters; current Builder code ≤8,000; at most 12 alternating completed Direct messages. The same request/reply validation is reused. No partial turn or system role is admitted.
- Research task cards/results, failed/submitted attempts, Builder proposals/Undo/preview state, approvals, service state, microphone audio, Fish reference/key, APK identity, provider credentials, budgets and original settings are excluded. This is not a full timeline backup or multifile project manager.
- Local AES-256-GCM encryption uses a separate AndroidKeyStore alias. Reads never create/replace a missing key. Files live in **noBackupFilesDir**, excluded from Android cloud backup/device transfer; bounded reads and AtomicFile writes prevent incomplete normal writes replacing the previous archive. Corrupt/future/tampered data fails closed instead of being overwritten. Authenticated format headers and strict UTF-8/schema/count/size validation reject malformed input.
- Portable backups use a separate password-derived AES-256-GCM key, random salt and nonce, PBKDF2-HMAC-SHA256 (210,000 iterations), and an authenticated version header. The Android vault key is never exported. Use a strong unique password: anyone holding a backup can attempt offline guesses. Maya cannot recover forgotten passwords. Wrong password and tampering have the same fixed failure presentation.
- Clipboard export is bounded to 350,000 encoded characters and applies to one snapshot at a time. Android/keyboard/clipboard-sync software may retain ciphertext. External backup ownership, password management and provider deletion are separate responsibilities. No SAF file picker, automatic cloud sync, whole-device migration or credential export is claimed.
- Durable I/O and password derivation use a single shared no-queue worker, not the UI thread. A 15-second local wait ceiling and lifecycle epochs reject late UI results. Confirmed disk operations may still complete after timeout/background; refresh is explicit and no retry is queued. This is an uncertainty notice, not a guarantee of interrupting Keystore/filesystem work.
- Password edit fields disable view-state saving/autofill/personalized learning; editable buffers and available temporary byte/char arrays are cleared on completion/cancel where possible. Java/Android memory, keyboard, screenshots and third-party input software are not claimed to be securely erased or protected solely by at-rest encryption.
- Background/exit still clears the **temporary active workspace**. Explicitly saved encrypted snapshots remain until deletion. Uninstall, Clear Data or key loss can make local snapshots unrecoverable; updates should be installed in place.

## Verification scope

Regression tests cover strict encoding, malformed/oversized/future input, AES-GCM authentication and random nonces, no-read-time key creation, lost-key refusal, atomic-write failure, stale revisions, password backup round-trip/wrong-password/tampering, explicit save/review/delete/import/export, dialog cancellation/lifecycle invalidation, restored timeline deduplication, no consent/preview/network on restore, and unchanged ephemeral background clearing.

Local checks deny network. Native tests use JCA test keys, in-memory storage, synthetic text and Android shadows, not the phone's AndroidKeyStore or physical clipboard/IME/recognizer. Exact-head CI compilation/tests/development artifact verification is required before delivery. No live AI, Fish, phone action, provider deployment, permission activation or updater enrollment is part of this work.

## Remaining expanded-project work — not a completion claim

This implements bounded saved conversations/projects and encrypted portable **text** backup/import/delete, rather than just planning them. It does not complete everything requested:

- All original settings categories have not been rewritten natively; saved original Voice/appearance remains in its dedicated host.
- Research remains bounded exact WIKI/REPO, not arbitrary-web deep research. Media/image/video analysis and GitHub write workflows are not implemented in the shared workspace.
- Builder remains a static single-file editor/preview with fixed AI budget, not a multifile runtime, terminal or durable revision history. Snapshots now preserve its editor data only.
- Reviewed cross-app execution adapters, trusted updater enrollment/Stable activation, and physical TECNO keyboard/TalkBack/voice/storage/installation acceptance remain unfinished or separately gated.
- Saved Fish, Chat OFF, Worker/identity/endpoints/model/limits and standing send/delete/install/paid-service gates remain unchanged. No unlimited-free, flawless or full-project guarantee.
