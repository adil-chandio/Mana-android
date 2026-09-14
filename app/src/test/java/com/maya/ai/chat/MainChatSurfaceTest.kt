package com.maya.ai.chat

import android.content.Context
import android.content.DialogInterface
import android.net.Uri
import android.os.Looper
import android.view.View
import android.view.ViewGroup
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.widget.Button
import android.widget.EditText
import com.maya.ai.MainActivity
import org.junit.*
import org.junit.Assert.*
import org.junit.runner.RunWith
import org.robolectric.*
import org.robolectric.Shadows.shadowOf
import org.robolectric.android.controller.ActivityController
import org.robolectric.annotation.*
import org.robolectric.shadows.ShadowAlertDialog

/** Real MainActivity/native view hierarchy; shadow WebView does not execute JS or make live requests. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk=[28])
@LooperMode(LooperMode.Mode.PAUSED)
class MainChatSurfaceTest {
    private lateinit var c: ActivityController<MainActivity>
    private val a get()=c.get()
    private inline fun <reified T> field(name: String): T=MainActivity::class.java.getDeclaredField(name).apply {isAccessible=true}.get(a) as T
    private val web get()=field<WebView>("webView")
    private fun navigate(gesture: Boolean=true, main: Boolean=true, url: String=NativeChatActivity.OPEN_LINK): Boolean {
        val clientType=Class.forName("com.maya.ai.MainActivity\$MayaWebViewClient")
        val client=clientType.declaredConstructors.single().apply {isAccessible=true}.newInstance(a)
        val request=object : WebResourceRequest {
            override fun getUrl()=Uri.parse(url)
            override fun isForMainFrame()=main
            override fun isRedirect()=false
            override fun hasGesture()=gesture
            override fun getMethod()="GET"
            override fun getRequestHeaders()=emptyMap<String,String>()
        }
        return clientType.getDeclaredMethod("shouldOverrideUrlLoading",WebView::class.java,WebResourceRequest::class.java)
            .apply {isAccessible=true}.invoke(client,web,request) as Boolean
    }
    private fun button(title: String): Button {
        fun f(v: View): Button? {if(v is Button && v.text.toString()==title) return v;if(v is ViewGroup) for(i in 0 until v.childCount) f(v.getChildAt(i))?.let {return it};return null}
        return f(a.findViewById(android.R.id.content))!!
    }
    @Before fun open() {
        RuntimeEnvironment.getApplication().getSharedPreferences("maya",Context.MODE_PRIVATE).edit().clear().commit()
        c=Robolectric.buildActivity(MainActivity::class.java).setup().visible()
    }
    @After fun close() {c.pause().stop().destroy()}
    @Test fun mainChatIsInPlaceAndOpeningSendsNoContentOrActivityIntent() {
        assertNull(field<NativeChatWorkspace?>("nativeChat"));assertTrue(navigate())
        assertNotNull(field<NativeChatWorkspace?>("nativeChat"));assertEquals(View.GONE,web.visibility)
        assertNull(shadowOf(a).nextStartedActivity)
        val w=field<NativeChatWorkspace>("nativeChat")
        val transport=NativeChatWorkspace::class.java.getDeclaredField("transport\$delegate").apply {isAccessible=true}.get(w) as Lazy<*>
        assertFalse(transport.isInitialized())
        assertNotNull(a.findViewById<ViewGroup>(android.R.id.content).findViewWithTag<View>("tab_agent"))
        assertSame(w,field<NativeChatWorkspace>("nativeChat"));navigate();assertSame(w,field<NativeChatWorkspace>("nativeChat"))
    }
    @Test fun noGestureSubframeAndUntrustedPageCannotOpenMainChat() {
        navigate(gesture=false);assertNull(field<NativeChatWorkspace?>("nativeChat"))
        navigate(main=false);assertNull(field<NativeChatWorkspace?>("nativeChat"))
        web.loadUrl("https://example.invalid/");navigate();assertNull(field<NativeChatWorkspace?>("nativeChat"))
        assertNull(shadowOf(a).nextStartedActivity)
    }
    @Test fun returningHomeConfirmsAndClearsPrivatePaneThenReopensBlank() {
        navigate();val w=field<NativeChatWorkspace>("nativeChat")
        val draft=NativeChatWorkspace::class.java.getDeclaredField("draft").apply {isAccessible=true}.get(w) as EditText
        draft.setText("PRIVATE_SYNTHETIC_DRAFT")
        button("← MAYA HOME").performClick();assertSame(w,field<NativeChatWorkspace>("nativeChat"))
        ShadowAlertDialog.getLatestAlertDialog().getButton(DialogInterface.BUTTON_POSITIVE).performClick();shadowOf(Looper.getMainLooper()).idle()
        assertNull(field<NativeChatWorkspace?>("nativeChat"));assertEquals("",draft.text.toString());assertEquals(View.VISIBLE,web.visibility)
        navigate();val fresh=field<NativeChatWorkspace>("nativeChat")
        assertNotSame(w,fresh)
        assertEquals("",(NativeChatWorkspace::class.java.getDeclaredField("draft").apply {isAccessible=true}.get(fresh) as EditText).text.toString())
    }
    @Test fun backgroundClearsBothNativeWorkspacesWithoutWritingThemIntoWebView() {
        navigate();button("Agent").performClick()
        a.findViewById<ViewGroup>(android.R.id.content).findViewWithTag<EditText>("research_goal").setText("PRIVATE_RESEARCH")
        c.pause().stop().restart().start().resume()
        assertEquals("",a.findViewById<ViewGroup>(android.R.id.content).findViewWithTag<EditText>("research_goal").text.toString())
        assertNull(shadowOf(a).nextStartedActivity)
        assertEquals("https://appassets.androidplatform.net/assets/web/index.html",web.url)
    }
}
