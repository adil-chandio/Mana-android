package com.maya.ai.agent

import android.content.DialogInterface
import android.os.Looper
import android.view.*
import android.webkit.WebView
import android.widget.*
import com.maya.ai.chat.*
import org.junit.*
import org.junit.Assert.*
import org.junit.runner.RunWith
import org.robolectric.*
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.*
import org.robolectric.shadows.ShadowAlertDialog
import java.time.Duration

@RunWith(RobolectricTestRunner::class)
@Config(sdk=[28])
@LooperMode(LooperMode.Mode.PAUSED)
class InlineBuildTurnTest {
    private val controller=Robolectric.buildActivity(NativeChatActivity::class.java)
    private val activity get()=controller.get()
    private val workspace get()=NativeChatActivity::class.java.getDeclaredField("workspace").apply {isAccessible=true}.get(activity) as NativeChatWorkspace
    private inline fun <reified T> field(name: String): T=NativeChatWorkspace::class.java.getDeclaredField(name).apply {isAccessible=true}.get(workspace) as T
    private val card get()=field<InlineBuildTurn>("buildTask")
    private val root get()=activity.findViewById<ViewGroup>(android.R.id.content)
    private val fake=object : ResearchServices {
        val calls=mutableListOf<Pair<String,(String?,ResearchBackend.TextFailure?) -> Unit>>()
        var cancels=0
        override fun fetch(item: ResearchPlan.Item,done: (ResearchSource?) -> Unit): () -> Unit=error("Builder cannot research implicitly")
        override fun text(prompt: String,done: (String?,ResearchBackend.TextFailure?) -> Unit): () -> Unit {calls.add(prompt to done);return {cancels++}}
    }
    private val html="<!DOCTYPE html><html><body><h1>Bakery</h1></body></html>"
    private fun button(text: String): Button {
        fun find(v: View): Button? {if(v is Button && (v.text.toString()==text || v.contentDescription?.toString()==text)) return v;if(v is ViewGroup) for(i in 0 until v.childCount) find(v.getChildAt(i))?.let {return it};return null}
        return find(root) ?: error("Missing $text")
    }
    private fun yes() {ShadowAlertDialog.getLatestAlertDialog().getButton(DialogInterface.BUTTON_POSITIVE).performClick();shadowOf(Looper.getMainLooper()).idle()}
    private fun submit(value: String) {field<EditText>("draft").setText(value);field<Button>("send").performClick()}
    @Before fun open() {
        controller.setup().visible()
        NativeChatWorkspace::class.java.getDeclaredField("researchServices\$delegate").apply {isAccessible=true}.set(workspace,lazy<ResearchServices> {fake})
        field<Spinner>("modePicker").setSelection(1);shadowOf(Looper.getMainLooper()).idle();field<Spinner>("agentKind").setSelection(1);shadowOf(Looper.getMainLooper()).idle()
    }
    @After fun close() {controller.pause().stop().destroy()}
    @Test fun selectingBuilderKeepsOneComposerAndDoesNothing() {
        assertTrue(fake.calls.isEmpty());assertNull(field<InlineBuildTurn?>("buildTask"));assertNull(shadowOf(activity).nextStartedActivity)
        assertNotNull(root.findViewWithTag<EditText>("shared_composer"));assertNull(root.findViewWithTag<View>("tab_agent"))
    }
    @Test fun manualDocumentBecomesAnInlineFileWithoutNetworkOrPreview() {
        submit(html);assertEquals(html,card.editor.text.toString());assertSame(field<LinearLayout>("history"),card.view.parent)
        assertTrue(fake.calls.isEmpty());assertNull(root.findViewWithTag<WebView>("isolated_static_preview"))
    }
    @Test fun previewNeedsConfirmationAndHasNoScriptNetworkFileOrNavigationAuthority() {
        submit(html);button("Render static preview here").performClick();assertNull(root.findViewWithTag<WebView>("isolated_static_preview"));yes()
        val preview=root.findViewWithTag<WebView>("isolated_static_preview")!!
        assertFalse(preview.settings.javaScriptEnabled);assertTrue(preview.settings.blockNetworkLoads);assertTrue(preview.settings.blockNetworkImage)
        assertFalse(preview.settings.allowFileAccess);assertFalse(preview.settings.allowContentAccess);assertFalse(preview.settings.domStorageEnabled)
        assertTrue(preview.webViewClient.shouldOverrideUrlLoading(preview,"https://evil.invalid/"))
        assertTrue(preview.webViewClient.shouldOverrideUrlLoading(preview,"maya-private-chat://open"))
        assertNull(shadowOf(activity).nextStartedActivity);assertTrue(fake.calls.isEmpty())
    }
    @Test fun codeEditInvalidatesPreviewAndStaleRenderApproval() {
        submit(html);button("Render static preview here").performClick();val dialog=ShadowAlertDialog.getLatestAlertDialog()
        card.editor.setText(html.replace("Bakery","Changed"));dialog.getButton(DialogInterface.BUTTON_POSITIVE).performClick()
        assertNull(root.findViewWithTag<WebView>("isolated_static_preview"))
        button("Render static preview here").performClick();yes();card.editor.setText(html)
        assertNull(root.findViewWithTag<WebView>("isolated_static_preview"));assertTrue(fake.calls.isEmpty())
    }
    @Test fun aiIsConsentThenProposalThenApplyThenPreviewNotAutomatic() {
        submit("Make a tiny bakery page");assertTrue(fake.calls.isEmpty());yes();assertEquals(1,fake.calls.size)
        fake.calls[0].second(html,null);assertEquals("",card.editor.text.toString());assertNull(root.findViewWithTag<WebView>("isolated_static_preview"))
        button("Apply reviewed proposal locally").performClick();assertEquals("",card.editor.text.toString());yes()
        assertEquals(html,card.editor.text.toString());assertNull(root.findViewWithTag<WebView>("isolated_static_preview"))
    }
    @Test fun directContextNeverLeaksIntoBuilderPrompt() {
        val session=field<NativeChatConversation>("session");val turn=session.begin("PRIVATE_DIRECT_CONTEXT",true);session.complete(turn,"PRIVATE_REPLY")
        submit("tiny page");yes();assertFalse(fake.calls.single().first.contains("PRIVATE_DIRECT"));assertFalse(fake.calls.single().first.contains("PRIVATE_REPLY"))
    }
    @Test fun sameComposerFollowupUsesSameProjectAndNeedsCodeConsent() {
        submit(html);val first=card;submit("Make the heading blue")
        assertSame(first,card);assertEquals(1,field<List<WorkspaceTask>>("agentCards").size);assertTrue(fake.calls.isEmpty());yes()
        assertTrue(fake.calls.single().first.contains(html));assertTrue(fake.calls.single().first.contains("Make the heading blue"))
        assertEquals(2,field<List<Any>>("timeline").size)
    }
    @Test fun longExistingCodeIsNotSilentlyTruncatedForAi() {
        submit(html);val large="<html><body>"+"x".repeat(1200)+"</body></html>";card.editor.setText(large);submit("Change colour")
        assertTrue(fake.calls.isEmpty());assertEquals(large,card.editor.text.toString())
        assertTrue(root.findViewWithTag<TextView>("builder_status").text.contains("Nothing truncated"))
    }
    @Test fun offPreservesCodeAndDoesNotApplyOrRetry() {
        submit(html);submit("Change colour");yes();fake.calls[0].second(null,ResearchBackend.TextFailure.CHAT_OFF)
        assertEquals(html,card.editor.text.toString());assertTrue(root.findViewWithTag<TextView>("builder_status").text.contains("OFF"));assertEquals(1,fake.calls.size)
    }
    @Test fun stopModeChangeAndDuplicateCallbacksCannotOverwriteCode() {
        submit("tiny page");yes();field<Button>("stop").performClick();fake.calls[0].second(html,null)
        assertEquals("",card.editor.text.toString());assertFalse(button("Apply reviewed proposal locally").isEnabled)
        submit("tiny page again");yes();field<Spinner>("modePicker").setSelection(0);shadowOf(Looper.getMainLooper()).idle();fake.calls[1].second(html,null)
        assertEquals("",card.editor.text.toString());assertEquals(2,fake.cancels)
    }
    @Test fun timeoutRejectsLateProposalAndDoesNotRetry() {
        submit("tiny page");yes();shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(20));fake.calls[0].second(html,null)
        assertFalse(card.busy);assertEquals("",card.editor.text.toString());assertEquals(1,fake.calls.size)
    }
    @Test fun backgroundClearsCodeProposalAndPreviewNotSavedIdentity() {
        submit(html);button("Render static preview here").performClick();yes();val old=card
        controller.pause().stop().restart().start().resume()
        assertNull(field<InlineBuildTurn?>("buildTask"));assertEquals("",old.editor.text.toString());assertEquals("",old.goal);assertEquals(0,old.view.childCount)
        assertNull(root.findViewWithTag<WebView>("isolated_static_preview"));assertTrue(fake.calls.isEmpty())
    }
    @Test fun unsupportedOrIncompleteModelCodeIsNotRepairedIntoARunnableResult() {
        submit("tiny page");yes();fake.calls[0].second("```html\n<html>incomplete",null)
        assertEquals("",card.editor.text.toString());assertFalse(button("Apply reviewed proposal locally").isEnabled)
    }
    @Test fun localDocumentBoundRejectsTooLargePreviewWithoutShorteningEditor() {
        submit(html);val large="<html>"+"x".repeat(8000)+"</html>";card.editor.setText(large)
        assertEquals(large,card.editor.text.toString());assertFalse(button("Render static preview here").isEnabled)
    }
    @Test fun globalStopClosesLivePreviewButKeepsCodeInSameConversation() {
        submit(html);button("Render static preview here").performClick();yes()
        assertTrue(field<Button>("stop").isEnabled);field<Button>("stop").performClick()
        assertNull(root.findViewWithTag<WebView>("isolated_static_preview"));assertEquals(html,card.editor.text.toString())
    }

    @Test fun duplicateAiCallbackCannotReplaceFirstReviewedProposal() {
        submit("tiny page");yes();fake.calls[0].second(html,null);fake.calls[0].second(html.replace("Bakery","LATE"),null)
        button("Apply reviewed proposal locally").performClick();yes();assertEquals(html,card.editor.text.toString())
    }
    @Test fun obscuredAiConsentIsRevokedWithoutSending() {
        submit("tiny page");val d=ShadowAlertDialog.getLatestAlertDialog()
        val prop=MotionEvent.PointerProperties().apply {id=0;toolType=MotionEvent.TOOL_TYPE_FINGER}
        val coord=MotionEvent.PointerCoords().apply {x=10f;y=10f}
        val event=MotionEvent.obtain(0,0,MotionEvent.ACTION_DOWN,1,arrayOf(prop),arrayOf(coord),0,0,1f,1f,0,0,InputDevice.SOURCE_TOUCHSCREEN,MotionEvent.FLAG_WINDOW_IS_PARTIALLY_OBSCURED)
        try {assertTrue(d.window!!.callback.dispatchTouchEvent(event))} finally {event.recycle()}
        d.getButton(DialogInterface.BUTTON_POSITIVE).performClick();shadowOf(Looper.getMainLooper()).idle();assertTrue(fake.calls.isEmpty())
    }
    @Test fun previewResourceRequestsAndPermissionsAreDenied() {
        submit(html);button("Render static preview here").performClick();yes();val web=root.findViewWithTag<WebView>("isolated_static_preview")
        val request=object : android.webkit.WebResourceRequest {
            override fun getUrl()=android.net.Uri.parse("https://example.invalid/track")
            override fun isForMainFrame()=false
            override fun isRedirect()=false
            override fun hasGesture()=false
            override fun getMethod()="GET"
            override fun getRequestHeaders()=emptyMap<String,String>()
        }
        assertEquals(403,web.webViewClient.shouldInterceptRequest(web,request)!!.statusCode)
        var denied=false
        web.webChromeClient!!.onPermissionRequest(object : android.webkit.PermissionRequest() {
            override fun getOrigin()=android.net.Uri.parse("https://maya-preview.invalid/")
            override fun getResources()=arrayOf(android.webkit.PermissionRequest.RESOURCE_AUDIO_CAPTURE)
            override fun grant(resources: Array<String>) {fail("No permission grant")}
            override fun deny() {denied=true}
        })
        assertTrue(denied);assertTrue(fake.calls.isEmpty())
    }

    @Test fun codeAndPreviewDisclosuresDoNotSendApplyOrDestroyCode() {
        submit(html);val editor=card.editor
        root.findViewWithTag<Button>("builder_code_toggle").performClick();assertEquals(View.GONE,editor.visibility)
        root.findViewWithTag<Button>("builder_code_toggle").performClick();assertEquals(View.VISIBLE,editor.visibility)
        button("Render static preview here").performClick();yes()
        val preview=root.findViewWithTag<WebView>("isolated_static_preview")
        assertNotNull(preview);assertEquals(View.GONE,editor.visibility);assertEquals(View.VISIBLE,field<Button>("stop").visibility)
        root.findViewWithTag<Button>("builder_preview_toggle").performClick();assertFalse(preview.isShown)
        assertTrue(card.stoppable);assertEquals(html,editor.text.toString());assertTrue(fake.calls.isEmpty())
        field<Button>("stop").performClick();assertNull(root.findViewWithTag<WebView>("isolated_static_preview"))
    }
    @Test fun proposalDisclosureDoesNotGrantApplyConsent() {
        submit("tiny page");yes();fake.calls[0].second(html,null)
        root.findViewWithTag<Button>("builder_proposal_toggle").performClick()
        assertEquals(View.GONE,root.findViewWithTag<View>("builder_proposal").visibility)
        assertEquals("",card.editor.text.toString());assertNull(root.findViewWithTag<WebView>("isolated_static_preview"))
        assertEquals(1,fake.calls.size)
    }

    @Test fun stoppingPendingProposalKeepsRemoteUncertaintyVisible() {
        submit("tiny page");yes();field<Button>("stop").performClick()
        val status=root.findViewWithTag<TextView>("builder_status")
        assertEquals(View.VISIBLE,status.visibility);assertTrue(status.text.contains("Remote AI work/usage may continue"))
        assertFalse(card.busy);assertEquals(1,fake.cancels)
    }

    @Test fun undoIsExplicitLocalOnlyAndManualEditRevokesIt() {
        submit(html);submit("make the title blue");yes()
        val revised="<html><body>Revised</body></html>"
        fake.calls[0].second(revised,null);button("Apply reviewed proposal locally").performClick();yes()
        assertEquals(revised,card.editor.text.toString());assertTrue(button("Undo last apply").isShown)
        button("Undo last apply").performClick();assertEquals(revised,card.editor.text.toString());yes()
        assertEquals(html,card.editor.text.toString());assertEquals(1,fake.calls.size)
        assertNull(root.findViewWithTag<WebView>("isolated_static_preview"));assertFalse(button("Undo last apply").isShown)
        submit("revise again");yes();fake.calls[1].second(revised,null);button("Apply reviewed proposal locally").performClick();yes()
        card.editor.setText("<html>Owner edit</html>");assertFalse(button("Undo last apply").isShown)
    }
    @Test fun dedicatedSettingsStopsPreviewButKeepsCodeAndSameProject() {
        submit(html);button("Render static preview here").performClick();yes();val original=card
        button("Workspace menu").performClick();button("Settings").performClick()
        assertFalse(original.stoppable);assertNull(root.findViewWithTag<WebView>("isolated_static_preview"))
        assertEquals(html,original.editor.text.toString());assertFalse(field<EditText>("draft").isShown)
        workspace.requestClose();assertSame(original,card);assertTrue(field<EditText>("draft").isShown);assertTrue(fake.calls.isEmpty())
    }

    @Test fun actualDiffIsLocalReadOnlyAndDisappearsWhenCodeChanges() {
        submit(html);submit("revise");yes();val revised="<html><body>DIFF_NEW</body></html>"
        fake.calls[0].second(revised,null)
        val diff=root.findViewWithTag<TextView>("builder_diff")
        assertEquals(View.GONE,diff.visibility);root.findViewWithTag<Button>("builder_diff_toggle").performClick()
        assertEquals(View.VISIBLE,diff.visibility);assertTrue(diff.text.contains("− "+html));assertTrue(diff.text.contains("+ "+revised))
        assertEquals(html,card.editor.text.toString());assertEquals(1,fake.calls.size);assertNull(root.findViewWithTag<WebView>("isolated_static_preview"))
        card.editor.setText("<html>OWNER_CHANGE</html>");assertEquals(View.GONE,diff.visibility);assertEquals("",diff.text.toString())
    }
    @Test fun hiddenBuilderCannotRequestAiFromDedicatedSettings() {
        submit(html);button("Workspace menu").performClick();button("Settings").performClick()
        card.propose("must not send from hidden card");assertTrue(fake.calls.isEmpty());assertEquals(html,card.editor.text.toString())
    }

    @Test fun checkpointSaveCancelAndExplicitRestoreAreLocalAndCompared() {
        submit(html);button("Save local checkpoint").performClick()
        ShadowAlertDialog.getLatestAlertDialog().getButton(DialogInterface.BUTTON_NEGATIVE).performClick();shadowOf(Looper.getMainLooper()).idle()
        assertEquals(0,root.findViewWithTag<LinearLayout>("builder_checkpoints").childCount)
        button("Save local checkpoint").performClick();yes();card.editor.setText("<html>NEW LOCAL CODE</html>")
        button("Review / restore checkpoint 1").performClick()
        val message=ShadowAlertDialog.getLatestAlertDialog().findViewById<TextView>(android.R.id.message).text
        assertTrue(message.contains("NEW LOCAL CODE"));assertTrue(message.contains(html));assertTrue(message.contains("one replacement block"))
        assertEquals("<html>NEW LOCAL CODE</html>",card.editor.text.toString());yes()
        assertEquals(html,card.editor.text.toString());assertTrue(fake.calls.isEmpty());assertNull(root.findViewWithTag<WebView>("isolated_static_preview"))
    }
    @Test fun editAfterCheckpointReviewRevokesRestoreAndNeverOverwritesNewCode() {
        submit(html);button("Save local checkpoint").performClick();yes();card.editor.setText("<html>B</html>")
        button("Review / restore checkpoint 1").performClick();val old=ShadowAlertDialog.getLatestAlertDialog()
        card.editor.setText("<html>C</html>");old.getButton(DialogInterface.BUTTON_POSITIVE).performClick();shadowOf(Looper.getMainLooper()).idle()
        assertEquals("<html>C</html>",card.editor.text.toString());assertTrue(fake.calls.isEmpty())
    }
    @Test fun checkpointCapAndConfirmedDeletionKeepCurrentEditorUnchanged() {
        submit(html)
        repeat(5) {card.editor.setText("<html>$it</html>");button("Save local checkpoint").performClick();yes()}
        card.editor.setText("<html>six</html>");button("Save local checkpoint").performClick()
        assertTrue(root.findViewWithTag<TextView>("builder_status").text.contains("Five checkpoints"))
        button("Delete checkpoint 1").performClick();yes();assertEquals("<html>six</html>",card.editor.text.toString())
        button("Save local checkpoint").performClick();yes()
        assertNotNull(button("Review / restore checkpoint 6"));assertTrue(fake.calls.isEmpty())
    }
    @Test fun checkpointRestoreRevokesPreviewAndApplyUndoButStopKeepsCheckpoints() {
        submit(html);button("Save local checkpoint").performClick();yes();card.editor.setText("<html>B</html>")
        button("Render static preview here").performClick();yes();button("Review / restore checkpoint 1").performClick();yes()
        assertNull(root.findViewWithTag<WebView>("isolated_static_preview"));assertFalse(button("Undo last apply").isShown)
        card.stop();assertNotNull(button("Review / restore checkpoint 1"));assertEquals(html,card.editor.text.toString())
    }
    @Test fun foldDoesNotDisposeProjectOrPreviewAndUnfoldDoesNotReapproveOldDialog() {
        submit(html);button("Render static preview here").performClick();val old=ShadowAlertDialog.getLatestAlertDialog()
        button("Fold task").performClick();assertEquals(View.GONE,card.view.visibility);assertEquals(html,card.editor.text.toString())
        assertEquals("Expand task",root.findViewWithTag<Button>("task_fold").contentDescription)
        old.getButton(DialogInterface.BUTTON_POSITIVE).performClick();shadowOf(Looper.getMainLooper()).idle()
        button("Expand task").performClick();old.getButton(DialogInterface.BUTTON_POSITIVE).performClick()
        assertEquals(View.VISIBLE,card.view.visibility);assertNull(root.findViewWithTag<WebView>("isolated_static_preview"))
        button("Render static preview here").performClick();yes();button("Fold task").performClick()
        assertTrue(card.stoppable);button("Stop this task").performClick();assertFalse(card.stoppable)
        assertEquals(html,card.editor.text.toString());assertEquals(1,field<List<WorkspaceTask>>("agentCards").size)
    }
    @Test fun removalFreesBuilderSlotWithoutClearingDirectDraftAndAllowsNewProject() {
        submit(html);val old=card;field<EditText>("draft").setText("KEEP_DRAFT")
        button("Save local checkpoint").performClick();yes();button("Remove task").performClick();yes()
        assertNull(field<InlineBuildTurn?>("buildTask"));assertTrue(field<List<WorkspaceTask>>("agentCards").isEmpty())
        assertEquals("",old.editor.text.toString());assertEquals(0,old.view.childCount);assertEquals("KEEP_DRAFT",field<EditText>("draft").text.toString())
        submit("<html>Fresh</html>");assertNotSame(old,card);assertTrue(fake.calls.isEmpty())
    }
    @Test fun removalCannotDiscardCodeEditedAfterItsConfirmationOpened() {
        submit(html);button("Remove task").performClick();val old=ShadowAlertDialog.getLatestAlertDialog()
        card.editor.setText("<html>EDIT AFTER REVIEW</html>");old.getButton(DialogInterface.BUTTON_POSITIVE).performClick();shadowOf(Looper.getMainLooper()).idle()
        assertEquals(1,field<List<WorkspaceTask>>("agentCards").size);assertEquals("<html>EDIT AFTER REVIEW</html>",card.editor.text.toString())
    }
    @Test fun backgroundDiscardsCheckpointBodiesAndStaleRestoreAuthority() {
        submit(html);button("Save local checkpoint").performClick();yes();button("Review / restore checkpoint 1").performClick()
        val oldDialog=ShadowAlertDialog.getLatestAlertDialog();val old=card
        controller.pause().stop().restart().start().resume();oldDialog.getButton(DialogInterface.BUTTON_POSITIVE).performClick()
        val history=InlineBuildTurn::class.java.getDeclaredField("checkpoints").apply {isAccessible=true}.get(old) as BuilderCheckpoints
        assertTrue(history.list().isEmpty());assertEquals("",old.editor.text.toString());assertNull(field<InlineBuildTurn?>("buildTask"))
    }

}
