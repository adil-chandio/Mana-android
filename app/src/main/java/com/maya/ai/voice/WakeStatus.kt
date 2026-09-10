package com.maya.ai.voice

/** Bounded, text-free diagnostics. Does not start services or override microphone ownership. */
class WakeStatus(private val now: () -> Long) {
    enum class State { STOPPED, REQUESTED, FOREGROUND, STARTING, READY, BLOCKED, RETRY, ERROR, UNKNOWN }
    enum class Reason { NONE, PERMISSION, START_REJECTED, FOREGROUND_REJECTED, UNAVAILABLE,
        SPEECH, APP_MIC, ECHO_TAIL, FISH_OUTPUT, RECOGNIZER_ERROR, DEADLINE, START_FAILED, STALE }
    data class Snapshot(val state: State, val reason: Reason, val error: Int,
                        val ageMs: Long, val starts: Long, val ready: Long)
    private var state = State.STOPPED
    private var reason = Reason.NONE
    private var error = 0
    private var changedAt = now()
    private var starts = 0L
    private var ready = 0L

    @Synchronized fun update(next: State, why: Reason = Reason.NONE, code: Int = 0): Boolean {
        val safeCode = if (code in 1..13) code else 0
        if (state == next && reason == why && error == safeCode) return false
        state = next; reason = why; error = safeCode; changedAt = now()
        if (next == State.STARTING) starts++
        if (next == State.READY) ready++
        return true
    }
    @Synchronized fun destroyed() {
        // Preserve the startup/permission failure through Android's onDestroy callback.
        if (state != State.ERROR) update(State.STOPPED)
    }
    @Synchronized fun snapshot(): Snapshot {
        val age = (now() - changedAt).coerceAtLeast(0)
        val stale = (state == State.READY && age >= 35000) ||
            (state == State.REQUESTED && age >= 8000) || (state == State.STARTING && age >= 35000)
        return Snapshot(if (stale) State.UNKNOWN else state, if (stale) Reason.STALE else reason,
            error, age, starts, ready)
    }
}
