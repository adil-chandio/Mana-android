package com.maya.ai

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** MAYA Scheduler (Phase 9) — time par khud kaam */
class ScheduledReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if(!LegacyCapabilities.scheduledActions) return
        val id = intent.getStringExtra("id") ?: return
        try {
            val act = MainActivity.instance
            if (act != null) act.evalAsyncPublic("window.__taskDue && window.__taskDue('$id')")
            else {
                // App band? notification se yaad dila do
                try {
                    val pi = PendingIntent.getActivity(
                        context, 0,
                        Intent(context, MainActivity::class.java),
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                    )
                    val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
                    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                        nm.createNotificationChannel(
                            android.app.NotificationChannel("maya_tasks", "MAYA Tasks", android.app.NotificationManager.IMPORTANCE_HIGH)
                        )
                    }
                    val notif = androidx.core.app.NotificationCompat.Builder(context, "maya_tasks")
                        .setSmallIcon(android.R.drawable.ic_dialog_info)
                        .setContentTitle("MAYA Reminder")
                        .setContentText("MAYA ka scheduled kaam due hai — app kholo")
                        .setAutoCancel(true)
                        .setContentIntent(pi)
                        .build()
                    nm.notify(id.hashCode(), notif)
                } catch (e: Exception) {}
            }
        } catch (e: Exception) {}
    }

    companion object {
        fun schedule(ctx: Context, id: String, delayMs: Long): Boolean {
            if(!LegacyCapabilities.scheduledActions) return false
            return try {
                val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
                val pi = PendingIntent.getBroadcast(
                    ctx, id.hashCode(),
                    Intent(ctx, ScheduledReceiver::class.java).putExtra("id", id),
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, System.currentTimeMillis() + delayMs, pi)
                true
            } catch (e: Exception) { false }
        }
    }
}
