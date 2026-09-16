package com.maya.ai.agent

/** UI-thread state machine. Each effect is issued once; observations, not click acceptance, advance it. */
class BrowserNavigationRun(private val port: Port,private val now: ()->Long,private val schedule: (Long,()->Unit)->(()->Unit),private val changed: ()->Unit) {
    interface Port {fun available(): Boolean;fun open(plan: BrowserNavigationPlan): Boolean;fun scroll(down: Boolean): Boolean}
    data class Observation(val packageName: String,val address: String?,val sensitive: Boolean,val scrollEvent: Boolean,val eventTime: Long)
    enum class State { IDLE, OPENING, WAITING_SCROLL, BETWEEN_STEPS, COMPLETE, STOPPED, UNAVAILABLE, SCOPE_CHANGED, UNCERTAIN, EXPIRED }
    var state=State.IDLE;private set
    var verified=0;private set
    private var plan: BrowserNavigationPlan?=null
    private var epoch=0L
    private var began=0L
    private var actionAt=0L
    private var timer: (()->Unit)?=null
    private var next: (()->Unit)?=null
    private var last: Observation?=null
    val busy get()=plan!=null
    fun start(value: BrowserNavigationPlan,grant: BrowserNavigationGrant): Boolean {
        if(busy) return false
        verified=0;val time=now()
        if(!grant.consume(value,time) || !runCatching {port.available()}.getOrDefault(false)) {state=State.UNAVAILABLE;changed();return false}
        plan=value;began=time;actionAt=time;epoch++;state=State.OPENING;last=null;val ticket=epoch;changed()
        if(ticket!=epoch || !current()) return false
        armDeadline()
        if(!runCatching {port.open(value)}.getOrDefault(false)) end(State.UNAVAILABLE)
        return busy || state==State.COMPLETE
    }
    private fun current(): Boolean {
        if(!busy) return false
        if(now()-began !in 0 until 60000) {end(State.EXPIRED);return false}
        if(!runCatching {port.available()}.getOrDefault(false)) {end(State.UNAVAILABLE);return false}
        return true
    }
    private fun armDeadline() {
        timer?.invoke();val ticket=epoch
        val remaining=(60000-(now()-began)).coerceAtLeast(1)
        timer=schedule(minOf(10000,remaining)) {if(ticket==epoch && busy) end(if(now()-began>=60000) State.EXPIRED else State.UNCERTAIN)}
    }
    fun observe(value: Observation) {
        if(!current()) return
        val p=plan ?: return
        if(value.sensitive) {end(State.SCOPE_CHANGED);return}
        if(value.packageName!=p.browser.packageName) {
            if(state==State.OPENING && value.packageName=="com.maya.ai") return
            end(State.SCOPE_CHANGED);return
        }
        if(!p.acceptsAddress(value.address)) {
            if(state==State.OPENING) return // Wait for the approved OPEN to load; issue no other effect.
            end(State.SCOPE_CHANGED);return
        }
        last=value
        if((state==State.OPENING && value.eventTime>=actionAt) || (state==State.WAITING_SCROLL && value.scrollEvent && value.eventTime>=actionAt)) advance()
    }
    private fun advance() {
        val p=plan ?: return
        timer?.invoke();timer=null;verified++
        if(verified>=p.steps) {end(State.COMPLETE);return}
        val ticket=epoch;state=State.BETWEEN_STEPS;changed()
        if(ticket!=epoch || !current()) return
        next=schedule(600) {
            next=null
            if(ticket!=epoch || !current()) return@schedule
            val observed=last
            if(observed==null || observed.sensitive || observed.packageName!=p.browser.packageName || !p.acceptsAddress(observed.address)) {end(State.SCOPE_CHANGED);return@schedule}
            state=State.WAITING_SCROLL;actionAt=now();changed()
            if(ticket!=epoch || !current()) return@schedule
            armDeadline()
            if(!runCatching {port.scroll(p.scrolls[verified-1])}.getOrDefault(false)) end(State.UNCERTAIN)
        }
    }
    fun userTouch() {if(busy) end(State.STOPPED)}
    fun stop() {if(busy) end(State.STOPPED)}
    private fun end(value: State) {epoch++;plan=null;timer?.invoke();timer=null;next?.invoke();next=null;last=null;state=value;changed()}
    fun report()="Browser navigation · ${state.name}\nVerified steps: $verified\nOPEN/SCROLL only. No page text, screenshot or credentials uploaded. This is not general phone control."
}
