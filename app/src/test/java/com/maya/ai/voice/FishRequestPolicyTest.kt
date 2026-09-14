package com.maya.ai.voice

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class FishRequestPolicyTest {
    private fun body() = JSONObject().put("text", "Hello").put("format", "mp3").put("reference_id", "selected-test-voice")
    private fun headers() = JSONObject().put("Authorization", "Bearer TEST_ONLY").put("model", "s2.1-pro-free")
    private fun reject(b: JSONObject = body(), h: JSONObject = headers()) {
        try { FishRequestPolicy.validate(b.toString(), h.toString()); fail("Must reject") } catch (_: IllegalArgumentException) { }
    }
    @Test fun selectedVoiceUsesFixedFreeModel() { assertEquals("s2.1-pro-free", FishRequestPolicy.validate(body().toString(), headers().toString())["model"]) }
    @Test fun paidModelCannotBeSelected() { reject(h = headers().put("model", "s2.1-pro")) }
    @Test fun unknownModelCannotFallBackToPaid() { reject(h = headers().put("model", "not-real")) }
    @Test fun missingVoiceCannotSilentlyUseAnother() { reject(body().put("reference_id", "")) }
    @Test fun missingReferenceCannotBeInferredFromName() { val b = body(); b.remove("reference_id"); reject(b) }
    @Test fun whitespaceIsNotSilentlyNormalizedToAnotherReference() { reject(body().put("reference_id", " saved-id ")) }
    @Test fun controlCharactersInReferenceAreRejected() { reject(body().put("reference_id", "saved\n-id")) }
    @Test fun oversizedReferenceIsRejected() { reject(body().put("reference_id", "v".repeat(201))) }
    @Test fun multiSpeakerCannotReplaceSelectedVoice() { reject(body().put("reference_id", org.json.JSONArray().put("one").put("two"))) }
    @Test fun referenceUploadsAreNotAccepted() { reject(body().put("references", org.json.JSONArray())) }
    @Test fun onlyMp3StreamIsAccepted() { reject(body().put("format", "wav")) }
    @Test fun headerInjectionIsRejected() { reject(h = headers().put("Authorization", "Bearer TEST\r\nOther: value")) }
    @Test fun oversizedTextIsRejected() { reject(body().put("text", "x".repeat(6001))) }
    @Test fun unrelatedHeadersAreNotForwarded() { assertFalse(FishRequestPolicy.validate(body().toString(), headers().put("Host", "other.example").toString()).containsKey("Host")) }
}
