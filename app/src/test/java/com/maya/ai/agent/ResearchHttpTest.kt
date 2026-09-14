package com.maya.ai.agent

import okhttp3.*
import okhttp3.ResponseBody.Companion.toResponseBody
import okio.Timeout
import org.junit.Assert.*
import org.junit.Test

class ResearchHttpTest {
    private val item get()=ResearchPlan.parse("WIKI Dog").item(0)
    private val wiki="""{"type":"standard","lang":"en","namespace":{"id":0},"title":"Dog","extract":"SYNTHETIC public excerpt","content_urls":{"desktop":{"page":"https://evil.example"}}}"""
    private class Fake(val body: ByteArray,val status: Int=200,val type: String="application/json",val encoding: String?=null): Call.Factory {
        var executions=0;var creations=0;var cancelled=false;var req: Request?=null;var onExecute: () -> Unit={}
        override fun newCall(request: Request): Call {
            creations++;req=request
            return object : Call {
                override fun request()=request
                override fun execute(): Response {executions++;onExecute();return Response.Builder().request(request).protocol(Protocol.HTTP_1_1).code(status).message("synthetic")
                    .header("Content-Type",type).apply {encoding?.let {header("Content-Encoding",it)}}.body(body.toResponseBody()).build()}
                override fun enqueue(responseCallback: Callback)=error("No live/async test request")
                override fun cancel() {cancelled=true}
                override fun isCanceled()=cancelled
                override fun isExecuted()=executions>0
                override fun timeout()=Timeout()
                override fun clone(): Call=error("No clone")
            }
        }
    }
    private fun rejects(block: () -> Unit) {try {block();fail("Expected rejection")} catch (_: Exception) {}}
    @Test fun fixedGetNoCredentialAndDerivedCitationOnly() {
        val f=Fake(wiki.toByteArray());val result=ResearchHttp(f).fetch(item,ResearchHttp.Operation())
        assertEquals(item.pageUrl,result.url);assertEquals(item.requestUrl,f.req!!.url.toString());assertEquals("GET",f.req!!.method)
        assertNull(f.req!!.header("Authorization"));assertNull(f.req!!.header("Cookie"));assertNull(f.req!!.body)
        assertTrue(f.cancelled);assertEquals(1,f.executions)
    }
    @Test fun privateWrongRepositoryAndUncertainWikiAreRejected() {
        val repo=ResearchPlan.parse("REPO a/b").item(0)
        for(raw in listOf("""{"private":true,"full_name":"a/b","description":null,"language":null}""", """{"private":false,"full_name":"c/d","description":null,"language":null}""")) rejects {ResearchHttp.parse(repo,raw)}
        rejects {ResearchHttp.parse(item,wiki.replace("standard","disambiguation"))}
        rejects {ResearchHttp.parse(item,wiki.replace("\"id\":0","\"id\":1"))}
        val good=ResearchHttp.parse(repo,"""{"private":false,"full_name":"a/b","description":"SEND secret text","language":null}""")
        assertTrue(good.text.contains("SEND secret text"));assertEquals(repo.pageUrl,good.url)
    }
    @Test fun redirectsErrorsHtmlCompressionAndOversizedBodiesFailWithoutRetry() {
        for(f in listOf(Fake(wiki.toByteArray(),302),Fake(wiki.toByteArray(),429),Fake(wiki.toByteArray(),503),Fake(wiki.toByteArray(),type="text/html"),Fake(wiki.toByteArray(),encoding="gzip"),Fake(ByteArray(65537)))) {
            rejects {ResearchHttp(f).fetch(item,ResearchHttp.Operation())};assertEquals(1,f.executions);assertTrue(f.cancelled)
        }
    }
    @Test fun stoppedBeforeAndDuringFetchCannotYieldSource() {
        val f=Fake(wiki.toByteArray());val op=ResearchHttp.Operation();op.cancel();rejects {ResearchHttp(f).fetch(item,op)};assertEquals(0,f.creations)
        val g=Fake(wiki.toByteArray());val other=ResearchHttp.Operation();g.onExecute={other.cancel()};rejects {ResearchHttp(g).fetch(item,other)};assertTrue(g.cancelled)
    }
    @Test fun oneOperationCannotDispatchTwiceAndClientHasNoAmbientAuthOrRedirects() {
        val f=Fake(wiki.toByteArray());val op=ResearchHttp.Operation();val h=ResearchHttp(f);h.fetch(item,op);rejects {h.fetch(item,op)};assertEquals(1,f.executions)
        val c=ResearchHttp.client;assertFalse(c.retryOnConnectionFailure);assertFalse(c.followRedirects);assertFalse(c.followSslRedirects)
        assertSame(CookieJar.NO_COOKIES,c.cookieJar);assertSame(Authenticator.NONE,c.authenticator);assertSame(Authenticator.NONE,c.proxyAuthenticator);assertNull(c.cache)
        assertEquals(10000,c.callTimeoutMillis);assertEquals(1,c.networkInterceptors.size)
    }
    @Test fun malformedUtf8CannotBecomeSourceText() {
        val f=Fake(byteArrayOf(0xc3.toByte(),0x28));rejects {ResearchHttp(f).fetch(item,ResearchHttp.Operation())}
    }
}
