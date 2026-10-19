# MAYA v5.11.0 — WAQT 3-B: CLOUD YAAD + NTFY ALERTS

**Date:** 2026-10-19
**Chunk:** WAQT 3 ka baqi hissa — `/memory/` cloud backup + ntfy bridge (+ cloud-brain faisla)

## 🔔 NTFY BRIDGE (`32-ntfy-bridge.js`)

- **ntfy.sh** (0 paisa, koi account nahi) par Maya ke ahem paighaam — doosre
  phone/laptop/browser par (ntfy app ya web)
- Hooks: **SMART_PRO** proactive message · **battery-full** alert · **AMAL kill-switch/stop**
- Privacy: default **OFF** · topic = aap ka raaz (random rakhein) · format guard
  (6-64 harf, sirf `[A-Za-z0-9_-]`) · sensitive matn kabhi nahi
- LAB: 🔔 NTFY TEST + report

## ☁️ MEMORY CLOUD (`33-memory-cloud.js`)

- **Facts + diary + summary + ledger** ka backup → repo `/memory/maya-memory.json`
  (GitHub Contents API, `settings.ghKey` — repo scope)
- **3-teh hifazat**: (1) API keys/tokens/chat kabhi cloud par nahi — sirf yaad
  whitelist; (2) **AES-GCM 256 + PBKDF2 (120k)** encryption — public repo par
  sirf ciphertext; (3) `crypto.subtle` na ho to **bilkul nahi bhejte**
- Cloud code = aap ka backup code (settings) — bhool gaye to backup bekaar
- LAB: ☁️ BACKUP → GitHub · ☁️ RESTORE ← GitHub (confirm ke baad) · ☁️ HAAL

## 🧠 Cloud brain (repository_dispatch) — Faisla: abhi nahi

Plan mein "repository_dispatch → GitHub Actions → jawab wapas" tha. Imandar
analysis: (a) **Pollinations already quota-free + seedha** brain pool mein hai —
relay sirf latency (30-60s) add karta hai; (b) prompt/answer PUBLIC repo par
jata = privacy risk (encrypt karne ke liye Action ko code chahiye = Secrets =
abhi set nahi ho sakte); (c) 3 moving parts vs 0 faida. **Tab banayenge jab
Pollinations bhi mar jaye + user ek secret set kare.**

## Version

- versionName `5.11.0` · versionCode **78**
- Tests: **1058/1058** (build-sync 13 · invariants 27 · css · settings 72 · voice 296 · brain 155 · **cloud 29** · lab 466)
- naya test file: `tools/test-cloud-bridge.js` (29 locks) + fragment lock 32→34
