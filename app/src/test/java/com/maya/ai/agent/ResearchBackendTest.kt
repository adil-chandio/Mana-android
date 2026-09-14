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
    @Test fun freshLocalGateBlocksModelBeforeSigningAndPreservesSettings() {
        val context=RuntimeEnvironment.getApplication()
        val prefs=context.getSharedPreferences("maya",Context.MODE_PRIVATE)
        prefs.edit().putBoolean("wake",true).commit()
        try {
            var result: ResearchBackend.TextFailure?=null
            ResearchBackend(context).text("SYNTHETIC_GOAL") {text,error -> assertNull(text);result=error}
            shadowOf(Looper.getMainLooper()).idle()
            assertEquals(ResearchBackend.TextFailure.LOCAL_NOT_READY,result)
            assertTrue(prefs.getBoolean("wake",false))
        } finally {prefs.edit().clear().commit()}
    }
    @Test fun cancelBeforeDeferredReadinessNeverDeliversOrSigns() {
        var calls=0
        val cancel=ResearchBackend(RuntimeEnvironment.getApplication()).text("SYNTHETIC_GOAL") {_,_->calls++}
        cancel();shadowOf(Looper.getMainLooper()).idle();assertEquals(0,calls)
    }
}
