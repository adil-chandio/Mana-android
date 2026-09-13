package com.maya.ai.voice

/** Duration measured wholly on the native monotonic clock, scoped to one listener. */
class RecognitionTiming(private val now: () -> Long) {
    private var ended: Long? = null
    fun end() { if (ended == null) ended = now() }
    fun endToFinal(): Long? {
        val start = ended ?: return null
        return (now() - start).takeIf { it in 0..300000 }
    }
}
