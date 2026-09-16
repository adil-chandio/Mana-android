package com.maya.ai.agent

/** UI-thread state machine. OPEN once, TYPE once; observations, not action acceptance, advance it. Never SEND. */
class WhatsAppTypeRun(private val port: Port,private val now: ()->Long,private val schedule: (Long,()->Unit)->(()->Unit),private val changed: ()->Unit) {
    interface Port {fun available(): Boolean;fun open(plan: WhatsAppTypePlan): Boolean;fun type(payload: String): Boolean}
    data class Observation(val packageName: String,val sensitive: Boolean,val typedEvent: Boolean,val eventTime: Long)
    enum class State { IDLE, OPENING, BETWEEN_STEPS, TYPING, COMPLETE, STOPPED, UNAVAILABLE, SCOPE_CHANGED, UNCERTAIN, EXPIRED }
    var state=State.IDLE;private set
    var verified=0;private set
    private var plan: WhatsAppTypePlan?=null
    private var epoch=0L
    private var began=0L
    private var actionAt=0L
    private var timer: (()->Unit)?=null
    private var next: (()->Unit)?=null
    val busy get()=plan!=null
    fun start(value: WhatsAppTypePlan,grant: WhatsAppTypeGrant): Boolean {
        if(busy) return false
        verified=0;val time=now()
        if(!grant.consume(value,time) || !runCatching {port.available()}.getOrDefault(false)) {state=State.UNAVAILABLE;changed();return false}
        plan=value;began=time;actionAt=time;epoch++;state=State.OPENING;val ticket=epoch;changed()
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
        if(value.sensitive) {end(State.SCOPE_CHANGED);return}
        if(value.packageName!=WhatsAppTypePlan.PACKAGE) {
            if(state==State.OPENING && value.packageName=="com.maya.ai") return
            end(State.SCOPE_CHANGED);return
        }
        if(state==State.OPENING && value.eventTime>=actionAt) advance()
        else if(state==State.TYPING && value.typedEvent && value.eventTime>=actionAt) advance()
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
            state=State.TYPING;actionAt=now();changed()
            if(ticket!=epoch || !current()) return@schedule
            armDeadline()
            if(!runCatching {port.type(p.payload)}.getOrDefault(false)) end(State.UNCERTAIN)
        }
    }
    fun userTouch() {if(busy) end(State.STOPPED)}
    fun stop() {if(busy) end(State.STOPPED)}
    private fun end(value: State) {epoch++;plan=null;timer?.invoke();timer=null;next?.invoke();next=null;state=value;changed()}
    fun report()="WhatsApp type · ${state.name}\nVerified steps: $verified\nOPEN once + TYPE once. Maya never presses SEND — review the chat and send it yourself. No chat text collected."
}
