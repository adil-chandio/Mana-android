package com.maya.ai.voice

import org.json.JSONObject

/** Fixed free-tier endpoint; no arbitrary URL, paid-model fallback or voice substitution. */
object FishRequestPolicy {
    const val URL = "https://api.fish.audio/v1/tts"
    const val MODEL = "s2.1-pro-free"
    fun validate(body: String, headers: String): Map<String, String> {
        require(body.toByteArray(Charsets.UTF_8).size <= 32768) { "Speech request too large" }
        require(headers.length <= 8192) { "Invalid speech headers" }
        val b = JSONObject(body)
        require(b.getString("text").length in 1..6000) { "Invalid speech text" }
        require(b.getString("format") == "mp3") { "MP3 required" }
        require(b.opt("reference_id") is String && b.getString("reference_id").trim().length in 1..200) { "Select a Fish voice first" }
        require(!b.has("references")) { "Use the selected voice ID" }
        val h = JSONObject(headers)
        require(h.getString("model") == MODEL) { "Only the configured free Fish model is allowed" }
        val auth = h.getString("Authorization")
        require(auth.startsWith("Bearer ") && auth.length > 7 && !auth.contains('\r') && !auth.contains('\n')) { "Invalid Fish authorization" }
        return mapOf("Authorization" to auth, "model" to MODEL, "Content-Type" to "application/json", "Accept" to "audio/mpeg")
    }
}
