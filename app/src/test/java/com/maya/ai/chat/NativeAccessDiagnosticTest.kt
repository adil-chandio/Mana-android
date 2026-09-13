package com.maya.ai.chat

import org.junit.Assert.*
import org.junit.Test

class NativeAccessDiagnosticTest {
    private class Memory(var value: String? = null) : NativeAccessDiagnostic.Store {
        override fun read() = value
        override fun write(value: String) { this.value = value }
    }
    @Test fun coldLoadIsNotRunAndDoesNotCreateAnAttempt() {
        val memory = Memory(); val d = NativeAccessDiagnostic(memory)
        assertEquals(NativeAccessDiagnostic.State.NOT_RUN, d.snapshot().state)
        assertEquals(0, d.snapshot().attempt); assertNull(memory.value)
    }
    @Test fun completedResultSurvivesNewControllerWithoutCreatingALogin() {
        val m = Memory(); val d = NativeAccessDiagnostic(m); val ticket = d.begin()
        d.stage(ticket, NativeAccessDiagnostic.Stage.FIRST_REQUEST); d.stage(ticket, NativeAccessDiagnostic.Stage.REPLAY_REQUEST)
        d.finish(ticket, NativeAccessDiagnostic.State.PASS, http = 409, elapsedMs = 1234)
        val restored = NativeAccessDiagnostic(m)
        assertEquals(d.snapshot(), restored.snapshot()); assertEquals(409, restored.snapshot().http)
        assertTrue(restored.report().contains("not a login")); assertTrue(restored.report().contains("REPLAY_DENIED"))
    }
    @Test fun interruptedRestoreNeverPretendsWorkResumedOrPassed() {
        val m = Memory(); val d = NativeAccessDiagnostic(m); val t = d.begin(); d.stage(t, NativeAccessDiagnostic.Stage.FIRST_REQUEST)
        val restored = NativeAccessDiagnostic(m)
        assertEquals(NativeAccessDiagnostic.State.INTERRUPTED, restored.snapshot().state)
        restored.finish(t, NativeAccessDiagnostic.State.PASS)
        assertEquals(NativeAccessDiagnostic.State.INTERRUPTED, restored.snapshot().state)
    }
    @Test fun lateCompletionCannotOverwriteExitOrNewAttempt() {
        val d = NativeAccessDiagnostic(Memory()); val first = d.begin()
        d.finish(first, NativeAccessDiagnostic.State.LEFT_SCREEN, "STOPPED_LOCALLY")
        d.finish(first, NativeAccessDiagnostic.State.PASS); assertEquals(NativeAccessDiagnostic.State.LEFT_SCREEN, d.snapshot().state)
        val second = d.begin(); d.stage(first, NativeAccessDiagnostic.Stage.REPLAY_REQUEST); d.finish(first, NativeAccessDiagnostic.State.PASS)
        assertEquals(2, d.snapshot().attempt); assertEquals(NativeAccessDiagnostic.Stage.SIGNING, d.snapshot().stage)
        d.finish(second, NativeAccessDiagnostic.State.FAILED, "KEY_REQUIRED")
        assertEquals("KEY_REQUIRED", d.snapshot().code)
    }
    @Test fun rawDetailsCannotBePersistedOrCopiedAndNumbersAreBounded() {
        val m = Memory(); val d = NativeAccessDiagnostic(m)
        d.finish(d.begin(), NativeAccessDiagnostic.State.FAILED, "PRIVATE_CHAT_KEY_OR_BODY", 9999, Long.MAX_VALUE)
        assertEquals("SAFE_FAILURE", d.snapshot().code); assertEquals(0, d.snapshot().http); assertEquals(60000L, d.snapshot().elapsedMs)
        assertFalse(m.value!!.contains("PRIVATE")); assertFalse(d.report().contains("PRIVATE")); assertTrue(m.value!!.length <= 160)
    }
    @Test fun malformedStoredReportsFailClosed() {
        for (raw in listOf("PRIVATE", "x".repeat(161), "1|1|PASS|FINISHED|NONE|409|5", "1|0|PASS|FINISHED|REPLAY_DENIED|409|5",
            "1|1|PASS|FINISHED|REPLAY_DENIED|200|5", "1|1|FAILED|NONE|PRIVATE|401|2", "1|1|RUNNING|NONE|NONE|0|-1")) {
            val d = NativeAccessDiagnostic(Memory(raw)); assertEquals(NativeAccessDiagnostic.State.NOT_RUN, d.snapshot().state)
            assertFalse(d.report().contains("PRIVATE"))
        }
    }
    @Test fun stageDoesNotRegressAndClearingInvalidatesCallbacks() {
        val m = Memory(); val d = NativeAccessDiagnostic(m); val t = d.begin()
        d.stage(t, NativeAccessDiagnostic.Stage.REPLAY_REQUEST); d.stage(t, NativeAccessDiagnostic.Stage.FIRST_REQUEST)
        assertEquals(NativeAccessDiagnostic.Stage.REPLAY_REQUEST, d.snapshot().stage)
        d.clear(); d.finish(t, NativeAccessDiagnostic.State.PASS)
        assertEquals(NativeAccessDiagnostic.State.NOT_RUN, NativeAccessDiagnostic(m).snapshot().state)
    }
    @Test fun unavailableStorageDoesNotBreakLocalResultOrExposeException() {
        val d = NativeAccessDiagnostic(object : NativeAccessDiagnostic.Store {
            override fun read(): String? = throw IllegalStateException("PRIVATE_DISK_DETAIL")
            override fun write(value: String) { throw IllegalStateException("PRIVATE_DISK_DETAIL") }
        })
        assertFalse(d.storageAvailable)
        d.finish(d.begin(), NativeAccessDiagnostic.State.TIMEOUT, "DEADLINE_EXCEEDED")
        assertEquals(NativeAccessDiagnostic.State.TIMEOUT, d.snapshot().state)
        assertTrue(d.report().contains("memory-only")); assertFalse(d.report().contains("PRIVATE"))
    }
    @Test fun counterWrapIsBoundedAndDoesNotReviveAnOldTicket() {
        val d = NativeAccessDiagnostic(Memory("1|999999|FAILED|SIGNING|BUSY|0|0"))
        val first = d.begin(); assertEquals(1, d.snapshot().attempt)
        val second = d.begin(); d.finish(first, NativeAccessDiagnostic.State.PASS)
        assertEquals(NativeAccessDiagnostic.State.RUNNING, d.snapshot().state)
        d.finish(second, NativeAccessDiagnostic.State.STOPPED, "STOPPED_LOCALLY", -1, -1)
        assertEquals(0L, d.snapshot().elapsedMs); assertEquals(0, d.snapshot().http)
    }
    @Test fun passCannotBeRecordedBeforeReplayOrWithWrongStatus() {
        val d = NativeAccessDiagnostic(Memory())
        d.finish(d.begin(), NativeAccessDiagnostic.State.PASS, http = 409)
        assertEquals(NativeAccessDiagnostic.State.FAILED, d.snapshot().state)
        val second = d.begin(); d.stage(second, NativeAccessDiagnostic.Stage.REPLAY_REQUEST)
        d.finish(second, NativeAccessDiagnostic.State.PASS, http = 200)
        assertEquals("REPLAY_CHECK_FAILED", d.snapshot().code)
    }

}
