package com.maya.ai.chat

import org.junit.Assert.*
import org.junit.Test
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.nio.file.Files
import java.security.KeyPairGenerator
import java.security.Signature
import java.security.interfaces.ECPublicKey
import java.security.spec.ECGenParameterSpec
import java.util.concurrent.TimeUnit

class NativeChatProtocolTest {
    private fun key(curve: String = "secp256r1") = KeyPairGenerator.getInstance("EC").apply {
        initialize(ECGenParameterSpec(curve))
    }.generateKeyPair()
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
    @Test fun publicKeyFingerprintAndWrongCurve() {
        val public = key().public as ECPublicKey
        val text = NativeChatProtocol.publicJwk(public)
        assertTrue(text.startsWith("{\"crv\":\"P-256\",\"kty\":\"EC\",\"x\":"))
        val json = JSONObject(text)
        assertEquals(setOf("crv", "kty", "x", "y"), json.keySet())
        assertEquals(43, json.getString("x").length); assertEquals(43, json.getString("y").length)
        assertEquals(43, NativeChatProtocol.fingerprint(public).length)
        rejects("INVALID_LOCAL_KEY") { NativeChatProtocol.publicJwk(key("secp384r1").public as ECPublicKey) }
    }
    @Test fun malformedDerRejectedIncludingZeroNonMinimalNegativeAndOutOfRange() {
        val good = byteArrayOf(0x30, 6, 2, 1, 1, 2, 1, 1)
        assertEquals(64, NativeChatProtocol.derToP1363(good).size)
        val variants = listOf(byteArrayOf(), good.copyOf(7), good + 0, good.copyOf().apply { this[0] = 0x31 },
            good.copyOf().apply { this[1] = 5 }, good.copyOf().apply { this[2] = 3 },
            good.copyOf().apply { this[4] = 0 }, good.copyOf().apply { this[4] = 0x80.toByte() },
            byteArrayOf(0x30, 7, 2, 2, 0, 1, 2, 1, 1), byteArrayOf(0x30, 0x81.toByte(), 6, 2, 1, 1, 2, 1, 1))
        variants.forEach { rejects("INVALID_SIGNATURE_ENCODING") { NativeChatProtocol.derToP1363(it) } }
        val tooLarge = byteArrayOf(0x30, 38, 2, 33, 0) + ByteArray(32) { 0xff.toByte() } + byteArrayOf(2, 1, 1)
        rejects("INVALID_SIGNATURE_ENCODING") { NativeChatProtocol.derToP1363(tooLarge) }
    }
    @Test fun invalidInputsDoNotInvokeSignerAndErrorsDoNotLeak() {
        val public = key().public as ECPublicKey; var calls = 0
        val signer: (ByteArray) -> ByteArray = { calls++; throw IllegalStateException("PRIVATE_SENTINEL") }
        rejects("INVALID_SIGNING_INPUT") { NativeChatProtocol.sign(null, public, 0, ByteArray(24), signer) }
        rejects("INVALID_SIGNING_INPUT") { NativeChatProtocol.sign(null, public, 1, ByteArray(23), signer) }
        rejects("INVALID_MESSAGES") { NativeChatProtocol.sign(listOf(NativeChatProtocol.Message("user", "")), public, 1, ByteArray(24), signer) }
        assertEquals(0, calls)
        rejects("SIGNING_FAILED") { NativeChatProtocol.sign(null, public, 1, ByteArray(24), signer) }
        assertEquals(1, calls)
        assertFalse(NativeChatProtocol.Message("user", "PRIVATE_SENTINEL").toString().contains("PRIVATE_SENTINEL"))
    }
    @Test fun javaSignaturesVerifyInActualBundledWorkerWithReplayAndTamperDenial() {
        val pair = key(); val public = pair.public as ECPublicKey
        val sign: (ByteArray) -> ByteArray = { Signature.getInstance("SHA256withECDSA").run { initSign(pair.private); update(it); sign() } }
        val requests = JSONArray()
        // Exercise short/padded DER integers probabilistically with many real signatures.
        for (i in 0 until 64) {
            val messages = if (i == 0) null else listOf(NativeChatProtocol.Message("user", "Synthetic native wire $i اردو 🔥 \"quote\"\n"))
            val request = NativeChatProtocol.sign(messages, public, System.currentTimeMillis(), ByteArray(24).apply { this[23] = i.toByte() }, sign)
            assertFalse(request.toString().contains("Synthetic"))
            requests.put(JSONObject().put("path", request.path).put("body", request.body).put("headers", JSONObject(request.headers())))
        }
        var root = File(System.getProperty("user.dir")).canonicalFile
        repeat(4) { if (!File(root, "tools/test-native-chat-wire.cjs").isFile) root = root.parentFile ?: root }
        assertTrue("Run from repository/Gradle project", File(root, "tools/test-native-chat-wire.cjs").isFile)
        val fixture = Files.createTempFile("maya-public-native-vectors-", ".json").toFile()
        val output = Files.createTempFile("maya-native-wire-result-", ".txt").toFile()
        try {
            // Only public key/signatures and synthetic text. No private key exported.
            fixture.writeText(JSONObject().put("publicJwk", JSONObject(NativeChatProtocol.publicJwk(public))).put("requests", requests).toString())
            val process = ProcessBuilder("node", File(root, "tools/test-native-chat-wire.cjs").absolutePath, fixture.absolutePath)
                .directory(root).redirectErrorStream(true).redirectOutput(output).start()
            if (!process.waitFor(30, TimeUnit.SECONDS)) { process.destroyForcibly(); fail("Node wire fixture timed out") }
            assertEquals(output.readText().take(4000), 0, process.exitValue())
            assertTrue(output.readText().contains("NATIVE_WIRE_INTEROP_PASS"))
        } finally { fixture.delete(); output.delete() }
    }
}
