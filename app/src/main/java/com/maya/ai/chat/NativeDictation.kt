package com.maya.ai.chat

/** One explicit foreground input owner. Recognition output is data for review, never Send/approval.
 * Ports deliver callbacks on the UI thread; late/duplicate callbacks are fenced independently. */
class NativeDictation(private val port: Port,private val now: () -> Long,
    private val schedule: (Long,()->Unit)->(()->Unit),private val changed: ()->Unit) {
    enum class State(val hint: String) {
        IDLE("Voice input is off."), CHECKING("Checking local voice readiness…"),
        STARTING("Starting the selected recognition service…"), LISTENING("Listening · STOP cancels. No message is sent."),
        REVIEW("Review the transcript. Use transcript only copies to the composer; Send is separate."),
        MAIN_REQUIRED("Voice input is available in the main Maya workspace, not a compatibility launcher."),
        CONSENT_REQUIRED("Voice-input consent is required."), PERMISSION_REQUIRED("Microphone permission is missing. Allow it explicitly, then tap Mic again."),
        BLOCKED("Original assistant/voice is busy or not ready. No microphone started; no settings changed."),
        UNAVAILABLE("Could not verify the selected recognition service. Choose voice options or type instead. No fallback or download started."),
        ON_DEVICE_UNAVAILABLE("Android on-device recognition is unavailable here. Choose voice options to explicitly select the installed system service, or type instead. No automatic switch or download."),
        SYSTEM_UNAVAILABLE("No installed system recognition service was found. You can type instead. Maya has not installed, enabled or switched any service."),
        LANGUAGE_UNSUPPORTED("The selected service reports this language is not supported. Choose voice options and select another language you speak. Nothing was inserted."),
        LANGUAGE_UNAVAILABLE("The selected service reports this language is currently unavailable; its model may be missing. Choose another language or explicitly select the system service. No model download started."),
        NETWORK_ERROR("The selected service reported a network problem. Choose voice options to retry explicitly, or type instead. No automatic retry."),
        TIMEOUT("Voice-input deadline reached. No retry; partial transcript discarded."),
        NO_MATCH("No usable final transcript. Choose voice options to try again explicitly."),
        INVALID("Transcript exceeds 2,000 characters or is invalid. Nothing truncated or inserted."),
        ERROR("Recognition failed. Audio may have reached the selected system service; no automatic retry."),
        STOPPED("Voice input stopped locally. Transcript discarded; no message sent.")
    }
    interface Events {fun ready();fun partial(text: String);fun result(text: String);fun error(state: State)}
    interface Port {
        fun check(language: String,onDeviceOnly: Boolean,done: (State?)->Unit)
        fun start(language: String,onDeviceOnly: Boolean,events: Events)
        fun stop()
        fun requestPermission()
    }
    var state=State.IDLE;private set
    var transcript="";private set
    var selectionLabel="";private set
    val recoverable get()=state !in listOf(State.IDLE,State.CHECKING,State.STARTING,State.LISTENING,State.REVIEW,State.MAIN_REQUIRED)
    private var epoch=0L
    private var started=0L
    private var timer: (()->Unit)?=null
    val busy get()=state in listOf(State.CHECKING,State.STARTING,State.LISTENING)
    val stoppable get()=busy || state==State.REVIEW
    private fun publish(next: State) {state=next;changed()}
    private fun cleanup() {val t=timer;timer=null;try {t?.invoke()} catch(_: Exception) {};try {port.stop()} catch(_: Exception) {}}
    private fun finish(next: State) {epoch++;cleanup();if(next!=State.REVIEW) transcript="";publish(next)}
    fun start(language: String,onDeviceOnly: Boolean,consent: Boolean) {
        if(stoppable) return
        if(!consent) {finish(State.CONSENT_REQUIRED);return}
        if(language !in LANGUAGES) {finish(State.UNAVAILABLE);return}
        selectionLabel="$language · ${if(onDeviceOnly) "On-device only" else "System service (may use internet)"}"
        transcript="";val ticket=++epoch;started=now();publish(State.CHECKING)
        if(epoch!=ticket) return
        if(started<0 || started>Long.MAX_VALUE-22000) {finish(State.TIMEOUT);return}
        fun current(limit: Long): Boolean {
            if(ticket!=epoch) return false
            val elapsed=now()-started
            if(elapsed !in 0 until limit) {finish(State.TIMEOUT);return false}
            return true
        }
        try {
            timer=schedule(1500) {if(ticket==epoch) finish(State.TIMEOUT)}
            port.check(language,onDeviceOnly) {failure ->
                if(state!=State.CHECKING || !current(1500)) return@check
                if(failure!=null) {finish(if(failure in CHECK_FAILURES) failure else State.BLOCKED);return@check}
                val waitTimer=timer;timer=null;try {waitTimer?.invoke()} catch(_: Exception) {}
                started=now();publish(State.STARTING)
                if(epoch!=ticket) return@check
                try {
                    timer=schedule(20000) {if(ticket==epoch) finish(State.TIMEOUT)}
                    port.start(language,onDeviceOnly,object : Events {
                    override fun ready() {if(current(20000) && state==State.STARTING) publish(State.LISTENING)}
                    override fun partial(text: String) {
                        if(!current(20000)) return
                        if(text.isEmpty()) return
                        try {NativeChatProtocol.validateDraft(text)} catch(_: Exception) {finish(State.INVALID);return}
                        transcript=text;publish(State.LISTENING)
                    }
                    override fun result(text: String) {
                        if(!current(20000)) return
                        if(text.isBlank()) {finish(State.NO_MATCH);return}
                        try {NativeChatProtocol.validateDraft(text)} catch(_: Exception) {finish(State.INVALID);return}
                        transcript=text;finish(State.REVIEW)
                    }
                    override fun error(state: State) {
                        if(current(20000)) finish(if(state in RECOGNITION_FAILURES) state else State.ERROR)
                    }
                })} catch(_: Exception) {if(ticket==epoch) finish(State.ERROR)}
            }
        } catch(_: Exception) {if(ticket==epoch) finish(State.ERROR)}
    }
    fun requestPermission() {if(state==State.PERMISSION_REQUIRED) {finish(State.STOPPED);try {port.requestPermission()} catch(_: Exception) {finish(State.ERROR)}}}
    fun stop() {if(stoppable) finish(State.STOPPED)}
    fun clear() {selectionLabel="";finish(State.IDLE)}
    override fun toString()="NativeDictation(redacted)"
    companion object {
        val LANGUAGES=listOf("ur-PK","hi-IN","en-IN","en-US")
        private val CHECK_FAILURES=setOf(State.PERMISSION_REQUIRED,State.MAIN_REQUIRED,State.UNAVAILABLE,State.ON_DEVICE_UNAVAILABLE,State.SYSTEM_UNAVAILABLE,State.LANGUAGE_UNSUPPORTED)
        private val RECOGNITION_FAILURES=CHECK_FAILURES+setOf(State.NO_MATCH,State.BLOCKED,State.LANGUAGE_UNAVAILABLE,State.NETWORK_ERROR)
    }
}
