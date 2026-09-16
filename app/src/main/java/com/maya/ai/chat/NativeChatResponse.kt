package com.maya.ai.chat

/** Strict bounded JSON and saved-AI result types; no Android/network. */
object NativeChatResponse {
    sealed class Result {
        class Reply(val text: String) : Result() { override fun toString() = "Reply(redacted)" }
        class Error(val code: String, val remoteUncertain: Boolean, val diagnostic: String? = null, val status: Int = 0) : Result()
    }
    private fun bad(): Nothing = throw NativeChatProtocol.Rejected("INVALID_SERVER_RESPONSE")

    internal class Json(private val input: String) {
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
