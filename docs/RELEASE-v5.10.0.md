# 📦 RELEASE v5.10.0 — "TEAM BUILD" · 🕯️ SMART-PRO · ✋ SCROLL · 📡 AUTO-UPDATE

> Pehla release jo poora **agentic team workflow** ke tehat bana (docs/TEAM-MASTER-PLAN.md).
> Har agent ne apna task mukammal kiya · 1018 tests sab sabz · invariants locked.

---

## 🕯️ SMART-PRO (P6 KHUD-MUKHTAR v2) — wajah se baat, shor se nahi

**Jarh:** purana proactive har 6 minute **RANDOM jumla** bolta tha (P6 doc: "bay-maqsaad shor").

**Ilaj:** ab sirf **WAJAH** hoti hai to hi bolti hai:
| # | Wajah | Misal |
|---|---|---|
| 1 | ⏰ **Scheduled task** agle ghante mein due | "Sir, 20 minute baad Ali ko message bhejna hai" |
| 2 | 📊 **Aadat** (LEDGER se — 3 din, ek hi ghanta) | "Aap aksar is waqt youtube karte ho — abhi karna hai?" |
| 3 | 🌅 **Morning brief** roz 1 dafa (8-11 baje) | mausam + battery ke saath |
| 4 | 💬 **Fact follow-up** roz max 1 | gentle yaad-dilani |

**Sakht hadain:** roz max **3** · raat 11 se subah 8 **chup** · 10 min idle · koi wajah na → **bilkul chup**. LEDGER ab **1000** amal rakhta hai (60 se barha — aadat mining ke liye kai din ka data).

## ✋ SCROLL — maya_act ab "neeche scroll karo" samajhta hai

`maya_act` mein naya action: **`scroll` + `dir: down|up|left|right`** — user se andha
coords nahi maangte. Kotlin khud screen size se swipe compute karta hai. Same hard
guards: banking block · rate limit · timeout · kill-switch.

## 📡 AUTO-UPDATE — naya APK aaya to pata chal jayega

GitHub Releases se `releases/latest` (muft, koi key nahi): boot ke baad silent check ·
LAB → 🔄 APP UPDATE button · naya version → HUD log + notification + **click = download**.
Version ab **ek jagah**: `UPDATE_CHECK.VER` — 6 jagah match ki test lock.

## 🛡️ INVARIANTS (tools/test-invariants.js — 16 taale)

- 🔒 Password kabhi code mein wapas na aaye · keystore git mein kabhi na
- 🏷️ 6 jagah version ek jaisa
- 🛡️ Banking block · rate limit · kill words zinda
- 🕯️ Random PRO_LINES wapas na aaye · SMART_PRO hadain zinda

## 🏗️ STRUCTURE (WAQT 0+1 — pehle hi commits mein)

- Keystore/password code se bahar (docs/SECURITY.md) · CI mein tests gate
- `web/` = source → `node build.js` → index.html (32 modules, byte-safe)

## 🧪 Tests: **1018** (13 build-sync · 16 invariants · 72 UI · 296 voice · 155 brain · 466 lab)

## 📱 Device test (aap ke liye — 5 min)
1. "torch on karo" (BIJLI) · "Maya" (wake) · ek sawal + awaaz
2. 🕯️ proactive ON karo → 10 min chhod do → **wajah ke bagair chup** rahe to SABZ
3. maya_act: "screen par neeche scroll karo" (Accessibility ON)
4. LAB → 🔄 APP UPDATE → "sab se naya version" dikhna chahiye
