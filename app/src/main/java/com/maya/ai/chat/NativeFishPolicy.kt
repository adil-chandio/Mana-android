package com.maya.ai.chat

import com.maya.ai.voice.FishRequestPolicy
import org.json.JSONObject

/** Only a trusted local settings snapshot. Never persists, logs or exports credentials. */
object NativeFishPolicy {
    const val MAX_TEXT = 2000
    enum class Code(val hint: String) {
        IDLE("Sunao is optional. Nothing is read aloud automatically."),
        PREPARING("Checking the saved Fish setup locally…"),
        READY("Saved Fish setup is available locally. This is not a provider/audio test."),
        STARTING("Waiting for Fish audio. STOP is available; provider usage may count."),
        PLAYING("Selected Fish audio is playing."),
        DONE("Fish playback completed. This is not proof of speaker identity or measured latency."),
        STOPPED("Voice stopped locally. Fish work may continue; usage may count. No automatic retry."),
        MAIN_REQUIRED("Open the original Maya first, then enter Private Chat from there. No hidden launch or settings copy."),
        ASSISTANT_BUSY("Original assistant is active or not ready. Use the local readiness check; settings were not changed."),
        FISH_OFF("Fish is OFF in the original Maya. No substitute voice was selected."),
        VOICE_MISSING("No saved Fish reference. Check Audio Library in the original Maya; no default voice will be used."),
        VOICE_INVALID("Saved Fish reference is invalid. It was not changed or erased."),
        VOICE_CHANGED("Fish selection changed while preparing. Nothing was substituted; try only after checking your settings."),
        KEY_MISSING("Saved Fish key is missing or invalid. Use original Maya settings, never paste a key into Chat."),
        TOO_LONG("Sunao supports up to 2,000 reply characters and one synthesis request; no text is silently truncated."),
        CONSENT_REQUIRED("Confirm sending this one text to Fish before playback."),
        TIMEOUT("Fish setup/audio wait expired. No automatic retry or fallback; usage may count if dispatched."),
        RATE_LIMIT("Fish rate/quota limit. No retry or different model/voice was selected."),
        ACCESS_DENIED("Fish access was denied. Check your existing provider setup; no raw provider details are shown."),
        MODEL_UNAVAILABLE("The configured Fish free model is unavailable/payment-gated. No paid fallback was used."),
        INTERRUPTED("Voice was interrupted by audio focus or another speaker. No automatic resume."),
        UNAVAILABLE("Saved Fish setup or audio could not be validated. No fallback voice or automatic retry.")
    }
    sealed class Result {
        class Error(val code: Code) : Result()
        object Ready : Result()
        class Prepared internal constructor(val body: String, val headers: String) : Result() {
            override fun toString() = "NativeFishPrepared(redacted)"
        }
    }
    fun validText(text: String) = text.isNotBlank() && text.length <= MAX_TEXT && NativeChatProtocol.validReply(text)
    fun audioCode(event: String, status: Int): Code = when (event) {
        "playing" -> Code.PLAYING
        "done" -> Code.DONE
        "timeout" -> Code.TIMEOUT
        "interrupted" -> Code.INTERRUPTED
        else -> when (status) { 401, 403 -> Code.ACCESS_DENIED; 402 -> Code.MODEL_UNAVAILABLE; 429 -> Code.RATE_LIMIT; else -> Code.UNAVAILABLE }
    }
    fun decode(raw: String?, textExpected: Boolean): Result = try {
        require(raw != null && raw.length <= 65536)
        val root = JSONObject(raw)
        val code = root.opt("code")
        if (code != "READY") {
            require(root.keys().asSequence().toSet() == setOf("code"))
            val allowed = setOf(Code.MAIN_REQUIRED, Code.ASSISTANT_BUSY, Code.FISH_OFF, Code.VOICE_MISSING,
                Code.VOICE_INVALID, Code.VOICE_CHANGED, Code.KEY_MISSING, Code.RATE_LIMIT, Code.TOO_LONG, Code.UNAVAILABLE)
            Result.Error(allowed.firstOrNull { it.name == code } ?: Code.UNAVAILABLE)
        } else if (!textExpected) {
            require(root.keys().asSequence().toSet() == setOf("code")); Result.Ready
        } else {
            require(root.keys().asSequence().toSet() == setOf("code", "body", "headers", "reference"))
            require(root.get("body") is String && root.get("headers") is String && root.get("reference") is String)
            val body = root.getString("body"); val headers = root.getString("headers")
            FishRequestPolicy.validate(body, headers)
            val b = JSONObject(body); val h = JSONObject(headers)
            require(b.keys().asSequence().toSet() == setOf("text", "format", "mp3_bitrate", "latency", "chunk_length", "normalize", "temperature", "top_p", "prosody", "reference_id"))
            require(b.getString("reference_id") == root.getString("reference"))
            require(b.getString("text").isNotBlank() && b.get("mp3_bitrate") == 128 && b.get("latency") == "balanced")
            require(b.get("chunk_length") == 100 && b.get("normalize") == true)
            require(b.get("temperature") is Number && b.getDouble("temperature") in 0.1..0.9)
            require(b.get("top_p") is Number && b.getDouble("top_p") == 0.7)
            val prosody = b.getJSONObject("prosody")
            require(prosody.keys().asSequence().toSet() == setOf("speed", "volume", "normalize_loudness"))
            require(prosody.get("speed") is Number && prosody.getDouble("speed") in 0.5..2.0)
            require(prosody.get("volume") == 0 && prosody.get("normalize_loudness") == true)
            require(h.keys().asSequence().toSet() == setOf("Authorization", "Content-Type", "model", "Accept"))
            require(h.get("Content-Type") == "application/json" && h.get("Accept") == "*/*")
            val auth = h.getString("Authorization")
            require(auth.length in 8..4103 && auth.all { it.code in 32..126 })
            Result.Prepared(body, headers)
        }
    } catch (_: Exception) { Result.Error(Code.UNAVAILABLE) }

    fun script(text: String?): String {
        require(text == null || validText(text))
        val argument = if (text == null) "null" else JSONObject.quote(text).replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
        return "(function(text){var idle=" + NativeChatReadiness.LOCAL_SCRIPT + ";" + LOCAL_PREPARE + "})(" + argument + ")"
    }
    // Evaluated only in the trusted packaged MainActivity page, never a remote document.
    // FISH.body/headers and BOLI are the existing pure builders, NOT FISH.speak/req.
    const val LOCAL_PREPARE = """
      try {
        if(idle!=='READY') return {code:'ASSISTANT_BUSY'};
        if(typeof FISH!=='object'||!FISH||typeof FISH.body!=='function'||typeof FISH.headers!=='function'||typeof FISH.voice!=='function') return {code:'UNAVAILABLE'};
        if(settings.fishOn!==true) return {code:'FISH_OFF'};
        if(typeof settings.fishKey!=='string'||!settings.fishKey.trim()||settings.fishKey.trim().length>4096||/[^\x21-\x7e]/.test(settings.fishKey.trim())) return {code:'KEY_MISSING'};
        if(settings.fishVoice===null||settings.fishVoice===undefined||settings.fishVoice==='') return {code:'VOICE_MISSING'};
        if(typeof settings.fishVoice!=='string'||!/^[A-Za-z0-9_-]{1,200}$/.test(settings.fishVoice)) return {code:'VOICE_INVALID'};
        if(typeof FISH.cool!=='number'||!isFinite(FISH.cool)) return {code:'UNAVAILABLE'};
        if(Date.now()<FISH.cool) return {code:'RATE_LIMIT'};
        if(FISH.MODEL!=='s2.1-pro-free') return {code:'UNAVAILABLE'};
        var ref=settings.fishVoice;
        if(FISH.voice()!==ref) return {code:'VOICE_CHANGED'};
        if(text===null) return {code:'READY'};
        if(typeof text!=='string'||!text.trim()||text.length>2000) return {code:'TOO_LONG'};
        if(typeof BOLI!=='object'||!BOLI||typeof BOLI.say!=='function') return {code:'UNAVAILABLE'};
        var last=BOLI.last, body, headers;
        try {body=FISH.body(text,''); headers=FISH.headers();} finally {BOLI.last=last;}
        if(FISH.voice()!==ref||JSON.parse(body).reference_id!==ref) return {code:'VOICE_CHANGED'};
        return {code:'READY',body:body,headers:headers,reference:ref};
      } catch(e) {return {code:'UNAVAILABLE'};}
    """
}
