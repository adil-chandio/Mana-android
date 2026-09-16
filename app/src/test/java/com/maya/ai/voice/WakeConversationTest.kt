package com.maya.ai.voice

import org.junit.Assert.*
import org.junit.Test

class WakeConversationTest {
    @Test fun wakeAndQuestionAreOneInputNotADiscardedInvitation() {
        assertEquals("what time is it",WakeConversation.command(listOf("Maya what time is it")))
        assertEquals("kaise ho",WakeConversation.command(listOf("Hey Maya, kaise ho")))
    }
    @Test fun bareWakeOpensOneFollowingInput() {
        for(s in listOf("Maya","maya!","مایا","माया","Boss")) assertEquals("",WakeConversation.command(listOf(s)))
    }
    @Test fun wrongWordsAndMidSentenceNamesDoNotWake() {
        for(s in listOf("mayawall","say Maya later","hello there","")) assertNull(WakeConversation.command(listOf(s)))
    }
    @Test fun onlyBoundedValidAlternativesAreConsidered() {
        assertEquals("sawal",WakeConversation.command(listOf("noise","Maya sawal")))
        assertNull(WakeConversation.command(List(6){"noise"}+"Maya late"))
        assertNull(WakeConversation.command(listOf("Maya "+"x".repeat(2000))))
        assertNull(WakeConversation.command(listOf("Maya \uD800")))
    }
    @Test fun recognitionSilenceIsNotATechnicalFailureOrPermanentDisable() {
        assertTrue(WakeConversation.silence(6));assertTrue(WakeConversation.silence(7))
        for(code in listOf(1,2,3,4,5,8,9,12,13)) assertFalse(WakeConversation.silence(code))
    }
}
