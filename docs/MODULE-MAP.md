# 🗺️ MODULE MAP — kis file mein KYA hai (team ka naqsha)

> Source: `web/` · Build: `node build.js` → `index.html` (assets + public)
> Rule: `02-main/` ke fragments EK hi `<script>` tag ke andar jodte hain
> (hoisting safe) — unhe kabhi alag-alag script tags mat banana.
> Har edit ke baad: `npm test` (1002+) · `node build.js` + commit built file bhi.

## `web/` — top level

| File | Kya |
|---|---|
| `00-head.html` | HTML markup + CSS (Settings/HUD/Chat ke saare screens) |
| `01-boot.js` | Debug eyes bootstrap (console errors → badge) |
| `03-obsidian.js` | OBSIDIAN UI module (themes, enter/force-enter) |
| `99-tail.html` | `</body></html>` |

## `web/02-main/` — poora engine (30 modules, tartib = chalne ka tartib)

### 🧱 CORE
| Module | Kya | Aage yahan hoga |
|---|---|---|
| `00-core.js` | settings, memory, diary, chat history, DOM, STATE, helpers, tabs | `web/core/` ka future |
| `01-boot-bridge.js` | splash/boot, audio chime, **MayaBridge** (Kotlin ↔ JS), TTS init | bridge contracts |

### 🎙️ AWAAZ (voice)
| Module | Kya |
|---|---|
| `02-voice-artists.js` | Edge neural voice artists |
| `03-awaaz.js` | **AWAAZ ENGINE** — WAHID DARWAZA + 5-step ladder (Fish→Gemini→Edge→neural→phone) |
| `05-suno.js` | 🎙️ SUNO — STT fixer (Urdu→Roman, name dictionary) |
| `06-boli.js` | 🗣️ BOLI — Roman→Urdu/Devanagari speech text + accent (sab se bara module) |
| `07-edge-tts.js` | 🌊 Edge TTS (Kotlin WS bridge) |
| `08-fish-audio.js` | 🐟 Fish Audio S2.1 |

### 🧠 BRAIN
| Module | Kya |
|---|---|
| `13-never-stop.js` | Never-stop brain (fallback queue) |
| `14-brain-pool.js` | 🧠🔥 BRAIN POOL v3 — 10 free providers, cooldown, multi-key |
| `15-dimaag.js` | 🧠 DIMAAG ENGINE v2 — askAI, agent loop, Gemini provider |

### 🛠️ TOOLS & AMAL
| Module | Kya |
|---|---|
| `10-local-commands.js` | Local commands (BIJLI ke pehle wala router) |
| `12-tools.js` | AI TOOLS — TOOL_DECLS (38 tools) + `execTool` |
| `16-nazar-bijli.js` | 👁️ NAZAR (screen read) + ⚡ BIJLI (50ms) + 👁️ AANKHEIN (camera/vision) |
| `19-amal-engine.js` | ⚡ AMAL ENGINE — tools har dimaag ko (OpenAI/Gemini translators) |
| `21-amal-tools.js` | 🖐 AMAL (may_act JS side) + scheduler + web shark + files + sandbox + youtube |

### 🛡️ SAFETY & TRUTH
| Module | Kya |
|---|---|
| `17-ijazat-ledger.js` | 🛡️ IJAZAT (🟢🟡🔴) + RAILS + 📜 LEDGER + ⟲ UNDO + 📊 TRACE |
| `18-haqeeqat.js` | 🤝 HAQEEQAT — SACH BOLO (jhoot rokna, post-check) |
| `22-kaan-sukoon.js` | 👂 KAAN (wake word JS side) + 🎚️ SUKOON (audio referee / HAAL) |

### 🧪 LAB & QUALITY
| Module | Kya |
|---|---|
| `04-lab-core.js` | SCHEMA, 🧪 FLAGS, 📊 NAAP, 🧹 SAAF, 👑 MALIK, 📋 DIAG, 🗃️ HARVEST |
| `25-lab-ui.js` | 🧪 MAYA LAB UI (switches, baseline, harvest) |

### 🎨 UI
| Module | Kya |
|---|---|
| `09-api-chat.js` | Public API, STT UI, orb, chat UI, main handler, memory UI |
| `11-timers-weather.js` | Timers/reminders + weather chips |
| `20-skills-vision.js` | Skills engine + vision + namaz + WhatsApp reader |
| `23-ui-tabs.js` | HUD + COMMANDS + SETTINGS tab shells |
| `24-setform.js` | 🗄️ SETFORM — settings ka WAHID DARWAZA (44 fields) |
| `26-fish-edge-ui.js` | 🐟 FISH doctor + 🌊 EDGE picker UI |
| `27-studio-diag.js` | Voice studio + diagnostics + chat events |
| `28-live-badges.js` | Awaaz badge + brain pool live naqsha |
| `29-init.js` | Consolidate memory + INIT |

## `tools/` — tests (har module ke saath badhte hain)

| File | Lock karta hai |
|---|---|
| `test-build-sync.js` | 🆕 pipeline: web/ fresh + fragments tartib ke saath |
| `check-oldwebview-css.js` | Purane WebView par CSS |
| `test-settings-ui.js` | SETFORM + settings UI |
| `test-voice-engine.js` | AWAAZ/EDGE/FISH |
| `test-brain-engine.js` | DIMAAG/BRAIN pool |
| `test-lab-engine.js` | LAB + safety + tools darje |

## `app/src/main/java/` — Kotlin (kam badalta hai)

| File | Kya |
|---|---|
| `MainActivity.kt` | WebView shell + MayaBridge (STT/TTS/HTTP/tools) |
| `WakeWordService.kt` | Background wake word + SUKOON HAAL |
| `AutoSendService.kt` | Accessibility: auto-send + NAZAR dump |
| `MayaAct.kt` | 🖐 Safety engine + kill-switch |
| `MicKit.kt` | Mic zoom/NS/AGC/AEC |
| `MayaNotifService.kt` | Notifications reader |
| `ScheduledReceiver.kt` / `BootReceiver.kt` | Alarms + boot restart |
