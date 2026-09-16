package com.maya.ai.agent

import android.content.ComponentName
import android.content.pm.PackageManager
import android.view.accessibility.AccessibilityEvent
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(org.robolectric.RobolectricTestRunner::class)
@Config(sdk=[28,34])
class WhatsAppTypeServiceTest {
    @Test fun newServiceIsSystemBoundAndOldAutosendStaysDisabled() {
        val app=RuntimeEnvironment.getApplication();val pm=app.packageManager
        val service=pm.getServiceInfo(ComponentName(app.packageName,WhatsAppTypeService::class.java.name),PackageManager.GET_META_DATA)
        assertTrue(service.enabled);assertEquals("android.permission.BIND_ACCESSIBILITY_SERVICE",service.permission)
        val old=pm.getServiceInfo(ComponentName(app.packageName,"com.maya.ai.AutoSendService"),PackageManager.GET_DISABLED_COMPONENTS)
        assertFalse(old.enabled)
        val receiver=pm.getReceiverInfo(ComponentName(app.packageName,WhatsAppTypeStopReceiver::class.java.name),0)
        assertFalse(receiver.exported)
    }
    @Test fun idleEventsDoNotStartTasksOrCollectReports() {
        val controller=Robolectric.buildService(WhatsAppTypeService::class.java).create()
        try {
            val before=WhatsAppTypeService.lastReport
            val event=AccessibilityEvent.obtain(AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED).apply {packageName="com.bank.private";text.add("PRIVATE_SYNTHETIC")}
            controller.get().onAccessibilityEvent(event);event.recycle()
            assertEquals(before,WhatsAppTypeService.lastReport)
            assertFalse(controller.get().owned("a".repeat(32)))
        } finally {controller.destroy()}
    }
}
