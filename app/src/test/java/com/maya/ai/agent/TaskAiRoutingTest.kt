package com.maya.ai.agent

import android.os.Looper
import android.webkit.WebView
import android.webkit.ValueCallback
import com.maya.ai.MainActivity
import com.maya.ai.chat.*
import okhttp3.*
import okhttp3.ResponseBody.Companion.toResponseBody
import okio.Buffer
import okio.Timeout
import org.json.JSONObject
import org.junit.*
import org.junit.Assert.*
import org.junit.runner.RunWith
import org.robolectric.*
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.*

@RunWith(RobolectricTestRunner::class)
@Config(sdk=[28])
@LooperMode(LooperMode.Mode.PAUSED)
class TaskAiRoutingTest {
    private lateinit var controller: org.robolectric.android.controller.ActivityController<MainActivity>
    private val a get()=controller.get()
    private lateinit var original: WebView
    private lateinit var fakeView: WebView
    private var key="SYNTHETIC_KEY"
    private val scripts=mutableListOf<String>()
    private class Calls: Call.Factory {
        var count=0;var request: Request?=null;var body=""
        override fun newCall(request: Request): Call {
            count++;this.request=request;val buffer=Buffer();request.body!!.writeTo(buffer);body=buffer.readUtf8()
            return object: Call {
                override fun request()=request
                override fun execute()=Response.Builder().request(request).protocol(Protocol.HTTP_1_1).code(200).message("synthetic")
                    .header("Content-Type","application/json").body("""{"choices":[{"finish_reason":"stop","message":{"role":"assistant","content":"WIKI Dog"}}]}""".toResponseBody()).build()
                override fun enqueue(responseCallback: Callback) {error("No async fake")}
                override fun cancel() {}
                override fun isExecuted()=true
                override fun isCanceled()=false
                override fun timeout()=Timeout()
                override fun clone(): Call=error("No clone")
            }
        }
    }
    @Before fun open() {
        val app=RuntimeEnvironment.getApplication();app.getSharedPreferences("maya",0).edit().clear().commit();app.getSharedPreferences("maya_connections",0).edit().clear().commit()
        controller=Robolectric.buildActivity(MainActivity::class.java).setup().visible()
        val field=MainActivity::class.java.getDeclaredField("webView").apply {isAccessible=true};original=field.get(a) as WebView
        fakeView=object: WebView(a) {
            override fun getUrl()="https://appassets.androidplatform.net/assets/web/index.html"
            override fun evaluateJavascript(script: String,callback: ValueCallback<String>?) {
                scripts.add(script)
                val packet=JSONObject().put("code","READY").put("provider","groq").put("model","saved-model").put("tokens",400).put("key",key)
                callback?.onReceiveValue(if(script.contains("FISH_TALK.chatConfig()")) JSONObject.quote(packet.toString()) else "\"READY\"")
            }
        }
        field.set(a,fakeView);MainActivity::class.java.getDeclaredField("voiceHostTrusted").apply {isAccessible=true}.set(a,true)
    }
    @After fun close() {
        MainActivity::class.java.getDeclaredField("webView").apply {isAccessible=true}.set(a,original);fakeView.destroy();controller.pause().stop().destroy()
    }
    private fun backend(calls: Calls)=ResearchBackend(a,{ConfiguredChatTransport(calls)},{error("Cloudflare must not be used for saved-account tasks")},{task->task()})
    private fun inspect(backend: ResearchBackend,prompt: String): AiTaskReview {
        var result: AiTaskReview?=null;backend.review(AiTaskReview.Kind.RESEARCH_PLAN,listOf(prompt)) {r,e->assertNull(e);result=r}
        shadowOf(Looper.getMainLooper()).idle();return result!!
    }
    @Test fun cloudflareOffDoesNotBlockReviewedSavedAccountTasksOrReceiveTheirPrompt() {
        val calls=Calls();val backend=backend(calls);val prompt="PRIVATE_TASK_GOAL"
        val review=inspect(backend,prompt);assertEquals(0,calls.count);assertEquals(AiTaskReview.Route.SAVED_AI,review.route)
        assertTrue(scripts.none {it.contains(prompt)})
        assertTrue(review.approve(prompt,android.os.SystemClock.elapsedRealtime()))
        var reply: String?=null;backend.text(review,prompt) {text,error->assertNull(error);reply=text};shadowOf(Looper.getMainLooper()).idle()
        assertEquals("WIKI Dog",reply);assertEquals(1,calls.count);assertEquals("api.groq.com",calls.request!!.url.host)
        val body=JSONObject(calls.body);assertEquals(256,body.getInt("max_tokens"));assertFalse(body.has("tools"))
        assertTrue(body.getJSONArray("messages").getJSONObject(0).getString("content").contains("WIKI / REPO"))
        assertTrue(scripts.none {it.contains(prompt)});assertFalse(a.getSharedPreferences("maya_connections",0).getBoolean("cloudflare_reviewed",false))
    }
    @Test fun preparedButUnapprovedTicketCannotDispatch() {
        val calls=Calls();val backend=backend(calls);val review=inspect(backend,"goal");var failure: ResearchBackend.TextFailure?=null
        backend.text(review,"goal") {_,e->failure=e};shadowOf(Looper.getMainLooper()).idle()
        assertEquals(ResearchBackend.TextFailure.REVIEW_REQUIRED,failure);assertEquals(0,calls.count)
    }
    @Test fun keyChangeAfterReviewStopsBeforeNetworkWithoutFallback() {
        val calls=Calls();val backend=backend(calls);val review=inspect(backend,"goal");review.approve("goal",android.os.SystemClock.elapsedRealtime());key="CHANGED_KEY"
        var failure: ResearchBackend.TextFailure?=null;backend.text(review,"goal") {_,e->failure=e};shadowOf(Looper.getMainLooper()).idle()
        assertEquals(ResearchBackend.TextFailure.CONNECTION_CHANGED,failure);assertEquals(0,calls.count)
    }
    @Test fun changingRouteOrCancellingBeforeDispatchNeverSends() {
        val calls=Calls();val backend=backend(calls);val review=inspect(backend,"goal");review.approve("goal",android.os.SystemClock.elapsedRealtime())
        a.getSharedPreferences("maya_connections",0).edit().putString("text_route","cloudflare").commit()
        var failure: ResearchBackend.TextFailure?=null;backend.text(review,"goal") {_,e->failure=e};shadowOf(Looper.getMainLooper()).idle()
        assertEquals(ResearchBackend.TextFailure.CONNECTION_CHANGED,failure);assertEquals(0,calls.count)
        a.getSharedPreferences("maya_connections",0).edit().clear().commit();val second=inspect(backend,"second");second.approve("second",android.os.SystemClock.elapsedRealtime())
        var callbacks=0;val cancel=backend.text(second,"second") {_,_->callbacks++};cancel();shadowOf(Looper.getMainLooper()).idle()
        assertEquals(0,callbacks);assertEquals(0,calls.count)
    }
    @Test fun cloudflareRouteWithoutOperatorReviewFailsLocally() {
        a.getSharedPreferences("maya_connections",0).edit().putString("text_route","cloudflare").commit()
        val calls=Calls();var failure: ResearchBackend.TextFailure?=null
        backend(calls).review(AiTaskReview.Kind.BUILDER_PROPOSAL,listOf("native code prompt")) {r,e->assertNull(r);failure=e}
        shadowOf(Looper.getMainLooper()).idle();assertEquals(ResearchBackend.TextFailure.CHAT_OFF,failure);assertEquals(0,calls.count)
    }
    @Test fun actualWorkspaceBackendUsesItsActivityHostForLocalReview() {
        val workspace=MainActivity::class.java.getDeclaredField("nativeChat").apply {isAccessible=true}.get(a) as NativeChatWorkspace
        val services=NativeChatWorkspace::class.java.getDeclaredField("researchServices\$delegate").apply {isAccessible=true}.get(workspace) as Lazy<*>
        val backend=services.value as ResearchBackend
        val review=inspect(backend,"native workspace goal")
        assertEquals(AiTaskReview.Route.SAVED_AI,review.route);assertEquals("groq",review.provider)
        assertTrue(scripts.none {it.contains("native workspace goal")})
    }

}
