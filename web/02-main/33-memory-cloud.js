/* ═══════════════════════════════════════════════════════════════════════════
   ☁️ MEMORY CLOUD — WAQT 3-B · yaad ka cloud backup (encrypted)
   ---------------------------------------------------------------------------
   Facts + diary + summary + ledger ko AES-GCM se encrypt kar ke repo ke
   /memory/ folder mein bhej do (GitHub Contents API). Device udd jaye to
   bhi yaad rahegi — aur doosre phone par wapas aa jayegi.

   HIFAZAT (3 teh):
   1. API KEYS kabhi cloud par NAHI (sirf yaad: facts/diary/summary/ledger)
   2. Sab kuch AES-GCM 256 + PBKDF2 se encrypted — repo PUBLIC hai, magar
      ciphertext se koi faida nahi. Bina cloud-code ke file bekaar.
   3. crypto.subtle na ho to BILKUL nahi bhejte (plaintext public repo par
      kabhi nahi).

   Settings: settings.cloudCode (aap ka backup code) + settings.ghKey
   (GitHub PAT — repo scope). ═══════════════════════════════════════════════ */
var MEMCLOUD = {
  REPO: "adil-chandio/Mana-android",
  PATH: "memory/maya-memory.json",
  VER: 1,
  PBKDF2_ITERS: 120000,

  /* sirf yeh keys cloud par jati hain — keys/tokens/ghKey KABHI NAHI */
  YAAD_KEYS: ["maya_facts", "maya_diary", "maya_summary", "maya_ledger"],

  b64: {
    enc: function (bytes) {
      var s = "", i;
      for (i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
      return btoa(s);
    },
    dec: function (str) {
      var s = atob(String(str || "")), a = new Uint8Array(s.length), i;
      for (i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
      return a;
    }
  },

  subtle: function () {
    try { return (window.crypto && window.crypto.subtle) || null; } catch (e) { return null; }
  },

  /* PBKDF2 → AES-GCM key */
  _key: function (code, saltB) {
    var subtle = MEMCLOUD.subtle();
    return subtle.importKey("raw", MEMCLOUD._codeBytes(code), "PBKDF2", false, ["deriveKey"])
      .then(function (base) {
        return subtle.deriveKey(
          { name: "PBKDF2", salt: saltB, iterations: MEMCLOUD.PBKDF2_ITERS, hash: "SHA-256" },
          base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
      });
  },
  _codeBytes: function (code) {
    /* code → UTF-8 bytes (bina TextEncoder ke bhi chale) */
    var s = unescape(encodeURIComponent(String(code || ""))), a = new Uint8Array(s.length), i;
    for (i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
    return a;
  },

  /* plain JSON string → { v, salt, iv, data } (sab base64) */
  encrypt: function (plain, code) {
    var subtle = MEMCLOUD.subtle();
    if (!subtle) return Promise.reject(new Error("is WebView mein crypto.subtle nahi — encrypted backup nahi"));
    if (!code || String(code).length < 4) return Promise.reject(new Error("cloud code kam az kam 4 harf ka rakhein"));
    var saltB = window.crypto.getRandomValues(new Uint8Array(16));
    var ivB = window.crypto.getRandomValues(new Uint8Array(12));
    return MEMCLOUD._key(code, saltB).then(function (key) {
      return subtle.encrypt({ name: "AES-GCM", iv: ivB }, key, MEMCLOUD._codeBytes(plain));
    }).then(function (encBuf) {
      return {
        v: MEMCLOUD.VER,
        salt: MEMCLOUD.b64.enc(saltB),
        iv: MEMCLOUD.b64.enc(ivB),
        data: MEMCLOUD.b64.enc(new Uint8Array(encBuf))
      };
    });
  },

  /* { v, salt, iv, data } → plain JSON string (ghalat code = saaf error) */
  decrypt: function (wrap, code) {
    var subtle = MEMCLOUD.subtle();
    if (!subtle) return Promise.reject(new Error("crypto.subtle nahi"));
    wrap = wrap || {};
    return MEMCLOUD._key(code, MEMCLOUD.b64.dec(wrap.salt)).then(function (key) {
      return subtle.decrypt({ name: "AES-GCM", iv: MEMCLOUD.b64.dec(wrap.iv) }, key, MEMCLOUD.b64.dec(wrap.data));
    }).then(function (buf) {
      return decodeURIComponent(escape(String.fromCharCode.apply(null, new Uint8Array(buf))));
    }).catch(function (e) {
      throw new Error("decrypt nahi hua — cloud code ghalat hai? (" + (e && e.message || e) + ")");
    });
  },

  /* ─── GitHub Contents API (settings.ghKey — repo scope) ─── */
  _gh: function (method, b64content, sha, msg) {
    var url = "https://api.github.com/repos/" + MEMCLOUD.REPO + "/contents/" + MEMCLOUD.PATH;
    var headers = {
      "Authorization": "token " + settings.ghKey,
      "Accept": "application/vnd.github+json"
    };
    var body;
    if (method === "PUT") {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify({ message: msg || ("maya memory backup " + new Date().toISOString()), content: b64content, sha: sha || undefined });
    }
    return fetch(url, { method: method, headers: headers, body: body }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) throw new Error("GitHub HTTP " + r.status + " — " + (j.message || "?"));
        return j;
      });
    });
  },

  gather: function () {
    var out = { v: MEMCLOUD.VER, at: (new Date()).toISOString(), ver: (typeof UPDATE_CHECK !== "undefined" ? UPDATE_CHECK.VER : "?"), yaad: {} };
    var i, k;
    for (i = 0; i < MEMCLOUD.YAAD_KEYS.length; i++) {
      k = MEMCLOUD.YAAD_KEYS[i];
      try { out.yaad[k] = localStorage.getItem(k); } catch (e) {}
    }
    return out;
  },

  /* ─── BACKUP: gather → encrypt → PUT ─── */
  backup: function (cb) {
    var code = settings.cloudCode;
    if (!settings.ghKey) {
      cb("\u2601\uFE0F MEMORY CLOUD\n\n\u274C GitHub key (ghKey) nahi hai.\n\n  Settings \u2192 API KEYS \u2192 GitHub token daalein:\n  github.com/settings/tokens \u2192 Generate new token (classic)\u2192 scope: repo.\n  Wohi token yahan paste karein.");
      return;
    }
    if (!code || String(code).length < 4) {
      cb("\u2601\uFE0F MEMORY CLOUD\n\n\u274C Cloud code nahi hai (kam az kam 4 harf).\n\n  Settings mein apna backup code rakhein — yehi code backup ko kholta hai.\n  \uD83D\uDD12 Bhool gaye to backup bekaar — kahin likh lein!");
      return;
    }
    if (!MEMCLOUD.subtle()) {
      cb("\u2601\uFE0F MEMORY CLOUD\n\n\u274C Is WebView mein encryption nahi — bina encrypt ke PUBLIC repo par kabhi nahi bhejte.");
      return;
    }
    var plain;
    try { plain = JSON.stringify(MEMCLOUD.gather()); } catch (e) {
      cb("\u274C Backup error: " + e.message); return;
    }
    var shaP = MEMCLOUD._gh("GET").then(function (j) { return j.sha || ""; }).catch(function () { return ""; });
    shaP.then(function (sha) {
      return MEMCLOUD.encrypt(plain, code).then(function (wrap) {
        return MEMCLOUD._gh("PUT", btoa(JSON.stringify(wrap)), sha, "maya: memory backup (encrypted) " + new Date().toISOString().slice(0, 10));
      });
    }).then(function (j) {
      cb("\u2601\uFE0F MEMORY CLOUD BACKUP \u2014 tayyar! \u2705\n\n  Jagah: " + MEMCLOUD.REPO + "/" + MEMCLOUD.PATH + "\n  Encrypt: AES-GCM (cloud code se) \u2014 repo public hai, aap ki yaad mehfooz.\n  Kis cheez ka backup: facts · diary · summary · ledger\n  \u274C keys/tokens cloud par NAHI gaye.\n\n  Wapas laane ke liye: \u2601\uFE0F MEMORY RESTORE (usi cloud code se).");
      try { pushLog("MEMCLOUD: backup OK (" + new Date().toLocaleTimeString() + ")"); } catch (e) {}
    }).catch(function (e) {
      cb("\u274C Backup nakaam: " + (e && e.message || e) + "\n\n  Internet / ghKey (repo scope) / cloud code check karein.");
      try { pushLog("MEMCLOUD: backup fail — " + (e && e.message || e)); } catch (e2) {}
    });
  },

  /* ─── RESTORE: GET → decrypt → apply ─── */
  restore: function (cb) {
    var code = settings.cloudCode;
    if (!settings.ghKey) { cb("\u274C GitHub key (ghKey) nahi hai \u2014 Settings mein daalein."); return; }
    if (!code) { cb("\u274C Cloud code nahi hai \u2014 wohi code chahiye jis se backup banaya tha."); return; }
    MEMCLOUD._gh("GET").then(function (j) {
      if (!j.content) throw new Error("file khali hai");
      return JSON.parse(atob(String(j.content).replace(/\s/g, "")));
    }).then(function (wrap) {
      return MEMCLOUD.decrypt(wrap, code);
    }).then(function (plain) {
      var data = JSON.parse(plain);
      var yaad = data.yaad || {}, k, n = 0;
      for (k in yaad) {
        if (MEMCLOUD.YAAD_KEYS.indexOf(k) < 0) continue;   /* sirf whitelist */
        if (yaad[k] !== null && yaad[k] !== undefined) { localStorage.setItem(k, yaad[k]); n++; }
      }
      cb("\u2601\uFE0F MEMORY RESTORE \u2014 ho gaya! \u2705\n\n  " + n + " yaad wapas aa gayin (backup: " + (data.at || "?") + ").\n  App dobara khul rahi \u2014 sab apni jagah.");
      try { pushLog("MEMCLOUD: restore OK — " + n + " yaad"); } catch (e) {}
      setTimeout(function () { try { location.reload(); } catch (e) {} }, 1300);
    }).catch(function (e) {
      cb("\u274C Restore nakaam: " + (e && e.message || e) + "\n\n  Cloud code ghalat? Pehle backup bana tha is device par?");
    });
  },

  report: function () {
    var L = ["\u2601\uFE0F MEMORY CLOUD \u2014 yaad ka cloud backup", ""];
    L.push("  GitHub key (ghKey) : " + (settings.ghKey ? "\u2705 lag rahi hai" : "\u274C nahi"));
    L.push("  Cloud code         : " + (settings.cloudCode ? "\u2705 hai (" + String(settings.cloudCode).length + " harf)" : "\u274C nahi"));
    L.push("  Encryption         : " + (MEMCLOUD.subtle() ? "\u2705 AES-GCM ready" : "\u274C is WebView mein nahi"));
    L.push("");
    L.push("  Backup kya jata hai: facts · diary · summary · ledger");
    L.push("  Kabhi NAHI jata   : API keys · tokens · chat \u2014 sirf yaad");
    L.push("");
    L.push("  Kaise chalayein:");
    L.push("  1. Settings \u2192 GitHub token (github.com/settings/tokens \u2192 scope: repo)");
    L.push("  2. Settings \u2192 Cloud code (apna raaz code \u2014 kahin likh lein)");
    L.push("  3. \u2601\uFE0F BACKUP button \u2014 bas!");
    return L.join("\n");
  }
};
