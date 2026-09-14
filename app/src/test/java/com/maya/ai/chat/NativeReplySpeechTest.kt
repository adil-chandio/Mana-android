package com.maya.ai.chat

import org.junit.Assert.*
import org.junit.Test

class NativeReplySpeechTest {
    private class Fixture : NativeReplySpeech.Port {
        val preparations = mutableListOf<Pair<String?, (NativeFishPolicy.Result) -> Unit>>()
        val events = mutableListOf<(String, Int) -> Unit>()
        val timers = linkedMapOf<Int, Pair<Long, () -> Unit>>()
        var sequence = 0; var stops = 0; var plays = 0; var accept = true
        val states = mutableListOf<NativeFishPolicy.Code>()
        val owner = NativeReplySpeech(this, { delay, task ->
            val id = ++sequence; timers[id] = delay to task
            val cancel: () -> Unit = { timers.remove(id); Unit }; cancel
        }, { states.add(it) })
        override fun prepare(text: String?, result: (NativeFishPolicy.Result) -> Unit) { preparations.add(text to result) }
        override fun play(prepared: NativeFishPolicy.Result.Prepared, event: (String, Int) -> Unit): Boolean {
            plays++; events.add(event); return accept
        }
        override fun stopOwned() { stops++ }
        fun prepared(index: Int = preparations.lastIndex) = preparations[index].second(NativeFishPolicy.Result.Prepared("SYNTHETIC", "SYNTHETIC"))
        fun expire() { val task = timers.values.first().second; task() }
    }
    @Test fun noConsentOrOverlongTextDoesNotEvenReadSettings() {
        val f = Fixture()
        assertFalse(f.owner.speak("Synthetic",false)); assertEquals(0,f.preparations.size)
        assertFalse(f.owner.speak("x".repeat(2001),true)); assertEquals(0,f.preparations.size)
        assertFalse(f.owner.busy)
    }
    @Test fun setupCheckNeverPlaysOrReceivesAReply() {
        val f = Fixture(); assertTrue(f.owner.check()); assertNull(f.preparations.single().first)
        f.preparations.single().second(NativeFishPolicy.Result.Ready)
        assertEquals(0,f.plays); assertFalse(f.owner.busy); assertEquals(NativeFishPolicy.Code.READY,f.owner.state)
        assertTrue(f.timers.isEmpty())
    }
    @Test fun stopDuringPreparationFencesLatePayload() {
        val f=Fixture(); f.owner.speak("Synthetic",true); f.owner.stop(); f.prepared()
        assertEquals(0,f.plays); assertEquals(NativeFishPolicy.Code.STOPPED,f.owner.state)
        assertFalse(f.owner.busy); assertTrue(f.timers.isEmpty())
    }
    @Test fun singleFlightDuplicateAndStaleCallbacksCannotStartAnotherVoice() {
        val f=Fixture(); f.owner.speak("first",true)
        assertFalse(f.owner.speak("second",true)); assertFalse(f.owner.check())
        f.prepared(); f.prepared(); assertEquals(1,f.plays)
        f.owner.stop(); f.owner.speak("new",true); f.events[0]("done",200); f.prepared(0)
        assertTrue(f.owner.busy); assertEquals(1,f.plays)
        f.prepared(1); assertEquals(2,f.plays)
    }
    @Test fun preparationAndPlaybackHaveIndependentDeadlines() {
        val f=Fixture(); f.owner.speak("first",true); assertEquals(1500L,f.timers.values.single().first)
        f.expire(); f.prepared(); assertEquals(0,f.plays); assertEquals(NativeFishPolicy.Code.TIMEOUT,f.owner.state)
        f.owner.speak("second",true); f.prepared(); assertEquals(210000L,f.timers.values.single().first)
        f.expire(); assertFalse(f.owner.busy); assertTrue(f.timers.isEmpty())
    }
    @Test fun failureIsFixedAndNeverRetriesOrChangesText() {
        val f=Fixture(); val text="Selected reply only"; f.owner.speak(text,true); f.prepared()
        f.events.single()("error",402)
        assertEquals(NativeFishPolicy.Code.MODEL_UNAVAILABLE,f.owner.state)
        assertEquals(1,f.plays); assertEquals(text,f.preparations.single().first); assertFalse(f.owner.busy)
    }
    @Test fun playingThenDoneReleasesOnlyItsOwnerAndLateEventsAreIgnored() {
        val f=Fixture(); f.owner.speak("test",true); f.prepared()
        f.events.single()("playing",200); assertTrue(f.owner.busy)
        f.events.single()("done",200); assertFalse(f.owner.busy); assertEquals(1,f.stops)
        f.events.single()("error",500); assertEquals(NativeFishPolicy.Code.DONE,f.owner.state)
    }
    @Test fun foreignSpeakerBusyCannotBeReplaced() {
        val f=Fixture(); f.accept=false; f.owner.speak("test",true); f.prepared()
        assertEquals(NativeFishPolicy.Code.ASSISTANT_BUSY,f.owner.state)
        assertFalse(f.owner.busy); assertEquals(1,f.plays)
    }
    @Test fun malformedPreparationOrMissingSetupNeverReachesPlayback() {
        val f=Fixture(); f.owner.speak("test",true)
        f.preparations.single().second(NativeFishPolicy.Result.Ready)
        assertEquals(NativeFishPolicy.Code.UNAVAILABLE,f.owner.state); assertEquals(0,f.plays)
        f.owner.check(); f.preparations.last().second(NativeFishPolicy.Result.Error(NativeFishPolicy.Code.MAIN_REQUIRED))
        assertEquals(NativeFishPolicy.Code.MAIN_REQUIRED,f.owner.state); assertEquals(0,f.plays)
    }
}
