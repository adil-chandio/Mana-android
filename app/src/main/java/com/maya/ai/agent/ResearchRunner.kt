package com.maya.ai.agent

/** Single UI-thread owner. Ports/scheduler must deliver callbacks asynchronously on that same thread. */
class ResearchRunner(private val port: Port, private val now: () -> Long,
    private val schedule: (Long, () -> Unit) -> (() -> Unit), private val changed: () -> Unit) {
    interface Port { fun fetch(item: ResearchPlan.Item, done: (ResearchSource?) -> Unit): () -> Unit }
    enum class State { IDLE, APPROVED, RUNNING, COMPLETE, STOPPED, EXPIRED, CHANGED, FAILED }
    private class Approval(val plan: ResearchPlan, val browser: ResearchBrowser, val time: Long)
    private class Run(val approval: Approval, val time: Long, var index: Int = 0, var epoch: Long = 0, var observed: Long = time)
    private var approval: Approval? = null
    private var run: Run? = null
    private var pending: (() -> Unit)? = null
    private var deadline: (() -> Unit)? = null
    private val sources = mutableListOf<ResearchSource>()
    var state = State.IDLE; private set
    val busy get() = run != null
    val approved get() = approval != null
    fun results(): List<ResearchSource> = sources.toList()
    fun approve(plan: ResearchPlan, browser: ResearchBrowser): Boolean {
        if (busy) return false
        val time = now(); if (time < 0 || time > Long.MAX_VALUE - 60000) return false
        sources.clear(); approval = Approval(plan,browser,time); state=State.APPROVED; notifyChange(); return approval != null
    }
    fun start(plan: ResearchPlan, browser: ResearchBrowser): Boolean {
        if (busy) return false
        val a=approval ?: return false; approval=null
        if (plan.source != a.plan.source || browser != a.browser) { state=State.CHANGED; notifyChange(); return false }
        val time=now()
        if (time < a.time || time-a.time >= 60000 || time > Long.MAX_VALUE-45000) { state=State.EXPIRED; notifyChange(); return false }
        val r=Run(a,time); run=r; state=State.RUNNING; notifyChange()
        if (run !== r) return false
        try {
            deadline=schedule(45000) { if (run === r) end(State.EXPIRED) }
            queue(r)
        } catch (_: Exception) { end(State.FAILED); return false }
        return true
    }
    private fun current(r: Run): Boolean {
        if (run !== r) return false
        val t=now(); if (t < r.observed || t-r.time >= 45000) { end(State.EXPIRED); return false }
        r.observed=t;return true
    }
    private fun queue(r: Run) {
        pending=schedule(600) {
            if (!current(r)) return@schedule
            pending=null
            val epoch=++r.epoch
            try {
                pending=port.fetch(r.approval.plan.item(r.index)) { source ->
                    if (!current(r) || epoch != r.epoch) return@fetch
                    r.epoch++; pending=null
                    val item=r.approval.plan.item(r.index)
                    if (source == null || source.url != item.pageUrl || source.text.length !in 1..1400 || source.text.isBlank()) { end(State.FAILED); return@fetch }
                    sources.add(source); r.index++
                    if (r.index == r.approval.plan.size) end(State.COMPLETE)
                    else { notifyChange(); if (current(r)) try { queue(r) } catch (_: Exception) { end(State.FAILED) } }
                }
            } catch (_: Exception) { end(State.FAILED) }
        }
    }
    private fun notifyChange() {
        try { changed() } catch (_: Exception) {
            run=null;approval=null
            val p=pending;val d=deadline;pending=null;deadline=null;cancel(p);cancel(d);state=State.FAILED
        }
    }
    private fun cancel(action: (() -> Unit)?) { try { action?.invoke() } catch (_: Exception) {} }
    private fun end(next: State) {
        run=null; approval=null
        val p=pending;val d=deadline;pending=null;deadline=null;cancel(p);cancel(d)
        state=next;notifyChange()
    }
    fun stop() { if (busy || approved) end(State.STOPPED) }
    fun invalidate() { end(State.CHANGED); sources.clear(); notifyChange() }
    fun clear() { end(State.IDLE); sources.clear(); notifyChange() }
    fun report() = "MAYA PUBLIC RESEARCH\nState: ${state.name}\nValidated sources: ${sources.size}/3 maximum\nRead-only fixed providers. No browser page verification, private screen capture or phone actions. No goal, plan or source contents in this report."
}
