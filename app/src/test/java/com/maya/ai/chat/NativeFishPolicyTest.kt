package com.maya.ai.chat

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.nio.file.Files
import java.util.concurrent.TimeUnit

class NativeFishPolicyTest {
    private fun payload() = JSONObject().put("code", "READY").put("reference", "saved-reference")
        .put("body", JSONObject().put("text", "Synthetic").put("format", "mp3").put("reference_id", "saved-reference")
            .put("mp3_bitrate", 128).put("latency", "balanced").put("chunk_length", 100).put("normalize", true)
            .put("temperature", .35).put("top_p", .7).put("prosody", JSONObject().put("speed", 1.0).put("volume", 0).put("normalize_loudness", true)).toString())
        .put("headers", JSONObject().put("Authorization", "Bearer SYNTHETIC_KEY").put("model", "s2.1-pro-free")
            .put("Content-Type", "application/json").put("Accept", "*/*").toString())
    private fun rejected(root: JSONObject) = assertTrue(NativeFishPolicy.decode(root.toString(), true) is NativeFishPolicy.Result.Error)
    @Test fun setupReplyNeverAdmitsCredentialsOrPreparedAudio() {
        assertSame(NativeFishPolicy.Result.Ready, NativeFishPolicy.decode("{\"code\":\"READY\"}", false))
        assertTrue(NativeFishPolicy.decode(payload().toString(), false) is NativeFishPolicy.Result.Error)
        assertTrue(NativeFishPolicy.decode("{\"code\":\"READY\"}", true) is NativeFishPolicy.Result.Error)
    }
    @Test fun exactSelectedFreeModelPayloadAdmittedAndToStringRedacts() {
        val r = NativeFishPolicy.decode(payload().toString(), true) as NativeFishPolicy.Result.Prepared
        assertFalse(r.toString().contains("SYNTHETIC_KEY")); assertFalse(r.toString().contains("saved-reference"))
    }
    @Test fun changedReferencePaidModelControlCharactersAndUnknownFieldsReject() {
        rejected(payload().put("reference", "other"))
        rejected(payload().put("url", "https://other.invalid"))
        for (field in listOf("model", "Authorization")) {
            val p = payload(); val h = JSONObject(p.getString("headers"))
            h.put(field, if (field == "model") "paid" else "Bearer PRIVATE\r\nHeader: value")
            rejected(p.put("headers", h.toString()))
        }
        val p = payload(); val b = JSONObject(p.getString("body")).put("references", "other")
        rejected(p.put("body", b.toString()))
    }
    @Test fun malformedLocalResponsesAreFixedErrors() {
        for (raw in listOf(null,"null","true","{}","{\"code\":\"PRIVATE\"}","x".repeat(65537))) {
            val r = NativeFishPolicy.decode(raw, true) as NativeFishPolicy.Result.Error
            assertEquals(NativeFishPolicy.Code.UNAVAILABLE,r.code)
        }
    }
    @Test fun noSilentTruncationAndFixedHttpHints() {
        assertFalse(NativeFishPolicy.validText(" ")); assertFalse(NativeFishPolicy.validText("a".repeat(2001)))
        assertTrue(NativeFishPolicy.validText("a".repeat(2000)))
        assertEquals(NativeFishPolicy.Code.MODEL_UNAVAILABLE, NativeFishPolicy.audioCode("error",402))
        assertEquals(NativeFishPolicy.Code.RATE_LIMIT, NativeFishPolicy.audioCode("error",429))
        assertEquals(NativeFishPolicy.Code.UNAVAILABLE, NativeFishPolicy.audioCode("PRIVATE",200))
    }
    @Test fun actualFishBuildersAndKotlinQuotedScriptPassOfflineNodeFixture() {
        var root = File(System.getProperty("user.dir")).canonicalFile
        repeat(4) { if (!File(root,"tools/test-native-fish.cjs").isFile) root = root.parentFile ?: root }
        val output = Files.createTempFile("maya-fish-local-", ".txt").toFile()
        val fixture = Files.createTempFile("maya-fish-script-", ".json").toFile()
        try {
            val text = "Synthetic \"; globalThis.hacked=true; //\n</script> اردو\u2028line"
            fixture.writeText(JSONObject().put("text",text).put("script",NativeFishPolicy.script(text)).toString())
            val p = ProcessBuilder("node",File(root,"tools/test-native-fish.cjs").absolutePath,fixture.absolutePath)
                .directory(root).redirectErrorStream(true).redirectOutput(output).start()
            if (!p.waitFor(30,TimeUnit.SECONDS)) { p.destroyForcibly(); fail("Offline Fish fixture timeout") }
            assertEquals(output.readText().take(4000),0,p.exitValue())
            assertTrue(output.readText().contains("NATIVE_FISH_LOCAL_PASS"))
        } finally { output.delete(); fixture.delete() }
    }
}
