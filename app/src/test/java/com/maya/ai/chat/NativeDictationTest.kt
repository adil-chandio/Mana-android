package com.maya.ai.chat

import org.junit.Assert.*
import org.junit.Test

class NativeDictationTest {
    private class F: NativeDictation.Port {
        var time=0L;var checks=0;var starts=0;var stops=0;var permissions=0
        var ready: ((NativeDictation.State?)->Unit)?=null
        val events=mutableListOf<NativeDictation.Events>()
        var language="";var offline=false
        val timers=mutableListOf<Pair<Long,()->Unit>>()
        val d=NativeDictation(this,{time},{delay,action->
            val task=(time+delay) to action;timers.add(task)
            val cancel: ()->Unit={timers.remove(task);Unit};cancel
        },{})
        override fun check(language: String,onDeviceOnly: Boolean,done: (NativeDictation.State?)->Unit) {checks++;ready=done}
        override fun start(language: String,onDeviceOnly: Boolean,events: NativeDictation.Events) {starts++;this.language=language;offline=onDeviceOnly;this.events.add(events)}
        override fun stop() {stops++}
        override fun requestPermission() {permissions++}
        fun begin() {d.start("ur-PK",true,true);ready!!(null)}
        fun tick() {val t=timers.minByOrNull {it.first}!!;timers.remove(t);time=t.first;t.second()}
    }
    @Test fun startupAndNoConsentNeverStartRecognitionOrPermission() {
        val f=F();assertEquals(0,f.checks);assertEquals(0,f.starts)
        f.d.start("ur-PK",true,false);assertEquals(NativeDictation.State.CONSENT_REQUIRED,f.d.state)
        assertEquals(0,f.starts);assertEquals(0,f.checks);assertEquals(0,f.permissions)
    }
    @Test fun readinessPrecedesServiceAndNoProviderFallback() {
        val f=F();f.d.start("hi-IN",true,true);assertEquals(0,f.starts)
        f.ready!!(null);assertEquals(1,f.starts);assertEquals("hi-IN",f.language);assertTrue(f.offline)
        f.events[0].error(NativeDictation.State.UNAVAILABLE);assertEquals(NativeDictation.State.UNAVAILABLE,f.d.state)
        assertEquals(1,f.starts);assertFalse(f.d.busy)
    }
    @Test fun partialIsNotFinalAndFinalRequiresSeparateOwnerUse() {
        val f=F();f.begin();f.events[0].ready();f.events[0].partial("partial")
        assertEquals(NativeDictation.State.LISTENING,f.d.state);assertEquals("partial",f.d.transcript)
        f.events[0].result("final transcript");assertEquals(NativeDictation.State.REVIEW,f.d.state)
        assertFalse(f.d.busy);assertTrue(f.d.stoppable);assertEquals("final transcript",f.d.transcript)
        assertTrue(f.timers.isEmpty());f.d.clear();assertEquals("",f.d.transcript)
    }
    @Test fun stopDuringReadinessFencesLateReady() {
        val f=F();f.d.start("ur-PK",true,true);f.d.stop();f.ready!!(null)
        assertEquals(0,f.starts);assertTrue(f.timers.isEmpty());assertEquals(NativeDictation.State.STOPPED,f.d.state)
    }
    @Test fun stopAndReplacementRejectOldPartialFinalAndError() {
        val f=F();f.begin();val old=f.events[0];f.d.stop();f.begin()
        old.partial("old");old.result("old final");old.error(NativeDictation.State.ERROR)
        assertEquals("",f.d.transcript);assertEquals(NativeDictation.State.STARTING,f.d.state)
        f.events[1].result("new");assertEquals("new",f.d.transcript)
    }
    @Test fun duplicateResultsCannotReplaceFirstAcceptedTranscript() {
        val f=F();f.begin();f.events[0].result("first");f.events[0].result("second");f.events[0].partial("late")
        assertEquals("first",f.d.transcript);assertEquals(NativeDictation.State.REVIEW,f.d.state)
    }
    @Test fun readinessAndSpeechDeadlinesDoNotAutoRetry() {
        val f=F();f.d.start("ur-PK",true,true);f.tick();f.ready!!(null)
        assertEquals(NativeDictation.State.TIMEOUT,f.d.state);assertEquals(0,f.starts)
        f.begin();f.events[0].partial("discard this");f.tick()
        assertEquals(NativeDictation.State.TIMEOUT,f.d.state);assertEquals("",f.d.transcript);assertEquals(1,f.starts)
    }
    @Test fun deadlineAndBackwardClockRejectResultsEvenBeforeTimerRuns() {
        for(t in listOf(-1L,20000L)) {
            val f=F();f.begin();f.time=t;f.events[0].result("late")
            assertEquals(NativeDictation.State.TIMEOUT,f.d.state);assertEquals("",f.d.transcript)
        }
    }
    @Test fun duplicateReadinessAfterListeningDoesNotReopenOrExpireIt() {
        val f=F();f.begin();f.time=3000;f.ready!!(null)
        assertEquals(1,f.starts);assertEquals(NativeDictation.State.STARTING,f.d.state)
        f.events[0].result("valid");assertEquals(NativeDictation.State.REVIEW,f.d.state)
    }
    @Test fun oversizedMalformedOrEmptyTranscriptIsNeverTruncated() {
        for(text in listOf("x".repeat(2001),"\uD800","")) {
            val f=F();f.begin();f.events[0].result(text)
            assertEquals("",f.d.transcript);assertFalse(f.d.busy);assertFalse(f.d.stoppable)
        }
    }
    @Test fun permissionRequestIsExplicitAndNeverStartsRecognitionOnGrant() {
        val f=F();f.d.start("ur-PK",true,true);f.ready!!(NativeDictation.State.PERMISSION_REQUIRED)
        assertEquals(0,f.permissions);f.d.requestPermission();assertEquals(1,f.permissions)
        f.ready!!(null);f.d.requestPermission();assertEquals(1,f.permissions);assertEquals(0,f.starts)
    }
    @Test fun changingLanguageOrNewStartCannotReplaceActiveOrReviewedInput() {
        val f=F();f.begin();f.d.start("en-US",false,true);assertEquals(1,f.starts)
        f.events[0].result("review");f.d.start("en-US",false,true);assertEquals(1,f.starts)
        f.d.clear();f.d.start("en-US",false,true);f.ready!!(null);assertFalse(f.offline)
    }
    @Test fun unknownLanguageBlockedAndToStringRedacted() {
        val f=F();f.d.start("https://evil.invalid",false,true);assertEquals(0,f.checks)
        f.begin();f.events[0].result("PRIVATE_TRANSCRIPT");assertFalse(f.d.toString().contains("PRIVATE_TRANSCRIPT"))
    }
}
