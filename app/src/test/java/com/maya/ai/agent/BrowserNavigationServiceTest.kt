package com.maya.ai.agent

import android.content.ComponentName
import android.content.pm.PackageManager
import android.view.accessibility.AccessibilityEvent
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RuntimeEnvironment
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk=[28,34])
class BrowserNavigationServiceTest {
    @Test fun newServiceIsSystemBoundAndOldAutosendStaysDisabled() {
        val app=RuntimeEnvironment.getApplication();val pm=app.packageManager
        val service=pm.getServiceInfo(ComponentName(app.packageName,BrowserNavigationService::class.java.name),PackageManager.GET_META_DATA)
        assertTrue(service.enabled);assertEquals("android.permission.BIND_ACCESSIBILITY_SERVICE",service.permission)
        val old=pm.getServiceInfo(ComponentName(app.packageName,"com.maya.ai.AutoSendService"),PackageManager.GET_DISABLED_COMPONENTS)
        assertFalse(old.enabled)
        val receiver=pm.getReceiverInfo(ComponentName(app.packageName,BrowserNavigationStopReceiver::class.java.name),0)
        assertFalse(receiver.exported)
    }
    @Test fun idleEventsDoNotStartTasksOrCollectReports() {
        val controller=Robolectric.buildService(BrowserNavigationService::class.java).create()
        try {
            val before=BrowserNavigationService.lastReport
            val event=AccessibilityEvent.obtain(AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED).apply {packageName="com.bank.private";text.add("PRIVATE_SYNTHETIC")}
            controller.get().onAccessibilityEvent(event);event.recycle()
            assertEquals(before,BrowserNavigationService.lastReport)
            assertFalse(controller.get().owned("a".repeat(32)))
        } finally {controller.destroy()}
    }
}
