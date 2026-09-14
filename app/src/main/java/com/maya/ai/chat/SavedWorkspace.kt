package com.maya.ai.chat

import java.io.*
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction
import java.util.UUID

/** Persistable data only. No capabilities, approvals, providers, credentials or live task state. */
class SavedWorkspace(val id: String, val title: String, val savedAt: Long,
    messages: List<NativeChatProtocol.Message>, val draft: String, val code: String?) {
    val messages=messages.toList()
    override fun toString()="SavedWorkspace(redacted)"
}

/** Strict versioned bounded format shared by encrypted local storage and portable encrypted backups. */
object WorkspaceArchive {
    const val MAX_BYTES=524288
    const val MAX_ITEMS=10
    private const val MAGIC=0x4d575331
    fun validate(item: SavedWorkspace) {
        require(UUID.fromString(item.id).toString()==item.id)
        require(item.title.length in 1..80 && NativeChatProtocol.validReply(item.title) && !item.title.any {it.code<32})
        require(item.savedAt>=0)
        require(item.draft.isEmpty() || run {NativeChatProtocol.validateDraft(item.draft);true})
        require(item.code==null || item.code.length<=8000 && (item.code.isEmpty() || NativeChatProtocol.validReply(item.code)))
        validateMessages(item.messages)
    }
    fun validateMessages(messages: List<NativeChatProtocol.Message>) {
        require(messages.size<=12 && messages.size%2==0)
        messages.forEachIndexed {i,m ->
            require(m.role==if(i%2==0) "user" else "assistant")
            if(i%2==0) NativeChatProtocol.validateDraft(m.content) else require(NativeChatProtocol.validReply(m.content))
        }
    }
    fun encode(items: List<SavedWorkspace>): ByteArray {
        require(items.size<=MAX_ITEMS && items.map {it.id}.toSet().size==items.size)
        val bytes=ByteArrayOutputStream()
        DataOutputStream(bytes).use {out ->
            out.writeInt(MAGIC);out.writeInt(items.size)
            fun text(value: String) {val raw=value.toByteArray(Charsets.UTF_8);out.writeInt(raw.size);out.write(raw);require(bytes.size()<=MAX_BYTES)}
            items.forEach {item ->
                validate(item);text(item.id);text(item.title);out.writeLong(item.savedAt)
                out.writeInt(item.messages.size);item.messages.forEach {text(it.content)}
                text(item.draft);out.writeBoolean(item.code!=null);item.code?.let {text(it)}
            }
        }
        return bytes.toByteArray().also {require(it.size<=MAX_BYTES)}
    }
    fun decode(bytes: ByteArray): List<SavedWorkspace> {
        require(bytes.size<=MAX_BYTES)
        val input=DataInputStream(ByteArrayInputStream(bytes))
        fun text(max: Int): String {
            val size=input.readInt();require(size in 0..max*4 && size<=input.available())
            val raw=ByteArray(size);input.readFully(raw)
            return Charsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT)
                .decode(ByteBuffer.wrap(raw)).toString().also {require(it.length<=max)}
        }
        require(input.readInt()==MAGIC)
        val count=input.readInt();require(count in 0..MAX_ITEMS)
        val items=(0 until count).map {
            val id=text(36);val title=text(80);val savedAt=input.readLong()
            val messages=input.readInt();require(messages in 0..12 && messages%2==0)
            val history=(0 until messages).map {i->NativeChatProtocol.Message(if(i%2==0) "user" else "assistant",text(if(i%2==0) 2000 else 8000))}
            val draft=text(2000);val hasCode=input.readUnsignedByte();require(hasCode in 0..1)
            SavedWorkspace(id,title,savedAt,history,draft,if(hasCode==1) text(8000) else null).also {validate(it)}
        }
        require(input.available()==0 && items.map {it.id}.toSet().size==items.size)
        return items
    }
}
