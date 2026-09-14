package com.maya.ai.chat

import android.app.AlertDialog
import android.content.DialogInterface
import android.os.Looper
import android.view.View
import android.view.ViewGroup
import android.widget.*
import org.junit.*
import org.junit.Assert.*
import org.junit.runner.RunWith
import org.robolectric.*
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.*
import org.robolectric.shadows.ShadowAlertDialog
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey

@RunWith(RobolectricTestRunner::class)
@Config(sdk=[28])
@LooperMode(LooperMode.Mode.PAUSED)
class WorkspaceLibraryTest {
    private lateinit var controller: org.robolectric.android.controller.ActivityController<NativeChatActivity>
    private lateinit var library: WorkspaceLibrary
    private lateinit var vault: WorkspaceVault
    private var stored: ByteArray?=null
    private var snapshot=WorkspaceLibrary.Snapshot(emptyList(),"private draft","<html>private code</html>")
    private var opened: SavedWorkspace?=null
    private var key: SecretKey?=null
    @Before fun setup() {
        controller=Robolectric.buildActivity(NativeChatActivity::class.java).setup().visible()
        vault=WorkspaceVault(object : WorkspaceVault.Storage {
            override fun read()=stored?.copyOf()
            override fun write(bytes: ByteArray) {stored=bytes.copyOf()}
            override fun erase() {stored=null}
        },object : WorkspaceVault.Keys {
            override fun get(create: Boolean): SecretKey {if(key==null) {check(create);key=KeyGenerator.getInstance("AES").apply {init(256)}.generateKey()};return key!!}
            override fun erase() {key=null}
        })
        library=WorkspaceLibrary(controller.get(),{vault},{snapshot},{opened=it})
        controller.get().setContentView(ScrollView(controller.get()).apply {addView(library.view)})
        library.enter();await {button("Save current workspace").isEnabled}
    }
    @After fun teardown() {library.dispose();controller.pause().stop().destroy()}
    private fun await(condition: ()->Boolean) {
        for(i in 0..500) {shadowOf(Looper.getMainLooper()).idle();if(condition()) return;Thread.sleep(10)}
        fail("Local worker did not finish")
    }
    private fun all(root: View): List<View> = listOf(root)+if(root is ViewGroup) (0 until root.childCount).flatMap {all(root.getChildAt(it))} else emptyList()
    private fun button(title: String)=all(library.view).filterIsInstance<Button>().first {it.text.toString()==title}
    private fun dialog()=ShadowAlertDialog.getLatestAlertDialog()
    private fun title(value: String) {all(dialog().window!!.decorView).filterIsInstance<EditText>().first().setText(value)}
    private fun positive() {dialog().getButton(DialogInterface.BUTTON_POSITIVE).performClick();shadowOf(Looper.getMainLooper()).idle()}
    private fun save() {button("Save current workspace").performClick();title("My snapshot");positive();await {stored!=null && button("Save current workspace").isEnabled}}
    @Test fun entryAndCancelDoNotPersistOrCreateAKey() {
        assertNull(stored);assertNull(key);button("Save current workspace").performClick();title("cancelled")
        val old=dialog();old.getButton(DialogInterface.BUTTON_NEGATIVE).performClick();shadowOf(Looper.getMainLooper()).idle()
        old.getButton(DialogInterface.BUTTON_POSITIVE).performClick();shadowOf(Looper.getMainLooper()).idle()
        assertNull(stored);assertNull(key);assertNull(opened)
    }
    @Test fun explicitSavePersistsOnlyDataAndOpenNeedsSeparateReview() {
        save();assertEquals(snapshot.draft,vault.list().items.single().draft);assertNull(opened)
        button("Review saved snapshot").performClick();assertNull(opened);positive();await {opened!=null}
        assertEquals(snapshot.code,opened!!.code)
    }
    @Test fun changingWorkspaceWhileSaveDialogIsOpenRejectsStaleSnapshot() {
        button("Save current workspace").performClick();title("old")
        snapshot=WorkspaceLibrary.Snapshot(emptyList(),"new draft",null);positive()
        assertNull(stored);assertNull(key)
    }
    @Test fun leavingRevokesOldSaveAndClearsSensitiveDialogFields() {
        button("Save current workspace").performClick();title("sensitive name");val old=dialog()
        library.leave();old.getButton(DialogInterface.BUTTON_POSITIVE).performClick();shadowOf(Looper.getMainLooper()).idle()
        assertNull(stored);assertNull(opened)
        assertTrue(all(old.window!!.decorView).filterIsInstance<EditText>().all {it.text.isEmpty()})
    }
    @Test fun deleteCancelKeepsSnapshotAndConfirmedDeleteDoesNotClearActiveDraft() {
        save();button("Delete this snapshot").performClick();dialog().getButton(DialogInterface.BUTTON_NEGATIVE).performClick();shadowOf(Looper.getMainLooper()).idle()
        assertEquals(1,vault.list().items.size)
        button("Delete this snapshot").performClick();positive();await {button("Save current workspace").isEnabled && vault.list().items.isEmpty()}
        assertEquals("private draft",snapshot.draft);assertNull(opened)
    }
    @Test fun exportCancelNeverCopiesPlaintextOrBackupPassword() {
        save();val clipboard=controller.get().getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
        clipboard.clearPrimaryClip();button("Export encrypted backup").performClick()
        val edits=all(dialog().window!!.decorView).filterIsInstance<EditText>();edits.forEach {it.setText("long synthetic password")}
        dialog().getButton(DialogInterface.BUTTON_NEGATIVE).performClick();shadowOf(Looper.getMainLooper()).idle()
        assertFalse(clipboard.hasPrimaryClip());assertTrue(edits.all {it.text.isEmpty()})
    }
    @Test fun corruptVaultRefreshNeverOverwritesAndExplicitResetCanRemoveIt() {
        stored=byteArrayOf(1,2,3);button("Refresh saved list").performClick();await {button("Save current workspace").isEnabled}
        button("Save current workspace").performClick();assertArrayEquals(byteArrayOf(1,2,3),stored)
        button("Delete all saved work").performClick();positive();await {stored==null && button("Save current workspace").isEnabled}
        assertNull(key);assertNull(opened)
    }
    @Test fun portableExportAndImportRequireCopyDecryptReviewAndSeparateImport() {
        save();val clipboard=controller.get().getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
        clipboard.clearPrimaryClip();button("Export encrypted backup").performClick()
        all(dialog().window!!.decorView).filterIsInstance<EditText>().forEach {it.setText("long synthetic backup password")}
        val encryption=dialog();positive()
        await {dialog()!==encryption && dialog().isShowing}
        assertFalse(clipboard.hasPrimaryClip());positive()
        val encoded=clipboard.primaryClip!!.getItemAt(0).text.toString()
        assertFalse(encoded.contains("private draft"));assertFalse(encoded.contains("synthetic backup password"))
        button("Import encrypted backup text").performClick()
        val fields=all(dialog().window!!.decorView).filterIsInstance<EditText>()
        assertTrue(fields[0].text.isEmpty());fields[0].setText(encoded);fields[1].setText("long synthetic backup password")
        val decryption=dialog();positive();await {dialog()!==decryption && dialog().isShowing}
        assertEquals(1,vault.list().items.size);assertNull(opened)
        positive();await {vault.list().items.size==2 && button("Save current workspace").isEnabled}
        assertEquals(2,vault.list().items.map {it.id}.toSet().size);assertNull(opened)
    }

}
