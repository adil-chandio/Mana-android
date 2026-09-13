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
import android.widget.TextView
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
    private val content get() = activity.findViewById<ViewGroup>(android.R.id.content)
    private inline fun <reified T> field(name: String): T = NativeChatActivity::class.java.getDeclaredField(name)
        .apply { isAccessible = true }.get(activity) as T
    private fun setField(name: String, value: Any?) = NativeChatActivity::class.java.getDeclaredField(name)
        .apply { isAccessible = true }.set(activity, value)
    private fun invoke(name: String) = NativeChatActivity::class.java.getDeclaredMethod(name)
        .apply { isAccessible = true }.invoke(activity)
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
        val jobType = Class.forName("com.maya.ai.chat.NativeChatActivity\$Job")
        val job = jobType.declaredConstructors.single { it.parameterTypes.size == 3 }
            .apply { isAccessible = true }.newInstance("chat", turn, SystemClock.elapsedRealtime())
        setField("active", job); invoke("paint")
        return job
    }
    private fun operation(job: Any) = job.javaClass.getDeclaredField("operation")
        .apply { isAccessible = true }.get(job) as NativeChatTransport.Operation
    private fun complete(job: Any, text: String = "SYNTHETIC_LATE_REPLY") {
        NativeChatActivity::class.java.getDeclaredMethod("finish", job.javaClass, Any::class.java, String::class.java)
            .apply { isAccessible = true }.invoke(activity, job, NativeChatResponse.Result.Reply(text), null)
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

    @Test fun agentNavigationRequiresConfirmationAndClearsPrivateChatBeforeLaunching() {
        completedHistory();fill();tab("info").performClick()
        button("Open Agent workspace · local pilot").performClick()
        assertNull(shadowOf(activity).nextStartedActivity)
        assertEquals(2,field<NativeChatConversation>("session").messages().size)
        ShadowAlertDialog.getLatestAlertDialog().getButton(DialogInterface.BUTTON_POSITIVE).performClick()
        shadowOf(Looper.getMainLooper()).idle()
        assertEquals("com.maya.ai.agent.AgentActivity",shadowOf(activity).nextStartedActivity.component!!.className)
        assertTrue(field<NativeChatConversation>("session").messages().isEmpty())
        assertEquals("",field<EditText>("draft").text.toString());assertFalse(field<CheckBox>("consent").isChecked)
        noTransport()
    }

}
