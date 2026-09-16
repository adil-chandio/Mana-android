# Voice command router — "Bolo, task banao" — 5.44.0 (115)

## What this release adds

Speak (or type) a WhatsApp command and Maya builds a prefilled reviewed task card.
You still Review it and press Run yourself; Maya never sends anything on her own.

```
923001234567 ko whatsapp karo ke kal milte hain
  → WhatsApp card: number 923001234567 · message "kal milte hain"

send whatsapp message to 923001234567 saying happy birthday
  → WhatsApp card: number 923001234567 · message "happy birthday"

@ammi ko whatsapp karo ke khana kha liya
  → WhatsApp card: number EMPTY (@ammi is not stored yet) · message kept
```

Flow: Mic → transcript REVIEW → **⚡ Task banao** (dictation panel) → card appears
in Agent mode → check number/message → Review → Run → WhatsApp opens, text is typed
once → **you press SEND**. Typed draft text works too when no transcript is active.

## Router grammar (v1, deterministic, local)

`VoiceCommand.parse` is pure JVM: no Android services, no network, no AI, no
execution. It only extracts (digits?, @name?, message?) or returns null.

- A WhatsApp word is required (`whatsapp`, `watsapp`, `whats app`, …).
- A command verb must come AFTER it: likho/likh, bhejo/bhej, send, message,
  type, bolo/bol, karo/kar. First verb by position wins; filler verbs before the
  connector are consumed (`message karo ke …`).
- Recipient: first 7–15 digit run BEFORE the verb (spaces/dashes allowed).
  Pakistani `0…` numbers become `92…` (`03001234567` → `923001234567`).
  Digits AFTER the verb stay message text (`likho ke call 03001234567` keeps the
  number in the message and leaves the recipient empty).
- `@name` mentions are captured but NOT resolved yet — the number stays empty for
  you to fill. Plain names (`ammi ko …`) are message context, never guessed into
  numbers. Name → number memory is the next slice.
- Message: after the verb, one leading `ke/ki/that/saying/:/,` is stripped; an
  English `saying/that` split applies when no leading connector exists. 1–500
  characters; the WhatsApp card re-validates shape at Review.
- A leading wake word (`maya …`) is stripped and reused text stays untouched.

Anything outside this grammar returns null with a spoken example in the status —
never a guessed card. Misparses are caught by the human Review gate: the number
and exact text are always visible before Run.

## Ruflo fresh-study verdict (reference only, not shipped)

`ruvnet/rufio` does not exist; the owner meant `ruvnet/ruflo` (spelled in the
latest direction), cloned fresh at depth 1 as a read-only reference outside the
repo (MIT licensed). Findings:

- Ruflo is a TypeScript CLI/MCP meta-harness for coding agents on desktops and
  servers ("Agent = Model + Harness"). Its permission file states honestly that
  it is a metadata + audit layer, not a runtime sandbox, and its sandbox story
  is E2B cloud — paid/cloud, excluded from this 0-budget APK.
- Nothing phone-executable was adopted: no runtime, daemon, MCP server, model
  service or dependency was added to the APK. The portable lessons (model writes
  text only; the harness owns tools/loops/controls; typed tasks with scoped
  reviewable stages; memory search-before-task and store-patterns-after-success)
  were already Maya's architecture (reviewed adapters, one-use grants,
  service-owned plans). This release's pure-JVM local router follows the same
  "harness owns execution" rule.
- Next portable idea queued, not claimed: explicit name → number memory for the
  router (user-managed, encrypted, no contact permission).

## Cloudflare and preserved features

- Cloudflare stays parked: saved-account AI only; no Worker, deployment, key
  change, paid fallback or new service.
- Wake/Fish/input, both reviewed adapters, legacy quarantine, task AI caps and
  encrypted saved work are unchanged.

## Verification and remaining work

Pure JVM tests cover digits forms, 0→92, spaced/dashed runs, @names, Urdu and
English verbs, separators, STT misspellings, wake stripping, digits-after-verb,
short-run rejection, over-long/empty rejection and injection-shaped message
text. Workspace tests cover prefilled-card creation and non-command rejection
without slot use. Offline boundary checks lock the parse-only nature (no
Android/network/AI/execution symbols in the router).

Final exact-head build/test/artifact evidence is in the CI run. No real
microphone run, recognition, AI/Fish call or WhatsApp run was performed by the
coding agent. This is a verified-code development candidate, not
physical-phone certification.

Still required: device qualification, quick-recipient memory, more verbs and
adapters (YouTube/media next), stronger observation, canonical typed/Talk
memory, native credential migration, richer project/GitHub/media features and
trusted updates. In-place update only; never uninstall or Clear Data.
