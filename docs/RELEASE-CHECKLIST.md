# 📋 RELEASE CHECKLIST — har release se PEHLE ye 10 qadam (WAQT 0 · 0.5)
#
# Usool: ek bhi qadam adhoora = release nahi. Jaldbaazi = wapas aana parta hai.

## Pehle (code se pehle)

- [ ] 1. `npm test` — **1000+ sab sabz** (1 fail bhi = ruk jao)
- [ ] 2. `node build.js --check` — web/ se dono index.html fresh
- [ ] 3. Version sab jagah EK: `package.json` · `app/build.gradle` versionName ·
       `sw.js` cache name (`maya-vX.Y.Z`) · README banner
- [ ] 4. Jo badla uska `docs/RELEASE-vX.Y.Z.md` — purani riwayat (forensic: bug ki
       jarh, ilaj, test count)

## Device test (aap ka phone — 5 minute smoke)

- [ ] 5. 🔥 App install → "torch on karo" (BIJLI, 50ms)
- [ ] 6. 🎤 "Maya" bolo → wake word jaagti hai
- [ ] 7. 🧠 Ek sawal (dimaag) + 🗣️ ek jawab (awaaz — kategi nahi)
- [ ] 8. ⚙️ Settings → koi setting badlo → SAVE → app band/khola → **zinda hai?**

## Release

- [ ] 9. Commit message: `vX.Y.Z: <kya badla>` — push → Actions GREEN → APK artifact
- [ ] 10. `release-apk.yml` Run workflow (tag) → phone par nayi APK install kar ke
        #5-8 DOBARA

## Rollback (kuch bigre to)

- Purana tag ka APK wapas install karo (releases page)
- Web version: `git revert` + push — Pages khud theek
- `FLAGS` switch OFF (LAB) — naya feature band, purana raasta zinda

## ⛔ HARD STOPS (koi bhi ho to release band)

- Koi test red
- Awaaz kat-ti hai / mic larai wapas
- Settings reset masla wapas
- Keystore/signing warning ke bagair APK install na ho
- Battery drain (idle par service shor)
