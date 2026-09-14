# 5.25.0 (96): Chat + Agent inside the main Maya surface

## Owner correction addressed

Owner said these functions belong inside main Maya, not in a corner/Settings entry. The primary Home area now contains a large **CHAT + AGENT** entry above the voice orb. The main bottom CHAT button and drawer Chat open this same primary workspace. Settings and separate launcher entries are optional compatibility shortcuts, not the required path.

This is not just another link to NativeChatActivity: **MainActivity hosts native Chat/Agent views in its own view hierarchy**, hiding (not destroying) the legacy WebView underneath. No second Chat Activity is launched. NativeChatWorkspace supplies the same UI/logic to the main host and compatibility launcher; no duplicated chat engine or JS-exposed signing/action API was introduced.

## Interaction and privacy

- Opening the workspace requires the existing fixed navigation URI from a main-frame, user-gesture request on the trusted packaged page. No URL query/payload, draft, history or credentials are forwarded. JavaScript only requests fixed navigation; synthetic clicks cannot launch through the new handler, and the native gate independently checks gesture/frame/origin.
- Web browser builds retain their existing Chat tab; native-only entries explain that the APK is required. No fake browser Agent, automatic install or web key registration.
- Main Chat/Agent begins blank. The original voice conversation/history is NOT imported into private Chat. Existing typed voice input, orb, saved selected Fish reference and original tools remain separate and unchanged below the main entry.
- Chat, Checks, Info and Agent remain internal native tabs. Their explicit draft-to-research flow, approval, STOP and separate data-consent boundaries from 95 remain intact. Ordinary Send never becomes unrestricted model-driven execution.
- **MAYA HOME** / Back uses the native exit confirmation whenever either workspace has content. Closing clears Chat/Agent, destroys that native pane, restores the original surface and performs only a fixed trusted `showTab('tab-home')` UI command. No private text enters JavaScript, DOM storage or legacy diagnostics.
- Main pause/stop/destroy/focus/touch events are forwarded to the owned workspace. Backgrounding clears private state; returning resumes blank without a request. The retained original Main remains available for the existing trusted saved-Fish preparation, with BOLI.last restoration and owned playback protections unchanged.
- Existing startup behavior of original Maya (including its existing permissions/voice initialization) was not expanded or activated by the assistant. Opening the new pane itself creates no key/request, starts no service and asks for no permission.

## Verification and limits

The prior NativeChatActivity tests now exercise the shared NativeChatWorkspace via its compatibility host. New MainActivity tests cover in-place view ownership/no Chat intent or automatic transport, gesture/frame/origin rejection, confirmed return Home/blank reopen and clearing research on background. Offline JavaScript tests cover primary Home placement, APK bottom-nav routing, synthetic-click denial and browser fallback. Shadow WebView does not execute the actual page or make live network requests; these are not phone or live voice/provider tests.

Version/packaged-asset parity and all existing Chat/Fish/research regression suites remain required. CI result is recorded separately after the final build. No Worker, uploader pin, signing key, Fish policy/model/reference, permissions or legacy action implementation is changed.

Still bounded public research, not full cross-app control, private Vision, persistent history or exhaustive deep research. No full-project completion or physical integration claim. Server Chat remains owner-controlled; manual plans do not need it ON, AI does. In-place development update only; no uninstall/clear-data or updater activation.
