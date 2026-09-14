package com.maya.ai.chat

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.AtomicFile
import java.io.File
import java.security.KeyStore
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey

/** noBackupFilesDir is excluded from Android cloud backup/device transfer. No external storage permission. */
object AndroidWorkspaceVault {
    private const val ALIAS="com.maya.ai.saved-workspaces.aes.v1"
    private val lock=Any()
    private var instance: WorkspaceVault?=null
    @Synchronized fun create(context: Context): WorkspaceVault {
        instance?.let {return it}
        val file=AtomicFile(File(context.applicationContext.noBackupFilesDir,"saved-workspaces-v1.enc"))
        return WorkspaceVault(object : WorkspaceVault.Storage {
            override fun read(): ByteArray?=synchronized(lock) {
                if(!file.baseFile.exists() && !File(file.baseFile.path+".bak").exists()) null
                else file.openRead().use {input ->
                    val bytes=java.io.ByteArrayOutputStream();val buffer=ByteArray(4096)
                    while(true) {val n=input.read(buffer);if(n<0) break;require(bytes.size()+n<=WorkspaceArchive.MAX_BYTES+32);bytes.write(buffer,0,n)}
                    bytes.toByteArray()
                }
            }
            override fun write(bytes: ByteArray) {synchronized(lock) {
                require(bytes.size<=WorkspaceArchive.MAX_BYTES+32)
                val output=file.startWrite()
                try {output.write(bytes);file.finishWrite(output)} catch(e: Exception) {file.failWrite(output);throw e}
            }}
            override fun erase() {synchronized(lock) {file.delete();check(!file.baseFile.exists() && !File(file.baseFile.path+".bak").exists())}}
        },object : WorkspaceVault.Keys {
            private fun store()=KeyStore.getInstance("AndroidKeyStore").apply {load(null)}
            override fun get(create: Boolean): SecretKey=synchronized(lock) {
                val existing=store().getKey(ALIAS,null)
                if(existing!=null) existing as SecretKey else {
                    check(create) {"VAULT_KEY_UNAVAILABLE"}
                    KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore").apply {
                        init(KeyGenParameterSpec.Builder(ALIAS,KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                            .setRandomizedEncryptionRequired(true).build())
                    }.generateKey()
                }
            }
            override fun erase() {synchronized(lock) {store().deleteEntry(ALIAS)}}
        }).also {instance=it}
    }
}
