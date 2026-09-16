package com.maya.ai.agent

import com.maya.ai.chat.NativeChatProtocol

/** Single-use reviewed AI ticket: fixed kind, provider/model/connection and 1-2 exact prompts. No free text authority. */
class AiTaskReview(kind: Kind,provider: String,model: String,val connectionFingerprint: String,options: List<String>,issuedAt: Long) {
    enum class Kind { RESEARCH_PLAN, SOURCE_SUMMARY, BUILDER_PROPOSAL, BROWSER_NAVIGATION, WHATSAPP_MESSAGE }
    companion object {const val OUTPUT_TOKENS=256}
    val provider: String;val model: String;val kind: Kind;private val options: List<String>;private val issuedAt: Long
    @Volatile private var state: String? = null
    init {
        require(kind in Kind.values());require(provider.isNotEmpty() && model.isNotEmpty() && connectionFingerprint.isNotEmpty())
        require(options.size in 1..2);options.forEach {NativeChatProtocol.validateDraft(it)}
        require(issuedAt in 1..9_007_199_254_740_991L)
        this.provider=provider;this.model=model;this.kind=kind;this.options=options.toList();this.issuedAt=issuedAt
    }
    val description: String get()="Reviewed AI task (${kind.name.lowercase().replace('_',' ')}) · $provider / $model · $OUTPUT_TOKENS max tokens · saved AI account only · fixed reviewed prompt · no tools, actions, files or follow-ups."
    @Synchronized fun approve(prompt: String,now: Long): Boolean {
        if(state!=null || now !in issuedAt+1..issuedAt+60000 || prompt !in options) return false
        state=prompt;return true
    }
    @Synchronized fun claim(prompt: String,now: Long): Boolean {
        val approved=state ?: return false
        if(prompt!=approved || now !in issuedAt+1..issuedAt+60000) return false
        state=null;return true
    }
    @Synchronized fun revoke() {state=null}
    override fun toString()="AiTaskReview(${kind.name},redacted)"
}
