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
        RuntimeEnvironment.getApplication().getSharedPreferences("maya_connections",Context.MODE_PRIVATE).edit().clear().commit()
        c=Robolectric.buildActivity(MainActivity::class.java).setup().visible()
        // Opening text Chat no longer requests microphone/contacts/call permissions.
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
    private fun openSettings() {
        button("Workspace menu").performClick();button("Settings").performClick()
        assertTrue(a.findViewById<ViewGroup>(android.R.id.content).findViewWithTag<View>("settings_screen").isShown)
    }
    @Test fun dedicatedSettingsDoNotLaunchActivityOrLoseDraftAndBackRestoresWorkspace() {
        val initial=workspace;val parent=web.parent;local<EditText>("draft").setText("KEEP_DRAFT")
        openSettings();assertFalse(local<EditText>("draft").isShown)
        button("Checks ▾").performClick();a.onBackPressed();button("Privacy ▾").performClick();a.onBackPressed()
        button("Original settings · expand here").performClick()
        assertNotSame(parent,web.parent);assertEquals("voice_settings_page",(web.parent as View).tag)
        assertEquals(-1,web.layoutParams.height);assertFalse(local<EditText>("draft").isShown)
        a.onBackPressed();a.onBackPressed()
        assertSame(initial,workspace);assertSame(parent,web.parent);assertEquals("KEEP_DRAFT",local<EditText>("draft").text.toString())
        assertTrue(local<EditText>("draft").isShown);assertFalse(a.isFinishing)
        assertNull(shadowOf(a).nextStartedActivity)
    }
    @Test fun expandedOriginalSettingsCanScrollWithoutParentStealingGesture() {
        openSettings();button("Original settings · expand here").performClick()
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
        openSettings();button("Original settings · expand here").performClick();assertEquals(-1,web.layoutParams.height)
        assertNotSame(parent,web.parent);a.onBackPressed();a.onBackPressed();assertSame(parent,web.parent);assertNull(shadowOf(a).nextStartedActivity)
    }

    @Test fun everyPageStartHidesLegacyContentAndRevokesMountReadiness() {
        val client=web.webViewClient!!
        for(url in listOf("https://appassets.androidplatform.net/assets/web/index.html","file:///android_asset/web/index.html")) {
            web.visibility=View.VISIBLE
            client.onPageStarted(web,url,null)
            assertEquals(View.INVISIBLE,web.visibility);assertFalse(field<Boolean>("workspaceHostReady"))
        }
        assertFalse(local<Lazy<*>>("transport\$delegate").isInitialized())
    }
    @Test fun settingsSurvivesTransientPauseButBackgroundClearsOwnedConversation() {
        local<EditText>("draft").setText("LOCAL_DRAFT");openSettings();button("Original settings · expand here").performClick()
        c.pause().resume();assertEquals(3,local<Int>("section"));assertEquals("voice_settings_page",(web.parent as View).tag)
        assertEquals("LOCAL_DRAFT",local<EditText>("draft").text.toString())
        c.pause().stop().restart().start().resume()
        assertEquals(0,local<Int>("section"));assertEquals("",local<EditText>("draft").text.toString())
        assertEquals("original_orb_slot",(web.parent as View).tag)
    }

    @Test fun stalePresentationCallbacksCannotRevealOldRouteAfterRapidToggleOrReload() {
        val original=web;val callbacks=mutableListOf<android.webkit.ValueCallback<String>>()
        val testWeb=object : WebView(a) {
            override fun getUrl()="https://appassets.androidplatform.net/assets/web/index.html"
            override fun evaluateJavascript(script: String,callback: android.webkit.ValueCallback<String>?) {callbacks.add(callback!!)}
        }
        fun set(name: String,value: Any)=MainActivity::class.java.getDeclaredField(name).apply {isAccessible=true}.set(a,value)
        val apply=MainActivity::class.java.getDeclaredMethod("applyWorkspacePresentation").apply {isAccessible=true}
        try {
            set("webView",testWeb);set("workspaceHostReady",true);set("mainResumed",true)
            for(expanded in listOf(true,false,true)) {set("workspaceSettingsOpen",expanded);apply.invoke(a)}
            assertEquals(3,callbacks.size)
            callbacks[0].onReceiveValue("true");assertEquals(View.INVISIBLE,testWeb.visibility)
            callbacks[1].onReceiveValue("true");assertEquals(View.INVISIBLE,testWeb.visibility)
            callbacks[2].onReceiveValue("true");assertEquals(View.VISIBLE,testWeb.visibility)
            original.webViewClient!!.onPageStarted(testWeb,testWeb.url,null)
            callbacks[2].onReceiveValue("true");assertEquals(View.INVISIBLE,testWeb.visibility)
        } finally {set("webView",original);testWeb.destroy()}
        assertFalse(local<Lazy<*>>("transport\$delegate").isInitialized())
    }

    private class DictationPort: NativeDictation.Port {
        var ready: ((NativeDictation.State?)->Unit)?=null
        var events: NativeDictation.Events?=null
        var starts=0;var requests=0;var stops=0;var offline=false
        override fun check(language: String,onDeviceOnly: Boolean,done: (NativeDictation.State?)->Unit) {ready=done}
        override fun start(language: String,onDeviceOnly: Boolean,events: NativeDictation.Events) {starts++;offline=onDeviceOnly;this.events=events}
        override fun stop() {stops++}
        override fun requestPermission() {requests++}
    }
    private fun fakeDictation(): Pair<NativeDictation,DictationPort> {
        val port=DictationPort();val handler=android.os.Handler(Looper.getMainLooper())
        val paint=NativeChatWorkspace::class.java.getDeclaredMethod("inputChanged").apply {isAccessible=true}
        val owner=NativeDictation(port,{android.os.SystemClock.elapsedRealtime()},{delay,action->
            val r=Runnable {action()};handler.postDelayed(r,delay);val cancel: ()->Unit={handler.removeCallbacks(r)};cancel
        },{paint.invoke(workspace)})
        NativeChatWorkspace::class.java.getDeclaredField("dictation\$delegate").apply {isAccessible=true}.set(workspace,lazyOf(owner))
        return owner to port
    }
    private fun positive() {
        val button=ShadowAlertDialog.getLatestAlertDialog().getButton(DialogInterface.BUTTON_POSITIVE)
        val voiceStart=button.text.toString()=="Start voice"
        button.performClick();shadowOf(Looper.getMainLooper()).idle()
        // Robolectric does not synthesize the Activity focus-return callback when a dialog closes.
        if(voiceStart) a.onWindowFocusChanged(true)
    }
    @Test fun nativeDictationRequiresConsentAndFinalTranscriptNeverAutoSends() {
        val (owner,port)=fakeDictation();local<EditText>("draft").setText("EXISTING_DRAFT")
        button("Voice input").performClick();assertEquals(0,port.starts);assertNull(port.ready)
        positive();assertEquals(0,port.starts);port.ready!!(null);assertEquals(1,port.starts);assertTrue(port.offline)
        port.events!!.partial("partial");assertEquals("EXISTING_DRAFT",local<EditText>("draft").text.toString())
        port.events!!.result("FINAL_TRANSCRIPT");assertEquals(NativeDictation.State.REVIEW,owner.state)
        assertEquals("EXISTING_DRAFT",local<EditText>("draft").text.toString());assertFalse(local<android.widget.CheckBox>("consent").isChecked)
        button("Use transcript").performClick();positive()
        assertEquals("FINAL_TRANSCRIPT",local<EditText>("draft").text.toString());assertEquals("",owner.transcript)
        assertFalse(local<NativeChatConversation>("session").busy);assertFalse(local<Lazy<*>>("transport\$delegate").isInitialized())
    }
    @Test fun cancelVoiceConsentAndStalePositiveCannotStartMicrophone() {
        val (_,port)=fakeDictation();button("Voice input").performClick();val old=ShadowAlertDialog.getLatestAlertDialog()
        old.getButton(DialogInterface.BUTTON_NEGATIVE).performClick();shadowOf(Looper.getMainLooper()).idle()
        old.getButton(DialogInterface.BUTTON_POSITIVE).performClick();shadowOf(Looper.getMainLooper()).idle()
        assertNull(port.ready);assertEquals(0,port.starts);assertEquals(0,port.requests)
    }
    @Test fun settingsAndBackgroundStopDictationAndRejectLateResults() {
        val (owner,port)=fakeDictation();button("Voice input").performClick();positive();port.ready!!(null)
        val old=port.events!!;openSettings();old.result("LATE")
        assertFalse(owner.stoppable);assertEquals("",local<EditText>("draft").text.toString())
        a.onBackPressed();button("Voice input").performClick();positive();port.ready!!(null)
        port.events!!.partial("PRIVATE_PARTIAL");c.pause().stop();port.events!!.result("LATE_BACKGROUND")
        assertEquals("",owner.transcript);assertEquals("",local<EditText>("draft").text.toString())
        assertFalse(local<Lazy<*>>("transport\$delegate").isInitialized())
    }
    @Test fun permissionIsRequestedOnlyByExplicitButtonAndNeverAutoStartsAfterwards() {
        val (_,port)=fakeDictation();button("Voice input").performClick();positive();port.ready!!(NativeDictation.State.PERMISSION_REQUIRED)
        assertEquals(0,port.requests);button("Allow microphone").performClick();assertEquals(1,port.requests)
        port.ready!!(null);assertEquals(0,port.starts)
    }
    @Test fun microphoneLeaseRejectsConcurrentAndStaleOwners() {
        val first=Any();val second=Any()
        assertTrue(a.acquireComposerMicrophone(first));assertFalse(a.acquireComposerMicrophone(second))
        a.releaseComposerMicrophone(second);assertTrue(a.composerMicrophoneCurrent(first))
        a.releaseComposerMicrophone(first);assertFalse(a.composerMicrophoneCurrent(first));assertTrue(a.acquireComposerMicrophone(second))
        a.releaseComposerMicrophone(first);assertTrue(a.composerMicrophoneCurrent(second));a.releaseComposerMicrophone(second)
    }
    @Test fun obscuredVoiceConsentCannotStartAndOldButtonIsFenced() {
        val (_,port)=fakeDictation();button("Voice input").performClick();val d=ShadowAlertDialog.getLatestAlertDialog()
        val prop=android.view.MotionEvent.PointerProperties().apply {id=0;toolType=android.view.MotionEvent.TOOL_TYPE_FINGER}
        val coords=android.view.MotionEvent.PointerCoords().apply {x=10f;y=10f}
        val e=android.view.MotionEvent.obtain(0,0,android.view.MotionEvent.ACTION_DOWN,1,arrayOf(prop),arrayOf(coords),0,0,1f,1f,0,0,android.view.InputDevice.SOURCE_TOUCHSCREEN,android.view.MotionEvent.FLAG_WINDOW_IS_OBSCURED)
        try {assertTrue(d.window!!.callback.dispatchTouchEvent(e))} finally {e.recycle()}
        d.getButton(DialogInterface.BUTTON_POSITIVE).performClick();shadowOf(Looper.getMainLooper()).idle()
        assertNull(port.ready);assertEquals(0,port.starts)
    }

    @Test fun onDeviceOnlyFailsOnOlderAndroidWithoutAcquiringMicOrFallingBack() {
        shadowOf(RuntimeEnvironment.getApplication()).grantPermissions(android.Manifest.permission.RECORD_AUDIO)
        val errors=mutableListOf<NativeDictation.State>()
        val port=AndroidDictationPort(a)
        port.start("ur-PK",true,object : NativeDictation.Events {
            override fun ready() {fail("No engine should start")}
            override fun partial(text: String) {fail("No partial")}
            override fun result(text: String) {fail("No result")}
            override fun error(state: NativeDictation.State) {errors.add(state)}
        })
        assertEquals(listOf(NativeDictation.State.ON_DEVICE_UNAVAILABLE),errors)
        val token=Any();assertTrue(a.acquireComposerMicrophone(token));a.releaseComposerMicrophone(token)
        assertNull(shadowOf(a).nextStartedActivity)
    }
    @Test fun legacyListeningCannotTakeOverComposerMicLease() {
        val token=Any();assertTrue(a.acquireComposerMicrophone(token))
        a.MayaBridge().listen("ur-PK");shadowOf(Looper.getMainLooper()).idle()
        assertTrue(a.composerMicrophoneCurrent(token));assertFalse(field<Boolean>("recognitionActive"))
        assertNull(shadowOf(a).nextStartedActivity);a.releaseComposerMicrophone(token)
    }
    @Test fun transcriptReplacementCannotOverwriteADraftEditedAfterReviewDialog() {
        val (owner,port)=fakeDictation();local<EditText>("draft").setText("old draft")
        button("Voice input").performClick();positive();port.ready!!(null);port.events!!.result("transcript")
        button("Use transcript").performClick();local<EditText>("draft").setText("new draft");positive()
        assertEquals("new draft",local<EditText>("draft").text.toString());assertEquals(NativeDictation.State.REVIEW,owner.state)
        assertFalse(local<Lazy<*>>("transport\$delegate").isInitialized())
    }

    @Test fun voiceFailureShowsSelectionAndRecoveryReopensConsentWithoutStarting() {
        val (owner,port)=fakeDictation();local<EditText>("draft").setText("KEEP_TYPED")
        button("Voice input").performClick();positive();port.ready!!(NativeDictation.State.ON_DEVICE_UNAVAILABLE)
        assertTrue(button("Choose voice options").isShown)
        assertTrue(local<android.widget.TextView>("dictationStatus").text.contains("ur-PK"))
        assertEquals(0,port.starts);button("Choose voice options").performClick()
        val dialog=ShadowAlertDialog.getLatestAlertDialog()
        assertTrue(dialog.findViewById<ViewGroup>(android.R.id.content).findViewWithTag<android.widget.TextView>("recognition_availability").text.contains("unavailable"))
        dialog.getButton(DialogInterface.BUTTON_NEGATIVE).performClick();shadowOf(Looper.getMainLooper()).idle()
        assertEquals(NativeDictation.State.ON_DEVICE_UNAVAILABLE,owner.state)
        assertEquals("KEEP_TYPED",local<EditText>("draft").text.toString());assertEquals(0,port.starts);assertEquals(0,port.requests)
    }
    @Test fun recoveryNeverRemembersOnlineChoiceAsANewDefault() {
        val (_,port)=fakeDictation();button("Voice input").performClick()
        fun box(v: View): android.widget.CheckBox? {
            if(v is android.widget.CheckBox) return v
            if(v is ViewGroup) for(i in 0 until v.childCount) box(v.getChildAt(i))?.let {return it}
            return null
        }
        val first=ShadowAlertDialog.getLatestAlertDialog();box(first.findViewById(android.R.id.content))!!.isChecked=false
        positive();port.ready!!(null);assertFalse(port.offline)
        port.events!!.error(NativeDictation.State.LANGUAGE_UNAVAILABLE)
        button("Choose voice options").performClick()
        assertTrue(box(ShadowAlertDialog.getLatestAlertDialog().findViewById(android.R.id.content))!!.isChecked)
        assertEquals(1,port.starts);assertFalse(local<android.widget.CheckBox>("consent").isChecked)
    }
    @Test fun unavailableServiceIsReportedBeforePermissionWithoutLaunchingAnything() {
        shadowOf(RuntimeEnvironment.getApplication()).denyPermissions(android.Manifest.permission.RECORD_AUDIO)
        var result: NativeDictation.State?=null
        AndroidDictationPort(a).check("ur-PK",true) {result=it}
        assertEquals(NativeDictation.State.ON_DEVICE_UNAVAILABLE,result)
        assertNull(shadowOf(a).nextStartedActivity)
    }
    @Test fun AndroidErrorCodesKeepLanguageNetworkAndPermissionDistinct() {
        val codes=mapOf(12 to NativeDictation.State.LANGUAGE_UNSUPPORTED,13 to NativeDictation.State.LANGUAGE_UNAVAILABLE,
            1 to NativeDictation.State.NETWORK_ERROR,2 to NativeDictation.State.NETWORK_ERROR,
            9 to NativeDictation.State.PERMISSION_REQUIRED,8 to NativeDictation.State.BLOCKED,7 to NativeDictation.State.NO_MATCH,
            999 to NativeDictation.State.ERROR)
        codes.forEach {(code,state)->assertEquals(state,AndroidDictationPort.recognitionFailure(code))}
    }
    private fun invokeMain(name: String) {MainActivity::class.java.getDeclaredMethod(name).apply {isAccessible=true}.invoke(a)}
    @Test fun missingHostMountTimesOutWithoutResendingOrClearingDraft() {
        local<EditText>("draft").setText("KEEP_LOCAL")
        shadowOf(Looper.getMainLooper()).idleFor(java.time.Duration.ofSeconds(8))
        assertTrue(field<Boolean>("hostFailed"));assertFalse(field<Boolean>("workspaceHostReady"));assertEquals(View.INVISIBLE,web.visibility)
        assertTrue(button("Retry local interface").isShown)
        assertEquals("KEEP_LOCAL",local<EditText>("draft").text.toString())
        assertFalse(local<Lazy<*>>("transport\$delegate").isInitialized())
        web.webViewClient!!.onPageFinished(web,web.url)
        web.webViewClient!!.onPageStarted(web,web.url,null)
        assertTrue(field<Boolean>("hostFailed")) // A late load must not defeat the manual retry gate.
    }
    @Test fun hostRetryCancelAndStaleConfirmationDoNotReload() {
        invokeMain("failWorkspaceHost");val epoch=field<Long>("hostLoadEpoch")
        button("Retry local interface").performClick();val dialog=ShadowAlertDialog.getLatestAlertDialog()
        dialog.getButton(DialogInterface.BUTTON_NEGATIVE).performClick();shadowOf(Looper.getMainLooper()).idle()
        dialog.getButton(DialogInterface.BUTTON_POSITIVE).performClick();shadowOf(Looper.getMainLooper()).idle()
        assertEquals(epoch,field<Long>("hostLoadEpoch"));assertTrue(field<Boolean>("hostFailed"))
    }
    @Test fun confirmedHostRetryIsBoundedAndPreservesNativeDraftAndConsent() {
        local<EditText>("draft").setText("KEEP_LOCAL");invokeMain("failWorkspaceHost")
        button("Retry local interface").performClick();positive()
        assertFalse(field<Boolean>("hostFailed"));assertEquals("KEEP_LOCAL",local<EditText>("draft").text.toString())
        assertFalse(local<android.widget.CheckBox>("consent").isChecked)
        assertEquals(View.INVISIBLE,web.visibility)
        shadowOf(Looper.getMainLooper()).idleFor(java.time.Duration.ofSeconds(8))
        assertTrue(field<Boolean>("hostFailed"));val epoch=field<Long>("hostLoadEpoch")
        shadowOf(Looper.getMainLooper()).idleFor(java.time.Duration.ofSeconds(25))
        assertEquals(epoch,field<Long>("hostLoadEpoch"));assertNull(shadowOf(a).nextStartedActivity)
    }
    @Test fun hostRetryIsDeniedWhileNativeMicOwnerExists() {
        val token=Any();assertTrue(a.acquireComposerMicrophone(token));invokeMain("failWorkspaceHost")
        assertFalse(a.retryWorkspaceHost());assertTrue(field<Boolean>("hostFailed"))
        a.releaseComposerMicrophone(token)
    }
    @Test fun failedHostNoticeTravelsIntoDedicatedSettingsAndBack() {
        invokeMain("failWorkspaceHost");openSettings();button("Original settings · expand here").performClick()
        assertEquals("voice_settings_page",(local<android.widget.ScrollView>("hostNoticeContainer").parent as View).tag)
        assertTrue(button("Retry local interface").isShown);assertFalse(local<EditText>("draft").isShown)
        a.onBackPressed();a.onBackPressed()
        assertEquals("host_notice_slot",(local<android.widget.ScrollView>("hostNoticeContainer").parent as View).tag)
        assertTrue(button("Retry local interface").isShown)
    }
    @Test fun presentationTimeoutRejectsLateAckAndExplicitReloadFencesOldMounts() {
        val original=web;val callbacks=mutableListOf<android.webkit.ValueCallback<String>>()
        val testWeb=object : WebView(a) {
            override fun getUrl()="https://appassets.androidplatform.net/assets/web/index.html"
            override fun evaluateJavascript(script: String,callback: android.webkit.ValueCallback<String>?) {callbacks.add(callback!!)}
        }
        fun set(name: String,value: Any)=MainActivity::class.java.getDeclaredField(name).apply {isAccessible=true}.set(a,value)
        try {
            set("webView",testWeb);set("workspaceHostReady",true)
            invokeMain("applyWorkspacePresentation")
            shadowOf(Looper.getMainLooper()).idleFor(java.time.Duration.ofSeconds(8))
            callbacks[0].onReceiveValue("true");assertEquals(View.INVISIBLE,testWeb.visibility);assertTrue(field<Boolean>("hostFailed"))
            assertTrue(a.retryWorkspaceHost());original.webViewClient!!.onPageFinished(testWeb,testWeb.url)
            val old=callbacks.last();invokeMain("beginWorkspaceHostLoad")
            old.onReceiveValue("true");assertFalse(field<Boolean>("workspaceHostReady"))
        } finally {set("webView",original);testWeb.destroy()}
    }
    @Test fun successfulMountAndPresentationDismissNoticeButDuplicateAckCannotBreakIt() {
        val original=web;val callbacks=mutableListOf<android.webkit.ValueCallback<String>>()
        val testWeb=object : WebView(a) {
            override fun getUrl()="https://appassets.androidplatform.net/assets/web/index.html"
            override fun evaluateJavascript(script: String,callback: android.webkit.ValueCallback<String>?) {callbacks.add(callback!!)}
        }
        fun set(value: WebView)=MainActivity::class.java.getDeclaredField("webView").apply {isAccessible=true}.set(a,value)
        try {
            set(testWeb);original.webViewClient!!.onPageFinished(testWeb,testWeb.url)
            callbacks[0].onReceiveValue("true");callbacks[1].onReceiveValue("true")
            assertEquals(View.VISIBLE,testWeb.visibility);assertFalse(button("Retry local interface").isShown)
            callbacks[0].onReceiveValue("false");callbacks[1].onReceiveValue("false")
            shadowOf(Looper.getMainLooper()).idleFor(java.time.Duration.ofSeconds(9))
            assertFalse(field<Boolean>("hostFailed"));assertEquals(View.VISIBLE,testWeb.visibility)
        } finally {set(original);testWeb.destroy()}
    }

    @Test fun falseMountAckFailsImmediatelyAndCannotLaterBecomeReady() {
        val original=web;val callbacks=mutableListOf<android.webkit.ValueCallback<String>>()
        val testWeb=object : WebView(a) {
            override fun getUrl()="https://appassets.androidplatform.net/assets/web/index.html"
            override fun evaluateJavascript(script: String,callback: android.webkit.ValueCallback<String>?) {callbacks.add(callback!!)}
        }
        fun set(value: WebView)=MainActivity::class.java.getDeclaredField("webView").apply {isAccessible=true}.set(a,value)
        try {
            set(testWeb);original.webViewClient!!.onPageFinished(testWeb,testWeb.url)
            callbacks[0].onReceiveValue("false");assertTrue(field<Boolean>("hostFailed"))
            callbacks[0].onReceiveValue("true");assertFalse(field<Boolean>("workspaceHostReady"));assertEquals(View.INVISIBLE,testWeb.visibility)
        } finally {set(original);testWeb.destroy()}
    }
    @Test fun pauseRevokesHostPresentationAndResumeNeedsFreshAck() {
        val original=web;val callbacks=mutableListOf<android.webkit.ValueCallback<String>>()
        val testWeb=object : WebView(a) {
            override fun getUrl()="https://appassets.androidplatform.net/assets/web/index.html"
            override fun evaluateJavascript(script: String,callback: android.webkit.ValueCallback<String>?) {callbacks.add(callback!!)}
        }
        fun set(name: String,value: Any)=MainActivity::class.java.getDeclaredField(name).apply {isAccessible=true}.set(a,value)
        try {
            set("webView",testWeb);set("workspaceHostReady",true);invokeMain("applyWorkspacePresentation")
            val old=callbacks.last();c.pause();old.onReceiveValue("true");assertEquals(View.INVISIBLE,testWeb.visibility)
            c.resume();old.onReceiveValue("true");assertEquals(View.INVISIBLE,testWeb.visibility)
            callbacks.last().onReceiveValue("true");assertEquals(View.VISIBLE,testWeb.visibility)
        } finally {set("webView",original);testWeb.destroy()}
    }
    @Test fun navigatingAwayRevokesHostRetryConfirmation() {
        invokeMain("failWorkspaceHost");val epoch=field<Long>("hostLoadEpoch")
        button("Retry local interface").performClick();val old=ShadowAlertDialog.getLatestAlertDialog()
        c.pause().resume();old.getButton(DialogInterface.BUTTON_POSITIVE).performClick();shadowOf(Looper.getMainLooper()).idle()
        assertTrue(field<Boolean>("hostFailed"));assertEquals(epoch,field<Long>("hostLoadEpoch"))
    }

    @Test fun savedWorkCategoryIsDedicatedAndBackKeepsDraftWithoutImplicitVaultKey() {
        local<EditText>("draft").setText("KEEP_DRAFT")
        assertFalse(local<Lazy<*>>("savedVault\$delegate").isInitialized())
        openSettings();button("Saved work & backups").performClick()
        assertEquals(5,local<Int>("section"));assertFalse(local<EditText>("draft").isShown)
        a.onBackPressed();assertEquals(4,local<Int>("section"));a.onBackPressed()
        assertEquals(0,local<Int>("section"));assertEquals("KEEP_DRAFT",local<EditText>("draft").text.toString())
        assertNull(shadowOf(a).nextStartedActivity)
    }
    @Test fun restoredSnapshotHasOneTimelineAdmissionAndNoConsentPreviewOrNetwork() {
        val messages=listOf(NativeChatProtocol.Message("user","saved question"),NativeChatProtocol.Message("assistant","saved reply"))
        val item=SavedWorkspace(java.util.UUID.randomUUID().toString(),"saved",0,messages,"new local draft","<html>saved file</html>")
        // Invoke the post-confirmation restore path without creating an AndroidKeyStore key in this shadow.
        NativeChatWorkspace::class.java.getDeclaredField("section").apply {isAccessible=true}.set(workspace,5)
        local<android.widget.CheckBox>("consent").isChecked=true
        NativeChatWorkspace::class.java.getDeclaredMethod("openSavedWorkspace",SavedWorkspace::class.java).apply {isAccessible=true}.invoke(workspace,item)
        assertEquals(messages,local<NativeChatConversation>("session").messages())
        val timeline=local<MutableList<Any>>("timeline")
        assertEquals(2,timeline.filterIsInstance<NativeChatProtocol.Message>().size)
        assertEquals(1,timeline.filterIsInstance<com.maya.ai.agent.InlineBuildTurn>().size)
        val builder=local<com.maya.ai.agent.InlineBuildTurn>("buildTask")
        assertEquals(item.code,builder.editor.text.toString());assertFalse(builder.busy);assertFalse(builder.approved)
        assertNull(com.maya.ai.agent.InlineBuildTurn::class.java.getDeclaredField("preview").apply {isAccessible=true}.get(builder))
        assertFalse(local<android.widget.CheckBox>("consent").isChecked)
        assertEquals(item.draft,local<EditText>("draft").text.toString());assertEquals(0,local<Int>("section"))
        assertFalse(local<Lazy<*>>("transport\$delegate").isInitialized())
        c.pause().stop().restart().start().resume()
        assertTrue(local<NativeChatConversation>("session").messages().isEmpty());assertEquals("",local<EditText>("draft").text.toString())
    }

    private class PermissionMemory: DirectSendPermission.Store {
        var value: String?=null;var writes=0
        override fun read()=value
        override fun write(value: String) {this.value=value;writes++}
    }
    private fun permissionFixture(): PermissionMemory {
        val store=PermissionMemory()
        NativeChatWorkspace::class.java.getDeclaredField("useConfiguredChat").apply {isAccessible=true}.set(workspace,false)
        NativeChatWorkspace::class.java.getDeclaredField("cloudflareReviewed").apply {isAccessible=true}.set(workspace,true)
        NativeChatWorkspace::class.java.getDeclaredField("directPermission\$delegate").apply {isAccessible=true}.set(workspace,lazyOf(DirectSendPermission(store)))
        // Block before signing/network; this changes only the Robolectric fixture preference.
        a.getSharedPreferences("maya",0).edit().putBoolean("wake",true).commit()
        return store
    }
    @Test fun composerHasNoAllowCheckboxAndSendOpensConsentWithoutCreatingAttempt() {
        val store=permissionFixture();local<EditText>("draft").setText("hi")
        assertNull(local<android.widget.CheckBox>("consent").parent)
        assertTrue(local<android.widget.Button>("send").isEnabled)
        local<android.widget.Button>("send").performClick()
        val d=ShadowAlertDialog.getLatestAlertDialog()
        assertFalse(d.window!!.decorView.findViewWithTag<android.widget.CheckBox>("remember_direct_permission").isChecked)
        assertTrue(d.window!!.decorView.findViewWithTag<android.widget.TextView>("direct_send_review").text.contains("hi"))
        assertTrue(local<List<Any>>("timeline").isEmpty());assertEquals(0,store.writes)
        assertFalse(local<Lazy<*>>("transport\$delegate").isInitialized())
    }
    @Test fun cancelledOrStaleConsentNeverSendsOrRemembers() {
        val store=permissionFixture();local<EditText>("draft").setText("hi");local<android.widget.Button>("send").performClick()
        val old=ShadowAlertDialog.getLatestAlertDialog();old.window!!.decorView.findViewWithTag<android.widget.CheckBox>("remember_direct_permission").isChecked=true
        old.getButton(DialogInterface.BUTTON_NEGATIVE).performClick();shadowOf(Looper.getMainLooper()).idle()
        old.getButton(DialogInterface.BUTTON_POSITIVE).performClick();shadowOf(Looper.getMainLooper()).idle()
        assertEquals(0,store.writes);assertFalse(local<android.widget.CheckBox>("consent").isChecked);assertTrue(local<List<Any>>("timeline").isEmpty())
    }
    @Test fun editingDraftAfterConsentReviewRejectsBothSendAndRemember() {
        val store=permissionFixture();local<EditText>("draft").setText("first");local<android.widget.Button>("send").performClick()
        ShadowAlertDialog.getLatestAlertDialog().window!!.decorView.findViewWithTag<android.widget.CheckBox>("remember_direct_permission").isChecked=true
        local<EditText>("draft").setText("edited");positive()
        assertEquals(0,store.writes);assertTrue(local<List<Any>>("timeline").isEmpty());assertFalse(local<android.widget.CheckBox>("consent").isChecked)
    }
    @Test fun rememberedManualSendingDoesNotBypassWakeOrRepeatConsentAfterBackground() {
        val store=permissionFixture();local<EditText>("draft").setText("hi");local<android.widget.Button>("send").performClick()
        val consentDialog=ShadowAlertDialog.getLatestAlertDialog()
        consentDialog.window!!.decorView.findViewWithTag<android.widget.CheckBox>("remember_direct_permission").isChecked=true;positive()
        assertEquals(1,store.writes);assertTrue(button("Open Voice settings").isShown)
        assertEquals(View.VISIBLE,local<android.widget.TextView>("status").visibility)
        assertTrue(local<NativeChatConversation>("session").messages().isEmpty());assertFalse(local<Lazy<*>>("transport\$delegate").isInitialized())
        c.pause().stop().restart().start().resume();assertFalse(local<android.widget.CheckBox>("consent").isChecked)
        local<EditText>("draft").setText("new manual message");local<android.widget.Button>("send").performClick();shadowOf(Looper.getMainLooper()).idle()
        assertSame(consentDialog,ShadowAlertDialog.getLatestAlertDialog());assertTrue(button("Open Voice settings").isShown)
        assertEquals(1,store.writes);assertFalse(local<Lazy<*>>("transport\$delegate").isInitialized())
    }
    @Test fun voiceSettingsShortcutPreservesDraftAndDoesNotTurnWakeOffOrResend() {
        permissionFixture();local<android.widget.CheckBox>("consent").isChecked=true;local<EditText>("draft").setText("hi")
        local<android.widget.Button>("send").performClick();shadowOf(Looper.getMainLooper()).idle();val before=local<List<Any>>("timeline").size
        button("Open Voice settings").performClick()
        assertEquals(3,local<Int>("section"));assertEquals("hi",local<EditText>("draft").text.toString())
        assertTrue(a.getSharedPreferences("maya",0).getBoolean("wake",false));assertNull(shadowOf(a).nextStartedActivity)
        a.onBackPressed();a.onBackPressed();assertEquals(0,local<Int>("section"))
        assertEquals(before,local<List<Any>>("timeline").size);assertFalse(local<Lazy<*>>("transport\$delegate").isInitialized())
    }
    @Test fun rememberRevocationPreservesDraftButNextSendAsksAgain() {
        val store=permissionFixture();store.value=DirectSendPermission.POLICY
        local<EditText>("draft").setText("KEEP");openSettings();button("Privacy ▾").performClick();button("Revoke Direct consent").performClick()
        assertEquals("",store.value);assertEquals("KEEP",local<EditText>("draft").text.toString())
        a.onBackPressed();a.onBackPressed();local<android.widget.Button>("send").performClick()
        assertTrue(ShadowAlertDialog.getLatestAlertDialog().isShowing);assertTrue(local<List<Any>>("timeline").isEmpty())
    }
    @Test fun restoringSavedWorkRequiresFreshConsentEvenWithRememberedPermission() {
        val store=permissionFixture();store.value=DirectSendPermission.POLICY
        val item=SavedWorkspace(java.util.UUID.randomUUID().toString(),"saved",0,
            listOf(NativeChatProtocol.Message("user","old question"),NativeChatProtocol.Message("assistant","old reply")),"new question",null)
        NativeChatWorkspace::class.java.getDeclaredField("section").apply {isAccessible=true}.set(workspace,5)
        NativeChatWorkspace::class.java.getDeclaredMethod("openSavedWorkspace",SavedWorkspace::class.java).apply {isAccessible=true}.invoke(workspace,item)
        local<android.widget.Button>("send").performClick()
        assertTrue(ShadowAlertDialog.getLatestAlertDialog().isShowing)
        assertEquals(2,local<List<Any>>("timeline").size);assertEquals(0,store.writes);assertFalse(local<Lazy<*>>("transport\$delegate").isInitialized())
    }
    @Test fun backgroundRevokesAStillOpenRememberDialog() {
        val store=permissionFixture();local<EditText>("draft").setText("hi");local<android.widget.Button>("send").performClick()
        val old=ShadowAlertDialog.getLatestAlertDialog();old.window!!.decorView.findViewWithTag<android.widget.CheckBox>("remember_direct_permission").isChecked=true
        c.pause().stop().restart().start().resume();old.getButton(DialogInterface.BUTTON_POSITIVE).performClick();shadowOf(Looper.getMainLooper()).idle()
        assertEquals(0,store.writes);assertEquals("",local<EditText>("draft").text.toString());assertTrue(local<List<Any>>("timeline").isEmpty())
    }
    @Test fun emptyBackgroundDoesNotLeaveARepeatedClearBanner() {
        c.pause().stop().restart().start().resume()
        assertEquals("",local<android.widget.TextView>("status").text.toString());assertEquals(View.GONE,local<android.widget.TextView>("status").visibility)
    }
    @Test fun permissionRecordIsNotAStoredConversationOrAutomaticStartupGrant() {
        val file=java.io.File(a.noBackupFilesDir,"direct-send-permission-v1");file.delete()
        try {
            val permission=AndroidDirectSendPermission.create(a)
            assertFalse(permission.remembered());assertFalse(file.exists());assertTrue(permission.remember())
            assertEquals(DirectSendPermission.POLICY,file.readText())
            assertTrue(AndroidDirectSendPermission.create(a).remembered())
            file.writeText("x".repeat(1024));assertFalse(AndroidDirectSendPermission.create(a).remembered())
            assertTrue(permission.forget());assertFalse(AndroidDirectSendPermission.create(a).remembered())
        } finally {file.delete()}
    }

    @Test fun temporaryGrantCoversOnlyThisConversationWithoutWritingRemember() {
        val store=permissionFixture();local<EditText>("draft").setText("hi");local<android.widget.Button>("send").performClick()
        val first=ShadowAlertDialog.getLatestAlertDialog();positive();local<android.widget.Button>("send").performClick();shadowOf(Looper.getMainLooper()).idle()
        assertSame(first,ShadowAlertDialog.getLatestAlertDialog());assertEquals(0,store.writes);assertTrue(local<List<Any>>("timeline").isEmpty())
        c.pause().stop().restart().start().resume();local<EditText>("draft").setText("new");local<android.widget.Button>("send").performClick()
        assertNotSame(first,ShadowAlertDialog.getLatestAlertDialog());assertTrue(local<List<Any>>("timeline").isEmpty())
    }
    @Test fun obscuredSendPermissionCannotPersistOrCreateAnAttempt() {
        val store=permissionFixture();local<EditText>("draft").setText("hi");local<android.widget.Button>("send").performClick()
        val d=ShadowAlertDialog.getLatestAlertDialog();d.window!!.decorView.findViewWithTag<android.widget.CheckBox>("remember_direct_permission").isChecked=true
        val prop=android.view.MotionEvent.PointerProperties().apply {id=0;toolType=android.view.MotionEvent.TOOL_TYPE_FINGER}
        val coords=android.view.MotionEvent.PointerCoords().apply {x=10f;y=10f}
        val e=android.view.MotionEvent.obtain(0,0,android.view.MotionEvent.ACTION_DOWN,1,arrayOf(prop),arrayOf(coords),0,0,1f,1f,0,0,android.view.InputDevice.SOURCE_TOUCHSCREEN,android.view.MotionEvent.FLAG_WINDOW_IS_PARTIALLY_OBSCURED)
        try {assertTrue(d.window!!.callback.dispatchTouchEvent(e))} finally {e.recycle()}
        d.getButton(DialogInterface.BUTTON_POSITIVE).performClick();shadowOf(Looper.getMainLooper()).idle()
        assertEquals(0,store.writes);assertTrue(local<List<Any>>("timeline").isEmpty());assertFalse(local<android.widget.CheckBox>("consent").isChecked)
    }

    @Test fun foregroundSessionIsAbsentOnStartupAndInputOptInIsUnchecked() {
        val root=a.findViewById<ViewGroup>(android.R.id.content)
        assertEquals(View.GONE,root.findViewWithTag<View>("voice_session_panel").visibility)
        button("Mic").performClick();val d=ShadowAlertDialog.getLatestAlertDialog()
        val keep=d.findViewById<ViewGroup>(android.R.id.content).findViewWithTag<android.widget.CheckBox>("voice_session_opt_in")
        assertNotNull(keep);assertFalse(keep.isChecked)
        d.getButton(DialogInterface.BUTTON_NEGATIVE).performClick();shadowOf(Looper.getMainLooper()).idle()
        assertFalse(local<Lazy<com.maya.ai.voice.ForegroundVoiceSession>>("voiceSession\$delegate").value.armed)
    }
    @Test fun wakeOffIsASeparateUncheckedChoiceAndCancelPreservesPreference() {
        a.getSharedPreferences("maya",0).edit().putBoolean("wake",true).commit()
        button("Mic").performClick();val d=ShadowAlertDialog.getLatestAlertDialog()
        val off=d.findViewById<ViewGroup>(android.R.id.content).findViewWithTag<android.widget.CheckBox>("voice_session_wake_off")
        assertEquals(View.VISIBLE,off.visibility);assertFalse(off.isChecked)
        off.isChecked=true;d.getButton(DialogInterface.BUTTON_NEGATIVE).performClick()
        assertTrue(a.getSharedPreferences("maya",0).getBoolean("wake",false))
        assertFalse(local<Lazy<*>>("transport\$delegate").isInitialized())
    }
    @Test fun wakeInvitationOpensOnlyNativeInputReviewNoHiddenDispatch() {
        val surface=field<View>("nativeChatView")
        MainActivity::class.java.getDeclaredField("voiceHostTrusted").apply {isAccessible=true}.set(a,true)
        a.MayaBridge().nativeWakeNotice();shadowOf(Looper.getMainLooper()).idle()
        assertTrue(local<Boolean>("fishTalkPreparing")) // Local preflight only; shadow WebView does not execute it.
        assertSame(surface,field<View>("nativeChatView"));assertTrue(local<NativeChatConversation>("session").messages().isEmpty())
        assertFalse(local<Lazy<*>>("transport\$delegate").isInitialized());assertEquals("",local<EditText>("draft").text.toString())
    }
    @Test fun backgroundRejectsWakeInvitationAndKeepsSavedPreferenceButNotCapture() {
        a.getSharedPreferences("maya",0).edit().putBoolean("wake",true).commit()
        c.pause();a.MayaBridge().nativeWakeNotice();shadowOf(Looper.getMainLooper()).idle()
        assertFalse(a.voiceForeground());assertTrue(a.getSharedPreferences("maya",0).getBoolean("wake",false))
        assertNull(com.maya.ai.WakeWordService.instance)
        assertFalse(local<Lazy<*>>("transport\$delegate").isInitialized());c.resume()
    }

    @Test fun confirmedVoiceStartWaitsForForegroundFocusBeforeCheckingEngine() {
        button("Mic").performClick();a.onWindowFocusChanged(false)
        val d=ShadowAlertDialog.getLatestAlertDialog()
        d.findViewById<ViewGroup>(android.R.id.content).findViewWithTag<android.widget.CheckBox>("voice_session_opt_in").isChecked=true
        d.getButton(DialogInterface.BUTTON_POSITIVE).performClick();shadowOf(Looper.getMainLooper()).idle()
        assertEquals(NativeDictation.State.IDLE,local<Lazy<NativeDictation>>("dictation\$delegate").value.state)
        a.onWindowFocusChanged(true)
        // API28 cannot use on-device-only. The failure is explicit, without opening an engine or network.
        assertEquals(NativeDictation.State.ON_DEVICE_UNAVAILABLE,local<Lazy<NativeDictation>>("dictation\$delegate").value.state)
        assertFalse(local<Lazy<com.maya.ai.voice.ForegroundVoiceSession>>("voiceSession\$delegate").value.armed)
        assertFalse(local<Lazy<*>>("transport\$delegate").isInitialized())
    }
    @Test fun pendingInputFocusHandoffCannotSurviveBackgroundReturn() {
        button("Mic").performClick();a.onWindowFocusChanged(false)
        ShadowAlertDialog.getLatestAlertDialog().getButton(DialogInterface.BUTTON_POSITIVE).performClick()
        shadowOf(Looper.getMainLooper()).idle();c.pause();c.resume();a.onWindowFocusChanged(true)
        assertEquals(NativeDictation.State.IDLE,local<Lazy<NativeDictation>>("dictation\$delegate").value.state)
        assertFalse(local<Lazy<*>>("transport\$delegate").isInitialized())
    }

    @Test fun realWorkspaceSpeechCompletionRearmsSameReviewedInputSessionWithoutSend() {
        val (input,port)=fakeDictation();button("Mic").performClick()
        ShadowAlertDialog.getLatestAlertDialog().findViewById<ViewGroup>(android.R.id.content)
            .findViewWithTag<android.widget.CheckBox>("voice_session_opt_in").isChecked=true
        positive();port.ready!!(null);port.events!!.ready();port.events!!.result("LOCAL_REVIEW_ONLY")
        val grant=local<Lazy<com.maya.ai.voice.ForegroundVoiceSession>>("voiceSession\$delegate").value
        assertEquals(com.maya.ai.voice.ForegroundVoiceSession.Phase.REVIEW,grant.phase)
        button("Use transcript").performClick();assertEquals("LOCAL_REVIEW_ONLY",local<EditText>("draft").text.toString())
        assertEquals(NativeDictation.State.IDLE,input.state)
        val output=local<Lazy<NativeReplySpeech>>("speech\$delegate").value
        var event: ((String,Int)->Unit)?=null
        val fake=object : NativeReplySpeech.Port {
            override fun prepare(text: String?,result: (NativeFishPolicy.Result)->Unit) {result(NativeFishPolicy.Result.Prepared("{}","{}"))}
            override fun play(prepared: NativeFishPolicy.Result.Prepared,callback: (String,Int)->Unit): Boolean {event=callback;return true}
            override fun stopOwned() {}
        }
        NativeReplySpeech::class.java.getDeclaredField("port").apply {isAccessible=true}.set(output,fake)
        assertTrue(output.speak("SYNTHETIC_REPLY",true))
        assertEquals(com.maya.ai.voice.ForegroundVoiceSession.Phase.OUTPUT,grant.phase)
        event!!("done",200);assertEquals(1,port.starts)
        shadowOf(Looper.getMainLooper()).idleFor(600,java.util.concurrent.TimeUnit.MILLISECONDS)
        port.ready!!(null);assertEquals(2,port.starts);assertTrue(port.offline)
        assertFalse(local<Lazy<*>>("transport\$delegate").isInitialized())
        assertTrue(local<NativeChatConversation>("session").messages().isEmpty())
        button("End voice session").performClick();assertFalse(grant.armed);assertFalse(input.busy)
    }

    @Test fun talkIsAvailableWithoutStartingMicAndUnownedVoiceEventsAreIgnored() {
        assertNotNull(button("Talk with Fish"));val before=local<List<Any>>("timeline").size
        a.MayaBridge().fishTalkEvent("a".repeat(32),"user","unowned")
        a.MayaBridge().fishTalkSpeak("a".repeat(32),1,"{}","{}")
        shadowOf(Looper.getMainLooper()).idle()
        assertEquals(before,local<List<Any>>("timeline").size)
        assertNull(field<Any?>("talkPlayer"));assertNull(field<String?>("fishTalkId"))
        assertFalse(local<Lazy<*>>("transport\$delegate").isInitialized())
    }
    private val talkScripts=mutableListOf<String>()
    private fun withTalkHost(block: ()->Unit) {
        talkScripts.clear()
        val original=web
        val fake=object : WebView(a) {
            // This replacement is not attached to a Window; model the real host's UI queue explicitly.
            override fun post(action: Runnable): Boolean=android.os.Handler(Looper.getMainLooper()).post(action)
            override fun evaluateJavascript(script: String,callback: android.webkit.ValueCallback<String>?) {
                talkScripts.add(script)
                when {
                    script.contains("FISH_TALK.describe()") -> callback?.onReceiveValue(org.json.JSONObject.quote("{\"code\":\"READY\",\"review\":\"review1\",\"provider\":\"groq\",\"model\":\"saved-model\",\"language\":\"ur-PK\",\"tokens\":400}"))
                    script.startsWith("FISH_TALK.start(") -> callback?.onReceiveValue("true")
                    else -> callback?.onReceiveValue("null")
                }
            }
        }
        MainActivity::class.java.getDeclaredField("webView").apply {isAccessible=true}.set(a,fake)
        MainActivity::class.java.getDeclaredField("voiceHostTrusted").apply {isAccessible=true}.set(a,true)
        try {block()} finally {a.stopFishTalk();MainActivity::class.java.getDeclaredField("webView").apply {isAccessible=true}.set(a,original);fake.destroy()}
    }
    @Test fun talkDisclosureIsOncePerSessionAndCancelStartsNothing() = withTalkHost {
        button("Talk with Fish").performClick();val d=ShadowAlertDialog.getLatestAlertDialog()
        assertTrue(d.isShowing);assertNull(field<String?>("fishTalkId"))
        d.getButton(DialogInterface.BUTTON_NEGATIVE).performClick();shadowOf(Looper.getMainLooper()).idle()
        assertFalse(local<Boolean>("fishTalkBusy"));assertNull(field<String?>("fishTalkId"))
        assertFalse(local<Lazy<*>>("transport\$delegate").isInitialized())
    }
    @Test fun talkEventsStayInSameTimelineButNeverEnterDirectContext() = withTalkHost {
        shadowOf(RuntimeEnvironment.getApplication()).grantPermissions(android.Manifest.permission.RECORD_AUDIO)
        val surface=field<View>("nativeChatView");button("Talk with Fish").performClick();positive();a.onWindowFocusChanged(true)
        val id=field<String?>("fishTalkId")!!;assertTrue(local<Boolean>("fishTalkBusy"))
        a.MayaBridge().fishTalkEvent(id,"state","thinking")
        a.MayaBridge().fishTalkEvent(id,"user","voice question")
        a.MayaBridge().fishTalkEvent(id,"assistant","voice answer")
        shadowOf(Looper.getMainLooper()).idle()
        assertEquals(2,local<List<Any>>("timeline").size);assertTrue(local<NativeChatConversation>("session").messages().isEmpty())
        assertSame(surface,field<View>("nativeChatView"));assertFalse(local<Lazy<*>>("transport\$delegate").isInitialized())
        button("Stop current work").performClick();assertNull(field<String?>("fishTalkId"));assertFalse(local<Boolean>("fishTalkBusy"))
        a.MayaBridge().fishTalkEvent(id,"assistant","late");shadowOf(Looper.getMainLooper()).idle()
        assertEquals(2,local<List<Any>>("timeline").size)
    }

    private class ConfigHost {
        var packet="{\"code\":\"READY\",\"provider\":\"groq\",\"model\":\"saved-model\",\"key\":\"SYNTHETIC_AI_KEY\",\"tokens\":400}"
        val scripts=mutableListOf<String>()
    }
    private fun withConfiguredHost(block: (ConfigHost)->Unit) {
        val original=web;val fixture=ConfigHost()
        val fake=object : WebView(a) {
            override fun getUrl()="https://appassets.androidplatform.net/assets/web/index.html"
            override fun evaluateJavascript(script: String,callback: android.webkit.ValueCallback<String>?) {
                fixture.scripts.add(script)
                if(script.contains("FISH_TALK.chatConfig()")) callback?.onReceiveValue(org.json.JSONObject.quote(fixture.packet))
                else if(script==NativeChatReadiness.IDLE_SCRIPT) callback?.onReceiveValue("\"READY\"")
                else callback?.onReceiveValue("null")
            }
        }
        MainActivity::class.java.getDeclaredField("webView").apply {isAccessible=true}.set(a,fake)
        MainActivity::class.java.getDeclaredField("voiceHostTrusted").apply {isAccessible=true}.set(a,true)
        try {block(fixture)} finally {MainActivity::class.java.getDeclaredField("webView").apply {isAccessible=true}.set(a,original);fake.destroy()}
    }
    @Test fun defaultChatUsesSavedAiAndNeverInheritsCloudflareConsent() = withConfiguredHost {f ->
        assertTrue(local<Boolean>("useConfiguredChat"));assertFalse(local<Boolean>("cloudflareReviewed"))
        a.getSharedPreferences("maya",0).edit().putBoolean("wake",true).commit()
        local<android.widget.CheckBox>("consent").isChecked=true
        local<EditText>("draft").setText("PRIVATE_NATIVE_DRAFT")
        local<Button>("send").performClick()
        val d=ShadowAlertDialog.getLatestAlertDialog();assertTrue(d.isShowing)
        assertTrue(d.window!!.decorView.findViewWithTag<android.widget.TextView>("configured_context_review").text.contains("PRIVATE_NATIVE_DRAFT"))
        assertFalse(f.scripts.any {it.contains("PRIVATE_NATIVE_DRAFT")})
        assertTrue(a.getSharedPreferences("maya",0).getBoolean("wake",false))
        assertTrue(local<List<Any>>("timeline").isEmpty())
        assertFalse(local<Lazy<*>>("configuredTransport\$delegate").isInitialized());assertFalse(local<Lazy<*>>("transport\$delegate").isInitialized())
        d.getButton(DialogInterface.BUTTON_NEGATIVE).performClick()
        d.getButton(DialogInterface.BUTTON_POSITIVE).performClick();shadowOf(Looper.getMainLooper()).idle()
        assertFalse(local<Lazy<*>>("configuredTransport\$delegate").isInitialized())
    }
    @Test fun missingAiNeverStartsMicOrAppendsRepeatedFailureCards() = withConfiguredHost {f ->
        f.packet="{\"code\":\"AI\"}";local<EditText>("draft").setText("Bhai")
        repeat(12) {local<Button>("send").performClick()}
        assertTrue(local<List<Any>>("timeline").isEmpty());assertEquals("Bhai",local<EditText>("draft").text.toString())
        assertTrue(local<android.widget.TextView>("status").text.contains("no eligible saved AI"))
        assertTrue(f.scripts.all {it=="window.FISH_TALK ? FISH_TALK.chatConfig() : null"})
        assertFalse(local<Lazy<*>>("configuredTransport\$delegate").isInitialized());assertNull(field<String?>("fishTalkId"))
    }
    @Test fun changedProviderKeyAfterReviewRequiresFreshConsentAndKeepsDraft() = withConfiguredHost {f ->
        local<EditText>("draft").setText("PRIVATE_TYPED")
        local<Button>("send").performClick();f.packet=f.packet.replace("SYNTHETIC_AI_KEY","CHANGED_KEY")
        positive();shadowOf(Looper.getMainLooper()).idleFor(300,java.util.concurrent.TimeUnit.MILLISECONDS)
        assertTrue(local<android.widget.TextView>("status").text.contains("AI selection changed"))
        assertEquals("PRIVATE_TYPED",local<EditText>("draft").text.toString());assertTrue(local<List<Any>>("timeline").isEmpty())
        assertFalse(f.scripts.any {it.contains("PRIVATE_TYPED")});assertNull(local<String?>("configuredGrant"))
        assertFalse(local<Lazy<*>>("configuredTransport\$delegate").isInitialized())
    }
    @Test fun editingNativeDraftInvalidatesTheReviewedConfiguredSend() = withConfiguredHost {f ->
        local<EditText>("draft").setText("OLD_PRIVATE");local<Button>("send").performClick()
        local<EditText>("draft").setText("NEW_PRIVATE");positive()
        assertTrue(local<List<Any>>("timeline").isEmpty());assertFalse(local<Lazy<*>>("configuredTransport\$delegate").isInitialized())
        assertFalse(f.scripts.any {it.contains("PRIVATE")})
    }
    @Test fun disabledCloudflareDoesNotCreateAttemptsOrFallBackWithoutReview() {
        NativeChatWorkspace::class.java.getDeclaredField("useConfiguredChat").apply {isAccessible=true}.set(workspace,false)
        local<EditText>("draft").setText("Bhai")
        repeat(10) {local<Button>("send").performClick()}
        assertTrue(local<List<Any>>("timeline").isEmpty())
        assertTrue(local<android.widget.TextView>("status").text.contains("Cloudflare Direct is unavailable"))
        assertFalse(local<Lazy<*>>("transport\$delegate").isInitialized());assertFalse(local<Lazy<*>>("configuredTransport\$delegate").isInitialized())
        button("AI connection").performClick();assertTrue(ShadowAlertDialog.getLatestAlertDialog().isShowing)
        ShadowAlertDialog.getLatestAlertDialog().getButton(DialogInterface.BUTTON_NEGATIVE).performClick()
        assertFalse(local<Boolean>("useConfiguredChat"));assertEquals("Bhai",local<EditText>("draft").text.toString())
    }
    @Test fun savedWakeSwitchDoesNotEqualAnActiveMicrophoneOwner() = withConfiguredHost { _ ->
        a.getSharedPreferences("maya",0).edit().putBoolean("wake",true).commit()
        var result: NativeChatReadiness.Reason?=null;a.nativeConfiguredReady {result=it}
        assertEquals(NativeChatReadiness.Reason.READY,result)
        val port=AndroidDictationPort(a)
        val runtime=AndroidDictationPort::class.java.getDeclaredMethod("runtimeReady").apply {isAccessible=true}
        assertEquals(true,runtime.invoke(port))
        val service=Robolectric.buildService(com.maya.ai.WakeWordService::class.java).get()
        com.maya.ai.WakeWordService.instance=service
        try {a.nativeConfiguredReady {result=it};assertEquals(NativeChatReadiness.Reason.WAKE_SERVICE,result);assertEquals(false,runtime.invoke(port))} finally {com.maya.ai.WakeWordService.instance=null}
        assertTrue(a.getSharedPreferences("maya",0).getBoolean("wake",false))
    }

    @Test fun documentTransitionSettlesPendingConfigurationInsteadOfStrandingBusyUi() {
        for(deliver in listOf(true,false)) {
            val original=web;val callbacks=mutableListOf<android.webkit.ValueCallback<String>>()
            val fake=object : WebView(a) {
                override fun getUrl()="https://appassets.androidplatform.net/assets/web/index.html"
                override fun evaluateJavascript(script: String,callback: android.webkit.ValueCallback<String>?) {if(callback!=null) callbacks.add(callback)}
            }
            MainActivity::class.java.getDeclaredField("webView").apply {isAccessible=true}.set(a,fake)
            MainActivity::class.java.getDeclaredField("voiceHostTrusted").apply {isAccessible=true}.set(a,true)
            try {
                local<EditText>("draft").setText("KEEP_NATIVE_DRAFT");local<Button>("send").performClick()
                assertTrue(local<Boolean>("configuredPreparing"));assertEquals(1,callbacks.size)
                val epoch=MainActivity::class.java.getDeclaredField("hostPresentationEpoch").apply {isAccessible=true}
                epoch.setLong(a,epoch.getLong(a)+1)
                workspace.hostPresentationState(true,false)
                if(deliver) callbacks.single().onReceiveValue("null")
                else shadowOf(Looper.getMainLooper()).idleFor(1801,java.util.concurrent.TimeUnit.MILLISECONDS)
                assertFalse(local<Boolean>("configuredPreparing"));assertTrue(local<Button>("send").isEnabled)
                assertEquals("KEEP_NATIVE_DRAFT",local<EditText>("draft").text.toString());assertTrue(local<List<Any>>("timeline").isEmpty())
                callbacks.single().onReceiveValue("null");assertFalse(local<Boolean>("configuredPreparing"))
                assertFalse(local<Lazy<*>>("configuredTransport\$delegate").isInitialized())
            } finally {MainActivity::class.java.getDeclaredField("webView").apply {isAccessible=true}.set(a,original);fake.destroy()}
        }
    }
    @Test fun legacyHttpAndUnownedRecognizerCannotAcquireNativeResources() {
        MainActivity::class.java.getDeclaredField("voiceHostTrusted").apply {isAccessible=true}.set(a,true)
        val bridge=a.MayaBridge()
        bridge.httpPostAsync("invalid://retired","","{}","legacy_request",100)
        bridge.httpPostAsync("https://api.groq.com/openai/v1/chat/completions","","{}","ft_"+"a".repeat(32)+"_1",100)
        bridge.listenOwned("ur-PK","miabc_1");shadowOf(Looper.getMainLooper()).idle()
        assertTrue(field<Map<*,*>>("httpRequests").isEmpty());assertNull(field<Any?>("recognizer"));assertFalse(field<Boolean>("recognitionActive"))
        assertNull(field<Any?>("tts"));assertTrue(bridge.legacyRestricted())
    }
    @Test fun sensitivePreferencesCannotBeWrittenThroughTheNarrowBridge() {
        val bridge=a.MayaBridge()
        a.getSharedPreferences("maya",0).edit().putBoolean("wake",true).commit()
        assertFalse(bridge.wakeService(false))
        assertTrue(a.getSharedPreferences("maya",0).getBoolean("wake",false))
        bridge.setPref("trustMode",true);bridge.setPrefString("autosend_at","9999")
        bridge.setPrefString("key","private");bridge.clearPref("wake")
        val prefs=a.getSharedPreferences("maya",0)
        assertFalse(prefs.contains("trustMode"));assertFalse(prefs.contains("autosend_at"));assertFalse(prefs.contains("key"))
    }

    @Test fun mainWebViewRejectsArbitraryFilesFramesAndUngesturedExternalNavigation() {
        assertTrue(navigate(url="file:///sdcard/untrusted.html"))
        assertTrue(navigate(url="https://appassets.androidplatform.net/untrusted.html"))
        assertTrue(navigate(gesture=false,url="https://example.invalid/"))
        assertTrue(navigate(main=false,url="https://example.invalid/"))
        assertFalse(navigate(url="https://appassets.androidplatform.net/assets/web/index.html"))
        assertNull(shadowOf(a).nextStartedActivity)
        assertFalse(web.settings.allowUniversalAccessFromFileURLs);assertFalse(web.settings.allowFileAccessFromFileURLs)
        assertFalse(web.settings.allowContentAccess);assertFalse(web.settings.javaScriptCanOpenWindowsAutomatically)
    }

    @Test fun nativeWakeQuestionIsClaimedOnceAndDeliveredIntoTheSameApprovedSession() = withTalkHost {
        shadowOf(RuntimeEnvironment.getApplication()).grantPermissions(android.Manifest.permission.RECORD_AUDIO)
        button("Talk with Fish").performClick();positive();a.onWindowFocusChanged(true)
        val id=field<String?>("fishTalkId")!!
        MainActivity::class.java.getDeclaredField("fishTalkWakeMode").apply {isAccessible=true}.set(a,true)
        a.MayaBridge().fishTalkEvent(id,"state","wake-waiting");shadowOf(Looper.getMainLooper()).idle()
        val service=Robolectric.buildService(com.maya.ai.WakeWordService::class.java).get();a.bindWakeListener(service)
        a.deliverWakeResults(listOf("ambient noise"),20);assertFalse(field<Boolean>("wakeClaimed"))
        a.deliverWakeResults(listOf("Maya mera sawaal"),20);shadowOf(Looper.getMainLooper()).idle()
        assertTrue(field<Boolean>("wakeClaimed"));assertEquals(id,field<String?>("fishTalkId"))
        val wakeScripts=talkScripts.filter {it.contains("FISH_TALK.wake(")}
        assertEquals(1,wakeScripts.size);assertTrue(wakeScripts.single().contains("mera sawaal"))
        a.deliverWakeResults(listOf("Maya duplicate"),20);a.wakeListenerStopped(service);shadowOf(Looper.getMainLooper()).idle()
        assertEquals(1,talkScripts.count {it.contains("FISH_TALK.wake(")});assertEquals(id,field<String?>("fishTalkId"))
        assertFalse(local<Lazy<*>>("transport\$delegate").isInitialized())
    }
    @Test fun anOldWakeServiceCannotCancelANewerApprovedWakeOwner() = withTalkHost {
        shadowOf(RuntimeEnvironment.getApplication()).grantPermissions(android.Manifest.permission.RECORD_AUDIO)
        button("Talk with Fish").performClick();positive();a.onWindowFocusChanged(true)
        val id=field<String?>("fishTalkId")!!
        MainActivity::class.java.getDeclaredField("fishTalkWakeMode").apply {isAccessible=true}.set(a,true)
        val old=Robolectric.buildService(com.maya.ai.WakeWordService::class.java).get()
        val current=Robolectric.buildService(com.maya.ai.WakeWordService::class.java).get()
        a.bindWakeListener(current);a.wakeListenerStopped(old);assertEquals(id,field<String?>("fishTalkId"))
        a.wakeListenerStopped(current);assertNull(field<String?>("fishTalkId"));assertFalse(local<Boolean>("fishTalkBusy"))
    }

    @Test fun browserTaskUsesPermanentWorkspaceAndCannotRunBeforeSetupAndReview() {
        val surface=field<View>("nativeChatView")
        local<android.widget.Spinner>("modePicker").setSelection(1);shadowOf(Looper.getMainLooper()).idle()
        local<android.widget.Spinner>("agentKind").setSelection(2);shadowOf(Looper.getMainLooper()).idle()
        local<EditText>("draft").setText("OPEN https://en.wikipedia.org/wiki/Android\nSCROLL DOWN")
        local<Button>("send").performClick();shadowOf(Looper.getMainLooper()).idle()
        val tasks=local<List<com.maya.ai.agent.WorkspaceTask>>("agentCards")
        assertEquals(1,tasks.size);assertTrue(tasks[0] is com.maya.ai.agent.InlineBrowserNavigation)
        assertSame(surface,field<View>("nativeChatView"));assertFalse(tasks[0].approved);assertFalse(tasks[0].busy)
        assertFalse(button("Run approved browser plan").isEnabled)
        button("Review browser plan").performClick();assertFalse(tasks[0].approved)
        assertNull(shadowOf(a).nextStartedActivity);assertNull(com.maya.ai.agent.BrowserNavigationService.instance)
        assertFalse(local<Lazy<*>>("transport\$delegate").isInitialized())
        assertFalse(local<Lazy<*>>("configuredTransport\$delegate").isInitialized())
    }
    @Test fun whatsappTaskUsesPermanentWorkspaceAndCannotRunBeforeSetupAndReview() {
        val surface=field<View>("nativeChatView")
        local<android.widget.Spinner>("modePicker").setSelection(1);shadowOf(Looper.getMainLooper()).idle()
        local<android.widget.Spinner>("agentKind").setSelection(3);shadowOf(Looper.getMainLooper()).idle()
        local<EditText>("draft").setText("OPEN https://wa.me/923001234567\nTYPE Salam")
        local<Button>("send").performClick();shadowOf(Looper.getMainLooper()).idle()
        val tasks=local<List<com.maya.ai.agent.WorkspaceTask>>("agentCards")
        assertEquals(1,tasks.size);assertTrue(tasks[0] is com.maya.ai.agent.InlineWhatsAppType)
        assertSame(surface,field<View>("nativeChatView"));assertFalse(tasks[0].approved);assertFalse(tasks[0].busy)
        assertFalse(button("Run approved WhatsApp type").isEnabled)
        button("Review WhatsApp message").performClick();assertFalse(tasks[0].approved)
        assertNull(shadowOf(a).nextStartedActivity);assertNull(com.maya.ai.agent.WhatsAppTypeService.instance)
        assertFalse(local<Lazy<*>>("transport\$delegate").isInitialized())
        assertFalse(local<Lazy<*>>("configuredTransport\$delegate").isInitialized())
    }
    @Test fun voiceCommandButtonBuildsPrefilledWhatsappTask() {
        local<EditText>("draft").setText("923001234567 ko whatsapp karo ke kal milte hain")
        button("⚡ Task banao").performClick();shadowOf(Looper.getMainLooper()).idle()
        val tasks=local<List<com.maya.ai.agent.WorkspaceTask>>("agentCards")
        assertEquals(1,tasks.size);assertTrue(tasks[0] is com.maya.ai.agent.InlineWhatsAppType)
        val card=tasks[0] as com.maya.ai.agent.InlineWhatsAppType
        assertEquals("923001234567",card.view.findViewWithTag<EditText>("whatsapp_number").text.toString())
        assertEquals("kal milte hain",card.view.findViewWithTag<EditText>("whatsapp_message").text.toString())
        assertFalse(tasks[0].approved);assertFalse(tasks[0].busy)
        assertNull(com.maya.ai.agent.WhatsAppTypeService.instance)
        assertFalse(local<Lazy<*>>("transport\$delegate").isInitialized())
        assertFalse(local<Lazy<*>>("configuredTransport\$delegate").isInitialized())
    }
    @Test fun voiceCommandButtonRejectsNonCommandWithoutSlotUse() {
        local<EditText>("draft").setText("aaj mausam kaisa hai")
        button("⚡ Task banao").performClick();shadowOf(Looper.getMainLooper()).idle()
        assertTrue(local<List<com.maya.ai.agent.WorkspaceTask>>("agentCards").isEmpty())
        assertNull(com.maya.ai.agent.WhatsAppTypeService.instance)
    }
    @Test fun cloudflareIdentityPanelIsNotShownAndNormalConnectionHasNoEnableRoute() {
        assertTrue(local<Boolean>("useConfiguredChat"));assertFalse(local<Boolean>("cloudflareReviewed"))
        val panel=a.findViewById<ViewGroup>(android.R.id.content).findViewWithTag<View>("parked_cloudflare_controls")
        assertNotNull(panel);assertEquals(View.GONE,panel.visibility)
        button("AI connection").performClick()
        val message=ShadowAlertDialog.getLatestAlertDialog().findViewById<android.widget.TextView>(android.R.id.message).text.toString()
        assertTrue(message.contains("parked"));assertFalse(message.contains("Cloudflare setup controls"))
        ShadowAlertDialog.getLatestAlertDialog().getButton(DialogInterface.BUTTON_NEGATIVE).performClick()
        assertFalse(local<Lazy<*>>("transport\$delegate").isInitialized())
    }

}
