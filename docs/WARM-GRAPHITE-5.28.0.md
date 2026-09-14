# Maya — Warm Graphite · 5.28.0 (99)

Presentation redesign of the permanent Main workspace delivered in 98. Main retains its original WebView/orb/settings plus one native conversation/composer; switching Direct/Agent never starts another screen, sends the draft, or resets the timeline. No new providers, backend changes, permissions, persistence or updater activation.

## Presentation

- Shared local `MayaTheme`: warm graphite #161719/#212225, border #343538, text #EEEAE4, muted #AAA59E, copper #D79874. Native controls, confirmations and task cards use these tokens. No remote fonts or image assets.
- Maya + an inline overflow menu. New conversation (confirmation), original voice/settings, checks and privacy expand in the same workspace. Detailed limits, version and setup reports are off the main header.
- Original orb: 128dp empty host, 72dp conversation host, original settings expand to 460dp. CSS scales the existing orb to fit the compact host; no replacement listener or fabricated microphone/dictation capability. Original settings values and Fish selection are not rewritten.
- Bottom composer: mode Spinner, Agent task selector, active index.html chip, near-limit counter and concise Direct conversation consent. Checked consent is not repeated; Privacy provides explicit revocation which cancels owned work. Inputs and confirmation protections remain.
- STOP is an independent 48dp footer control, visible for pending work, research approval, and live static preview. Hidden while genuinely idle; never replaced with a cosmetic progress indicator. Mode/STOP/lifecycle cancellation and remote-uncertainty wording stay intact.
- Readable conversation surfaces, explicit Sunao and sensitive-marked local Copy reply. No automatic clipboard write or playback.
- Research cards show review/run/progress/results according to actual runner state. Completed plan is expandable; exact source URLs and Wikipedia attribution remain. Source sharing/browser actions are under each source's inline menu. Every original AI, approval and browser confirmation remains separate.
- Builder: local index.html editor, collapsible Code/Proposal/Preview, monospace proposal/code, bordered isolated preview. Proposals still require Apply confirmation; preview requires a second confirmation. Collapsing preview does not stop it or remove STOP.
- Status details expand rather than lose the full text. Text observers bring errors, remote uncertainty and obscured-touch warnings back immediately, including early-return validation paths. Accessibility reads the actual status, not a generic description.

## Unchanged limits and authority

Chat OFF and the saved APK identity/Worker/model/256-token contract are unchanged. Sunao uses the exact saved Fish configuration, only after consent, with no fallback or autoplay. No live provider/phone tests are authorized by this redesign.

Research is at most three exact public WIKI/REPO reads, not arbitrary browsing or phone automation. Approval, expiry, cancellation epochs, selected browser and separate explanation/context-sharing consent are unchanged.

Builder remains a memory-only single static HTML/CSS file: 8,000 local characters, AI request ≤400/current code ≤1,000, fixed 256 output tokens. Preview has no JS, network, file/content/storage access, downloads, permissions, navigation or native bridge. This is not a multi-file IDE, terminal, Vision system or GitHub writer.

Background/exit still clears owned conversation/draft/consent/code, not saved credentials or remote provider records. Install only as an in-place development update; do not uninstall or clear data. Stable/update trust is not activated.

## Verification boundaries

Network-denied JavaScript regression suite, source security checks, asset/version synchronization and diff checks are run locally. Native Robolectric coverage includes the actual Spinner/mode transitions, menu/consent revocation, active STOP geometry, large-text compact layout, readable palette contrast, source stages/disclosures, Builder disclosures, clipboard opt-in and original WebView resizing. Existing security and lifecycle tests are retained.

The matching GitHub native build/test result and development APK identity must be verified before delivery. These checks are not physical TECNO keyboard/TalkBack/touch rendering, installation, visual screenshot or live-provider proof. No perfect/unlimited capability claim.
