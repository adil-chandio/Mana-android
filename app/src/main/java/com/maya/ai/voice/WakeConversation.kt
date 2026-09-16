package com.maya.ai.voice

import com.maya.ai.chat.NativeChatProtocol

/** Wake is input data for an already approved conversation, never a phone/action grant. */
object WakeConversation {
    private val prefix=Regex("^\\s*(?:(?:hey|hay|hi|hello|o|arey|are|oye|acha|suno|sun)[\\s,]+)?(?:maya|maaya|maywa|mya|boss|مایا|مايا|माया|باس)(?=$|[\\s,.!?،؟:؛-])[\\s,.!?،؟:؛-]*",RegexOption.IGNORE_CASE)
    /** null = no wake match; empty = bare wake, capture one following sentence. */
    fun command(alternatives: List<String>): String? {
        for(value in alternatives.take(6)) {
            if(value.length>2000 || !NativeChatProtocol.validReply(value)) continue
            val match=prefix.find(value) ?: continue
            return value.substring(match.range.last+1).trim()
        }
        return null
    }
    fun silence(error: Int)=error==6 || error==7
}
