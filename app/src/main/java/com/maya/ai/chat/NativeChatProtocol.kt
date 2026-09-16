package com.maya.ai.chat

import java.math.BigInteger
import java.nio.charset.StandardCharsets.UTF_8
import java.security.AlgorithmParameters
import java.security.MessageDigest
import java.security.interfaces.ECPublicKey
import java.security.spec.ECGenParameterSpec
import java.security.spec.ECParameterSpec
import java.security.spec.ECFieldFp
import java.util.Base64

/** Native text-only wire policy. No network, Android, key generation or storage. */
object NativeChatProtocol {
    const val ORIGIN = "https://maya-chat.aadialii424.workers.dev"
    const val CHAT_PATH = "/v1/chat"
    const val CHECK_PATH = "/v1/chat/check"
    const val MODEL = "@cf/qwen/qwen3-30b-a3b-fp8"
    const val DEADLINE_MS = 20_000L
    const val MAX_BODY_BYTES = 16_384
    const val MAX_RESPONSE_BYTES = 65_536
    const val MAX_REPLY_CHARS = 8_000
    private val order = BigInteger("ffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551", 16)
    private val expectedCurve: ECParameterSpec by lazy {
        AlgorithmParameters.getInstance("EC").apply { init(ECGenParameterSpec("secp256r1")) }
            .getParameterSpec(ECParameterSpec::class.java)
    }

    class Rejected(val code: String) : IllegalArgumentException(code)
    data class Message(val role: String, val content: String) {
        override fun toString() = "NativeChatMessage(redacted)"
    }
    class SignedRequest internal constructor(val path: String, val body: String, val keyId: String,
        val nonce: String, val timestamp: Long, val signature: String) {
        override fun toString() = "NativeChatRequest(redacted)"
        // Only this fixed origin may be used by the future native transport.
        val url: String get() = ORIGIN + path
        fun headers(): Map<String, String> = mapOf(
            "Content-Type" to "application/json", "Origin" to ORIGIN,
            "X-Maya-Key-Id" to keyId, "X-Maya-Sent-At" to timestamp.toString(),
            "X-Maya-Nonce" to nonce, "X-Maya-Signature" to signature)
    }

    private fun ensure(ok: Boolean, code: String) { if (!ok) throw Rejected(code) }
    fun base64(bytes: ByteArray): String = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
    fun hash(bytes: ByteArray): String = base64(MessageDigest.getInstance("SHA-256").digest(bytes))
    private fun coordinate(value: BigInteger): String {
        ensure(value.signum() >= 0 && value.bitLength() <= 256, "INVALID_LOCAL_KEY")
        val bytes = value.toByteArray().let { if (it.size == 33 && it[0] == 0.toByte()) it.copyOfRange(1, 33) else it }
        ensure(bytes.size <= 32, "INVALID_LOCAL_KEY")
        return base64(ByteArray(32 - bytes.size) + bytes)
    }
    fun publicJwk(key: ECPublicKey): String {
        val p = key.params; val e = expectedCurve
        ensure(p.curve == e.curve && p.generator == e.generator && p.order == e.order && p.cofactor == e.cofactor,
            "INVALID_LOCAL_KEY")
        val prime = (p.curve.field as? ECFieldFp)?.p ?: throw Rejected("INVALID_LOCAL_KEY")
        val x = key.w.affineX; val y = key.w.affineY
        ensure(x.signum() >= 0 && x < prime && y.signum() >= 0 && y < prime, "INVALID_LOCAL_KEY")
        ensure(y.modPow(BigInteger.valueOf(2), prime) ==
            (x.modPow(BigInteger.valueOf(3), prime) + p.curve.a * x + p.curve.b).mod(prime), "INVALID_LOCAL_KEY")
        // RFC 7638 member order; base64url coordinates need no JSON escaping.
        return "{\"crv\":\"P-256\",\"kty\":\"EC\",\"x\":\"${coordinate(key.w.affineX)}\",\"y\":\"${coordinate(key.w.affineY)}\"}"
    }
    fun fingerprint(key: ECPublicKey): String = hash(publicJwk(key).toByteArray(UTF_8))

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
    // ECMAScript trim whitespace, matching the server instead of Java's broader set.
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

    /** JCA/AndroidKeyStore ECDSA is DER; Workers WebCrypto expects P1363 r||s. */
    fun derToP1363(der: ByteArray): ByteArray {
        var i = 0
        fun next(): Int { ensure(i < der.size, "INVALID_SIGNATURE_ENCODING"); return der[i++].toInt() and 255 }
        ensure(der.size in 8..72 && next() == 0x30 && next() == der.size - 2, "INVALID_SIGNATURE_ENCODING")
        fun scalar(): ByteArray {
            ensure(next() == 2, "INVALID_SIGNATURE_ENCODING")
            val size = next(); ensure(size in 1..33 && i + size <= der.size, "INVALID_SIGNATURE_ENCODING")
            val raw = der.copyOfRange(i, i + size); i += size
            ensure(raw[0].toInt() and 128 == 0, "INVALID_SIGNATURE_ENCODING")
            ensure(size == 1 || raw[0] != 0.toByte() || raw[1].toInt() and 128 != 0, "INVALID_SIGNATURE_ENCODING")
            val value = BigInteger(1, raw)
            ensure(value.signum() > 0 && value < order && value.bitLength() <= 256, "INVALID_SIGNATURE_ENCODING")
            val compact = if (raw.size == 33) raw.copyOfRange(1, 33) else raw
            return ByteArray(32 - compact.size) + compact
        }
        val result = scalar() + scalar()
        ensure(i == der.size, "INVALID_SIGNATURE_ENCODING")
        return result
    }

    fun sign(messages: List<Message>?, key: ECPublicKey, timestamp: Long, nonce: ByteArray,
        signDer: (ByteArray) -> ByteArray): SignedRequest {
        ensure(timestamp in 1..9_007_199_254_740_991L && nonce.size == 24, "INVALID_SIGNING_INPUT")
        val path = if (messages == null) CHECK_PATH else CHAT_PATH
        val body = if (messages == null) "{}" else body(messages)
        val keyId = fingerprint(key); val encodedNonce = base64(nonce)
        val canonical = listOf("maya-text-chat-v1", "POST", ORIGIN, path, timestamp.toString(),
            encodedNonce, hash(body.toByteArray(UTF_8)), keyId).joinToString("\n").toByteArray(UTF_8)
        val signature = try { derToP1363(signDer(canonical)) }
            catch (e: Rejected) { throw e }
            catch (_: Exception) { throw Rejected("SIGNING_FAILED") }
        return SignedRequest(path, body, keyId, encodedNonce, timestamp, base64(signature))
    }
}
