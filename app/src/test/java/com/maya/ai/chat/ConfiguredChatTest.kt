package com.maya.ai.chat

import okhttp3.*
import okhttp3.ResponseBody.Companion.toResponseBody
import okio.Buffer
import okio.Timeout
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk=[28])
class ConfiguredChatTest {
    private fun packet(provider: String="groq",model: String="saved-model",key: String="SYNTHETIC_KEY",tokens: Int=400)=JSONObject()
        .put("code","READY").put("provider",provider).put("model",model).put("key",key).put("tokens",tokens)
    private fun config()=ConfiguredChatPolicy.decode(JSONObject.quote(packet().toString()))!!
    private fun messages()=listOf(NativeChatProtocol.Message("user","Bhai"))
    private val good="""{"choices":[{"finish_reason":"stop","message":{"role":"assistant","content":"Ji bhai"}}]}"""
    @Test fun fixedConfigIsRedactedAndEveryAuthorityChangeChangesGrantFingerprint() {
        val c=config();assertFalse(c.toString().contains("SYNTHETIC"));assertFalse(c.fingerprint.contains("SYNTHETIC"))
        for(p in listOf(packet(key="NEW_KEY"),packet(model="other-model"),packet(tokens=1400),packet(provider="mistral")))
            assertNotEquals(c.fingerprint,ConfiguredChatPolicy.decode(p.toString())!!.fingerprint)
    }
    @Test fun malformedUnknownAndPaidConfigFailsClosed() {
        for(raw in listOf("null","{}",packet().put("extra","PRIVATE").toString(),packet().put("tokens","400").toString(),packet(provider="pollen").toString(),packet(provider="openrouter",model="paid").toString(),packet(key="bad\nkey").toString(),packet().toString()+" trailing"))
            assertNull(raw.take(30),ConfiguredChatPolicy.decode(raw))
    }
    @Test fun nativeBodyUsesOnlyReviewedMessagesAndExistingBudgetWithoutTools() {
        val body=JSONObject(ConfiguredChatPolicy.body(config(),messages()))
        assertEquals(400,body.getInt("max_tokens"));assertFalse(body.getBoolean("stream"));assertFalse(body.has("tools"))
        assertEquals("Bhai",body.getJSONArray("messages").getJSONObject(1).getString("content"))
        assertFalse(body.toString().contains("SYNTHETIC_KEY"))
    }
    @Test fun geminiShapeAndModelBudgetUseTheConfiguredContract() {
        val c=ConfiguredChatPolicy.decode(packet("gemini","gemini-2.5-flash",tokens=280).toString())!!
        val body=JSONObject(ConfiguredChatPolicy.body(c,messages()))
        assertEquals(280,body.getJSONObject("generationConfig").getInt("maxOutputTokens"))
        assertEquals("Bhai",body.getJSONArray("contents").getJSONObject(0).getJSONArray("parts").getJSONObject(0).getString("text"))
        assertFalse(body.has("tools"));assertTrue(c.url().startsWith("https://generativelanguage.googleapis.com/"))
    }
    @Test fun strictRepliesRejectToolsTruncationDuplicateKeysReasoningAndOversize() {
        for(raw in listOf(good.replace("\"stop\"","\"length\""),good.replace("\"content\":","\"tool_calls\":[{}],\"content\":"),good.replace("Ji bhai","<think>reason</think>"),good.replace("Ji bhai","x".repeat(2001)),good.replace("\"content\":\"Ji bhai\"","\"content\":\"first\",\"content\":\"second\""))) {
            try {ConfiguredChatPolicy.response(config(),200,raw.toByteArray());fail("Accepted malformed reply")}
            catch(e: NativeChatProtocol.Rejected) {assertEquals("CONFIGURED_INVALID_REPLY",e.code)}
        }
    }
    @Test fun accessQuotaAndModelFailuresExposeNoRawProviderBody() {
        for((status,code) in listOf(401 to "CONFIGURED_ACCESS_DENIED",429 to "CONFIGURED_RATE_LIMIT",404 to "CONFIGURED_MODEL_UNAVAILABLE")) {
            val result=ConfiguredChatPolicy.response(config(),status,"PRIVATE_PROVIDER_ERROR".toByteArray()) as NativeChatResponse.Result.Error
            assertEquals(code,result.code);assertTrue(result.remoteUncertain);assertNull(result.diagnostic)
        }
    }
    private class Fake(val body: String): Call.Factory {
        var request: Request?=null;var executions=0;var cancelled=false;var action: ()->Unit={}
        override fun newCall(request: Request): Call {
            this.request=request
            return object: Call {
                override fun request()=request
                override fun execute(): Response {executions++;action();return Response.Builder().request(request).protocol(Protocol.HTTP_1_1).code(200).message("synthetic").header("Content-Type","application/json").body(body.toResponseBody()).build()}
                override fun enqueue(responseCallback: Callback) {error("No async transport")}
                override fun cancel() {cancelled=true}
                override fun isExecuted()=executions>0
                override fun isCanceled()=cancelled
                override fun timeout()=Timeout()
                override fun clone(): Call=error("No clone")
            }
        }
    }
    @Test fun configuredTransportSendsOneNativeRequestNotAFishRequest() {
        val f=Fake(good);var dispatches=0
        val result=ConfiguredChatTransport(f).execute(config(),messages(),NativeChatTransport.Operation {0L}) {dispatches++} as NativeChatResponse.Result.Reply
        assertEquals("Ji bhai",result.text);assertEquals(1,dispatches);assertEquals(1,f.executions)
        assertEquals("api.groq.com",f.request!!.url.host);assertEquals("Bearer SYNTHETIC_KEY",f.request!!.header("Authorization"))
        assertEquals("no-store",f.request!!.header("Cache-Control"));assertNotNull(f.request!!.tag(NativeChatTransport.AttemptGuard::class.java))
        val buffer=Buffer();f.request!!.body!!.writeTo(buffer);assertTrue(buffer.readUtf8().contains("Bhai"))
    }
    @Test fun stoppedAndExpiredNativeJobsDoNotDispatchOrAcceptLateResponses() {
        val f=Fake(good);val stopped=NativeChatTransport.Operation {0L};stopped.cancel()
        try {ConfiguredChatTransport(f).execute(config(),messages(),stopped) {};fail()} catch(e: NativeChatProtocol.Rejected) {assertEquals("STOPPED_LOCALLY",e.code)}
        assertEquals(0,f.executions)
        var time=0L;val op=NativeChatTransport.Operation {time};f.action={time=20000}
        try {ConfiguredChatTransport(f).execute(config(),messages(),op) {};fail()} catch(e: NativeChatProtocol.Rejected) {assertEquals("DEADLINE_EXCEEDED",e.code)}
        assertEquals(1,f.executions);assertTrue(f.cancelled)
    }
    @Test fun cancellationInsideDispatchHookStopsBeforeHttpExecution() {
        val f=Fake(good);val op=NativeChatTransport.Operation {0L}
        try {ConfiguredChatTransport(f).execute(config(),messages(),op) {op.cancel()};fail()} catch(e: NativeChatProtocol.Rejected) {assertEquals("STOPPED_LOCALLY",e.code)}
        assertEquals(0,f.executions);assertTrue(f.cancelled)
    }
    @Test fun connectionFailureIsBoundedUncertainAndNeverRetried() {
        val f=Fake(good);f.action={throw java.io.IOException("PRIVATE_URL_KEY")}
        val op=NativeChatTransport.Operation {0L}
        try {ConfiguredChatTransport(f).execute(config(),messages(),op) {};fail()} catch(e: NativeChatProtocol.Rejected) {assertEquals("CONFIGURED_NETWORK_ERROR",e.code)}
        assertTrue(op.attempted);assertEquals(1,f.executions)
    }
    @Test fun taskPurposeUsesItsOwnFixedInstructionsAndCannotIncreaseAccountBudget() {
        val c=config()
        val plan=JSONObject(ConfiguredChatPolicy.body(c,messages(),256,ConfiguredChatPolicy.Purpose.RESEARCH_PLAN))
        assertEquals(256,plan.getInt("max_tokens"));assertFalse(plan.has("tools"))
        assertTrue(plan.getJSONArray("messages").getJSONObject(0).getString("content").contains("WIKI / REPO"))
        val code=JSONObject(ConfiguredChatPolicy.body(c,messages(),256,ConfiguredChatPolicy.Purpose.BUILDER_PROPOSAL))
        assertTrue(code.getJSONArray("messages").getJSONObject(0).getString("content").contains("HTML/CSS"))
        assertEquals(400,JSONObject(ConfiguredChatPolicy.body(c,messages())).getInt("max_tokens"))
        try {ConfiguredChatPolicy.body(c,messages(),401);fail()} catch(_: IllegalArgumentException) {}
    }

}
