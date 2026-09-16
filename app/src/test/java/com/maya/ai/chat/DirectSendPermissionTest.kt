package com.maya.ai.chat

import org.junit.Assert.*
import org.junit.Test

class DirectSendPermissionTest {
    private class Memory: DirectSendPermission.Store {
        var value: String?=null;var writes=0;var readFails=false;var writeFails=false
        override fun read(): String? {if(readFails) error("read failure");return value}
        override fun write(value: String) {if(writeFails) error("write failure");this.value=value;writes++}
    }
    @Test fun absentOrUnknownPolicyNeverGrantsOrWritesOnRead() {
        val s=Memory();val p=DirectSendPermission(s)
        assertFalse(p.remembered());assertEquals(0,s.writes)
        for(value in listOf("true","future-policy","",DirectSendPermission.POLICY+"junk")) {s.value=value;assertFalse(p.remembered())}
        assertEquals(0,s.writes)
    }
    @Test fun explicitRememberSurvivesControllerRecreationButOnlyForPinnedContract() {
        val s=Memory();val p=DirectSendPermission(s);assertTrue(p.remember());assertTrue(DirectSendPermission(s).remembered())
        s.value=DirectSendPermission.POLICY.replace(NativeChatProtocol.ORIGIN,"https://other.invalid")
        assertFalse(DirectSendPermission(s).remembered());assertEquals(1,s.writes)
    }
    @Test fun forgetRevokesPersistedAndCurrentPermission() {
        val s=Memory();val p=DirectSendPermission(s);p.remember();assertTrue(p.forget())
        assertFalse(p.remembered());assertFalse(DirectSendPermission(s).remembered())
        assertEquals(2,s.writes)
    }
    @Test fun readAndWriteFailuresFailClosedAndDoNotPretendToPersist() {
        val s=Memory();val p=DirectSendPermission(s);s.writeFails=true;assertFalse(p.remember());assertFalse(p.remembered())
        s.writeFails=false;p.remember();s.readFails=true;assertFalse(p.remembered())
        s.readFails=false;s.writeFails=true;assertFalse(p.forget());assertFalse(p.remembered())
    }
    @Test fun storedRecordContainsNoConversationCredentialOrToolAuthority() {
        val s=Memory();DirectSendPermission(s).remember()
        assertEquals(DirectSendPermission.POLICY,s.value);assertTrue(s.value!!.length<512)
        assertFalse(s.value!!.contains("private draft"));assertFalse(s.value!!.contains("fish.audio"));assertFalse(s.value!!.contains("Agent"))
    }
}
