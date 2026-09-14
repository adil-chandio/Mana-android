package com.maya.ai.chat

import android.app.AlertDialog
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.ContextWrapper
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.content.res.ColorStateList
import android.view.inputmethod.InputMethodManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.text.Editable
import android.text.InputFilter
import android.text.InputType
import android.text.TextWatcher
import android.view.MotionEvent
import android.view.View
import android.view.inputmethod.EditorInfo
import android.widget.*
import com.maya.ai.chat.NativeChatReadiness.Reason
import androidx.appcompat.app.AppCompatActivity
import com.maya.ai.BuildConfig
import com.maya.ai.MainActivity
import com.maya.ai.WakeWordService
import java.util.concurrent.SynchronousQueue
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit

/** Native text screen with explicit, opt-in Fish playback. No WebView, device bridge or incoming intent data. */
class NativeChatWorkspace(private val host: AppCompatActivity, private val close: () -> Unit) : ContextWrapper(host) {
    companion object {
        private var sharedAccessDiagnostic: NativeAccessDiagnostic? = null
        @Synchronized private fun getAccessDiagnostic(context: Context): NativeAccessDiagnostic {
            return sharedAccessDiagnostic ?: run {
                val prefs = context.applicationContext.getSharedPreferences("maya_access_diagnostic", Context.MODE_PRIVATE)
                NativeAccessDiagnostic(object : NativeAccessDiagnostic.Store {
                    override fun read(): String? = prefs.getString("last_check", null)
                    override fun write(value: String) { prefs.edit().putString("last_check", value).apply() }
                }).also { sharedAccessDiagnostic = it }
            }
        }
        const val OPEN_LINK = "maya-private-chat://open"
        // Shared single worker, no pending queue: an uninterruptible Keystore operation
        // cannot create an unbounded pile of threads/jobs across Activity recreation.
        private val executor = ThreadPoolExecutor(1, 1, 30, TimeUnit.SECONDS, SynchronousQueue()).apply { allowCoreThreadTimeOut(true) }
    }
    private class Job(val kind: String, val turn: NativeChatConversation.Turn?, val started: Long) {
        val operation = NativeChatTransport.Operation { SystemClock.elapsedRealtime() }
        var timeout: Runnable? = null
        var readinessTimeout: Runnable? = null
        var waitingReadiness = false
        var accessTicket: NativeAccessDiagnostic.Ticket? = null
        @Volatile var accessHttp = 0
    }
    private val handler = Handler(Looper.getMainLooper())
    private val session = NativeChatConversation { SystemClock.elapsedRealtime() }
    private val identity = NativeChatIdentity()
    private val transport by lazy { NativeChatTransport() }
    private var speechPlayer: com.maya.ai.voice.FishStreamPlayer? = null
    private var speechProbeGeneration = 0L
    private val speech: NativeReplySpeech by lazy {
        NativeReplySpeech(object : NativeReplySpeech.Port {
            override fun prepare(text: String?, result: (NativeFishPolicy.Result) -> Unit) {
                val gen = ++speechProbeGeneration
                val main = MainActivity.instance
                if (main == null) result(NativeFishPolicy.Result.Error(NativeFishPolicy.Code.MAIN_REQUIRED))
                else main.prepareNativeFish(text, { visible && gen == speechProbeGeneration && speech.busy }, result)
            }
            override fun play(prepared: NativeFishPolicy.Result.Prepared, event: (String, Int) -> Unit): Boolean {
                if (!visible || runtimeReadiness() != Reason.READY) return false
                // Dedicated owner, strict one-exchange transport; never stop a legacy speaker to start.
                val player = com.maya.ai.voice.FishStreamPlayer(host, strictNetwork = true) { _, kind, code -> event(kind, code) }
                speechPlayer = player
                return player.speakExclusive(prepared.body, prepared.headers, "native_sunao") { event("interrupted", 0) }
            }
            override fun stopOwned() {
                speechProbeGeneration++
                val player = speechPlayer; speechPlayer = null; player?.stop()
            }
        }, { delay, task ->
            val pending = Runnable { task() }; handler.postDelayed(pending, delay)
            val cancel: () -> Unit = { handler.removeCallbacks(pending) }; cancel
        }, { code ->
            if (::speechStatus.isInitialized) {
                speechStatus.visibility = View.VISIBLE
                speechStatus.text = "Fish · ${code.name}\n${code.hint}"
            }
            paint()
        })
    }
    private lateinit var speechStatus: TextView
    private lateinit var fishCheck: Button
    private lateinit var fishSample: Button
    private val speechButtons = mutableListOf<Pair<Button, String>>()
    private var active: Job? = null
    private var visible = false
    private var agentSelected = false
    private var section = 0
    private lateinit var modePicker: Spinner
    private lateinit var menuPanel: LinearLayout
    private lateinit var emptyState: LinearLayout
    private lateinit var projectChip: TextView
    private lateinit var stopSpace: View
    private var voiceComponent: View?=null
    private var voiceExpanded=false
    private val agentCards = mutableListOf<com.maya.ai.agent.WorkspaceTask>()
    private val timeline = mutableListOf<Any>() // completed Direct messages and owned inline Agent cards
    private var shownDirect = 0
    private var kindSelection=0
    private lateinit var agentKind: Spinner
    private var buildTask: com.maya.ai.agent.InlineBuildTurn?=null
    private var collapseVoiceSettings: () -> Unit = {}
    private val researchServices: com.maya.ai.agent.ResearchServices by lazy { com.maya.ai.agent.ResearchBackend(applicationContext) }
    private val agentBusy get() = agentCards.any { it.busy }
    private val anyBusy get() = active != null || speech.busy || agentBusy
    private var publicText: String? = null
    private lateinit var status: TextView
    private lateinit var readinessResult: TextView
    private lateinit var readinessButton: Button
    private var readinessReason = Reason.NOT_CHECKED
    private lateinit var contextNote: TextView
    private lateinit var history: LinearLayout
    private lateinit var keyText: TextView
    private lateinit var counter: TextView
    private lateinit var draft: EditText
    private lateinit var consent: CheckBox
    private lateinit var send: Button
    private lateinit var stop: Button
    private lateinit var create: Button
    private lateinit var copy: Button
    private lateinit var check: Button
    private lateinit var accessDiagnostic: NativeAccessDiagnostic
    private lateinit var accessResult: TextView
    private lateinit var touchWarning: TextView
    private var obscuredTouchSeen = false
    private var disclosure: AlertDialog? = null
    private var confirmationGeneration = 0L

    fun createView(voiceSurface: View? = null, voiceSettings: ((Boolean) -> Unit)? = null): View {
        accessDiagnostic = getAccessDiagnostic(this)
        readinessReason = try { NativeChatReadiness.restore(getSharedPreferences("maya_readiness_diagnostic", Context.MODE_PRIVATE)
            .getString("reason", null)) } catch (_: Exception) { Reason.NOT_CHECKED }
        fun column() = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; isSaveEnabled = false
            importantForAutofill = View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS
        }
        menuPanel=column().apply {tag="workspace_menu";visibility=View.GONE;background=MayaTheme.shape(this@NativeChatWorkspace);setPadding(dp(12),dp(8),dp(12),dp(8))}
        val chatPage = column().apply { tag = "chat_page" }
        val checksPage = column().apply { tag = "checks_page" }
        val infoPage = column().apply { tag = "info_page" }
        var root = checksPage
        fun label(text: String, size: Float = 15f): TextView = labelView(text, size).also { root.addView(it) }
        fun button(text: String, action: () -> Unit): Button = actionButton(text, action).also { root.addView(it) }
        label("Local readiness · no network", 18f)
        readinessResult = label(readinessReport(), 15f).apply { accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE }
        readinessButton = button("Check local Send readiness · no network") { start("readiness", null) { Unit } }
        button("Copy readiness report") {
            val report = "MAYA ${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})\n" + readinessReport()
            (getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newPlainText("Maya local readiness", report))
            status.text = "Fixed local readiness report copied. No keys, conversation or server details included."
        }
        label("This check sends nothing and changes no settings. Only its last fixed reason code is kept locally. A READY result is historical; Send checks again and signs with the saved key. Showing/copying the public key is not required. A missing key stops locally.")
        label("Selected Fish · optional voice", 18f)
        label("Main Maya already owns this conversation and saved Fish setup. Compatibility launchers cannot start Main or copy credentials. Nothing plays on entry.")
        fishCheck = button("Check saved Fish setup · no network") { if (active == null && visible) speech.check() }
        fishSample = button("Test saved Fish voice · short sample") {
            confirmSpeech("Salam, yeh aapki saved Fish voice ka chhota test hai.") { true }
        }
        button("Copy Fish report") {
            val report = "MAYA ${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})\nFish: ${speech.state.name}\n${speech.state.hint}\nLocal status at copy time; no keys, reference ID or text included."
            (getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newPlainText("Maya Fish status", report))
        }
        label("Setup check sends nothing. Test/Sunao requires confirmation and sends only that text to Fish. Same saved reference; no default, paid model or replacement voice. Server Chat may stay OFF for the short sample.")
        label("APK ACCESS · NO AI", 18f)
        accessResult = label(accessDiagnostic.report(), 15f).apply {
            setTextIsSelectable(true); accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
        }
        touchWarning = label("", 15f).also {observeText(it) {v -> v.visibility=if(v.text.isEmpty()) View.GONE else View.VISIBLE}}
        check = button("Check APK access + replay · no AI") { start("check", null) { job ->
            val signed = identity.sign(null); job.operation.check()
            accessStage(job, NativeAccessDiagnostic.Stage.FIRST_REQUEST)
            val first = transport.execute(signed, job.operation)
            job.accessHttp = if (first is NativeChatResponse.Result.Error) first.status else 200
            if (first is NativeChatResponse.Result.Error) first
            else {
                if (first !== NativeChatResponse.Result.Access) throw NativeChatProtocol.Rejected("INVALID_SERVER_RESPONSE")
                job.operation.check()
                accessStage(job, NativeAccessDiagnostic.Stage.REPLAY_REQUEST)
                val second = transport.execute(signed, job.operation)
                job.accessHttp = if (second is NativeChatResponse.Result.Error) second.status else 200
                if (second !is NativeChatResponse.Result.Error || second.status != 409 || second.code != "REPLAY_OR_WINDOW_FULL" || second.remoteUncertain)
                    throw NativeChatProtocol.Rejected("REPLAY_CHECK_FAILED")
                NativeChatResponse.Result.Access
            }
        } }
        label("Uses your existing saved APK key directly. No need to show/copy it first. This check never creates a key and does not require Chat ON or the message-consent checkbox.")
        button("Copy check report") {
            val report = "MAYA ${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})\n" + accessDiagnostic.report() +
                "\nObscured touch blocked: $obscuredTouchSeen"
            (getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newPlainText("Maya access diagnostic", report))
            status.text = "Fixed diagnostic report copied. Paste it after leaving this screen; no messages, keys or signatures included."
        }
        button("Clear check report") {
            if (active == null) { accessDiagnostic.clear(); showAccessDiagnostic() }
        }
        label("Only the last fixed diagnostic state/code/count/duration is retained locally (best effort). Chat, keys, signatures and server bodies are NOT stored in that report. Backgrounding still clears conversation/consent, not the completed check report.")
        label("APK identity · advanced setup", 18f)
        label("Creates/shows only this APK's public identity. Server authorization is manual: APK_PUBLIC_JWK. Never replace OWNER_PUBLIC_JWK or copy a browser private key.")
        create = button("Create / show APK public key") {
            confirm("APK signing identity", "Create a separate key if missing, or show the existing PUBLIC key. No network, registration or replacement. Hardware-backed storage is not guaranteed.") {
                start("key", null) { identity.createExplicitly() }
            }
        }
        keyText = label("No public key displayed yet.", 13f).apply { setTextIsSelectable(true) }
        copy = button("Copy PUBLIC key") {
            val text = publicText ?: return@button
            (getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newPlainText("APK_PUBLIC_JWK", text))
            status.text = "PUBLIC key copied. Add it only to APK_PUBLIC_JWK in the owner's Worker settings. The browser key must stay unchanged."
        }
        root = chatPage
        voiceComponent=voiceSurface
        if(voiceSurface!=null) {
            voiceSurface.isSaveEnabled=false
            voiceSurface.importantForAutofill=View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS
            root.addView(voiceSurface,LinearLayout.LayoutParams(-1,dp(128)))
            voiceExpanded=false
            voiceSurface.setOnTouchListener {v,event ->
                if(voiceExpanded && event.actionMasked==MotionEvent.ACTION_DOWN) v.parent?.requestDisallowInterceptTouchEvent(true)
                if(event.actionMasked==MotionEvent.ACTION_UP || event.actionMasked==MotionEvent.ACTION_CANCEL) v.parent?.requestDisallowInterceptTouchEvent(false)
                false // Original WebView still handles the gesture, not an alternate activity.
            }
            collapseVoiceSettings={
                voiceExpanded=false
                voiceSurface.layoutParams=voiceSurface.layoutParams.apply {height=dp(128)}
                voiceSettings?.invoke(false)
            }
            val voiceButton=button("Original settings · expand here") {
                if(anyBusy || !visible) return@button
                stopActive("Settings toggled; pending work/confirmations revoked.")
                voiceExpanded=!voiceExpanded
                voiceSurface.layoutParams=voiceSurface.layoutParams.apply {height=dp(if(voiceExpanded) 460 else 128)}
                voiceSettings?.invoke(voiceExpanded)
                menuPanel.visibility=View.GONE
            }
            root.removeView(voiceButton);menuPanel.addView(voiceButton)
        }
        emptyState=column().apply {tag="empty_state";setPadding(0,dp(12),0,dp(24))}
        emptyState.addView(labelView("Kya karna hai?",26f).apply {gravity=android.view.Gravity.CENTER;typeface=Typeface.create("sans-serif-medium",Typeface.NORMAL)})
        emptyState.addView(labelView("Baat karo. Research karo. Kuch banao.",14f).apply {gravity=android.view.Gravity.CENTER;setTextColor(MayaTheme.muted)})
        root.addView(emptyState)
        contextNote = labelView("Context: no completed messages.",13f).also {infoPage.addView(it)}
        consent = CheckBox(this).apply {
            text = "Allow this Direct conversation → Cloudflare AI"
            contentDescription="Allow sending this Direct conversation to Cloudflare AI. Use nonsensitive text. Details and revocation are in Privacy."
            textSize=13f
            filterTouchesWhenObscured = true; MayaTheme.toggle(this); isSaveEnabled = false; root.addView(this)
        }
        history = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; isSaveEnabled = false; tag = "conversation_timeline"; root.addView(this) }
        val composer = column().apply {tag = "shared_composer_area";background=MayaTheme.shape(this@NativeChatWorkspace,radius=20);setPadding(dp(8),dp(8),dp(8),dp(8))}
        root.removeView(consent)
        projectChip=labelView("index.html · current project",12f).apply {tag="current_project";setTextColor(MayaTheme.copper);setPadding(dp(8),0,dp(8),dp(4));visibility=View.GONE}
        composer.addView(projectChip)
        root = composer
        val controls=LinearLayout(this).apply {orientation=LinearLayout.HORIZONTAL;gravity=android.view.Gravity.CENTER_VERTICAL;tag="composer_controls"}
        modePicker=Spinner(this).apply {
            tag="mode_picker";isSaveEnabled=false;filterTouchesWhenObscured=true
            adapter=choiceAdapter(listOf("Direct Chat", "Agent"));background=MayaTheme.shape(this@NativeChatWorkspace,MayaTheme.surface,10,false)
            contentDescription="Choose Direct Chat or Agent mode"
            onItemSelectedListener=object : AdapterView.OnItemSelectedListener {
                override fun onNothingSelected(parent: AdapterView<*>?) {}
                override fun onItemSelected(parent: AdapterView<*>?,view: View?,position: Int,id: Long) {changeMode(position==1)}
            }
        }
        controls.addView(modePicker,LinearLayout.LayoutParams(dp(88),dp(48)))
        agentKind=Spinner(this).apply {
            tag="agent_kind";isSaveEnabled=false
            adapter=choiceAdapter(listOf("Research", "Build page"));contentDescription="Agent task: public research or static page Builder"
            filterTouchesWhenObscured=true;background=MayaTheme.shape(this@NativeChatWorkspace,MayaTheme.surface,10,false)
            controls.addView(this,LinearLayout.LayoutParams(dp(88),dp(48)))
            onItemSelectedListener=object : AdapterView.OnItemSelectedListener {
                override fun onNothingSelected(parent: AdapterView<*>?) {}
                override fun onItemSelected(parent: AdapterView<*>?,view: View?,position: Int,id: Long) {
                    if(position!=kindSelection) {kindSelection=position;if(::stop.isInitialized) stopActive("Task type selected. Draft and conversation kept; nothing sent.")}
                }
            }
        }
        counter = label("Your message · 0 / 2,000",12f).apply {setPadding(0,0,0,0)}
        val composeRow = LinearLayout(this).apply {orientation=LinearLayout.HORIZONTAL;root.addView(this)}
        draft = EditText(this).apply {
            tag="shared_composer";hint="Message Maya…";setHintTextColor(MayaTheme.muted);setTextColor(MayaTheme.text);textSize=16f
            minLines=1;maxLines=if(resources.configuration.fontScale>1.3f) 1 else 3;inputType=InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE or InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
            imeOptions=EditorInfo.IME_FLAG_NO_EXTRACT_UI or EditorInfo.IME_FLAG_NO_PERSONALIZED_LEARNING
            filters=arrayOf(InputFilter.LengthFilter(2000));isSaveEnabled=false;importantForAutofill=View.IMPORTANT_FOR_AUTOFILL_NO
            contentDescription="One message box for Direct Chat or Agent mode. Mode changes never erase or send the draft."
            setPadding(dp(10),dp(8),dp(10),dp(8));background=MayaTheme.shape(this@NativeChatWorkspace,MayaTheme.surface,12,false)
        }
        send = actionButton("Send message") {
            if(anyBusy || !visible || section!=0) return@actionButton
            if(agentSelected) { submitAgent();return@actionButton }
            agentCards.forEach {it.stop()}
            try {
                val turn=session.begin(draft.text.toString(),consent.isChecked);hideKeyboard()
                start("chat",turn) {job ->
                    val signed=identity.sign(turn.input);job.operation.check()
                    if(signed.body!=turn.body) throw NativeChatProtocol.Rejected("INVALID_REQUEST")
                    transport.execute(signed,job.operation) {session.markDispatched(turn)}
                }
            } catch(e: NativeChatProtocol.Rejected) {status.text=errorText(e.code,false);paint()}
        }
        draft.minHeight=dp(56)
        composeRow.addView(draft,LinearLayout.LayoutParams(-1,-2))
        composer.addView(consent)
        controls.addView(View(this),LinearLayout.LayoutParams(0,1,1f))
        controls.addView(send,LinearLayout.LayoutParams(dp(48),dp(48)))
        stopSpace=View(this).apply {visibility=View.GONE};controls.addView(stopSpace,LinearLayout.LayoutParams(dp(48),dp(48)))
        composer.addView(controls)
        stop=actionButton("STOP") {stopActive("Stopped locally.")}.apply {tag="global_stop";text="■";textSize=20f;contentDescription="Stop current work"}
        buttonColors(send,MayaTheme.copper,MayaTheme.ink);buttonColors(stop,Color.rgb(65,37,40),MayaTheme.danger)
        root = infoPage
        val newConversation=button("Clear local chat") {
            confirm("Clear this conversation?", "Clear Direct Chat, inline Agent tasks, sources, draft and approvals. Saved key and voice stay unchanged; remote records/usage are not erased.") {
                stopActive("Cleared locally.");clearAgents();session.clear();draft.setText("");consent.isChecked=false;renderHistory();paint()
            }
        }
        root.removeView(newConversation);menuPanel.addView(newConversation,0)
        button("Revoke Direct consent") {stopActive("Direct consent revoked.");consent.isChecked=false;paint()}
        label("Privacy & limits", 21f)
        label("MAYA ${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE}) · development build",12f)
        label("The original orb focuses this composer. Sunao uses saved Fish after confirmation; unified voice dictation is not available here.",13f)
        label("Normal Chat sends text only, with optional manual Fish playback. Agent mode adds inline, separately consented bounded public research to this same conversation. Original assistant settings remain separate.")
        label("LEAVING THIS SCREEN = NEW CONVERSATION", 17f)
        label("Backgrounding, closing or recreating this screen clears draft, consent and chat. Keep follow-ups here. Your APK key stays in Android Keystore.")
        label("2,000 characters/message · 6,000 in context · 12 messages. 5 admitted requests/minute, 50/day shared with browser Chat; no guarantee of free capacity.")
        label("STOP ends local waiting, not guaranteed remote work or a refund. Failed/uncertain turns are excluded from follow-ups. No automatic retries, history storage or message logging.")
        label("Replies are untrusted plain text and may be inaccurate. Never enter passwords, OTPs, provider tokens or private keys.")
        label("Chat uses the saved APK key; displaying it is not required. Server Chat availability is controlled by the owner, not by these tabs. Checks are explicit; opening this screen performs none.")
        label("Sunao sends only the chosen reply (using the original local speech-text conversion) to api.fish.audio with the saved Fish reference/key. Nothing plays automatically; confirmation is required each time. Never paste keys into Chat.")
        label("Sunao: 2,000 input characters, one synthesis request, no silent truncation or retries. Startup wait is capped at 30 seconds, playback at 180 seconds, and the total local job at 210 seconds. STOP/exit stops local audio, not guaranteed remote work or a refund.")
        label("Selected Fish voice, wake and original assistant settings remain unchanged. The configured free Fish model may be unavailable or quota-limited; no free/unlimited guarantee or fallback. Media analysis and cross-app automation are not enabled. Agent mode uses this composer and timeline, with explicit consent and plan approval.")

        label("Direct Chat context contains completed Direct turns only. Build static page is an Agent task: one local index.html with optional small AI proposals and isolated static preview, not a full IDE. Agent goals use the current message; recent Direct excerpts can be explicitly selected in the plan consent. Source sharing/explanation needs its own consent. Use a source’s composer action to ask Direct Chat about it; no hidden history transfer.")
        label("At most 3 Agent task cards per local conversation; clear explicitly when full. Switching modes stops work/revokes approvals but preserves the timeline. Leaving clears everything. Full cross-app control, Vision and saved history are not implemented.")

        val shell = column().apply {
            setBackgroundColor(MayaTheme.background); setPadding(dp(16), dp(8), dp(16), dp(8))
        }
        val header=LinearLayout(this).apply {orientation=LinearLayout.HORIZONTAL;gravity=android.view.Gravity.CENTER_VERTICAL;tag="workspace_header"}
        header.addView(labelView("Maya",21f).apply {typeface=Typeface.create("sans-serif-medium",Typeface.NORMAL)},LinearLayout.LayoutParams(0,dp(56),1f))
        header.addView(actionButton("Workspace menu") {
            confirmationGeneration++;disclosure?.dismiss();disclosure=null
            agentCards.forEach {it.stop()}
            menuPanel.visibility=if(menuPanel.visibility==View.GONE) View.VISIBLE else View.GONE
        }.apply {text="⋯";textSize=24f;tag="workspace_menu_toggle"},LinearLayout.LayoutParams(dp(48),dp(48)))
        shell.addView(header)
        val tabs=menuPanel
        val body = column()
        status = labelView("No Chat request sent. Server Chat is owner-controlled.", 13f).apply {
            tag = "chat_status"; accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
        }
        body.addView(menuPanel)
        observeText(status) {updateStatusVisibility()}
        MayaTheme.status(status)
        body.addView(status)
        speechStatus = labelView("Fish · IDLE\n" + NativeFishPolicy.Code.IDLE.hint, 13f).apply {
            tag = "fish_status"; visibility = View.GONE; accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
        }
        body.addView(speechStatus)
        // Overlay warnings remain visible on every tab, never hidden in setup details.
        checksPage.removeView(touchWarning); body.addView(touchWarning)
        val pages = listOf(checksPage, infoPage, chatPage)
        pages.forEach { body.addView(it) }
        val scroll = ScrollView(this).apply { isSaveEnabled = false; isFillViewport = true; addView(body) }
        shell.addView(scroll, LinearLayout.LayoutParams(-1, 0, 1f))
        // Reserve the fixed footer in the content layout; it cannot be pushed offscreen by IME/wrapping.
        shell.setPadding(dp(16),dp(8),dp(16),dp(168))
        val surface=FrameLayout(this).apply {
            isSaveEnabled=false;setBackgroundColor(MayaTheme.background)
            importantForAutofill=View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS
            addView(shell,FrameLayout.LayoutParams(-1,-1))
            addView(composer,FrameLayout.LayoutParams(-1,-2,android.view.Gravity.BOTTOM).apply {
                leftMargin=dp(16);rightMargin=dp(16);bottomMargin=dp(12)
            })
            addView(stop,FrameLayout.LayoutParams(dp(48),dp(48),android.view.Gravity.BOTTOM or android.view.Gravity.RIGHT).apply {
                rightMargin=dp(24);bottomMargin=dp(20)
            })
        }
        fun reserveComposer() {
            val space=dp(12)+composer.measuredHeight.coerceAtLeast(dp(120))
            if(shell.paddingBottom!=space) shell.setPadding(dp(16),dp(8),dp(16),space)
        }
        composer.addOnLayoutChangeListener {_,_,_,_,_,_,_,_,_ -> reserveComposer()}
        // Utilities expand IN the conversation; never hide its timeline or composer.
        val detailButtons=mutableListOf<Button>()
        fun showDetails(index: Int) {
            confirmationGeneration++;disclosure?.dismiss();disclosure=null;agentCards.forEach {it.stop()}
            menuPanel.visibility=View.GONE
            checksPage.visibility=if(index==1) View.VISIBLE else View.GONE
            infoPage.visibility=if(index==2) View.VISIBLE else View.GONE
            chatPage.visibility=View.VISIBLE
            detailButtons.forEachIndexed {i,button -> button.isSelected=i==index}
            detailButtons.firstOrNull()?.visibility=if(index==0) View.GONE else View.VISIBLE
            paint()
        }
        listOf("Close details", "Checks ▾", "Privacy ▾").forEachIndexed {i,title ->
            actionButton(title) {showDetails(if(i>0 && detailButtons[i].isSelected) 0 else i)}.also {
                it.tag=listOf("details_close","details_checks","details_info")[i]
                detailButtons.add(it)
                if(i==0) body.addView(it,0) else tabs.addView(it,LinearLayout.LayoutParams(-1,-2))
            }
        }
        showDetails(0)
        draft.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) { paint() }
            override fun afterTextChanged(s: Editable?) {}
        })
        consent.setOnCheckedChangeListener { _, _ -> paint() }
        paint()
        // Deliberately no key creation, read, check, request or intent parsing on load.
        return surface
    }
    private fun changeMode(agent: Boolean) {
        if(agentSelected==agent) return
        confirmationGeneration++;disclosure?.dismiss();disclosure=null
        if(::stop.isInitialized) stopActive("Mode changed; active work stopped, conversation retained.")
        agentSelected=agent;paint()
    }
    fun selectAgentMode() {modePicker.setSelection(1);changeMode(true)}
    fun selectDirectMode() {modePicker.setSelection(0);changeMode(false)}
    fun focusComposer() {
        if(!visible || anyBusy) return
        draft.requestFocus()
        (getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager)?.showSoftInput(draft,InputMethodManager.SHOW_IMPLICIT)
    }
    private fun clearAgents() {
        val old=agentCards.toList();agentCards.clear();buildTask=null;timeline.clear();shownDirect=0
        old.forEach {it.dispose()}
    }
    private fun submitAgent() {
        if(agentKind.selectedItemPosition==1) {submitBuild();return}
        val value=draft.text.toString()
        val manual=try {com.maya.ai.agent.ResearchPlan.parse(value)} catch (_: Exception) {null}
        if(value.isBlank() || !NativeChatProtocol.validReply(value) || (manual==null && value.length>400)) {
            status.text="Agent goal needs 1–400 characters, or a valid manual WIKI / REPO plan ≤450. Nothing truncated/sent.";return
        }
        if(agentCards.size>=3) {status.text="This conversation has 3 Agent tasks. Clear it explicitly to start more; nothing was discarded.";return}
        agentCards.forEach {it.stop()}
        fun clip(s: String)=s.take(400).let {if(it.lastOrNull()?.isHighSurrogate()==true) it.dropLast(1) else it}
        val context=session.messages().takeLast(2).joinToString("\n") {"${it.role}: ${clip(it.content)}"}
        lateinit var card: com.maya.ai.agent.InlineAgentTurn
        card=com.maya.ai.agent.InlineAgentTurn(host,value,context,researchServices,
            {turn -> visible && section==0 && agentSelected && active==null && !speech.busy && agentCards.none {it!==turn && it.busy}},
            {paint()},
            {text ->
                fun putSource() {selectDirectMode();draft.setText(text);status.text="Source copied locally. Edit/add your question, then Direct Send with consent; nothing sent yet."}
                if(draft.text.isEmpty()) putSource() else confirm("Replace the existing draft?", "The source will replace the text currently in your shared composer. Cancel keeps your draft. Nothing is sent now.") {putSource()}
            },
            {text -> confirmSpeech(text) {card in agentCards && card.explanation==text}})
        agentCards.add(card);timeline.add(card);draft.setText("");hideKeyboard();renderHistory();revealTurn(card.view)
        status.text="Agent task added to this conversation. No action without plan approval."
        if(manual==null) card.propose()
    }
    private fun submitBuild() {
        val value=draft.text.toString()
        val manual=com.maya.ai.agent.InlineBuildTurn.isDocument(value)
        if(value.isBlank() || !NativeChatProtocol.validReply(value) || (!manual && value.length>400)) {
            status.text="Builder request needs 1–400 characters, or a complete HTML document within the composer limit. Nothing sent/truncated.";return
        }
        val existing=buildTask
        if(existing!=null) {
            if(manual) {status.text="Edit the existing index.html in its inline editor; shared composer follow-ups are change requests. Nothing replaced.";return}
            agentCards.forEach {it.stop()}
            timeline.add(NativeChatProtocol.Message("user","AGENT · Builder follow-up\n$value"))
            draft.setText("");hideKeyboard();renderHistory();existing.propose(value);return
        }
        if(agentCards.size>=3) {status.text="Three task cards already exist. Clear explicitly to start another; draft kept.";return}
        agentCards.forEach {it.stop()}
        val card=com.maya.ai.agent.InlineBuildTurn(host,value,researchServices,
            {turn -> visible && agentSelected && active==null && !speech.busy && agentCards.none {it!==turn && it.busy}}, {paint()})
        buildTask=card;agentCards.add(card);timeline.add(card);draft.setText("");hideKeyboard();renderHistory();revealTurn(card.view)
        status.text="Builder stays in this conversation. One memory-only index.html; static preview needs confirmation."
        if(!manual) card.propose(value)
    }
    private fun revealTurn(view: View) {
        val generation=confirmationGeneration
        handler.post {
            if(visible && section==0 && generation==confirmationGeneration && view.parent===history)
                view.requestRectangleOnScreen(android.graphics.Rect(0,0,view.width,dp(120)),true)
        }
    }
    private fun confirm(title: String, text: String, yes: () -> Unit) {
        if (disclosure?.isShowing == true) return
        val generation = ++confirmationGeneration
        disclosure = AlertDialog.Builder(this).setTitle(title).setMessage(text)
            .setNegativeButton("Cancel") { _, _ -> if (confirmationGeneration == generation) confirmationGeneration++ }
            .setPositiveButton("Continue") { _, _ -> if (visible && confirmationGeneration == generation) { confirmationGeneration++; yes() } }.create().also {
                it.setOnCancelListener { if (confirmationGeneration == generation) confirmationGeneration++ }
                it.show(); MayaTheme.dialog(it); it.getButton(AlertDialog.BUTTON_POSITIVE).filterTouchesWhenObscured = true
            }
    }
    private fun start(kind: String, turn: NativeChatConversation.Turn?, work: (Job) -> Any) {
        if (anyBusy || !visible || (kind == "chat" && agentSelected)) { if (turn != null) session.fail(turn); return }
        val job = Job(kind, turn, SystemClock.elapsedRealtime()); active = job
        if (kind == "check") {
            obscuredTouchSeen = false; touchWarning.text = ""
            job.accessTicket = accessDiagnostic.begin(); showAccessDiagnostic()
        }
        status.text = "Working locally / waiting for a bounded result… STOP is available."; paint()
        job.timeout = Runnable { if (active === job) stopActive("Local 20-second deadline expired.", NativeAccessDiagnostic.State.TIMEOUT) }.also { handler.postDelayed(it, NativeChatProtocol.DEADLINE_MS) }
        fun launch(ready: Boolean) {
            if (active !== job || !visible) return
            if (!ready) { finish(job, null, "ASSISTANT_BUSY"); return }
            try { executor.execute {
                try { job.operation.check(); val result = work(job); job.operation.check(); runOnUiThread { finish(job, result, null) } }
                catch (e: NativeChatProtocol.Rejected) { runOnUiThread { finish(job, null, e.code) } }
                catch (_: Exception) { runOnUiThread { finish(job, null, "SERVICE_UNAVAILABLE") } }
            } } catch (_: java.util.concurrent.RejectedExecutionException) { finish(job, null, "BUSY") }
        }
        // Same fresh local gate for Send and the explicit no-network diagnostic.
        if (kind == "chat" || kind == "readiness") inspectReadiness(job) { reason ->
            if (kind == "readiness") finish(job, reason, null)
            else if (reason == Reason.READY) launch(true)
            else finish(job, null, "READINESS_" + reason.name)
        } else launch(true)
    }
    private fun finish(job: Job, result: Any?, error: String?) {
        if (active !== job || !visible) return
        job.timeout?.let { handler.removeCallbacks(it) }; job.readinessTimeout?.let { handler.removeCallbacks(it) }; active = null
        job.accessTicket?.let { ticket ->
            val state = when {
                result === NativeChatResponse.Result.Access && error == null -> NativeAccessDiagnostic.State.PASS
                error == "DEADLINE_EXCEEDED" -> NativeAccessDiagnostic.State.TIMEOUT
                error == "STOPPED_LOCALLY" -> NativeAccessDiagnostic.State.STOPPED
                else -> NativeAccessDiagnostic.State.FAILED
            }
            val code = error ?: (result as? NativeChatResponse.Result.Error)?.code ?: "INVALID_SERVER_RESPONSE"
            accessDiagnostic.finish(ticket, state, code, job.accessHttp, SystemClock.elapsedRealtime() - job.started)
            showAccessDiagnostic()
        }
        val seconds = (SystemClock.elapsedRealtime() - job.started).coerceAtLeast(0) / 1000.0
        try {
            when {
                result is Reason && job.kind == "readiness" -> status.text = result.hint + " Local check only; no network or AI request."
                error != null -> { job.turn?.let { session.fail(it) }; status.text = errorText(error, job.kind == "chat" && job.operation.attempted) }
                result is String && job.kind == "key" -> {
                    publicText = result; keyText.text = "PUBLIC JWK:\n$result\nFingerprint: ${NativeChatProtocol.hash(result.toByteArray(Charsets.UTF_8))}"
                    status.text = "APK identity ready locally. It is NOT automatically registered. Copy only the PUBLIC key into APK_PUBLIC_JWK; keep browser OWNER_PUBLIC_JWK unchanged."
                }
                result is NativeChatResponse.Result.Reply && job.turn != null -> {
                    if (session.complete(job.turn, result.text) == NativeChatConversation.Completion.ACCEPTED) {
                        draft.setText(""); renderHistory(); history.getChildAt((history.childCount-2).coerceAtLeast(0))?.let {revealTurn(it)}; status.text = "Model response received; it may be inaccurate."
                    } else status.text = "Late result excluded. No automatic resend."
                }
                result === NativeChatResponse.Result.Access && job.kind == "check" ->
                    status.text = "APK signed empty check accepted; exact replay denied. No AI called. This is not a permanent login or proof that Chat is enabled."
                result is NativeChatResponse.Result.Error -> {
                    job.turn?.let { session.fail(it) }
                    status.text = errorText(result.code, job.kind == "chat" && result.remoteUncertain) + (result.diagnostic?.let { " Diagnostic: $it." } ?: "")
                }
                else -> { job.turn?.let { session.fail(it) }; status.text = errorText("INVALID_SERVER_RESPONSE", job.kind == "chat" && job.operation.attempted) }
            }
        } catch (_: Exception) { job.turn?.let { session.fail(it) }; status.text = errorText("INVALID_SERVER_RESPONSE", job.kind == "chat" && job.operation.attempted) }
        if (job.kind == "chat") {
            val duration = String.format(java.util.Locale.US, "%.2f", seconds)
            status.append(if (job.operation.attempted) "\nLocal wait: $duration s (key/signing + network + server; not model-only speed)."
                else "\nLocal pre-dispatch wait: $duration s. No network request sent.")
        }
        paint()
    }
    private fun stopActive(message: String, accessState: NativeAccessDiagnostic.State = NativeAccessDiagnostic.State.STOPPED) {
        confirmationGeneration++;disclosure?.dismiss();disclosure=null
        agentCards.forEach {it.stop()}
        speech.stop()
        val job = active
        if (job != null) {
            job.timeout?.let { handler.removeCallbacks(it) }; job.readinessTimeout?.let { handler.removeCallbacks(it) }; active = null
            if (job.waitingReadiness) { job.waitingReadiness = false; recordReadiness(Reason.CANCELLED) }
            job.operation.cancel(); session.stop()
            job.accessTicket?.let {
                accessDiagnostic.finish(it, accessState,
                    if (accessState == NativeAccessDiagnostic.State.TIMEOUT) "DEADLINE_EXCEEDED" else "STOPPED_LOCALLY",
                    job.accessHttp, SystemClock.elapsedRealtime() - job.started)
                showAccessDiagnostic()
            }
            if (::status.isInitialized) status.text = message + if (job.kind == "chat" && job.operation.attempted) " Remote work may continue/completed; usage may count. No retry." else " No model dispatch confirmed; no automatic retry."
        } else if (::status.isInitialized) status.text = message
        paint()
    }
    private fun errorText(code: String, uncertain: Boolean): String {
        if (code.startsWith("READINESS_")) {
            val reason = Reason.values().firstOrNull { it.name == code.removePrefix("READINESS_") } ?: Reason.UNKNOWN
            return "Local Send blocked: ${reason.name}. ${reason.hint} No model request was sent."
        }
        val message = when (code) {
            "KEY_REQUIRED" -> "No APK key. Use Create / show APK public key first."
            "KEYSTORE_UNAVAILABLE", "INVALID_LOCAL_KEY", "SIGNING_FAILED", "INVALID_SIGNATURE_ENCODING" -> "APK key/signing unavailable. No automatic key replacement."
            "SIGNATURE_REQUIRED", "BAD_SIGNATURE", "INVALID_APK_CONFIGURATION" -> "APK access denied or setup invalid. Check APK_PUBLIC_JWK with the owner; never replace the browser key."
            "CHAT_NOT_ENABLED" -> "Chat is OFF or required owner review is incomplete."
            "SETUP_REQUIRED", "INVALID_OWNER_CONFIGURATION" -> "Server setup needs owner attention."
            "CONSENT_REQUIRED" -> "Consent is required before sending conversation text."
            "INVALID_MESSAGES" -> "Enter nonempty text up to 2,000 characters."
            "CONTEXT_LIMIT", "BODY_TOO_LARGE" -> "Conversation limit reached. Nothing was silently trimmed. Clear explicitly to begin again."
            "REQUEST_LIMIT", "BUDGET_UNAVAILABLE" -> "Request budget unavailable or exhausted. No automatic retry."
            "ASSISTANT_BUSY" -> "Original assistant/wake/voice is active or not ready. Finish/STOP it and turn wake/auto-listen off yourself, then try this screen. Settings were not changed."
            "BUSY" -> "An earlier local operation is still finishing. No request queued."
            "REQUEST_EXPIRED_OR_CLOCK_SKEW" -> "Signature expired or clock differs. Check automatic date/time."
            "REPLAY_CHECK_FAILED" -> "Expected access/replay result not confirmed. Do not enable AI."
            "STOPPED_LOCALLY", "DEADLINE_EXCEEDED" -> "Local wait stopped or timed out."
            else -> "No usable result. No automatic retry or raw server details displayed."
        }
        return message + if (uncertain) " Remote work may have completed/continue; usage may count." else " This operation did not confirm a model dispatch."
    }
    private fun confirmSpeech(text: String, stillAvailable: () -> Boolean) {
        if (!visible || anyBusy) return
        if (!NativeFishPolicy.validText(text)) {
            speechStatus.text = "Fish · TOO_LONG\n" + NativeFishPolicy.Code.TOO_LONG.hint; return
        }
        confirm("Send this text to Fish and play?", "Only this selected reply/sample will be sent to Fish using your current saved Fish reference and key. The original local pronunciation conversion is used. No other voice or paid fallback. Provider quota/usage may count; STOP is not a refund. Nothing is played automatically.") {
            if (visible && !anyBusy && stillAvailable()) speech.speak(text, true)
        }
    }
    private fun renderHistory() {
        history.removeAllViews(); speechButtons.clear()
        val direct=session.messages()
        if(direct.size<shownDirect) {timeline.removeAll {it is NativeChatProtocol.Message};shownDirect=0}
        timeline.addAll(direct.drop(shownDirect));shownDirect=direct.size
        timeline.forEach { entry ->
            if(entry is com.maya.ai.agent.WorkspaceTask) {
                (entry.view.parent as? android.view.ViewGroup)?.removeView(entry.view);history.addView(entry.view);return@forEach
            }
            val message=entry as NativeChatProtocol.Message
            history.addView(labelView((if (message.role == "user") "You\n" else "Maya\n") + message.content).apply {
                setPadding(dp(14), dp(12), dp(14), dp(12)); setTextIsSelectable(true)
                background = MayaTheme.shape(this@NativeChatWorkspace,if(message.role=="user") MayaTheme.surface else MayaTheme.background,16,message.role=="user")
                layoutParams = LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = dp(10) }
            })
            if (message.role == "assistant") {
                val button = actionButton("Sunao · selected Fish") {
                    confirmSpeech(message.content) { session.messages().any { it === message } }
                }
                button.contentDescription = "Sunao · selected Fish"
                speechButtons.add(button to message.content)
                val actions=LinearLayout(this).apply {orientation=LinearLayout.HORIZONTAL}
                actions.addView(button,LinearLayout.LayoutParams(-2,dp(48)))
                actions.addView(actionButton("Copy reply") {
                    if(visible) {
                        val clip=ClipData.newPlainText("Maya reply",message.content)
                        clip.description.extras=android.os.PersistableBundle().apply {putBoolean("android.content.extra.IS_SENSITIVE",true)}
                        (getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(clip)
                        status.text="Reply copied locally."
                    }
                },LinearLayout.LayoutParams(-2,dp(48)))
                history.addView(actions)
                if (!NativeFishPolicy.validText(message.content)) history.addView(labelView(NativeFishPolicy.Code.TOO_LONG.hint, 13f))
            }
        }
        contextNote.text = "Context: ${session.messages().size} Direct messages · ${agentCards.size}/3 Agent tasks. One timeline; context/source sharing is explicit."
        paint()
    }
    private fun paint() {
        if (!::send.isInitialized || !::stop.isInitialized) return
        val busy = anyBusy
        send.isEnabled = !busy && (agentSelected || consent.isChecked) && draft.text.toString().isNotBlank()
        send.text="↑";send.textSize=22f
        send.contentDescription=if(agentSelected) "Submit Agent task" else "Send message"
        projectChip.visibility=if(agentSelected && buildTask!=null && kindSelection==1) View.VISIBLE else View.GONE
        agentKind.visibility=if(agentSelected) View.VISIBLE else View.GONE
        agentKind.isEnabled=!busy
        consent.visibility=if(agentSelected || consent.isChecked) View.GONE else View.VISIBLE
        draft.hint=if(agentSelected) (if(kindSelection==1) "Build or revise this page…" else "What should I research?") else "Message Maya…"
        agentCards.forEach {it.refresh()}
        readinessButton.isEnabled = !busy
        fishCheck.isEnabled = !busy; fishSample.isEnabled = !busy
        speechButtons.forEach { (button, text) -> button.isEnabled = !busy && NativeFishPolicy.validText(text) }
        stop.isEnabled = busy || agentCards.any {it.stoppable}
        stop.visibility=if(stop.isEnabled) View.VISIBLE else View.GONE
        stopSpace.visibility=stop.visibility
        emptyState.visibility=if(timeline.isEmpty() && !busy) View.VISIBLE else View.GONE
        voiceComponent?.let {view ->
            val height=dp(if(voiceExpanded) 460 else if(timeline.isEmpty() && !busy) 128 else 72)
            if(view.layoutParams.height!=height) view.layoutParams=view.layoutParams.apply {this.height=height}
        }
        updateStatusVisibility()
        touchWarning.visibility=if(touchWarning.text.isEmpty()) View.GONE else View.VISIBLE
         create.isEnabled = !busy; copy.isEnabled = !busy && publicText != null; check.isEnabled = !busy
        draft.isEnabled = !busy; consent.isEnabled = !busy
        counter.visibility=if(draft.text.length >= (if(agentSelected) 320 else 1600)) View.VISIBLE else View.GONE
        counter.text = if(agentSelected) "Agent · ${draft.text.length} · goal ≤400 / plan ≤450" else "Direct Chat · ${draft.text.length} / 2,000"
    }
    private fun updateStatusVisibility() {
        val text=status.text.toString()
        val routine=listOf("No Chat request", "Mode changed", "Task type selected", "Settings toggled").any {text.startsWith(it)}
        status.visibility=if(text.isBlank() || (routine && !text.contains("Remote",true))) View.GONE else View.VISIBLE
    }
    private fun observeText(view: TextView, changed: (TextView) -> Unit) {
        view.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?,start: Int,count: Int,after: Int) {}
            override fun onTextChanged(s: CharSequence?,start: Int,before: Int,count: Int) {changed(view)}
            override fun afterTextChanged(s: Editable?) {}
        })
        changed(view)
    }
    private fun readinessReport() = "Last local readiness: ${readinessReason.name}\n${readinessReason.hint}\nThis result is not a server/AI test. Send always rechecks."
    private fun recordReadiness(reason: Reason) {
        readinessReason = reason
        try { getSharedPreferences("maya_readiness_diagnostic", Context.MODE_PRIVATE).edit().putString("reason", reason.name).apply() } catch (_: Exception) {}
        if (::readinessResult.isInitialized) readinessResult.text = readinessReport()
    }
    private fun inspectReadiness(job: Job, complete: (Reason) -> Unit) {
        job.waitingReadiness = true; recordReadiness(Reason.CHECKING)
        fun deliver(reason: Reason) {
            if (active !== job || !visible || !job.waitingReadiness) return
            job.waitingReadiness = false
            job.readinessTimeout?.let { handler.removeCallbacks(it) }
            recordReadiness(reason); complete(reason)
        }
        job.readinessTimeout = Runnable { deliver(Reason.UI_UNRESPONSIVE) }.also { handler.postDelayed(it, 1500) }
        try {
            val native = runtimeReadiness()
            if (native != Reason.READY) deliver(native)
            else MainActivity.instance?.nativeChatReady { deliver(it) } ?: deliver(Reason.READY)
        } catch (_: Exception) { deliver(Reason.UNKNOWN) }
    }
    private fun runtimeReadiness() = NativeChatReadiness.runtime(
        getSharedPreferences("maya", Context.MODE_PRIVATE).getBoolean("wake", false),
        WakeWordService.instance != null, WakeWordService.fishOutputActive, WakeWordService.haal,
        com.maya.ai.MayaAct.hasPendingActions())
    private fun showAccessDiagnostic() {
        if (::accessResult.isInitialized) accessResult.text = accessDiagnostic.report()
    }
    private fun accessStage(job: Job, stage: NativeAccessDiagnostic.Stage) {
        runOnUiThread {
            if (active === job && visible) { job.accessTicket?.let { accessDiagnostic.stage(it, stage) }; showAccessDiagnostic() }
        }
    }
    fun consumeTouch(event: MotionEvent): Boolean {
        if(event.actionMasked==MotionEvent.ACTION_DOWN && agentCards.any {it.executing}) agentCards.forEach {it.stop()}
        if(event.actionMasked==MotionEvent.ACTION_DOWN && agentCards.any {it.busy || it.approved} && event.flags and (MotionEvent.FLAG_WINDOW_IS_OBSCURED or MotionEvent.FLAG_WINDOW_IS_PARTIALLY_OBSCURED)!=0) agentCards.forEach {it.stop()}
        val obscured = event.flags and (MotionEvent.FLAG_WINDOW_IS_OBSCURED or MotionEvent.FLAG_WINDOW_IS_PARTIALLY_OBSCURED) != 0
        if (obscured) {
            if (event.actionMasked == MotionEvent.ACTION_DOWN && ::touchWarning.isInitialized) {
                obscuredTouchSeen = true
                touchWarning.text = "Touch blocked by Android's overlay protection. Hide floating windows/screen filters, then tap again. This blocked touch sent no request."
            }
            return true // Keep protection; do not silently bypass an obscured confirmation.
        }
        return false
    }
    private fun hideKeyboard() {
        if (::draft.isInitialized) (getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager)
            ?.hideSoftInputFromWindow(draft.windowToken, 0)
    }
    private fun card(color: Int) = MayaTheme.shape(this,color)
    private fun actionButton(title: String, action: () -> Unit) = Button(this).apply {
        MayaTheme.button(this,title);setOnClickListener {action()}
    }
    private fun buttonColors(button: Button, fill: Int, text: Int) = MayaTheme.colors(button,fill,text)
    private fun labelView(value: String, size: Float = 15f) = TextView(this).apply {
        text=value;MayaTheme.label(this,size);setPadding(0,dp(8),0,dp(8))
    }
    private fun choiceAdapter(values: List<String>)=object : ArrayAdapter<String>(this,android.R.layout.simple_spinner_dropdown_item,values) {
        override fun getView(position: Int,convertView: View?,parent: android.view.ViewGroup): View = TextView(this@NativeChatWorkspace).apply {
            text=(if(values[position]=="Direct Chat") "Direct" else values[position])+" ▾";MayaTheme.label(this,12f);setPadding(dp(6),0,dp(2),0);gravity=android.view.Gravity.CENTER_VERTICAL
            maxLines=2;ellipsize=android.text.TextUtils.TruncateAt.END
            layoutParams=android.view.ViewGroup.LayoutParams(-1,dp(48));contentDescription=values[position]
        }
        override fun getDropDownView(position: Int,convertView: View?,parent: android.view.ViewGroup): View = TextView(this@NativeChatWorkspace).apply {
            text=values[position];MayaTheme.label(this,16f);setPadding(dp(16),dp(12),dp(16),dp(12));minHeight=dp(48);setBackgroundColor(MayaTheme.surface)
        }
    }
    private fun runOnUiThread(action: () -> Unit) { host.runOnUiThread { action() } }
    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
    fun resume() { visible = true; collapseVoiceSettings(); showAccessDiagnostic(); paint() }
    fun pause() { visible=false; confirmationGeneration++; disclosure?.dismiss(); disclosure = null; agentCards.forEach {it.stop()} }
    fun focusChanged(hasFocus: Boolean) {
        if(!hasFocus && agentBusy) agentCards.forEach {it.stop()}
    }
    private fun endLocalSession() {
        clearAgents()
        visible = false; confirmationGeneration++; disclosure?.dismiss(); disclosure = null
        stopActive("This screen was left; local chat was cleared.", NativeAccessDiagnostic.State.LEFT_SCREEN)
        session.clear()
        if (::draft.isInitialized) draft.setText("")
        if (::consent.isInitialized) consent.isChecked = false
        if (::history.isInitialized && ::contextNote.isInitialized) renderHistory()
    }
    fun leaveScreen() { endLocalSession() }
    fun dispose() {
        // Also fence callbacks if destruction occurs without the normal onStop path.
        endLocalSession(); handler.removeCallbacksAndMessages(null)
    }
    fun requestClose() {
        if (draft.text.isNotEmpty() || session.messages().isNotEmpty() || active != null || speech.busy || agentCards.isNotEmpty())
            confirm("Leave private Chat?", "Leaving clears Chat and Agent data and stops local waiting. It does not erase provider records or refund usage.") { endLocalSession(); close() }
        else { endLocalSession(); close() }
    }
}
