package com.maya.ai.agent

import java.security.MessageDigest

/** Local pilot only. All calls/callbacks use one UI thread; scheduling must be deferred.
 * No network, Accessibility, intents, external targets or legacy action queue. */
class ApprovedPlanRunner(private val port: LabPort, private val now: () -> Long,
    private val schedule: (Long, () -> Unit) -> (() -> Unit), private val changed: () -> Unit) {
    interface LabPort { fun available(): Boolean; fun read(): String; fun write(value: String) }
    enum class Kind { SET, EXPECT, CLEAR }
    enum class State { IDLE, APPROVED, RUNNING, COMPLETED, STOPPED, PLAN_CHANGED, TARGET_CHANGED, EXPIRED, FAILED, SCOPE_BLOCKED, UNAVAILABLE }
    class Step(val kind: Kind, val value: String) { override fun toString() = "AgentStep(redacted)" }
    class Plan private constructor(private val steps: List<Step>, internal val digest: String) {
        val size get() = steps.size
        internal fun step(index: Int) = steps[index]
        override fun toString() = "AgentPlan(local-lab, $size steps, redacted)"
        companion object {
            const val TARGET = "MAYA_LOCAL_LAB"
            fun parse(source: String, target: String = TARGET): Plan {
                require(target == TARGET) { "EXTERNAL_TARGET_LOCKED" }
                require(source.length in 1..1800) { "PLAN_SIZE" }
                val lines = source.replace("\r\n", "\n").split('\n')
                require(lines.size in 1..6 && lines.none { it.isBlank() }) { "ONE_TO_SIX_STEPS" }
                val steps = lines.map { line ->
                    when {
                        line == "CLEAR" -> Step(Kind.CLEAR, "")
                        line.startsWith("SET ") || line.startsWith("EXPECT ") -> {
                            val kind = if (line.startsWith("SET ")) Kind.SET else Kind.EXPECT
                            val text = line.substringAfter(' ')
                            require(text.length in 1..200 && text.none { it.isISOControl() || Character.isSurrogate(it) }) { "INVALID_LAB_TEXT" }
                            Step(kind, text)
                        }
                        else -> throw IllegalArgumentException("UNSUPPORTED_STEP")
                    }
                }
                val canonical = TARGET + "\n" + lines.joinToString("\n")
                val digest = MessageDigest.getInstance("SHA-256").digest(canonical.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it.toInt() and 255) }
                return Plan(steps.toList(), digest)
            }
        }
    }
    private class Approval(val plan: Plan, val base: String, val created: Long, val expires: Long)
    private class Run(val plan: Plan, var expected: String, val deadline: Long, var index: Int = 0, var observed: Long)
    private var approval: Approval? = null
    private var run: Run? = null
    private var cancel: (() -> Unit)? = null
    private val evidence = mutableListOf<String>()
    var state = State.IDLE; private set
    val busy get() = run != null
    val approved get() = approval != null
    fun approve(plan: Plan): Boolean {
        if (busy) return false
        approval = null; evidence.clear()
        return try {
            val time = now(); require(time >= 0 && time <= Long.MAX_VALUE - 60000)
            if (!port.available()) { publish(State.SCOPE_BLOCKED); false }
            else {
                val base = port.read(); require(base.length <= 400)
                approval = Approval(plan, base, time, time + 60000); publish(State.APPROVED); approval?.plan === plan && state == State.APPROVED
            }
        } catch (_: Exception) { publish(State.UNAVAILABLE); false }
    }
    fun start(current: Plan): Boolean {
        if (busy) return false
        val grant = approval ?: return false
        approval = null // one-use approval, also consumed by a refused start
        if (grant.plan.digest != current.digest) { publish(State.PLAN_CHANGED); return false }
        return try {
            val time = now()
            if (time < grant.created || time >= grant.expires || time > Long.MAX_VALUE - 30000) { publish(State.EXPIRED); false }
            else if (!port.available()) { publish(State.SCOPE_BLOCKED); false }
            else if (port.read() != grant.base) { publish(State.TARGET_CHANGED); false }
            else {
                val ticket = Run(grant.plan, grant.base, time + 30000, observed = time); run = ticket
                publish(State.RUNNING); if (run === ticket) queue(ticket); true
            }
        } catch (_: Exception) { end(State.UNAVAILABLE); false }
    }
    private fun queue(ticket: Run) {
        var queued = false
        val pending = schedule(750) {
            check(queued) { "DEFERRED_SCHEDULER_REQUIRED" }
            step(ticket)
        }
        queued = true
        if (run === ticket) cancel = pending else try { pending() } catch (_: Exception) {}
    }
    private fun step(ticket: Run) {
        if (run !== ticket) return
        cancel = null
        try {
            val time = now()
            if (time < ticket.observed || time >= ticket.deadline) { end(State.EXPIRED); return }
            ticket.observed = time
            if (!port.available()) { end(State.SCOPE_BLOCKED); return }
            if (port.read() != ticket.expected) { end(State.TARGET_CHANGED); return }
            if (run !== ticket) return
            val step = ticket.plan.step(ticket.index)
            when (step.kind) {
                Kind.SET, Kind.CLEAR -> {
                    val value = if (step.kind == Kind.CLEAR) "" else step.value
                    port.write(value)
                    if (run !== ticket) return
                    if (now() < ticket.observed || now() >= ticket.deadline) { end(State.EXPIRED); return }
                    if (!port.available() || port.read() != value) { end(State.FAILED); return }
                    ticket.expected = value
                }
                Kind.EXPECT -> if (port.read() != step.value) { end(State.FAILED); return }
            }
            if (run !== ticket) return
            val verifiedAt = now()
            if (verifiedAt < ticket.observed || verifiedAt >= ticket.deadline) { end(State.EXPIRED); return }
            ticket.observed = verifiedAt
            evidence.add("Step ${ticket.index + 1}: ${step.kind.name} · verified")
            ticket.index++
            if (ticket.index == ticket.plan.size) end(State.COMPLETED)
            else { notifyChange(); if (run === ticket) queue(ticket) }
        } catch (_: Exception) { end(State.UNAVAILABLE) }
    }
    private fun cancelPending() {
        val pending = cancel; cancel = null
        try { pending?.invoke() } catch (_: Exception) { /* Identity fence still cancels. */ }
    }
    private fun notifyChange() {
        try { changed() } catch (_: Exception) {
            run = null; approval = null; cancelPending(); state = State.UNAVAILABLE
        }
    }
    private fun publish(next: State) { state = next; notifyChange() }
    private fun end(next: State) {
        run = null; approval = null; cancelPending(); publish(next)
    }
    fun stop() { if (busy || approved) end(State.STOPPED) }
    fun invalidate() { if (busy || approved) end(State.PLAN_CHANGED) }
    fun clear() { run = null; approval = null; cancelPending(); evidence.clear(); publish(State.IDLE) }
    fun report() = (listOf("MAYA AGENT · LOCAL LAB ONLY", "State: ${state.name}", "Verified steps: ${evidence.size} (maximum 6)") + evidence +
        "Local-field actions only. No external app, AI or screen capture. No plan/draft contents in this report.").joinToString("\n")
}
