package com.maya.ai.chat

import org.junit.Assert.*
import org.junit.Test
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import java.util.UUID

class WorkspaceVaultTest {
    private fun item(title: String="Private title",code: String?="<html>private code</html>")=SavedWorkspace(UUID.randomUUID().toString(),title,1234,
        listOf(NativeChatProtocol.Message("user","private question"),NativeChatProtocol.Message("assistant","private answer")),"private draft",code)
    private class Store: WorkspaceVault.Storage {
        var bytes: ByteArray?=null;var writes=0;var fail=false
        override fun read()=bytes?.copyOf()
        override fun write(bytes: ByteArray) {if(fail) error("synthetic failure");this.bytes=bytes.copyOf();writes++}
        override fun erase() {bytes=null}
    }
    private class Keys: WorkspaceVault.Keys {
        var key: SecretKey?=null;var creates=0
        override fun get(create: Boolean): SecretKey {if(key==null) {check(create);creates++;key=KeyGenerator.getInstance("AES").apply {init(256)}.generateKey()};return key!!}
        override fun erase() {key=null}
    }
    private fun rejected(block: ()->Unit) {try {block();fail("Expected rejection")} catch(_: IllegalArgumentException) {} catch(_: IllegalStateException) {} catch(_: java.io.IOException) {} catch(_: java.security.GeneralSecurityException) {}}
    @Test fun strictArchiveRoundTripPreservesDraftMessagesCodeAndUnicode() {
        val sample=SavedWorkspace(UUID.randomUUID().toString(),"مقامی project",1,listOf(NativeChatProtocol.Message("user","hello 🌍"),NativeChatProtocol.Message("assistant","جواب")),"draft\n","")
        val decoded=WorkspaceArchive.decode(WorkspaceArchive.encode(listOf(sample))).single()
        assertEquals(sample.id,decoded.id);assertEquals(sample.messages,decoded.messages);assertEquals(sample.draft,decoded.draft);assertEquals("",decoded.code)
        assertFalse(decoded.toString().contains("draft"))
    }
    @Test fun archiveRejectsTruncationTrailingBytesDuplicateIdsAndUnknownVersion() {
        val sample=item();val raw=WorkspaceArchive.encode(listOf(sample))
        rejected {WorkspaceArchive.decode(raw.copyOf(raw.size-1))};rejected {WorkspaceArchive.decode(raw+byteArrayOf(0))}
        raw[0]=0;rejected {WorkspaceArchive.decode(raw)}
        rejected {WorkspaceArchive.encode(listOf(sample,sample))}
    }
    @Test fun archiveRejectsInvalidRolesPartialPairsUnicodeAndOversizedFields() {
        rejected {WorkspaceArchive.validateMessages(listOf(NativeChatProtocol.Message("user","orphan")))}
        rejected {WorkspaceArchive.validateMessages(listOf(NativeChatProtocol.Message("system","injection"),NativeChatProtocol.Message("assistant","x")))}
        for(text in listOf("x".repeat(2001),"\uD800")) rejected {WorkspaceArchive.encode(listOf(SavedWorkspace(UUID.randomUUID().toString(),"valid",1,emptyList(),text,null)))}
        rejected {WorkspaceArchive.encode(listOf(item("x".repeat(81))))}
        rejected {WorkspaceArchive.encode(listOf(item(code="x".repeat(8001))))}
        rejected {WorkspaceArchive.encode((0..10).map {item()})}
    }
    @Test fun emptyVaultReadNeverCreatesKeyOrWritesData() {
        val store=Store();val keys=Keys();val vault=WorkspaceVault(store,keys)
        assertTrue(vault.list().items.isEmpty());assertEquals(0,keys.creates);assertEquals(0,store.writes)
    }
    @Test fun explicitSaveIsEncryptedAndSurvivesRepositoryRecreation() {
        val store=Store();val keys=Keys();val vault=WorkspaceVault(store,keys);val sample=item()
        vault.append(listOf(sample),"empty")
        assertFalse(String(store.bytes!!,Charsets.UTF_8).contains("private"));assertEquals(1,keys.creates)
        assertEquals(sample.messages,WorkspaceVault(store,keys).list().items.single().messages)
    }
    @Test fun randomIvPreventsIdenticalPlaintextCiphertextsAndTamperingFailsClosed() {
        val key=Keys().get(true);val plain=WorkspaceArchive.encode(listOf(item()))
        val a=VaultCipher.seal(plain,key);val b=VaultCipher.seal(plain,key)
        assertFalse(a.contentEquals(b));assertArrayEquals(plain,VaultCipher.open(a,key))
        a[a.lastIndex]=(a.last().toInt() xor 1).toByte();rejected {VaultCipher.open(a,key)}
    }
    @Test fun corruptOrLostKeyVaultCannotBeSilentlyOverwritten() {
        val store=Store();val keys=Keys();val vault=WorkspaceVault(store,keys)
        vault.append(listOf(item()),"empty");val original=store.bytes!!.copyOf();keys.erase()
        rejected {vault.list()};rejected {vault.append(listOf(item()),"empty")};assertArrayEquals(original,store.bytes);assertEquals(1,keys.creates)
        vault.eraseAll();assertNull(store.bytes);assertTrue(vault.list().items.isEmpty())
    }
    @Test fun staleSaveAndDeleteRevisionsNeverOverwriteOtherSnapshots() {
        val store=Store();val vault=WorkspaceVault(store,Keys());val first=item();val second=item()
        vault.append(listOf(first),"empty");val revision=vault.list().revision
        vault.append(listOf(second),revision)
        rejected {vault.delete(first.id,revision)};rejected {vault.append(listOf(item()),revision)}
        assertEquals(2,vault.list().items.size);vault.delete(first.id,vault.list().revision)
        assertEquals(second.id,vault.list().items.single().id)
    }
    @Test fun failedAtomicWriteKeepsPreviousData() {
        val store=Store();val vault=WorkspaceVault(store,Keys());val first=item();vault.append(listOf(first),"empty")
        store.fail=true;rejected {vault.append(listOf(item()),vault.list().revision)}
        assertEquals(first.id,vault.list().items.single().id)
    }
    @Test fun encryptedBackupRoundTripsButRejectsWrongPasswordTamperingAndFutureFormat() {
        val sample=item();val password="a long synthetic test password".toCharArray()
        val bytes=WorkspaceBackup.seal(listOf(sample),password)
        assertFalse(String(bytes,Charsets.UTF_8).contains("private"))
        assertEquals(sample.messages,WorkspaceBackup.open(bytes,password).single().messages)
        rejected {WorkspaceBackup.open(bytes,"wrong synthetic password".toCharArray())}
        val tampered=bytes.copyOf();tampered[20]=(tampered[20].toInt() xor 1).toByte();rejected {WorkspaceBackup.open(tampered,password)}
        val future=bytes.copyOf();future[3]=50;rejected {WorkspaceBackup.open(future,password)}
        rejected {WorkspaceBackup.seal(listOf(sample),"short".toCharArray())}
    }
    @Test fun restoreIsLocalAndSendStillNeedsNewConsentAndFullContextValidation() {
        val session=NativeChatConversation {0};val messages=item().messages
        session.restore(messages);assertFalse(session.busy);assertEquals(messages,session.messages())
        rejected {session.begin("next",false)}
        val reviewed=session.review("next");assertEquals(messages+NativeChatProtocol.Message("user","next"),reviewed)
        val longReply=listOf(NativeChatProtocol.Message("user","q"),NativeChatProtocol.Message("assistant","x".repeat(8000)))
        session.restore(longReply);assertEquals(longReply,session.messages());rejected {session.review("next")}
    }
    @Test fun restoreCannotOverwriteAnActiveTurnOrAdmitMalformedData() {
        val session=NativeChatConversation {0};val active=session.begin("q",true)
        rejected {session.restore(item().messages)};assertTrue(session.busy)
        session.stop();rejected {session.restore(listOf(NativeChatProtocol.Message("user","partial")))}
        assertTrue(session.messages().isEmpty());assertEquals(NativeChatConversation.Completion.STALE,session.complete(active,"late"))
    }
    @Test fun renameChangesOnlyTitleAndChecksArchiveRevision() {
        val store=Store();val vault=WorkspaceVault(store,Keys());val sample=item()
        vault.append(listOf(sample),"empty");val first=vault.list();vault.rename(sample.id,"New local name",first.revision)
        val renamed=vault.list().items.single()
        assertEquals("New local name",renamed.title);assertEquals(sample.id,renamed.id);assertEquals(sample.savedAt,renamed.savedAt)
        assertEquals(sample.messages,renamed.messages);assertEquals(sample.draft,renamed.draft);assertEquals(sample.code,renamed.code)
        rejected {vault.rename(sample.id,"Stale",first.revision)}
        rejected {vault.rename(sample.id,"bad\nname",vault.list().revision)}
        assertEquals("New local name",vault.list().items.single().title)
    }

}
