package com.maya.ai.chat

import com.maya.ai.chat.NativeChatReadiness.Reason
import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.nio.file.Files
import java.util.concurrent.TimeUnit

class NativeChatReadinessTest {
    @Test fun runtimeNeverTreatsKnownActiveWorkAsReady() {
        assertEquals(Reason.READY, NativeChatReadiness.runtime(false,false,false,"KHALI",false))
        assertEquals(Reason.WAKE_ENABLED, NativeChatReadiness.runtime(true,false,false,"KHALI",false))
        assertEquals(Reason.WAKE_SERVICE, NativeChatReadiness.runtime(false,true,false,"KHALI",false))
        assertEquals(Reason.FISH_OUTPUT, NativeChatReadiness.runtime(false,false,true,"KHALI",false))
        for (audio in listOf("APP_SUN","BOL_RAHI")) assertEquals(Reason.AUDIO_BUSY, NativeChatReadiness.runtime(false,false,false,audio,false))
        assertEquals(Reason.AUDIO_UNKNOWN, NativeChatReadiness.runtime(false,false,false,"PRIVATE",false))
        assertEquals(Reason.ACTIONS_BUSY, NativeChatReadiness.runtime(false,false,false,"KHALI",true))
    }
    @Test fun activeRecognitionNotObjectAllocationControlsMicrophoneGate() {
        assertEquals(Reason.LEGACY_MIC, NativeChatReadiness.main(false,false,true,false,true))
        // Terminal recognition may leave an allocated recognizer, but it is no longer active.
        assertEquals(Reason.READY, NativeChatReadiness.main(false,false,false,false,true))
        assertEquals(Reason.MAIN_TRANSITION, NativeChatReadiness.main(true,false,false,false,true))
        assertEquals(Reason.LEGACY_HTTP, NativeChatReadiness.main(false,true,false,false,true))
        assertEquals(Reason.LEGACY_TTS, NativeChatReadiness.main(false,false,false,true,true))
        assertEquals(Reason.UNTRUSTED_VIEW, NativeChatReadiness.main(false,false,false,false,false))
    }
    @Test fun webviewReplyRequiresAnExactAllowedFixedJsonString() {
        assertEquals(Reason.READY, NativeChatReadiness.fromJavascript("\"READY\""))
        assertEquals(Reason.TURN_BUSY, NativeChatReadiness.fromJavascript("\"TURN_BUSY\""))
        for (value in listOf(null,"true","READY","\"PRIVATE\"","{\"state\":\"READY\"}","\"READY\"x","\"WAKE_SERVICE\""))
            assertEquals(Reason.UNKNOWN, NativeChatReadiness.fromJavascript(value))
    }
    @Test fun storedStateCannotInjectRawDetailsOrResumeAnUnfinishedCheck() {
        assertEquals(Reason.CANCELLED, NativeChatReadiness.restore("CHECKING"))
        assertEquals(Reason.NOT_CHECKED, NativeChatReadiness.restore("PRIVATE_API_BODY"))
        assertEquals(Reason.NOT_CHECKED, NativeChatReadiness.restore(null))
        assertEquals(Reason.READY, NativeChatReadiness.restore("READY"))
        for (reason in Reason.values()) assertFalse(reason.hint.contains("PRIVATE"))
    }
    @Test fun exactPackagedReadinessScriptAndRecognitionWiringHaveOfflineRegressionCoverage() {
        var root = File(System.getProperty("user.dir")).canonicalFile
        repeat(4) { if (!File(root,"tools/test-native-readiness.cjs").isFile) root=root.parentFile ?: root }
        val output = Files.createTempFile("maya-readiness-test-", ".txt").toFile()
        try {
            val p = ProcessBuilder("node",File(root,"tools/test-native-readiness.cjs").absolutePath)
                .directory(root).redirectErrorStream(true).redirectOutput(output).start()
            if (!p.waitFor(30,TimeUnit.SECONDS)) { p.destroyForcibly(); fail("Readiness fixture timed out") }
            assertEquals(output.readText().take(4000),0,p.exitValue())
            assertTrue(output.readText().contains("NATIVE_READINESS_PASS"))
        } finally { output.delete() }
    }
}
