package com.maya.ai.voice

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk=[28])
class FishTalkProtocolTest {
    private fun review()=JSONObject().put("code","READY").put("review","review1").put("provider","groq").put("model","saved-model").put("language","ur-PK").put("tokens",400)
    @Test fun reviewAcceptsOnlyFixedNonsecretFields() {
        val r=FishTalkProtocol.review(JSONObject.quote(review().toString()))!!
        assertEquals("groq",r.provider);assertEquals(400,r.tokens)
        assertNull(FishTalkProtocol.review(review().put("key","PRIVATE").toString()))
    }
    @Test fun malformedReviewAndUnsupportedProviderLanguageOrBudgetFailClosed() {
        for(s in listOf("null","true","{}","\"not json\"", "x".repeat(2049),review().toString()+" trailing")) assertNull(FishTalkProtocol.review(s))
        for((key,value) in listOf("provider" to "pollen","language" to "url", "tokens" to "400", "tokens" to 9999,"model" to "x?key=private","review" to "x');evil()"))
            assertNull(FishTalkProtocol.review(review().put(key,value).toString()))
    }
    @Test fun onlyFixedFailureCodesReachTheUi() {
        assertEquals("AI",FishTalkProtocol.problem("{\"code\":\"AI\"}"))
        assertEquals("UNKNOWN",FishTalkProtocol.problem("{\"code\":\"PRIVATE_KEY\"}"))
        assertEquals("UNKNOWN",FishTalkProtocol.problem("{\"code\":\"AI\",\"key\":\"PRIVATE\"}"))
    }
    @Test fun endpointAllowlistRejectsOffOriginRedirectAndInjectionShapes() {
        assertTrue(FishTalkProtocol.allowedUrl("https://api.groq.com/openai/v1/chat/completions"))
        assertTrue(FishTalkProtocol.allowedUrl("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=TEST_KEY"))
        for(url in listOf("https:evil","https://evil.invalid/v1/chat/completions","http://api.groq.com/openai/v1/chat/completions","https://api.groq.com:443/openai/v1/chat/completions","https://key@api.groq.com/openai/v1/chat/completions","https://api.groq.com/openai/v1/chat/completions?key=x","https://generativelanguage.googleapis.com/v1beta/models/x:generateContent?key=x&next=y")) assertFalse(url,FishTalkProtocol.allowedUrl(url))
    }
    @Test fun unknownEventAndUnpairedReplyCannotBecomeSpeech() {
        val e=FishTalkProtocol.Events();assertFalse(e.accept("install","payload"));assertFalse(e.accept("assistant","answer"));assertFalse(e.readyForSpeech(1))
        assertFalse(e.accept("state","execute"));assertTrue(e.accept("state","thinking"));assertTrue(e.accept("user","question"))
        assertFalse(e.readyForSpeech(1));assertTrue(e.accept("assistant","answer"));assertTrue(e.accept("state","fish-starting"));assertTrue(e.readyForSpeech(1));assertFalse(e.readyForSpeech(2))
    }
    @Test fun duplicateAndOversizedTextEventsAreRejected() {
        val e=FishTalkProtocol.Events();e.accept("state","thinking")
        assertFalse(e.accept("user","x".repeat(2001)));assertFalse(e.accept("user","\uD800"))
        assertTrue(e.accept("user","question"));assertFalse(e.accept("user","duplicate"))
        assertTrue(e.accept("assistant","answer"));assertFalse(e.accept("assistant","duplicate"))
    }
    @Test fun nativeMirrorHasIndependentTurnAndCharacterCaps() {
        val e=FishTalkProtocol.Events()
        repeat(5) {assertTrue(e.accept("state","thinking"));assertTrue(e.accept("user","q"));assertTrue(e.accept("assistant","a"))}
        assertFalse(e.accept("user","sixth"))
        val big=FishTalkProtocol.Events();big.accept("state","thinking")
        repeat(2) {assertTrue(big.accept("user","x".repeat(2000)));assertTrue(big.accept("assistant","y".repeat(2000)))}
        assertFalse(big.accept("user","overflow"))
    }
}
