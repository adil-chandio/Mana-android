package com.maya.ai.agent

import android.content.DialogInterface
import android.os.Looper
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import org.junit.After
import org.junit.Before
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.android.controller.ActivityController
import org.robolectric.annotation.Config
import org.robolectric.annotation.LooperMode
import org.robolectric.shadows.ShadowAlertDialog
import java.time.Duration

@RunWith(RobolectricTestRunner::class)
@Config(sdk=[28])
@LooperMode(LooperMode.Mode.PAUSED)
class AgentActivityTest {
    private lateinit var c: ActivityController<AgentActivity>
    private val a get()=c.get()
    private inline fun <reified T> field(name: String): T = AgentActivity::class.java.getDeclaredField(name).apply { isAccessible=true }.get(a) as T
    private fun button(title: String): Button {
        fun find(v: View): Button? {
            if (v is Button && v.text.toString()==title) return v
            if (v is ViewGroup) for(i in 0 until v.childCount) find(v.getChildAt(i))?.let { return it }
            return null
        }
        return find(a.findViewById(android.R.id.content))!!
    }
    @Before fun open() { c=Robolectric.buildActivity(AgentActivity::class.java).setup().visible() }
    @After fun close() { c.pause().stop().destroy() }
    private fun loadAndApprove() {
        button("Load local example · no actions").performClick()
        button("Review & approve plan").performClick()
        ShadowAlertDialog.getLatestAlertDialog().getButton(DialogInterface.BUTTON_POSITIVE).performClick()
        shadowOf(Looper.getMainLooper()).idle()
    }
    @Test fun opensIdleWithoutLoadingOrRunningAnyPlan() {
        assertEquals("",field<EditText>("plan").text.toString())
        assertFalse(field<Button>("run").isEnabled);assertEquals("",field<EditText>("lab").text.toString())
        assertTrue(field<TextView>("result").text.contains("IDLE"))
    }
    @Test fun approvedPlanRunsInLocalFieldOnlyAndEvidenceIsVisible() {
        loadAndApprove();assertTrue(field<Button>("run").isEnabled);assertEquals("",field<EditText>("lab").text.toString())
        // A real ACTION_DOWN must not revoke approval before Run can be tapped.
        val e=MotionEvent.obtain(0,0,MotionEvent.ACTION_DOWN,0f,0f,0)
        try { a.dispatchTouchEvent(e) } finally { e.recycle() }
        assertTrue(field<Button>("run").isEnabled)
        field<Button>("run").performClick();shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(3))
        assertTrue(field<TextView>("result").text.contains("COMPLETED"))
        assertEquals("",field<EditText>("lab").text.toString());assertFalse(field<Button>("run").isEnabled)
    }
    @Test fun editingAfterApprovalRevokesRun() {
        loadAndApprove();field<EditText>("plan").setText("SET changed")
        assertFalse(field<Button>("run").isEnabled);assertTrue(field<TextView>("result").text.contains("PLAN_CHANGED"))
    }
    @Test fun touchDuringRunStopsBeforeFirstStep() {
        loadAndApprove();field<Button>("run").performClick()
        val e=MotionEvent.obtain(0,0,MotionEvent.ACTION_DOWN,0f,0f,0)
        try { a.dispatchTouchEvent(e) } finally { e.recycle() }
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(4))
        assertEquals("",field<EditText>("lab").text.toString());assertTrue(field<TextView>("result").text.contains("STOPPED"))
    }
    @Test fun leavingClearsPlanAndDraftAndOldConfirmationCannotApprove() {
        button("Load local example · no actions").performClick();button("Review & approve plan").performClick()
        val old=ShadowAlertDialog.getLatestAlertDialog()
        c.pause().stop().restart().start().resume()
        old.getButton(DialogInterface.BUTTON_POSITIVE).performClick();shadowOf(Looper.getMainLooper()).idle()
        assertEquals("",field<EditText>("plan").text.toString());assertFalse(field<Button>("run").isEnabled)
    }
    @Test fun cancelApprovalAndStopButtonNeverRunUnapprovedSteps() {
        button("Load local example · no actions").performClick();button("Review & approve plan").performClick()
        ShadowAlertDialog.getLatestAlertDialog().getButton(DialogInterface.BUTTON_NEGATIVE).performClick()
        shadowOf(Looper.getMainLooper()).idle();assertFalse(field<Button>("run").isEnabled)
        loadAndApprove();field<Button>("run").performClick();field<Button>("stop").performClick()
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(3));assertEquals("",field<EditText>("lab").text.toString())
    }
    @Test fun focusLossCancelsWithoutAutoResume() {
        loadAndApprove();field<Button>("run").performClick();a.onWindowFocusChanged(false);a.onWindowFocusChanged(true)
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(4))
        assertEquals("",field<EditText>("lab").text.toString());assertFalse(field<Button>("run").isEnabled)
        assertTrue(field<TextView>("result").text.contains("STOPPED"))
    }
}
