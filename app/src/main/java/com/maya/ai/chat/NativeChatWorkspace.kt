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
        var configured=false
        var timeout: Runnable? = null
        var readinessTimeout: Runnable? = null
        var waitingReadiness = false
        var attempt: ChatAttempt?=null
        var accessTicket: NativeAccessDiagnostic.Ticket? = null
        @Volatile var accessHttp = 0
    }
    private val handler = Handler(Looper.getMainLooper())
    private val session = NativeChatConversation { SystemClock.elapsedRealtime() }
    private val identity = NativeChatIdentity()
    private val directPermission by lazy {AndroidDirectSendPermission.create(host)}
    private var restoredConsentRequired=false
    private lateinit var directPermissionStatus: TextView
    private fun updateDirectPermissionStatus() {
        if(::directPermissionStatus.isInitialized) directPermissionStatus.text=if(directPermission.remembered())
            "Manual Direct Send permission is remembered on this device. No automatic requests or history saving. Restore of saved work still needs one review. Revoke below at any time."
        else "Ask on first Direct Send in each temporary conversation. You can choose Remember in that dialog. Nothing is sent just by opening Maya."
    }
    private var useConfiguredChat=runCatching {getSharedPreferences("maya_connections",0).getString("text_route","saved")!="cloudflare"}.getOrDefault(true)
    private var cloudflareReviewed=runCatching {getSharedPreferences("maya_connections",0).getBoolean("cloudflare_reviewed",false)}.getOrDefault(false)
    private var configuredPreparing=false
    private var configuredGrant: String?=null
    private lateinit var connectionButton: Button
    private lateinit var readinessRecovery: Button
    private var localSendBlocked=false
    private val configuredTransport by lazy {ConfiguredChatTransport()}
    private fun chooseConnection() {
        if(!visible || anyBusy || disclosure?.isShowing==true) return
        cancelPendingVoiceStart();voiceSession.hold()
        val generation=++confirmationGeneration
        val details=(if(localSendBlocked) status.text.toString()+"\n\n" else "")+
            "Typed Chat and Talk can use the same eligible saved AI account selection. The exact provider/model and candidate messages are reviewed before sending. Cloudflare Direct is separate: ENABLE_CHAT=false cannot answer. Selecting a local route does not enable the server, send the draft or transfer provider permission. Cloudflare setup controls are under Privacy & limits."
        disclosure=AlertDialog.Builder(this).setTitle("AI connection").setMessage(details)
            .setNegativeButton("Cancel",null).setNeutralButton("Voice & AI settings") {_,_->
                if(visible && generation==confirmationGeneration) {confirmationGeneration++;navigateSettings(3)}
            }.setPositiveButton("Use saved AI") {_,_->
                if(visible && generation==confirmationGeneration) {
                    confirmationGeneration++
                    val saved=runCatching {getSharedPreferences("maya_connections",0).edit().putString("text_route","saved").commit()}.getOrDefault(false)
                    if(saved) {useConfiguredChat=true;configuredGrant=null;consent.isChecked=false;restoredConsentRequired=true;localSendBlocked=false;status.text="Saved AI selected. Draft and context kept. Tap Send to review the actual destination."}
                    else status.text="Connection choice could not be saved. Nothing sent."
                    paint()
                }
            }.create().also {d->
                d.setOnDismissListener {if(generation==confirmationGeneration) confirmationGeneration++};d.show();MayaTheme.dialog(d)
                d.getButton(AlertDialog.BUTTON_POSITIVE).filterTouchesWhenObscured=true
                d.getButton(AlertDialog.BUTTON_NEUTRAL).filterTouchesWhenObscured=true
            }
    }
    private fun cloudflareConnection() {
        if(!visible || anyBusy || disclosure?.isShowing==true) return
        confirm("Cloudflare Direct is operator-controlled", "Only continue if you independently enabled ENABLE_CHAT and completed the required server reviews. The app will NOT change or deploy the Worker. This device choice is not proof that the server is available. Empty signed checks do not prove AI access. Existing saved-account consent will not transfer.") {
            if(runCatching {getSharedPreferences("maya_connections",0).edit().putString("text_route","cloudflare").putBoolean("cloudflare_reviewed",true).commit()}.getOrDefault(false)) {
                useConfiguredChat=false;cloudflareReviewed=true;configuredGrant=null;consent.isChecked=false;restoredConsentRequired=true
                status.text="Cloudflare route selected by you · server availability not verified. First Send requires its own permission."
            } else status.text="Could not save route choice. Nothing sent."
            paint()
        }
    }
    private fun configuredFailure(code: String) {
        localSendBlocked=true
        status.text=when {
            code.startsWith("READINESS_") -> "Not sent · "+(Reason.values().firstOrNull {it.name==code.removePrefix("READINESS_")}?.hint ?: "Another audio/request owner is busy.")+" Draft kept; no model request."
            code=="CONFIGURED_AI_UNAVAILABLE" -> "Not sent · no eligible saved AI account/model (or offline/quota block). Check the existing AI settings. Fish supplies speech, not the answer. No Cloudflare fallback or request was made."
            else -> "Not sent · local AI configuration could not be verified. Let the app finish loading or open AI connection. Draft kept; no model request."
        }
        paint()
    }
    private fun requestConfiguredSend() {
        if(anyBusy || !visible || section!=0 || agentSelected || disclosure?.isShowing==true) return
        if(timeline.count {it is ChatAttempt}>=6) {status.text="Six uncertain/failed attempts retained. Dismiss one explicitly before another request.";return}
        localSendBlocked=false
        val text=draft.text.toString()
        val candidate=try {session.review(text)} catch(e: NativeChatProtocol.Rejected) {status.text=errorText(e.code,false);return}
        val main=host as? MainActivity ?: run {configuredFailure("MAIN_TRANSITION");return}
        val generation=++confirmationGeneration
        cancelPendingVoiceStart();voiceSession.hold();configuredPreparing=true;status.text="Checking the saved AI connection locally…";paint()
        fun current()=visible && section==0 && useConfiguredChat && generation==confirmationGeneration && draft.text.toString()==text && runCatching {session.review(text)==candidate}.getOrDefault(false)
        main.prepareConfiguredChat({visible && section==0 && useConfiguredChat && generation==confirmationGeneration},false) {config,code ->
            configuredPreparing=false
            if(!current()) {paint();return@prepareConfiguredChat}
            if(config==null) {configuredFailure(code);return@prepareConfiguredChat}
            val reviewedFingerprint=config.fingerprint
            if(configuredGrant==reviewedFingerprint) {sendConfigured(reviewedFingerprint,text,candidate);return@prepareConfiguredChat}
            hideKeyboard();draft.clearFocus()
            val body=labelView(candidate.mapIndexed {i,m->"${i+1}. ${m.role}\n${m.content}"}.joinToString("\n\n"),14f).apply {setTextIsSelectable(true);setPadding(dp(16),dp(8),dp(16),dp(8));tag="configured_context_review"}
            val scroll=ScrollView(this).apply {addView(body);isSaveEnabled=false}
            val token=++confirmationGeneration
            disclosure=AlertDialog.Builder(this).setTitle("Send to ${config.provider}?")
                .setMessage("${config.model} · ${config.tokens} maximum output tokens. These ${candidate.size} exact messages go to your existing configured AI account. Account limits/processing apply. No tools, retries or provider fallback. Text stays native; no draft/context is passed into JavaScript. Runtime Wake will pause for this manual Send without changing its saved switch. No microphone or automatic Fish playback. Cloudflare Chat OFF is unchanged. Permission applies to manual sends in this temporary conversation for this exact provider/model/key only.")
                .setView(scroll).setNegativeButton("Cancel",null).setPositiveButton("Allow & Send") {_,_->
                    if(visible && section==0 && useConfiguredChat && token==confirmationGeneration && !anyBusy && draft.text.toString()==text && runCatching {session.review(text)==candidate}.getOrDefault(false)) {
                        confirmationGeneration++
                        sendConfigured(reviewedFingerprint,text,candidate)
                    }
                }.create().also {d ->
                    d.setOnDismissListener {if(token==confirmationGeneration) confirmationGeneration++}
                    d.show();MayaTheme.dialog(d);d.getButton(AlertDialog.BUTTON_POSITIVE).filterTouchesWhenObscured=true
                    val w=d.window;val callback=w?.callback
                    if(w!=null && callback!=null) w.callback=object : android.view.Window.Callback by callback {
                        override fun dispatchTouchEvent(event: MotionEvent): Boolean {
                            if(event.flags and (MotionEvent.FLAG_WINDOW_IS_OBSCURED or MotionEvent.FLAG_WINDOW_IS_PARTIALLY_OBSCURED)!=0) {confirmationGeneration++;d.dismiss();return true}
                            return callback.dispatchTouchEvent(event)
                        }
                    }
                }
            paint()
        }
    }
    private fun sendConfigured(reviewedFingerprint: String,text: String,candidate: List<NativeChatProtocol.Message>) {
        if(anyBusy || !visible || section!=0 || !useConfiguredChat) return
        val generation=confirmationGeneration;configuredPreparing=true;paint()
        val main=host as? MainActivity ?: run {configuredPreparing=false;configuredFailure("MAIN_TRANSITION");return}
        fun current()=visible && section==0 && useConfiguredChat && generation==confirmationGeneration && draft.text.toString()==text && runCatching {session.review(text)==candidate}.getOrDefault(false)
        main.prepareConfiguredChat({visible && section==0 && useConfiguredChat && generation==confirmationGeneration},true) {fresh,code ->
            configuredPreparing=false
            if(!current()) {paint();return@prepareConfiguredChat}
            if(fresh==null) {configuredFailure(code);return@prepareConfiguredChat}
            if(fresh.fingerprint!=reviewedFingerprint) {configuredGrant=null;status.text="AI selection changed. Nothing sent; tap Send to review the new destination.";paint();return@prepareConfiguredChat}
            configuredGrant=fresh.fingerprint
            try {
                val turn=session.begin(text,true)
                start("chat",turn,true) {job ->
                    configuredTransport.execute(fresh,turn.input,job.operation) {session.markDispatched(turn)}
                }
            } catch(e: NativeChatProtocol.Rejected) {status.text=errorText(e.code,false);paint()}
        }
    }
    private fun requestDirectSend() {
        if(useConfiguredChat) {requestConfiguredSend();return}
        if(!cloudflareReviewed) {status.text="Cloudflare Direct is unavailable: the owner reported Chat OFF. Use AI connection to choose the saved AI account. No request or attempt card created.";paint();return}
        if(anyBusy || !visible || section!=0 || agentSelected || disclosure?.isShowing==true) return
        if(timeline.count {it is ChatAttempt}>=6) {status.text="Six local attempt cards retained. Dismiss one explicitly or clear the conversation before another Send. Nothing sent.";return}
        localSendBlocked=false
        val text=draft.text.toString()
        val candidate=try {session.review(text)} catch(e: NativeChatProtocol.Rejected) {status.text=errorText(e.code,false);return}
        if(consent.isChecked || (!restoredConsentRequired && directPermission.remembered())) {sendDirectNow();return}
        hideKeyboard();draft.clearFocus()
        val body=LinearLayout(this).apply {orientation=LinearLayout.VERTICAL;setPadding(dp(16),0,dp(16),0);isSaveEnabled=false}
        val remember=CheckBox(this).apply {
            tag="remember_direct_permission";this.text="Remember permission for my manual Direct Sends on this device";isChecked=false
            isSaveEnabled=false;filterTouchesWhenObscured=true;MayaTheme.toggle(this)
        }
        body.addView(remember)
        body.addView(labelView("Optional: avoids asking again for new typed conversations after background/restart. Does not save messages, enable server Chat, or authorize Mic, Fish, Agent tools or phone actions. Saved-work restore still asks once. Revoke in Settings → Privacy & limits.",13f))
        body.addView(labelView(candidate.mapIndexed {i,m->"${i+1}. ${m.role}\n${m.content}"}.joinToString("\n\n"),14f).apply {tag="direct_send_review";setTextIsSelectable(true)})
        val generation=++confirmationGeneration
        disclosure=AlertDialog.Builder(this).setTitle("Allow Direct text sending?")
            .setMessage("Your message and completed Direct context (${candidate.size} messages) will go to Cloudflare AI via ${NativeChatProtocol.ORIGIN}. Use nonsensitive text. Provider processing/usage may apply; this is not zero-retention or unlimited service. Nothing sends until you choose Allow & Send. Future Sends in this conversation use the same permission. Chat OFF stays unchanged.")
            .setView(ScrollView(this).apply {isSaveEnabled=false;addView(body)})
            .setNegativeButton("Cancel",null).setPositiveButton("Allow & Send") {_,_->
                if(visible && section==0 && !agentSelected && !anyBusy && generation==confirmationGeneration && draft.text.toString()==text &&
                    runCatching {session.review(text)==candidate}.getOrDefault(false)) {
                    confirmationGeneration++
                    if(remember.isChecked && !directPermission.remember()) {status.text="Could not save sending permission. Nothing sent. Try again without Remember or retry explicitly.";return@setPositiveButton}
                    consent.isChecked=true;restoredConsentRequired=false;updateDirectPermissionStatus()
                    handler.post {if(visible && section==0 && !agentSelected && !anyBusy && generation+1==confirmationGeneration && draft.text.toString()==text &&
                        runCatching {session.review(text)==candidate}.getOrDefault(false)) sendDirectNow()}
                }
            }.create().also {d ->
                d.setOnDismissListener {if(generation==confirmationGeneration) confirmationGeneration++}
                d.show();MayaTheme.dialog(d);d.getButton(AlertDialog.BUTTON_POSITIVE).filterTouchesWhenObscured=true
                val window=d.window;val callback=window?.callback
                if(window!=null && callback!=null) window.callback=object : android.view.Window.Callback by callback {
                    override fun dispatchTouchEvent(event: MotionEvent): Boolean {
                        if(event.flags and (MotionEvent.FLAG_WINDOW_IS_OBSCURED or MotionEvent.FLAG_WINDOW_IS_PARTIALLY_OBSCURED)!=0) {confirmationGeneration++;d.dismiss();return true}
                        return callback.dispatchTouchEvent(event)
                    }
                }
            }
    }
    private fun sendDirectNow() {
        if(anyBusy || !visible || section!=0 || agentSelected) return
        val allowed=consent.isChecked || (!restoredConsentRequired && directPermission.remembered())
        if(!allowed) return
        agentCards.forEach {it.stop()}
        try {
            val turn=session.begin(draft.text.toString(),allowed);hideKeyboard()
            start("chat",turn) {job ->
                val signed=identity.sign(turn.input);job.operation.check()
                if(signed.body!=turn.body) throw NativeChatProtocol.Rejected("INVALID_REQUEST")
                transport.execute(signed,job.operation) {
                    session.markDispatched(turn)
                    runOnUiThread {if(active===job && visible) {job.attempt?.detail="Waiting for response… Request dispatched; no reply accepted yet.";renderHistory()}}
                }
            }
        } catch(e: NativeChatProtocol.Rejected) {status.text=errorText(e.code,false);paint()}
    }
    private var fishTalkBusy=false
    private var fishTalkPreparing=false
    private lateinit var talkButton: Button
    private data class VoiceLine(val role: String,val text: String)
    fun fishTalkEvent(kind: String,value: String) {
        if(!visible || !fishTalkBusy) return
        if(kind=="state") status.text=when(value) {
            "wake-waiting" -> "Starting Wake listener… No AI request until you say Maya."
            "starting" -> "Starting microphone… Fish will speak the reply."
            "listening" -> "Listening · bolo. STOP ends the conversation."
            "finalizing" -> "Understanding your words…"
            "thinking" -> "Maya is preparing an answer…"
            "fish-starting" -> "Waiting for your saved Fish voice…"
            "fish-playing" -> "Your saved Fish voice is speaking."
            else -> "Reply finished · listening again shortly…"
        } else if(kind in setOf("user","assistant")) {timeline.add(VoiceLine(kind,value));renderHistory();if(followLatest) conversationScroll.post {conversationScroll.fullScroll(View.FOCUS_DOWN)}}
        paint()
    }
    fun fishTalkEnded(message: String) {fishTalkBusy=false;fishTalkPreparing=false;if(visible) status.text=message;paint()}
    private fun confirmFishTalk(wakeMode: Boolean=false) {
        if(!visible || section!=0 || anyBusy || agentSelected || disclosure?.isShowing==true) return
        if(timeline.count {it is VoiceLine}>10) {status.text="Voice timeline is full. Clear local chat explicitly or start a fresh workspace; nothing sent.";return}
        cancelPendingVoiceStart();voiceSession.end();hideKeyboard();draft.clearFocus()
        val main=host as? MainActivity ?: return
        val ticket=++confirmationGeneration;fishTalkPreparing=true;status.text="Checking saved AI and Fish setup locally…";paint()
        main.prepareFishTalk {raw ->
            if(!visible || section!=0 || ticket!=confirmationGeneration) return@prepareFishTalk
            fishTalkPreparing=false
            val review=com.maya.ai.voice.FishTalkProtocol.review(raw)
            if(review==null) {
                status.text=when(com.maya.ai.voice.FishTalkProtocol.problem(raw)) {
                    "AI" -> "No eligible configured voice AI account/model. Fish supplies the voice, not the answer. Check your existing AI settings; no new provider or keyless fallback was selected."
                    "FISH" -> "Your saved Fish setup is unavailable or voice is OFF. Check the existing Fish reference/key; no phone TTS or other voice was used."
                    "INPUT" -> "Select Urdu, Hindi or English input language in Voice settings. No microphone started."
                    "BUSY" -> "Stop the old voice/request first. Auto Listen, Proactive and Speak notifications must be OFF for this conversation; their settings were not changed."
                    else -> "The local voice host is not ready. Let the app finish loading, then tap Talk again. No request was sent."
                };paint();return@prepareFishTalk
            }
            status.text=if(wakeMode) "Review Wake conversation once; then say Maya and your question." else "Review the Fish conversation before starting."
            confirm(if(wakeMode) "Start Wake conversation?" else "Talk with your Fish voice?", (if(wakeMode) "Say Maya plus your question, or Maya then speak when ready. The recognized question goes directly into this approved Fish conversation, without another Talk/Send/Sunao step. Silence while waiting for Maya is not a failed conversation. " else "")+"Speak naturally; each recognized sentence is sent to ${review.provider} / ${review.model}, using your existing configured account. Replies automatically go to your saved Fish Audio voice. Input uses your installed speech service (${review.language}); audio may be processed remotely. No phone/device TTS replacement.\n\nUp to 5 minutes / 5 turns / ${review.tokens} maximum output tokens per answer, matching the existing voice AI route. Only this new voice conversation is shared, not Direct chat, saved work or memories. No tools, phone actions, paid fallback, retries or automatic saving. Account quotas apply. Ordinary Talk pauses a separate Wake listener; Wake mode arms it for the first question, then releases it for conversation. The saved switch is not changed by runtime handoff. STOP/background ends the session; provider processing may already have occurred. Cloudflare Direct Chat OFF is unchanged.") {
                awaitVoiceFocus(confirmationGeneration) {
                    fishTalkBusy=true;paint()
                    val startGeneration=confirmationGeneration
                    main.startFishTalk(review.token,wakeMode) {ok ->
                        if(visible && startGeneration==confirmationGeneration && !ok && fishTalkBusy) fishTalkEnded("Conversation did not start. Allow microphone permission if requested, then tap Talk again. Check existing AI/Fish settings; no automatic retry.")
                    }
                }
            }
        }
    }
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
                if (!visible || runtimeReadiness(false) != Reason.READY) return false
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
            when(code) {
                NativeFishPolicy.Code.PREPARING -> voiceSession.outputStarted()
                NativeFishPolicy.Code.STARTING, NativeFishPolicy.Code.PLAYING -> Unit
                NativeFishPolicy.Code.DONE -> voiceSession.outputFinished(true)
                else -> voiceSession.outputFinished(false)
            }
            paint()
        })
    }
    private var inputWindowFocused=false
    private var pendingVoiceStart: ((Boolean)->Unit)?=null
    private var voiceStartTimeout: Runnable?=null
    private fun cancelPendingVoiceStart() {
        pendingVoiceStart=null;voiceStartTimeout?.let {handler.removeCallbacks(it)};voiceStartTimeout=null
    }
    private fun awaitVoiceFocus(generation: Long, startInput: ()->Unit) {
        cancelPendingVoiceStart()
        fun admitted()=visible && section==0 && generation==confirmationGeneration && !anyBusy
        if(!admitted()) return
        lateinit var pending: (Boolean)->Unit
        pending={focused ->
            if(pendingVoiceStart===pending && focused) {
                cancelPendingVoiceStart()
                if(admitted()) {inputWindowFocused=true;startInput()}
            }
        }
        pendingVoiceStart=pending
        voiceStartTimeout=Runnable {
            if(pendingVoiceStart===pending) {
                cancelPendingVoiceStart()
                if(admitted()) {status.text="Input not started: foreground focus was not ready. Tap Mic to try explicitly.";paint()}
            }
        }.also {handler.postDelayed(it,1500)}
        pending(host.hasWindowFocus())
        paint()
    }
    private val voiceSession: com.maya.ai.voice.ForegroundVoiceSession by lazy {
        com.maya.ai.voice.ForegroundVoiceSession({SystemClock.elapsedRealtime()}, {delay, action ->
            val task=Runnable {action()};handler.postDelayed(task,delay)
            val cancel: ()->Unit={handler.removeCallbacks(task)};cancel
        }, {language, offline ->
            if(visible && inputWindowFocused && section==0 && !agentSelected && !anyBusy && disclosure?.isShowing!=true) {
                hideKeyboard();draft.clearFocus()
                dictation.start(language,offline,true,true)
            } else voiceSession.end()
        }, {if(dictation.busy) dictation.stop()}, {paint()})
    }
    private fun inputChanged() {
        when(dictation.state) {
            NativeDictation.State.REVIEW -> voiceSession.reviewed()
            NativeDictation.State.IDLE, NativeDictation.State.CHECKING, NativeDictation.State.STARTING, NativeDictation.State.LISTENING -> Unit
            else -> voiceSession.end()
        }
        paint()
    }
    private lateinit var voiceSessionPanel: LinearLayout
    private lateinit var voiceSessionStatus: TextView
    private lateinit var nextVoiceInput: Button
    private val dictation: NativeDictation by lazy {
        NativeDictation(AndroidDictationPort(host),{SystemClock.elapsedRealtime()},{delay,action ->
            val task=Runnable {action()};handler.postDelayed(task,delay)
            val cancel: ()->Unit={handler.removeCallbacks(task)};cancel
        },{inputChanged()})
    }
    private lateinit var dictationPanel: LinearLayout
    private lateinit var dictationStatus: TextView
    private lateinit var voiceOptions: Button
    private lateinit var dictationText: TextView
    private lateinit var useTranscript: Button
    private lateinit var discardTranscript: Button
    private lateinit var microphonePermission: Button
    private lateinit var dictate: Button
    private lateinit var speechStatus: TextView
    private lateinit var fishCheck: Button
    private lateinit var fishSample: Button
    private val recoveryButtons=mutableListOf<Button>()
    private val speechButtons = mutableListOf<Pair<Button, String>>()
    private class ChatAttempt(var text: String) {
        var readinessFailure: Reason?=null
        var pending=true
        var detail="Preparing request… No response received yet."
        fun clear() {text="";detail="";pending=false;readinessFailure=null}
        override fun toString()="ChatAttempt(redacted)"
    }
    private var active: Job? = null
    private var visible = false
    private var agentSelected = false
    private var section = 0
    private lateinit var modePicker: Spinner
    private lateinit var menuPanel: LinearLayout
    private lateinit var emptyState: LinearLayout
    private lateinit var projectChip: TextView
    private lateinit var stopSpace: View
    private val savedVault by lazy {AndroidWorkspaceVault.create(host)}
    private var library: WorkspaceLibrary?=null
    private fun captureSavedWorkspace()=WorkspaceLibrary.Snapshot(session.messages(),draft.text.toString(),buildTask?.editor?.text?.toString())
    private fun openSavedWorkspace(item: SavedWorkspace) {
        if(!visible || section!=5 || anyBusy) return
        // Restore data only. No action, proposal, preview, provider consent or task ownership is restored.
        stopActive("Opening saved work locally. Nothing sent or resumed.")
        clearAgents();session.clear();timeline.clear();session.restore(item.messages)
        timeline.addAll(item.messages);shownDirect=item.messages.size;draft.setText(item.draft);consent.isChecked=false;restoredConsentRequired=true
        item.code?.let {code ->
            val card=com.maya.ai.agent.InlineBuildTurn(host,"Restored local project",researchServices,
                {turn -> taskAllowed(turn)}, {paint()})
            card.editor.setText(code);buildTask=card;agentCards.add(card);timeline.add(card)
        }
        followLatest=true;latestResponse.visibility=View.GONE
        navigateSettings(0);selectDirectMode();renderHistory()
        status.text="Saved snapshot opened locally. Direct consent is OFF. Review Context before Send; restored code is unverified and has not run."
    }
    private var voiceComponent: View?=null
    private var hostNotice: LinearLayout?=null
    private var hostNoticeContainer: ScrollView?=null
    private var hostNoticeText: TextView?=null
    private var hostRetryButton: Button?=null
    private var hostFailed=false
    private var hostNoticeVisible=false
    /** Native fixed messages only; never forward workspace content into the privileged WebView. */
    fun hostPresentationState(loading: Boolean,failed: Boolean) {
        hostFailed=failed;hostNoticeVisible=loading || failed
        hostNoticeText?.text=if(failed) "Maya interface did not become ready. You can keep typing, go Back, or retry the local interface. Nothing was resent." else "Loading Maya interface…"
        hostNoticeContainer?.visibility=if(hostNoticeVisible) View.VISIBLE else View.GONE
        hostRetryButton?.visibility=if(failed) View.VISIBLE else View.GONE
    }
    private fun confirmHostRetry() {
        if(!visible || !hostFailed || section !in listOf(0,3)) return
        confirm("Reload local Maya interface?","Current local workspace work and approvals will stop. Your draft, completed conversation and saved settings stay here. Remote work may continue; this does not resend requests or clear app data.") {
            if(visible && hostFailed && section in listOf(0,3)) {
                stopActive("Local interface retry requested. Approvals revoked; no request resent.")
                if((host as? MainActivity)?.retryWorkspaceHost()!=true) status.text="Interface retry blocked while another native/voice owner is active. Stop that owner first. Nothing reloaded."
            }
        }
    }
    private var voiceExpanded=false
    private val agentCards = mutableListOf<com.maya.ai.agent.WorkspaceTask>()
    private val timeline = mutableListOf<Any>() // completed Direct messages and owned inline Agent cards
    private class TaskControls(val root: LinearLayout,val summary: TextView,val fold: Button,val stop: Button,val remove: Button) {var folded=false}
    private val taskControls=mutableMapOf<com.maya.ai.agent.WorkspaceTask,TaskControls>()
    private fun taskAllowed(turn: com.maya.ai.agent.WorkspaceTask)=visible && section==0 && agentSelected && turn in agentCards &&
        taskControls[turn]?.folded!=true && active==null && !speech.busy && !dictation.stoppable && agentCards.none {it!==turn && it.busy}
    private fun controlsFor(task: com.maya.ai.agent.WorkspaceTask): TaskControls = taskControls.getOrPut(task) {
        val row=LinearLayout(this).apply {orientation=LinearLayout.VERTICAL;isSaveEnabled=false;tag="task_controls"}
        val summary=labelView("",13f).apply {row.addView(this)}
        val actions=LinearLayout(this).apply {orientation=LinearLayout.HORIZONTAL;row.addView(this)}
        val fold=actionButton("Fold task") {
            if(visible && section==0 && !anyBusy && task in agentCards) {
                task.dismissReview() // no task stop, no plan approval renewal
                taskControls[task]?.let {it.folded=!it.folded};paint()
            }
        }.also {it.tag="task_fold";actions.addView(it,LinearLayout.LayoutParams(0,-2,1f))}
        val stopTask=actionButton("Stop this task") {
            if(visible && section==0 && task in agentCards && task.stoppable) {task.stop();paint()}
        }.also {it.tag="task_stop";actions.addView(it,LinearLayout.LayoutParams(0,-2,1f))}
        val remove=actionButton("Remove task") {removeTask(task)}.also {it.tag="task_remove";actions.addView(it,LinearLayout.LayoutParams(0,-2,1f))}
        TaskControls(row,summary,fold,stopTask,remove)
    }
    private fun removeTask(task: com.maya.ai.agent.WorkspaceTask) {
        if(!visible || section!=0 || anyBusy || task !in agentCards) return
        task.dismissReview();val revision=task.reviewRevision
        confirm("Remove this ${if(task is com.maya.ai.agent.InlineBuildTurn) "Builder" else "Research"} task?",
            "Discard this task's local code/checkpoints, results, proposal, preview and approval, and free one task slot. Other tasks, Direct messages, draft and saved snapshots stay. Save current Builder code first if needed. This does not delete provider records or guarantee remote cancellation.") {
            if(visible && section==0 && !anyBusy && task in agentCards && task.reviewRevision==revision) {
                // Keep its capacity occupied until disposal really returns; a failure does not admit a replacement.
                try {task.dispose()} catch(_: Exception) {status.text="Task disposal could not be confirmed. Slot retained; no replacement started.";return@confirm}
                agentCards.remove(task);timeline.remove(task);taskControls.remove(task)
                if(buildTask===task) buildTask=null
                renderHistory();status.text="Task removed locally. ${agentCards.size}/3 slots used. Direct context, draft and saved snapshots unchanged."
            }
        }
    }
    private var shownDirect = 0
    private var kindSelection=0
    private lateinit var agentKind: Spinner
    private var buildTask: com.maya.ai.agent.InlineBuildTurn?=null
    private var collapseVoiceSettings: () -> Unit = {}
    private var navigateSettings: (Int) -> Unit = {}
    private var restoreVoicePresentation: () -> Unit = {}
    private var settingsSurface: LinearLayout?=null
    private var voiceSlot: FrameLayout?=null
    private val researchServices: com.maya.ai.agent.ResearchServices by lazy { com.maya.ai.agent.ResearchBackend(applicationContext) }
    private val agentBusy get() = agentCards.any { it.busy }
    private val anyBusy get() = configuredPreparing || fishTalkBusy || fishTalkPreparing || active != null || speech.busy || agentBusy || dictation.stoppable
    private var publicText: String? = null
    private lateinit var status: TextView
    private lateinit var readinessResult: TextView
    private lateinit var readinessButton: Button
    private var readinessReason = Reason.NOT_CHECKED
    private lateinit var contextNote: TextView
    private lateinit var contextReview: Button
    private lateinit var history: LinearLayout
    private lateinit var conversationScroll: ScrollView
    private lateinit var latestResponse: Button
    private var followLatest=true
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
        label("Uses your existing saved APK key directly. No need to show/copy it first. This check never creates a key and does not require Chat ON or a Direct sending grant.")
        button("Copy check report") {
            val report = "MAYA ${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})\n" + accessDiagnostic.report() +
                "\nObscured touch blocked: $obscuredTouchSeen"
            (getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newPlainText("Maya access diagnostic", report))
            status.text = "Fixed diagnostic report copied. Paste it after leaving this screen; no messages, keys or signatures included."
        }
        button("Clear check report") {
            if (active == null) { accessDiagnostic.clear(); showAccessDiagnostic() }
        }
        label("Only the last fixed diagnostic state/code/count/duration is retained locally (best effort). Chat, keys, signatures and server bodies are NOT stored in that report. Backgrounding still clears temporary conversation consent, not the completed check report or your explicit Remember choice.")
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
            voiceSlot=FrameLayout(this).apply {isSaveEnabled=false;tag="original_orb_slot"}
            root.addView(voiceSlot,LinearLayout.LayoutParams(-1,dp(128)))
            voiceSlot!!.addView(voiceSurface,FrameLayout.LayoutParams(-1,dp(128)))
            hostNotice=column().apply {tag="host_notice";background=MayaTheme.shape(this@NativeChatWorkspace);setPadding(dp(12),dp(4),dp(12),dp(4))}
            hostNoticeText=labelView("",13f).apply {accessibilityLiveRegion=View.ACCESSIBILITY_LIVE_REGION_POLITE;hostNotice!!.addView(this)}
            hostRetryButton=actionButton("Retry local interface") {confirmHostRetry()}.also {hostNotice!!.addView(it)}
            hostNoticeContainer=ScrollView(this).apply {tag="host_notice_container";isSaveEnabled=false;visibility=View.GONE;addView(hostNotice)}
            voiceExpanded=false
            voiceSurface.setOnTouchListener {v,event ->
                if(voiceExpanded && event.actionMasked==MotionEvent.ACTION_DOWN) v.parent?.requestDisallowInterceptTouchEvent(true)
                if(event.actionMasked==MotionEvent.ACTION_UP || event.actionMasked==MotionEvent.ACTION_CANCEL) v.parent?.requestDisallowInterceptTouchEvent(false)
                false // Original WebView still handles the gesture, not an alternate activity.
            }
            val voiceButton=button("Original settings · expand here") {navigateSettings(3)}
            root.removeView(voiceButton);menuPanel.addView(voiceButton)
        }
        val hostNoticeSlot=FrameLayout(this).apply {tag="host_notice_slot"}
        root.addView(hostNoticeSlot)
        hostNoticeContainer?.let {hostNoticeSlot.addView(it)}
        emptyState=column().apply {tag="empty_state";setPadding(0,dp(12),0,dp(24))}
        emptyState.addView(labelView("Kya karna hai?",26f).apply {gravity=android.view.Gravity.CENTER;typeface=Typeface.create("sans-serif-medium",Typeface.NORMAL)})
        emptyState.addView(labelView("Baat karo. Research karo. Kuch banao.",14f).apply {gravity=android.view.Gravity.CENTER;setTextColor(MayaTheme.muted)})
        root.addView(emptyState)
        contextNote = labelView("Context: no completed messages.",13f).also {infoPage.addView(it)}
        // Transitional in-memory grant holder only; never attached to the view hierarchy or saved by Android.
        consent = CheckBox(this).apply {isSaveEnabled=false;visibility=View.GONE}
        voiceSessionPanel=column().apply {tag="voice_session_panel";background=MayaTheme.shape(this@NativeChatWorkspace);setPadding(dp(12),dp(8),dp(12),dp(8));root.addView(this)}
        voiceSessionStatus=labelView("",13f).also {it.tag="voice_session_status";voiceSessionPanel.addView(it)}
        val voiceSessionActions=LinearLayout(this).apply {orientation=LinearLayout.HORIZONTAL;voiceSessionPanel.addView(this)}
        nextVoiceInput=actionButton("Continue listening") {if(visible && section==0 && !anyBusy) voiceSession.listen()}.also {voiceSessionActions.addView(it,LinearLayout.LayoutParams(0,-2,1f))}
        voiceSessionActions.addView(actionButton("End voice session") {voiceSession.end()},LinearLayout.LayoutParams(0,-2,1f))
        dictationPanel=column().apply {tag="dictation_panel";background=MayaTheme.shape(this@NativeChatWorkspace);setPadding(dp(12),dp(8),dp(12),dp(8));root.addView(this)}
        dictationStatus=labelView("",13f).apply {tag="dictation_status";MayaTheme.status(this);accessibilityLiveRegion=View.ACCESSIBILITY_LIVE_REGION_POLITE;dictationPanel.addView(this)}
        dictationText=labelView("",16f).apply {tag="dictation_transcript";setTextIsSelectable(true);maxLines=4;minHeight=dp(48);ellipsize=android.text.TextUtils.TruncateAt.END;setOnClickListener {maxLines=if(maxLines==4) Int.MAX_VALUE else 4};dictationPanel.addView(this)}
        useTranscript=actionButton("Use transcript") {useDictationTranscript()}.also {dictationPanel.addView(it)}
        voiceOptions=actionButton("Choose voice options") {confirmDictation()}.also {it.tag="dictation_options";dictationPanel.addView(it)}
        discardTranscript=actionButton("Discard voice input") {voiceSession.end();dictation.clear()}.also {dictationPanel.addView(it)}
        microphonePermission=actionButton("Allow microphone") {if(visible && section==0) dictation.requestPermission()}.also {dictationPanel.addView(it)}
        history = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; isSaveEnabled = false; tag = "conversation_timeline"; root.addView(this) }
        val composer = column().apply {tag = "shared_composer_area";background=MayaTheme.shape(this@NativeChatWorkspace,radius=20);setPadding(dp(8),dp(8),dp(8),dp(8))}
        projectChip=labelView("index.html · current project",12f).apply {tag="current_project";setTextColor(MayaTheme.copper);setPadding(dp(8),0,dp(8),dp(4));visibility=View.GONE}
        composer.addView(projectChip)
        root = composer
        val controls=LinearLayout(this).apply {orientation=LinearLayout.HORIZONTAL;gravity=android.view.Gravity.CENTER_VERTICAL;tag="composer_controls"}
        connectionButton=actionButton("AI connection") {chooseConnection()}.apply {tag="ai_connection";text="AI: saved account · check on Send"}
        composer.addView(connectionButton,0)
        modePicker=Spinner(this).apply {
            tag="mode_picker";isSaveEnabled=false;setPadding(0,0,0,0);filterTouchesWhenObscured=true
            adapter=choiceAdapter(listOf("Chat", "Agent"));background=MayaTheme.shape(this@NativeChatWorkspace,MayaTheme.surface,10,false)
            contentDescription="Choose Chat or Agent mode"
            onItemSelectedListener=object : AdapterView.OnItemSelectedListener {
                override fun onNothingSelected(parent: AdapterView<*>?) {}
                override fun onItemSelected(parent: AdapterView<*>?,view: View?,position: Int,id: Long) {changeMode(position==1)}
            }
        }
        controls.addView(modePicker,LinearLayout.LayoutParams(0,dp(48),1f))
        agentKind=Spinner(this).apply {
            tag="agent_kind";isSaveEnabled=false;setPadding(0,0,0,0)
            adapter=choiceAdapter(listOf("Research", "Build page"));contentDescription="Agent task: public research or static page Builder"
            filterTouchesWhenObscured=true;background=MayaTheme.shape(this@NativeChatWorkspace,MayaTheme.surface,10,false)
            controls.addView(this,LinearLayout.LayoutParams(0,dp(48),1f))
            onItemSelectedListener=object : AdapterView.OnItemSelectedListener {
                override fun onNothingSelected(parent: AdapterView<*>?) {}
                override fun onItemSelected(parent: AdapterView<*>?,view: View?,position: Int,id: Long) {
                    if(position!=kindSelection) {kindSelection=position;if(::stop.isInitialized) stopActive("Task type selected. Draft and conversation kept; nothing sent.")}
                }
            }
        }
        contextReview=actionButton("Review Direct context") {reviewDirectContext()}.apply {tag="review_direct_context";text="Context";maxLines=1}
        controls.addView(contextReview,LinearLayout.LayoutParams(0,dp(48),1f))
        talkButton=actionButton("Talk with Fish") {confirmFishTalk()}.apply {tag="talk_fish";text="Talk"}
        buttonColors(talkButton,MayaTheme.copper,MayaTheme.ink)
        controls.addView(talkButton,LinearLayout.LayoutParams(0,dp(48),1f))
        counter = label("Your message · 0 / 2,000",12f).apply {setPadding(0,0,0,0)}
        val composeRow = LinearLayout(this).apply {orientation=LinearLayout.HORIZONTAL;gravity=android.view.Gravity.BOTTOM;root.addView(this)}
        draft = EditText(this).apply {
            tag="shared_composer";hint="Message Maya…";setHintTextColor(MayaTheme.muted);setTextColor(MayaTheme.text);textSize=16f
            minLines=1;maxLines=if(resources.configuration.fontScale>1.3f) 1 else 3;inputType=InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE or InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
            imeOptions=EditorInfo.IME_FLAG_NO_EXTRACT_UI or EditorInfo.IME_FLAG_NO_PERSONALIZED_LEARNING
            filters=arrayOf(InputFilter.LengthFilter(2000));isSaveEnabled=false;importantForAutofill=View.IMPORTANT_FOR_AUTOFILL_NO
            contentDescription="One message box for Chat or Agent mode. Mode changes never erase or send the draft."
            setPadding(dp(10),dp(8),dp(10),dp(8));background=MayaTheme.shape(this@NativeChatWorkspace,MayaTheme.surface,12,false)
        }
        send = actionButton("Send message") {
            if(anyBusy || !visible || section!=0) return@actionButton
            if(agentSelected) submitAgent() else requestDirectSend()
        }
        draft.minHeight=dp(56)
        composeRow.addView(draft,LinearLayout.LayoutParams(0,-2,1f))
        dictate=actionButton("Voice input") {if(voiceSession.armed) voiceSession.listen() else confirmDictation()}.apply {tag="composer_voice";text="Mic";setPadding(0,0,0,0)}
        composeRow.addView(dictate,LinearLayout.LayoutParams(dp(48),dp(48)))
        composeRow.addView(send,LinearLayout.LayoutParams(dp(48),dp(48)))
        stopSpace=View(this).apply {visibility=View.GONE};composeRow.addView(stopSpace,LinearLayout.LayoutParams(dp(48),dp(48)))
        composer.addView(controls,1)
        fun fitSelectors() {
            if(controls.width<=0) return
            val textPaint=android.text.TextPaint().apply {textSize=14f*resources.displayMetrics.scaledDensity}
            val needed=textPaint.measureText("Agent ▾ Research ▾")+dp(48)
            val stacked=agentSelected && controls.width<needed
            val orientation=if(stacked) LinearLayout.VERTICAL else LinearLayout.HORIZONTAL
            if(controls.orientation!=orientation) {
                controls.orientation=orientation
                listOf(modePicker,agentKind).forEach {it.layoutParams=if(stacked) LinearLayout.LayoutParams(-1,dp(48)) else LinearLayout.LayoutParams(0,dp(48),1f)}
            }
        }
        controls.addOnLayoutChangeListener {_,_,_,_,_,_,_,_,_->fitSelectors()}
        stop=actionButton("STOP") {stopActive("Stopped locally.")}.apply {tag="global_stop";text="■";textSize=20f;contentDescription="Stop current work"}
        buttonColors(send,MayaTheme.copper,MayaTheme.ink);buttonColors(stop,Color.rgb(65,37,40),MayaTheme.danger)
        root = infoPage
        val newConversation=button("Clear local chat") {
            confirm("Clear this conversation?", "Clear Direct Chat, inline Agent tasks, sources, draft and approvals. Saved key, voice and your explicit Remember permission stay unchanged; remote records/usage are not erased. Revoke remembered sending separately in Privacy & limits.") {
                stopActive("Cleared locally.");clearAgents();session.clear();draft.setText("");consent.isChecked=false;restoredConsentRequired=false;renderHistory();paint()
            }
        }
        root.removeView(newConversation);menuPanel.addView(newConversation,0)
        directPermissionStatus=label("Direct sending: ask on first Send.",13f).apply {tag="direct_permission_status"}
        button("Revoke Direct consent") {
            val remoteUncertain=active?.operation?.attempted==true
            stopActive("Sending consent revoked.");configuredGrant=null;consent.isChecked=false;restoredConsentRequired=true
            val saved=directPermission.forget();updateDirectPermissionStatus()
            status.text=if(saved) "Direct sending permission revoked, including Remember. Your text and saved work stay. Next Send asks again; Chat OFF is unchanged."
                else "Direct permission revoked for this screen, but the remembered record could not be cleared. Retry Revoke before restarting the app. Nothing resent."
            if(remoteUncertain) status.append(" Already dispatched work may continue; usage may count. Revocation is not provider deletion or a refund.")
            paint()
        }
        button("Cloudflare Direct · advanced") {cloudflareConnection()}
        button("Use saved AI for Chat") {chooseConnection()}
        button("Open voice & AI settings") {navigateSettings(3)}
        label("Legacy containment",21f)
        label("This build retires legacy AutoSend, notification reading/reply, scheduled actions, raw screen/device control, unowned media uploads, plaintext exports and alternate voice engines. Stored settings/keys/snapshots are preserved, but these old paths cannot be activated by a JS trust flag. Chat, Talk, native Mic/Sunao, local Builder and approved public-source reads remain. Full reviewed phone/media adapters and shared Agent AI routing are still unfinished.")
        label("Privacy & limits", 21f)
        label("MAYA ${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE}) · development build",12f)
        label("The original orb focuses this composer. Sunao uses saved Fish after confirmation; Mic offers explicit voice-to-composer input with transcript review; it never auto-sends.",13f)
        label("Normal Chat sends text only, with optional manual Fish playback. Agent mode adds inline, separately consented bounded public research to this same conversation. Original assistant settings remain separate.")
        label("BACKGROUND / EXIT CLEARS THIS CONVERSATION", 17f)
        label("Internal Settings navigation keeps the conversation. Backgrounding, closing or recreating the Activity clears draft, temporary consent and chat. An explicitly remembered Send permission is separate and revocable here. Keep follow-ups here. Your APK key stays in Android Keystore.")
        label("2,000 characters/message · 6,000 in context · 12 messages. Cloudflare Direct has 5/minute and 50/day shared limits. Saved-account Chat uses that provider's account limits; neither route guarantees free capacity.")
        label("STOP ends local waiting, not guaranteed remote work or a refund. Failed/uncertain turns are excluded from follow-ups. No automatic retries, auto-save or message logging. Explicit encrypted snapshots are separate in Settings → Saved work & backups.")
        label("Replies are untrusted plain text and may be inaccurate. Never enter passwords, OTPs, provider tokens or private keys.")
        label("Saved-account Chat and Talk use the same configured AI selection, reviewed before sending. Typed context remains native; it is not passed into JavaScript. Cloudflare Direct alone uses the APK key and requires server Chat to be enabled independently. Selecting a local route is not a server availability test.")
        label("Talk is a separate, explicitly started Fish conversation: recognized sentences go to the reviewed existing voice AI account and replies are spoken automatically by the saved Fish voice. Only this session is shared. STOP/background ends it. Voice rows are not included in Direct context or saved-work snapshots.")
        label("Sunao sends only the chosen reply (using the original local speech-text conversion) to api.fish.audio with the saved Fish reference/key. Nothing plays automatically; confirmation is required each time. Never paste keys into Chat.")
        label("Sunao: 2,000 input characters, one synthesis request, no silent truncation or retries. Startup wait is capped at 30 seconds, playback at 180 seconds, and the total local job at 210 seconds. STOP/exit stops local audio, not guaranteed remote work or a refund.")
        label("Selected Fish voice, wake and original assistant settings remain unchanged. The configured free Fish model may be unavailable or quota-limited; no free/unlimited guarantee or fallback. Media analysis and cross-app automation are not enabled. Agent mode uses this composer and timeline, with explicit consent and plan approval.")

        label("Direct Chat context contains completed Direct turns only. Build static page is an Agent task: one local index.html with optional small AI proposals and isolated static preview, not a full IDE. Agent goals use the current message; recent Direct excerpts can be explicitly selected in the plan consent. Source sharing/explanation needs its own consent. Use a source’s composer action to ask Direct Chat about it; no hidden history transfer.")
        label("At most 3 Agent task cards per local conversation; remove a task with confirmation to free its slot. Folding does not stop or dispose a task. Switching modes stops work/revokes approvals but preserves the timeline. Leaving clears the temporary workspace, not explicitly saved snapshots. Full cross-app control and Vision are not implemented.")

        val shell = column().apply {
            setBackgroundColor(MayaTheme.background); setPadding(dp(16), dp(8), dp(16), dp(8))
        }
        val header=LinearLayout(this).apply {orientation=LinearLayout.HORIZONTAL;gravity=android.view.Gravity.CENTER_VERTICAL;tag="workspace_header"}
        header.addView(labelView("Maya",21f).apply {typeface=Typeface.create("sans-serif-medium",Typeface.NORMAL)},LinearLayout.LayoutParams(0,dp(56),1f))
        latestResponse=actionButton("Latest response") {
            followLatest=true;latestResponse.visibility=View.GONE
            conversationScroll.post {if(visible && section==0) conversationScroll.fullScroll(View.FOCUS_DOWN)}
        }.apply {tag="latest_response";text="Latest ↓";visibility=View.GONE}
        header.addView(latestResponse,LinearLayout.LayoutParams(dp(104),dp(48)))
        header.addView(actionButton("Workspace menu") {
            confirmationGeneration++;disclosure?.dismiss();disclosure=null
            agentCards.forEach {it.stop()}
            menuPanel.visibility=if(menuPanel.visibility==View.GONE) View.VISIBLE else View.GONE
        }.apply {text="⋯";textSize=24f;tag="workspace_menu_toggle"},LinearLayout.LayoutParams(dp(48),dp(48)))
        shell.addView(header)
        val body = column()
        status = labelView("No Chat request sent. Server Chat is owner-controlled.", 13f).apply {
            tag = "chat_status"; accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
        }
        body.addView(menuPanel)
        observeText(status) {updateStatusVisibility()}
        MayaTheme.status(status)
        val notices=column().apply {tag="workspace_notices"}
        body.addView(notices)
        notices.addView(status)
        readinessRecovery=actionButton("Open Voice settings") {navigateSettings(3)}.also {it.tag="connection_recovery";it.visibility=View.GONE;notices.addView(it)}
        speechStatus = labelView("Fish · IDLE\n" + NativeFishPolicy.Code.IDLE.hint, 13f).apply {
            tag = "fish_status"; visibility = View.GONE; accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
        }
        notices.addView(speechStatus)
        // Overlay warnings remain visible on every tab, never hidden in setup details.
        checksPage.removeView(touchWarning); notices.addView(touchWarning)
        body.addView(chatPage)
        val scroll = ScrollView(this).apply { isSaveEnabled = false; isFillViewport = true; addView(body) }
        conversationScroll=scroll;scroll.tag="conversation_scroll"
        scroll.setOnScrollChangeListener {v,_,y,_,_ ->
            val area=v as ScrollView;val child=area.getChildAt(0)
            if(child!=null && area.height>0) followLatest=child.height-area.height-y<=dp(72)
        }
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
        // Dedicated internal Settings destination; the same conversation/composer objects stay owned.
        // No Activity launch or onStop: real background/exit keeps the existing clear policy.
        val settings=column().apply {tag="settings_screen";visibility=View.GONE;setBackgroundColor(MayaTheme.background);setPadding(dp(16),dp(8),dp(16),dp(16))}
        settingsSurface=settings
        val settingsHeader=LinearLayout(this).apply {orientation=LinearLayout.HORIZONTAL;gravity=android.view.Gravity.CENTER_VERTICAL}
        val settingsTitle=labelView("Settings",21f)
        settingsHeader.addView(actionButton("Back to workspace") {navigateSettings(if(section in listOf(1,2,3,5)) 4 else 0)}.apply {text="‹";textSize=28f;tag="settings_back"},LinearLayout.LayoutParams(dp(48),dp(56)))
        settingsHeader.addView(settingsTitle,LinearLayout.LayoutParams(0,-2,1f));settings.addView(settingsHeader)
        val settingsNotices=column();settings.addView(settingsNotices)
        val settingsBody=FrameLayout(this).apply {tag="settings_body";isSaveEnabled=false}
        settings.addView(settingsBody,LinearLayout.LayoutParams(-1,0,1f))
        val settingsHome=column().apply {tag="settings_home"}
        settingsHome.addView(labelView("Your Maya",13f).apply {setTextColor(MayaTheme.muted)})
        val oldVoice=menuPanel.getChildAt(menuPanel.childCount-1).takeIf {voiceSurface!=null}
        if(oldVoice!=null) {menuPanel.removeView(oldVoice);settingsHome.addView(oldVoice)}
        settingsHome.addView(actionButton("Saved work & backups") {navigateSettings(5)}.apply {tag="open_saved_work"})
        val detailButtons=mutableListOf<Button>()
        listOf("Close details", "Checks ▾", "Privacy ▾").forEachIndexed {i,title ->
            actionButton(title) {navigateSettings(i)}.also {
                it.tag=listOf("details_close","details_checks","details_info")[i];detailButtons.add(it)
                if(i==0) {it.visibility=View.GONE;settingsHome.addView(it)} else settingsHome.addView(it)
            }
        }
        settingsHome.addView(labelView("Conversation stays here when you open Settings. Backgrounding or leaving the app still clears this temporary conversation.",13f).apply {setTextColor(MayaTheme.muted)})
        fun scrolling(page: View)=ScrollView(this).apply {isSaveEnabled=false;isFillViewport=true;addView(page)}
        val homeScroll=scrolling(settingsHome);val checksScroll=scrolling(checksPage);val infoScroll=scrolling(infoPage)
        val savedPage=WorkspaceLibrary(host,{savedVault},{captureSavedWorkspace()},{openSavedWorkspace(it)}).also {library=it}
        val savedScroll=scrolling(savedPage.view)
        val voicePage=FrameLayout(this).apply {tag="voice_settings_page";isSaveEnabled=false}
        listOf(homeScroll,checksScroll,infoScroll,voicePage,savedScroll).forEach {settingsBody.addView(it,FrameLayout.LayoutParams(-1,-1))}
        surface.addView(settings,FrameLayout.LayoutParams(-1,-1));stop.bringToFront()
        fun placeVoice() {
            if(voiceSurface!=null) {
                val target=if(section==3) voicePage else voiceSlot!!
                if(voiceSurface.parent!==target) {(voiceSurface.parent as? android.view.ViewGroup)?.removeView(voiceSurface);target.addView(voiceSurface,FrameLayout.LayoutParams(-1,if(section==3) -1 else dp(128)))}
                hostNoticeContainer?.let {notice ->
                    val noticeTarget=if(section==3) voicePage else hostNoticeSlot
                    if(notice.parent!==noticeTarget) {(notice.parent as? android.view.ViewGroup)?.removeView(notice);noticeTarget.addView(notice,FrameLayout.LayoutParams(-1,-2))}
                    notice.bringToFront()
                }
                voiceExpanded=section==3
                voiceSettings?.invoke(voiceExpanded)
            }
        }
        restoreVoicePresentation={placeVoice()}
        navigateSettings={index ->
            if(index!=section) stopActive(if(anyBusy || agentCards.any {it.stoppable}) "Workspace work stopped for Settings. Conversation retained." else "Settings toggled; conversation retained.")
            hideKeyboard();draft.clearFocus();confirmationGeneration++;disclosure?.dismiss();disclosure=null
            if(section==5 && index!=5) library?.leave()
            section=index;menuPanel.visibility=View.GONE
            shell.visibility=if(index==0) View.VISIBLE else View.GONE
            composer.visibility=shell.visibility;chatPage.visibility=shell.visibility
            settings.visibility=if(index==0) View.GONE else View.VISIBLE
            settingsTitle.text=when(index) {1->"Checks & identity";2->"Privacy & limits";3->"Voice & appearance";5->"Saved work & backups";else->"Settings"}
            homeScroll.visibility=if(index==4) View.VISIBLE else View.GONE
            checksScroll.visibility=if(index==1) View.VISIBLE else View.GONE;checksPage.visibility=checksScroll.visibility
            infoScroll.visibility=if(index==2) View.VISIBLE else View.GONE;infoPage.visibility=infoScroll.visibility
            voicePage.visibility=if(index==3) View.VISIBLE else View.GONE
            savedScroll.visibility=if(index==5) View.VISIBLE else View.GONE
            if(index==5) library?.enter()
            if(index==2) updateDirectPermissionStatus()
            val target=if(index==0) body else settingsNotices
            if(notices.parent!==target) {(notices.parent as android.view.ViewGroup).removeView(notices);target.addView(notices,if(index==0) 1 else 0)}
            detailButtons.forEachIndexed {i,button->button.isSelected=i==index}
            placeVoice();paint()
            settingsHeader.announceForAccessibility(if(index==0) "Conversation" else settingsTitle.text)
        }
        collapseVoiceSettings={navigateSettings(0)}
        menuPanel.addView(actionButton("Settings") {navigateSettings(4)}.apply {tag="open_settings"})
        navigateSettings(0)
        draft.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) { if(!s.isNullOrEmpty() && status.text.toString()=="Temporary chat cleared on leaving. Saved work kept.") status.text="";paint() }
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
        if(!visible || anyBusy || section!=0) return
        draft.requestFocus()
        (getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager)?.showSoftInput(draft,InputMethodManager.SHOW_IMPLICIT)
    }
    private fun clearAgents() {
        followLatest=true;if(::latestResponse.isInitialized) latestResponse.visibility=View.GONE
        val old=agentCards.toList();agentCards.clear();taskControls.clear();buildTask=null;timeline.filterIsInstance<ChatAttempt>().forEach {it.clear()};timeline.clear();shownDirect=0
        old.forEach {it.dispose()}
    }
    private fun submitAgent() {
        if(agentKind.selectedItemPosition==1) {submitBuild();return}
        val value=draft.text.toString()
        val manual=try {com.maya.ai.agent.ResearchPlan.parse(value)} catch (_: Exception) {null}
        if(value.isBlank() || !NativeChatProtocol.validReply(value) || (manual==null && value.length>400)) {
            status.text="Agent goal needs 1–400 characters, or a valid manual WIKI / REPO plan ≤450. Nothing truncated/sent.";return
        }
        if(agentCards.size>=3) {status.text="All 3 task slots are used. Remove a task with confirmation to free a slot; draft kept.";return}
        agentCards.forEach {it.stop()}
        fun clip(s: String)=s.take(400).let {if(it.lastOrNull()?.isHighSurrogate()==true) it.dropLast(1) else it}
        val context=session.messages().takeLast(2).joinToString("\n") {"${it.role}: ${clip(it.content)}"}
        lateinit var card: com.maya.ai.agent.InlineAgentTurn
        card=com.maya.ai.agent.InlineAgentTurn(host,value,context,researchServices,
            {turn -> taskAllowed(turn)},
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
            taskControls[existing]?.folded=false
            timeline.add(NativeChatProtocol.Message("user","AGENT · Builder follow-up\n$value"))
            draft.setText("");hideKeyboard();renderHistory();existing.propose(value);return
        }
        if(agentCards.size>=3) {status.text="All 3 task slots are used. Remove a task with confirmation to start another; draft kept.";return}
        agentCards.forEach {it.stop()}
        val card=com.maya.ai.agent.InlineBuildTurn(host,value,researchServices,
            {turn -> taskAllowed(turn)}, {paint()})
        buildTask=card;agentCards.add(card);timeline.add(card);draft.setText("");hideKeyboard();renderHistory();revealTurn(card.view)
        status.text="Builder stays in this conversation. One local index.html; static preview needs confirmation. Save an explicit snapshot from Settings to retain it."
        if(!manual) card.propose(value)
    }
    private fun revealTurn(view: View) {
        followLatest=true;latestResponse.visibility=View.GONE
        val generation=confirmationGeneration
        handler.post {
            if(visible && section==0 && generation==confirmationGeneration && view.parent===history)
                view.requestRectangleOnScreen(android.graphics.Rect(0,0,view.width,dp(120)),true)
        }
    }
    private fun confirm(title: String, text: String, yes: () -> Unit) {
        if (disclosure?.isShowing == true) return
        cancelPendingVoiceStart();voiceSession.hold()
        val generation = ++confirmationGeneration
        disclosure = AlertDialog.Builder(this).setTitle(title).setMessage(text)
            .setNegativeButton("Cancel") { _, _ -> if (confirmationGeneration == generation) confirmationGeneration++ }
            .setPositiveButton("Continue") { _, _ -> if (visible && confirmationGeneration == generation) { confirmationGeneration++; yes() } }.create().also {
                it.setOnDismissListener { if (confirmationGeneration == generation) confirmationGeneration++ }
                it.show(); MayaTheme.dialog(it); it.getButton(AlertDialog.BUTTON_POSITIVE).filterTouchesWhenObscured = true
                val dialog=it;val window=dialog.window;val callback=window?.callback
                if(window!=null && callback!=null) window.callback=object : android.view.Window.Callback by callback {
                    override fun dispatchTouchEvent(event: MotionEvent): Boolean {
                        if(event.flags and (MotionEvent.FLAG_WINDOW_IS_OBSCURED or MotionEvent.FLAG_WINDOW_IS_PARTIALLY_OBSCURED)!=0) {confirmationGeneration++;dialog.dismiss();return true}
                        return callback.dispatchTouchEvent(event)
                    }
                }
            }
    }
    private fun start(kind: String, turn: NativeChatConversation.Turn?, configured: Boolean=false, work: (Job) -> Any) {
        if (anyBusy || !visible || (kind == "chat" && agentSelected)) { if (turn != null) session.fail(turn); return }
        cancelPendingVoiceStart();voiceSession.hold()
        val job = Job(kind, turn, SystemClock.elapsedRealtime()); active = job
        job.configured=configured
        if (kind == "check") {
            obscuredTouchSeen = false; touchWarning.text = ""
            job.accessTicket = accessDiagnostic.begin(); showAccessDiagnostic()
        }
        status.text = "Working locally / waiting for a bounded result… STOP is available."; paint()
        job.timeout = Runnable { if (active === job) stopActive("Local 20-second deadline expired.", NativeAccessDiagnostic.State.TIMEOUT) }.also { handler.postDelayed(it, NativeChatProtocol.DEADLINE_MS) }
        fun launch(ready: Boolean) {
            if (active !== job || !visible) return
            if (!ready) { finish(job, null, "ASSISTANT_BUSY"); return }
            attachAttempt(job)
            try { executor.execute {
                try { job.operation.check(); val result = work(job); job.operation.check(); runOnUiThread { finish(job, result, null) } }
                catch (e: NativeChatProtocol.Rejected) { runOnUiThread { finish(job, null, e.code) } }
                catch (_: Exception) { runOnUiThread { finish(job, null, "SERVICE_UNAVAILABLE") } }
            } } catch (_: java.util.concurrent.RejectedExecutionException) { finish(job, null, "BUSY") }
        }
        // Same fresh local gate for Send and the explicit no-network diagnostic.
        if(configured) {
            val main=host as? MainActivity
            if(main==null || MainActivity.instance!==main) finish(job,null,"READINESS_MAIN_TRANSITION")
            else main.nativeConfiguredReady {reason ->if(reason==Reason.READY) launch(true) else finish(job,null,"READINESS_"+reason.name)}
        } else if (kind == "chat" || kind == "readiness") inspectReadiness(job) { reason ->
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
        if(job.kind=="chat" && error?.startsWith("READINESS_")==true && !job.operation.attempted) {
            localSendBlocked=true
            job.attempt?.readinessFailure=Reason.values().firstOrNull {it.name==error.removePrefix("READINESS_")}
        }
        var accepted=false
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
                        val shouldFollow=followLatest
                        accepted=true;job.attempt?.let {timeline.remove(it);it.clear()};job.attempt=null
                        draft.setText(""); renderHistory(); if(shouldFollow) history.getChildAt((history.childCount-2).coerceAtLeast(0))?.let {revealTurn(it)} else latestResponse.visibility=View.VISIBLE; status.text = "Model response received; it may be inaccurate."
                    } else status.text = "Late result excluded. No automatic resend."
                }
                result === NativeChatResponse.Result.Access && job.kind == "check" ->
                    status.text = "APK signed empty check accepted; exact replay denied. No AI called. This is not a permanent login or proof that Chat is enabled."
                result is NativeChatResponse.Result.Error -> {
                    if(!job.configured && result.code=="CHAT_NOT_ENABLED") {
                        cloudflareReviewed=false
                        getSharedPreferences("maya_connections",0).edit().putBoolean("cloudflare_reviewed",false).apply()
                    }
                    job.turn?.let { session.fail(it) }
                    status.text = errorText(result.code, job.kind == "chat" && result.remoteUncertain) + (result.diagnostic?.let { " Diagnostic: $it." } ?: "")
                }
                else -> { job.turn?.let { session.fail(it) }; status.text = errorText("INVALID_SERVER_RESPONSE", job.kind == "chat" && job.operation.attempted) }
            }
        } catch (_: Exception) { job.turn?.let { session.fail(it) }; status.text = errorText("INVALID_SERVER_RESPONSE", job.kind == "chat" && job.operation.attempted) }
        if (job.kind == "chat") {
            val duration = String.format(java.util.Locale.US, "%.2f", seconds)
            status.append(if (job.operation.attempted) "\nLocal wait: $duration s (${if(job.configured) "native queue + network + AI provider" else "key/signing + network + server"}; not model-only speed)."
                else "\nLocal pre-dispatch wait: $duration s. No network request sent.")
        }
        if(job.kind=="chat" && !accepted) {
            job.attempt?.takeIf {it in timeline}?.let {it.pending=false;it.detail="No reply accepted.\n"+status.text.toString()}
            renderHistory()
        }
        paint()
    }
    private fun stopActive(message: String, accessState: NativeAccessDiagnostic.State = NativeAccessDiagnostic.State.STOPPED) {
        configuredPreparing=false;configuredGrant=null;localSendBlocked=false
        confirmationGeneration++;disclosure?.dismiss();disclosure=null
        agentCards.forEach {it.stop()}
        fishTalkBusy=false;fishTalkPreparing=false;(host as? MainActivity)?.stopFishTalk()
        cancelPendingVoiceStart();voiceSession.end();speech.stop();dictation.clear()
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
            if(job.kind=="chat") {
                job.attempt?.takeIf {it in timeline}?.let {it.pending=false;it.detail=status.text.toString()}
                renderHistory()
            }
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
            "CHAT_NOT_ENABLED" -> "Cloudflare Chat is OFF or owner review is incomplete. This route is now blocked locally; use AI connection."
            "CONFIGURED_ACCESS_DENIED" -> "The selected AI account denied access. Check its existing settings; no alternate provider was tried."
            "CONFIGURED_RATE_LIMIT" -> "The selected AI account reached its quota/rate limit. No retry or paid fallback."
            "CONFIGURED_MODEL_UNAVAILABLE" -> "The reviewed AI model is unavailable. No model was silently changed."
            "CONFIGURED_INVALID_REPLY" -> "AI returned an invalid, truncated or tool-call response. Nothing accepted or executed."
            "CONFIGURED_NETWORK_ERROR" -> "The selected AI request failed or timed out. Remote work may have occurred; no automatic retry."
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
    private fun paintDictation() {
        if(!::dictationPanel.isInitialized) return
        val state=dictation.state
        voiceSessionPanel.visibility=if(voiceSession.armed) View.VISIBLE else View.GONE
        voiceSessionStatus.text="Voice session · ${voiceSession.phase.name.lowercase()}\nNo auto-Send · input grant ends within 5 minutes"
        nextVoiceInput.visibility=if(!anyBusy && voiceSession.phase in setOf(com.maya.ai.voice.ForegroundVoiceSession.Phase.READY,com.maya.ai.voice.ForegroundVoiceSession.Phase.WAITING)) View.VISIBLE else View.GONE
        nextVoiceInput.isEnabled=visible && section==0 && !anyBusy
        dictationPanel.visibility=if(state==NativeDictation.State.IDLE) View.GONE else View.VISIBLE
        dictationStatus.text=listOf(dictation.selectionLabel,state.hint,dictation.readyMs?.let {"Input ready: $it ms"} ?: "",dictation.finalizationMs?.let {"Speech end → final transcript: $it ms · not model or Fish latency"} ?: "").filter {it.isNotEmpty()}.joinToString("\n")
        voiceOptions.visibility=if(dictation.recoverable) View.VISIBLE else View.GONE
        voiceOptions.isEnabled=visible && section==0 && !anyBusy
        dictationText.text=dictation.transcript
        dictationText.visibility=if(dictation.transcript.isEmpty()) View.GONE else View.VISIBLE
        useTranscript.visibility=if(state==NativeDictation.State.REVIEW) View.VISIBLE else View.GONE
        useTranscript.isEnabled=visible && section==0 && active==null && !speech.busy && !agentBusy
        discardTranscript.visibility=if(state==NativeDictation.State.IDLE) View.GONE else View.VISIBLE
        microphonePermission.visibility=if(state==NativeDictation.State.PERMISSION_REQUIRED) View.VISIBLE else View.GONE
    }
    fun offerForegroundVoice() {offerWakeConversation()}
    fun offerWakeConversation() {
        if(!visible || anyBusy || disclosure?.isShowing==true) return
        if(section!=0) navigateSettings(0)
        if(agentSelected) selectDirectMode()
        confirmFishTalk(true)
    }
    fun wakeConversationReady() {
        if(visible && fishTalkBusy) {status.text="Wake ready · say Maya and your question. Fish will speak the answer.";paint()}
    }
    private fun confirmDictation() {
        if(!visible || section!=0 || anyBusy) return
        cancelPendingVoiceStart();voiceSession.end()
        agentCards.forEach {it.stop()}
        hideKeyboard();draft.clearFocus()
        val options=LinearLayout(this).apply {orientation=LinearLayout.VERTICAL;setPadding(dp(16),0,dp(16),0);isSaveEnabled=false}
        val language=Spinner(this).apply {adapter=choiceAdapter(listOf("Urdu · ur-PK","Hindi · hi-IN","English · en-IN","English · en-US"));isSaveEnabled=false;filterTouchesWhenObscured=true;contentDescription="Recognition language"}
        val offline=CheckBox(this).apply {text="On-device engine only · no network fallback";isChecked=true;isSaveEnabled=false;filterTouchesWhenObscured=true;MayaTheme.toggle(this)}
        val followup=CheckBox(this).apply {text="Keep foreground voice input open · up to 5 minutes";tag="voice_session_opt_in";isChecked=false;isSaveEnabled=false;filterTouchesWhenObscured=true;MayaTheme.toggle(this);visibility=if(agentSelected) View.GONE else View.VISIBLE}
        val wakeOff=CheckBox(this).apply {text="Turn legacy Wake OFF to use native voice input";tag="voice_session_wake_off";isChecked=false;isSaveEnabled=false;filterTouchesWhenObscured=true;MayaTheme.toggle(this);visibility=if(getSharedPreferences("maya",0).getBoolean("wake",false) || com.maya.ai.WakeWordService.instance!=null) View.VISIBLE else View.GONE}
        val availability=labelView("",13f).apply {tag="recognition_availability";accessibilityLiveRegion=View.ACCESSIBILITY_LIVE_REGION_POLITE}
        fun showServicePresence() {
            val failure=AndroidDictationPort(host).serviceFailure(offline.isChecked)
            availability.text=when(failure) {
                NativeDictation.State.ON_DEVICE_UNAVAILABLE -> "On-device engine: unavailable on this phone. To try the installed system service, uncheck on-device only yourself; it may use internet/data."
                NativeDictation.State.SYSTEM_UNAVAILABLE -> "System recognition service: not found. Typing remains available."
                null -> "Selected engine: installed. Language/model support is not confirmed until recognition responds."
                else -> "Service availability could not be checked. Typing remains available."
            }
        }
        offline.setOnCheckedChangeListener {_,_->showServicePresence()};showServicePresence()
        options.addView(language,LinearLayout.LayoutParams(-1,dp(48)));options.addView(offline);options.addView(followup);options.addView(wakeOff);options.addView(availability)
        val optionScroll=ScrollView(this).apply {isSaveEnabled=false;addView(options)}
        if(disclosure?.isShowing==true) return
        val generation=++confirmationGeneration
        disclosure=AlertDialog.Builder(this).setTitle("Voice input to composer")
            .setMessage("Record up to 20 seconds for a transcript you review before use. On-device mode fails if unavailable; it never switches services. If you uncheck it, Android's default speech service may process audio remotely using internet/data. No audio to Chat or Fish; saved output voice stays unchanged. Nothing auto-sends. Optional foreground session reuses this input choice without repeating Maya: after successful Sunao it listens again, for up to 15 seconds of silence. Text-only replies use Continue listening. End/STOP/background/error ends the session. An active legacy Wake service must stop; a saved ON switch alone does not block input. The separate unchecked option turns only legacy Wake OFF and leaves it OFF after this session; it does not change Fish or server Chat.")
            .setView(optionScroll).setNeutralButton("Voice settings") {_,_->if(visible) navigateSettings(3)}.setNegativeButton("Cancel",null).setPositiveButton("Start voice") {_,_->
                if(visible && section==0 && !anyBusy && generation==confirmationGeneration) {
                    confirmationGeneration++
                    val selected=NativeDictation.LANGUAGES.getOrNull(language.selectedItemPosition) ?: return@setPositiveButton
                    val onDeviceOnly=offline.isChecked
                    val keepInput=followup.isChecked && !agentSelected
                    val turnWakeOff=wakeOff.visibility==View.VISIBLE && wakeOff.isChecked
                    fun startReviewedInput() {
                        if(visible && section==0 && generation+1==confirmationGeneration && !anyBusy) {
                            awaitVoiceFocus(generation+1) {
                                if(keepInput) voiceSession.begin(selected,onDeviceOnly) else dictation.start(selected,onDeviceOnly,true)
                            }
                        }
                    }
                    handler.post {
                        if(!visible || section!=0 || generation+1!=confirmationGeneration || anyBusy) return@post
                        if(turnWakeOff) (host as? MainActivity)?.turnOffLegacyWakeForNativeVoice {ok ->
                            if(visible && section==0 && generation+1==confirmationGeneration) {
                                if(ok) startReviewedInput() else {status.text="Legacy Wake OFF could not be fully verified. No microphone started. Check Voice settings; no automatic retry.";paint()}
                            }
                        } else startReviewedInput()
                    }
                }
            }.create().also {d->d.setOnDismissListener {if(generation==confirmationGeneration) confirmationGeneration++};d.show();MayaTheme.dialog(d);d.getButton(AlertDialog.BUTTON_POSITIVE).filterTouchesWhenObscured=true
                val w=d.window;val callback=w?.callback
                if(w!=null && callback!=null) w.callback=object : android.view.Window.Callback by callback {
                    override fun dispatchTouchEvent(event: MotionEvent): Boolean {
                        if(event.flags and (MotionEvent.FLAG_WINDOW_IS_OBSCURED or MotionEvent.FLAG_WINDOW_IS_PARTIALLY_OBSCURED)!=0) {confirmationGeneration++;d.dismiss();return true}
                        return callback.dispatchTouchEvent(event)
                    }
                }
            }
    }
    private fun useDictationTranscript() {
        if(!visible || section!=0 || dictation.state!=NativeDictation.State.REVIEW || active!=null || speech.busy || agentBusy) return
        val text=dictation.transcript;val before=draft.text.toString()
        fun put() {if(visible && section==0 && dictation.state==NativeDictation.State.REVIEW && dictation.transcript==text && draft.text.toString()==before) {
            dictation.clear();voiceSession.usedTranscript();draft.setText(text);draft.setSelection(text.length);status.text="Transcript copied locally. Edit/review it, then Send separately with the relevant consent."}}
        if(before.isNotEmpty() && before!=text) confirm("Replace this draft with the transcript?","Only local text is replaced. Cancel keeps both the draft and reviewed transcript. No request or phone action.") {put()} else put()
    }
    private fun attachAttempt(job: Job) {
        if(job.kind!="chat" || job.turn==null || job.attempt!=null) return
        val attempt=ChatAttempt(job.turn.input.last().content)
        job.attempt=attempt;timeline.add(attempt);renderHistory()
        history.getChildAt(history.childCount-1)?.let {revealTurn(it)}
    }
    private fun attemptView(attempt: ChatAttempt): View {
        val card=LinearLayout(this).apply {orientation=LinearLayout.VERTICAL;tag="chat_attempt";isSaveEnabled=false;background=MayaTheme.shape(this@NativeChatWorkspace);setPadding(dp(12),dp(8),dp(12),dp(8));layoutParams=LinearLayout.LayoutParams(-1,-2).apply {bottomMargin=dp(12)}}
        card.addView(labelView("You · Chat attempt",13f))
        card.addView(labelView(attempt.text,16f).apply {setTextIsSelectable(true);maxLines=6;ellipsize=android.text.TextUtils.TruncateAt.END;setOnClickListener {maxLines=if(maxLines==6) Int.MAX_VALUE else 6};minHeight=dp(48)})
        val reason=attempt.readinessFailure
        card.addView(labelView(if(reason!=null) NativeChatReadiness.sendSummary(reason) else attempt.detail,13f).apply {
            tag="attempt_status";MayaTheme.status(this);if(reason!=null) {maxLines=Int.MAX_VALUE;ellipsize=null}
            accessibilityLiveRegion=View.ACCESSIBILITY_LIVE_REGION_POLITE
        })
        if(reason!=null && !attempt.pending) {
            card.addView(actionButton(if(NativeChatReadiness.voiceSettingsFix(reason)) "Open Voice settings" else "Open readiness checks") {
                if(visible && section==0 && !anyBusy && attempt in timeline) {
                    navigateSettings(if(NativeChatReadiness.voiceSettingsFix(reason)) 3 else 1)
                    status.text=reason.hint+" No setting changed automatically. Return here and tap Send yourself."
                }
            }.also {recoveryButtons.add(it)})
            card.addView(actionButton("Why Send was blocked") {
                if(visible && section==0 && attempt in timeline && disclosure?.isShowing!=true) {
                    confirmationGeneration++
                    disclosure=AlertDialog.Builder(this).setTitle("Local Send check · ${reason.name}")
                        .setMessage(reason.hint+"\n\n"+attempt.detail+"\n\nNo automatic retry. Opening Settings keeps this draft and conversation; actually leaving/backgrounding still clears temporary work.")
                        .setPositiveButton("Close",null).create().also {it.show();MayaTheme.dialog(it)}
                }
            }.also {recoveryButtons.add(it)})
        }
        if(!attempt.pending) {
            card.addView(labelView("Not automatically included in AI context. Restore copies to the draft; it never resends.",12f))
            val actions=LinearLayout(this).apply {orientation=LinearLayout.HORIZONTAL;card.addView(this)}
            actions.addView(actionButton("Restore draft") {
                if(!visible || section!=0 || anyBusy || attempt !in timeline) return@actionButton
                val original=draft.text.toString();val text=attempt.text
                fun restore() {if(visible && section==0 && !anyBusy && attempt in timeline && draft.text.toString()==original) {selectDirectMode();draft.setText(text);draft.setSelection(draft.text.length);status.text="Draft restored locally. Review context and consent before a separate Send."}}
                if(original.isNotEmpty() && original!=text) confirm("Replace the current draft?","Restore this failed/cancelled attempt locally. No network request; Cancel keeps the current draft.") {restore()} else restore()
            }.also {recoveryButtons.add(it)},LinearLayout.LayoutParams(0,-2,1f))
            actions.addView(actionButton("Dismiss attempt") {
                if(!visible || section!=0 || anyBusy || attempt !in timeline) return@actionButton
                confirm("Remove this local attempt card?","Only this attempt card is removed. The draft and completed AI context stay unchanged; remote records/usage are not erased.") {
                    if(!anyBusy && attempt in timeline) {timeline.remove(attempt);attempt.clear();renderHistory()}
                }
            }.also {recoveryButtons.add(it)},LinearLayout.LayoutParams(0,-2,1f))
        }
        return card
    }
    private fun reviewDirectContext() {
        if(!visible || section!=0 || agentSelected || anyBusy || disclosure?.isShowing==true) return
        hideKeyboard();draft.clearFocus()
        val candidate=try {session.review(draft.text.toString())} catch(e: NativeChatProtocol.Rejected) {status.text=errorText(e.code,false);return}
        val text="LOCAL SNAPSHOT · not a request or approval\nDestination: ${if(useConfiguredChat) "saved AI account (exact provider/model reviewed on Send)" else NativeChatProtocol.ORIGIN}\n${candidate.size} messages · ${candidate.sumOf {it.content.length}} characters\nOnly the exact Direct messages below are candidate context. Agent cards, failed attempts, files, keys and Fish voice conversations are excluded unless their text was explicitly placed in this draft. Send checks limits and consent again. Fixed server instructions and signing metadata are not shown here. Changes after closing require a new review.\n\n"+
            candidate.mapIndexed {i,message->"${i+1}. ${if(message.role=="user") "You" else "Maya"}\n${message.content}"}.joinToString("\n\n")
        val copy=labelView(text,14f).apply {tag="direct_context_snapshot";setTextIsSelectable(true);setPadding(dp(16),dp(8),dp(16),dp(8))}
        val scroll=ScrollView(this).apply {isSaveEnabled=false;addView(copy)}
        confirmationGeneration++
        disclosure=AlertDialog.Builder(this).setTitle("Review Direct context").setView(scroll).setPositiveButton("Close",null).create().also {
            it.show();MayaTheme.dialog(it);it.getButton(AlertDialog.BUTTON_POSITIVE).filterTouchesWhenObscured=true
            val width=host.window.decorView.width.takeIf {it>0} ?: resources.displayMetrics.widthPixels
            val height=host.window.decorView.height.takeIf {it>0} ?: resources.displayMetrics.heightPixels
            it.window?.setLayout((width-dp(32)).coerceAtLeast(1),(height*0.75f).toInt().coerceAtLeast(1))
        }
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
        history.removeAllViews(); speechButtons.clear();recoveryButtons.clear()
        val direct=session.messages()
        if(direct.size<shownDirect) {timeline.removeAll {it is NativeChatProtocol.Message};shownDirect=0}
        timeline.addAll(direct.drop(shownDirect));shownDirect=direct.size
        timeline.forEach { entry ->
            if(entry is com.maya.ai.agent.WorkspaceTask) {
                val controls=controlsFor(entry)
                (controls.root.parent as? android.view.ViewGroup)?.removeView(controls.root);history.addView(controls.root)
                (entry.view.parent as? android.view.ViewGroup)?.removeView(entry.view);history.addView(entry.view);return@forEach
            }
            if(entry is VoiceLine) {
                history.addView(labelView((if(entry.role=="user") "You · voice\n" else "Maya · Fish conversation\n")+entry.text).apply {
                    setTextIsSelectable(true);setPadding(dp(14),dp(12),dp(14),dp(12));background=MayaTheme.shape(this@NativeChatWorkspace)
                    maxLines=6;ellipsize=android.text.TextUtils.TruncateAt.END;minHeight=dp(48);setOnClickListener {maxLines=if(maxLines==6) Int.MAX_VALUE else 6}
                });return@forEach
            }
            if(entry is ChatAttempt) {history.addView(attemptView(entry));return@forEach}
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
        contextNote.text = "Context: ${session.messages().size} Chat messages · ${agentCards.size}/3 Agent tasks. One timeline; context/source sharing is explicit."
        paint()
    }
    private fun paint() {
        if (!::send.isInitialized || !::stop.isInitialized) return
        val busy = anyBusy
        send.isEnabled = !busy && section==0 && draft.text.toString().isNotBlank()
        paintDictation()
        connectionButton.text=if(useConfiguredChat && localSendBlocked) "AI needs attention · open connection" else if(useConfiguredChat) "AI: saved account · same selection as Talk" else if(cloudflareReviewed) "AI: Cloudflare · server not verified" else "AI: Cloudflare · unavailable / Chat OFF"
        connectionButton.isEnabled=visible && !busy
        if(::readinessRecovery.isInitialized) readinessRecovery.visibility=if(localSendBlocked && !busy && section==0) View.VISIBLE else View.GONE
        connectionButton.visibility=if(agentSelected) View.GONE else View.VISIBLE
        talkButton.visibility=if(agentSelected || busy) View.GONE else View.VISIBLE
        talkButton.isEnabled=visible && section==0 && !busy
        dictate.visibility=if(busy) View.GONE else View.VISIBLE
        dictate.isEnabled=visible && section==0 && !busy
        send.text="↑";send.textSize=22f
        send.contentDescription=if(agentSelected) "Submit Agent task" else "Send message"
        projectChip.visibility=if(agentSelected && buildTask!=null && kindSelection==1) View.VISIBLE else View.GONE
        contextReview.visibility=if(agentSelected) View.GONE else View.VISIBLE
        contextReview.isEnabled=visible && section==0 && !busy
        agentKind.visibility=if(agentSelected) View.VISIBLE else View.GONE
        agentKind.isEnabled=!busy
        consent.visibility=View.GONE
        draft.hint=if(agentSelected) (if(kindSelection==1) "Build or revise this page…" else "What should I research?") else "Message Maya…"
        agentCards.forEach {task ->
            task.refresh()
            taskControls[task]?.let {ui ->
                task.view.visibility=if(ui.folded) View.GONE else View.VISIBLE
                val kind=if(task is com.maya.ai.agent.InlineBuildTurn) "Builder" else "Research"
                val state=when {task.executing->"running";task.busy->"waiting";task.approved->"approved · expiry still applies";task.stoppable->"local preview active";else->"idle"}
                val label=if(task is com.maya.ai.agent.InlineBuildTurn) "index.html" else task.goal.take(80).let {if(it.lastOrNull()?.isHighSurrogate()==true) it.dropLast(1) else it}
                ui.summary.text="$kind · $label\n$state · ${agentCards.size}/3 slots used"+if(ui.folded) " · folded (not stopped)" else ""
                ui.fold.text=if(ui.folded) "Expand task" else "Fold task"
                ui.fold.contentDescription=ui.fold.text;ui.fold.isSelected=ui.folded
                ui.fold.isEnabled=visible && section==0 && !busy
                ui.remove.isEnabled=visible && section==0 && !busy
                ui.stop.visibility=if(task.stoppable) View.VISIBLE else View.GONE
                ui.stop.isEnabled=visible && section==0 && task.stoppable
            }
        }
        recoveryButtons.forEach {it.isEnabled=visible && section==0 && !busy}
        readinessButton.isEnabled = !busy
        fishCheck.isEnabled = !busy; fishSample.isEnabled = !busy
        speechButtons.forEach { (button, text) -> button.isEnabled = !busy && NativeFishPolicy.validText(text) }
        stop.isEnabled = busy || pendingVoiceStart!=null || voiceSession.armed || agentCards.any {it.stoppable}
        stop.visibility=if(stop.isEnabled) View.VISIBLE else View.GONE
        stopSpace.visibility=stop.visibility
        settingsSurface?.setPadding(dp(16),dp(8),dp(16),dp(if(stop.isEnabled) 84 else 16))
        emptyState.visibility=if(timeline.isEmpty() && !busy && dictation.state==NativeDictation.State.IDLE) View.VISIBLE else View.GONE
        voiceComponent?.let {view ->
            val height=if(voiceExpanded) -1 else dp(if(timeline.isEmpty() && !busy && dictation.state==NativeDictation.State.IDLE) 128 else 72)
            if(view.layoutParams.height!=height) view.layoutParams=view.layoutParams.apply {this.height=height}
            if(!voiceExpanded) voiceSlot?.let {slot->if(slot.layoutParams.height!=height) slot.layoutParams=slot.layoutParams.apply {this.height=height}}
        }
        updateStatusVisibility()
        touchWarning.visibility=if(touchWarning.text.isEmpty()) View.GONE else View.VISIBLE
         create.isEnabled = !busy; copy.isEnabled = !busy && publicText != null; check.isEnabled = !busy
        draft.isEnabled = !busy; consent.isEnabled = !busy
        counter.visibility=if(draft.text.length >= (if(agentSelected) 320 else 1600)) View.VISIBLE else View.GONE
        counter.text = when {
            agentSelected && kindSelection==1 -> "Build · ${draft.text.length} / 2,000 · AI request ≤400"
            agentSelected -> "Agent · ${draft.text.length} · goal ≤400 / plan ≤450"
            else -> "Chat · ${draft.text.length} / 2,000"
        }
    }
    private fun updateStatusVisibility() {
        val text=status.text.toString()
        val routine=listOf("No Chat request", "Mode changed", "Task type selected", "Settings toggled").any {text.startsWith(it)}
        val repeatedReadiness=section==0 && timeline.filterIsInstance<ChatAttempt>().any {
            !it.pending && it.readinessFailure!=null && it.detail=="No reply accepted.\n"+text
        }
        status.visibility=if(text.isBlank() || repeatedReadiness || (routine && !text.contains("Remote",true))) View.GONE else View.VISIBLE
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
    private fun runtimeReadiness(includeSavedWake: Boolean=true) = NativeChatReadiness.runtime(
        includeSavedWake && getSharedPreferences("maya", Context.MODE_PRIVATE).getBoolean("wake", false),
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
        if(event.flags and (MotionEvent.FLAG_WINDOW_IS_OBSCURED or MotionEvent.FLAG_WINDOW_IS_PARTIALLY_OBSCURED)!=0) {if(fishTalkBusy) {(host as? MainActivity)?.stopFishTalk();fishTalkEnded("Conversation stopped: obscured screen.")};cancelPendingVoiceStart();voiceSession.end();dictation.stop()}
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
            text=(if(values[position]=="Direct Chat") "Direct" else values[position])+" ▾";MayaTheme.label(this,14f);setPadding(dp(8),0,dp(8),0);gravity=android.view.Gravity.CENTER_VERTICAL
            maxLines=1;ellipsize=android.text.TextUtils.TruncateAt.END
            layoutParams=android.view.ViewGroup.LayoutParams(-1,dp(48));contentDescription=values[position]
        }
        override fun getDropDownView(position: Int,convertView: View?,parent: android.view.ViewGroup): View = TextView(this@NativeChatWorkspace).apply {
            text=values[position];MayaTheme.label(this,16f);setPadding(dp(16),dp(12),dp(16),dp(12));minHeight=dp(48);setBackgroundColor(MayaTheme.surface)
        }
    }
    private fun runOnUiThread(action: () -> Unit) { host.runOnUiThread { action() } }
    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
    fun resume() { visible = true;if(section==2) updateDirectPermissionStatus();if(section==5) library?.enter(); restoreVoicePresentation(); showAccessDiagnostic(); paint() }
    fun pause() { configuredPreparing=false;configuredGrant=null;fishTalkBusy=false;fishTalkPreparing=false;(host as? MainActivity)?.stopFishTalk();library?.leave();inputWindowFocused=false;cancelPendingVoiceStart();voiceSession.end();dictation.stop();visible=false; confirmationGeneration++; disclosure?.dismiss(); disclosure = null; agentCards.forEach {it.stop()} }
    fun focusChanged(hasFocus: Boolean) {
        inputWindowFocused=hasFocus
        if(hasFocus) pendingVoiceStart?.invoke(true)
        if(!hasFocus && (dictation.busy || voiceSession.phase==com.maya.ai.voice.ForegroundVoiceSession.Phase.ECHO)) {if(fishTalkBusy) {(host as? MainActivity)?.stopFishTalk();fishTalkEnded("Conversation stopped: obscured screen.")};cancelPendingVoiceStart();voiceSession.end();dictation.stop()}
        if(!hasFocus && fishTalkBusy) {(host as? MainActivity)?.stopFishTalk();fishTalkEnded("Conversation paused because the app lost focus. Tap Talk to start again.")}
        if(!hasFocus && agentBusy) agentCards.forEach {it.stop()}
    }
    private fun endLocalSession() {
        val hadData=(::draft.isInitialized && draft.text.isNotEmpty()) || session.messages().isNotEmpty() || timeline.isNotEmpty()
        collapseVoiceSettings()
        clearAgents()
        visible = false; confirmationGeneration++; disclosure?.dismiss(); disclosure = null
        stopActive(if(hadData) "Temporary chat cleared on leaving. Saved work kept." else "", NativeAccessDiagnostic.State.LEFT_SCREEN)
        session.clear()
        if (::draft.isInitialized) draft.setText("")
        if (::consent.isInitialized) consent.isChecked = false
        restoredConsentRequired=false
        if (::history.isInitialized && ::contextNote.isInitialized) renderHistory()
    }
    fun leaveScreen() { endLocalSession() }
    fun dispose() {
        // Also fence callbacks if destruction occurs without the normal onStop path.
        library?.dispose();endLocalSession(); handler.removeCallbacksAndMessages(null)
    }
    fun requestClose() {
        if(library?.cancelDialog()==true) return
        if(dictation.busy) {voiceSession.end();dictation.stop();return}
        if(disclosure?.isShowing==true) {confirmationGeneration++;disclosure?.dismiss();disclosure=null;return}
        if(section!=0) {navigateSettings(if(section in listOf(1,2,3,5)) 4 else 0);return}
        if(menuPanel.visibility==View.VISIBLE) {menuPanel.visibility=View.GONE;return}
        if (draft.text.isNotEmpty() || session.messages().isNotEmpty() || active != null || speech.busy || dictation.stoppable || agentCards.isNotEmpty())
            confirm("Leave private Chat?", "Leaving clears Chat and Agent data and stops local waiting. It does not erase provider records or refund usage.") { endLocalSession(); close() }
        else { endLocalSession(); close() }
    }
}
