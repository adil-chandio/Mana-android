# Maya 5.34.0 (105) — task capacity, code checkpoints and saved-work organization

## Task management in the permanent workspace

Each Research/Builder task now has compact native controls next to its card: fold/expand, owned-task STOP when applicable, and confirmed Remove. The header names the task/file, states whether it is waiting/running/approved/idle or retaining a local preview, and shows the current **0–3 task slot** occupancy. Idle is explicitly not a claim that the task succeeded.

- **Fold is presentation only.** It keeps task data, local preview and existing approved-plan expiry; it neither stops/disposes the task nor grants/renews approval. Fold/removal are unavailable during active workspace work. Folding dismisses outstanding local review dialogs, and folded cards cannot invoke hidden Builder/Research actions. Expanding does not restore a dismissed dialog's authority.
- **Stop this task** stops/revokes that owned task, not another task, Direct request or Fish playback. It keeps task data and does not free capacity. Existing global/obscured-touch/lifecycle protections remain; this is not a universal remote cancellation/refund control.
- **Remove task** confirms irreversible disposal of this task's local results/code/proposals/checkpoints/preview/approval. It preserves other task cards, Direct completed context, the current draft and durable saved snapshots. Capacity is not released until disposal actually returns. A disposal failure retains its slot; no replacement is automatically admitted.
- Removal checks both task identity and the captured task-review revision, as well as current route/foreground/work ownership. Editing Builder code after its removal dialog opens, cancelling/dismissing, navigating away, or stale callbacks cannot turn old confirmation into permission to remove newer work.
- Removing the Builder card clears only its project pointer, so another local Builder project can then be created in the same workspace. Builder follow-ups unfold their existing card for visible review; they still use their separate AI consent and fixed request budget.
- Fold state and task-control objects are ephemeral. Existing background/exit still clears temporary tasks; folding does not save them. Header controls do not enter uploaded Direct context.

## Builder checkpoints

The single-file Builder now supports **five explicit, memory-only code checkpoints per task**:

1. Save local checkpoint captures the exact current editor text after confirmation. Each point retains up to 8,000 characters, including final newlines/tabs/CR; no code is executed, previewed, sent or written to disk.
2. Duplicate code does not consume another slot. Five-point capacity refuses a sixth save until a point is explicitly deleted; there is no silent eviction.
3. Review / restore displays the existing bounded one-replacement-block comparison plus full checkpoint text. This is presentation, not a minimal executable patch or correctness proof. Restore requires confirmation and checks that both the checkpoint identity and current editor remain unchanged.
4. Restore replaces only current local editor text, revoking old proposal/preview/Apply-Undo state. It does not auto-preview, run code, use AI, change saved snapshots or widen the 256-token AI budget.
5. Delete checkpoint separately confirms removal of that point without changing current code. STOP/internal Settings keep checkpoints; actual background/exit or task removal disposes them and their controls.

**Checkpoints are not durable revision history.** Saved work snapshots still persist only current Builder editor data, not its checkpoint stack. Use the existing explicit encrypted Save if current code must survive leaving. Builder remains a single static HTML/CSS editor, not a multifile runtime or terminal.

## Saved-work organization

The dedicated native Saved work & backups Settings category gains:

- **Local name search**, case-insensitive literal matching, not regex, code execution or a provider search. It only matches names, not hidden conversation/code contents. Search does not write the vault or add AI context.
- **Builder-file filter** and newest-saved-first display with shown/total counts. Filtering does not delete hidden items or change capacity. Search/filter state is cleared when leaving the category/background.
- **Confirmed Rename snapshot** with strict name validation and archive-revision fencing. Only the encrypted item's title changes; ID, original saved time, messages, draft and code remain unchanged. Existing exported backup copies are not renamed. No archive format or key/credential migration occurs.

## Validation and standing limits

Network-denied npm/static/version/packaged-asset checks, native CI compilation/regression tests and exact-head development artifact verification are required. Added tests use synthetic research/model callbacks, in-memory vaults, JCA test keys and Android shadows; they are not physical TECNO layout, TalkBack, IME, encryption-service or provider proof.

Saved Fish output, Chat OFF, APK/Worker identity, endpoints/model/request limits, preview isolation and all live send/delete/install/phone/paid-service gates remain unchanged. No live model/Fish/phone/research operation, screen upload, trust enrollment or new permission activation was performed by the coding agent. Updates remain in-place development APKs: do not uninstall or Clear Data.

This release advances workflow usability and local recovery, but **does not complete the expanded project**. Full native migration of original settings, broader arbitrary-web/media/video/GitHub workflows, reviewed cross-app execution adapters, multifile/runtime coding features, trusted updater enrollment and physical device acceptance remain unfinished or separately gated. No unlimited-free or flawless completion claim.
