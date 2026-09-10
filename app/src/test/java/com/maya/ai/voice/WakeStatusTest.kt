package com.maya.ai.voice

import org.junit.Assert.*
import org.junit.Test
import com.maya.ai.voice.WakeStatus.State.*
import com.maya.ai.voice.WakeStatus.Reason.*

class WakeStatusTest {
    private var clock = 0L
    private fun status() = WakeStatus { clock }
    @Test fun initialStateDoesNotClaimListening() { assertEquals(STOPPED, status().snapshot().state) }
    @Test fun startRequestIsNotReadiness() { val s=status(); s.update(REQUESTED); s.update(FOREGROUND); assertEquals(0L,s.snapshot().ready) }
    @Test fun readyRequiresExplicitTransition() { val s=status(); s.update(STARTING); assertEquals(1L,s.snapshot().starts); assertEquals(0L,s.snapshot().ready); s.update(READY); assertEquals(1L,s.snapshot().ready) }
    @Test fun duplicateReadyDoesNotResetAgeOrCount() { val s=status(); s.update(READY); clock=1000; assertFalse(s.update(READY)); assertEquals(1000L,s.snapshot().ageMs); assertEquals(1L,s.snapshot().ready) }
    @Test fun staleReadyIsUnknownNotHealthy() { val s=status(); s.update(READY); clock=35000; assertEquals(UNKNOWN,s.snapshot().state); assertEquals(STALE,s.snapshot().reason) }
    @Test fun staleStartRequestIsUnknown() { val s=status(); s.update(REQUESTED); clock=8000; assertEquals(UNKNOWN,s.snapshot().state) }
    @Test fun failureSurvivesServiceDestruction() { val s=status(); s.update(ERROR,FOREGROUND_REJECTED); s.destroyed(); assertEquals(ERROR,s.snapshot().state); assertEquals(FOREGROUND_REJECTED,s.snapshot().reason) }
    @Test fun explicitStopClearsErrorWithoutClaimingReady() { val s=status(); s.update(ERROR,PERMISSION,9); s.update(STOPPED); s.destroyed(); assertEquals(STOPPED,s.snapshot().state); assertEquals(0,s.snapshot().error) }
    @Test fun blockedAndRetryCannotRemainReady() { val s=status(); s.update(READY); s.update(BLOCKED,FISH_OUTPUT); assertEquals(BLOCKED,s.snapshot().state); s.update(RETRY,RECOGNIZER_ERROR,8); assertEquals(8,s.snapshot().error) }
    @Test fun badErrorCodeIsNotExported() { val s=status(); s.update(ERROR,RECOGNIZER_ERROR,999); assertEquals(0,s.snapshot().error) }
    @Test fun repeatedReadIsSideEffectFree() { val s=status(); s.update(BLOCKED,SPEECH); clock=400; assertEquals(s.snapshot(),s.snapshot()); assertEquals(0L,s.snapshot().starts) }
    @Test fun destroyedReadyCannotStayReady() { val s=status(); s.update(READY); s.destroyed(); assertEquals(STOPPED,s.snapshot().state) }
}
