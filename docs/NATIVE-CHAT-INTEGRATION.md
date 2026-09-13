# Native text Chat v1 — 5.19.0 (88)

## Implemented scope

A standalone native Activity, not a browser wrapper, with a launcher icon and a
trusted local WebView user-gesture navigation link. Incoming intent data/extras
are ignored. Opening it neither creates keys nor makes network requests.

Explicit key creation/inspection returns a separate AndroidKeyStore P-256 public
JWK. Only that public value can be copied. No private-key import/export, key
rotation, browser registration replacement or provider-secret entry exists.
Hardware backing/attestation remains unverified until device testing.

Explicit access/replay check sends the same signed **empty diagnostic** twice:
200 then 409, with no model invocation. Sending text requires separate consent.
Native transport uses fixed HTTPS origin/paths, system TLS trust, pinned
OkHttp 4.12.0, bounded body reads, cancellation and a remaining 20-second call
budget including signing. Redirects, authentication, cookies, cache and connection
retries are disabled. A network-exchange guard additionally blocks HTTP follow-up
retries (including 503 Retry-After: 0) before a second request is written.

The strict bounded JSON reader rejects duplicate keys, trailing input, invalid
UTF-8, excessive nesting/node count and unsafe text. Successful replies bind
nonce/key ID/model and text-only capabilities. Raw server errors are never shown.
The UI renders plain selectable text, not HTML, scripts, links or actions.

Completed-only context uses the established limits. No silent history trimming.
STOP, failure, stale callbacks and lifecycle exit cannot add failed turns.
Conversation methods are synchronized; one shared zero-queue executor prevents
unbounded work when an old platform key/DNS operation is slow. STOP is **local**:
it cannot guarantee remote cancellation/refund or interrupt every platform call.
Leaving/backgrounding/recreation clears draft, conversation and consent; public
identity persists only in Keystore, while displayed public metadata is not secret.
No message persistence/logging is introduced; OS/keyboard/provider retention is
not claimed to be absent.

## Existing assistant boundary

Key inspection/empty checks do not start or stop voice. Before model send, the
screen checks existing wake/audio state, the legacy local UI's idle flags, and a
read-only existing action-queue predicate. Busy/unknown fails closed. Preferences
are never rewritten. The owner must stop legacy work/disable wake/auto-listen
manually for this isolated text test. These are readiness checks, **not a global
lock or guarantee that every independent service has stopped**. Reading existing
MayaAct status initializes its existing idle handler; it does not enqueue or
execute an action. Native replies have no route to that engine. Selected Fish,
wake algorithms and Agent permissions are unchanged.

## Separately revocable backend identity

`OWNER_PUBLIC_JWK` remains the browser owner. Optional `APK_PUBLIC_JWK` authorizes
one distinct native identity. Both share existing quota/replay storage. Removing
the APK binding revokes native access, not the browser. Invalid/private/duplicate
APK key configurations deny non-owner requests while the browser remains usable.

Uploader preservation deliberately accepts exactly nine existing bindings, or
exactly ten including a valid distinct APK public JWK. It never creates the slot.
Both keys and full opaque AI/config metadata must survive readback unchanged.
All prior latest=active, Chat OFF, logs OFF and no-promotion constraints remain.
The **consumed source-parent gate is intentionally unchanged**. This native build
push cannot upload/promote the candidate or enroll a key. A later specifically
reviewed backend upload must pin its actual immediate parent; do not bypass the
gate to silence the Cloudflare check.

## Build/distribution

Version 88 is higher than installed development version 87. Application ID,
checked-in development signing configuration and keystore are unchanged: this is
an in-place development update, not a Stable release or updater activation.
That historical signing key is public: distribution trust is NOT production-safe
and a malicious same-signer update could access app data/Keystore. No uninstall
or clear-data is required or recommended. Changing to secure release signing is
a separate migration, not silently done here.

## Verification / remaining owner-only steps

Local mocked backend, uploader and existing web regressions are run without live
inference. New JVM response/transport tests extend the existing protocol/context
suite; the CI debug build is gated by `testDebugUnitTest`. JVM wire tests verify
64 JCA signatures and exercise the exact bundled Worker with a **separate synthetic
APK slot**, fake D1/AI and blocked network. Backend tests separately exercise SQL.

Build/phone results belong in the delivery receipt, not inferred from this design.
After a successful build: install the exact higher-version APK in place, open
**Maya Text Chat**, create/show and copy the **PUBLIC** JWK. Backend upload/promotion
and APK-public-key authorization are the next owner-controlled boundary. Keep
Chat OFF until signed empty native checks and isolated phone readiness pass.
No old browser recall/visual tests need repeating. Subsequent live model checks
are owner-run, small and explicitly bounded. Fish integration and Agent execution
remain later phases; this update does not claim either is finished.
