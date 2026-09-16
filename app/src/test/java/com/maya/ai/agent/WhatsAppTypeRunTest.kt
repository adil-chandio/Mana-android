package com.maya.ai.agent

import org.junit.Assert.*
import org.junit.Test

class WhatsAppTypeRunTest {
    private fun plan()=WhatsAppTypePlan.parse("OPEN https://wa.me/923001234567\nTYPE Salam\nTYPE Kal milte hain")
    private class F: WhatsAppTypeRun.Port {
        var time=1000L;var available=true;var opens=0;val types=mutableListOf<String>()
        var onChange: ()->Unit={}
        data class Timer(val at: Long,val action: ()->Unit)
        val timers=mutableListOf<Timer>()
        val r=WhatsAppTypeRun(this,{time},{delay,task->val t=Timer(time+delay,task);timers.add(t);val cancel: ()->Unit={timers.remove(t);Unit};cancel},{onChange()})
        override fun available()=available
        override fun open(plan: WhatsAppTypePlan): Boolean {opens++;return true}
        override fun type(payload: String): Boolean {types.add(payload);return true}
        fun tick(ms: Long) {val end=time+ms;while(true){val t=timers.filter {it.at<=end}.minByOrNull {it.at} ?: break;timers.remove(t);time=t.at;t.action()};time=end}
        fun obs(pkg: String="com.whatsapp",secret: Boolean=false,typed: Boolean=false,event: Long=time)=WhatsAppTypeRun.Observation(pkg,secret,typed,event)
    }
    @Test fun noWorkWithoutOneExactUnexpiredGrant() {
        val f=F();val p=plan();val g=WhatsAppTypeGrant.approved(p,f.time);assertEquals(0,f.opens)
        val changed=WhatsAppTypePlan.parse("OPEN https://wa.me/923009999999\nTYPE Salam\nTYPE Kal milte hain")
        assertFalse(f.r.start(changed,g));assertEquals(0,f.opens);assertFalse(f.r.start(p,g))
    }
    @Test fun openAcceptanceDoesNotTypeBeforeObservation() {
        val f=F();val p=plan();assertTrue(f.r.start(p,WhatsAppTypeGrant.approved(p,f.time)))
        assertEquals(1,f.opens);assertEquals(0,f.r.verified);assertTrue(f.types.isEmpty())
        f.r.observe(f.obs(pkg="com.maya.ai"));assertEquals(0,f.r.verified)
        f.r.observe(f.obs());assertEquals(1,f.r.verified);assertTrue(f.types.isEmpty())
    }
    @Test fun typeIsIssuedOnceAndRequiresObservedCompletion() {
        val f=F();val p=plan();f.r.start(p,WhatsAppTypeGrant.approved(p,f.time));f.r.observe(f.obs());f.tick(600)
        assertEquals(listOf("Salam\nKal milte hain"),f.types);assertEquals(1,f.r.verified)
        f.r.observe(f.obs());assertEquals(1,f.r.verified)
        f.r.observe(f.obs(typed=true));assertEquals(WhatsAppTypeRun.State.COMPLETE,f.r.state);assertEquals(2,f.r.verified);assertTrue(f.timers.isEmpty())
    }
    @Test fun touchAndStopInvalidateQueuedEffects() {
        for(touch in listOf(true,false)) {
            val f=F();val p=plan();f.r.start(p,WhatsAppTypeGrant.approved(p,f.time));f.r.observe(f.obs())
            val late=f.timers.single().action
            if(touch) f.r.userTouch() else f.r.stop()
            late();assertTrue(f.types.isEmpty());assertFalse(f.r.busy)
        }
    }
    @Test fun unrelatedAppOrPasswordStopsWithoutFurtherEffects() {
        for(value in listOf(F().obs(pkg="com.bank.example"),F().obs(secret=true))) {
            val f=F();val p=plan();f.r.start(p,WhatsAppTypeGrant.approved(p,f.time));f.r.observe(f.obs());f.r.observe(value);f.tick(700)
            assertFalse(f.r.busy);assertTrue(f.types.isEmpty())
        }
    }
    @Test fun oldEventsCannotVerifyNewEffectsAndTimeoutDoesNotRetry() {
        val f=F();val p=plan();f.r.start(p,WhatsAppTypeGrant.approved(p,f.time));f.r.observe(f.obs(event=999));assertEquals(0,f.r.verified)
        f.tick(10000);assertEquals(WhatsAppTypeRun.State.UNCERTAIN,f.r.state);assertEquals(1,f.opens);assertTrue(f.types.isEmpty())
    }
    @Test fun reentrantStopBeforeOpenPreventsTheEffect() {
        val f=F();val p=plan();f.onChange={if(f.r.state==WhatsAppTypeRun.State.OPENING) f.r.stop()}
        assertFalse(f.r.start(p,WhatsAppTypeGrant.approved(p,f.time)));assertEquals(0,f.opens);assertTrue(f.timers.isEmpty())
    }
    @Test fun missingAvailabilityAndExpiredApprovalDoNotLaunch() {
        val f=F();val p=plan();val g=WhatsAppTypeGrant.approved(p,f.time);f.time+=60000
        assertFalse(f.r.start(p,g));f.available=false;assertFalse(f.r.start(p,WhatsAppTypeGrant.approved(p,f.time)));assertEquals(0,f.opens)
    }
    @Test fun parserRejectsArbitraryControlAndUnapprovedDestinations() {
        for(src in listOf("OPEN https://bank.example/\nTYPE hi","OPEN http://wa.me/923001234567\nTYPE hi",
            "OPEN https://wa.me/923001234567?text=hi\nTYPE hi","OPEN https://wa.me/0300abc\nTYPE hi","OPEN https://wa.me/123\nTYPE hi",
            "OPEN https://wa.me/923001234567","OPEN https://wa.me/923001234567\nTAP Send","OPEN https://wa.me/923001234567\nSEND",
            "OPEN https://wa.me/923001234567\nTYPE ","OPEN https://wa.me/923001234567\nTYPE a\nTYPE b\nTYPE c\nTYPE d\nTYPE e\nTYPE f")) {
            try {WhatsAppTypePlan.parse(src);fail(src)} catch(_: IllegalArgumentException) {}
        }
        val p=plan();assertEquals(2,p.steps);assertFalse(p.toString().contains("92300"))
        assertEquals("Salam\nKal milte hain",p.payload)
    }
}
