package com.maya.ai.agent

import com.maya.ai.chat.NativeChatProtocol
import java.util.concurrent.atomic.AtomicBoolean

/** Native one-use review ticket: metadata and prompt hashes only, never keys or executable authority. */
class AiTaskReview internal constructor(
    val kind: Kind,
    val route: Route,
    val provider: String,
    val model: String,
    internal val connectionFingerprint: String,
    prompts: List<String>,
    private val createdAt: Long
) {
    enum class Kind(val label: String) { RESEARCH_PLAN("Research plan"), SOURCE_SUMMARY("Source explanation"), BUILDER_PROPOSAL("Builder proposal"), BROWSER_NAVIGATION("Browser navigation proposal"), WHATSAPP_MESSAGE("WhatsApp message draft") }
    enum class Route { SAVED_AI, CLOUDFLARE }
    private val used=AtomicBoolean(false)
    private var approvedDigest: String?=null
    private val candidates: Set<String>
    init {
        require(prompts.size in 1..2)
        prompts.forEach {NativeChatProtocol.validateDraft(it)}
        require(createdAt>=0 && createdAt<=Long.MAX_VALUE-REVIEW_MS)
        require(provider.length in 1..100 && model.length in 1..200 && connectionFingerprint.isNotEmpty())
        candidates=prompts.map(::digest).toSet()
    }
    val description get()="${kind.label} · ${if(route==Route.SAVED_AI) "saved AI" else "Cloudflare (operator-enabled, not verified)"}\n$provider · $model\nMaximum $OUTPUT_TOKENS output tokens · one request · no tools or automatic retry"
    @Synchronized fun approve(prompt: String,now: Long): Boolean {
        if(used.get() || approvedDigest!=null || now-createdAt !in 0 until REVIEW_MS) return false
        return runCatching {NativeChatProtocol.validateDraft(prompt);val hash=digest(prompt)
            if(hash in candidates) {approvedDigest=hash;true} else false
        }.getOrDefault(false)
    }
    @Synchronized internal fun claim(prompt: String,now: Long): Boolean {
        if(!used.compareAndSet(false,true)) return false
        return now-createdAt in 0 until REVIEW_MS && runCatching {NativeChatProtocol.validateDraft(prompt);digest(prompt)==approvedDigest}.getOrDefault(false)
    }
    @Synchronized fun revoke() {used.set(true);approvedDigest=null}
    override fun toString()="AiTaskReview(${kind.name},redacted)"
    companion object {
        const val OUTPUT_TOKENS=256
        const val REVIEW_MS=60000L
        private fun digest(text: String)=NativeChatProtocol.hash(text.toByteArray(Charsets.UTF_8))
    }
}
