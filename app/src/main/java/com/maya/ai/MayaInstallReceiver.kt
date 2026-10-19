package com.maya.ai

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.os.Build

/**
 * v5.13.1 — silent self-update ke baad ka safar (PackageInstaller session status):
 *
 *  • STATUS_SUCCESS              → "✅ update ho gayi" notification (tap = MAYA khule)
 *  • STATUS_PENDING_USER_ACTION  → normal install dialog (fallback — kabhi hang nahi)
 *  • STATUS_FAILURE              → chup-chaap; user ko purana dialog rasta hi milega
 *
 * Same-signature self-update (pin key) par Android dialog nahi dikhata —
 * ye receiver sirf safar mukammal karta hai.
 */
class MayaInstallReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)
        when (status) {
            PackageInstaller.STATUS_PENDING_USER_ACTION -> {
                try {
                    val confirm: Intent? = if (Build.VERSION.SDK_INT >= 33)
                        intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent::class.java)
                    else @Suppress("DEPRECATION") intent.getParcelableExtra(Intent.EXTRA_INTENT)
                    if (confirm != null) {
                        confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        context.startActivity(confirm)
                    }
                } catch (e: Exception) {}
            }
            PackageInstaller.STATUS_SUCCESS -> {
                try {
                    val nm = context.getSystemService(NotificationManager::class.java)
                    if (Build.VERSION.SDK_INT >= 26) {
                        nm.createNotificationChannel(NotificationChannel(
                            "maya_notifications", "MAYA Notifications",
                            NotificationManager.IMPORTANCE_DEFAULT))
                    }
                    val open = context.packageManager.getLaunchIntentForPackage(context.packageName)
                    val pi = if (open != null)
                        PendingIntent.getActivity(context, 9912, open,
                            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
                    else null
                    val n = androidx.core.app.NotificationCompat.Builder(context, "maya_notifications")
                        .setSmallIcon(R.mipmap.ic_launcher)
                        .setContentTitle("✅ MAYA update ho gayi")
                        .setContentText("Khud install ho gayi — tap kar ke kholein (settings safe)")
                        .setContentIntent(pi)
                        .setAutoCancel(true)
                        .build()
                    nm.notify(9913, n)
                } catch (e: Exception) {}
            }
            else -> { /* failure — kuch nahi; fallback dialog ka rasta mojood hai */ }
        }
    }
}
