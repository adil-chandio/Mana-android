package com.maya.ai

import android.app.Notification
import android.content.Context
import android.os.Bundle
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.speech.tts.TextToSpeech
import org.json.JSONArray
import org.json.JSONObject
import java.util.Collections

/**
 * MAYA WhatsApp Reader (Phase 9)
 * Notifications padhti hai — Maya khud messages sunaati hai + REPLY kar sakti hai
 * (reply notification ke apne reply-action se — asli clean auto-reply!)
 */
class MayaNotifService : NotificationListenerService() {

    companion object {
        const val MAX = 20
        @JvmStatic
        var speakOn = false
        val buffer = Collections.synchronizedList(mutableListOf<JSONObject>())

        fun historyJson(): String {
            if(!LegacyCapabilities.notifications) return "[]"
            return try {
                val arr = JSONArray()
                synchronized(buffer) {
                    buffer.toList().takeLast(MAX).forEach { arr.put(it) }
                }
                arr.toString()
            } catch (e: Exception) { "[]" }
        }

        fun esc(s: String): String = s
            .replace("\\", "\\\\")
            .replace("'", "\\'")
            .replace("\"", "\\\"")
            .replace("\n", " ")
            .replace("\r", " ")

        fun clear() { synchronized(buffer) { buffer.clear() } }
    }

    private var tts: TextToSpeech? = null
    private var ttsReady = false

    override fun onCreate() {
        super.onCreate()
        clear();speakOn=false // Retired listener must not collect text or initialize device TTS.
    }

    override fun onDestroy() {
        try { tts?.stop(); tts?.shutdown() } catch (e: Exception) {}
        super.onDestroy()
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        if(!LegacyCapabilities.notifications) return
        if (sbn == null) return
        val pkg = sbn.packageName ?: return
        if (pkg != "com.whatsapp" && pkg != "com.whatsapp.w4b" && pkg != "com.telegram.messenger") return
        val n = sbn.notification ?: return
        val extras: Bundle = n.extras ?: return
        try {
            val from = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: return
            val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: ""
            if (from.isBlank() || text.isBlank()) return
            if (from.equals("WhatsApp", true) || from.equals("WhatsApp Business", true) || from.equals("Telegram", true)) return
            val hasReply = n.actions?.any { it.remoteInputs != null && it.remoteInputs.isNotEmpty() } == true
            val item = JSONObject()
                .put("app", if (pkg.startsWith("com.whatsapp")) "whatsapp" else "telegram")
                .put("from", from)
                .put("text", text.take(300))
                .put("time", android.text.format.DateFormat.format("HH:mm", System.currentTimeMillis()).toString())
                .put("canReply", hasReply)
            synchronized(buffer) {
                buffer.add(item)
                while (buffer.size > MAX) buffer.removeAt(0)
            }
            try {
                MainActivity.instance?.evalAsyncPublic("window.__notifIncoming && window.__notifIncoming('" + esc(from) + "')")
            } catch (e: Exception) {}
            if (speakOn && ttsReady) {
                try {
                    tts?.speak("$from ne kaha: $text", TextToSpeech.QUEUE_ADD, null, "maya_notif")
                } catch (e: Exception) {}
            }
        } catch (e: Exception) {}
    }
}
