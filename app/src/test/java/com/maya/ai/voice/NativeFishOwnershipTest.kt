package com.maya.ai.voice

import android.os.Looper
import org.junit.After
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.LooperMode

@RunWith(RobolectricTestRunner::class)
@Config(sdk=[28])
@LooperMode(LooperMode.Mode.PAUSED)
class NativeFishOwnershipTest {
    private val ownerField get()=FishStreamPlayer::class.java.getDeclaredField("owner").apply { isAccessible=true }
    private fun player()=FishStreamPlayer(RuntimeEnvironment.getApplication()) { _,_,_ -> fail("No synthesis should start") }
    @After fun clean() { (ownerField.get(null) as? FishStreamPlayer)?.stop(); ownerField.set(null,null) }
    @Test fun nativeStartRefusesForeignOwnerWithoutStoppingIt() {
        assertEquals(Looper.getMainLooper(),Looper.myLooper())
        val foreign=player();ownerField.set(null,foreign)
        val native=player();assertFalse(native.speakExclusive("","","native") {})
        assertSame(foreign,ownerField.get(null));native.stop();assertSame(foreign,ownerField.get(null))
    }
    @Test fun legacyReplacementNotifiesOnlyOptedInNativeOwner() {
        val native=player();var interrupted=0
        FishStreamPlayer::class.java.getDeclaredField("exclusiveInterrupted").apply { isAccessible=true }.set(native,{interrupted++})
        ownerField.set(null,native)
        // Invalid ID returns before any request/player construction; replacement path alone runs.
        player().speak("","","invalid id!")
        assertEquals(1,interrupted);assertNull(ownerField.get(null))
        native.stop();assertEquals(1,interrupted)
    }
}
