package com.maya.ai.chat

import okhttp3.Call
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.MediaType.Companion.toMediaType
import java.io.ByteArrayOutputStream
import java.util.concurrent.TimeUnit

/** Native-only text transport sharing the proven one-exchange/no-retry client. */
class ConfiguredChatTransport internal constructor(private val calls: Call.Factory=NativeChatTransport.client) {
    fun execute(config: ConfiguredChatPolicy.Config,messages: List<NativeChatProtocol.Message>,operation: NativeChatTransport.Operation,outputTokens: Int=config.tokens,purpose: ConfiguredChatPolicy.Purpose=ConfiguredChatPolicy.Purpose.CHAT,beforeDispatch: ()->Unit): NativeChatResponse.Result {
        operation.check()
        val url=config.url()
        if(!com.maya.ai.voice.FishTalkProtocol.allowedUrl(url)) throw NativeChatProtocol.Rejected("INVALID_TARGET")
        val body=ConfiguredChatPolicy.body(config,messages,outputTokens,purpose)
        val request=Request.Builder().url(url).tag(NativeChatTransport.AttemptGuard::class.java,NativeChatTransport.AttemptGuard())
            .post(body.toByteArray(Charsets.UTF_8).toRequestBody("application/json".toMediaType()))
            .header("Accept","application/json").header("Accept-Encoding","identity").header("Cache-Control","no-store")
        if(config.auth().isNotEmpty()) request.header("Authorization",config.auth())
        val call=calls.newCall(request.build());call.timeout().timeout(operation.remainingMs(),TimeUnit.MILLISECONDS)
        operation.attach(call)
        try {
            operation.check();beforeDispatch();operation.markAttempt()
            call.execute().use {response->
                operation.check()
                if(response.code !in 200..299) return ConfiguredChatPolicy.response(config,response.code,byteArrayOf())
                if(response.header("Content-Type")?.substringBefore(';')?.trim()?.lowercase()!="application/json" || response.header("Content-Encoding") !in listOf(null,"identity")) throw NativeChatProtocol.Rejected("CONFIGURED_INVALID_REPLY")
                val input=response.body ?: throw NativeChatProtocol.Rejected("CONFIGURED_INVALID_REPLY")
                if(input.contentLength()>NativeChatProtocol.MAX_RESPONSE_BYTES) throw NativeChatProtocol.Rejected("CONFIGURED_INVALID_REPLY")
                val out=ByteArrayOutputStream()
                input.byteStream().use {stream->
                    val buffer=ByteArray(4096)
                    while(true) {
                        operation.check();val n=stream.read(buffer);operation.check()
                        if(n==-1) break
                        if(n<=0 || out.size()+n>NativeChatProtocol.MAX_RESPONSE_BYTES) throw NativeChatProtocol.Rejected("CONFIGURED_INVALID_REPLY")
                        out.write(buffer,0,n)
                    }
                }
                return ConfiguredChatPolicy.response(config,response.code,out.toByteArray())
            }
        } catch(e: NativeChatProtocol.Rejected) {call.cancel();throw e}
          catch(_: Exception) {call.cancel();operation.check();throw NativeChatProtocol.Rejected("CONFIGURED_NETWORK_ERROR")}
        finally {operation.detach(call)}
    }
}
