package com.maya.ai.voice

import okhttp3.Authenticator
import okhttp3.Call
import okhttp3.CookieJar
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.io.InputStream
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference

/** Strict native Sunao transport; legacy Fish networking is unchanged. */
internal class NativeFishHttp(private val body: String, private val headers: Map<String, String>,
    private val factory: Call.Factory = client) {
    internal class Exchange {
        private val used = AtomicBoolean(false)
        fun claim() { if (!used.compareAndSet(false, true)) throw IOException("Synthesis cannot be retried") }
    }
    companion object {
        internal val oneExchange = Interceptor { chain ->
            val once = chain.request().tag(Exchange::class.java) ?: throw IOException("Missing attempt owner")
            once.claim(); chain.proceed(chain.request())
        }
        internal val client: OkHttpClient by lazy {
            OkHttpClient.Builder().retryOnConnectionFailure(false).followRedirects(false).followSslRedirects(false)
                .authenticator(Authenticator.NONE).proxyAuthenticator(Authenticator.NONE).cookieJar(CookieJar.NO_COOKIES).cache(null)
                .connectTimeout(6, TimeUnit.SECONDS).readTimeout(12, TimeUnit.SECONDS).writeTimeout(8, TimeUnit.SECONDS)
                .callTimeout(210, TimeUnit.SECONDS)
                .addNetworkInterceptor(oneExchange).build()
        }
    }
    private val opened = AtomicBoolean(false)
    private val stopped = AtomicBoolean(false)
    private val call = AtomicReference<Call?>(null)
    @Volatile private var response: Response? = null
    fun open(): InputStream {
        if (stopped.get() || !opened.compareAndSet(false, true)) throw IOException("Synthesis stopped or already opened")
        val request = Request.Builder().url(FishRequestPolicy.URL)
            .tag(Exchange::class.java, Exchange())
            .post(body.toByteArray(Charsets.UTF_8).toRequestBody("application/json".toMediaType()))
            .header("Accept-Encoding", "identity").header("Cache-Control", "no-store")
        // Only policy-validated headers are admitted by the player.
        for (name in listOf("Authorization", "model", "Content-Type", "Accept"))
            headers[name]?.let { request.header(name, it) }
        val current = factory.newCall(request.build()); call.set(current)
        if (stopped.get()) { current.cancel(); throw IOException("Synthesis stopped") }
        try {
            val result = current.execute(); response = result
            if (stopped.get()) throw IOException("Synthesis stopped")
            if (result.code !in 200..299) throw FishHttpError(result.code)
            val type = result.header("Content-Type")?.substringBefore(';')?.trim()?.lowercase(java.util.Locale.ROOT)
            if (type !in listOf("audio/mpeg", "audio/mp3", "application/octet-stream") ||
                result.header("Content-Encoding") !in listOf(null, "identity")) throw IOException("Invalid audio response")
            val data = result.body ?: throw IOException("Missing audio")
            if (data.contentLength() > 24_000_000) throw IOException("Audio too large")
            return data.byteStream()
        } catch (e: Exception) { close(); throw e }
    }
    fun close() {
        stopped.set(true); runCatching { call.getAndSet(null)?.cancel() }
        runCatching { response?.close() }; response = null
    }
    override fun toString() = "NativeFishHttp(redacted)"
}
