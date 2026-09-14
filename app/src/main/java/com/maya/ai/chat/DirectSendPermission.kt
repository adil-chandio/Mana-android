package com.maya.ai.chat

/** Owner-selected text-Send permission only, not server Chat ON, context retention or tool authority. */
class DirectSendPermission(private val store: Store) {
    interface Store {fun read(): String?;fun write(value: String)}
    private var locallyRevoked=false
    fun remembered(): Boolean = !locallyRevoked && try {store.read()==POLICY} catch(_: Exception) {false}
    fun remember(): Boolean = try {store.write(POLICY);locallyRevoked=false;true} catch(_: Exception) {false}
    fun forget(): Boolean {
        locallyRevoked=true
        return try {store.write("");true} catch(_: Exception) {false}
    }
    companion object {
        // A changed destination/model/privacy contract must not inherit an older grant.
        internal val POLICY="direct-manual-text-v1|${NativeChatProtocol.ORIGIN}|${NativeChatProtocol.CHAT_PATH}|${NativeChatProtocol.MODEL}"
    }
}
