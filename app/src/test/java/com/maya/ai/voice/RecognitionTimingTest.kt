package com.maya.ai.voice
import org.junit.Assert.*
import org.junit.Test

class RecognitionTimingTest {
    @Test fun missingEndIsUnknown() { assertNull(RecognitionTiming { 100L }.endToFinal()) }
    @Test fun zeroClockIsAValidEnd() { var now=0L; val t=RecognitionTiming { now }; t.end(); now=240; assertEquals(240L,t.endToFinal() ?: -1L) }
    @Test fun duplicateEndDoesNotMoveStart() { var now=10L; val t=RecognitionTiming { now }; t.end(); now=20; t.end(); now=30; assertEquals(20L,t.endToFinal() ?: -1L) }
    @Test fun backwardsClockIsUnknown() { var now=100L; val t=RecognitionTiming { now }; t.end(); now=50; assertNull(t.endToFinal()) }
    @Test fun excessiveDurationIsUnknown() { var now=100L; val t=RecognitionTiming { now }; t.end(); now=300101; assertNull(t.endToFinal()) }
    @Test fun listenerInstancesDoNotShareMarkers() { var now=10L; val a=RecognitionTiming { now }; a.end(); now=40; val b=RecognitionTiming { now }; assertEquals(30L,a.endToFinal() ?: -1L); assertNull(b.endToFinal()) }
}
