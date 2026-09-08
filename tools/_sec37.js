
  /* ═══ 37. 🎵 v5.14.0 "EK AWAAZ" — K1 (awaaz) + K2 (mic) ke taale (F67–F78) ═══
     Malik ki shikayatein (us ke apne alfaaz):
       · "awaz kat rahi hai — 1 artist bolta hai phir ekdam se koi or artist aa ke
          bolta hai, awaz change ho jati hai"
       · "usko sunai NAHI de raha, samajh NAHI aa raha main kya bol raha hun…
          mobile ko mouth ke pass la ke bolta hun… 1 hi cheez bar bar bolni parti
          hai… 1 baar boli usne suna hi nahi, reply wagera kuch nahi aaya"
     K1 = ENGINE LOCK (ek jawab = ek artist) + tukron ki batching (kam TTS request)
          + agle tukre ki pehle se mang (gap khatam) + Gemini TTS ka roz ka hisaab
     K2 = TURN LOCK (do jawab takrana band) + SOCH_RAHI (chautha haal) + 700ms
          silence (adhoora transcript khatam) + khali transcript ka ilaaj          */
  head('37. 🎵 v5.14.0 — EK AWAAZ: ek artist, pakka sun-na');
  {
    const AWAAZSRC = HTML.slice(HTML.indexOf('var AWAAZ = {'), HTML.indexOf('var EDGE_TTS = {'));
    const JSRC37 = HTML.slice(HTML.indexOf('var JAWAB = {'), HTML.indexOf('var HAALBAR = {'));
    const SUK37 = HTML.slice(HTML.indexOf('var SUKOON = {'), HTML.indexOf('var KAAN = {'));
    const MA37 = fs.readFileSync(path.join(ROOT, 'app/src/main/java/com/maya/ai/MainActivity.kt'), 'utf8');
    const WS37 = fs.readFileSync(path.join(ROOT, 'app/src/main/java/com/maya/ai/WakeWordService.kt'), 'utf8');
    const ST37 = fs.readFileSync(path.join(ROOT, 'app/src/main/java/com/maya/ai/WakeState.kt'), 'utf8');
    is(AWAAZSRC.length > 1000 && JSRC37.length > 500 && SUK37.length > 300,
      '🔬 K1/K2 ke source-slice mil gaye (test andaze par nahi, asal code par chalta hai)');

    /* ── A. ENGINE LOCK: CHALA kar parakho ── */
    function awaazWorld(o) {
      o = o || {};
      const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'dangerously', url: 'https://appassets.androidplatform.net/' });
      const w = dom.window;
      w.pushLog = function () {}; w.$ = () => null; w.NATIVE = false;
      w.settings = { name: 'Boss', lang: 'roman-ur' };
      w.eval(HTML.slice(HTML.indexOf('var SCHEMA = {'), HTML.indexOf('var AWAAZ = {')));
      w.eval(AWAAZSRC);
      const A = w.AWAAZ;
      w.__calls = [];
      A.cfg = function () { return { on: true, mode: 'auto', key: 'k', fish: true, edge: true, maxChars: 4000, wifiOnly: false }; };
      A.liveKeys = function () { return 1; };
      A.paint = function () {};
      A.note = function (c) { A.lastNote = c; };
      A.stop = function () { A.gen++; w.__calls.push('STOP'); };
      A.fishReady = () => true; A.edgeReady = () => true; A.pollenBad = 0;
      A.fish = function (t, done, err) { w.__calls.push('fish'); if (o.fishFail) err('NETWORK'); else done(); };
      A.neural = function (t, done, err) { w.__calls.push('neural'); if (o.neuralFail) err('QUOTA'); else done(); };
      A.edge = function (t, done, err) { w.__calls.push('edge'); if (o.edgeFail) err('EDGE'); else done(); };
      A.pollen = function (t, done, err) { w.__calls.push('free'); done(); };
      A.device = function (t, done) { w.__calls.push('device'); done(); };
      A.FAST = 0;                                  /* fast-budget timer test mein na chale */
      A.voiceId = () => 'Kore'; A.moodId = () => 'warm';
      A.modelOrder = () => ['gemini-2.5-flash-preview-tts'];
      A.prompt = (t) => t; A.chunkPlan = (t) => [String(t)];
      return w;
    }

    const w1 = awaazWorld();
    const A1 = w1.AWAAZ;
    A1.lockBegin('j1');
    is(A1.lock.key === 'j1' && A1.lock.engine === '',
      '🎵 K1.1 (F67): lockBegin() jawab ki kunji lagata hai — artist abhi khali (pehla tukra seerhi se chunega)');
    A1.speak('pehla jumla yahan aaya', { lockKey: 'j1', onStart: function () {}, onDone: function () {} });
    is(w1.__calls.indexOf('fish') >= 0 && A1.lock.engine === 'fish',
      '🎵 K1.1: pehla tukra seerhi se chuna (🐟 Fish) aur WOHI artist lock mein darj hua', w1.__calls.join('>'));
    w1.__calls = [];
    A1.speak('doosra jumla bhi usi artist se', { lockKey: 'j1', chain: true, onStart: function () {}, onDone: function () {} });
    is(w1.__calls.join('>') === 'fish',
      '🎵 K1.1 (F67): doosra tukra SEEDHA usi artist par — poori seerhi dobara NAHI chali (artist badalna band)',
      w1.__calls.join('>'));
    is(A1.switched === 0, '🎵 K1.1/K4: jawab ke andar artist ZERO dafa badla (switched counter)', 'switched=' + A1.switched);
    is(w1.__calls.indexOf('STOP') === -1,
      '🎵 K1.5 (F71): chain wale tukre par sakht stop() NAHI chala — pichli dum kat-ti nahi');
    A1.setEngine('edge');
    is(A1.switched === 1 && A1.lock.engine === 'edge',
      '🎵 K1.1/K4: agar artist WAQAI badle to ginti darj hoti hai (andhera nahi) — switched 1');

    /* lock ki har tier par seedha raasta */
    [['neural', 'neural'], ['edge', 'edge'], ['device', 'device']].forEach(function (pr) {
      const w = awaazWorld(); const A = w.AWAAZ;
      A.lockBegin('jX'); A.setEngine(pr[0]); w.__calls = [];
      A.speak('usi artist ka tukra', { lockKey: 'jX', chain: true, onStart: function () {}, onDone: function () {} });
      is(w.__calls.join('>') === pr[1],
        '🎵 K1.1: lock "' + pr[0] '" ho to agle tukre seedha ' + pr[1] + ' par (seerhi nahi)', w.__calls.join('>'));
    });

    /* lock wali tier nakam ho to agli tier — khamoshi nahi */
    const wF = awaazWorld({ fishFail: true }); const AF = wF.AWAAZ;
    AF.lockBegin('jF'); AF.setEngine('fish'); wF.__calls = [];
    AF.speak('fish nakam hone wala hai', { lockKey: 'jF', chain: true, onStart: function () {}, onDone: function () {} });
    is(wF.__calls.indexOf('fish') === 0 && wF.__calls.indexOf('neural') > 0,
      '🎵 K1.1: lock wali tier nakam ho to SEERHI wapas (khamoshi kabhi nahi)', wF.__calls.join('>'));
    const wN = awaazWorld({ neuralFail: true }); const AN = wN.AWAAZ;
    AN.lockBegin('jN'); AN.setEngine('neural'); wN.__calls = [];
    AN.speak('neural nakam hone wala hai', { lockKey: 'jN', chain: true, onStart: function () {}, onDone: function () {} });
    is(wN.__calls.indexOf('edge') > 0, '🎵 K1.1: Gemini nakam → Edge (lock toota magar jawab nahi)', wN.__calls.join('>'));

    /* J3 ka fast budget lock se takraata nahi — wo BADLA bhi lock mein darj hota hai */
    const wQ = awaazWorld(); const AQ = wQ.AWAAZ;
    AQ.lockBegin('jQ'); AQ.setEngine('fish'); AQ.fastForced = 'edge'; wQ.__calls = [];
    AQ.speak('fast budget ne kaha tez tier', { lockKey: 'jQ', onStart: function () {}, onDone: function () {} });
    is(wQ.__calls.join('>') === 'edge' && AQ.lock.engine === 'edge',
      '🎵 K1.2 (F68): fast-budget ka faisla LOCK mein darj — agli jumlon par wapas 🐟 par nahi jhoola',
      wQ.__calls.join('>'));

    /* bina chain (naya jawab) → purana sakht stop barqarar */
    const wS = awaazWorld(); const AS = wS.AWAAZ;
    AS.lockBegin('jS'); AS.setEngine('fish'); wS.__calls = [];
    AS.speak('naya jawab, chain nahi', { lockKey: 'jS', onStart: function () {}, onDone: function () {} });
    is(wS.__calls.indexOf('STOP') === 0,
      '🎵 K1.5: NAYE jawab par sakht stop() barqarar (pichli awaaz dabana zaroori hai)');
    AS.lockEnd(); wS.__calls = [];
    AS.speak('lock khulne ke baad', { lockKey: 'jS', onStart: function () {}, onDone: function () {} });
    is(wS.__calls.indexOf('fish') >= 0 && AS.lock.engine === 'fish',
      '🎵 K1.1: lockEnd() ke baad agla jawab apna artist KHUD chunta hai (purana thonsna nahi)');

    /* ── A2. Gemini TTS ka ROZ ka hisaab (F69) ── */
    const wD = awaazWorld(); const AD = wD.AWAAZ;
    is(AD.ttsDay() === 0 && AD.TTS_DAY_MAX === 12 && AD.blockReason('chhota jumla') === '',
      '🎵 K1.6: subah sawere quota hisaab saaf — Gemini neural khula hai');
    for (let i = 0; i < AD.TTS_DAY_MAX; i++) AD.ttsBump();
    is(AD.ttsDay() === 12 && AD.blockReason('chhota jumla') === 'QUOTA_DAY',
      '🎵 K1.6 (F69): 12 request ke baad Gemini TTS BAND (QUOTA_DAY) — free tier ~15/din se pehle Edge pakdo');
    is(JSON.parse(wD.localStorage.getItem('maya_tts_day')).n === 12,
      '🎵 K1.6: roz ka hisaab localStorage mein (app band kar ke kholne par bhi yaad)');
    AD.lockBegin('jD'); AD.setEngine('neural'); wD.__calls = [];
    AD.speak('quota khatam hone ke baad', { lockKey: 'jD', chain: true, onStart: function () {}, onDone: function () {} });
    is(wD.__calls.indexOf('neural') === -1 && wD.__calls.indexOf('edge') >= 0,
      '🎵 K1.6: quota khatam ho to jawab Gemini par ZID nahi karta — Edge par chala jata hai', wD.__calls.join('>'));
    is(/AWAAZ\.ttsBump\(\);\s*\/\* 🎵 K1\.6 — sirf NAYI request/.test(HTML) &&
       HTML.indexOf('AWAAZ.cacheGet(key)') > 0,
      '🎵 K1.6: ginti sirf NAYI request ki hoti hai (cache-hit ya udti hui request par nahi)');

    /* ── A3. preheat: agle tukre ki pehle se mang (F70) ── */
    const wP = awaazWorld(); const AP = wP.AWAAZ;
    let __fetch = 0; AP.fetchClip = function () { __fetch++; };
    AP.lockBegin('jP'); AP.setEngine('neural');
    AP.preheat('ye agla tukra hai jo pehle se mangwaya ja raha hai');
    is(__fetch === 1 && AP.preheats === 1,
      '🎵 K1.4 (F70): Gemini neural par agle tukre ki clip PEHLE se mangwa li (tukron ke beech ka gap khatam)');
    __fetch = 0; AP.setEngine('edge'); AP.preheat('edge par preheat nahi hona chahiye');
    is(__fetch === 0, '🎵 K1.4: preheat sirf us tier par jiska cache hai (Edge/device par bekar request nahi)');
    is(/AWAAZ\.preheat\(RAFTAR\.q\[0\]\)/.test(HTML), '🎵 K1.4: RAFTAR har tukre ke shuru hote hi agla tukra preheat karta hai');

    /* ── B. RAFTAR: tukron ki batching + lock wiring (CHALA kar) ── */
    function raftarWorld() {
      const w = world({});
      w.__spoke = []; w.__opts = []; w.__lock = []; w.__pre = [];
      w.speaking = false;
      w.AWAAZ = {
        engine: 'test',
        stop: function () {},
        lockBegin: function (k) { w.__lock.push('begin:' + k); },
        lockEnd: function () { w.__lock.push('end'); },
        preheat: function (t) { w.__pre.push(String(t)); },
        speak: function (t, cb) {
          w.__spoke.push(String(t)); w.__opts.push(cb || {});
          if (cb && cb.onStart) cb.onStart('test');
          if (cb && cb.onDone) cb.onDone();
        }
      };
      w.__turn = [];
      w.JAWAB = {
        SPEAK_BASE: 1000, SPEAK_PER_CHAR: 1,
        mark: function () {}, clear: function () {},
        turnStart: function (why) { w.__turn.push('start:' + why); },
        turnEnd: function () { w.__turn.push('end'); },
        turnTouch: function () { w.__turn.push('touch'); },
        turn: { on: false, at: 0, why: '' }
      };
      w.__sukoon = [];
      w.SUKOON = {
        bolStart: function () { w.__sukoon.push('bol'); },
        bolEnd: function () { w.__sukoon.push('bolEnd'); },
        sochoStart: function () { w.__sukoon.push('soch'); },
        haal: 'KHALI'
      };
      w.afterSpeak = function () {};
      return w;
    }
    const wR = raftarWorld(); const R = wR.RAFTAR;
    R.begin(true, 0);
    is(R.key.length > 3 && wR.__lock.join(',') === 'begin:' + R.key,
      '🎵 K1.1 (F67): RAFTAR.begin() jawab ki kunji banata hai aur AWAAZ ka lock lagata hai', R.key);
    R.feed('Ji boss, main dekh rahi hoon.');
    is(wR.__opts.length === 1 && wR.__opts[0].lockKey === R.key && wR.__opts[0].chain === false,
      '🎵 K1.1/K1.5: pehle tukre ke sath lockKey jata hai, chain=false (naya jawab = sakht stop)');
    R.feed(' Ab doosra jumla aaya hai jo isi artist se bola jayega.');
    is(wR.__opts.length === 2 && wR.__opts[1].chain === true,
      '🎵 K1.5 (F71): doosre tukre par chain=true — pichli dum katne wali native calls nahi chaltin');
    const __n = wR.__spoke.length;
    R.feed(' Ye chhota sa jumla hai magar batching ki wajah se rukega.');
    is(wR.__spoke.length === __n,
      '🎵 K1.3 (F69): pehle tukre ke BAAD chhota jumla foran nahi bola — HOLD_N=300 (kam TTS request = kam switch)',
      'HOLD_N=' + R.HOLD_N);
    is(R.HOLD_N === 300 && R.SENT_MAX_N > R.SENT_MAX && R.smax() === R.SENT_MAX_N,
      '🎵 K1.3: batching ke number (HOLD_N 300 · SENT_MAX_N ' + R.SENT_MAX_N + ') — pehla tukra chhota, baqi bare');
    R.finish();
    is(/Ye chhota sa jumla/.test(wR.__spoke.join(' | ')) && wR.__lock.indexOf('end') >= 0,
      '🎵 K1.3: finish() par bacha hua matn zaroor bola gaya (batching se kuch KHOTA nahi) + lock khula');

    const wR2 = raftarWorld(); const R2 = wR2.RAFTAR;
    R2.begin(false, 0);
    R2.feed('Main abhi screen parh leti hoon, ek second ruk jao.');
    wR2.__turn = []; wR2.__sukoon = [];
    R2.rearm();
    is(wR2.__turn.join(',') === 'start:tool' && wR2.__sukoon.indexOf('bolEnd') === -1,
      '🎵 K2.3 (F75): tool-step par mic KHULA nahi chhoda jata — turn "tool" par qaim, bolEnd (KHALI) nahi',
      wR2.__turn.join(',') + ' | ' + wR2.__sukoon.join(','));
    R2.abort();
    is(wR2.__lock.filter(function (x) { return x === 'end'; }).length >= 1 && wR2.__turn.indexOf('end') >= 0,
      '🎵 K1.1/K2.1: jawab rad ho to artist lock AUR turn lock dono khulte hain (wake behri nahi rehti)');
    const wR3 = raftarWorld(); const R3 = wR3.RAFTAR;
    R3.begin(true, 0); R3.active = true; R3.q = ['pehla tukra', 'doosra tukra jo preheat hoga'];
    R3.pump();
    is(wR3.__pre.length === 1 && /doosra tukra/.test(wR3.__pre[0]),
      '🎵 K1.4 (F70): bolte waqt AGLE tukre ki mang peeche se chali (gap khatam)', wR3.__pre.join('|'));
    R3.endSpeak();
    is(wR3.__turn.indexOf('end') >= 0 && wR3.__lock.indexOf('end') >= 0,
      '🎵 K2.1: jawab poora hua → turn + artist lock dono khatam (mic wapas khul sakta hai)');

    /* ── C. TURN LOCK + SOCH_RAHI (JAWAB/SUKOON ko CHALA kar) ── */
    function jawabWorld() {
      const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'dangerously', url: 'https://appassets.androidplatform.net/' });
      const w = dom.window;
      w.pushLog = function () {}; w.$ = () => null; w.NATIVE = false;
      w.settings = { name: 'Boss', wakeWord: true };
      w.speaking = false; w.thinking = false; w.listening = false;
      w.__kaan = []; w.__door = 0; w.__bol = []; w.__listen = 0;
      w.KAAN = {
        push: function (k, d) { w.__kaan.push(k + ':' + d); },
        DARWAZA: { open: function () { w.__door++; return 6; }, close: function () {}, isOpen: function () { return true; } }
      };
      w.addBubble = function () {}; w.statusText = {};
      w.speak = function (t) { w.__bol.push(String(t)); };
      w.startListening = function () { w.__listen++; };
      w.AWAAZ = { stop: function () {} };
      w.eval(HTML.slice(HTML.indexOf('var SCHEMA = {'), HTML.indexOf('var AWAAZ = {')));
      w.eval(SUK37);
      w.eval(JSRC37);
      return w;
    }
    const wJ = jawabWorld(); const J = wJ.JAWAB, S = wJ.SUKOON;
    J.turnStart('soch');
    is(J.turn.on === true && J.turn.why === 'soch' && S.haal === 'SOCH_RAHI',
      '🎵 K2.1/K2.2 (F73/F74): turnStart → turn lock ON + SUKOON ka CHAUTHA haal SOCH_RAHI (mic/wake band)');
    is(J.turnOn() === true && J.turnAge() >= 0,
      '🎵 K2.1: turnOn()/turnAge() — gate aur panel isi se poochte hain');
    let ig = J.ignore();
    is(ig === false && /jawab ka turn chal raha hai/.test(String(wJ.statusText.textContent)) && J.n.turnBlocks === 1,
      '🎵 K2.1 (F73): teeno jhande JHOOTHE (sab false) hon tab bhi wake ruk jati hai — WAJAH status par + ginti darj',
      String(wJ.statusText.textContent));
    J.turnStart('soch'); J.turn.at = Date.now() - (J.TURN_MAX + 1000);
    ig = J.ignore();
    is(ig === true && J.turn.on === false,
      '🎵 K2.1: turn MUDAT (45s) se purana ho to khud ilaaj — wake ko hamesha ke liye behra nahi hona dena');
    J.turnStart('soch'); J.turn.at = Date.now() - (J.TURN_MAX + 1000);
    J.watchdog();
    is(J.turn.on === false && J.n.turnExpire === 1,
      '🎵 K2.1: watchdog (har 2s) phanse turn ko khud kholta hai — user ko dobara "Maya" nahi kehna parta');
    J.turnStart('soch'); J.turnEnd();
    is(J.turn.on === false && S.haal === 'KHALI',
      '🎵 K2.1: turnEnd → lock khula + SOCH_RAHI se KHALI (mic wapas taiyar)');
    J.turnStart('soch'); S.bolStart();
    is(S.haal === 'BOL_RAHI' && S._sochT === null,
      '🎵 K2.2: bolna shuru hote hi SOCH_RAHI ka timer rad — BOL_RAHI qaim (echo tail ka hisaab barqarar)');
    S.sochoStart(60);
    is(S.haal === 'SOCH_RAHI', '🎵 K2.2: sochoStart() haal SOCH_RAHI lagata hai (Kotlin isi ko rokta hai)');
    S.sochoEnd();
    is(S.haal === 'KHALI', '🎵 K2.2: sochoEnd() → KHALI (soch khatam, mic khulne layak)');

    /* khali transcript (F77) — chup-chaap band nahi */
    wJ.__kaan = []; wJ.__bol = []; wJ.__listen = 0;
    J.emptyN = 0; J.emptyT = 0;
    J.emptyHear();
    is(J.n.empty === 1 && wJ.__kaan.join('|').indexOf('empty:') === 0 && J.turn.on === false,
      '🎵 K2.6 (F77): pehli khali transcript DARJ hoti hai + turn lock khulta hai (pehle bilkul andhera tha)',
      wJ.__kaan.join('|'));
    J.emptyHear();
    is(wJ.__bol.length === 1 && /sun nahi saki/i.test(wJ.__bol[0]) && wJ.__door >= 1,
      '🎵 K2.6 (F77): dobara bhi khali → BOL kar batati hai + darwaza kholti hai (mic khud dobara)', wJ.__bol[0]);
    is(/if \(!said \|\| !said\.trim\(\)\) \{ try \{ JAWAB\.emptyHear\(\); \} catch \(e\) \{\} return; \}/.test(HTML),
      '🎵 K2.6: __nativeSpeech ka khali-transcript rasta ab referee ke paas jata hai (chup-chaap return qatl)');
    is(/try \{ SUKOON\.sochoStart\(\); \} catch \(e\) \{\}\s*\n\s*handleUserText\(said\.trim\(\), true\);/.test(HTML),
      '🎵 K2.2 (F74): sunai khatam → foran SOCH_RAHI → jawab tak wake/mic band (0.5-2s ki khidki band)');
    is(/try \{ JAWAB\.turnStart\("soch"\); \} catch \(e\) \{\}/.test(HTML) &&
       HTML.indexOf('thinking = true; setOrb("thinking");') > 0,
      '🎵 K2.1: askAI sochna shuru karte hi turn lock lagata hai (stream ke pehle harf par thinking=false hota tha)');
    is(/JAWAB\.turnEnd\(\); \} catch \(e\) \{\}\s*\/\* 🎵 K2\.1 — jawab poora/.test(HTML),
      '🎵 K2.1: bolna khatam → turnEnd (agle turn ke liye mic/wake azad)');

    /* wake gate: turn lock ka asar (KAAN + __wakeHeard ko CHALA kar) */
    {
      const KSRC37 = HTML.slice(HTML.indexOf('var KAAN = {'), HTML.indexOf('window.__wakeErr = function'));
      const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'dangerously' });
      const w = dom.window;
      w.settings = { name: 'Boss', wakeWord: true, stt: 'ur-PK' };
      w.speaking = false; w.thinking = false; w.listening = false;
      w.said = []; w.handleUserText = function (t) { w.said.push(t); };
      w.addBubble = function () {}; w.chime = function () {};
      w.statusText = {}; w.startListening = function () { w.said.push('__LISTEN__'); };
      w.stripWake = function (t) { return String(t).replace(/^\s*(maya|boss)[\s,]*/i, '').trim(); };
      w.FLAGS = { on: function () { return true; } };
      w.SUNO = { pick: function (a) { return String((a && a[0]) || ''); } };
      w.__ignoreAsk = 0;
      w.JAWAB = {
        ignore: function () { w.__ignoreAsk++; return false; },
        age: function () { return 0; },
        turn: { on: false, at: 0, why: '' },
        LISTEN_MAX: 12000, THINK_MAX: 40000, SPEAK_BASE: 20000
      };
      w.eval(KSRC37);
      w.__wakeHeard(JSON.stringify(['maya suno', 'maya']));
      is(w.said.length > 0, '🎙️ turn lock KHALI ho to wake pehle ki tarah chalti hai (koi nayi pabandi nahi)');
      w.said = []; w.__ignoreAsk = 0;
      w.JAWAB.turn = { on: true, at: Date.now(), why: 'soch' };
      w.__wakeHeard(JSON.stringify(['maya suno', 'maya']));
      is(w.said.length === 0 && w.__ignoreAsk === 1,
        '🎵 K2.1 (F73): TURN LOCK laga ho to wake ANDAR NAHI aati — do jawab ek sath takrana band (referee se poochh kar)');
    }

    /* ── D. Kotlin: SOCH_RAHI + silence ── */
    is(/if \(haal == "SOCH_RAHI"\) return "Maya jawab soch rahi hai/.test(WS37),
      '🎵 K2.2 (F74): Kotlin ka haalBlock() SOCH_RAHI par wake ka mic ROKTA hai (JS akela nahi)');
    is(/const val SOCH_EXP_MS = 60000L/.test(ST37) &&
       /haal == "SOCH_RAHI" && t - since > SOCH_EXP_MS/.test(ST37) &&
       (ST37.match(/SOCH_RAHI/g) || []).length >= 4,
      '🎵 K2.2: WakeState mein SOCH_RAHI ki MUDAT (60s) + expiry — JS mar jaye to wake behri na rahe');
    is(/KHALI \| BOL_RAHI \| APP_SUN \| SOCH_RAHI/.test(ST37),
      '🎵 K2.2: haal ki fehrist mein chautha haal darj (panel ab soch bhi dikhata hai)');
    is(/\n\s*700L\s*\n/.test(MA37) && MA37.indexOf('600L') === -1 &&
       /EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 600L/.test(WS37),
      '🎵 K2.5 (F76): app ka mic 700ms khamoshi par rukta hai (jumle ke beech ki saans nahi kat-ti), wake 600ms par (tezi)');
    is(/suno: true/.test(HTML) && /sach: true/.test(HTML),
      '🎵 K2.7 (F78) + K3.5 (F83): kam-yaqeen sunai par poochna + HAQEEQAT ka sach — dono ab DEFAULT ON');
  }
