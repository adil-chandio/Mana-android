package com.maya.ai.agent

import android.content.*
import android.content.pm.ActivityInfo
import android.content.pm.ResolveInfo
import android.net.Uri
import android.os.Looper
import android.view.*
import android.widget.*
import org.junit.*
import org.junit.Assert.*
import org.junit.runner.RunWith
import org.robolectric.*
import org.robolectric.Shadows.shadowOf
import org.robolectric.android.controller.ActivityController
import org.robolectric.annotation.*
import org.robolectric.shadows.ShadowAlertDialog
import java.time.Duration

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
    private val workspace get()=ResearchActivity::class.java.getDeclaredField("workspace").apply {isAccessible=true}.get(a) as ResearchWorkspace
    private inline fun <reified T> field(name: String): T=ResearchWorkspace::class.java.getDeclaredField(name).apply {isAccessible=true}.get(workspace) as T
    private fun find(title: String): TextView {
        fun f(v: View): TextView? {if(v is TextView && v.text.toString()==title) return v;if(v is ViewGroup) for(i in 0 until v.childCount) f(v.getChildAt(i))?.let {return it};return null}
        return f(a.findViewById(android.R.id.content))!!
    }
    private fun confirm() {ShadowAlertDialog.getLatestAlertDialog().getButton(DialogInterface.BUTTON_POSITIVE).performClick();shadowOf(Looper.getMainLooper()).idle()}
    @Before fun open() {
        c=Robolectric.buildActivity(ResearchActivity::class.java).setup().visible();fake=Fake()
        ResearchWorkspace::class.java.getDeclaredField("backend\$delegate").apply {isAccessible=true}.set(workspace,lazy<ResearchServices> {fake})
    }
    @After fun close() {c.pause().stop().destroy()}
    private fun approve() {
        field<EditText>("plan").setText("WIKI Dog");find("Chrome").performClick();field<Button>("review").performClick();confirm()
    }
    private fun completed() {approve();field<Button>("run").performClick();shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(650));fake.source(0)}
    @Test fun openIsBlankAndDoesNotSelectAppsOrStartRequests() {
        assertEquals("",field<EditText>("goal").text.toString());assertNull(field<ResearchBrowser?>("browser"))
        assertTrue(fake.gets.isEmpty());assertTrue(fake.texts.isEmpty());assertFalse(field<Button>("run").isEnabled)
    }
    @Test fun reviewAndApprovalAreSeparateFromActualFetch() {
        approve();assertTrue(fake.gets.isEmpty());assertTrue(field<Button>("run").isEnabled)
        field<Button>("run").performClick();shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(650));assertEquals(1,fake.gets.size)
        fake.source(0);assertTrue(field<TextView>("status").text.contains("COMPLETE"));assertTrue(field<Button>("summarize").isEnabled)
        assertTrue(fake.texts.isEmpty());assertNull(shadowOf(a).nextStartedActivity)
    }
    @Test fun browserOrPlanEditsRevokeApproval() {
        approve();find("Brave").performClick();assertFalse(field<Button>("run").isEnabled)
        approve();field<EditText>("plan").setText("WIKI Cat");assertFalse(field<Button>("run").isEnabled)
    }
    @Test fun aiProposalRequiresConsentAndNeverExecutesItself() {
        field<EditText>("goal").setText("SYNTHETIC_GOAL");field<Button>("propose").performClick();assertTrue(fake.texts.isEmpty());confirm()
        assertEquals(1,fake.texts.size);fake.texts[0].second("WIKI Dog",null)
        assertEquals("WIKI Dog",field<EditText>("plan").text.toString());assertFalse(field<Button>("run").isEnabled);assertTrue(fake.gets.isEmpty())
    }
    @Test fun unsupportedAiOutputIsNotModifiedIntoAnExecutablePlan() {
        field<EditText>("goal").setText("goal");field<Button>("propose").performClick();confirm()
        fake.texts[0].second("OPEN https://evil.example",null)
        assertEquals("",field<EditText>("plan").text.toString());assertTrue(field<TextView>("status").text.contains("rejected"));assertTrue(fake.gets.isEmpty())
    }
    @Test fun summarizingRequiresSeparatePublicExcerptConsentAndDoesNotPlanActions() {
        completed();field<Button>("summarize").performClick();assertTrue(fake.texts.isEmpty());confirm()
        assertTrue(fake.texts[0].first.contains("SYNTHETIC_EXCERPT"));fake.texts[0].second("REPO other/repo",null)
        assertTrue(field<TextView>("summary").text.contains("REPO other/repo"));assertEquals("WIKI Dog",field<EditText>("plan").text.toString());assertEquals(1,fake.gets.size)
    }
    @Test fun stopAndLeavingFenceLateModelAndFetchCallbacks() {
        field<EditText>("goal").setText("goal");field<Button>("propose").performClick();confirm();field<Button>("stop").performClick();fake.texts[0].second("WIKI Cat",null)
        assertEquals("",field<EditText>("plan").text.toString())
        approve();field<Button>("run").performClick();shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(650))
        c.pause().stop().restart().start().resume();fake.source(0)
        assertEquals("",field<EditText>("plan").text.toString());assertTrue(field<Lazy<ResearchRunner>>("runner\$delegate").value.results().isEmpty())
    }
    @Test fun staleDialogCannotSendGoalAfterEditing() {
        field<EditText>("goal").setText("before");field<Button>("propose").performClick();val d=ShadowAlertDialog.getLatestAlertDialog()
        field<EditText>("goal").setText("after");d.getButton(DialogInterface.BUTTON_POSITIVE).performClick();shadowOf(Looper.getMainLooper()).idle()
        assertTrue(fake.texts.isEmpty())
    }
    @Test fun reportIsFixedWithoutGoalSourceTextOrSummary() {
        completed();find("Copy fixed Agent report").performClick()
        val value=(a.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).primaryClip!!.getItemAt(0).text.toString()
        assertFalse(value.contains("SYNTHETIC"));assertFalse(value.contains("Dog"));assertTrue(value.contains("Validated sources: 1"))
    }
    @Test fun unavailableBrowserNeverFallsBackOrInstalls() {
        completed();find("Open source 1 in selected browser").performClick();confirm()
        assertNull(shadowOf(a).nextStartedActivity);assertTrue(field<TextView>("status").text.contains("unavailable"))
    }
    @Test fun installedSelectedBrowserGetsOnlyExactValidatedUrlAndComponent() {
        completed()
        val intent=Intent(Intent.ACTION_VIEW,Uri.parse("https://en.wikipedia.org/wiki/Dog")).addCategory(Intent.CATEGORY_BROWSABLE).setPackage("com.android.chrome")
        val resolved=ResolveInfo().apply {activityInfo=ActivityInfo().apply {packageName="com.android.chrome";name="SyntheticBrowser";exported=true;enabled=true}}
        shadowOf(a.packageManager).addResolveInfoForIntent(intent,resolved)
        find("Open source 1 in selected browser").performClick();confirm()
        val launched=shadowOf(a).nextStartedActivity
        assertEquals("com.android.chrome",launched.component!!.packageName);assertEquals("SyntheticBrowser",launched.component!!.className)
        assertEquals("https://en.wikipedia.org/wiki/Dog",launched.dataString);assertNull(launched.extras)
    }
    @Test fun obscuredConfirmationCannotSendAndOldPositiveButtonIsRevoked() {
        for(flag in listOf(MotionEvent.FLAG_WINDOW_IS_OBSCURED,MotionEvent.FLAG_WINDOW_IS_PARTIALLY_OBSCURED)) {
            field<EditText>("goal").setText("goal");field<Button>("propose").performClick()
            val d=ShadowAlertDialog.getLatestAlertDialog()
            val prop=MotionEvent.PointerProperties().apply {id=0;toolType=MotionEvent.TOOL_TYPE_FINGER}
            val coord=MotionEvent.PointerCoords().apply {x=10f;y=10f}
            val e=MotionEvent.obtain(0,0,MotionEvent.ACTION_DOWN,1,arrayOf(prop),arrayOf(coord),0,0,1f,1f,0,0,InputDevice.SOURCE_TOUCHSCREEN,flag)
            try {assertTrue(d.window!!.callback.dispatchTouchEvent(e))} finally {e.recycle()}
            d.getButton(DialogInterface.BUTTON_POSITIVE).performClick();shadowOf(Looper.getMainLooper()).idle()
            assertTrue(fake.texts.isEmpty())
        }
    }
    @Test fun newApprovalClearsOldExplanationAndOffNeverChangesManualPlan() {
        completed();field<Button>("summarize").performClick();confirm();fake.texts[0].second("OLD_EXPLANATION",null)
        field<Button>("review").performClick();confirm();assertEquals("",field<TextView>("summary").text.toString())
        field<EditText>("goal").setText("goal");field<Button>("propose").performClick();confirm()
        fake.texts[1].second(null,ResearchBackend.TextFailure.CHAT_OFF)
        assertTrue(field<TextView>("status").text.contains("OFF"));assertEquals("WIKI Dog",field<EditText>("plan").text.toString())
    }
}
