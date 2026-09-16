# Maya 5.30.0 (101) — context review, attempt recovery and Builder comparison

Next bounded milestone of the approved workspace roadmap. No backend/provider changes, live requests, permission activation, new persistence or updater trust enrollment.

## Direct context review

Direct mode has a Context action beside the mode selector. A local, scrollable, read-only snapshot shows the exact candidate Direct user/assistant messages, destination, message/character counts and exclusions. A valid draft is required. `NativeChatConversation.review()` shares the same message/body validation as Send and does not create a turn, sign, read a key, grant consent, send or modify history. Send validates the current state again; an earlier review is not a reusable authorization. Fixed server instructions/signing metadata are not represented as user-selectable context.

Agent cards, failed attempts, code and source results do not enter this list automatically. Text explicitly restored/copied into the draft is part of that draft. Context review does not enable Chat OFF or replace the Direct consent checkbox. Settings remains the dedicated destination from100.

## Local Direct attempt cards

After a valid Direct submission, a memory-only attempt card appears immediately. Preparation and waiting-for-response descriptions reflect actual callbacks; no fabricated response streaming or percentage progress.

- Accepted response removes the temporary attempt card and commits the ordinary completed Direct messages once.
- Blocked/failed/cancelled attempts stay visible with the existing bounded error/remote-uncertainty description. They are NOT committed to AI context.
- Restore draft only restores locally; replacing a different existing draft requires confirmation. No retry button silently sends, signs or grants consent. The owner must separately Send with consent/current context.
- Dismiss attempt requires confirmation and removes only that local card, not draft/completed context or remote provider records.
- At most six pending/failed attempt cards are retained; another Send is refused locally until the owner dismisses one or clears the conversation. No silent eviction or added disk history.
- STOP/Settings/mode transitions retain safe local recovery while fencing old callbacks. Background/exit clears the attempt records along with the existing ephemeral conversation. `toString()` redacts attempt text.

Transport/signing, fixed limits and completed-only conversation semantics remain unchanged.

## Builder changes

A Review changes disclosure compares the current code captured for the proposal with the proposed document. It is a linear-time, bounded line comparison: common prefix/suffix are kept as context and one contiguous changed block is shown with old/new markers and line ranges. It is deliberately NOT a minimal diff or executable patch. Final empty lines and escaped CR/tab/backslash differences remain visible.

The code still needs the original Apply confirmation and a separate static Preview confirmation. Opening the comparison does not apply, execute, export or send anything. Editing code clears the proposal/comparison through the existing stale-revision fence. Comparison fields clear on disposal. The confirmed local Undo from100 remains.

A missing workspace-section condition on the Builder allowed-action callback was also closed: a hidden Builder cannot initiate a proposal while the owner is on dedicated Settings, matching Research's existing route fence.

## Validation / boundaries

Local network-denied npm, CSS/DOM/source-boundary checks, asset/version synchronization and whitespace checks are required, followed by matching GitHub native compilation/Robolectric tests and CI APK identity verification before delivery. Added tests cover exact read-only context, limits and consent separation, local blocked-send recovery, accepted-card deduplication, STOP/stale callbacks, confirmed dismissal, bounded retention/background clear, stale restore dialogs, actual Builder comparison and hidden-route denial.

No physical TECNO rendering, TalkBack/keyboard, installed-version or live provider proof is implied. This is not saved history, unified dictation, multi-file coding, broader web research, GitHub writes, media analysis or phone automation. Those roadmap items remain separately scoped. Saved exact Fish, Chat OFF, APK identity, Worker/model/256-token budget, static preview isolation and privacy lifecycle remain unchanged.

Install this development update in place; no uninstall or Clear Data.
