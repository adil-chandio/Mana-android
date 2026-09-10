package com.maya.ai.net

import java.net.HttpURLConnection

/** Handles cancellation before or after the worker attaches its socket. */
class CancelableRequest {
    @Volatile var cancelled = false
        private set
    private var connection: HttpURLConnection? = null
    fun attach(value: HttpURLConnection): Boolean {
        val accepted = synchronized(this) {
            if (cancelled) false else { connection = value; true }
        }
        if (!accepted) runCatching { value.disconnect() }
        return accepted
    }
    fun cancel() {
        val old = synchronized(this) { cancelled = true; connection.also { connection = null } }
        runCatching { old?.disconnect() }
    }
    fun close() {
        val old = synchronized(this) { connection.also { connection = null } }
        runCatching { old?.disconnect() }
    }
}
