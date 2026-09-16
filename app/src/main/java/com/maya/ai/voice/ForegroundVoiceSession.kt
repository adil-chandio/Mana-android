package com.maya.ai.voice

/** Temporary input permission, not a conversation, Send grant, output consent or background service.
 * The UI-thread owner supplies capture and release; neither network nor text enters this class. */
class ForegroundVoiceSession(
    private val now: () -> Long,
    private val schedule: (Long, () -> Unit) -> (() -> Unit),
    private val capture: (String, Boolean) -> Unit,
    private val release: () -> Unit,
    private val changed: () -> Unit
) {
    enum class Phase { OFF, INPUT, REVIEW, WAITING, OUTPUT, ECHO, READY }
    var phase = Phase.OFF; private set
    var language = ""; private set
    var onDeviceOnly = true; private set
    private var epoch = 0L
    private var revision = 0L
    private var started = 0L
    private var expiry: (() -> Unit)? = null
    private var pending: (() -> Unit)? = null
    val armed get() = phase != Phase.OFF
    private fun current(): Boolean {
        if (!armed) return false
        if (now() - started !in 0 until MAX_MS) { end(); return false }
        return true
    }
    fun begin(language: String, onDeviceOnly: Boolean) {
        end()
        if (language !in setOf("ur-PK", "hi-IN", "en-IN", "en-US")) return
        this.language = language; this.onDeviceOnly = onDeviceOnly
        started = now(); phase = Phase.READY
        val ticket = ++epoch
        expiry = schedule(MAX_MS) { if (ticket == epoch) end() }
        listen()
    }
    fun listen() {
        if (!current() || phase !in setOf(Phase.READY, Phase.WAITING)) return
        revision++; pending?.invoke(); pending = null
        phase = Phase.INPUT; changed()
        if (current() && phase == Phase.INPUT) capture(language, onDeviceOnly)
    }
    fun reviewed() { if (current() && phase == Phase.INPUT) { phase = Phase.REVIEW; changed() } }
    fun hold() {
        if (!current()) return
        revision++; pending?.invoke(); pending = null
        // Host never calls this to interrupt a live recorder or steal reviewed text.
        if (phase != Phase.INPUT && phase != Phase.REVIEW) { phase = Phase.WAITING; changed() }
    }
    fun usedTranscript() { if (current() && phase == Phase.REVIEW) { phase = Phase.READY; changed() } }
    fun outputStarted() {
        if (!current() || phase in setOf(Phase.INPUT, Phase.REVIEW)) return
        revision++; pending?.invoke(); pending = null; phase = Phase.OUTPUT; changed()
    }
    fun outputFinished(success: Boolean) {
        if (!current() || phase != Phase.OUTPUT) return
        if (!success) { end(); return }
        val ticket = epoch
        val version = ++revision
        phase = Phase.ECHO; changed()
        if (!current() || phase != Phase.ECHO) return
        pending = schedule(ECHO_MS) {
            if (ticket == epoch && version == revision && current() && phase == Phase.ECHO) {
                pending = null; phase = Phase.READY; listen()
            }
        }
    }
    fun end() {
        epoch++
        expiry?.invoke(); expiry = null; revision++; pending?.invoke(); pending = null
        val wasArmed = armed
        phase = Phase.OFF; language = ""; onDeviceOnly = true
        if (wasArmed) { release(); changed() }
    }
    override fun toString() = "ForegroundVoiceSession(input-only)"
    companion object { const val MAX_MS = 300000L; const val ECHO_MS = 600L; const val SILENCE_MS = 15000L }
}
