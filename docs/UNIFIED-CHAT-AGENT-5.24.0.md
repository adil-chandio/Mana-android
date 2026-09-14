# 5.24.0 (95): Chat and Agent on one native screen

## Owner request and delivered scope

Owner asked why work stopped and whether any action was required from them. No new permission/choice was needed for this integration. The native Chat now includes an **Agent tab** and **Research this draft · review first** action. This unifies the entry/workspace without silently turning text replies into tools.

- Chat / Checks / Info / Agent are internal tabs of NativeChatActivity. Switching between Chat and Agent preserves completed conversation, draft, Chat consent and research content in memory. Switching modes stops active work, fences confirmations and revokes Agent approval; nothing auto-resumes.
- Draft action requires a local-copy confirmation and exact unchanged draft. It copies only 1–400 characters into the research goal, without silently truncating a longer Chat draft. The old research workspace is cleared only after this explicit replacement confirmation. Conversation history is not transferred, nor is Chat consent reused as research/AI consent.
- Normal **Send message** remains text-only. Research requires its existing separate AI-goal consent (if used), editable bounded plan, explicit review/approval and Run. The same three-source public Wikipedia/GitHub scope from 94 applies. No automatic command detection, external screen upload or arbitrary phone control was added.
- Chat and Agent are independent contexts, not a shared model transcript. Research explanations/sources remain in the Agent tab; they are not silently inserted into Chat history. The existing manual selected-Fish Sunao stays on Chat replies and is not changed.
- ResearchWorkspace is a shared, same-process view/controller used by both the new Agent tab and the existing standalone Maya Agent launcher. No activity embedding, incoming intent extras, static draft mailbox, persistent storage or session token is used. The standalone workflow retains its existing behavior.
- Each active pane retains a visible STOP outside its scroll area. Hidden Chat controls cannot start a model/Fish request in Agent mode. On switch back, Agent requests stop and late callbacks cannot restore results; Chat's completed context remains.
- Leaving/backgrounding/recreation, opening an external browser/source, or opening the separate offline lab clears BOTH workspaces under the native host's exit policy. There is no saved history or silent private conversation left behind. Native Back confirmation covers research content too.

## Unchanged boundaries

No backend/Worker/uploader pin, signing identity, saved voice/reference, provider/model, new permission, legacy action queue or Accessibility change. Server Chat remains owner-controlled; manual public-source plans do not need Chat ON, whereas AI proposal/explanation buttons remain subject to the existing Chat gate and per-use consent. No assistant-run live AI, Fish or research request.

This is a unified native entry and explicit draft-to-research flow, not unrestricted “send any message and control the phone,” full cross-app automation, Vision, persistent history or exhaustive deep research. UI still has separate Chat and Agent panes.

## Tests and evidence

All standalone ResearchActivity tests now exercise the shared ResearchWorkspace. Native Chat tests cover tab preservation/no launch, explicit unchanged-draft copy, no truncation, stale dialogs, mode-switch cancellation, no implicit history/consent transfer, late-source fencing and clearing both workspaces on exit. Existing Chat/Fish and research tests must stay green. Static integration tests updated for the fourth tab and shared lifecycle ownership.

JVM/Robolectric/static tests are not physical phone, keyboard, browser or live provider evidence. CI result and artifact identity are recorded separately after the final build. No need to repeat the previously accepted voice/recall tests just to create a receipt.
