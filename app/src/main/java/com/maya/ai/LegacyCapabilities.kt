package com.maya.ai

/** Compile-time quarantine, not a preference or JS-controlled trust switch.
 * New Chat, Talk, native dictation, vault and isolated Builder do not depend on these capabilities. */
object LegacyCapabilities {
    const val phoneActions = false
    const val notifications = false
    const val scheduledActions = false
    const val mediaAnalysis = false
    const val DISABLED = "Legacy capability retired. Use the reviewed native Maya workspace; no action was performed."
    val bridgeExports = setOf("appVersion", "legacyRestricted", "openUpdates", "setHaal", "markAlive", "webViewVersion",
        "stopSpeak", "fishTalkSpeak", "fishTalkEvent", "nativeWakeNotice", "wakeStatus", "listenOwned", "stopListen",
        "wakeService", "httpPostAsync", "cancelHttpPost", "setPref", "getPref", "getPrefString", "setPrefString",
        "clearPref", "micDoctor", "openSetting", "battery", "deviceBrand")
    fun trustedDocument(url: String?) = url in setOf("https://appassets.androidplatform.net/assets/web/index.html", "file:///android_asset/web/index.html")
    fun booleanSetting(key: String) = key in setOf("sukoon", "mic_near")
    fun stringSetting(key: String, value: String) = when(key) {
        "wake_lang" -> value in setOf("ur-PK", "hi-IN", "en-IN", "en-US")
        "mic_zoom" -> value.toDoubleOrNull()?.let {it.isFinite() && it in 0.0..1.0} == true && value.length<=16
        else -> false
    }
}
