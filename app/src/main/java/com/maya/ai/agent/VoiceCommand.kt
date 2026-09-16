package com.maya.ai.agent

import com.maya.ai.chat.NativeChatProtocol
import com.maya.ai.voice.WakeConversation
import java.util.Locale

/** Local deterministic command parser for voice transcripts and typed text. Prefills reviewed task cards only — never executes, never networks, never invents recipients. */
object VoiceCommand {
    data class WhatsApp(val digits: String?,val name: String?,val message: String)
    private val waWord=Regex("\\b[vw]h?ats?\\s?apps?\\b")
    private val digitRun=Regex("[0-9][0-9 \\-]{5,17}[0-9]")
    private val atName=Regex("@([\\p{L}][\\p{L}0-9_.]{0,29})")
    private val verbs=listOf("likho","likh","bhejo","bhej","send","message","messages","type","bolo","bol","karo","kar")
    private val connectors=setOf("ke","ki","that","saying")
    private val leadingPunct=Regex("^[\\s:,\\-–—]+")
    private val midSplit=Regex("\\b(saying|that)\\b")
    fun parse(raw: String): WhatsApp? {
        if(raw.length !in 1..2000 || !NativeChatProtocol.validReply(raw)) return null
        val core=(WakeConversation.command(listOf(raw)) ?: raw).trim()
        if(core.isEmpty()) return null
        val low=core.lowercase(Locale.ROOT)
        if(low.length!=core.length) return null // Never slice one string with another string's indices.
        val waAt=waWord.find(low)?.range?.first ?: return null
        var verbAt=-1;var verbEnd=-1
        for(v in verbs) {
            var i=low.indexOf(v,waAt)
            while(i>=0) {
                val beforeOk=i==0 || (!low[i-1].isLetterOrDigit() && low[i-1]!='_')
                val after=low.getOrNull(i+v.length)
                if(beforeOk && (after==null || (!after.isLetterOrDigit() && after!='_'))) {if(verbAt<0 || i<verbAt) {verbAt=i;verbEnd=i+v.length};break}
                i=low.indexOf(v,i+1)
            }
        }
        if(verbAt<0) return null
        val scope=core.substring(0,verbAt)
        var tail=core.substring(verbEnd)
        var connectorSeen=false
        var guard=0
        while(guard++<4) {
            tail=leadingPunct.replaceFirst(tail,"")
            val word=tail.takeWhile {it.isLetter()}.lowercase(Locale.ROOT)
            if(word in verbs && !connectorSeen) {tail=tail.substring(word.length);continue}
            if(word in connectors && !connectorSeen) {tail=leadingPunct.replaceFirst(tail.substring(word.length),"");connectorSeen=true}
            break
        }
        // Filter fillers consumed above (message/karo). A saying/that split applies only
        // when no leading connector already delimited the message.
        var routingExtra=""
        if(!connectorSeen) {val lowTail=tail.lowercase(Locale.ROOT);if(lowTail.length==tail.length) midSplit.find(lowTail)?.let {routingExtra=tail.substring(0,it.range.first);tail=tail.substring(it.range.last+1).trim()}}
        val message=tail.trim()
        if(message.isEmpty() || message.length>500 || !NativeChatProtocol.validReply(message)) return null
        val routing="$scope $routingExtra"
        return WhatsApp(firstDigits(routing),atName.find(routing)?.groupValues?.get(1),message)
    }
    private fun firstDigits(scope: String): String? {
        for(m in digitRun.findAll(scope)) {
            val plain=m.value.filter {it in '0'..'9'}
            if(plain.length !in 7..15) continue
            val normalized=if(plain.startsWith('0') && plain.length in 10..11) "92"+plain.drop(1) else plain
            if(normalized.length in 7..15) return normalized
        }
        return null
    }
}
