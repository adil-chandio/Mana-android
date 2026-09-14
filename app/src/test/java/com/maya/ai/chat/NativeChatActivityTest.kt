package com.maya.ai.chat

import android.content.ClipboardManager
import android.content.Context
import android.content.DialogInterface
import android.os.Bundle
import android.os.Looper
import android.os.Parcel
import android.os.SystemClock
import android.view.InputDevice
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.RadioButton
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.Shadows.shadowOf
import org.robolectric.android.controller.ActivityController
import org.robolectric.annotation.Config
import org.robolectric.annotation.LooperMode
import org.robolectric.RobolectricTestRunner
import org.robolectric.shadows.ShadowAlertDialog

/** Real Activity/widgets/lifecycle under Robolectric. No Keystore, HTTP or model execution.
 * Private job injection supplies synthetic completion events without shipping test bypasses.
 * These tests are NOT physical keyboard/overlay/OS or voice evidence.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28], qualifiers = "w360dp-h640dp-mdpi")
@LooperMode(LooperMode.Mode.PAUSED)
class NativeChatActivityTest {
    private var controller: ActivityController<NativeChatActivity>? = null
    private val activity get() = controller!!.get()
    private val workspace get() = NativeChatActivity::class.java.getDeclaredField("workspace").apply {isAccessible=true}.get(activity) as NativeChatWorkspace
    private val content get() = activity.findViewById<ViewGroup>(android.R.id.content)
    private inline fun <reified T> field(name: String): T = NativeChatWorkspace::class.java.getDeclaredField(name)
        .apply { isAccessible = true }.get(workspace) as T
    private fun setField(name: String, value: Any?) = NativeChatWorkspace::class.java.getDeclaredField(name)
        .apply { isAccessible = true }.set(workspace, value)
    private fun invoke(name: String) = NativeChatWorkspace::class.java.getDeclaredMethod(name)
        .apply { isAccessible = true }.invoke(workspace)
    private fun tab(name: String) = content.findViewWithTag<Button>(if(name=="chat") "details_close" else "details_$name")
    private fun openPage(name: String) {
        if(name=="chat") {if(field<Int>("section") in 1..3) workspace.requestClose();if(field<Int>("section")==4) workspace.requestClose();return}
        if(field<Int>("section") in 1..3) workspace.requestClose()
        if(field<Int>("section")==0) {
            if(content.findViewWithTag<View>("workspace_menu").visibility!=View.VISIBLE) content.findViewWithTag<Button>("workspace_menu_toggle").performClick()
            content.findViewWithTag<Button>("open_settings").performClick()
        }
        tab(name).performClick()
    }
    private fun page(name: String) = content.findViewWithTag<View>("${name}_page")
    private fun button(title: String): Button {
        fun find(view: View): Button? {
            if (view is Button && (view.text.toString() == title || view.contentDescription?.toString() == title)) return view
            if (view is ViewGroup) for (i in 0 until view.childCount) find(view.getChildAt(i))?.let { return it }
            return null
        }
        return find(content) ?: error("Missing fixed button")
    }
    private fun noTransport() {
        assertFalse(field<Lazy<*>>("transport\$delegate").isInitialized())
        assertNull(field<Any?>("publicText"))
    }
    @Before fun open() {
        controller = Robolectric.buildActivity(NativeChatActivity::class.java).setup().visible()
        activity.getSharedPreferences("maya", Context.MODE_PRIVATE).edit().clear().commit()
        field<NativeAccessDiagnostic>("accessDiagnostic").clear()
    }
    @After fun close() {
        controller?.pause()?.stop()?.destroy()
        controller = null
    }
    private fun fill() {
        field<EditText>("draft").setText("PRIVATE_SYNTHETIC_DRAFT")
        field<CheckBox>("consent").isChecked = true
    }
    private fun completedHistory() {
        val session = field<NativeChatConversation>("session")
        val turn = session.begin("SYNTHETIC_CONTEXT", true)
        session.complete(turn, "SYNTHETIC_REPLY")
        invoke("renderHistory")
    }
    private fun pending(): Any {
        val turn = field<NativeChatConversation>("session").begin("SYNTHETIC_PENDING", true)
        val jobType = Class.forName("com.maya.ai.chat.NativeChatWorkspace\$Job")
        val job = jobType.declaredConstructors.single { it.parameterTypes.size == 3 }
            .apply { isAccessible = true }.newInstance("chat", turn, SystemClock.elapsedRealtime())
        setField("active", job); invoke("paint")
        return job
    }
    private fun operation(job: Any) = job.javaClass.getDeclaredField("operation")
        .apply { isAccessible = true }.get(job) as NativeChatTransport.Operation
    private fun complete(job: Any, text: String = "SYNTHETIC_LATE_REPLY") {
        NativeChatWorkspace::class.java.getDeclaredMethod("finish", job.javaClass, Any::class.java, String::class.java)
            .apply { isAccessible = true }.invoke(workspace, job, NativeChatResponse.Result.Reply(text), null)
    }
    private fun cancelled(job: Any) {
        try { operation(job).check(); fail("Expected cancellation") }
        catch (e: NativeChatProtocol.Rejected) { assertEquals("STOPPED_LOCALLY", e.code) }
    }
    @Test fun opensChatWithNoAutomaticRequestOrKeyRead() {
        assertEquals(View.VISIBLE, page("chat").visibility)
        assertEquals(View.GONE, page("checks").visibility)
        assertEquals(View.GONE, page("info").visibility)
        assertFalse(field<Button>("send").isEnabled)
        assertFalse(field<Button>("stop").isEnabled)
        assertTrue(field<Button>("check").isEnabled)
        noTransport()
    }
    @Test fun disabledSendAndIdleStopHaveDistinctVisualStates() {
        for (name in listOf("send", "stop")) {
            val button = field<Button>(name)
            val enabled = intArrayOf(android.R.attr.state_enabled)
            assertNotEquals(button.textColors.defaultColor, button.textColors.getColorForState(enabled, 0))
            assertNotEquals(button.backgroundTintList!!.defaultColor, button.backgroundTintList!!.getColorForState(enabled, 0))
        }
        assertFalse(field<Button>("send").isEnabled)
        fill(); assertTrue(field<Button>("send").isEnabled)
        val job = pending(); assertTrue(field<Button>("stop").isEnabled)
        field<Button>("stop").performClick(); cancelled(job)
        assertFalse(field<Button>("stop").isEnabled); noTransport()
    }
    @Test fun dedicatedSettingsHideComposerButPreserveConversationAndContext() {
        completedHistory(); fill()
        for (name in listOf("checks", "info", "chat")) {
            openPage(name)
            assertEquals(View.VISIBLE, page(name).visibility)
            assertTrue(tab(name).isSelected)
            assertEquals(if(name=="chat") View.VISIBLE else View.GONE,page("chat").visibility)
            assertEquals(if(name=="chat") View.VISIBLE else View.GONE,content.findViewWithTag<View>("shared_composer_area").visibility)
            assertEquals("PRIVATE_SYNTHETIC_DRAFT", field<EditText>("draft").text.toString())
            assertTrue(field<CheckBox>("consent").isChecked)
            assertEquals(2, field<NativeChatConversation>("session").messages().size)
            assertFalse(field<NativeChatConversation>("session").busy)
        }
        assertTrue(field<Button>("send").isEnabled); noTransport()
    }
    @Test fun backCancelKeepsDataAndConfirmedExitClearsBeforeOnStop() {
        completedHistory(); fill(); activity.onBackPressed()
        val cancel = ShadowAlertDialog.getLatestAlertDialog()
        cancel.getButton(DialogInterface.BUTTON_NEGATIVE).performClick()
        shadowOf(Looper.getMainLooper()).idle()
        assertFalse(activity.isFinishing); assertTrue(field<CheckBox>("consent").isChecked)
        assertEquals(2, field<NativeChatConversation>("session").messages().size)
        activity.onBackPressed()
        ShadowAlertDialog.getLatestAlertDialog().getButton(DialogInterface.BUTTON_POSITIVE).performClick()
        shadowOf(Looper.getMainLooper()).idle()
        assertTrue(activity.isFinishing)
        assertEquals("", field<EditText>("draft").text.toString())
        assertFalse(field<CheckBox>("consent").isChecked)
        assertTrue(field<NativeChatConversation>("session").messages().isEmpty()); noTransport()
    }
    @Test fun stopOnAnyTabRejectsOldCompletionAndPreservesCompletedHistory() {
        completedHistory(); fill(); val job = pending()
        openPage("info"); field<Button>("stop").performClick()
        cancelled(job); complete(job)
        assertNull(field<Any?>("active"))
        assertEquals(2, field<NativeChatConversation>("session").messages().size)
        assertEquals("PRIVATE_SYNTHETIC_DRAFT", field<EditText>("draft").text.toString()); noTransport()
    }
    @Test fun oldCompletionCannotOverwriteNewTurn() {
        val old = pending(); field<Button>("stop").performClick()
        val current = pending(); complete(old)
        assertSame(current, field<Any>("active"))
        complete(current, "SYNTHETIC_CURRENT_REPLY")
        val history = field<NativeChatConversation>("session").messages()
        assertEquals(2, history.size); assertEquals("SYNTHETIC_CURRENT_REPLY", history.last().content)
        assertFalse(field<Button>("stop").isEnabled); noTransport()
    }
    @Test fun backgroundClearsSensitiveUiButKeepsFixedReadinessReport() {
        activity.getSharedPreferences("maya", Context.MODE_PRIVATE).edit().putBoolean("wake", true).commit()
        openPage("checks"); field<Button>("readinessButton").performClick()
        assertTrue(field<TextView>("readinessResult").text.contains("WAKE_ENABLED"))
        completedHistory(); fill(); val job = pending()
        controller!!.pause().stop()
        assertEquals("", field<EditText>("draft").text.toString())
        assertFalse(field<CheckBox>("consent").isChecked)
        assertTrue(field<NativeChatConversation>("session").messages().isEmpty())
        cancelled(job); complete(job)
        assertTrue(field<TextView>("readinessResult").text.contains("WAKE_ENABLED"))
        assertTrue(activity.getSharedPreferences("maya", Context.MODE_PRIVATE).getBoolean("wake", false))
        controller!!.restart().start().resume(); noTransport()
    }
    @Test fun destructionWithoutOnStopAlsoFencesPendingResults() {
        completedHistory(); fill(); val job = pending()
        controller!!.pause().destroy()
        cancelled(job); complete(job)
        assertNull(field<Any?>("active")); assertFalse(field<Boolean>("visible"))
        assertTrue(field<NativeChatConversation>("session").messages().isEmpty())
        assertEquals("", field<EditText>("draft").text.toString())
        noTransport(); controller = null
    }
    @Test fun explicitClearRequiresConfirmationAndNeverDeletesIdentity() {
        completedHistory(); fill(); button("Clear local chat").performClick()
        ShadowAlertDialog.getLatestAlertDialog().getButton(DialogInterface.BUTTON_NEGATIVE).performClick()
        shadowOf(Looper.getMainLooper()).idle()
        assertEquals(2, field<NativeChatConversation>("session").messages().size)
        button("Clear local chat").performClick()
        ShadowAlertDialog.getLatestAlertDialog().getButton(DialogInterface.BUTTON_POSITIVE).performClick()
        shadowOf(Looper.getMainLooper()).idle()
        assertTrue(field<NativeChatConversation>("session").messages().isEmpty())
        assertEquals("", field<EditText>("draft").text.toString())
        assertFalse(field<CheckBox>("consent").isChecked); noTransport()
    }
    @Test fun publicKeyConfirmationCancelDoesNotCreateOrReadKey() {
        openPage("checks"); field<Button>("create").performClick()
        ShadowAlertDialog.getLatestAlertDialog().getButton(DialogInterface.BUTTON_NEGATIVE).performClick()
        shadowOf(Looper.getMainLooper()).idle()
        assertNull(field<Any?>("active")); noTransport()
    }
    @Test fun readinessClipboardContainsFixedMetadataNotDraftOrHistory() {
        completedHistory(); fill(); openPage("checks"); button("Copy readiness report").performClick()
        val text = (activity.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager)
            .primaryClip!!.getItemAt(0).text.toString()
        assertTrue(text.contains("Last local readiness:"))
        assertFalse(text.contains("PRIVATE_SYNTHETIC")); assertFalse(text.contains("SYNTHETIC_CONTEXT"))
        noTransport()
    }
    @Test fun recreationAndSavedStateDoNotRestorePrivateDraftOrConsent() {
        completedHistory(); fill()
        val state = Bundle(); controller!!.saveInstanceState(state)
        val parcel = Parcel.obtain()
        try {
            parcel.writeBundle(state)
            assertFalse(String(parcel.marshall(), Charsets.UTF_16LE).contains("PRIVATE_SYNTHETIC_DRAFT"))
        } finally { parcel.recycle() }
        controller!!.recreate()
        assertEquals(View.VISIBLE, page("chat").visibility)
        assertEquals("", field<EditText>("draft").text.toString())
        assertFalse(field<CheckBox>("consent").isChecked)
        assertTrue(field<NativeChatConversation>("session").messages().isEmpty()); noTransport()
    }
    @Test fun obscuredAndPartiallyObscuredTouchesRemainBlockedOnAllTabs() {
        fill()
        for (name in listOf("chat", "checks", "info")) {
            openPage(name)
            for (flag in listOf(MotionEvent.FLAG_WINDOW_IS_OBSCURED, MotionEvent.FLAG_WINDOW_IS_PARTIALLY_OBSCURED)) {
                val prop = MotionEvent.PointerProperties().apply { id = 0; toolType = MotionEvent.TOOL_TYPE_FINGER }
                val coord = MotionEvent.PointerCoords().apply { x = 10f; y = 10f }
                val event = MotionEvent.obtain(0, 0, MotionEvent.ACTION_DOWN, 1, arrayOf(prop), arrayOf(coord),
                    0, 0, 1f, 1f, 0, 0, InputDevice.SOURCE_TOUCHSCREEN, flag)
                try { assertTrue(activity.dispatchTouchEvent(event)) } finally { event.recycle() }
                assertTrue(field<TextView>("touchWarning").text.contains("Touch blocked"))
                assertNull(field<Any?>("active"))
            }
        }
        noTransport()
    }
    @Test fun stopRemainsOutsideScrollingContentAtCompactSizes() {
        val shell = content.getChildAt(0) as ViewGroup
        val stop = field<Button>("stop")
        assertEquals(View.GONE,stop.visibility)
        fakeSpeech();field<Lazy<NativeReplySpeech>>("speech\$delegate").value.check()
        assertEquals(View.VISIBLE,stop.visibility)
        assertSame(shell, stop.parent)
        for (width in listOf(320, 360, 480)) for (height in listOf(320, 480, 640)) {
            shell.measure(View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY),
                View.MeasureSpec.makeMeasureSpec(height, View.MeasureSpec.EXACTLY))
            shell.layout(0, 0, width, height)
            assertTrue(stop.height >= 48); assertTrue(stop.top >= 0); assertTrue(stop.bottom <= height)
        }
        noTransport()
    }
    private class SpeechPort : NativeReplySpeech.Port {
        val requests = mutableListOf<Pair<String?, (NativeFishPolicy.Result) -> Unit>>()
        var plays = 0; var stops = 0
        var event: ((String, Int) -> Unit)? = null
        override fun prepare(text: String?, result: (NativeFishPolicy.Result) -> Unit) { requests.add(text to result) }
        override fun play(prepared: NativeFishPolicy.Result.Prepared, event: (String, Int) -> Unit): Boolean {
            plays++; this.event=event; return true
        }
        override fun stopOwned() { stops++ }
    }
    private fun fakeSpeech(): SpeechPort {
        val port = SpeechPort()
        val owner = NativeReplySpeech(port, { _, _ -> {} }, { code ->
            field<TextView>("speechStatus").text = code.name; invoke("paint")
        })
        setField("speech\$delegate", lazyOf(owner))
        return port
    }
    @Test fun sunaoIsReplyOnlyAndCancelDoesNotReadAnySettings() {
        val port = fakeSpeech()
        assertTrue(field<List<*>>("speechButtons").isEmpty())
        completedHistory()
        assertEquals(1,field<List<*>>("speechButtons").size)
        button("Sunao · selected Fish").performClick()
        assertEquals(0,port.requests.size)
        ShadowAlertDialog.getLatestAlertDialog().getButton(DialogInterface.BUTTON_NEGATIVE).performClick()
        shadowOf(Looper.getMainLooper()).idle()
        assertEquals(0,port.requests.size); noTransport()
    }
    @Test fun confirmedSunaoUsesOnlySelectedReplyAndStopFencesLatePreparation() {
        val port=fakeSpeech();completedHistory();fill()
        button("Sunao · selected Fish").performClick()
        ShadowAlertDialog.getLatestAlertDialog().getButton(DialogInterface.BUTTON_POSITIVE).performClick()
        shadowOf(Looper.getMainLooper()).idle()
        assertEquals("SYNTHETIC_REPLY",port.requests.single().first)
        assertTrue(field<Button>("stop").isEnabled); assertFalse(field<Button>("send").isEnabled)
        field<Button>("stop").performClick()
        port.requests.single().second(NativeFishPolicy.Result.Prepared("SYNTHETIC","SYNTHETIC"))
        assertEquals(0,port.plays);assertEquals(2,field<NativeChatConversation>("session").messages().size)
        assertEquals("PRIVATE_SYNTHETIC_DRAFT",field<EditText>("draft").text.toString());noTransport()
    }
    @Test fun backgroundStopsOnlyOwnedVoiceAndLateAudioDoesNotRestoreChat() {
        val port=fakeSpeech();completedHistory()
        button("Sunao · selected Fish").performClick()
        ShadowAlertDialog.getLatestAlertDialog().getButton(DialogInterface.BUTTON_POSITIVE).performClick()
        shadowOf(Looper.getMainLooper()).idle()
        port.requests.single().second(NativeFishPolicy.Result.Prepared("SYNTHETIC","SYNTHETIC"))
        assertEquals(1,port.plays)
        assertEquals(0,port.stops)
        controller!!.pause().stop();assertEquals(1,port.stops)
        port.event!!("done",200)
        assertTrue(field<NativeChatConversation>("session").messages().isEmpty())
        controller!!.restart().start().resume();noTransport()
    }
    @Test fun savedFishCheckWithoutOriginalMainFailsLocallyWithoutLaunchingIt() {
        openPage("checks");field<Button>("fishCheck").performClick()
        assertTrue(field<TextView>("speechStatus").text.contains("MAIN_REQUIRED"))
        assertNull(field<Any?>("speechPlayer"));noTransport()
    }
    @Test fun sampleAlsoRequiresSeparateConfirmationAndDoesNotSendDraft() {
        val port=fakeSpeech();fill();openPage("checks")
        field<Button>("fishSample").performClick();assertEquals(0,port.requests.size)
        ShadowAlertDialog.getLatestAlertDialog().getButton(DialogInterface.BUTTON_POSITIVE).performClick()
        shadowOf(Looper.getMainLooper()).idle()
        assertEquals("Salam, yeh aapki saved Fish voice ka chhota test hai.",port.requests.single().first)
        assertEquals(0,field<NativeChatConversation>("session").messages().size);noTransport()
    }

    @Test fun oldSpeechConfirmationCannotPlayAfterLeavingAndResuming() {
        val port=fakeSpeech();openPage("checks");field<Button>("fishSample").performClick()
        val old=ShadowAlertDialog.getLatestAlertDialog()
        controller!!.pause().stop().restart().start().resume()
        old.getButton(DialogInterface.BUTTON_POSITIVE).performClick();shadowOf(Looper.getMainLooper()).idle()
        assertEquals(0,port.requests.size);noTransport()
    }

    @Test fun fishReportCopiesOnlyFixedStateNotReplyDraftOrCredentials() {
        fakeSpeech();completedHistory();fill();openPage("checks");button("Copy Fish report").performClick()
        val text=(activity.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).primaryClip!!.getItemAt(0).text.toString()
        assertTrue(text.contains("Fish: IDLE"));assertFalse(text.contains("PRIVATE_SYNTHETIC"));assertFalse(text.contains("SYNTHETIC_REPLY"))
        noTransport()
    }

    private fun mode(agent: Boolean) {content.findViewWithTag<android.widget.Spinner>("mode_picker").setSelection(if(agent) 1 else 0);shadowOf(Looper.getMainLooper()).idle()}
    private class ResearchFake : com.maya.ai.agent.ResearchServices {
        val prompts=mutableListOf<String>()
        var completion: ((com.maya.ai.agent.ResearchSource?) -> Unit)?=null
        var model: ((String?,com.maya.ai.agent.ResearchBackend.TextFailure?) -> Unit)?=null
        var cancels=0
        override fun fetch(item: com.maya.ai.agent.ResearchPlan.Item,done: (com.maya.ai.agent.ResearchSource?) -> Unit): () -> Unit {completion=done;return {cancels++}}
        override fun text(prompt: String,done: (String?,com.maya.ai.agent.ResearchBackend.TextFailure?) -> Unit): () -> Unit {prompts.add(prompt);model=done;return {cancels++}}
    }
    private fun researchFake()=ResearchFake().also {setField("researchServices\$delegate",lazy<com.maya.ai.agent.ResearchServices> {it})}
    private fun submit(goal: String) {mode(true);field<EditText>("draft").setText(goal);field<Button>("send").performClick()}
    private fun yes() {ShadowAlertDialog.getLatestAlertDialog().getButton(DialogInterface.BUTTON_POSITIVE).performClick();shadowOf(Looper.getMainLooper()).idle()}
    @Test fun modeSwitchUsesSameComposerAndHistoryWithoutSendingOrLaunching() {
        val fake=researchFake();completedHistory();fill();val draft=field<EditText>("draft");val history=field<LinearLayout>("history")
        mode(true);assertSame(draft,field<EditText>("draft"));assertSame(history,field<LinearLayout>("history"))
        assertEquals("PRIVATE_SYNTHETIC_DRAFT",draft.text.toString());assertEquals(2,history.childCount-1)
        assertNull(content.findViewWithTag<View>("tab_agent"));assertNull(content.findViewWithTag<View>("research_goal"))
        assertTrue(fake.prompts.isEmpty());assertNull(shadowOf(activity).nextStartedActivity)
        mode(false);assertTrue(field<CheckBox>("consent").isChecked);noTransport()
    }
    @Test fun overlongAgentGoalIsNeverTruncatedOrSent() {
        val fake=researchFake();submit("x".repeat(401));assertEquals(401,field<EditText>("draft").text.length)
        assertTrue(field<List<Any>>("agentCards").isEmpty());assertTrue(fake.prompts.isEmpty());mode(false)
        assertEquals(401,field<EditText>("draft").text.length);noTransport()
    }
    @Test fun switchingModesStopsPendingChatAndFencesOldFishConfirmation() {
        val port=fakeSpeech();completedHistory();button("Sunao · selected Fish").performClick()
        val old=ShadowAlertDialog.getLatestAlertDialog();mode(true)
        old.getButton(DialogInterface.BUTTON_POSITIVE).performClick();shadowOf(Looper.getMainLooper()).idle();assertTrue(port.requests.isEmpty())
        mode(false);val job=pending();mode(true);assertNull(field<Any?>("active"));cancelled(job);complete(job,"STALE")
        assertEquals(2,field<NativeChatConversation>("session").messages().size);noTransport()
    }
    @Test fun privateDirectContextIsNotAutomaticallySentToAgent() {
        val fake=researchFake();completedHistory();fill();submit("RESEARCH_ONLY_GOAL");assertTrue(fake.prompts.isEmpty());yes()
        assertEquals(1,fake.prompts.size);assertTrue(fake.prompts.single().contains("RESEARCH_ONLY_GOAL"))
        assertFalse(fake.prompts.single().contains("SYNTHETIC_CONTEXT"));assertFalse(fake.prompts.single().contains("PRIVATE_SYNTHETIC_DRAFT"))
        mode(false);assertEquals(1,fake.cancels);fake.model!!("WIKI Cat",null)
        assertEquals("",content.findViewWithTag<EditText>("inline_plan").text.toString());noTransport()
    }
    @Test fun optionalDirectContextRequiresVisibleUncheckedSelectionAndIsBounded() {
        val fake=researchFake();completedHistory();submit("RESEARCH_ONLY_GOAL")
        val d=ShadowAlertDialog.getLatestAlertDialog()
        fun choice(v: View): CheckBox? {if(v is CheckBox) return v;if(v is ViewGroup) for(i in 0 until v.childCount) choice(v.getChildAt(i))?.let {return it};return null}
        val box=choice(d.window!!.decorView)!!;assertFalse(box.isChecked);box.performClick();yes()
        assertTrue(fake.prompts.single().contains("SYNTHETIC_CONTEXT"));assertTrue(fake.prompts.single().length<=2000);noTransport()
    }
    @Test fun mixedTimelineRetainsRealOrderAcrossModesWithoutAgentInDirectRequest() {
        researchFake();completedHistory();submit("WIKI Dog");mode(false)
        val session=field<NativeChatConversation>("session");val turn=session.begin("DIRECT_FOLLOWUP",true)
        assertFalse(turn.body.contains("WIKI Dog"));session.complete(turn,"DIRECT_REPLY");invoke("renderHistory")
        val entries=field<List<Any>>("timeline");assertEquals(5,entries.size)
        assertTrue(entries[2] is com.maya.ai.agent.InlineAgentTurn)
        assertEquals("DIRECT_FOLLOWUP",(entries[3] as NativeChatProtocol.Message).content)
        mode(true);assertEquals(5,field<List<Any>>("timeline").size);noTransport()
    }
    @Test fun taskCapDoesNotDiscardDraftOrCompletedTurns() {
        researchFake();repeat(3) {submit("WIKI Dog")};submit("WIKI Cat")
        assertEquals(3,field<List<Any>>("agentCards").size);assertEquals("WIKI Cat",field<EditText>("draft").text.toString());noTransport()
    }
    @Test fun modeChangeRevokesOldInlineConsentWithoutNetwork() {
        val fake=researchFake();submit("goal");val old=ShadowAlertDialog.getLatestAlertDialog();mode(false)
        old.getButton(DialogInterface.BUTTON_POSITIVE).performClick();shadowOf(Looper.getMainLooper()).idle();assertTrue(fake.prompts.isEmpty());noTransport()
    }
    @Test fun leavingClearsDirectAndAgentMemoryAndLateCallbacks() {
        val fake=researchFake();completedHistory();submit("goal");yes()
        val card=field<List<com.maya.ai.agent.InlineAgentTurn>>("agentCards").single()
        controller!!.pause().stop().restart().start().resume();fake.model!!("WIKI Cat",null)
        assertTrue(field<List<Any>>("timeline").isEmpty());assertTrue(field<List<Any>>("agentCards").isEmpty());assertEquals("",card.goal)
        assertEquals(0,card.view.childCount);assertTrue(field<NativeChatConversation>("session").messages().isEmpty())
        assertEquals("",field<EditText>("draft").text.toString());assertFalse(field<CheckBox>("consent").isChecked);noTransport()
    }
    @Test fun inlineExplanationUsesSameExplicitSelectedFishOwnerAndStop() {
        val port=fakeSpeech();val fake=researchFake();submit("WIKI Dog")
        button("Chrome").performClick();button("Review & approve plan").performClick();yes()
        button("Run approved plan").performClick();shadowOf(Looper.getMainLooper()).idleFor(java.time.Duration.ofMillis(650))
        fake.completion!!(com.maya.ai.agent.ResearchSource("https://en.wikipedia.org/wiki/Dog","SYNTHETIC_EXCERPT"))
        button("Explain sources · AI consent").performClick();yes();fake.model!!("AGENT_EXPLANATION",null)
        assertTrue(port.requests.isEmpty());button("Sunao · Agent explanation").performClick();assertTrue(port.requests.isEmpty());yes()
        assertEquals("AGENT_EXPLANATION",port.requests.single().first);field<Button>("stop").performClick()
        port.requests.single().second(NativeFishPolicy.Result.Prepared("SYNTHETIC","SYNTHETIC"));assertEquals(0,port.plays);noTransport()
    }

    @Test fun sharedComposerAndStopRemainReachableInBothModesAtCompactSize() {
        val surface=content.getChildAt(0) as ViewGroup
        for(agent in listOf(false,true)) {
            mode(agent);field<EditText>("draft").setText("x".repeat(401))
            surface.measure(View.MeasureSpec.makeMeasureSpec(320,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(320,View.MeasureSpec.EXACTLY))
            surface.layout(0,0,320,320)
            val draft=field<EditText>("draft");val box=android.graphics.Rect();draft.getDrawingRect(box);surface.offsetDescendantRectToMyCoords(draft,box)
            assertTrue(draft.height>=48);assertTrue(box.top>=0);assertTrue(box.bottom<=320)
            assertTrue(field<android.widget.Spinner>("modePicker").height>=48);assertEquals(View.GONE,field<Button>("stop").visibility)
        }
        noTransport()
    }

    @Test fun quietEntryAndDedicatedPrivacyRevocationKeepConversation() {
        val menu=content.findViewWithTag<View>("workspace_menu")
        assertEquals(View.GONE,menu.visibility);assertEquals(View.VISIBLE,content.findViewWithTag<View>("empty_state").visibility)
        assertEquals(View.GONE,field<TextView>("status").visibility);assertEquals(View.GONE,field<TextView>("counter").visibility)
        val composer=field<EditText>("draft");fill()
        assertEquals(View.GONE,field<CheckBox>("consent").visibility)
        content.findViewWithTag<Button>("workspace_menu_toggle").performClick();assertEquals(View.VISIBLE,menu.visibility)
        openPage("info");assertEquals(View.GONE,menu.visibility);assertFalse(composer.isShown)
        val job=pending();button("Revoke Direct consent").performClick();cancelled(job)
        assertFalse(field<CheckBox>("consent").isChecked);assertEquals(View.VISIBLE,field<CheckBox>("consent").visibility)
        assertFalse(field<Button>("send").isEnabled);assertEquals("PRIVATE_SYNTHETIC_DRAFT",composer.text.toString());noTransport()
    }
    @Test fun errorsAndUncertaintyReappearWithoutAnotherPaint() {
        val status=field<TextView>("status");assertEquals(View.GONE,status.visibility)
        status.text="Agent goal needs fewer characters. Nothing sent.";assertEquals(View.VISIBLE,status.visibility)
        status.text="Mode changed; stopped. Remote outcome uncertain.";assertEquals(View.VISIBLE,status.visibility)
        val full="Error details\nline two\nline three\nline four"
        status.text=full;assertEquals(3,status.maxLines);status.performClick();assertEquals(Int.MAX_VALUE,status.maxLines)
        assertEquals(full,status.text.toString());assertNull(status.contentDescription);status.performClick();assertEquals(3,status.maxLines)
        val warning=field<TextView>("touchWarning");warning.text="Touch blocked";assertEquals(View.VISIBLE,warning.visibility);noTransport()
    }
    @Test fun replyCopyIsExplicitAndDoesNotStartVoiceOrTransport() {
        val clipboard=activity.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        clipboard.setPrimaryClip(android.content.ClipData.newPlainText("sentinel","UNCHANGED"))
        val port=fakeSpeech();completedHistory()
        assertEquals("UNCHANGED",clipboard.primaryClip!!.getItemAt(0).text.toString())
        button("Copy reply").performClick()
        assertEquals("SYNTHETIC_REPLY",clipboard.primaryClip!!.getItemAt(0).text.toString())
        assertTrue(clipboard.primaryClip!!.description.extras!!.getBoolean("android.content.extra.IS_SENSITIVE"))
        assertTrue(port.requests.isEmpty());assertEquals(View.GONE,content.findViewWithTag<View>("empty_state").visibility);noTransport()
    }
    @Test fun compactComposerWithLargeTextAndActiveStopHasNoOverlap() {
        val config=android.content.res.Configuration(activity.resources.configuration);config.fontScale=1.5f
        activity.resources.updateConfiguration(config,activity.resources.displayMetrics)
        // Recreate widgets with the changed font scale, not merely change the test assertion.
        controller!!.recreate();shadowOf(Looper.getMainLooper()).idle()
        mode(true);field<EditText>("draft").setText("Keep this draft")
        val job=pending();val surface=content.getChildAt(0) as ViewGroup
        surface.measure(View.MeasureSpec.makeMeasureSpec(320,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(320,View.MeasureSpec.EXACTLY));surface.layout(0,0,320,320)
        fun bounds(view: View)=android.graphics.Rect().also {view.getDrawingRect(it);surface.offsetDescendantRectToMyCoords(view,it)}
        val input=bounds(field<EditText>("draft"));val stop=bounds(field<Button>("stop"));val send=bounds(field<Button>("send"))
        assertTrue(input.top>=0);assertFalse(android.graphics.Rect.intersects(input,stop));assertTrue(stop.bottom<=320);assertTrue(stop.width()>=48);assertTrue(stop.height()>=48)
        assertFalse(android.graphics.Rect.intersects(send,stop));assertEquals(View.VISIBLE,field<Button>("stop").visibility)
        field<Button>("stop").performClick();cancelled(job);noTransport()
    }
    @Test fun paletteAndPrimaryLabelsHaveReadableContrast() {
        assertTrue(androidx.core.graphics.ColorUtils.calculateContrast(MayaTheme.text,MayaTheme.background)>=7.0)
        assertTrue(androidx.core.graphics.ColorUtils.calculateContrast(MayaTheme.muted,MayaTheme.surface)>=4.5)
        assertTrue(androidx.core.graphics.ColorUtils.calculateContrast(MayaTheme.ink,MayaTheme.copper)>=4.5)
        assertTrue(androidx.core.graphics.ColorUtils.calculateContrast(MayaTheme.danger,android.graphics.Color.rgb(65,37,40))>=4.5)
    }

    @Test fun selectorsGetAnUnbrokenRowSeparateFromSendAndStop() {
        mode(true);val surface=content.getChildAt(0) as ViewGroup
        surface.measure(View.MeasureSpec.makeMeasureSpec(320,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(480,View.MeasureSpec.EXACTLY));surface.layout(0,0,320,480)
        val mode=field<android.widget.Spinner>("modePicker");val kind=field<android.widget.Spinner>("agentKind")
        assertEquals(0,mode.paddingLeft);assertEquals(0,kind.paddingRight)
        assertTrue(mode.width>=128);assertTrue(kind.width>=128)
        assertNotSame(mode.parent,field<Button>("send").parent)
        val selected=kind.selectedView as TextView;assertEquals(1,selected.maxLines)
        assertEquals("Research ▾",selected.text.toString());noTransport()
    }
    @Test fun settingsBackClosesDestinationWithoutFinishingOrClearingDraft() {
        fill();openPage("info");workspace.requestClose()
        assertEquals(4,field<Int>("section"));assertFalse(field<EditText>("draft").isShown)
        workspace.requestClose();assertEquals(0,field<Int>("section"));assertTrue(field<EditText>("draft").isShown)
        assertEquals("PRIVATE_SYNTHETIC_DRAFT",field<EditText>("draft").text.toString());assertFalse(activity.isFinishing);noTransport()
    }

    @Test fun dedicatedSettingsStopsOwnedSpeechButDoesNotClearCompletedConversation() {
        val port=fakeSpeech();completedHistory();fill()
        button("Sunao · selected Fish").performClick()
        ShadowAlertDialog.getLatestAlertDialog().getButton(DialogInterface.BUTTON_POSITIVE).performClick();shadowOf(Looper.getMainLooper()).idle()
        port.requests.single().second(NativeFishPolicy.Result.Prepared("SYNTHETIC","SYNTHETIC"))
        assertEquals(1,port.plays);openPage("checks");assertEquals(1,port.stops)
        port.event!!("done",200)
        assertEquals(2,field<NativeChatConversation>("session").messages().size)
        assertEquals("PRIVATE_SYNTHETIC_DRAFT",field<EditText>("draft").text.toString())
        openPage("chat");assertEquals(1,port.stops);noTransport()
    }

    private fun pendingWithCard(): Any {
        val job=pending()
        NativeChatWorkspace::class.java.getDeclaredMethod("attachAttempt",job.javaClass).apply {isAccessible=true}.invoke(workspace,job)
        return job
    }
    private fun yesDialog() {ShadowAlertDialog.getLatestAlertDialog().getButton(DialogInterface.BUTTON_POSITIVE).performClick();shadowOf(Looper.getMainLooper()).idle()}
    @Test fun contextReviewShowsOnlyCandidateDirectMessagesWithoutConsentOrTransport() {
        completedHistory();field<EditText>("draft").setText("CURRENT_DRAFT")
        assertFalse(field<CheckBox>("consent").isChecked)
        button("Review Direct context").performClick()
        val d=ShadowAlertDialog.getLatestAlertDialog();val text=d.findViewWithTagForTest("direct_context_snapshot")
        assertTrue(text.contains("SYNTHETIC_CONTEXT"));assertTrue(text.contains("SYNTHETIC_REPLY"));assertTrue(text.contains("CURRENT_DRAFT"))
        assertFalse(field<NativeChatConversation>("session").busy);assertFalse(field<CheckBox>("consent").isChecked)
        yesDialog();assertFalse(field<Button>("send").isEnabled);noTransport()
    }
    private fun android.app.AlertDialog.findViewWithTagForTest(tag: String): String = window!!.decorView.findViewWithTag<TextView>(tag).text.toString()
    @Test fun blockedSendHasInlineRecoveryButNeverEntersAiContext() {
        activity.getSharedPreferences("maya",Context.MODE_PRIVATE).edit().putBoolean("wake",true).commit()
        fill();field<Button>("send").performClick()
        assertNotNull(content.findViewWithTag<View>("chat_attempt"))
        assertTrue(content.findViewWithTag<TextView>("attempt_status").text.contains("No model request was sent"))
        val session=field<NativeChatConversation>("session");assertTrue(session.messages().isEmpty())
        assertEquals(listOf("fresh draft"),session.review("fresh draft").map {it.content})
        field<EditText>("draft").setText("KEEP_NEW_DRAFT");button("Restore draft").performClick()
        ShadowAlertDialog.getLatestAlertDialog().getButton(DialogInterface.BUTTON_NEGATIVE).performClick();shadowOf(Looper.getMainLooper()).idle()
        assertEquals("KEEP_NEW_DRAFT",field<EditText>("draft").text.toString())
        button("Restore draft").performClick();yesDialog()
        assertEquals("PRIVATE_SYNTHETIC_DRAFT",field<EditText>("draft").text.toString());assertFalse(session.busy);noTransport()
    }
    @Test fun acceptedReplyReplacesPendingCardWithoutDuplicateMessage() {
        val job=pendingWithCard();assertNotNull(content.findViewWithTag<View>("chat_attempt"))
        complete(job)
        assertNull(content.findViewWithTag<View>("chat_attempt"));assertEquals(2,field<NativeChatConversation>("session").messages().size)
        assertEquals(3,field<LinearLayout>("history").childCount);noTransport()
    }
    @Test fun stoppedAttemptRemainsLocalAndStaleCompletionCannotReviveIt() {
        val job=pendingWithCard();field<Button>("stop").performClick();cancelled(job);complete(job)
        assertNotNull(content.findViewWithTag<View>("chat_attempt"));assertTrue(field<NativeChatConversation>("session").messages().isEmpty())
        field<EditText>("draft").setText("");button("Restore draft").performClick()
        assertEquals("SYNTHETIC_PENDING",field<EditText>("draft").text.toString());assertNull(field<Any?>("active"));noTransport()
    }
    @Test fun dismissIsConfirmedAndKeepsDraftAndCompletedContext() {
        completedHistory();val job=pendingWithCard();field<Button>("stop").performClick();fill()
        button("Dismiss attempt").performClick();assertNotNull(content.findViewWithTag<View>("chat_attempt"));yesDialog()
        assertNull(content.findViewWithTag<View>("chat_attempt"));assertEquals(2,field<NativeChatConversation>("session").messages().size)
        assertEquals("PRIVATE_SYNTHETIC_DRAFT",field<EditText>("draft").text.toString());cancelled(job);noTransport()
    }
    @Test fun attemptCapDoesNotSilentlyEvictOrSendAndBackgroundClearsAll() {
        activity.getSharedPreferences("maya",Context.MODE_PRIVATE).edit().putBoolean("wake",true).commit()
        repeat(6) {fill();field<Button>("send").performClick()}
        assertEquals(6,field<LinearLayout>("history").childCount)
        field<Button>("send").performClick();assertTrue(field<TextView>("status").text.contains("Six local attempt cards"))
        assertEquals(6,field<LinearLayout>("history").childCount)
        controller!!.pause().stop();assertEquals(0,field<LinearLayout>("history").childCount);assertTrue(field<List<Any>>("timeline").isEmpty());noTransport()
    }
    @Test fun staleRestoreConfirmationCannotOverwriteAnotherDraftOrSend() {
        val job=pendingWithCard();field<Button>("stop").performClick();field<EditText>("draft").setText("original")
        button("Restore draft").performClick();val old=ShadowAlertDialog.getLatestAlertDialog()
        field<EditText>("draft").setText("changed after confirmation opened")
        old.getButton(DialogInterface.BUTTON_POSITIVE).performClick();shadowOf(Looper.getMainLooper()).idle()
        assertEquals("changed after confirmation opened",field<EditText>("draft").text.toString());cancelled(job);noTransport()
    }

    @Test fun readingOlderMessagesDoesNotForceJumpOnNewReply() {
        completedHistory();val job=pending();setField("followLatest",false);complete(job)
        assertEquals(View.VISIBLE,content.findViewWithTag<Button>("latest_response").visibility)
        content.findViewWithTag<Button>("latest_response").performClick();assertEquals(View.GONE,content.findViewWithTag<Button>("latest_response").visibility)
        assertTrue(field<Boolean>("followLatest"));noTransport()
    }
    @Test fun followingLatestKeepsJumpControlHiddenAndClearResetsIt() {
        val job=pending();setField("followLatest",true);complete(job)
        assertEquals(View.GONE,content.findViewWithTag<Button>("latest_response").visibility)
        controller!!.pause().stop();assertTrue(field<Boolean>("followLatest"));noTransport()
    }

    @Test fun compatibilityDictationNeverRequestsMicOrLaunchesMain() {
        val port=AndroidDictationPort(activity);var result: NativeDictation.State?=null
        port.check("ur-PK",true) {result=it};assertEquals(NativeDictation.State.MAIN_REQUIRED,result)
        port.requestPermission();assertNull(shadowOf(activity).nextStartedActivity);noTransport()
    }

}
