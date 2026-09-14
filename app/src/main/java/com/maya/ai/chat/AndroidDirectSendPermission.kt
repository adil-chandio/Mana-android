package com.maya.ai.chat

import android.content.Context
import android.util.AtomicFile
import java.io.File

/** Tiny fixed consent record only. Excluded from Android cloud backup/device transfer. */
object AndroidDirectSendPermission {
    private val lock=Any()
    fun create(context: Context): DirectSendPermission {
        val file=AtomicFile(File(context.applicationContext.noBackupFilesDir,"direct-send-permission-v1"))
        return DirectSendPermission(object : DirectSendPermission.Store {
            override fun read(): String?=synchronized(lock) {
                if(!file.baseFile.exists() && !File(file.baseFile.path+".bak").exists()) null else file.openRead().use {input ->
                    val bytes=java.io.ByteArrayOutputStream()
                    repeat(513) {val b=input.read();if(b<0) return@use bytes.toString("UTF-8");bytes.write(b)}
                    error("INVALID_PERMISSION_RECORD")
                }
            }
            override fun write(value: String) {synchronized(lock) {
                require(value.isEmpty() || value==DirectSendPermission.POLICY)
                val output=file.startWrite()
                try {output.write(value.toByteArray(Charsets.UTF_8));file.finishWrite(output)}
                catch(e: Exception) {file.failWrite(output);throw e}
            }}
        })
    }
}
