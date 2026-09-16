package com.maya.ai.chat

import org.junit.Assert.*
import org.junit.Test

class NativeChatResponseTest {
    private fun reject(raw: String) {
        try { NativeChatResponse.Json(raw).read(); fail("Expected rejection") }
        catch (e: NativeChatProtocol.Rejected) { assertEquals("INVALID_SERVER_RESPONSE", e.code) }
    }
    @Test fun resultTypesNeverLogContentByDefault() {
        val reply = NativeChatResponse.Result.Reply("Synthetic اردو 🔥 <b>literal</b>")
        assertEquals("Synthetic اردو 🔥 <b>literal</b>", reply.text); assertFalse(reply.toString().contains("Synthetic"))
        val error = NativeChatResponse.Result.Error("CONFIGURED_RATE_LIMIT", true, null, 429)
        assertEquals("CONFIGURED_RATE_LIMIT", error.code); assertTrue(error.remoteUncertain); assertEquals(429, error.status)
    }
    @Test fun strictJsonReadsExactObjectsArraysAndNumbers() {
        val root = NativeChatResponse.Json("{\"a\":1,\"b\":[true,false,null],\"c\":\"x\"}").read() as Map<*, *>
        assertEquals(1.0, root["a"]); assertEquals(listOf(true, false, null), root["b"]); assertEquals("x", root["c"])
        assertEquals(1.5, NativeChatResponse.Json("[1.5]").read().let { (it as List<*>)[0] })
    }
    @Test fun strictJsonRejectsPermissiveSyntaxTrailingTokensAndDuplicates() {
        for (raw in listOf("{'a':1}", "{a:1}", "{\"a\":1,}", "{\"a\":1,\"a\":2}", "[true,]", "{} {}", "{}x", "\uFEFF{}", "{\"a\":01}", "{\"a\":NaN}", "{\"a\":1e999}", "{\"a\":\"\\x20\"}")) reject(raw)
    }
    @Test fun byteDepthAndNodeBudgetsBoundParser() {
        reject("[".repeat(10) + "0" + "]".repeat(10))
        reject("[" + List(513) { "0" }.joinToString(",") + "]")
    }
}
