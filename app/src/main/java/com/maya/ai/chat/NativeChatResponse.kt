package com.maya.ai.chat

import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction
import java.nio.charset.StandardCharsets.UTF_8

/** Strict bounded JSON and request-bound server envelope validation; no Android/network. */
object NativeChatResponse {
    sealed class Result {
        class Reply(val text: String) : Result() { override fun toString() = "Reply(redacted)" }
        object Access : Result()
        class Error(val code: String, val remoteUncertain: Boolean, val diagnostic: String? = null, val status: Int = 0) : Result()
    }
    val diagnostics = setOf("OUTPUT_NOT_OBJECT", "RESPONSE_STYLE_ENVELOPE", "ENVELOPE_TYPE_MISSING", "ENVELOPE_TYPE_OTHER",
        "CHOICES_NOT_ARRAY", "CHOICE_COUNT", "ROOT_TOOLS", "CHOICE_NOT_OBJECT", "CHOICE_INDEX", "FINISH_MISSING",
        "FINISH_LENGTH", "FINISH_TOOLS", "FINISH_OTHER", "CHOICE_TOOLS", "MESSAGE_NOT_OBJECT", "MESSAGE_ROLE",
        "MESSAGE_TOOLS", "MESSAGE_REFUSAL", "REASONING_TYPE", "REASONING_SIZE", "CONTENT_MISSING", "CONTENT_TYPE",
        "CONTENT_REASONING_ONLY", "CONTENT_EMPTY", "CONTENT_SIZE", "CONTENT_MARKERS")
    private val errors = setOf("CHAT_NOT_ENABLED", "SETUP_REQUIRED", "INVALID_OWNER_CONFIGURATION", "INVALID_APK_CONFIGURATION",
        "SIGNATURE_REQUIRED", "BAD_SIGNATURE", "REQUEST_EXPIRED_OR_CLOCK_SKEW", "REPLAY_OR_WINDOW_FULL",
        "REPLAY_STORE_UNAVAILABLE", "ORIGIN_OR_TARGET_DENIED", "JSON_ONLY", "BODY_TOO_LARGE", "INVALID_JSON",
        "INVALID_REQUEST", "INVALID_MESSAGES", "EMPTY_CHECK_REQUIRED", "BUDGET_UNAVAILABLE", "REQUEST_LIMIT",
        "MODEL_UNAVAILABLE", "INVALID_MODEL_RESPONSE", "STOPPED_LOCALLY", "DEADLINE_EXCEEDED", "SERVICE_UNAVAILABLE")
    private fun bad(): Nothing = throw NativeChatProtocol.Rejected("INVALID_SERVER_RESPONSE")
    fun parse(status: Int, bytes: ByteArray, request: NativeChatProtocol.SignedRequest): Result {
        if (bytes.size > NativeChatProtocol.MAX_RESPONSE_BYTES || status !in 100..599) bad()
        val text = try { UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT)
            .decode(ByteBuffer.wrap(bytes)).toString() } catch (_: Exception) { bad() }
        val root = Json(text).read() as? Map<*, *> ?: bad()
        if (status !in 200..299) {
            val error = root["error"] as? Map<*, *> ?: bad()
            val code = error["code"] as? String ?: bad()
            val outcome = error["providerOutcome"]
            if (status !in 400..599 || code !in errors || error["automaticRetry"] != false ||
                outcome !in listOf("not_dispatched", "unknown_or_completed")) bad()
            val reason = error["validationReason"]
            if (error.containsKey("validationReason") && (code != "INVALID_MODEL_RESPONSE" || status != 502 ||
                    outcome != "unknown_or_completed" || reason !is String || reason !in diagnostics)) bad()
            return Result.Error(code, outcome == "unknown_or_completed", reason as? String, status)
        }
        if (status != 200 || root["keyId"] != request.keyId || root["nonce"] != request.nonce) bad()
        if (request.path == NativeChatProtocol.CHECK_PATH) {
            if (root["kind"] != "chat-auth-verified" || root["aiConnected"] != false) bad()
            return Result.Access
        }
        if (request.path != NativeChatProtocol.CHAT_PATH || root["kind"] != "model-response" || root["model"] != NativeChatProtocol.MODEL) bad()
        val content = root["text"] as? String ?: bad()
        val capabilities = root["capabilities"] as? Map<*, *> ?: bad()
        if (!NativeChatProtocol.validReply(content) || capabilities["text"] != true ||
            listOf("tools", "vision", "voice").any { capabilities[it] != false }) bad()
        // Defense in depth; server is already responsible for final-only validation.
        if (Regex("</?think\\b|<\\|(?:im_start|im_end|endoftext)\\|>", RegexOption.IGNORE_CASE).containsMatchIn(content)) bad()
        return Result.Reply(content)
    }

    private class Json(private val input: String) {
        private var i = 0; private var nodes = 0
        private fun ws() { while (i < input.length && input[i] in " \t\r\n") i++ }
        private fun take(): Char { if (i >= input.length) bad(); return input[i++] }
        private fun expect(c: Char) { if (take() != c) bad() }
        fun read(): Any? { val value = value(0); ws(); if (i != input.length) bad(); return value }
        private fun value(depth: Int): Any? {
            if (depth > 8 || ++nodes > 512) bad(); ws(); if (i >= input.length) bad()
            return when (input[i]) {
                '{' -> {
                    i++; ws(); val result = linkedMapOf<String, Any?>()
                    if (i < input.length && input[i] == '}') { i++; result } else {
                        while (true) {
                            ws(); if (i >= input.length || input[i] != '"') bad()
                            val key = string(); if (result.containsKey(key)) bad()
                            ws(); expect(':'); result[key] = value(depth + 1); ws()
                            val end = take(); if (end == '}') break; if (end != ',') bad()
                        }; result
                    }
                }
                '[' -> {
                    i++; ws(); val result = arrayListOf<Any?>()
                    if (i < input.length && input[i] == ']') { i++; result } else {
                        while (true) { result.add(value(depth + 1)); ws(); val end = take(); if (end == ']') break; if (end != ',') bad() }; result
                    }
                }
                '"' -> string()
                't' -> literal("true", true)
                'f' -> literal("false", false)
                'n' -> literal("null", null)
                else -> {
                    val start = i
                    while (i < input.length && input[i] in "0123456789eE+.-") i++
                    val number = input.substring(start, i)
                    if (!Regex("-?(0|[1-9][0-9]*)(\\.[0-9]+)?([eE][+-]?[0-9]+)?").matches(number)) bad()
                    number.toDoubleOrNull()?.takeIf { it.isFinite() } ?: bad()
                }
            }
        }
        private fun literal(word: String, result: Any?): Any? {
            if (!input.startsWith(word, i)) bad(); i += word.length; return result
        }
        private fun string(): String {
            expect('"'); return buildString {
                while (true) {
                    val c = take(); if (c == '"') break
                    if (c.code < 32) bad()
                    if (c != '\\') append(c) else when (val escaped = take()) {
                        '"', '\\', '/' -> append(escaped)
                        'b' -> append('\b'); 'f' -> append('\u000C'); 'n' -> append('\n'); 'r' -> append('\r'); 't' -> append('\t')
                        'u' -> { if (i + 4 > input.length) bad(); val hex = input.substring(i, i + 4)
                            if (hex.any { it !in "0123456789abcdefABCDEF" }) bad(); append(hex.toInt(16).toChar()); i += 4 }
                        else -> bad()
                    }
                }
            }
        }
    }
}
