package com.maya.ai.agent

import okhttp3.*
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference

/** Public metadata/excerpt reads only. No account/token/cookie, redirects or automatic retries. */
class ResearchHttp internal constructor(private val calls: Call.Factory = client) {
    class Operation {
        private val stopped=AtomicBoolean(false)
        private val used=AtomicBoolean(false)
        private val call=AtomicReference<Call?>(null)
        fun cancel() { stopped.set(true); call.get()?.cancel() }
        fun check() { if (stopped.get()) throw IOException("STOPPED") }
        internal fun claim() { check(); kotlin.check(used.compareAndSet(false,true)) }
        internal fun attach(c: Call) { check(); call.set(c); if(stopped.get()) { c.cancel(); check() } }
        internal fun detach() { call.set(null) }
    }
    private class Exchange { val used=AtomicBoolean(false) }
    companion object {
        internal val client: OkHttpClient by lazy {
            OkHttpClient.Builder().followRedirects(false).followSslRedirects(false).retryOnConnectionFailure(false)
                .authenticator(Authenticator.NONE).proxyAuthenticator(Authenticator.NONE).cookieJar(CookieJar.NO_COOKIES).cache(null)
                .callTimeout(10,TimeUnit.SECONDS).connectTimeout(5,TimeUnit.SECONDS).readTimeout(5,TimeUnit.SECONDS)
                .addNetworkInterceptor { chain ->
                    val e=chain.request().tag(Exchange::class.java) ?: throw IOException("NO_EXCHANGE")
                    if (!e.used.compareAndSet(false,true)) throw IOException("NO_RETRY")
                    chain.proceed(chain.request())
                }.build()
        }
        private fun clip(value: String, cap: Int): String = value.take(cap).let { if(it.lastOrNull()?.isHighSurrogate()==true) it.dropLast(1) else it }
        internal fun parse(item: ResearchPlan.Item, raw: String): ResearchSource {
            // Reject excessive nesting/tokens before the recursive platform JSON parser.
            require(raw.length<=65536)
            var depth=0;var tokens=0;var quoted=false;var escaped=false
            for(c in raw) {
                if(quoted) {if(escaped) escaped=false else if(c=='\\') escaped=true else if(c=='"') quoted=false}
                else when(c) {
                    '"' -> quoted=true
                    '{','[' -> {depth++;tokens++;require(depth<=12 && tokens<=2048)}
                    '}',']' -> {depth--;require(depth>=0)}
                    ',',':' -> {tokens++;require(tokens<=2048)}
                }
            }
            require(depth==0 && !quoted)
            val root=JSONObject(raw)
            val text=when(item.kind) {
                ResearchPlan.Kind.WIKI -> {
                    require(root.get("type")=="standard" && root.get("lang")=="en")
                    val namespace=root.getJSONObject("namespace")
                    require(namespace.get("id") is Number && namespace.getDouble("id")==0.0)
                    require(root.get("extract") is String && root.get("title") is String)
                    val title=root.getString("title"); require(ResearchPlan.validTitle(title))
                    val extract=root.getString("extract"); require(extract.isNotBlank())
                    "$title\n" + clip(extract,1200)
                }
                ResearchPlan.Kind.REPO -> {
                    require(root.get("private") == false && root.get("full_name") is String)
                    require(root.getString("full_name").equals(item.value,ignoreCase=true))
                    val desc=root.opt("description"); require(desc == JSONObject.NULL || desc is String)
                    val language=root.opt("language"); require(language == JSONObject.NULL || language is String)
                    "Repository: ${item.value}\nDescription: ${clip(desc as? String ?: "Not provided",800)}\nLanguage: ${clip(language as? String ?: "Not provided",80)}"
                }
            }
            require(text.length in 1..1400 && com.maya.ai.chat.NativeChatProtocol.validReply(text) && text.none { it == '\u0000' })
            // Never trust a provider-supplied link, action, command, redirect or HTML.
            return ResearchSource(item.pageUrl,text)
        }
    }
    fun fetch(item: ResearchPlan.Item, op: Operation): ResearchSource {
        op.claim()
        val request=Request.Builder().url(item.requestUrl).get().tag(Exchange::class.java,Exchange())
            .header("Accept","application/json").header("Accept-Encoding","identity").header("Cache-Control","no-store")
            .header("User-Agent","MayaPublicResearch/1.0 (https://github.com/adil-chandio/Mana-android)")
            .apply { if(item.kind==ResearchPlan.Kind.REPO) header("X-GitHub-Api-Version","2026-03-10") }.build()
        val call=calls.newCall(request); op.attach(call)
        try {
            call.execute().use { response ->
                op.check(); require(response.code==200)
                require(response.header("Content-Type")?.substringBefore(';')?.trim()?.lowercase()=="application/json")
                require(response.header("Content-Encoding") in listOf(null,"identity"))
                val length=response.header("Content-Length")
                require(length == null || Regex("[0-9]{1,8}").matches(length) && length.toLong()<=65536)
                val body=response.body ?: throw IOException("EMPTY")
                val output=ByteArrayOutputStream()
                body.byteStream().use { stream ->
                    val buf=ByteArray(4096)
                    while(true) {
                        op.check(); val n=stream.read(buf); op.check(); if(n == -1) break
                        require(n>0 && output.size()+n<=65536); output.write(buf,0,n)
                    }
                }
                val raw=Charsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT)
                    .decode(ByteBuffer.wrap(output.toByteArray())).toString()
                op.check(); return parse(item,raw)
            }
        } finally { call.cancel(); op.detach() }
    }
}
