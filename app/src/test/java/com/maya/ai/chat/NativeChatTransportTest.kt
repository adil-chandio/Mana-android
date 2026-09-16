package com.maya.ai.chat

import okhttp3.*
import okio.Timeout
import org.junit.Assert.*
import org.junit.Test
import java.io.IOException

class NativeChatTransportTest {
    private fun rejection(code: String, block: () -> Unit) {
        try { block(); fail("Expected $code") } catch (e: NativeChatProtocol.Rejected) { assertEquals(code, e.code) }
    }
    @Test fun operationEnforcesStopAndTotalDeadlineBeforeAnyWork() {
        val stopped = NativeChatTransport.Operation { 0L }; stopped.cancel()
        rejection("STOPPED_LOCALLY") { stopped.check() }
        rejection("STOPPED_LOCALLY") { stopped.markAttempt() }
        var now = 0L; val op = NativeChatTransport.Operation { now }; now = 20000
        rejection("DEADLINE_EXCEEDED") { op.check() }
        rejection("DEADLINE_EXCEEDED") { op.remainingMs() }
    }
    @Test fun operationTracksOneAttachedCallAndMarksASingleAttempt() {
        var now = 0L; val op = NativeChatTransport.Operation { now }; now = 5000
        assertFalse(op.attempted); assertEquals(15000L, op.remainingMs())
        val call = object : Call {
            var cancelled = false
            override fun request() = Request.Builder().url("https://example.invalid/").build()
            override fun execute(): Response = error("No execution")
            override fun enqueue(responseCallback: Callback) = error("No async")
            override fun cancel() { cancelled = true }
            override fun isExecuted() = false
            override fun isCanceled() = cancelled
            override fun timeout() = Timeout()
            override fun clone(): Call = error("No clone")
        }
        op.attach(call)
        rejection("BUSY") { op.attach(call) }
        op.markAttempt(); assertTrue(op.attempted)
        op.detach(call); op.detach(call)
        op.cancel(); rejection("STOPPED_LOCALLY") { op.attach(call) }
    }
    @Test fun cancellingDetachesAndCancelsTheAttachedCall() {
        val op = NativeChatTransport.Operation { 0L }
        var cancelled = false
        val call = object : Call {
            override fun request() = Request.Builder().url("https://example.invalid/").build()
            override fun execute(): Response = error("No execution")
            override fun enqueue(responseCallback: Callback) = error("No async")
            override fun cancel() { cancelled = true }
            override fun isExecuted() = false
            override fun isCanceled() = cancelled
            override fun timeout() = Timeout()
            override fun clone(): Call = error("No clone")
        }
        op.attach(call); op.cancel(); assertTrue(cancelled)
        rejection("STOPPED_LOCALLY") { op.check() }
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
