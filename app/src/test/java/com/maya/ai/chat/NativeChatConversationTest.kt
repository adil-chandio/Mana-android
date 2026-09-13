package com.maya.ai.chat

import org.junit.Assert.*
import org.junit.Test

class NativeChatConversationTest {
    private fun rejects(code: String, fn: () -> Unit) {
        try { fn(); fail("Expected $code") } catch (e: NativeChatProtocol.Rejected) { assertEquals(code, e.code) }
    }
    @Test fun consentAndSingleFlightBeforeAnyWork() {
        val s = NativeChatConversation { 0 }
        rejects("CONSENT_REQUIRED") { s.begin("hello", false) }; assertFalse(s.busy)
        rejects("INVALID_MESSAGES") { s.begin("", true) }; assertFalse(s.busy)
        s.begin("first", true); assertTrue(s.busy)
        rejects("BUSY") { s.begin("second", true) }; assertTrue(s.messages().isEmpty())
    }
    @Test fun completedOnlyFollowUpAndNoSilentTrimming() {
        val s = NativeChatConversation { 0 }
        val first = s.begin("Synthetic neela-kaghaz-47", true)
        assertEquals(NativeChatConversation.Completion.ACCEPTED, s.complete(first, "Theek"))
        val failed = s.begin("failed turn", true); s.markDispatched(failed)
        assertEquals(NativeChatConversation.StopOutcome.REMOTE_UNCERTAIN, s.fail(failed))
        val next = s.begin("What was the synthetic phrase?", true)
        assertFalse(next.body.contains("failed turn")); assertTrue(next.body.contains("Synthetic neela-kaghaz-47"))
        s.complete(next, "neela-kaghaz-47"); assertEquals(4, s.messages().size)
        assertFalse(s.busy)
    }
    @Test fun stopBeforeAndAfterDispatchHaveDifferentUncertainty() {
        val s = NativeChatConversation { 0 }
        s.begin("a", true); assertEquals(NativeChatConversation.StopOutcome.NOT_DISPATCHED, s.stop())
        val turn = s.begin("b", true); s.markDispatched(turn)
        rejects("ALREADY_DISPATCHED") { s.markDispatched(turn) }
        assertEquals(NativeChatConversation.StopOutcome.REMOTE_UNCERTAIN, s.stop())
        rejects("STOPPED_LOCALLY") { s.markDispatched(turn) }
        assertEquals(NativeChatConversation.StopOutcome.NO_ACTIVE_REQUEST, s.stop())
    }
    @Test fun lateSuccessOrFailureCannotReplaceNewOwner() {
        val s = NativeChatConversation { 0 }
        val old = s.begin("old", true); s.stop()
        val current = s.begin("new", true)
        assertEquals(NativeChatConversation.Completion.STALE, s.complete(old, "old reply"))
        assertEquals(NativeChatConversation.StopOutcome.NO_ACTIVE_REQUEST, s.fail(old))
        assertTrue(s.busy); s.complete(current, "new reply")
        assertEquals(listOf("new", "new reply"), s.messages().map { it.content })
    }
    @Test fun exactDeadlineFencesDispatchAndCompletionEvenWithoutTimer() {
        var now = 500L; val s = NativeChatConversation { now }; val turn = s.begin("x", true)
        now += 20_000
        rejects("DEADLINE_EXCEEDED") { s.markDispatched(turn) }
        assertEquals(NativeChatConversation.Completion.EXPIRED, s.complete(turn, "late"))
        assertTrue(s.messages().isEmpty()); assertFalse(s.busy)
    }
    @Test fun clearFencesOldWorkAndNewInstanceHasNoConversation() {
        val s = NativeChatConversation { 0 }; val turn = s.begin("x", true); s.markDispatched(turn)
        assertEquals(NativeChatConversation.StopOutcome.REMOTE_UNCERTAIN, s.clear())
        assertEquals(NativeChatConversation.Completion.STALE, s.complete(turn, "old"))
        assertTrue(s.messages().isEmpty()); assertTrue(NativeChatConversation { 0 }.messages().isEmpty())
    }
    @Test fun maxTurnsAndLargeFinalReplyBlockFurtherContextRatherThanTrim() {
        val s = NativeChatConversation { 0 }
        repeat(6) { s.complete(s.begin("q$it", true), "reply") }
        assertEquals(12, s.messages().size)
        rejects("CONTEXT_LIMIT") { s.begin("overflow", true) }; assertEquals(12, s.messages().size)
        s.clear(); s.complete(s.begin("q", true), "x".repeat(2001))
        assertEquals(2001, s.messages().last().content.length)
        rejects("CONTEXT_LIMIT") { s.begin("next", true) }; assertFalse(s.busy)
    }
    @Test fun invalidReplyClearsPendingButPreservesCompletedHistory() {
        for (text in listOf("", " \uFEFF", "x".repeat(8001), "\uD800")) {
            val s = NativeChatConversation { 0 }; s.complete(s.begin("first", true), "valid")
            val turn = s.begin("second", true)
            rejects("INVALID_SERVER_RESPONSE") { s.complete(turn, text) }
            assertFalse(s.busy); assertEquals(2, s.messages().size)
        }
    }
    @Test fun tokenAndSnapshotDoNotExposeMutableHistoryOrDefaultLogContent() {
        val s = NativeChatConversation { 0 }; val turn = s.begin("PRIVATE_TEXT", true)
        assertFalse(turn.toString().contains("PRIVATE_TEXT")); s.complete(turn, "reply")
        val copy = s.messages().toMutableList(); copy.clear(); assertEquals(2, s.messages().size)
    }
    @Test fun invalidMonotonicClockFailsBeforePendingOwnership() {
        val s = NativeChatConversation { Long.MAX_VALUE }
        rejects("INVALID_LOCAL_CLOCK") { s.begin("x", true) }; assertFalse(s.busy)
    }
}
