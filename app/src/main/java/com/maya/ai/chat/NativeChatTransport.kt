package com.maya.ai.chat

import java.io.IOException
import okhttp3.Interceptor
import okhttp3.Authenticator
import okhttp3.Call
import okhttp3.CookieJar
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference

/** Shared bounded HTTP plumbing for the saved-AI transport. One exchange, no retries, cookies or redirects. */
class NativeChatTransport {
    internal class AttemptGuard {
        private val used = AtomicBoolean(false)
        fun claim() { if (!used.compareAndSet(false, true)) throw IOException("NETWORK_ATTEMPT_LIMIT") }
    }
    companion object {
        // retryOnConnectionFailure(false) alone does not suppress every HTTP follow-up
        // (e.g. 503 + Retry-After: 0). Block a second wire exchange before it writes.
        internal val oneExchange = Interceptor { chain ->
            val guard = chain.request().tag(AttemptGuard::class.java) ?: throw IOException("NETWORK_ATTEMPT_LIMIT")
            guard.claim(); chain.proceed(chain.request())
        }
        internal val client: OkHttpClient by lazy {
            OkHttpClient.Builder().retryOnConnectionFailure(false).followRedirects(false).followSslRedirects(false)
                .authenticator(Authenticator.NONE).proxyAuthenticator(Authenticator.NONE).cookieJar(CookieJar.NO_COOKIES)
                .addNetworkInterceptor(oneExchange).cache(null).callTimeout(20, TimeUnit.SECONDS).connectTimeout(8, TimeUnit.SECONDS)
                .readTimeout(12, TimeUnit.SECONDS).writeTimeout(8, TimeUnit.SECONDS).build()
        }
    }
    class Operation(private val now: () -> Long) {
        private val end = now() + NativeChatProtocol.DEADLINE_MS
        private val cancelled = AtomicBoolean(false)
        private val call = AtomicReference<Call?>(null)
        @Volatile var attempted = false
            private set
        fun check() {
            if (cancelled.get()) throw NativeChatProtocol.Rejected("STOPPED_LOCALLY")
            if (now() >= end) throw NativeChatProtocol.Rejected("DEADLINE_EXCEEDED")
        }
        internal fun remainingMs(): Long { check(); return (end - now()).coerceAtLeast(1) }
        internal fun attach(value: Call) {
            check()
            if (!call.compareAndSet(null, value)) throw NativeChatProtocol.Rejected("BUSY")
            if (cancelled.get()) { value.cancel(); check() }
        }
        internal fun detach(value: Call) { call.compareAndSet(value, null) }
        internal fun markAttempt() { check(); attempted = true }
        fun cancel() { cancelled.set(true); runCatching { call.get()?.cancel() } }
    }
}
