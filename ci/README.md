# 📦 ci/ — GitHub Actions ke behtar workflow (MANUALLY copy karne hain)

**Wajah:** Arena ka bot token GitHub App hai aur us ke paas `workflows` permission **nahi** —
is liye wo `.github/workflows/*` push nahi kar sakta (push par GitHub khud reject karta hai:
*"refusing to allow a GitHub App to create or update workflow … without `workflows` permission"*).
Ye wahi pabandi hai jo `release-apk.yml` ke purane comment mein likhi thi.

**Aap ka kaam (2 minute):** neeche ki dono files ko `.github/workflows/` mein **overwrite** kar dein
(agar aap `main` par hain to wahan commit karein; branch par hain to PR merge kar dein):

| Yahan se | Yahan le jayein |
|---|---|
| `ci/PROPOSED-build-apk.yml` | `.github/workflows/build-apk.yml` |
| `ci/PROPOSED-release-apk.yml` | `.github/workflows/release-apk.yml` |

```bash
cp ci/PROPOSED-build-apk.yml   .github/workflows/build-apk.yml
cp ci/PROPOSED-release-apk.yml .github/workflows/release-apk.yml
git add .github/workflows && git commit -m "ci: APK verify + public release link" && git push
```

## In mein kya naya hai

### 1) `5. APK VERIFY` (dono workflows)
APK **ban jana** kaafi nahi — saboot zaroori hai ke andar wahi code gaya jo test hua:
- APK ke andar ka `assets/web/index.html` + `assets/web/sw.js` repo se **byte-identical** hon (warna build FAIL).
- `MAYA_VER` aur SW cache (`maya-v<VER>`) APK ke andar hon.
- v5.16.0 ke features (`artistDoctor`, `answerOk` hijack guard) waqai APK mein hon.
- Kotlin `appVersion = <VER>-native`.

Yaani ghalat/purani APK **kabhi ship nahi ho sakti** — build ruk jati hai.

### 2) `7. GitHub Release — MAYA-latest.apk` (build-apk.yml)
Har push ke baad APK ek **rolling release** (`latest`) par upload hoti hai (`--clobber`), notes mein
version · versionCode · size · **sha256** · commit. Repo public hai, is liye ye link **bina login**
ke chalta hai aur hamesha taza APK deta hai:

```
https://github.com/adil-chandio/Mana-android/releases/download/latest/MAYA-latest.apk
```

`permissions: contents: write` add kiya gaya hai (release upload ke liye).

### 3) Versioned release (release-apk.yml)
`Actions → Release MAYA APK → Run workflow → tag = v5.16.0 → branch` se chalayein. Asset ka naam
`MAYA-<tag>-vc<versionCode>.apk` hota hai aur notes mein size/sha256/commit + report doc ka ishara.

---

## Fil-haal (bina in files ke) APK kaise milegi

Purana `release-apk.yml` pehle se GitHub par maujood hai, is liye use **dispatch** kiya ja sakta hai:

```bash
gh workflow run release-apk.yml -f tag=v5.16.0 --ref arena/01a062e9-mana-android
```

Public link (repo public hai, login nahi chahiye):

```
https://github.com/adil-chandio/Mana-android/releases/download/v5.16.0/MAYA-v5.16.0.apk
```

Ya Actions run ke **Artifacts → MAYA-APK** se (is ke liye GitHub login chahiye).
