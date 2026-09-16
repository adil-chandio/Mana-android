/* Fish conversation: explicit session, original configured AI account, Fish-only output.
 * No native Direct context, saved memories, tools, model discovery, keyless or provider fallback. */
(function (w) {
  "use strict";
  var active = null, review = null, serial = 0;
  var routes = {
    groq: "https://api.groq.com/openai/v1/chat/completions",
    cerebras: "https://api.cerebras.ai/v1/chat/completions",
    gemini: "https://generativelanguage.googleapis.com/v1beta/models/",
    mistral: "https://api.mistral.ai/v1/chat/completions",
    openrouter: "https://openrouter.ai/api/v1/chat/completions",
    github: "https://models.github.ai/inference/chat/completions",
    nvidia: "https://integrate.api.nvidia.com/v1/chat/completions",
    zai: "https://api.z.ai/api/paas/v4/chat/completions"
  };
  var errors = {
    BUSY: "Another voice/request is busy. Stop it before starting Fish conversation.",
    FISH: "Saved Fish setup is unavailable. Check the existing Fish settings; no other voice was used.",
    AI: "No eligible configured AI account/model was found. Fish supplies speech, not the AI answer. Check your existing AI settings.",
    CHANGED: "Voice, input language or AI selection changed. Conversation stopped; start again to review it.",
    INPUT_LANGUAGE: "The speech service reports this language/model is unavailable. Check Voice & AI settings; no service or output voice was silently changed.",
    INPUT_PERMISSION: "Microphone permission is missing or revoked. Allow it explicitly in the app settings, then start Talk again.",
    INPUT: "Speech input did not finish. Conversation stopped; tap Talk to try again.",
    NETWORK: "AI request failed or timed out. No automatic retry or other provider was used.",
    AI_ACCESS: "The existing AI account denied this request. Check that account; no other provider was used.",
    AI_RATE: "The existing AI account reached a quota/rate limit. No automatic retry or paid fallback.",
    AI_MODEL: "The reviewed AI model is unavailable. Check the existing model setting; no model was silently changed.",
    FISH_ACCESS: "Fish denied the voice request. Your saved voice/key were not changed; no substitute voice was used.",
    FISH_RATE: "Fish reached a quota/rate limit. The text answer remains visible; no automatic retry or other voice.",
    RESPONSE: "AI returned no valid spoken answer, or requested tools. No action was executed.",
    LIMIT: "Conversation reached its time, turn or context limit. Tap Talk to begin a new one.",
    STOPPED: "Fish conversation ended. Remote processing/usage may already have occurred."
  };
  function now() { return performance.now(); }
  function text(s, max) {
    return typeof s === "string" && s.trim().length > 0 && s.length <= max &&
      !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s) && !/(?:[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:^|[^\uD800-\uDBFF])[\uDC00-\uDFFF])/.test(s);
  }
  function aiConfig() {
    var choices = BRAIN.plan(false).filter(function (it) { return !it.p.keyless && routes[it.p.id]; });
    if (!choices.length) throw Error("AI");
    var it = choices[0], p = it.p, key = BRAIN.keys(p)[it.ki], model;
    if (p.id === "gemini") model = settings.model && settings.model !== "auto" ? settings.model :
      (MODEL_CACHE && MODEL_CACHE.names && MODEL_CACHE.names[0]) || MODELS[0];
    else model = (BRAIN.models[p.id] && BRAIN.models[p.id][0]) || p.models[0];
    if (!key || !/^[a-zA-Z0-9._:/-]{1,160}$/.test(model)) throw Error("AI");
    if (p.id === "gemini" && !/^[a-zA-Z0-9._-]{1,100}$/.test(model)) throw Error("AI");
    if (p.id === "openrouter" && !/:free$/.test(model)) throw Error("AI");
    if (p.id !== "gemini" && p.url !== routes[p.id]) throw Error("AI");
    if (p.id !== "gemini" && [400,1400].indexOf(BRAIN.budget(model)) < 0) throw Error("AI");
    return { provider: p.id, model: model, key: key, tokens: p.id === "gemini" ? 280 : BRAIN.budget(model) };
  }
  function config() {
    if (FISH.block() || settings.voiceOn === false || settings.voiceEngine === "off") throw Error("FISH");
    if (["ur-PK", "hi-IN", "en-IN", "en-US"].indexOf(settings.stt) < 0) throw Error("INPUT");
    var c=aiConfig();c.voice=FISH.voice();c.fishKey=FISH.key();c.language=settings.stt;return c;
  }
  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  function emit(s, kind, value) {
    if (active !== s) return;
    w.MayaBridge.fishTalkEvent(s.id, kind, value || "");
  }
  function current(s) {
    if (active !== s) return false;
    if (now() - s.started < 0 || now() - s.started >= 300000) { stop(s.id, "LIMIT"); return false; }
    return true;
  }
  function phase(s, name) { s.phase = name; emit(s, "state", name); }
  function clearInput(s) { clearTimeout(s.silence); clearTimeout(s.inputLimit); s.silence = null; s.inputLimit = null; }
  function cancelRequest(s) {
    if (!s.request) return;
    var id = s.request; s.request = null; delete BRAIN.waiting[id];
    clearTimeout(s.requestLimit);
    try { w.MayaBridge.cancelHttpPost(id); } catch (e) {}
  }
  function stop(id, code) {
    var s = active;
    if (!s || (id && id !== s.id)) return;
    emit(s, "end", errors[code] || errors.STOPPED);
    active = null; clearInput(s); clearTimeout(s.expiry); clearTimeout(s.echo); clearTimeout(s.audioLimit); cancelRequest(s);
    INPUT_SESSION.stop(); listening = false; thinking = false; speaking = false;
    try { w.MayaBridge.stopListen(); } catch (e) {}
    try { SUKOON.sunEnd(); } catch (e) {}
    s.messages.length = 0; s.config = null;
  }
  function legacyFlagsBlock() {
    var restricted=false;
    try {restricted=!!(w.MayaBridge && w.MayaBridge.legacyRestricted && w.MayaBridge.legacyRestricted()===true);} catch(e) {return true;}
    return !restricted && (settings.autoListen || settings.proactive || settings.notifSpeak);
  }
  function describe() {
    review = null;
    try {
      if (active || listening || thinking || speaking || TURNS.active || INPUT_SESSION.active ||
          legacyFlagsBlock()) throw Error("BUSY");
      var c = config(), token = "review" + (++serial);
      review = { token: token, at: now(), config: c };
      return JSON.stringify({ code: "READY", review: token, provider: c.provider, model: c.model, language: c.language, tokens: c.tokens });
    } catch (e) { return JSON.stringify({ code: errors[e.message] ? e.message : "AI" }); }
  }
  function listen(s) {
    if (!current(s)) return;
    if (s.turns >= 5) { stop(s.id, "LIMIT"); return; }
    try { if (!same(s.config, config())) { stop(s.id, "CHANGED"); return; } } catch (e) { stop(s.id, "CHANGED"); return; }
    if (thinking || speaking || FISH.streamPending) { stop(s.id, "BUSY"); return; }
    clearInput(s);
    phase(s, "starting"); listening = true; SUKOON.sunStart();
    var input = INPUT_SESSION.begin("fish-talk", 0); s.input = input.id; s.began = false;
    s.inputLimit = setTimeout(function () { if (current(s) && s.input === input.id) stop(s.id, "INPUT"); }, 20000);
    try { w.MayaBridge.listenOwned(s.config.language, input.id); } catch (e) { stop(s.id, "INPUT"); }
  }
  function start(id, token) {
    var r = review; review = null;
    if (active || !/^[a-f0-9]{32}$/.test(id) || !r || r.token !== token || now() - r.at < 0 || now() - r.at >= 60000) return false;
    try {
      if (listening || thinking || speaking || TURNS.active || INPUT_SESSION.active ||
          legacyFlagsBlock() || !same(r.config, config())) return false;
      var s = { id: id, started: now(), config: r.config, messages: [], turns: 0, phase: "starting", request: null, input: null };
      active = s;
      s.expiry = setTimeout(function () { if (active === s) stop(id, "LIMIT"); }, 300000);
      listen(s); return active === s;
    } catch (e) { if (active) stop(id, "INPUT"); return false; }
  }
  function request(s, value) {
    var input = s.messages.concat([{ role: "user", content: value }]);
    if (input.length > 10 || input.reduce(function (n, m) { return n + m.content.length; }, 0) > 6000) { stop(s.id, "LIMIT"); return; }
    var c = s.config, body, url, auth = "";
    var instruction = "You are Maya, a conversational assistant. Reply naturally in the user's language, usually in one to three short sentences. No tools or phone actions are available. Never claim to have executed an action. Do not invent live information. Output only your answer, no reasoning trace.";
    if (c.provider === "gemini") {
      url = routes.gemini + c.model + ":generateContent?key=" + encodeURIComponent(c.key);
      body = { systemInstruction: { parts: [{ text: instruction }] }, contents: input.map(function (m) {
        return { role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] };
      }), generationConfig: { temperature: 0.7, maxOutputTokens: c.tokens } };
      if (/gemini-2\.5/.test(c.model)) body.generationConfig.thinkingConfig = { thinkingBudget: 0 };
    } else {
      url = routes[c.provider]; auth = "Bearer " + c.key;
      body = { model: c.model, messages: [{ role: "system", content: instruction }].concat(input), temperature: 0.7, max_tokens: c.tokens, stream: false };
    }
    var payload = JSON.stringify(body);
    if (unescape(encodeURIComponent(payload)).length > 16384) { stop(s.id, "LIMIT"); return; }
    s.turns++; thinking = true; phase(s, "thinking"); emit(s, "user", value);
    var req = "ft_" + s.id + "_" + s.turns; s.request = req;
    s.requestLimit = setTimeout(function () { if (current(s) && s.request === req) stop(s.id, "NETWORK"); }, 15000);
    BRAIN.waiting[req] = function (status, raw) {
      if (!current(s) || s.request !== req) return;
      s.request = null; delete BRAIN.waiting[req]; clearTimeout(s.requestLimit); thinking = false;
      if (status < 200 || status >= 300) { stop(s.id, status===429 ? "AI_RATE" : status===401 || status===402 || status===403 ? "AI_ACCESS" : status===404 ? "AI_MODEL" : "NETWORK"); return; }
      try {
        if (!same(c, config())) { stop(s.id, "CHANGED"); return; }
        if (typeof raw !== "string" || raw.length > 65536) throw Error();
        var data = JSON.parse(raw), answer = "";
        if (c.provider === "gemini") {
          if (!Array.isArray(data.candidates) || data.candidates.length !== 1) throw Error();
          var candidate = data.candidates && data.candidates[0];
          if (!candidate || candidate.finishReason !== "STOP") throw Error();
          var parts = candidate.content && candidate.content.parts;
          if (!Array.isArray(parts) || parts.some(function (p) { return p.functionCall || p.thought || typeof p.text !== "string"; })) throw Error();
          answer = parts.map(function (p) { return p.text; }).join("");
        } else {
          if (!Array.isArray(data.choices) || data.choices.length !== 1) throw Error();
          var choice = data.choices && data.choices[0], message = choice && choice.message;
          if (!choice || choice.finish_reason !== "stop" || !message || (message.role != null && message.role !== "assistant") || (message.tool_calls != null && (!Array.isArray(message.tool_calls) || message.tool_calls.length > 0)) || message.function_call != null) throw Error();
          answer = message.content;
        }
        if (!text(answer, 2000) || /<\/?think\b/i.test(answer)) throw Error();
        s.messages = input.concat([{ role: "assistant", content: answer }]);
        emit(s, "assistant", answer); speak(s, answer);
      } catch (e) { stop(s.id, "RESPONSE"); }
    };
    try { w.MayaBridge.httpPostAsync(url, auth, payload, req, 15000); } catch (e) { stop(s.id, "NETWORK"); }
  }
  function speak(s, answer) {
    if (!current(s)) return;
    try {
      if (!same(s.config, config())) { stop(s.id, "CHANGED"); return; }
      var clean = cleanSpeech(answer);
      if (!text(clean, 2000)) { stop(s.id, "RESPONSE"); return; }
      speaking = true; SUKOON.bolStart(); phase(s, "fish-starting");
      s.audioLimit = setTimeout(function () { if (current(s)) stop(s.id, "FISH"); }, 210000);
      // Same saved Fish body/reference; dedicated native output owner, never a TTS ladder.
      w.MayaBridge.fishTalkSpeak(s.id, s.turns, FISH.body(clean, ""), FISH.headers());
    } catch (e) { stop(s.id, "FISH"); }
  }
  function owns(owner) { return !!active && active.input === owner && (active.phase === "starting" || active.phase === "listening" || active.phase === "finalizing"); }
  w.FISH_TALK = {
    // Native-only configuration read. No draft/context argument, microphone or provider request.
    chatConfig: function () {
      try {var c=aiConfig();c.code="READY";return JSON.stringify(c);} catch(e) {return JSON.stringify({code:"AI"});}
    },
    describe: describe, start: start, stop: stop,
    active: function () { return !!active; },
    owns: owns,
    ready: function (owner) {
      var s = active; if (!owns(owner) || !current(s) || s.phase !== "starting") return;
      phase(s, "listening");
      if (!s.began) s.silence = setTimeout(function () { if (current(s) && s.input === owner && !s.began) stop(s.id, "INPUT"); }, 15000);
    },
    began: function (owner) { if (owns(owner)) { active.began = true; clearTimeout(active.silence); active.silence = null; } },
    ended: function (owner) { if (owns(owner)) phase(active, "finalizing"); },
    result: function (owner, value) {
      var s = active; if (!owns(owner) || !current(s) || !INPUT_SESSION.matches(owner)) return;
      clearInput(s); s.input = null; INPUT_SESSION.stop(); listening = false; SUKOON.sunEnd();
      try { w.MayaBridge.stopListen(); } catch (e) {}
      if (!text(value, 2000)) { stop(s.id, "INPUT"); return; }
      if (/^\s*(stop|bas|bas karo|ruk jao|end conversation|band karo)\s*[.!]?\s*$/i.test(value)) { stop(s.id, "STOPPED"); return; }
      request(s, value.trim());
    },
    error: function (owner, code) { if (owns(owner)) stop(active.id, code===12 || code===13 ? "INPUT_LANGUAGE" : code===9 ? "INPUT_PERMISSION" : "INPUT"); },
    outputActive: function () { return !!active && (active.phase === "fish-starting" || active.phase === "fish-playing"); },
    audioEvent: function (id, turn, event, status) {
      var s=active;
      if (!s || s.id!==id || s.turns!==turn || !current(s) || !w.FISH_TALK.outputActive()) return;
      if (event === "playing") {phase(s,"fish-playing");return;}
      if (event !== "done") {stop(s.id,status===429 ? "FISH_RATE" : status===401 || status===402 || status===403 ? "FISH_ACCESS" : "FISH");return;}
      clearTimeout(s.audioLimit);speaking=false;SUKOON.bolEnd();phase(s,"echo");
      s.echo=setTimeout(function () {if(current(s) && s.phase==="echo") listen(s);},600);
    }
  };
})(window);
