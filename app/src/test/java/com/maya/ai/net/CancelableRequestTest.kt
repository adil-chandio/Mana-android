package com.maya.ai.net

import java.net.HttpURLConnection
import java.net.URL
import org.junit.Assert.*
import org.junit.Test

class CancelableRequestTest {
    private class Socket : HttpURLConnection(URL("https://example.test")) {
        var closes = 0
        override fun connect() {}
        override fun disconnect() { closes++ }
        override fun usingProxy() = false
    }
    @Test fun cancelBeforeAttachRejectsAndClosesSocket() {
        val job = CancelableRequest(); job.cancel(); val socket = Socket()
        assertFalse(job.attach(socket)); assertEquals(1, socket.closes)
    }
    @Test fun cancelAfterAttachDisconnectsOnlyOnce() {
        val job = CancelableRequest(); val socket = Socket(); assertTrue(job.attach(socket))
        job.cancel(); job.cancel(); job.close()
        assertTrue(job.cancelled); assertEquals(1, socket.closes)
    }
    @Test fun completedConnectionIsClosedWithoutMarkingCancelled() {
        val job = CancelableRequest(); val socket = Socket(); job.attach(socket); job.close(); job.close()
        assertFalse(job.cancelled); assertEquals(1, socket.closes)
    }
}
