package com.maya.ai.chat

import org.junit.Assert.*
import org.junit.Test
import org.json.JSONObject

class NativeChatProtocolTest {
    private fun rejects(code: String, fn: () -> Unit) {
        try { fn(); fail("Expected $code") } catch (e: NativeChatProtocol.Rejected) { assertEquals(code, e.code) }
    }
    @Test fun exactBodyAndUnicode() {
        val text = "Synthetic اردو हिन्दी سنڌي 🔥 \"quote\" \\ newline\n"
        val encoded = NativeChatProtocol.body(listOf(NativeChatProtocol.Message("user", text)))
        assertEquals(text, JSONObject(encoded).getJSONArray("messages").getJSONObject(0).getString("content"))
        assertFalse(encoded.contains("\n"))
        assertEquals(setOf("messages"), JSONObject(encoded).keySet())
        for (bad in listOf("", " \n\t\uFEFF\u00A0", "x".repeat(2001), "\uD800", "\uDC00", "x\uD800y"))
            rejects("INVALID_MESSAGES") { NativeChatProtocol.validateDraft(bad) }
        NativeChatProtocol.validateDraft("\u001c") // Not ECMAScript trim whitespace.
        NativeChatProtocol.validateDraft("x".repeat(2000))
    }
    @Test fun limitsRolesAndEscapedBytes() {
        rejects("CONTEXT_LIMIT") { NativeChatProtocol.body(emptyList()) }
        rejects("INVALID_MESSAGES") { NativeChatProtocol.body(listOf(NativeChatProtocol.Message("system", "x"))) }
        rejects("CONTEXT_LIMIT") { NativeChatProtocol.body(List(13) { NativeChatProtocol.Message(if (it % 2 == 0) "user" else "assistant", "x") }) }
        rejects("CONTEXT_LIMIT") { NativeChatProtocol.body(List(5) { NativeChatProtocol.Message(if (it % 2 == 0) "user" else "assistant", "x".repeat(1500)) }) }
        rejects("BODY_TOO_LARGE") { NativeChatProtocol.body(List(3) { NativeChatProtocol.Message(if (it % 2 == 0) "user" else "assistant", "\u0001".repeat(1900)) }) }
        assertTrue(NativeChatProtocol.body(List(3) { NativeChatProtocol.Message(if (it % 2 == 0) "user" else "assistant", "x".repeat(2000)) }).isNotEmpty())
    }
    @Test fun repliesHashesAndMessagesStayBoundedAndRedacted() {
        assertTrue(NativeChatProtocol.validReply("Ji bhai"))
        assertFalse(NativeChatProtocol.validReply(""))
        assertFalse(NativeChatProtocol.validReply("x".repeat(8001)))
        assertEquals(43, NativeChatProtocol.hash("SYNTHETIC".toByteArray()).length)
        assertFalse(NativeChatProtocol.hash("SYNTHETIC".toByteArray()).contains("SYNTHETIC"))
        assertFalse(NativeChatProtocol.Message("user", "PRIVATE_SENTINEL").toString().contains("PRIVATE_SENTINEL"))
    }
}
