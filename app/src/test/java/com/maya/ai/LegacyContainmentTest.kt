package com.maya.ai

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.app.Notification
import android.os.UserHandle
import android.service.notification.StatusBarNotification
import android.webkit.JavascriptInterface
import androidx.core.content.FileProvider
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

/** Negative capability tests: no real accessibility, notification access, network or microphone. */
@RunWith(org.robolectric.RobolectricTestRunner::class)
@Config(sdk=[28,34])
class LegacyContainmentTest {
    private val app get()=RuntimeEnvironment.getApplication()
    @Test fun onlyReviewedBridgeMethodsAreExposed() {
        val exposed=MainActivity.MayaBridge::class.java.declaredMethods.filter {it.isAnnotationPresent(JavascriptInterface::class.java)}.map {it.name}.toSet()
        assertEquals(LegacyCapabilities.bridgeExports,exposed)
        for(name in listOf("autoCall","openWhatsAppDraft","notifReply","uiDump","mayaAct","scheduleTask","takePhoto","pickImage","httpBytes","httpGet","httpPost","speak","edgeTts","shareFile")) assertFalse(name,exposed.contains(name))
    }
    @Test fun manifestDisablesLegacyReceiversAndServicesAndRemovesDuplicateLaunchers() {
        val pm=app.packageManager;val flags=PackageManager.GET_DISABLED_COMPONENTS
        for(name in listOf("AutoSendService","MayaNotifService")) {
            val info=pm.getServiceInfo(android.content.ComponentName(app.packageName,"com.maya.ai.$name"),flags)
            assertFalse(info.enabled)
        }
        for(name in listOf("ScheduledReceiver","BootReceiver")) assertFalse(pm.getReceiverInfo(android.content.ComponentName(app.packageName,"com.maya.ai.$name"),flags).enabled)
        for(name in listOf("chat.NativeChatActivity","agent.ResearchActivity")) assertFalse(pm.getActivityInfo(android.content.ComponentName(app.packageName,"com.maya.ai.$name"),flags).exported)
        val launches=pm.queryIntentActivities(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER).setPackage(app.packageName),0)
        assertEquals(setOf("com.maya.ai.MainActivity","com.maya.ai.update.UpdateActivity"),launches.map {it.activityInfo.name}.toSet())
    }
    @Test fun onlySevenCurrentlyNeededPermissionsAreDeclared() {
        val requested=app.packageManager.getPackageInfo(app.packageName,PackageManager.GET_PERMISSIONS).requestedPermissions.toSet()
        val expected=setOf("INTERNET","RECORD_AUDIO","POST_NOTIFICATIONS","WAKE_LOCK","FOREGROUND_SERVICE","FOREGROUND_SERVICE_MICROPHONE","REQUEST_INSTALL_PACKAGES").map {"android.permission.$it"}.toSet()
        assertTrue(requested.containsAll(expected))
        val retired=setOf("CALL_PHONE","READ_CONTACTS","SET_ALARM","RECEIVE_BOOT_COMPLETED","READ_EXTERNAL_STORAGE","READ_MEDIA_IMAGES","READ_MEDIA_VIDEO","READ_MEDIA_AUDIO","WRITE_SETTINGS","SCHEDULE_EXACT_ALARM","REQUEST_IGNORE_BATTERY_OPTIMIZATIONS")
        assertTrue(requested.none {it.removePrefix("android.permission.") in retired})
    }
    @Test fun pendingAutosendAndRawActionsCannotBeReactivatedByOldPreferences() {
        app.getSharedPreferences("maya",Context.MODE_PRIVATE).edit().putLong("autosend_at",Long.MAX_VALUE).putBoolean("trustMode",true).commit()
        assertFalse(AutoSendService.pending(app))
        val result=JSONObject(MayaAct.enqueue(app,JSONObject().put("action","tap").put("find","Send")))
        assertFalse(result.getBoolean("ok"));assertFalse(MayaAct.hasPendingActions())
        assertEquals(LegacyCapabilities.DISABLED,result.getString("why"))
    }
    @Test fun screenReadsAndGesturesStayDeniedEvenIfServiceObjectExists() {
        val c=Robolectric.buildService(AutoSendService::class.java).create();val service=c.get()
        try {
            assertFalse(JSONObject(service.dumpScreen(50)).getBoolean("ok"));assertEquals("",service.screenSig());assertNull(service.findByText("PRIVATE",0))
            var success=true;service.tapAt(1f,1f) {success=it};assertFalse(success)
            service.globalBack {success=it};assertFalse(success)
        } finally {c.destroy()}
    }
    @Test fun notificationServiceNeitherInitializesTtsNorCollectsIncomingText() {
        val c=Robolectric.buildService(MayaNotifService::class.java).create();val service=c.get()
        try {
            MayaNotifService.speakOn=true
            val notification=Notification.Builder(app).setContentTitle("Synthetic sender").setContentText("PRIVATE_SYNTHETIC_MESSAGE").build()
            service.onNotificationPosted(StatusBarNotification("com.whatsapp","com.whatsapp",1,null,1000,1,notification,android.os.Process.myUserHandle(),null,0))
            assertEquals("[]",MayaNotifService.historyJson());assertTrue(MayaNotifService.buffer.isEmpty())
            assertNull(MayaNotifService::class.java.getDeclaredField("tts").apply {isAccessible=true}.get(service))
        } finally {MayaNotifService.speakOn=false;c.destroy()}
    }
    @Test fun schedulingIsDeniedAndNativePreferenceSchemaCannotStoreAuthority() {
        assertFalse(ScheduledReceiver.schedule(app,"untrusted",1))
        assertFalse(LegacyCapabilities.booleanSetting("trustMode"));assertFalse(LegacyCapabilities.booleanSetting("wake"))
        assertFalse(LegacyCapabilities.stringSetting("autosend_at","99999"));assertFalse(LegacyCapabilities.stringSetting("mic_zoom","NaN"))
        assertTrue(LegacyCapabilities.stringSetting("mic_zoom","0"));assertTrue(LegacyCapabilities.stringSetting("wake_lang","ur-PK"))
    }
    @Test fun generalFileProviderCannotGrantTheWholeCacheOrUpdateDirectory() {
        try {FileProvider.getUriForFile(app,app.packageName+".fileprovider",java.io.File(app.cacheDir,"updates/synthetic.apk"));fail("Broad cache URI allowed")}
        catch(_: IllegalArgumentException) {}
    }
    @Test fun onlyExactPackagedDocumentsAreTrusted() {
        assertTrue(LegacyCapabilities.trustedDocument("https://appassets.androidplatform.net/assets/web/index.html"))
        assertTrue(LegacyCapabilities.trustedDocument("file:///android_asset/web/index.html"))
        for(url in listOf("file:///sdcard/evil.html","http://appassets.androidplatform.net/assets/web/index.html","https://appassets.androidplatform.net/other.html",null)) assertFalse(LegacyCapabilities.trustedDocument(url))
    }
}
