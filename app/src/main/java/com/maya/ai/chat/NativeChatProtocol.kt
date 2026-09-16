package com.maya.ai.chat

import java.nio.charset.StandardCharsets.UTF_8
import java.security.MessageDigest
import java.util.Base64

/** Native text-only message policy. No network, Android, key generation or storage. */
object NativeChatProtocol {
    const val DEADLINE_MS = 20_000L
    const val MAX_BODY_BYTES = 16_384
    const val MAX_RESPONSE_BYTES = 65_536
    const val MAX_REPLY_CHARS = 8_000

    class Rejected(val code: String) : IllegalArgumentException(code)
    data class Message(val role: String, val content: String) {
        override fun toString() = "NativeChatMessage(redacted)"
    }

    private fun ensure(ok: Boolean, code: String) { if (!ok) throw Rejected(code) }
    fun base64(bytes: ByteArray): String = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
    fun hash(bytes: ByteArray): String = base64(MessageDigest.getInstance("SHA-256").digest(bytes))

    private fun validUnicode(text: String): Boolean {
        var i = 0
        while (i < text.length) {
            val c = text[i++]
            if (c.isHighSurrogate()) {
                if (i == text.length || !text[i++].isLowSurrogate()) return false
            } else if (c.isLowSurrogate()) return false
        }
        return true
    }
    // ECMAScript trim whitespace, matching the provider contract instead of Java's broader set.
    private fun hasText(text: String): Boolean = text.any {
        it !in '\u2000'..'\u200A' && it !in "\t\n\u000B\u000C\r \u00A0\u1680\u2028\u2029\u202F\u205F\u3000\uFEFF"
    }
    fun validReply(text: String): Boolean = text.length <= MAX_REPLY_CHARS && hasText(text) && validUnicode(text)
    fun validateDraft(text: String) {
        ensure(text.length <= 2_000 && hasText(text) && validUnicode(text), "INVALID_MESSAGES")
    }
    private fun quoted(text: String): String = buildString {
        append('"')
        for (c in text) when (c) {
            '"' -> append("\\\"")
            '\\' -> append("\\\\")
            else -> if (c.code < 32) append("\\u" + c.code.toString(16).padStart(4, '0')) else append(c)
        }
        append('"')
    }
    fun body(messages: List<Message>): String {
        ensure(messages.size in 1..12 && messages.size % 2 == 1, "CONTEXT_LIMIT")
        var total = 0
        messages.forEachIndexed { i, m ->
            ensure(m.role == if (i % 2 == 0) "user" else "assistant", "INVALID_MESSAGES")
            validateDraft(m.content); total += m.content.length
        }
        ensure(total <= 6_000, "CONTEXT_LIMIT")
        val result = messages.joinToString(",", "{\"messages\":[", "]}") {
            "{\"role\":${quoted(it.role)},\"content\":${quoted(it.content)}}"
        }
        ensure(result.toByteArray(UTF_8).size <= MAX_BODY_BYTES, "BODY_TOO_LARGE")
        return result
    }
}
