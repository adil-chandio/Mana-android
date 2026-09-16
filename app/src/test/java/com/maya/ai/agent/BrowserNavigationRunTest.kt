package com.maya.ai.agent

import org.junit.Assert.*
import org.junit.Test

class BrowserNavigationRunTest {
    private fun plan()=BrowserNavigationPlan.parse(ResearchBrowser.CHROME,"OPEN https://en.wikipedia.org/wiki/Android\nSCROLL DOWN\nSCROLL UP")
    private class F: BrowserNavigationRun.Port {
        var time=1000L;var available=true;var opens=0;val scrolls=mutableListOf<Boolean>()
        var onChange: ()->Unit={}
        data class Timer(val at: Long,val action: ()->Unit)
        val timers=mutableListOf<Timer>()
        val r=BrowserNavigationRun(this,{time},{delay,task->val t=Timer(time+delay,task);timers.add(t);val cancel: ()->Unit={timers.remove(t);Unit};cancel},{onChange()})
        override fun available()=available
        override fun open(plan: BrowserNavigationPlan): Boolean {opens++;return true}
        override fun scroll(down: Boolean): Boolean {scrolls.add(down);return true}
        fun tick(ms: Long) {val end=time+ms;while(true){val t=timers.filter {it.at<=end}.minByOrNull {it.at} ?: break;timers.remove(t);time=t.at;t.action()};time=end}
        fun obs(pkg: String="com.android.chrome",address: String?="en.wikipedia.org/wiki/Android",secret: Boolean=false,scrolled: Boolean=false,event: Long=time)=BrowserNavigationRun.Observation(pkg,address,secret,scrolled,event)
    }
    @Test fun noWorkWithoutOneExactUnexpiredGrant() {
        val f=F();val p=plan();val g=BrowserNavigationGrant.approved(p,f.time);assertEquals(0,f.opens)
        val changed=BrowserNavigationPlan.parse(ResearchBrowser.BRAVE,p.source)
        assertFalse(f.r.start(changed,g));assertEquals(0,f.opens);assertFalse(f.r.start(p,g))
    }
    @Test fun openAcceptanceDoesNotPretendThePageIsVerified() {
        val f=F();val p=plan();assertTrue(f.r.start(p,BrowserNavigationGrant.approved(p,f.time)))
        assertEquals(1,f.opens);assertEquals(0,f.r.verified);assertTrue(f.scrolls.isEmpty())
        f.r.observe(f.obs(address=null));assertEquals(0,f.r.verified)
        f.r.observe(f.obs());assertEquals(1,f.r.verified);assertTrue(f.scrolls.isEmpty())
    }
    @Test fun eachScrollIsIssuedOnceAndRequiresObservedCompletion() {
        val f=F();val p=plan();f.r.start(p,BrowserNavigationGrant.approved(p,f.time));f.r.observe(f.obs());f.tick(600)
        assertEquals(listOf(true),f.scrolls);assertEquals(1,f.r.verified)
        f.r.observe(f.obs());assertEquals(1,f.r.verified)
        f.r.observe(f.obs(scrolled=true));f.tick(600);assertEquals(listOf(true,false),f.scrolls)
        f.r.observe(f.obs(scrolled=true));assertEquals(BrowserNavigationRun.State.COMPLETE,f.r.state);assertEquals(3,f.r.verified);assertTrue(f.timers.isEmpty())
    }
    @Test fun touchAndStopInvalidateQueuedEffects() {
        for(touch in listOf(true,false)) {
            val f=F();val p=plan();f.r.start(p,BrowserNavigationGrant.approved(p,f.time));f.r.observe(f.obs())
            val late=f.timers.single().action
            if(touch) f.r.userTouch() else f.r.stop()
            late();assertTrue(f.scrolls.isEmpty());assertFalse(f.r.busy)
        }
    }
    @Test fun unrelatedAppOriginOrPasswordStopsWithoutFurtherEffects() {
        for(value in listOf(F().obs(pkg="com.bank.example"),F().obs(address="bank.example"),F().obs(secret=true))) {
            val f=F();val p=plan();f.r.start(p,BrowserNavigationGrant.approved(p,f.time));f.r.observe(f.obs());f.r.observe(value);f.tick(700)
            assertFalse(f.r.busy);assertTrue(f.scrolls.isEmpty())
        }
    }
    @Test fun oldEventsCannotVerifyNewEffectsAndTimeoutDoesNotRetry() {
        val f=F();val p=plan();f.r.start(p,BrowserNavigationGrant.approved(p,f.time));f.r.observe(f.obs(event=999));assertEquals(0,f.r.verified)
        f.tick(10000);assertEquals(BrowserNavigationRun.State.UNCERTAIN,f.r.state);assertEquals(1,f.opens);assertTrue(f.scrolls.isEmpty())
    }
    @Test fun reentrantStopBeforeOpenPreventsTheEffect() {
        val f=F();val p=plan();f.onChange={if(f.r.state==BrowserNavigationRun.State.OPENING) f.r.stop()}
        assertFalse(f.r.start(p,BrowserNavigationGrant.approved(p,f.time)));assertEquals(0,f.opens);assertTrue(f.timers.isEmpty())
    }
    @Test fun missingAvailabilityAndExpiredApprovalDoNotLaunch() {
        val f=F();val p=plan();val g=BrowserNavigationGrant.approved(p,f.time);f.time+=60000
        assertFalse(f.r.start(p,g));f.available=false;assertFalse(f.r.start(p,BrowserNavigationGrant.approved(p,f.time)));assertEquals(0,f.opens)
    }
    @Test fun parserRejectsArbitraryControlAndUnapprovedDestinations() {
        for(src in listOf("OPEN https://bank.example/\nSCROLL DOWN","OPEN http://en.wikipedia.org/wiki/Android","OPEN https://en.wikipedia.org/wiki/Special:UserLogin","OPEN https://en.wikipedia.org/wiki/Android?x=secret","OPEN https://developer.android.com/settings/billing","OPEN https://en.wikipedia.org/wiki/Android\nTAP Send","OPEN https://en.wikipedia.org/wiki/Android\nTYPE otp|1234")) {
            try {BrowserNavigationPlan.parse(ResearchBrowser.CHROME,src);fail(src)} catch(_: IllegalArgumentException) {}
        }
        val p=plan();assertFalse(p.toString().contains("Android"));assertFalse(p.acceptsAddress("https://en.wikipedia.org.evil.invalid/"))
    }
}
