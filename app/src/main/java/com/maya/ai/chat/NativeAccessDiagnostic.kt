package com.maya.ai.chat

/** Fixed local diagnostic metadata ONLY. Never an authorization flag or chat store. */
class NativeAccessDiagnostic(private val store: Store) {
    interface Store { fun read(): String?; fun write(value: String) }
    enum class State { NOT_RUN, RUNNING, PASS, FAILED, STOPPED, LEFT_SCREEN, TIMEOUT, INTERRUPTED }
    enum class Stage { NONE, SIGNING, FIRST_REQUEST, REPLAY_REQUEST, FINISHED }
    data class Snapshot(val attempt: Int = 0, val state: State = State.NOT_RUN, val stage: Stage = Stage.NONE,
        val code: String = "NONE", val http: Int = 0, val elapsedMs: Long = 0)
    class Ticket internal constructor()
    companion object {
        private val codes = setOf("NONE", "REPLAY_DENIED", "KEY_REQUIRED", "KEYSTORE_UNAVAILABLE", "INVALID_LOCAL_KEY",
            "SIGNING_FAILED", "INVALID_SIGNATURE_ENCODING", "SIGNATURE_REQUIRED", "BAD_SIGNATURE", "INVALID_APK_CONFIGURATION",
            "SETUP_REQUIRED", "INVALID_OWNER_CONFIGURATION", "REQUEST_EXPIRED_OR_CLOCK_SKEW", "REPLAY_OR_WINDOW_FULL",
            "REPLAY_STORE_UNAVAILABLE", "ORIGIN_OR_TARGET_DENIED", "INVALID_SERVER_RESPONSE", "NETWORK_UNCERTAIN",
            "REPLAY_CHECK_FAILED", "BUSY", "STOPPED_LOCALLY", "DEADLINE_EXCEEDED", "SERVICE_UNAVAILABLE", "SAFE_FAILURE")
        fun safeCode(value: String) = value.takeIf { it in codes } ?: "SAFE_FAILURE"
        private fun decode(value: String?): Snapshot {
            if (value == null || value.length > 160) return Snapshot()
            return try {
                val p = value.split('|'); require(p.size == 7 && p[0] == "1")
                val attempt = p[1].toInt(); val state = State.valueOf(p[2]); val stage = Stage.valueOf(p[3])
                val http = p[5].toInt(); val ms = p[6].toLong()
                require(attempt in 0..999999 && p[4] in codes && (http == 0 || http in 100..599) && ms in 0..60000)
                require(state != State.PASS || (attempt > 0 && stage == Stage.FINISHED && p[4] == "REPLAY_DENIED" && http == 409))
                Snapshot(attempt, if (state == State.RUNNING) State.INTERRUPTED else state, stage, p[4], http, ms)
            } catch (_: Exception) { Snapshot() }
        }
    }
    @get:Synchronized var storageAvailable = true
        private set
    private var current = decode(try { store.read() } catch (_: Exception) { storageAvailable = false; null })
    private var active: Ticket? = null
    @Synchronized fun snapshot() = current.copy()
    private fun persist() {
        val s = current
        try { store.write("1|${s.attempt}|${s.state.name}|${s.stage.name}|${s.code}|${s.http}|${s.elapsedMs}") }
        catch (_: Exception) { storageAvailable = false }
    }
    @Synchronized fun begin(): Ticket {
        current = Snapshot(if (current.attempt == 999999) 1 else current.attempt + 1, State.RUNNING, Stage.SIGNING)
        return Ticket().also { active = it; persist() }
    }
    @Synchronized fun stage(ticket: Ticket, stage: Stage) {
        if (active !== ticket || stage !in listOf(Stage.FIRST_REQUEST, Stage.REPLAY_REQUEST)) return
        if (stage.ordinal < current.stage.ordinal) return
        current = current.copy(stage = stage); persist()
    }
    @Synchronized fun finish(ticket: Ticket, state: State, code: String = "NONE", http: Int = 0, elapsedMs: Long = 0) {
        if (active !== ticket || state in listOf(State.NOT_RUN, State.RUNNING)) return
        active = null
        val pass = state == State.PASS && current.stage == Stage.REPLAY_REQUEST && http == 409
        current = current.copy(state = if (state == State.PASS && !pass) State.FAILED else state,
            stage = if (pass) Stage.FINISHED else current.stage,
            code = if (pass) "REPLAY_DENIED" else if (state == State.PASS) "REPLAY_CHECK_FAILED" else safeCode(code),
            http = http.takeIf { it in 100..599 } ?: 0,
            elapsedMs = elapsedMs.coerceIn(0, 60000))
        persist()
    }
    @Synchronized fun clear() { active = null; current = Snapshot(); persist() }
    @Synchronized fun report(): String {
        val s = current
        val result = if (s.state == State.PASS) "PASS — signed empty check accepted; exact replay denied." else "State: ${s.state.name}"
        return "Last APK access check · attempt ${s.attempt}\n$result\nStage: ${s.stage.name}\nCode: ${s.code} · HTTP: ${s.http}\nLocal duration (capped 60s): ${s.elapsedMs} ms\nHistorical diagnostic only; not a login or proof Chat is ON." +
            if (storageAvailable) "" else "\nDiagnostic storage unavailable; this result is memory-only."
    }
}
