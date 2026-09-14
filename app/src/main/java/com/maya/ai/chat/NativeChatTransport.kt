package com.maya.ai.chat

import java.io.IOException
import okhttp3.Interceptor
import okhttp3.Authenticator
import okhttp3.Call
import okhttp3.CookieJar
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.MediaType.Companion.toMediaType
import java.io.ByteArrayOutputStream
import java.util.Locale
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference

/** One bounded fixed-origin POST. No redirects, cookies, authenticator or retries. */
class NativeChatTransport internal constructor(private val calls: Call.Factory = client) {
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
    fun execute(signed: NativeChatProtocol.SignedRequest, operation: Operation, beforeDispatch: () -> Unit = {}): NativeChatResponse.Result {
        operation.check()
        if (signed.path !in listOf(NativeChatProtocol.CHAT_PATH, NativeChatProtocol.CHECK_PATH) ||
            signed.body.toByteArray(Charsets.UTF_8).size > NativeChatProtocol.MAX_BODY_BYTES ||
            (signed.path == NativeChatProtocol.CHECK_PATH && signed.body != "{}")) throw NativeChatProtocol.Rejected("INVALID_TARGET")
        val builder = Request.Builder().tag(AttemptGuard::class.java, AttemptGuard()).url(NativeChatProtocol.ORIGIN + signed.path)
            .post(signed.body.toByteArray(Charsets.UTF_8).toRequestBody("application/json".toMediaType()))
            .header("Accept", "application/json").header("Accept-Encoding", "identity").header("Cache-Control", "no-store")
        signed.headers().forEach { (name, value) -> builder.header(name, value) }
        val call = calls.newCall(builder.build())
        call.timeout().timeout(operation.remainingMs(), TimeUnit.MILLISECONDS)
        operation.attach(call)
        try {
            operation.check(); beforeDispatch(); operation.markAttempt()
            call.execute().use { response ->
                operation.check()
                if (response.header("Content-Type")?.substringBefore(';')?.trim()?.lowercase(Locale.ROOT) != "application/json" ||
                    response.header("Content-Encoding") !in listOf(null, "identity")) throw NativeChatProtocol.Rejected("INVALID_SERVER_RESPONSE")
                val length = response.header("Content-Length")
                if (length != null && (!Regex("[0-9]+").matches(length) || length.toLongOrNull() == null ||
                        length.toLong() > NativeChatProtocol.MAX_RESPONSE_BYTES)) throw NativeChatProtocol.Rejected("INVALID_SERVER_RESPONSE")
                val body = response.body ?: throw NativeChatProtocol.Rejected("INVALID_SERVER_RESPONSE")
                val output = ByteArrayOutputStream()
                body.byteStream().use { stream ->
                    val buffer = ByteArray(4096)
                    while (true) {
                        operation.check(); val size = stream.read(buffer); operation.check()
                        if (size == -1) break
                        if (size == 0 || output.size() + size > NativeChatProtocol.MAX_RESPONSE_BYTES)
                            throw NativeChatProtocol.Rejected("INVALID_SERVER_RESPONSE")
                        output.write(buffer, 0, size)
                    }
                }
                operation.check()
                return NativeChatResponse.parse(response.code, output.toByteArray(), signed)
            }
        } catch (e: NativeChatProtocol.Rejected) {
            call.cancel(); throw e
        } catch (_: Exception) {
            call.cancel(); operation.check(); throw NativeChatProtocol.Rejected("NETWORK_UNCERTAIN")
        } finally { operation.detach(call) }
    }
}
