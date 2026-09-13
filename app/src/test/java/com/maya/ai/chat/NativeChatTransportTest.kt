package com.maya.ai.chat

import okhttp3.*
import okhttp3.ResponseBody.Companion.toResponseBody
import okio.Timeout
import org.junit.Assert.*
import org.junit.Test
import java.io.IOException

class NativeChatTransportTest {
    private fun signed(path: String = NativeChatProtocol.CHAT_PATH) = NativeChatProtocol.SignedRequest(path, "{}", "K".repeat(43), "N".repeat(32), 1, "S".repeat(86))
    private val good = """{"kind":"model-response","model":"@cf/qwen/qwen3-30b-a3b-fp8","keyId":"${"K".repeat(43)}","nonce":"${"N".repeat(32)}","text":"Synthetic","capabilities":{"text":true,"tools":false,"vision":false,"voice":false}}"""
    private class Fake(var status: Int = 200, var bytes: ByteArray, var type: String = "application/json") : Call.Factory {
        var count = 0; var executions = 0; var cancelled = false
        var request: Request? = null; var action: () -> Unit = {}; var encoding: String? = null
        val timeout = Timeout()
        override fun newCall(request: Request): Call {
            count++; this.request = request
            return object : Call {
                override fun request() = request
                override fun execute(): Response {
                    executions++; action()
                    return Response.Builder().request(request).protocol(Protocol.HTTP_1_1).code(status).message("synthetic")
                        .header("Content-Type", type).apply { encoding?.let { header("Content-Encoding", it) } }
                        .body(bytes.toResponseBody()).build()
                }
                override fun enqueue(responseCallback: Callback) { error("Async execution forbidden") }
                override fun cancel() { cancelled = true }
                override fun isExecuted() = executions > 0
                override fun isCanceled() = cancelled
                override fun timeout() = timeout
                override fun clone(): Call = error("Cloning forbidden")
            }
        }
    }
    private fun rejection(code: String, block: () -> Unit) {
        try { block(); fail("Expected $code") } catch (e: NativeChatProtocol.Rejected) { assertEquals(code, e.code) }
    }
    @Test fun fixedUrlHeadersSinglePostAndRemainingTotalDeadline() {
        var now = 0L; val op = NativeChatTransport.Operation { now }; now = 5000
        val fake = Fake(bytes = good.toByteArray()); var dispatched = 0
        val result = NativeChatTransport(fake).execute(signed(), op) { dispatched++ }
        assertTrue(result is NativeChatResponse.Result.Reply); assertEquals(1, dispatched); assertEquals(1, fake.executions)
        assertEquals(NativeChatProtocol.ORIGIN + NativeChatProtocol.CHAT_PATH, fake.request!!.url.toString())
        assertEquals("POST", fake.request!!.method); assertEquals("identity", fake.request!!.header("Accept-Encoding"))
        assertEquals(NativeChatProtocol.ORIGIN, fake.request!!.header("Origin")); assertEquals(15000000000L, fake.timeout.timeoutNanos())
    }
    @Test fun stopsBeforeDispatchAndRejectsOtherTargets() {
        val fake = Fake(bytes = good.toByteArray()); val op = NativeChatTransport.Operation { 0L }; op.cancel()
        rejection("STOPPED_LOCALLY") { NativeChatTransport(fake).execute(signed(), op) }
        rejection("INVALID_TARGET") { NativeChatTransport(fake).execute(signed("/arbitrary"), NativeChatTransport.Operation { 0L }) }
        assertEquals(0, fake.count)
    }
    @Test fun stopInsideDispatchHookCannotExecute() {
        val fake = Fake(bytes = good.toByteArray()); val op = NativeChatTransport.Operation { 0L }
        rejection("STOPPED_LOCALLY") { NativeChatTransport(fake).execute(signed(), op) { op.cancel() } }
        assertEquals(0, fake.executions); assertTrue(fake.cancelled)
    }
    @Test fun stopOrExpiryBeforeResultExcludesLateResponse() {
        var now = 0L; val fake = Fake(bytes = good.toByteArray()); val op = NativeChatTransport.Operation { now }
        fake.action = { now = 20000 }
        rejection("DEADLINE_EXCEEDED") { NativeChatTransport(fake).execute(signed(), op) }; assertTrue(fake.cancelled)
        val second = Fake(bytes = good.toByteArray()); val stopped = NativeChatTransport.Operation { 0L }; second.action = { stopped.cancel() }
        rejection("STOPPED_LOCALLY") { NativeChatTransport(second).execute(signed(), stopped) }
    }
    @Test fun wrongContentTypeCompressionRedirectAndOversizeAreNotRendered() {
        for (fake in listOf(Fake(bytes = good.toByteArray(), type = "text/html"), Fake(302, good.toByteArray()),
            Fake(bytes = ByteArray(65537)), Fake(bytes = good.toByteArray()).also { it.encoding = "gzip" })) {
            rejection("INVALID_SERVER_RESPONSE") { NativeChatTransport(fake).execute(signed(), NativeChatTransport.Operation { 0L }) }
            assertEquals(1, fake.executions); assertTrue(fake.cancelled)
        }
    }
    @Test fun networkFailureIsUncertainAndNeverRetried() {
        val fake = Fake(bytes = good.toByteArray()); fake.action = { throw IOException("PRIVATE NETWORK DETAIL") }
        val op = NativeChatTransport.Operation { 0L }
        rejection("NETWORK_UNCERTAIN") { NativeChatTransport(fake).execute(signed(), op) }
        assertTrue(op.attempted); assertEquals(1, fake.executions); assertTrue(fake.cancelled)
    }
    @Test fun followupGuardAllowsOnlyOneWireExchange() {
        val guard = NativeChatTransport.AttemptGuard(); guard.claim()
        try { guard.claim(); fail("Second exchange allowed") } catch (e: IOException) { assertEquals("NETWORK_ATTEMPT_LIMIT", e.message) }
        assertTrue(NativeChatTransport.client.networkInterceptors.contains(NativeChatTransport.oneExchange))
    }
    @Test fun productionClientHasNoRetriesRedirectsCookiesCacheOrAuthenticationFallback() {
        val client = NativeChatTransport.client
        assertFalse(client.retryOnConnectionFailure); assertFalse(client.followRedirects); assertFalse(client.followSslRedirects)
        assertSame(CookieJar.NO_COOKIES, client.cookieJar); assertSame(Authenticator.NONE, client.authenticator)
        assertSame(Authenticator.NONE, client.proxyAuthenticator); assertNull(client.cache); assertEquals(20000, client.callTimeoutMillis)
    }
}
