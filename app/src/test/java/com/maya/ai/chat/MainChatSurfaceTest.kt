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
        fun f(v: View): Button? {if(v is Button && (v.text.toString()==title || v.contentDescription?.toString()==title)) return v;if(v is ViewGroup) for(i in 0 until v.childCount) f(v.getChildAt(i))?.let {return it};return null}
        return f(a.findViewById(android.R.id.content))!!
    }
    @Before fun open() {
        RuntimeEnvironment.getApplication().getSharedPreferences("maya",Context.MODE_PRIVATE).edit().clear().commit()
        c=Robolectric.buildActivity(MainActivity::class.java).setup().visible()
        // Original Main requests its existing voice/contact/call permissions at startup.
        // Distinguish that unchanged OS request from any NEW navigation by the Chat entry.
        val startup=shadowOf(a).nextStartedActivity
        if(startup!=null) assertEquals("android.content.pm.action.REQUEST_PERMISSIONS",startup.action)
        assertNull(shadowOf(a).nextStartedActivity)
    }
    @After fun close() {c.pause().stop().destroy()}
    private val workspace get()=field<NativeChatWorkspace>("nativeChat")
    private inline fun <reified T> local(name: String): T=NativeChatWorkspace::class.java.getDeclaredField(name).apply {isAccessible=true}.get(workspace) as T
    @Test fun startupIsAlreadyThePermanentConversationWithOriginalWebComponent() {
        val initial=workspace;val surface=field<View>("nativeChatView");val parent=web.parent
        assertNotNull(initial);assertNotNull(parent);assertFalse(local<Lazy<*>>("transport\$delegate").isInitialized())
        assertNull(a.findViewById<ViewGroup>(android.R.id.content).findViewWithTag<View>("tab_chat"))
        assertEquals(1,field<ViewGroup>("mainSurface").childCount)
        for(agent in listOf(true,false,true,false)) {
            a.findViewById<ViewGroup>(android.R.id.content).findViewWithTag<android.widget.Spinner>("mode_picker").setSelection(if(agent) 1 else 0);shadowOf(Looper.getMainLooper()).idle()
            assertSame(initial,workspace);assertSame(surface,field<View>("nativeChatView"));assertSame(parent,web.parent)
            assertEquals(1,field<ViewGroup>("mainSurface").childCount)
        }
        assertNull(shadowOf(a).nextStartedActivity)
    }
    @Test fun compatibilityUriOnlyFocusesExistingComposerAndNeverReplacesRoot() {
        val initial=workspace;val surface=field<View>("nativeChatView");local<EditText>("draft").setText("KEEP_DRAFT")
        assertTrue(navigate());assertSame(initial,workspace);assertSame(surface,field<View>("nativeChatView"))
        assertEquals("KEEP_DRAFT",local<EditText>("draft").text.toString());assertNull(shadowOf(a).nextStartedActivity)
        assertFalse(local<Lazy<*>>("transport\$delegate").isInitialized())
    }
    @Test fun untrustedAndSyntheticNavigationCannotFocusOrReplaceWorkspace() {
        val initial=workspace;local<EditText>("draft").clearFocus()
        navigate(gesture=false);navigate(main=false)
        assertSame(initial,workspace);assertNull(shadowOf(a).nextStartedActivity)
        web.loadUrl("https://example.invalid/");navigate();assertSame(initial,workspace)
        assertFalse(local<Lazy<*>>("transport\$delegate").isInitialized())
    }
    @Test fun backConfirmsExitInsteadOfReturningToAnotherMayaScreen() {
        local<EditText>("draft").setText("PRIVATE_SYNTHETIC_DRAFT");val initial=workspace
        a.onBackPressed();assertSame(initial,workspace);assertFalse(a.isFinishing)
        ShadowAlertDialog.getLatestAlertDialog().getButton(DialogInterface.BUTTON_NEGATIVE).performClick();shadowOf(Looper.getMainLooper()).idle();assertFalse(a.isFinishing)
        a.onBackPressed();ShadowAlertDialog.getLatestAlertDialog().getButton(DialogInterface.BUTTON_POSITIVE).performClick();shadowOf(Looper.getMainLooper()).idle()
        assertTrue(a.isFinishing);assertEquals("",local<EditText>("draft").text.toString())
    }
    @Test fun backgroundClearsPrivateDataWithoutReplacingMainSurface() {
        val initial=workspace;val surface=field<View>("nativeChatView")
        local<EditText>("draft").setText("PRIVATE_RESEARCH")
        c.pause().stop().restart().start().resume()
        assertSame(initial,workspace);assertSame(surface,field<View>("nativeChatView"))
        assertEquals("",local<EditText>("draft").text.toString());assertNull(shadowOf(a).nextStartedActivity)
        assertEquals("https://appassets.androidplatform.net/assets/web/index.html",web.url)
    }
    @Test fun inlineUtilitiesAndOriginalSettingsDoNotNavigateOrLoseDraft() {
        val initial=workspace;val parent=web.parent;local<EditText>("draft").setText("KEEP_DRAFT")
        button("Checks ▾").performClick();button("Privacy ▾").performClick();button("Close details").performClick()
        button("Original settings · expand here").performClick();button("Original settings · expand here").performClick()
        assertSame(initial,workspace);assertSame(parent,web.parent);assertEquals("KEEP_DRAFT",local<EditText>("draft").text.toString())
        assertEquals(View.VISIBLE,a.findViewById<ViewGroup>(android.R.id.content).findViewWithTag<View>("chat_page").visibility)
        assertEquals(View.VISIBLE,a.findViewById<ViewGroup>(android.R.id.content).findViewWithTag<View>("shared_composer_area").visibility)
        assertNull(shadowOf(a).nextStartedActivity)
    }
    @Test fun expandedOriginalSettingsCanScrollWithoutParentStealingGesture() {
        button("Original settings · expand here").performClick()
        val originalParent=web.parent as ViewGroup;originalParent.removeView(web)
        val requests=mutableListOf<Boolean>()
        val spy=object : android.widget.FrameLayout(a) {
            override fun requestDisallowInterceptTouchEvent(disallow: Boolean) {requests.add(disallow);super.requestDisallowInterceptTouchEvent(disallow)}
        }
        spy.addView(web)
        val listener=shadowOf(web).onTouchListener!!
        val down=android.view.MotionEvent.obtain(0,0,android.view.MotionEvent.ACTION_DOWN,10f,10f,0)
        val up=android.view.MotionEvent.obtain(0,1,android.view.MotionEvent.ACTION_UP,10f,10f,0)
        try {assertFalse(listener.onTouch(web,down));assertFalse(listener.onTouch(web,up))} finally {down.recycle();up.recycle()}
        assertEquals(listOf(true,false),requests)
        spy.removeView(web);originalParent.addView(web,0)
    }

    @Test fun originalOrbCompactsInPlaceAndSettingsStayExpandable() {
        val web=field<android.webkit.WebView>("webView");val parent=web.parent
        val density=a.resources.displayMetrics.density
        assertEquals((128*density).toInt(),web.layoutParams.height)
        val session=local<NativeChatConversation>("session");val turn=session.begin("synthetic",true);session.complete(turn,"reply")
        NativeChatWorkspace::class.java.getDeclaredMethod("renderHistory").apply {isAccessible=true}.invoke(workspace)
        assertSame(parent,web.parent);assertEquals((72*density).toInt(),web.layoutParams.height)
        button("Original settings · expand here").performClick();assertEquals((460*density).toInt(),web.layoutParams.height)
        assertSame(parent,web.parent);assertNull(shadowOf(a).nextStartedActivity)
    }

}
