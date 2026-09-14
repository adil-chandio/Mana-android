package com.maya.ai.agent

import android.content.*
import android.content.pm.ActivityInfo
import android.content.pm.ResolveInfo
import android.net.Uri
import android.os.Looper
import android.view.*
import android.widget.*
import com.maya.ai.chat.NativeChatWorkspace
import org.junit.*
import org.junit.Assert.*
import org.junit.runner.RunWith
import org.robolectric.*
import org.robolectric.Shadows.shadowOf
import org.robolectric.android.controller.ActivityController
import org.robolectric.annotation.*
import org.robolectric.shadows.ShadowAlertDialog
import java.time.Duration

/** Compatibility entry is the same conversation in Agent mode. All services are synthetic. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk=[28])
@LooperMode(LooperMode.Mode.PAUSED)
class ResearchActivityTest {
    private lateinit var c: ActivityController<ResearchActivity>
    private val a get()=c.get()
    private lateinit var fake: Fake
    private class Fake : ResearchServices {
        val gets=mutableListOf<Pair<ResearchPlan.Item,(ResearchSource?) -> Unit>>()
        val texts=mutableListOf<Pair<String,(String?,ResearchBackend.TextFailure?) -> Unit>>()
        var cancels=0
        override fun fetch(item: ResearchPlan.Item,done: (ResearchSource?) -> Unit): () -> Unit {gets.add(item to done);return {cancels++}}
        override fun text(prompt: String,done: (String?,ResearchBackend.TextFailure?) -> Unit): () -> Unit {texts.add(prompt to done);return {cancels++}}
        fun source(i: Int) {val t=gets[i];t.second(ResearchSource(t.first.pageUrl,"SYNTHETIC_EXCERPT"))}
    }
    private val workspace get()=ResearchActivity::class.java.getDeclaredField("workspace").apply {isAccessible=true}.get(a) as NativeChatWorkspace
    private inline fun <reified T> field(name: String): T=NativeChatWorkspace::class.java.getDeclaredField(name).apply {isAccessible=true}.get(workspace) as T
    private val card get()=field<List<InlineAgentTurn>>("agentCards").last()
    private inline fun <reified T> turnField(name: String): T=InlineAgentTurn::class.java.getDeclaredField(name).apply {isAccessible=true}.get(card) as T
    private fun find(title: String): TextView {
        fun f(v: View): TextView? {if(v is TextView && v.text.toString()==title) return v;if(v is ViewGroup) for(i in 0 until v.childCount) f(v.getChildAt(i))?.let {return it};return null}
        return f(a.findViewById(android.R.id.content)) ?: error("Missing $title")
    }
    private fun confirm() {ShadowAlertDialog.getLatestAlertDialog().getButton(DialogInterface.BUTTON_POSITIVE).performClick();shadowOf(Looper.getMainLooper()).idle()}
    @Before fun open() {
        c=Robolectric.buildActivity(ResearchActivity::class.java).setup().visible();fake=Fake()
        NativeChatWorkspace::class.java.getDeclaredField("researchServices\$delegate").apply {isAccessible=true}.set(workspace,lazy<ResearchServices> {fake})
    }
    @After fun close() {c.pause().stop().destroy()}
    private fun submit(goal: String="WIKI Dog") {field<EditText>("draft").setText(goal);field<Button>("send").performClick()}
    private fun approve() {
        if(field<List<InlineAgentTurn>>("agentCards").isEmpty()) submit()
        turnField<EditText>("plan").setText("WIKI Dog");find("Chrome").performClick();find("Review & approve plan").performClick();confirm()
    }
    private fun run() {find("Run approved plan").performClick();shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(650))}
    private fun completed() {approve();run();fake.source(0)}
    @Test fun entryIsBlankAgentModeWithOnlyOneComposerAndNoRequests() {
        assertEquals("",field<EditText>("draft").text.toString());assertTrue(field<RadioButton>("agentMode").isChecked)
        assertTrue(field<List<InlineAgentTurn>>("agentCards").isEmpty());assertTrue(fake.gets.isEmpty());assertTrue(fake.texts.isEmpty())
        assertNull(a.findViewById<ViewGroup>(android.R.id.content).findViewWithTag<View>("tab_agent"))
    }
    @Test fun manualSubmissionStaysInlineWithoutAiOrSelectedBrowser() {
        submit();assertSame(field<LinearLayout>("history"),card.view.parent)
        assertNull(turnField<ResearchBrowser?>("browser"));assertEquals("WIKI Dog",turnField<EditText>("plan").text.toString())
        assertTrue(fake.texts.isEmpty());assertTrue(fake.gets.isEmpty());assertFalse(turnField<Button>("execute").isEnabled)
    }
    @Test fun reviewAndApprovalAreSeparateFromActualFetch() {
        approve();assertTrue(fake.gets.isEmpty());assertTrue(turnField<Button>("execute").isEnabled);assertTrue(field<Button>("stop").isEnabled)
        run();assertEquals(1,fake.gets.size);assertFalse(field<Button>("send").isEnabled)
        fake.source(0);assertTrue(turnField<TextView>("state").text.contains("COMPLETE"));assertTrue(turnField<Button>("explain").isEnabled)
        assertTrue(fake.texts.isEmpty());assertNull(shadowOf(a).nextStartedActivity)
    }
    @Test fun browserOrPlanEditsRevokeApproval() {
        approve();find("Brave").performClick();assertFalse(turnField<Button>("execute").isEnabled)
        approve();turnField<EditText>("plan").setText("WIKI Cat");assertFalse(turnField<Button>("execute").isEnabled)
    }
    @Test fun approvalExpiresAndNeverFetchesOnLateRun() {
        approve();shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(60));run()
        assertTrue(fake.gets.isEmpty());assertTrue(turnField<TextView>("state").text.contains("EXPIRED"))
    }
    @Test fun aiProposalRequiresConsentAndNeverExecutesItself() {
        submit("SYNTHETIC_GOAL");assertTrue(fake.texts.isEmpty());confirm();assertEquals(1,fake.texts.size)
        fake.texts[0].second("WIKI Dog",null)
        assertEquals("WIKI Dog",turnField<EditText>("plan").text.toString());assertFalse(turnField<Button>("execute").isEnabled);assertTrue(fake.gets.isEmpty())
    }
    @Test fun unsupportedAiOutputIsNotModifiedIntoExecutablePlan() {
        submit("goal");confirm();fake.texts[0].second("OPEN https://evil.example",null)
        assertEquals("",turnField<EditText>("plan").text.toString());assertTrue(turnField<TextView>("state").text.contains("rejected"));assertTrue(fake.gets.isEmpty())
    }
    @Test fun explanationNeedsSeparateConsentAndNeverChangesPlan() {
        completed();find("Explain sources · AI consent").performClick();assertTrue(fake.texts.isEmpty());confirm()
        assertTrue(fake.texts[0].first.contains("SYNTHETIC_EXCERPT"));fake.texts[0].second("REPO other/repo",null)
        assertTrue(turnField<TextView>("summaryView").text.contains("REPO other/repo"));assertEquals("WIKI Dog",turnField<EditText>("plan").text.toString());assertEquals(1,fake.gets.size)
    }
    @Test fun stopAndLeavingFenceLateModelAndFetchCallbacks() {
        submit("goal");confirm();field<Button>("stop").performClick();fake.texts[0].second("WIKI Cat",null)
        assertEquals("",turnField<EditText>("plan").text.toString());approve();run()
        val old=card;c.pause().stop().restart().start().resume();fake.source(0)
        assertTrue(field<List<InlineAgentTurn>>("agentCards").isEmpty());assertEquals(0,old.view.childCount);assertEquals("",old.goal)
    }
    @Test fun editedPlanRevokesStaleApprovalDialog() {
        submit();find("Chrome").performClick();find("Review & approve plan").performClick();val old=ShadowAlertDialog.getLatestAlertDialog()
        turnField<EditText>("plan").setText("WIKI Cat");old.getButton(DialogInterface.BUTTON_POSITIVE).performClick();shadowOf(Looper.getMainLooper()).idle()
        assertFalse(card.approved);assertTrue(fake.gets.isEmpty())
    }
    @Test fun unavailableBrowserNeverFallsBackOrInstalls() {
        completed();find("Open source 1 · selected browser").performClick();confirm()
        assertNull(shadowOf(a).nextStartedActivity);assertTrue(turnField<TextView>("state").text.contains("unavailable"))
    }
    @Test fun installedSelectedBrowserGetsOnlyExactValidatedUrlAndComponent() {
        completed()
        val intent=Intent(Intent.ACTION_VIEW,Uri.parse("https://en.wikipedia.org/wiki/Dog")).addCategory(Intent.CATEGORY_BROWSABLE).setPackage("com.android.chrome")
        val resolved=ResolveInfo().apply {activityInfo=ActivityInfo().apply {packageName="com.android.chrome";name="SyntheticBrowser";exported=true;enabled=true}}
        shadowOf(a.packageManager).addResolveInfoForIntent(intent,resolved)
        find("Open source 1 · selected browser").performClick();confirm()
        val launched=shadowOf(a).nextStartedActivity
        assertEquals("com.android.chrome",launched.component!!.packageName);assertEquals("SyntheticBrowser",launched.component!!.className)
        assertEquals("https://en.wikipedia.org/wiki/Dog",launched.dataString);assertNull(launched.extras)
    }
    @Test fun obscuredConfirmationCannotSendAndOldPositiveButtonIsRevoked() {
        submit("goal")
        for(flag in listOf(MotionEvent.FLAG_WINDOW_IS_OBSCURED,MotionEvent.FLAG_WINDOW_IS_PARTIALLY_OBSCURED)) {
            card.propose();val d=ShadowAlertDialog.getLatestAlertDialog()
            val prop=MotionEvent.PointerProperties().apply {id=0;toolType=MotionEvent.TOOL_TYPE_FINGER}
            val coord=MotionEvent.PointerCoords().apply {x=10f;y=10f}
            val e=MotionEvent.obtain(0,0,MotionEvent.ACTION_DOWN,1,arrayOf(prop),arrayOf(coord),0,0,1f,1f,0,0,InputDevice.SOURCE_TOUCHSCREEN,flag)
            try {assertTrue(d.window!!.callback.dispatchTouchEvent(e))} finally {e.recycle()}
            d.getButton(DialogInterface.BUTTON_POSITIVE).performClick();shadowOf(Looper.getMainLooper()).idle();assertTrue(fake.texts.isEmpty())
        }
    }
    @Test fun newApprovalClearsOldExplanationAndOffNeverChangesManualPlan() {
        completed();find("Explain sources · AI consent").performClick();confirm();fake.texts[0].second("OLD_EXPLANATION",null)
        find("Review & approve plan").performClick();confirm();assertEquals("",turnField<TextView>("summaryView").text.toString())
        find("Generate / revise AI plan").performClick();confirm();fake.texts[1].second(null,ResearchBackend.TextFailure.CHAT_OFF)
        assertTrue(turnField<TextView>("state").text.contains("OFF"));assertEquals("WIKI Dog",turnField<EditText>("plan").text.toString())
    }
    @Test fun sourceTransferRequiresConsentAndDoesNotSendOrSilentlyReplaceDraft() {
        completed();field<EditText>("draft").setText("KEEP_DRAFT")
        find("Use source 1 in Direct Chat").performClick();assertEquals("KEEP_DRAFT",field<EditText>("draft").text.toString());confirm()
        assertEquals("KEEP_DRAFT",field<EditText>("draft").text.toString())
        ShadowAlertDialog.getLatestAlertDialog().getButton(DialogInterface.BUTTON_NEGATIVE).performClick()
        find("Use source 1 in Direct Chat").performClick();confirm();confirm()
        assertTrue(field<RadioButton>("directMode").isChecked);assertTrue(field<EditText>("draft").text.contains("SYNTHETIC_EXCERPT"))
        assertTrue(fake.texts.isEmpty());assertEquals(1,fake.gets.size)
    }
    @Test fun modeSwitchRevokesApprovedRunAndDoesNotClearCompletedSources() {
        completed();val sources=turnField<LinearLayout>("result").childCount
        field<RadioButton>("directMode").performClick();assertEquals(sources,turnField<LinearLayout>("result").childCount)
        field<RadioButton>("agentMode").performClick();approve();field<RadioButton>("directMode").performClick()
        assertFalse(card.approved);field<RadioButton>("agentMode").performClick();run();assertEquals(1,fake.gets.size)
    }
    @Test fun stoppingDuringRunRejectsLateSourceAndNoAutomaticNextStep() {
        approve();turnField<EditText>("plan").setText("WIKI Dog\nWIKI Cat");find("Review & approve plan").performClick();confirm();run()
        field<Button>("stop").performClick();fake.source(0);shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(2))
        assertEquals(1,fake.gets.size);assertEquals(0,turnField<LinearLayout>("result").childCount)
    }
}
