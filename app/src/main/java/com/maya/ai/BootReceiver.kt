package com.maya.ai

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Compatibility receiver only. Saved preferences never authorize boot microphone capture. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) { /* No automatic service, action or Activity start. */ }
}
