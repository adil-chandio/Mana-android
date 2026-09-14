package com.maya.ai.voice

import org.junit.Assert.*
import org.junit.Test

class ForegroundVoiceSessionTest {
    private class F {
        var time=1000L
        var captures=0;var releases=0
        var selected="";var offline=false
        data class Timer(val at: Long,val run: ()->Unit)
        val timers=mutableListOf<Timer>()
        val s=ForegroundVoiceSession({time},{delay,task->
            val t=Timer(time+delay,task);timers.add(t)
            val cancel: ()->Unit={timers.remove(t);Unit};cancel
        },{language,local->captures++;selected=language;offline=local},{releases++},{})
        fun advance(ms: Long) {
            val end=time+ms
            while(true) {
                val t=timers.filter {it.at<=end}.minByOrNull {it.at} ?: break
                timers.remove(t);time=t.at;t.run()
            }
            time=end
        }
        fun ready() {s.begin("ur-PK",true);s.reviewed();s.usedTranscript()}
    }
    @Test fun noStartupCaptureAndOnlySelectedInputChoiceIsReused() {
        val f=F();assertFalse(f.s.armed);assertEquals(0,f.captures)
        f.s.begin("hi-IN",false);assertEquals(1,f.captures);assertEquals("hi-IN",f.selected);assertFalse(f.offline)
        f.s.reviewed();f.s.usedTranscript();f.s.listen();assertEquals(2,f.captures);assertEquals("hi-IN",f.selected)
    }
    @Test fun noRecognitionDuringReviewOrNetworkWaitingWithoutExplicitContinue() {
        val f=F();f.s.begin("ur-PK",true);f.s.reviewed();f.s.listen();assertEquals(1,f.captures)
        f.s.usedTranscript();f.s.hold();f.advance(60000);assertEquals(1,f.captures)
        f.s.listen();assertEquals(2,f.captures)
    }
    @Test fun longReplyDoesNotConsumeTheNextInputWindow() {
        val f=F();f.ready();f.s.hold();f.advance(45000);f.s.outputStarted();f.advance(60000)
        assertEquals(1,f.captures);f.s.outputFinished(true);f.advance(599);assertEquals(1,f.captures)
        f.advance(1);assertEquals(2,f.captures);assertTrue(f.offline)
    }
    @Test fun endDuringEchoRejectsEvenAQueuedOldTimer() {
        val f=F();f.ready();f.s.outputStarted();f.s.outputFinished(true)
        val old=f.timers.minByOrNull {it.at}!!.run
        f.s.end();old();f.advance(1000);assertEquals(1,f.captures);assertFalse(f.s.armed)
    }
    @Test fun settingsOrNewTurnHoldCancelsAutomaticRearm() {
        val f=F();f.ready();f.s.outputStarted();f.s.outputFinished(true)
        val old=f.timers.minByOrNull {it.at}!!.run
        f.s.hold();old();f.advance(1000);assertEquals(1,f.captures)
    }
    @Test fun oldEchoCannotConsumeNewOutputCompletion() {
        val f=F();f.ready();f.s.outputStarted();f.s.outputFinished(true)
        val old=f.timers.minByOrNull {it.at}!!.run
        f.s.hold();f.s.outputStarted();f.s.outputFinished(true);old()
        assertEquals(1,f.captures);f.advance(600);assertEquals(2,f.captures)
    }
    @Test fun duplicateCompletionCannotStartTwice() {
        val f=F();f.ready();f.s.outputStarted();f.s.outputFinished(true);f.s.outputFinished(true)
        f.advance(600);f.s.outputFinished(true);f.s.listen();assertEquals(2,f.captures)
    }
    @Test fun outputFailureEndsInputGrantWithoutRetry() {
        val f=F();f.ready();f.s.outputStarted();f.s.outputFinished(false);f.advance(5000)
        assertFalse(f.s.armed);assertEquals(1,f.captures);assertEquals(1,f.releases)
    }
    @Test fun fiveMinuteCeilingIsNotRenewedByInputOrSpeech() {
        val f=F();f.ready();f.advance(299500);f.s.outputStarted();f.s.outputFinished(true);f.advance(600)
        assertFalse(f.s.armed);assertEquals(1,f.captures);assertTrue(f.timers.isEmpty())
    }
    @Test fun recreationNeverRestoresInputPermissionAndInvalidLanguageDoesNotStart() {
        val f=F();f.s.begin("PRIVATE",false);assertEquals(0,f.captures)
        f.ready();assertFalse(F().s.armed);assertFalse(f.s.toString().contains("ur-PK"))
    }
    @Test fun backwardsClockAndLateCallbackCannotExtendPermission() {
        val f=F();f.ready();f.time=999;f.s.listen();assertFalse(f.s.armed);assertEquals(1,f.captures)
    }
    @Test fun oldSessionExpiryCannotEndNewSession() {
        val f=F();f.ready();val old=f.timers.single().run
        f.s.end();f.s.begin("en-IN",false);old();assertTrue(f.s.armed);assertEquals("en-IN",f.s.language)
    }
}
