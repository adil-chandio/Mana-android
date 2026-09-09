package com.maya.ai

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Phone restart hone par wake word khud ON ho jaye (agar ON tha) */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (Intent.ACTION_BOOT_COMPLETED == intent.action) {
            try {
                if (context.getSharedPreferences("maya", Context.MODE_PRIVATE)
                        .getBoolean("wake", false)) {
                    /* Issue 1 (LISTENER NEVER DIES): boot autostart restored.
                       The old black-screen culprit was auto-launching the app UI
                       (launchApp) — that engine was already removed from
                       WakeWordService. Starting ONLY the foreground mic service
                       is safe: BOOT_COMPLETED is an allowed background
                       foreground-service start on Android 12+. */
                    WakeWordService.start(context)
                }
            } catch (e: Exception) {}
        }
    }
}
