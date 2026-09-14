package com.maya.ai.voice

import org.json.JSONObject
import org.json.JSONTokener

/** Display-only envelopes from the trusted voice document. Never action/Send authority. */
object FishTalkProtocol {
    data class Review(val token: String,val provider: String,val model: String,val language: String,val tokens: Int)
    private val providers=setOf("gemini","groq","cerebras","mistral","openrouter","github","nvidia","zai")
    val states=setOf("starting","listening","finalizing","thinking","fish-starting","fish-playing","echo")
    fun review(raw: String?): Review?=runCatching {
        require(raw!=null && raw.length<=2048)
        val parser=JSONTokener(raw);val decoded=parser.nextValue();require(parser.nextClean()=='\u0000')
        val o=if(decoded is String) JSONObject(decoded) else decoded as JSONObject
        require(o.keys().asSequence().toSet()==setOf("code","review","provider","model","language","tokens"))
        require(o.getString("code")=="READY")
        val token=o.getString("review");val provider=o.getString("provider");val model=o.getString("model");val language=o.getString("language")
        require(Regex("review[0-9]{1,12}").matches(token) && provider in providers)
        require(Regex("[a-zA-Z0-9._:/-]{1,160}").matches(model))
        require(language in setOf("ur-PK","hi-IN","en-IN","en-US"))
        require(o.get("tokens") is Int);val tokens=o.getInt("tokens");require(tokens in setOf(280,400,1400))
        Review(token,provider,model,language,tokens)
    }.getOrNull()
    fun problem(raw: String?): String=runCatching {
        require(raw!=null && raw.length<=2048)
        val parser=JSONTokener(raw);val decoded=parser.nextValue();require(parser.nextClean()=='\u0000');val o=if(decoded is String) JSONObject(decoded) else decoded as JSONObject
        require(o.keys().asSequence().toSet()==setOf("code"))
        o.getString("code").takeIf {it in setOf("AI","FISH","INPUT","BUSY")} ?: "UNKNOWN"
    }.getOrDefault("UNKNOWN")
    fun allowedUrl(raw: String): Boolean=runCatching {
        val u=java.net.URI(raw)
        require(!u.isOpaque && u.host!=null && u.rawPath!=null && u.scheme=="https" && u.userInfo==null && u.port==-1 && u.fragment==null)
        val paths=mapOf("api.groq.com" to "/openai/v1/chat/completions", "api.cerebras.ai" to "/v1/chat/completions",
            "api.mistral.ai" to "/v1/chat/completions", "openrouter.ai" to "/api/v1/chat/completions",
            "models.github.ai" to "/inference/chat/completions", "integrate.api.nvidia.com" to "/v1/chat/completions",
            "api.z.ai" to "/api/paas/v4/chat/completions")
        if(u.host=="generativelanguage.googleapis.com") {
            require(Regex("/v1beta/models/[a-zA-Z0-9._-]{1,100}:generateContent").matches(u.rawPath))
            require(u.rawQuery!=null && Regex("key=[a-zA-Z0-9_%.-]{1,4096}").matches(u.rawQuery))
        } else require(paths[u.host]==u.rawPath && u.rawQuery==null)
        true
    }.getOrDefault(false)
    class Events {
        var phase="starting";private set
        private var pending=false
        private var turns=0
        private var characters=0
        fun readyForSpeech(turn: Int)=turn==turns && turns>0 && !pending && phase=="fish-starting"
        fun accept(kind: String,value: String): Boolean {
            if(kind=="state") {
                if(value !in states) return false
                phase=value;return true
            }
            if(kind=="end") return value.length in 1..400
            if(kind !in setOf("user","assistant") || !com.maya.ai.chat.NativeChatProtocol.validReply(value) || value.length>2000) return false
            if(kind=="user") {
                if(pending || turns>=5 || phase!="thinking") return false
                pending=true;turns++
            } else {
                if(!pending || phase!="thinking") return false
                pending=false
            }
            characters+=value.length
            return characters<=8000
        }
    }
}
