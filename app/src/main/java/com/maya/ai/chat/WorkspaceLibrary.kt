package com.maya.ai.chat

import android.app.AlertDialog
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.text.InputFilter
import android.text.InputType
import android.view.*
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import java.util.UUID
import java.util.concurrent.SynchronousQueue
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit

/** Dedicated native Settings category. Every durable mutation and context replacement is explicit. */
class WorkspaceLibrary(private val host: AppCompatActivity,private val vault: ()->WorkspaceVault,
    private val capture: ()->Snapshot,private val restore: (SavedWorkspace)->Unit) {
    data class Snapshot(val messages: List<NativeChatProtocol.Message>,val draft: String,val code: String?) {
        override fun toString()="WorkspaceSnapshot(redacted)"
        fun item(title: String)=SavedWorkspace(UUID.randomUUID().toString(),title,System.currentTimeMillis().coerceAtLeast(0),messages,draft,code)
    }
    companion object {
        private val worker=ThreadPoolExecutor(1,1,30,TimeUnit.SECONDS,SynchronousQueue()).apply {allowCoreThreadTimeOut(true)}
        private const val BACKUP_TEXT_LIMIT=350000
    }
    val view=LinearLayout(host).apply {orientation=LinearLayout.VERTICAL;isSaveEnabled=false;tag="workspace_library"
        importantForAutofill=View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS}
    private val handler=Handler(Looper.getMainLooper())
    private var visible=false
    private var epoch=0L
    private var busy=false
    private var deadline: Runnable?=null
    private fun cancelDeadline() {deadline?.let {handler.removeCallbacks(it)};deadline=null}
    private var dialog: AlertDialog?=null
    private var dialogCleanup: (()->Unit)?=null
    private var listing: WorkspaceVault.Listing?=null
    private val actions=mutableListOf<Button>()
    private val status=label("Saved work stays off until you explicitly save a snapshot.")
    private val rows=LinearLayout(host).apply {orientation=LinearLayout.VERTICAL;view.addView(this)}
    init {
        button(view,"Save current workspace") {save()}
        button(view,"Refresh saved list") {refresh()}
        button(view,"Import encrypted backup text") {importBackup()}
        button(view,"Delete all saved work") {erase()}
        label("Up to 10 encrypted local snapshots / 512 KiB total. Completed Direct messages, draft and current Builder code only. Research tasks, failed attempts, approvals, voice audio, keys and settings are excluded. No auto-save or auto-load into AI context. Background still clears the active temporary workspace, not explicitly saved snapshots.")
        label("Local snapshots use AndroidKeyStore and are excluded from Android backup/device transfer. Uninstall, Clear Data or loss of that key can make them unrecoverable. Export a separately password-encrypted backup if you need portability. Local deletion cannot delete provider records or copies you exported. An explicitly started save/delete may finish after you leave.")
    }
    fun enter() {visible=true;refresh()}
    fun leave() {visible=false;epoch++;cancelDeadline();dialog?.dismiss();dialog=null;dialogCleanup?.invoke();dialogCleanup=null;listing=null;rows.removeAllViews();busy=false}
    fun dispose() {leave();handler.removeCallbacksAndMessages(null)}
    fun cancelDialog(): Boolean {if(dialog?.isShowing!=true) return false;epoch++;dialog?.dismiss();return true}
    private fun readSecret(input: EditText)=CharArray(input.text.length).also {input.text.getChars(0,it.size,it,0)}
    private fun ready()=visible && !busy
    private fun enable() {actions.forEach {it.isEnabled=ready()}}
    private fun label(text: String,parent: LinearLayout=view)=TextView(host).apply {this.text=text;MayaTheme.label(this,13f);setPadding(0,8,0,8);isSaveEnabled=false;parent.addView(this)}
    private fun button(parent: LinearLayout,title: String,action: ()->Unit)=Button(host).apply {
        MayaTheme.button(this,title);setOnClickListener {if(ready()) action()};parent.addView(this)
        if(parent===view) actions.add(this)
    }
    private fun input(hint: String,password: Boolean=false,limit: Int=80)=EditText(host).apply {
        this.hint=hint;MayaTheme.editor(this,false);isSaveEnabled=false;importantForAutofill=View.IMPORTANT_FOR_AUTOFILL_NO
        filters=arrayOf(InputFilter.LengthFilter(limit));minHeight=(48*host.resources.displayMetrics.density).toInt()
        inputType=if(password) InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD else InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE or InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
        imeOptions=android.view.inputmethod.EditorInfo.IME_FLAG_NO_EXTRACT_UI or android.view.inputmethod.EditorInfo.IME_FLAG_NO_PERSONALIZED_LEARNING
    }
    private fun show(title: String,message: String,body: View?=null,positive: String="Confirm",cleanup: ()->Unit={},yes: ()->Unit) {
        if(!ready() || dialog?.isShowing==true) return
        val ticket=++epoch
        dialogCleanup=cleanup
        val builder=AlertDialog.Builder(host).setTitle(title).setMessage(message).setNegativeButton("Cancel",null)
        if(body!=null) builder.setView(ScrollView(host).apply {isSaveEnabled=false;addView(body)})
        dialog=builder.setPositiveButton(positive) {_,_->if(ready() && epoch==ticket) {epoch++;yes()}}.create().also {d ->
            d.setOnDismissListener {if(epoch==ticket) epoch++;cleanup();dialogCleanup=null}
            d.show();MayaTheme.dialog(d);d.getButton(AlertDialog.BUTTON_POSITIVE).filterTouchesWhenObscured=true
            val window=d.window;val callback=window?.callback
            if(window!=null && callback!=null) window.callback=object : Window.Callback by callback {
                override fun dispatchTouchEvent(e: MotionEvent): Boolean {
                    if(e.flags and (MotionEvent.FLAG_WINDOW_IS_OBSCURED or MotionEvent.FLAG_WINDOW_IS_PARTIALLY_OBSCURED)!=0) {epoch++;d.dismiss();return true}
                    return callback.dispatchTouchEvent(e)
                }
            }
        }
    }
    private fun <T> perform(work: ()->T,done: (T)->Unit) = perform(work,done,{})
    private fun <T> perform(work: ()->T,done: (T)->Unit,onRejected: ()->Unit) {
        if(!ready()) {onRejected();return}
        busy=true;enable();val ticket=++epoch;status.text="Working locally… No network request."
        deadline=Runnable {if(visible && epoch==ticket) {epoch++;deadline=null;busy=false;enable();status.text="Local wait timed out. A confirmed disk operation may still finish. Nothing retried; refresh later to inspect the result."}}
            .also {handler.postDelayed(it,15000)}
        try {worker.execute {
            val result=runCatching {work()}
            handler.post {
                if(visible && epoch==ticket) {
                    cancelDeadline();busy=false;enable()
                    result.fold({done(it)},{status.text="Local operation failed or saved data changed. Existing unreadable data was not overwritten. Refresh to inspect; no automatic retry."})
                } else (result.getOrNull() as? ByteArray)?.fill(0)
            }
        }} catch(_: Exception) {cancelDeadline();busy=false;enable();onRejected();status.text="Local storage worker is occupied. Nothing queued. Retry explicitly when it finishes."}
    }
    private fun refresh() {
        if(!ready()) return
        listing=null;rows.removeAllViews()
        perform({vault().list()}) {value ->listing=value;render(value);status.text="${value.items.size}/10 saved snapshots. Opening the list does not add AI context."}
    }
    private fun render(value: WorkspaceVault.Listing) {
        rows.removeAllViews()
        value.items.forEach {item ->
            val card=LinearLayout(host).apply {orientation=LinearLayout.VERTICAL;setPadding(12,12,12,12);background=MayaTheme.shape(host);rows.addView(this)}
            label(item.title,card)
            label("${item.messages.size} Direct messages · draft ${item.draft.length} chars · code ${item.code?.length ?: 0} chars · ${java.text.DateFormat.getDateTimeInstance().format(java.util.Date(item.savedAt))}",card)
            button(card,"Review saved snapshot") {review(item,value.revision)}
            button(card,"Export encrypted backup") {export(item,value.revision)}
            button(card,"Delete this snapshot") {show("Delete ${item.title}?","Deletes only this encrypted local snapshot. Active conversation, credentials, provider records and exported copies are not deleted.") {
                perform({vault().delete(item.id,value.revision)}) {refresh()}
            }}
        }
    }
    private fun preview(item: SavedWorkspace)=TextView(host).apply {
        MayaTheme.label(this,14f);isSaveEnabled=false;setTextIsSelectable(true)
        text=buildString {
            append("Saved data only. No approvals or automatic Send.\n\n")
            item.messages.forEach {append(it.role.uppercase());append(":\n");append(it.content);append("\n\n")}
            append("DRAFT:\n${item.draft}\n\nBUILDER index.html:\n${item.code ?: "(none)"}")
        }
    }
    private fun save() {
        val value=listing ?: run {status.text="Refresh the saved list first. A corrupt/lost-key vault must be explicitly deleted, never silently replaced.";return}
        val snapshot=capture()
        if(snapshot.messages.isEmpty() && snapshot.draft.isEmpty() && snapshot.code==null) {status.text="No Direct messages, draft or Builder file to save.";return}
        val title=input("Snapshot name · 1–80 characters")
        show("Save encrypted local snapshot?","Includes ${snapshot.messages.size} completed Direct messages, draft (${snapshot.draft.length} chars) and Builder code (${snapshot.code?.length ?: 0} chars). Excludes Agent results, attempts, proposals, previews, approvals, credentials and audio. This explicit snapshot survives background/exit.",title,"Save",{title.text.clear()}) {
            val name=title.text.toString().trim()
            if(snapshot!=capture()) {status.text="Workspace changed while reviewing. Nothing saved; review a new snapshot.";return@show}
            val item=try {snapshot.item(name).also {WorkspaceArchive.validate(it)}} catch(_: Exception) {status.text="Snapshot/name is invalid or exceeds limits. Nothing saved or truncated.";return@show}
            perform({vault().append(listOf(item),value.revision)}) {refresh()}
        }
    }
    private fun review(item: SavedWorkspace,revision: String) {
        show("Review ${item.title}","Open replaces the CURRENT temporary workspace with this snapshot. Current tasks/approvals are discarded and Direct consent stays OFF. It does not send, run code, preview, play audio or resume work. Existing context limits still apply.",preview(item),"Open locally") {
            perform({val current=vault().list();require(current.revision==revision);item}) {restore(it)}
        }
    }
    private fun erase() {
        show("Delete ALL saved work?","Permanently deletes Maya's saved-work encryption key and local archive, including unreadable data. This cannot be undone without your separate exported backup and password. Active workspace, Fish/settings/identity and provider records are NOT deleted.",positive="Delete saved work") {
            perform({vault().eraseAll()}) {refresh()}
        }
    }
    private fun export(item: SavedWorkspace,revision: String) {
        val body=LinearLayout(host).apply {orientation=LinearLayout.VERTICAL}
        val password=input("New backup password · 12–128 characters",true,128);val repeat=input("Repeat password",true,128)
        body.addView(password);body.addView(repeat)
        show("Encrypt a portable backup","Exports only this saved snapshot, not settings, keys or other conversations. Use a strong unique password; Maya cannot recover it. Keep password separately. The next step offers encrypted TEXT for copying, not an automatic upload or file backup.",body,"Encrypt",{password.text.clear();repeat.text.clear()}) {
            val secret=readSecret(password)
            val repeated=readSecret(repeat);val matches=secret.contentEquals(repeated);repeated.fill('\u0000')
            if(secret.size !in 12..128 || !matches) {secret.fill('\u0000');status.text="Passwords must match and contain 12–128 characters. Nothing exported.";return@show}
            perform({try {require(vault().list().revision==revision);WorkspaceBackup.seal(listOf(item),secret)} finally {secret.fill('\u0000')}}, {bytes ->
                val encoded=java.util.Base64.getEncoder().encodeToString(bytes);bytes.fill(0)
                if(encoded.length>BACKUP_TEXT_LIMIT) {status.text="Backup exceeds clipboard safety limit. Nothing copied.";return@perform}
                show("Copy encrypted backup text?","Android's clipboard/keyboard or clipboard-sync service may retain this ciphertext. Anyone with it can attempt to guess your password. Your password is NOT copied. Paste into your own safe backup location; copying alone is not a verified backup.",positive="Copy encrypted text") {
                    try {(host.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newPlainText("Maya encrypted snapshot v1",encoded));status.text="Encrypted text copied. Save it separately and keep its password separate. Maya has not verified your external copy."}
                    catch(_: Exception) {status.text="Clipboard copy failed. No backup file was created."}
                }
            }, {secret.fill('\u0000')})
        }
    }
    private fun importBackup() {
        val value=listing ?: run {status.text="Refresh the local list before importing. Unreadable data must not be overwritten.";return}
        val body=LinearLayout(host).apply {orientation=LinearLayout.VERTICAL}
        val encoded=input("Paste Maya encrypted backup text",false,BACKUP_TEXT_LIMIT).apply {minLines=2;maxLines=4}
        val password=input("Backup password",true,128);body.addView(encoded);body.addView(password)
        show("Decrypt backup for review","Clipboard is never read automatically. Paste a Maya backup yourself. Wrong password, tampering, unsupported format or limits fail without changing saved work. Nothing imported until you review and confirm.",body,"Decrypt",{encoded.text.clear();password.text.clear()}) {
            val text=encoded.text.toString();val secret=readSecret(password)
            perform({try {
                require(text.length<=BACKUP_TEXT_LIMIT);val raw=java.util.Base64.getDecoder().decode(text.filterNot {it in " \r\n\t"})
                try {WorkspaceBackup.open(raw,secret).also {require(it.size==1)}.single()} finally {raw.fill(0)}
            } finally {secret.fill('\u0000')}}, {item ->
                val copy=SavedWorkspace(UUID.randomUUID().toString(),item.title,item.savedAt,item.messages,item.draft,item.code)
                show("Import ${copy.title}?","Adds ONE encrypted local snapshot. Does not overwrite existing items, open it, add AI context, send or resume tasks. Importing a duplicate creates another copy. Review the data below.",preview(copy),"Import snapshot") {
                    perform({vault().append(listOf(copy),value.revision)}) {refresh()}
                }
            },{secret.fill('\u0000')})
        }
    }
}
