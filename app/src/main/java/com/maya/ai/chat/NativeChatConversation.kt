package com.maya.ai.chat

/** Memory-only transaction owner. UI must call on one thread; no timers/network. */
class NativeChatConversation(private val monotonicMs: () -> Long) {
    class Turn internal constructor(internal val input: List<NativeChatProtocol.Message>, val body: String,
        internal val deadline: Long) {
        internal var dispatched = false
        override fun toString() = "NativeChatTurn(redacted)"
    }
    enum class Completion { ACCEPTED, STALE, EXPIRED }
    enum class StopOutcome { NO_ACTIVE_REQUEST, NOT_DISPATCHED, REMOTE_UNCERTAIN }
    private var history = emptyList<NativeChatProtocol.Message>()
    private var active: Turn? = null
    val busy: Boolean get() = active != null
    fun messages(): List<NativeChatProtocol.Message> = history.toList()

    fun begin(text: String, consent: Boolean): Turn {
        if (active != null) throw NativeChatProtocol.Rejected("BUSY")
        if (!consent) throw NativeChatProtocol.Rejected("CONSENT_REQUIRED")
        NativeChatProtocol.validateDraft(text)
        if (history.any { it.content.length > 2_000 }) throw NativeChatProtocol.Rejected("CONTEXT_LIMIT")
        val input = history + NativeChatProtocol.Message("user", text)
        val body = NativeChatProtocol.body(input)
        val now = monotonicMs()
        if (now < 0 || now > Long.MAX_VALUE - NativeChatProtocol.DEADLINE_MS)
            throw NativeChatProtocol.Rejected("INVALID_LOCAL_CLOCK")
        return Turn(input, body, now + NativeChatProtocol.DEADLINE_MS).also { active = it }
    }
    fun check(turn: Turn) {
        if (active !== turn) throw NativeChatProtocol.Rejected("STOPPED_LOCALLY")
        if (monotonicMs() >= turn.deadline) throw NativeChatProtocol.Rejected("DEADLINE_EXCEEDED")
    }
    /** Call immediately before transport dispatch, after signing and another check. */
    fun markDispatched(turn: Turn) {
        check(turn)
        if (turn.dispatched) throw NativeChatProtocol.Rejected("ALREADY_DISPATCHED")
        turn.dispatched = true
    }
    /** Call only after bounded, request-bound response validation in the transport. */
    fun complete(turn: Turn, finalText: String): Completion {
        if (active !== turn) return Completion.STALE
        if (monotonicMs() >= turn.deadline) { active = null; return Completion.EXPIRED }
        if (!NativeChatProtocol.validReply(finalText)) {
            active = null; throw NativeChatProtocol.Rejected("INVALID_SERVER_RESPONSE")
        }
        history = turn.input + NativeChatProtocol.Message("assistant", finalText)
        active = null
        return Completion.ACCEPTED
    }
    /** A failed/late request never commits history or clears a newer transaction. */
    fun fail(turn: Turn): StopOutcome = if (active !== turn) StopOutcome.NO_ACTIVE_REQUEST else stop()
    fun stop(): StopOutcome {
        val turn = active ?: return StopOutcome.NO_ACTIVE_REQUEST
        active = null
        return if (turn.dispatched) StopOutcome.REMOTE_UNCERTAIN else StopOutcome.NOT_DISPATCHED
    }
    fun clear(): StopOutcome { val outcome = stop(); history = emptyList(); return outcome }
}
