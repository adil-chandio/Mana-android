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
    private fun tab(name: String) = content.findViewWithTag<Button>("tab_$name")
    private fun page(name: String) = content.findViewWithTag<View>("${name}_page")
    private fun button(title: String): Button {
        fun find(view: View): Button? {
            if (view is Button && view.text.toString() == title) return view
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
    @Test fun tabsPreserveDraftConsentAndCompletedContextWithoutSending() {
        completedHistory(); fill()
        for (name in listOf("checks", "info", "chat")) {
            tab(name).performClick()
            assertEquals(View.VISIBLE, page(name).visibility)
            assertTrue(tab(name).isSelected)
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
        tab("info").performClick(); field<Button>("stop").performClick()
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
        tab("checks").performClick(); field<Button>("readinessButton").performClick()
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
        tab("checks").performClick(); field<Button>("create").performClick()
        ShadowAlertDialog.getLatestAlertDialog().getButton(DialogInterface.BUTTON_NEGATIVE).performClick()
        shadowOf(Looper.getMainLooper()).idle()
        assertNull(field<Any?>("active")); noTransport()
    }
    @Test fun readinessClipboardContainsFixedMetadataNotDraftOrHistory() {
        completedHistory(); fill(); tab("checks").performClick(); button("Copy readiness report").performClick()
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
            tab(name).performClick()
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
        tab("checks").performClick();assertEquals(0,port.stops)
        controller!!.pause().stop();assertEquals(1,port.stops)
        port.event!!("done",200)
        assertTrue(field<NativeChatConversation>("session").messages().isEmpty())
        controller!!.restart().start().resume();noTransport()
    }
    @Test fun savedFishCheckWithoutOriginalMainFailsLocallyWithoutLaunchingIt() {
        tab("checks").performClick();field<Button>("fishCheck").performClick()
        assertTrue(field<TextView>("speechStatus").text.contains("MAIN_REQUIRED"))
        assertNull(field<Any?>("speechPlayer"));noTransport()
    }
    @Test fun sampleAlsoRequiresSeparateConfirmationAndDoesNotSendDraft() {
        val port=fakeSpeech();fill();tab("checks").performClick()
        field<Button>("fishSample").performClick();assertEquals(0,port.requests.size)
        ShadowAlertDialog.getLatestAlertDialog().getButton(DialogInterface.BUTTON_POSITIVE).performClick()
        shadowOf(Looper.getMainLooper()).idle()
        assertEquals("Salam, yeh aapki saved Fish voice ka chhota test hai.",port.requests.single().first)
        assertEquals(0,field<NativeChatConversation>("session").messages().size);noTransport()
    }

    @Test fun oldSpeechConfirmationCannotPlayAfterLeavingAndResuming() {
        val port=fakeSpeech();tab("checks").performClick();field<Button>("fishSample").performClick()
        val old=ShadowAlertDialog.getLatestAlertDialog()
        controller!!.pause().stop().restart().start().resume()
        old.getButton(DialogInterface.BUTTON_POSITIVE).performClick();shadowOf(Looper.getMainLooper()).idle()
        assertEquals(0,port.requests.size);noTransport()
    }

    @Test fun fishReportCopiesOnlyFixedStateNotReplyDraftOrCredentials() {
        fakeSpeech();completedHistory();fill();tab("checks").performClick();button("Copy Fish report").performClick()
        val text=(activity.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).primaryClip!!.getItemAt(0).text.toString()
        assertTrue(text.contains("Fish: IDLE"));assertFalse(text.contains("PRIVATE_SYNTHETIC"));assertFalse(text.contains("SYNTHETIC_REPLY"))
        noTransport()
    }

    private fun mode(agent: Boolean) {content.findViewWithTag<RadioButton>(if(agent) "mode_agent" else "mode_direct").performClick()}
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
            assertTrue(draft.height>=48);assertTrue(box.top>=0);assertTrue(box.bottom<=field<Button>("stop").top)
            assertTrue(field<RadioButton>("agentMode").height>=48);assertTrue(field<Button>("stop").bottom<=320)
        }
        noTransport()
    }

}
