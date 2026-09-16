package com.maya.ai.agent

import android.content.Context
import android.os.Looper
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.annotation.LooperMode

@RunWith(RobolectricTestRunner::class)
@Config(sdk=[28])
@LooperMode(LooperMode.Mode.PAUSED)
class ResearchBackendTest {
    private fun approved(prompt: String): AiTaskReview {
        val now=android.os.SystemClock.elapsedRealtime()
        return AiTaskReview(AiTaskReview.Kind.RESEARCH_PLAN,"test","test-model","fingerprint",listOf(prompt),now).also {check(it.approve(prompt,now))}
    }
    @Test fun freshLocalGateBlocksModelBeforeSigningAndPreservesSettings() {
        val context=RuntimeEnvironment.getApplication()
        val prefs=context.getSharedPreferences("maya",Context.MODE_PRIVATE)
        prefs.edit().putBoolean("wake",true).commit()
        // A saved flag is not a live owner. Supply an actual service-present fixture without starting capture.
        val previous=com.maya.ai.WakeWordService.instance
        com.maya.ai.WakeWordService.instance=org.robolectric.Robolectric.buildService(com.maya.ai.WakeWordService::class.java).get()
        try {
            var result: ResearchBackend.TextFailure?=null
            ResearchBackend(context).text(approved("SYNTHETIC_GOAL"),"SYNTHETIC_GOAL") {text,error -> assertNull(text);result=error}
            shadowOf(Looper.getMainLooper()).idle()
            assertEquals(ResearchBackend.TextFailure.LOCAL_NOT_READY,result)
            assertTrue(prefs.getBoolean("wake",false))
        } finally {com.maya.ai.WakeWordService.instance=previous;prefs.edit().clear().commit()}
    }
    @Test fun cancelBeforeDeferredReadinessNeverDeliversOrSigns() {
        var calls=0
        val cancel=ResearchBackend(RuntimeEnvironment.getApplication()).text(approved("SYNTHETIC_GOAL"),"SYNTHETIC_GOAL") {_,_->calls++}
        cancel();shadowOf(Looper.getMainLooper()).idle();assertEquals(0,calls)
    }
}
