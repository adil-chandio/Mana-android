# Ruflo reference and Maya adaptation

## Reference acquisition

Owner requested `gh repo clone ruvnet/ruflo`. The clone was completed separately from Maya, then placed at `/home/user/.cache/ruflo-reference` to avoid adding the approximately644MiB/5,773-file reference checkout to the Android project or Arena's saved patchset.

- Repository: https://github.com/ruvnet/ruflo
- Inspected commit: `a65bdf683a73dcc1f20d455658daab1cca07306b`
- Commit subject: `fix(memory): pass a bare mode string to NeuralLearningSystem, not an object (#3336)`
- Root package at this revision: `claude-flow`3.42.0, Node>=20.
- Root license: MIT, copyright2024–2026 ruvnet. Package/plugin/model licenses would require separate review before copying or shipping them.

No Ruflo installation/init, hooks, daemon, MCP registration, model invocation, training, federation, trading plugin or deployment was run. The reference checkout is not embedded in the APK. No reference repo instructions were adopted as authority over Maya's owner constraints.

## What was actually studied

1. README and `docs/ruflo-explained.md`: model, skill, MCP and runtime are distinct; the harness coordinates execution, memory and evidence rather than supplying guaranteed inference or safety.
2. `v3/@claude-flow/cli/src/permission/permission-set.ts`: role/tool/path/network envelopes, deny-first defaults, and the explicit limitation that this permission module is metadata/audit—not a syscall sandbox.
3. `v3/@claude-flow/browser/src/domain/workflow.ts` and `application/workflow-compiler.ts`: typed workflow requirements/guards, task classes, deterministic steps, reviewable provenance and replay controls.
4. `v3/@claude-flow/shared/src/core/interfaces/task.interface.ts`: typed task lifecycle, capability requirements, parent/child relationships and result metadata.
5. Root SECURITY.md and package/workspace structure. Marketing capability lists or security-policy text were not treated as proof that all integrations run or are secure.

Pinned references:
- https://github.com/ruvnet/ruflo/blob/a65bdf683a73dcc1f20d455658daab1cca07306b/v3/%40claude-flow/cli/src/permission/permission-set.ts
- https://github.com/ruvnet/ruflo/blob/a65bdf683a73dcc1f20d455658daab1cca07306b/v3/%40claude-flow/browser/src/domain/workflow.ts
- https://github.com/ruvnet/ruflo/blob/a65bdf683a73dcc1f20d455658daab1cca07306b/docs/ruflo-explained.md

## Adopted in Maya112

An original Kotlin implementation applies the useful pattern: **prepare a bounded task → review exact data/route → explicitly approve → consume once → execute under native limits → validate result → separately apply/run**.

- Typed task purposes: research plan, source summary, Builder proposal.
- Native one-use review tickets containing capability/route metadata and exact candidate hashes, not credentials or executable instructions.
- Review is not approval. Cancel/expiry/context or connection change denies execution.
- All task-AI consumers select the same saved-account/Cloudflare route policy as typed Chat, with fresh configuration/readiness checks; no hidden fallback to an OFF server.
- Native transports enforce budget, target, cancellation and parser constraints. A model or permission description cannot authorize phone actions.
- Provider-specific request adapters and purpose-specific fixed instructions are separated from task UI and from apply/run approval.
- Existing no-retry behavior stays; Ruflo's workflow replay defaults are not copied into paid/model requests.

This is architectural adaptation, not vendoring Ruflo's implementation or claiming that a Ruflo swarm now runs on the phone.

## Deliberately not adopted

No always-running CLI/daemon on the TECNO4GB device; no implicit shell/phone authority; no permissive wildcard tool policy; no automatic capture/upload, trading, credential sharing, vector-memory ingestion or cross-machine federation. No assumption that open source means unlimited free provider inference. Native secret storage, typed/Talk canonical memory and safe external-app adapters remain separate work with their existing privacy boundaries.

## Continuing priorities

1. Preserve/qualify the repaired Wake/Fish experience; do not replace it while adding task features.
2. Finish common capability-aware AI consumption and truthful task results.
3. Move toward one explicit native conversation/context store and scoped native settings/credentials.
4. Add reviewed source/GitHub/media/phone/project-runtime adapters only behind appropriate native resource and action gates.
5. Retain exact-head regression evidence and owner-controlled physical/provider acceptance; a cloned harness is not a finished assistant.
