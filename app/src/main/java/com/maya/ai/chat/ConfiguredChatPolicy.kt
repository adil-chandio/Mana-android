package com.maya.ai.chat

import org.json.JSONObject
import org.json.JSONArray
import java.nio.charset.CodingErrorAction
import java.nio.charset.StandardCharsets.UTF_8

/** Configuration travels from the trusted local settings document into native memory.
 * Draft/context never travel into JavaScript. No persistence, provider discovery or fallback. */
object ConfiguredChatPolicy {
    private val paths=mapOf("groq" to "https://api.groq.com/openai/v1/chat/completions",
        "cerebras" to "https://api.cerebras.ai/v1/chat/completions", "mistral" to "https://api.mistral.ai/v1/chat/completions",
        "openrouter" to "https://openrouter.ai/api/v1/chat/completions", "github" to "https://models.github.ai/inference/chat/completions",
        "nvidia" to "https://integrate.api.nvidia.com/v1/chat/completions", "zai" to "https://api.z.ai/api/paas/v4/chat/completions")
    class Config internal constructor(val provider: String,val model: String,val tokens: Int,private val key: String) {
        val fingerprint: String get()=NativeChatProtocol.hash("$provider|$model|$tokens|$key".toByteArray(UTF_8))
        internal fun url()=if(provider=="gemini") "https://generativelanguage.googleapis.com/v1beta/models/$model:generateContent?key="+java.net.URLEncoder.encode(key,"UTF-8") else paths.getValue(provider)
        internal fun auth()=if(provider=="gemini") "" else "Bearer $key"
        override fun toString()="ConfiguredChatConfig(redacted)"
    }
    fun decode(raw: String?): Config?=runCatching {
        require(raw!=null && raw.length<=16384)
        val outer=NativeChatResponse.Json(raw).read()
        val o=(if(outer is String) NativeChatResponse.Json(outer).read() else outer) as Map<*,*>
        require(o.keys==setOf("code","provider","model","tokens","key") && o["code"]=="READY")
        val provider=o["provider"] as String;val model=o["model"] as String;val key=o["key"] as String
        val tokens=o["tokens"] as Double
        require(provider=="gemini" || provider in paths)
        require(Regex("[a-zA-Z0-9._:/-]{1,160}").matches(model))
        require(key.length in 1..4096 && key.all {it.code in 33..126})
        require(if(provider=="gemini") tokens==280.0 && Regex("[a-zA-Z0-9._-]{1,100}").matches(model) else tokens in setOf(400.0,1400.0))
        require(provider!="openrouter" || model.endsWith(":free"))
        Config(provider,model,tokens.toInt(),key).also {require(com.maya.ai.voice.FishTalkProtocol.allowedUrl(it.url()))}
    }.getOrNull()
    fun body(config: Config,messages: List<NativeChatProtocol.Message>): String {
        NativeChatProtocol.body(messages) // Keep the existing context/Unicode/count/byte contract.
        val instruction="You are Maya, a helpful conversational assistant. Answer in the user's language. No tools or phone actions are available. Never claim an action was performed or invent current information. Return only the answer, no reasoning trace."
        val root=JSONObject()
        if(config.provider=="gemini") {
            root.put("systemInstruction",JSONObject().put("parts",JSONArray().put(JSONObject().put("text",instruction))))
            val contents=JSONArray();messages.forEach {m->contents.put(JSONObject().put("role",if(m.role=="assistant") "model" else "user").put("parts",JSONArray().put(JSONObject().put("text",m.content))))}
            root.put("contents",contents)
            val generation=JSONObject().put("temperature",0.7).put("maxOutputTokens",config.tokens)
            if(config.model.startsWith("gemini-2.5")) generation.put("thinkingConfig",JSONObject().put("thinkingBudget",0))
            root.put("generationConfig",generation)
        } else {
            val input=JSONArray().put(JSONObject().put("role","system").put("content",instruction))
            messages.forEach {input.put(JSONObject().put("role",it.role).put("content",it.content))}
            root.put("model",config.model).put("messages",input).put("temperature",0.7).put("max_tokens",config.tokens).put("stream",false)
        }
        return root.toString().also {if(it.toByteArray(UTF_8).size>NativeChatProtocol.MAX_BODY_BYTES) throw NativeChatProtocol.Rejected("BODY_TOO_LARGE")}
    }
    fun response(config: Config,status: Int,bytes: ByteArray): NativeChatResponse.Result {
        if(status !in 200..299) return NativeChatResponse.Result.Error(when(status) {
            401,402,403 -> "CONFIGURED_ACCESS_DENIED";429 -> "CONFIGURED_RATE_LIMIT";404 -> "CONFIGURED_MODEL_UNAVAILABLE";else -> "CONFIGURED_NETWORK_ERROR"
        },true,status=status)
        try {
            require(bytes.size<=NativeChatProtocol.MAX_RESPONSE_BYTES)
            val text=UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT).decode(java.nio.ByteBuffer.wrap(bytes)).toString()
            val root=NativeChatResponse.Json(text).read() as Map<*,*>
            require(root["tool_calls"]==null && root["function_call"]==null)
            val answer: String
            if(config.provider=="gemini") {
                val candidates=root["candidates"] as List<*>;require(candidates.size==1)
                val c=candidates.single() as Map<*,*>;require(c["finishReason"]=="STOP")
                val parts=(c["content"] as Map<*,*>)["parts"] as List<*>
                require(parts.isNotEmpty())
                answer=parts.joinToString("") {part->val p=part as Map<*,*>;require(!p.containsKey("functionCall") && p["thought"]!=true);p["text"] as String}
            } else {
                val choices=root["choices"] as List<*>;require(choices.size==1)
                val c=choices.single() as Map<*,*>;require(c["finish_reason"]=="stop")
                val m=c["message"] as Map<*,*>;require((m["tool_calls"]==null || m["tool_calls"]==emptyList<Any>()) && m["function_call"]==null && m["role"] in listOf(null,"assistant"))
                answer=m["content"] as String
            }
            require(answer.length<=2000 && NativeChatProtocol.validReply(answer) && !Regex("</?think\\b",RegexOption.IGNORE_CASE).containsMatchIn(answer))
            return NativeChatResponse.Result.Reply(answer)
        } catch(_: Exception) {throw NativeChatProtocol.Rejected("CONFIGURED_INVALID_REPLY")}
    }
}
