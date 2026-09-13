package com.maya.ai.chat

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class NativeChatResponseTest {
    private val request = NativeChatProtocol.SignedRequest(NativeChatProtocol.CHAT_PATH, "{}", "K".repeat(43), "N".repeat(32), 1, "S".repeat(86))
    private fun reply() = JSONObject().put("kind", "model-response").put("model", NativeChatProtocol.MODEL)
        .put("keyId", request.keyId).put("nonce", request.nonce).put("text", "Synthetic اردو 🔥 <b>literal</b>")
        .put("capabilities", JSONObject().put("text", true).put("tools", false).put("vision", false).put("voice", false))
    private fun reject(raw: String, status: Int = 200) {
        try { NativeChatResponse.parse(status, raw.replace("\uD800", "\\ud800").toByteArray(), request); fail("Expected rejection") }
        catch (e: NativeChatProtocol.Rejected) { assertEquals("INVALID_SERVER_RESPONSE", e.code) }
    }
    @Test fun validBoundTextAndNoDefaultContentLogging() {
        val result = NativeChatResponse.parse(200, reply().toString().toByteArray(), request) as NativeChatResponse.Result.Reply
        assertEquals("Synthetic اردو 🔥 <b>literal</b>", result.text); assertFalse(result.toString().contains("Synthetic"))
    }
    @Test fun refusesWrongIdentityModelCapabilitiesAndStatus() {
        for (field in listOf("kind", "model", "keyId", "nonce")) reject(reply().put(field, "wrong").toString())
        for (field in listOf("tools", "vision", "voice")) {
            val value = reply(); value.getJSONObject("capabilities").put(field, true); reject(value.toString())
        }
        val wrongType = reply(); wrongType.getJSONObject("capabilities").put("text", "true"); reject(wrongType.toString())
        reject(reply().put("tool_calls", "unexpected").toString())
        val extra = reply(); extra.getJSONObject("capabilities").put("automation", true); reject(extra.toString())
        reject(reply().toString(), 201); reject(reply().toString(), 302)
    }
    @Test fun rejectsBlankLargeReasoningAndInvalidSurrogateText() {
        for (text in listOf("", " \uFEFF", "x".repeat(8001), "<think>private</think>", "<|im_start|>", "\uD800"))
            reject(reply().put("text", text).toString())
    }
    @Test fun strictJsonRejectsPermissiveSyntaxTrailingTokensAndDuplicates() {
        for (raw in listOf("{'a':1}", "{a:1}", "{\"a\":1,}", "{\"a\":1,\"a\":2}", "[true,]", "{} {}", "{}x", "\uFEFF{}", "{\"a\":01}", "{\"a\":NaN}", "{\"a\":1e999}", "{\"a\":\"\\x20\"}")) reject(raw)
        reject(reply().toString().replaceFirst("{", "{\"keyId\":\"fake\","))
    }
    @Test fun byteDepthAndNodeBudgetsBoundParser() {
        reject(" ".repeat(65537)); reject("[".repeat(10) + "0" + "]".repeat(10))
        reject("[" + List(513) { "0" }.joinToString(",") + "]")
        try { NativeChatResponse.parse(200, byteArrayOf(0xc3.toByte(), 0x28), request); fail("Invalid UTF8") }
        catch (e: NativeChatProtocol.Rejected) { assertEquals("INVALID_SERVER_RESPONSE", e.code) }
    }
    @Test fun fixedServerDiagnosticsAndNoRawErrorProjection() {
        val json = JSONObject().put("error", JSONObject().put("code", "INVALID_MODEL_RESPONSE").put("automaticRetry", false)
            .put("providerOutcome", "unknown_or_completed").put("validationReason", "MESSAGE_TOOLS").put("message", "PRIVATE_RAW_BODY"))
        val result = NativeChatResponse.parse(502, json.toString().toByteArray(), request) as NativeChatResponse.Result.Error
        assertEquals("MESSAGE_TOOLS", result.diagnostic); assertTrue(result.remoteUncertain); assertEquals(502, result.status)
        assertFalse(result.toString().contains("PRIVATE"))
        for (reason in listOf("PRIVATE_FIELD", "constructor", "<script>")) reject(JSONObject(json.toString()).also { it.getJSONObject("error").put("validationReason", reason) }.toString(), 502)
        reject(json.toString(), 500)
        val fake = JSONObject(json.toString()); fake.getJSONObject("error").put("automaticRetry", "false"); reject(fake.toString(), 502)
    }
    @Test fun emptyCheckRequiresExactBindingAndExplicitNoAI() {
        val check = NativeChatProtocol.SignedRequest(NativeChatProtocol.CHECK_PATH, "{}", request.keyId, request.nonce, 1, request.signature)
        val data = JSONObject().put("kind", "chat-auth-verified").put("keyId", request.keyId).put("nonce", request.nonce).put("aiConnected", false)
        assertSame(NativeChatResponse.Result.Access, NativeChatResponse.parse(200, data.toString().toByteArray(), check))
        try { NativeChatResponse.parse(200, data.put("aiConnected", "false").toString().toByteArray(), check); fail("Type coercion") }
        catch (e: NativeChatProtocol.Rejected) { assertEquals("INVALID_SERVER_RESPONSE", e.code) }
    }
}
