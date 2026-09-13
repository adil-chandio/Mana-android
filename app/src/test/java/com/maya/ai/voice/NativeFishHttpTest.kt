package com.maya.ai.voice

import okhttp3.*
import okhttp3.ResponseBody.Companion.toResponseBody
import okio.Timeout
import org.junit.Assert.*
import org.junit.Test
import java.io.IOException

class NativeFishHttpTest {
    private class Fake(val status: Int=200,val type: String="audio/mpeg",val encoding: String?=null) : Call.Factory {
        var creations=0; var executions=0; var cancelled=false
        var request: Request?=null; var onExecute: () -> Unit = {}
        override fun newCall(request: Request): Call {
            creations++;this.request=request
            return object : Call {
                override fun request()=request
                override fun execute(): Response {
                    executions++; onExecute()
                    return Response.Builder().request(request).protocol(Protocol.HTTP_1_1).code(status).message("synthetic")
                        .header("Content-Type",type).apply { encoding?.let { header("Content-Encoding",it) } }
                        .body(byteArrayOf(1,2,3).toResponseBody()).build()
                }
                override fun enqueue(responseCallback: Callback) = error("No async/real request")
                override fun cancel() { cancelled=true }
                override fun isExecuted()=executions>0
                override fun isCanceled()=cancelled
                override fun timeout()=Timeout()
                override fun clone(): Call=error("No cloning")
            }
        }
    }
    private fun http(fake: Fake)=NativeFishHttp("SYNTHETIC_BODY",mapOf("Authorization" to "Bearer SYNTHETIC", "model" to "s2.1-pro-free", "Accept" to "audio/mpeg", "X-Extra" to "NOT_SENT"),fake)
    private fun fails(block: () -> Unit) { try { block();fail("Expected refusal") } catch (_: IOException) {} }
    @Test fun fixedPostOneOpenAndNoExtraHeaders() {
        val f=Fake();val h=http(f);assertEquals(1,h.open().read())
        assertEquals(FishRequestPolicy.URL,f.request!!.url.toString());assertEquals("POST",f.request!!.method)
        assertEquals("identity",f.request!!.header("Accept-Encoding"));assertNull(f.request!!.header("X-Extra"))
        fails { h.open() };assertEquals(1,f.executions);h.close();assertTrue(f.cancelled)
        assertFalse(h.toString().contains("SYNTHETIC"))
    }
    @Test fun stopBeforeOpenNeverCreatesACall() {
        val f=Fake();val h=http(f);h.close();fails { h.open() };assertEquals(0,f.creations)
    }
    @Test fun stopDuringExecutionCannotReturnAudio() {
        val f=Fake();val h=http(f);f.onExecute={h.close()};fails { h.open() };assertTrue(f.cancelled)
    }
    @Test fun redirectJsonCompressionAndHttpErrorsAreNotAudioOrRetries() {
        for (f in listOf(Fake(302),Fake(402),Fake(429),Fake(503),Fake(type="application/json"),Fake(encoding="gzip"))) {
            val h=http(f);fails { h.open() };assertEquals(1,f.executions);assertTrue(f.cancelled)
        }
    }
    @Test fun strictClientAndWireExchangeGuardCannotRetryRedirectOrUseAmbientAuth() {
        val guard=NativeFishHttp.Exchange();guard.claim();fails { guard.claim() }
        val client=NativeFishHttp.client
        assertFalse(client.retryOnConnectionFailure);assertFalse(client.followRedirects);assertFalse(client.followSslRedirects)
        assertNull(client.cache);assertSame(CookieJar.NO_COOKIES,client.cookieJar)
        assertSame(Authenticator.NONE,client.authenticator);assertSame(Authenticator.NONE,client.proxyAuthenticator)
        assertTrue(client.networkInterceptors.contains(NativeFishHttp.oneExchange));assertEquals(210000,client.callTimeoutMillis)
    }

}
