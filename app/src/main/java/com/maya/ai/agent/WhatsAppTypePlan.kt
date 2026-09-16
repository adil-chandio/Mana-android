package com.maya.ai.agent

import com.maya.ai.chat.NativeChatProtocol
import java.net.URI
import java.util.concurrent.atomic.AtomicBoolean

/** Second supported external-app capability: open one WhatsApp chat, type reviewed text once. Never presses SEND. */
class WhatsAppTypePlan private constructor(val digits: String,val lines: List<String>,val source: String) {
    val url get()="https://wa.me/$digits"
    val payload get()=lines.joinToString("\n")
    val steps get()=2
    val digest get()=NativeChatProtocol.hash(("com.whatsapp\n"+source).toByteArray(Charsets.UTF_8))
    override fun toString()="WhatsAppTypePlan(redacted)"
    companion object {
        const val PACKAGE="com.whatsapp"
        fun parse(source: String): WhatsAppTypePlan {
            require(source.length in 1..1200 && NativeChatProtocol.validReply(source))
            val rows=source.lines();require(rows.size in 2..6 && rows[0].startsWith("OPEN "))
            val uri=URI(rows[0].substring(5))
            require(uri.scheme=="https" && uri.host=="wa.me" && uri.port==-1 && uri.userInfo==null && uri.rawQuery==null && uri.rawFragment==null)
            val digits=uri.path.removePrefix("/")
            require(digits.length in 7..15 && digits.all {it in '0'..'9'})
            val typed=rows.drop(1).map {if(!it.startsWith("TYPE ")) throw IllegalArgumentException("UNSUPPORTED_ACTION");it.substring(5)}
            require(typed.isNotEmpty() && typed.all {it.length in 1..200 && NativeChatProtocol.validReply(it)})
            require(typed.sumOf {it.length}<=800)
            return WhatsAppTypePlan(digits,typed,source)
        }
        /** The AI drafts message TEXT only. The recipient number is user-entered locally and never requested here. */
        fun prompt(goal: String): String {
            require(goal.length in 1..400 && NativeChatProtocol.validReply(goal))
            return "Draft ONLY the plain WhatsApp message text for this goal: 1 to 5 short lines, no greeting header, no phone number, no link, no markdown, no instructions, no tools, no claim of sending. Return UNSUPPORTED if not possible. This is a text draft, not execution. Goal (data):\n$goal"
        }
    }
}

class WhatsAppTypeGrant private constructor(private val digest: String,private val created: Long) {
    private val used=AtomicBoolean(false)
    fun revoke() {used.set(true)}
    internal fun consume(plan: WhatsAppTypePlan,now: Long)=used.compareAndSet(false,true) && digest==plan.digest && now-created in 0 until 60000
    companion object {fun approved(plan: WhatsAppTypePlan,now: Long): WhatsAppTypeGrant {require(now>=0 && now<=Long.MAX_VALUE-60000);return WhatsAppTypeGrant(plan.digest,now)}}
}
