package com.maya.ai.chat

/** One foreground, explicit speech owner. No key/HTTP access in this state machine. */
class NativeReplySpeech(
    private val port: Port,
    private val schedule: (Long, () -> Unit) -> (() -> Unit),
    private val changed: (NativeFishPolicy.Code) -> Unit
) {
    interface Port {
        fun prepare(text: String?, result: (NativeFishPolicy.Result) -> Unit)
        fun play(prepared: NativeFishPolicy.Result.Prepared, event: (String, Int) -> Unit): Boolean
        fun stopOwned()
    }
    private class Ticket { var preparing = true }
    private var active: Ticket? = null
    private var cancelTimer: (() -> Unit)? = null
    val busy: Boolean get() = active != null
    var state = NativeFishPolicy.Code.IDLE
        private set
    private fun publish(code: NativeFishPolicy.Code) { state = code; changed(code) }
    fun check(): Boolean = begin(null)
    fun speak(text: String, consent: Boolean): Boolean {
        if (busy) return false
        if (!consent) { publish(NativeFishPolicy.Code.CONSENT_REQUIRED); return false }
        if (!NativeFishPolicy.validText(text)) { publish(NativeFishPolicy.Code.TOO_LONG); return false }
        return begin(text)
    }
    private fun begin(text: String?): Boolean {
        if (busy) return false
        val ticket = Ticket(); active = ticket; publish(NativeFishPolicy.Code.PREPARING)
        if (active !== ticket) return false
        cancelTimer = schedule(1500) { finish(ticket, NativeFishPolicy.Code.TIMEOUT) }
        try { port.prepare(text) { result ->
            if (active !== ticket || !ticket.preparing) return@prepare
            ticket.preparing = false; cancelTimer?.invoke(); cancelTimer = null
            when {
                result is NativeFishPolicy.Result.Error -> finish(ticket, result.code)
                text == null && result === NativeFishPolicy.Result.Ready -> finish(ticket, NativeFishPolicy.Code.READY)
                text != null && result is NativeFishPolicy.Result.Prepared -> {
                    // Independent ceiling even if the decoder/player never reports a terminal event.
                    cancelTimer = schedule(210000) { finish(ticket, NativeFishPolicy.Code.TIMEOUT) }
                    publish(NativeFishPolicy.Code.STARTING)
                    if (active !== ticket) return@prepare
                    try {
                        if (!port.play(result) { event, status ->
                            if (active !== ticket) return@play
                            val code = NativeFishPolicy.audioCode(event, status)
                            if (code == NativeFishPolicy.Code.PLAYING) publish(code) else finish(ticket, code)
                        }) finish(ticket, NativeFishPolicy.Code.ASSISTANT_BUSY)
                    } catch (_: Exception) { finish(ticket, NativeFishPolicy.Code.UNAVAILABLE) }
                }
                else -> finish(ticket, NativeFishPolicy.Code.UNAVAILABLE)
            }
        } } catch (_: Exception) { finish(ticket, NativeFishPolicy.Code.UNAVAILABLE) }
        return true
    }
    private fun finish(ticket: Ticket, code: NativeFishPolicy.Code) {
        if (active !== ticket) return
        active = null; cancelTimer?.invoke(); cancelTimer = null
        try { port.stopOwned() } catch (_: Exception) {}
        publish(code)
    }
    fun stop() { active?.let { finish(it, NativeFishPolicy.Code.STOPPED) } }
}
