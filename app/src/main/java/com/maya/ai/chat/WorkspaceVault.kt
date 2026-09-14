package com.maya.ai.chat

import java.security.MessageDigest
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.SecretKey
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec

/** Single atomic encrypted archive. Reads never create keys; unreadable data is never silently overwritten. */
class WorkspaceVault(private val storage: Storage,private val keys: Keys) {
    interface Storage {fun read(): ByteArray?;fun write(bytes: ByteArray);fun erase()}
    interface Keys {fun get(create: Boolean): SecretKey;fun erase()}
    class Listing(val items: List<SavedWorkspace>,val revision: String) {override fun toString()="VaultListing(redacted)"}
    @Synchronized fun list(): Listing {
        val encrypted=storage.read() ?: return Listing(emptyList(),"empty")
        val plain=VaultCipher.open(encrypted,keys.get(false))
        return try {Listing(WorkspaceArchive.decode(plain),fingerprint(encrypted))} finally {plain.fill(0)}
    }
    @Synchronized fun append(items: List<SavedWorkspace>,expectedRevision: String) {
        val current=list();require(current.revision==expectedRevision)
        require(items.isNotEmpty())
        write(current.items+items)
    }
    @Synchronized fun delete(id: String,expectedRevision: String) {
        val current=list();require(current.revision==expectedRevision && current.items.any {it.id==id})
        write(current.items.filterNot {it.id==id})
    }
    @Synchronized fun rename(id: String,title: String,expectedRevision: String) {
        val current=list();require(current.revision==expectedRevision)
        val item=current.items.single {it.id==id}
        val renamed=SavedWorkspace(item.id,title,item.savedAt,item.messages,item.draft,item.code)
        WorkspaceArchive.validate(renamed)
        write(current.items.map {if(it.id==id) renamed else it})
    }
    private fun write(items: List<SavedWorkspace>) {
        val plain=WorkspaceArchive.encode(items)
        try {storage.write(VaultCipher.seal(plain,keys.get(true)))} finally {plain.fill(0)}
    }
    /** Explicit destructive local reset, also usable for a corrupt/lost-key vault. Not provider deletion. */
    @Synchronized fun eraseAll() {keys.erase();storage.erase()}
    companion object {
        fun fingerprint(bytes: ByteArray)=MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") {"%02x".format(it)}
    }
}

object VaultCipher {
    private val aad="Maya local workspace vault v1".toByteArray(Charsets.UTF_8)
    private val magic=byteArrayOf(77,86,49,0)
    fun seal(plain: ByteArray,key: SecretKey): ByteArray {
        require(plain.size<=WorkspaceArchive.MAX_BYTES)
        val cipher=Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE,key);cipher.updateAAD(aad)
        require(cipher.iv.size==12)
        return magic+cipher.iv+cipher.doFinal(plain)
    }
    fun open(encrypted: ByteArray,key: SecretKey): ByteArray {
        require(encrypted.size in 32..WorkspaceArchive.MAX_BYTES+32 && encrypted.copyOfRange(0,4).contentEquals(magic))
        val cipher=Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE,key,GCMParameterSpec(128,encrypted.copyOfRange(4,16)));cipher.updateAAD(aad)
        return cipher.doFinal(encrypted,16,encrypted.size-16)
    }
}

/** Separate portable backup key; the AndroidKeyStore key and credentials are NEVER exported. */
object WorkspaceBackup {
    private val magic=byteArrayOf(77,87,66,49)
    const val MAX_BYTES=WorkspaceArchive.MAX_BYTES+48
    private fun key(password: CharArray,salt: ByteArray): SecretKey {
        require(password.size in 12..128)
        val spec=PBEKeySpec(password,salt,210000,256)
        return try {val bytes=SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).encoded
            try {SecretKeySpec(bytes,"AES")} finally {bytes.fill(0)}
        } finally {spec.clearPassword()}
    }
    fun seal(items: List<SavedWorkspace>,password: CharArray): ByteArray {
        val plain=WorkspaceArchive.encode(items);val salt=ByteArray(16).also {SecureRandom().nextBytes(it)}
        return try {
            val cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key(password,salt))
            cipher.updateAAD(magic+salt);require(cipher.iv.size==12)
            magic+salt+cipher.iv+cipher.doFinal(plain)
        } finally {plain.fill(0)}
    }
    fun open(bytes: ByteArray,password: CharArray): List<SavedWorkspace> {
        require(bytes.size in 48..MAX_BYTES && bytes.copyOfRange(0,4).contentEquals(magic))
        val salt=bytes.copyOfRange(4,20)
        val cipher=Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE,key(password,salt),GCMParameterSpec(128,bytes.copyOfRange(20,32)))
        cipher.updateAAD(magic+salt)
        val plain=cipher.doFinal(bytes,32,bytes.size-32)
        return try {WorkspaceArchive.decode(plain)} finally {plain.fill(0)}
    }
}
