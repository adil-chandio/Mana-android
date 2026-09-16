package com.maya.ai

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.app.Activity
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.media.AudioManager
import android.provider.Settings
import android.net.Uri
import android.provider.ContactsContract
import android.provider.MediaStore

import android.annotation.SuppressLint
import android.content.pm.PackageManager
import android.os.BatteryManager
import android.util.Base64
import android.os.Build
import android.os.Bundle
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.AlarmClock
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.view.WindowManager
import android.webkit.JavascriptInterface
import androidx.webkit.WebResourceErrorCompat
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import androidx.webkit.WebViewCompat
import org.json.JSONArray
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import org.json.JSONObject
import java.util.Locale

/**
 * MAYA — Personal AI (Phase 2: Native APK)
 * WebView shell + native bridge:
 *  - Native STT (SpeechRecognizer — real Urdu/Hindi/English voice input)
 *  - Native TTS (system engine — proper Urdu voice support)
 *  - REAL system alarms & timers (AlarmClock intents)
 *  - Notifications, vibration, battery status, keep-screen-on
 */
class MainActivity : AppCompatActivity() {

    companion object {
        const val VIRTUAL_HOST = "appassets.androidplatform.net"
        const val CHANNEL_ID = "maya_notifications"
        const val REQ_PERMS = 7001
        var instance: MainActivity? = null
    }

    private lateinit var webView: WebView
    private lateinit var mainSurface: android.widget.FrameLayout
    private var nativeChat: com.maya.ai.chat.NativeChatWorkspace? = null
    private var nativeChatView: android.view.View? = null
    @Volatile private var mainResumed = false
    @Volatile private var voiceHostTrusted = false
    private lateinit var assetLoader: WebViewAssetLoader
    @Volatile private var webViewAlive = false
    @Volatile private var workspaceSettingsOpen=false
    private var workspaceHostReady=false
    private var hostLoadEpoch=0L
    @Volatile private var hostPresentationEpoch=0L
    private var hostMountEpoch=0L
    private val hostHandler=android.os.Handler(Looper.getMainLooper())
    private var hostDeadline: Runnable?=null
    private var hostFailed=false
    private var hostFallbackUsed=false
    private fun cancelHostDeadline() {hostDeadline?.let {hostHandler.removeCallbacks(it)};hostDeadline=null}
    private fun failWorkspaceHost() {
        voiceHostTrusted=false
        cancelHostDeadline();hostLoadEpoch++;hostPresentationEpoch++;hostMountEpoch++;hostFailed=true;workspaceHostReady=false
        webView.visibility=android.view.View.INVISIBLE
        nativeChat?.hostPresentationState(false,true)
    }
    private fun armHostDeadline() {
        cancelHostDeadline()
        val load=hostLoadEpoch;val presentation=hostPresentationEpoch
        hostDeadline=Runnable {if(!isFinishing && !isDestroyed && load==hostLoadEpoch && presentation==hostPresentationEpoch) failWorkspaceHost()}
            .also {hostHandler.postDelayed(it,8000)}
    }
    private fun beginWorkspaceHostLoad() {
        voiceHostTrusted=false
        hostLoadEpoch++;hostPresentationEpoch++;hostMountEpoch++;workspaceHostReady=false;hostFailed=false
        webView.visibility=android.view.View.INVISIBLE
        nativeChat?.hostPresentationState(true,false);armHostDeadline()
    }
    /** Explicit confirmed native retry only; no bridge method, data wipe, navigation or automatic loop. */
    fun retryWorkspaceHost(): Boolean {
        if(!hostFailed || !mainResumed || isFinishing || isDestroyed || composerMicLease!=null || recognitionActive ||
            httpRequests.isNotEmpty() || tts?.isSpeaking==true ||
            com.maya.ai.chat.NativeChatReadiness.runtime(getSharedPreferences("maya",0).getBoolean("wake",false),
                WakeWordService.instance!=null,WakeWordService.fishOutputActive,WakeWordService.haal,MayaAct.hasPendingActions())!=com.maya.ai.chat.NativeChatReadiness.Reason.READY) return false
        hostFallbackUsed=false;beginWorkspaceHostLoad()
        try {webView.stopLoading();webView.loadUrl("https://$VIRTUAL_HOST/assets/web/index.html")} catch(_: Exception) {failWorkspaceHost()}
        return true
    }
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    @Volatile private var ttsBooting = false
    /* v5.9.5: silent-TTS guard — jab tak pehli asli speech start na ho,
       engine "shak wale" haal mein maana jata hai; koi bhi bol de to clear. */
    @Volatile private var ttsEverSpoke = false
    private var recognizer: SpeechRecognizer? = null
    // Object allocation is not proof of an active recognition session.
    private var recognitionActive = false
    private var composerMicLease: Any?=null
    private var speechGeneration = 0L
    @Volatile private var httpClosed = false
    private val httpDeadlines = java.util.concurrent.Executors.newSingleThreadScheduledExecutor()
    private val httpRequests = java.util.concurrent.ConcurrentHashMap<String, com.maya.ai.net.CancelableRequest>()
    private var fishPlayer: com.maya.ai.voice.FishStreamPlayer? = null
    @Volatile private var fishTalkId: String?=null
    private val fishTalkRequests=java.util.concurrent.ConcurrentHashMap<String,Boolean>()
    private var fishTalkLastSpoken=0
    private var talkPlayer: com.maya.ai.voice.FishStreamPlayer?=null
    private var fishTalkDeadline: Runnable?=null
    private var fishTalkEvents=com.maya.ai.voice.FishTalkProtocol.Events()
    fun prepareFishTalk(done: (String?)->Unit) {
        if(!voiceForeground() || composerMicLease!=null || recognitionActive || httpRequests.isNotEmpty() || WakeWordService.fishOutputActive || MayaAct.hasPendingActions()) {done(null);return}
        val presentation=hostPresentationEpoch
        var answered=false
        val timeout=Runnable {if(!answered) {answered=true;done(null)}}
        hostHandler.postDelayed(timeout,1500)
        try {webView.evaluateJavascript("window.FISH_TALK ? FISH_TALK.describe() : null") {raw ->
            if(!answered) {answered=true;hostHandler.removeCallbacks(timeout);done(if(voiceForeground() && presentation==hostPresentationEpoch) raw else null)}
        }} catch(_: Exception) {if(!answered) {answered=true;hostHandler.removeCallbacks(timeout);done(null)}}
    }
    fun startFishTalk(review: String,done: (Boolean)->Unit) {
        if(!voiceForeground() || fishTalkId!=null || composerMicLease!=null || recognitionActive || httpRequests.isNotEmpty() || WakeWordService.fishOutputActive || MayaAct.hasPendingActions() || !Regex("review[0-9]{1,12}").matches(review)) {done(false);return}
        if(ContextCompat.checkSelfPermission(this,Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED) {requestMicPermission();done(false);return}
        val id=java.util.UUID.randomUUID().toString().replace("-","")
        fishTalkRequests.clear();fishTalkLastSpoken=0;fishTalkId=id;fishTalkEvents=com.maya.ai.voice.FishTalkProtocol.Events()
        WakeWordService.stop(this) // Runtime pause only; saved Wake/Fish/AI choices are untouched.
        fishTalkDeadline=Runnable {if(fishTalkId==id) {stopFishTalk();nativeChat?.fishTalkEnded("Fish conversation reached its 5-minute limit.")}}.also {hostHandler.postDelayed(it,300000)}
        var answered=false
        val timeout=Runnable {if(!answered) {answered=true;if(fishTalkId==id) stopFishTalk();done(false)}}
        hostHandler.postDelayed(timeout,2000)
        try {webView.evaluateJavascript("FISH_TALK.start('$id','$review')") {raw ->
            if(!answered) {answered=true;hostHandler.removeCallbacks(timeout)
                val ok=voiceForeground() && fishTalkId==id && raw=="true"
                if(!ok && fishTalkId==id) stopFishTalk()
                done(ok)
            }
        }} catch(_: Exception) {if(!answered) {answered=true;hostHandler.removeCallbacks(timeout);stopFishTalk();done(false)}}
    }
    fun stopFishTalk() {
        val id=fishTalkId ?: return
        fishTalkId=null;fishTalkDeadline?.let {hostHandler.removeCallbacks(it)};fishTalkDeadline=null
        stopRecognizer();talkPlayer?.stop();talkPlayer=null
        httpRequests.keys.filter {it.startsWith("ft_${id}_")}.forEach {httpRequests.remove(it)?.cancel()}
        evalAsync("if(window.FISH_TALK) FISH_TALK.stop('$id','STOPPED')")
    }

    /* ================= LIFECYCLE ================= */

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        instance = this

        assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView = WebView(this)
        webView.setBackgroundColor(0xFF050B14.toInt())
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            allowUniversalAccessFromFileURLs = false
            allowFileAccessFromFileURLs = false
            /* v4.0.1 WebView compat: file:// fallback + old-engine safety */
            allowFileAccess = false // android_asset remains available for the exact packaged fallback.
            allowContentAccess = false
            javaScriptCanOpenWindowsAutomatically = false
            loadWithOverviewMode = true
            useWideViewPort = true
            setSupportZoom(false)
            cacheMode = WebSettings.LOAD_DEFAULT
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            textZoom = 100
        }
        webView.addJavascriptInterface(MayaBridge(), "MayaBridge")
        webView.webChromeClient = object : android.webkit.WebChromeClient() {
            override fun onConsoleMessage(msg: android.webkit.ConsoleMessage): Boolean {
                val t = msg.message() ?: ""
                if (msg.messageLevel() == android.webkit.ConsoleMessage.MessageLevel.ERROR && t.isNotBlank()) {
                    evalAsync("window.__consoleErr && window.__consoleErr('" +
                        t.replace("\\", "\\\\").replace("'", "\\'").replace("\n", " ").replace("\r", " ") + "')")
                }
                return true
            }
        }
        webView.webViewClient = MayaWebViewClient()
        // One permanent Maya surface from startup. The original trusted WebView is
        // an embedded orb/settings component, never a second conversation or destination.
        webView.setBackgroundColor(com.maya.ai.chat.MayaTheme.background)
        webView.visibility = android.view.View.INVISIBLE
        mainSurface = android.widget.FrameLayout(this)
        val workspace = com.maya.ai.chat.NativeChatWorkspace(this) { finish() }
        nativeChat = workspace
        nativeChatView = workspace.createView(webView) { expanded ->
            workspaceSettingsOpen=expanded
            applyWorkspacePresentation()
        }
        mainSurface.addView(nativeChatView, android.widget.FrameLayout.LayoutParams(-1, -1))
        setContentView(mainSurface)
        beginWorkspaceHostLoad()
        webView.loadUrl("https://$VIRTUAL_HOST/assets/web/index.html")
        Toast.makeText(this, "MAYA " + BuildConfig.VERSION_NAME + " • Main workspace", Toast.LENGTH_LONG).show()
        webViewAlive = false
        // v4.0.1: PURANA Android System WebView detect — layout (inset/color-mix) kharab ho sakta hai
        val wvVer = try { WebViewCompat.getCurrentWebViewPackage(this)?.versionName ?: "" } catch (e: Exception) { "" }
        val wvMajor = wvVer.split(".").firstOrNull()?.toIntOrNull() ?: 0
        android.os.Handler(Looper.getMainLooper()).postDelayed({
            if (wvMajor in 1..86) {
                Toast.makeText(this, "Purana WebView (Chrome $wvMajor) — Play Store se 'Android System WebView' update karo, warna layout kharab ho sakta hai", Toast.LENGTH_LONG).show()
            }
        }, 12000)

        // Fish-only native output: no legacy device-TTS engine starts with the app.
        createNotificationChannel()
        // Permissions are requested by explicit feature actions, not by opening text Chat.
        // Saved Wake is a preference, not authority to start capture on app launch.
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if(requestCode in setOf(5001,5002)) toast("Legacy media analysis is retired. No image was read or uploaded.")
    }

    override fun onDestroy() {
        cancelHostDeadline();hostLoadEpoch++;hostPresentationEpoch++
        nativeChat?.dispose(); nativeChat = null; nativeChatView = null
        httpClosed = true
        httpDeadlines.shutdownNow()
        httpRequests.values.forEach { it.cancel() }; httpRequests.clear()
        fishPlayer?.stop(); fishPlayer = null
        instance = null
        stopRecognizer()
        try { tts?.stop(); tts?.shutdown() } catch (e: Exception) {}
        super.onDestroy()
    }

    @Suppress("DEPRECATION")
    override fun onBackPressed() {
        nativeChat?.let { it.requestClose(); return }
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    /** Compatibility URI now focuses the EXISTING composer only. No root replacement/navigation. */
    private fun openMainChat() {
        if (mainResumed && !isFinishing && !isDestroyed) nativeChat?.focusComposer()
    }
    override fun onResume() { super.onResume(); mainResumed = true; nativeChat?.resume() }
    override fun onPause() { mainResumed = false;
        stopFishTalk();WakeWordService.stop(this);stopRecognizer()
        evalAsync("if(typeof KAAN!=='undefined')KAAN.DARWAZA.close();if(typeof stopListening==='function')stopListening();if(typeof AWAAZ!=='undefined')AWAAZ.stop();")
        hostPresentationEpoch++;cancelHostDeadline();webView.visibility=android.view.View.INVISIBLE; nativeChat?.pause(); super.onPause() }
    override fun onStop() { nativeChat?.leaveScreen(); super.onStop() }
    override fun onWindowFocusChanged(hasFocus: Boolean) { super.onWindowFocusChanged(hasFocus); nativeChat?.focusChanged(hasFocus) }
    override fun dispatchTouchEvent(event: android.view.MotionEvent): Boolean {
        if (nativeChat?.consumeTouch(event) == true) return true
        return super.dispatchTouchEvent(event)
    }

    fun voiceForeground(): Boolean = mainResumed && voiceHostTrusted && !isFinishing && !isDestroyed

    /** Only called by the native, owner-confirmed input dialog; no JS bridge export. */
    fun turnOffLegacyWakeForNativeVoice(done: (Boolean)->Unit) {
        if(!voiceForeground()) {done(false);return}
        try {
            WakeWordService.stop(this)
            if(!prefs().edit().putBoolean("wake",false).commit()) {done(false);return}
            webView.evaluateJavascript("(function(){try{if(typeof settings!=='object'||typeof saveSettings!=='function')return false;settings.wakeWord=false;saveSettings();var sw=document.getElementById('sWake');if(sw)sw.checked=false;if(typeof KAAN!=='undefined')KAAN.DARWAZA.close();return settings.wakeWord===false;}catch(e){return false;}})()") {value ->
                android.os.Handler(Looper.getMainLooper()).postDelayed({
                    done(voiceForeground() && value=="true" && !prefs().getBoolean("wake",true) && WakeWordService.instance==null)
                },300)
            }
        } catch(_: Exception) {done(false)}
    }

    /** Native-only microphone lease. Never exported through MayaBridge or persisted. */
    fun acquireComposerMicrophone(token: Any): Boolean {
        if(composerMicLease!=null || !mainResumed || isFinishing || isDestroyed || recognitionActive ||
            httpRequests.isNotEmpty() || tts?.isSpeaking==true || webView.url !in listOf("https://$VIRTUAL_HOST/assets/web/index.html","file:///android_asset/web/index.html")) return false
        composerMicLease=token;return true
    }
    fun composerMicrophoneCurrent(token: Any)=composerMicLease===token && mainResumed && !isFinishing && !isDestroyed &&
        !recognitionActive && httpRequests.isEmpty() && tts?.isSpeaking!=true
    fun releaseComposerMicrophone(token: Any) {if(composerMicLease===token) composerMicLease=null}

    /** Read-only local readiness; no preference writes, service starts or remote page evaluation. */
    fun nativeChatReady(result: (com.maya.ai.chat.NativeChatReadiness.Reason) -> Unit) = nativeReady(false,result)
    fun nativeConfiguredReady(result: (com.maya.ai.chat.NativeChatReadiness.Reason) -> Unit) {
        val policy=com.maya.ai.chat.NativeChatReadiness
        val runtime=policy.runtime(false,WakeWordService.instance!=null,WakeWordService.fishOutputActive,WakeWordService.haal,MayaAct.hasPendingActions())
        if(runtime!=com.maya.ai.chat.NativeChatReadiness.Reason.READY) {result(runtime);return}
        nativeReady(true,result)
    }
    private fun nativeReady(idleOnly: Boolean,result: (com.maya.ai.chat.NativeChatReadiness.Reason) -> Unit) {
        val policy = com.maya.ai.chat.NativeChatReadiness
        try {
            val state = policy.main(!mainResumed || isFinishing || isDestroyed, httpRequests.isNotEmpty(), recognitionActive || composerMicLease!=null,
                tts?.isSpeaking == true, webView.url in listOf(
                    "https://$VIRTUAL_HOST/assets/web/index.html", "file:///android_asset/web/index.html"))
            if (state != com.maya.ai.chat.NativeChatReadiness.Reason.READY) { result(state); return }
            webView.evaluateJavascript(if(idleOnly) policy.IDLE_SCRIPT else policy.LOCAL_SCRIPT) { result(policy.fromJavascript(it)) }
        } catch (_: Exception) { result(com.maya.ai.chat.NativeChatReadiness.Reason.UNKNOWN) }
    }

    fun prepareConfiguredChat(wanted: ()->Boolean, pauseWake: Boolean, done: (com.maya.ai.chat.ConfiguredChatPolicy.Config?,String)->Unit) {
        if(!wanted()) return
        val presentation=hostPresentationEpoch
        var answered=false
        lateinit var timeout: Runnable
        fun finish(config: com.maya.ai.chat.ConfiguredChatPolicy.Config?,code: String) {
            if(answered) return
            answered=true;hostHandler.removeCallbacks(timeout)
            if(wanted()) {
                if(presentation==hostPresentationEpoch) done(config,code) else done(null,"MAIN_TRANSITION")
            }
        }
        timeout=Runnable {finish(null,"LOCAL_CONFIG_TIMEOUT")};hostHandler.postDelayed(timeout,1800)
        fun read() {
            if(!wanted() || !voiceForeground() || presentation!=hostPresentationEpoch) {finish(null,"MAIN_TRANSITION");return}
            try {webView.evaluateJavascript("window.FISH_TALK ? FISH_TALK.chatConfig() : null") {raw ->
                val config=com.maya.ai.chat.ConfiguredChatPolicy.decode(raw)
                finish(config,if(config==null) "CONFIGURED_AI_UNAVAILABLE" else "READY")
            }} catch(_: Exception) {finish(null,"LOCAL_CONFIG_UNAVAILABLE")}
        }
        if(pauseWake) {
            WakeWordService.stop(this) // Explicit manual-Send permission pauses runtime wake, not its saved preference.
            hostHandler.postDelayed({
                if(!wanted() || answered) return@postDelayed
                nativeConfiguredReady {reason ->
                    if(reason==com.maya.ai.chat.NativeChatReadiness.Reason.READY) read() else finish(null,"READINESS_"+reason.name)
                }
            },300)
        } else read()
    }

    /** Explicit native Sunao/setup only. No JS bridge method, key export UI or preference writes. */
    fun prepareNativeFish(text: String?, wanted: () -> Boolean, result: (com.maya.ai.chat.NativeFishPolicy.Result) -> Unit) {
        val policy = com.maya.ai.chat.NativeFishPolicy
        fun unavailable() = result(com.maya.ai.chat.NativeFishPolicy.Result.Error(com.maya.ai.chat.NativeFishPolicy.Code.UNAVAILABLE))
        if (!wanted()) return
        nativeConfiguredReady { ready ->
            if (!wanted()) return@nativeConfiguredReady
            if (ready != com.maya.ai.chat.NativeChatReadiness.Reason.READY) {
                result(com.maya.ai.chat.NativeFishPolicy.Result.Error(com.maya.ai.chat.NativeFishPolicy.Code.ASSISTANT_BUSY))
            } else try {
                if (isFinishing || isDestroyed || webView.url !in listOf(
                        "https://$VIRTUAL_HOST/assets/web/index.html", "file:///android_asset/web/index.html")) {
                    unavailable(); return@nativeConfiguredReady
                }
                webView.evaluateJavascript(policy.script(text,true)) { raw ->
                    if (!wanted()) return@evaluateJavascript
                    try {
                        if (instance !== this || isFinishing || isDestroyed || httpRequests.isNotEmpty() || recognitionActive ||
                            tts?.isSpeaking == true || webView.url !in listOf(
                                "https://$VIRTUAL_HOST/assets/web/index.html", "file:///android_asset/web/index.html")) unavailable()
                        else result(policy.decode(raw, text != null))
                    } catch (_: Exception) { unavailable() }
                }
            } catch (_: Exception) { unavailable() }
        }
    }

    /** Presentation handshake only; no conversation/code/settings credentials enter JS. */
    private fun applyWorkspacePresentation() {
        if(!mainResumed || hostFailed) return
        if(!workspaceHostReady) {nativeChat?.hostPresentationState(true,false);armHostDeadline();return}
        val url=webView.url
        if(url !in listOf("https://$VIRTUAL_HOST/assets/web/index.html", "file:///android_asset/web/index.html")) {failWorkspaceHost();return}
        val ticket=hostLoadEpoch;val presentationTicket=++hostPresentationEpoch;val expanded=workspaceSettingsOpen
        webView.visibility=android.view.View.INVISIBLE
        nativeChat?.hostPresentationState(true,false);armHostDeadline()
        var answered=false
        try {webView.evaluateJavascript("window.__mayaWorkspaceSettings ? window.__mayaWorkspaceSettings($expanded) : false;") {applied ->
            if(!isFinishing && !isDestroyed && mainResumed && ticket==hostLoadEpoch && workspaceHostReady &&
                presentationTicket==hostPresentationEpoch && !answered && expanded==workspaceSettingsOpen && webView.url==url) {
                answered=true
                if(applied=="true") {cancelHostDeadline();webView.visibility=android.view.View.VISIBLE;nativeChat?.hostPresentationState(false,false)}
                else failWorkspaceHost()
            }
        }} catch(_: Exception) {failWorkspaceHost()}
    }

    /* ================= WEBVIEW CLIENT ================= */

    inner class MayaWebViewClient : WebViewClientCompat() {
        override fun onPageStarted(view: WebView,url: String?,favicon: android.graphics.Bitmap?) {
            if(view===webView) {if(hostFailed) {view.stopLoading();view.visibility=android.view.View.INVISIBLE} else beginWorkspaceHostLoad()}
            super.onPageStarted(view,url,favicon)
        }
        override fun shouldInterceptRequest(
            view: WebView,
            request: WebResourceRequest
        ): WebResourceResponse? = assetLoader.shouldInterceptRequest(request.url)

        /* v4.0.1: JS ke markAlive() + ye dono ab webViewAlive true karte hain —
           pehle false-alarm toast har launch par aata tha */
        override fun onPageFinished(view: WebView, url: String?) {
            if(view===webView) voiceHostTrusted=!hostFailed && view.url==url && url in listOf("https://$VIRTUAL_HOST/assets/web/index.html", "file:///android_asset/web/index.html")
            if (url != null && (url.startsWith("https://$VIRTUAL_HOST") || url.startsWith("file:///android_asset"))) {
                webViewAlive = true
            }
            if (!hostFailed && view===webView && view.url==url && url in listOf("https://$VIRTUAL_HOST/assets/web/index.html", "file:///android_asset/web/index.html")) {
                val ticket=hostLoadEpoch;val mountTicket=++hostMountEpoch
                var answered=false
                try {view.evaluateJavascript("window.__mayaWorkspaceMount ? window.__mayaWorkspaceMount() : false;") { mounted ->
                    if (!isFinishing && !isDestroyed && ticket==hostLoadEpoch && mountTicket==hostMountEpoch && !answered && view === webView && view.url == url && !hostFailed) {
                        answered=true
                        if(mounted=="true") {workspaceHostReady=true;applyWorkspacePresentation()} else failWorkspaceHost()
                    }
                }} catch(_: Exception) {failWorkspaceHost()}
            }
            super.onPageFinished(view, url)
        }

        /* v4.0.1: WebViewAssetLoader/https virtual-host kisi purane/odd WebView par
           fail ho jaye to seedha file:///android_asset fallback — blank screen khatam */
        override fun onReceivedError(
            view: WebView,
            request: WebResourceRequest,
            error: WebResourceErrorCompat
        ) {
            if (view===webView && request.isForMainFrame && request.url.toString()==view.url && !hostFailed) {
                if(request.url.toString()=="https://$VIRTUAL_HOST/assets/web/index.html" && !hostFallbackUsed) {
                    hostFallbackUsed=true;beginWorkspaceHostLoad()
                    try {view.loadUrl("file:///android_asset/web/index.html")} catch(_: Exception) {failWorkspaceHost()}
                } else failWorkspaceHost()
            }
            super.onReceivedError(view, request, error)
        }

        override fun onReceivedHttpError(view: WebView,request: WebResourceRequest,response: WebResourceResponse) {
            if(view===webView && request.isForMainFrame && request.url.toString()==view.url && response.statusCode>=400) failWorkspaceHost()
            super.onReceivedHttpError(view,request,response)
        }

        override fun shouldOverrideUrlLoading(
            view: WebView,
            request: WebResourceRequest
        ): Boolean {
            val url = request.url
            if (url.toString() == com.maya.ai.chat.NativeChatActivity.OPEN_LINK) {
                if (request.isForMainFrame && request.hasGesture() && view.url in listOf(
                        "https://$VIRTUAL_HOST/assets/web/index.html", "file:///android_asset/web/index.html")) {
                    openMainChat()
                }
                return true
            }
            // apni app — andar khule (v4.0.1: file:// fallback bhi WebView ke andar)
            val document=url.buildUpon().fragment(null).build().toString()
            if(request.isForMainFrame && LegacyCapabilities.trustedDocument(document)) return false
            if(!request.isForMainFrame || !request.hasGesture() || !LegacyCapabilities.trustedDocument(view.url) || url.host==VIRTUAL_HOST || url.scheme!="https") return true
            return try {
                startActivity(Intent(Intent.ACTION_VIEW, url))  // bahar ke links/apps
                true
            } catch (e: ActivityNotFoundException) {
                val fb = when (url.scheme) {
                    "instagram" -> "https://www.instagram.com/"
                    "market" -> "https://play.google.com/store/apps"
                    "fb" -> "https://m.facebook.com/"
                    "tg" -> "https://web.telegram.org/"
                    "googlegmail" -> "https://mail.google.com/"
                    "nflx" -> "https://www.netflix.com/"
                    "spotify" -> "https://open.spotify.com/"
                    "whatsapp" -> "https://web.whatsapp.com/"
                    "geo" -> "https://maps.google.com/"
                    else -> null
                }
                if (fb != null) {
                    try { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(fb))) }
                    catch (x: Exception) { toast("Ye app is phone par install nahi hai") }
                } else toast("Ye app/link is phone par nahi mila")
                true
            }
        }
    }

    /* ================= TTS ================= */

    /* v5.9.5 — SILENT-VOICE-FIX, teen deewarein:
       1. init-retry: initTts ek dafa chalta tha; TextToSpeech constructor
          khamoshi fail ho jaye (kuch ROM/WebView boot races) to JS ka device
          tier HAMESHA ke liye murda ho jata tha -> "text aa gaya, awaaz zero".
          Ab max 3 koshish (2s/6s), har koshish ka log.
       2. UTTERANCE watchdog: system TTS ka onDone/onError bhool jana aam hai
          (Tecno/HiOS par bhi). Bhoola to SUKOON BOL_RAHI mein atak jata tha
          aur mic pipeline band ho jati thi. 12s HARD fallback — bolo ya
          bhoolo, JS ko jawab jayega hi.
       3. AUDIO ATTRIBUTES: pehle default stream (akasar ring/notification)
          par bolta tha — media volume ZERO ho to Maya "boli hi nahi".
          Ab USAGE_MEDIA/CONTENT_TYPE_SPEECH (media volume par). */
    private fun initTts() {
        ttsBooting = true
        try {
            tts = TextToSpeech(applicationContext) { status ->
                ttsBooting = false
                android.util.Log.i("MayaTTS", "init status=" + status + " ready=" + (status == TextToSpeech.SUCCESS))
                ttsReady = status == TextToSpeech.SUCCESS
                if (ttsReady) {
                    try {
                        tts?.setAudioAttributes(
                            android.media.AudioAttributes.Builder()
                                .setUsage(android.media.AudioAttributes.USAGE_MEDIA)
                                .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SPEECH)
                                .build()
                        )
                    } catch (e: Exception) {}
                } else {
                    retryTts()
                }
                tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                    override fun onStart(utteranceId: String?) {
                        if (utteranceId == "maya") ttsEverSpoke = true
                    }
                    override fun onDone(utteranceId: String?) {
                        if (utteranceId == "maya")
                            evalAsync("window.__nativeTtsDone && window.__nativeTtsDone('done')")
                    }
                    @Deprecated("Deprecated in Java")
                    override fun onError(utteranceId: String?) {
                        android.util.Log.w("MayaTTS", "utterance error")
                        if (utteranceId == "maya")
                            evalAsync("window.__nativeTtsDone && window.__nativeTtsDone('error')")
                    }
                })
            }
        } catch (e: Exception) {
            ttsBooting = false
            android.util.Log.e("MayaTTS", "init threw: " + e.message)
            retryTts()
        }
    }

    private fun retryTts() {
        if (ttsReady || ttsBooting) return
        if (ttsRetries >= 2) {
            android.util.Log.e("MayaTTS", "init nakaam — JS ko bataya (device tier off)")
            evalAsync("window.__nativeTtsStatus && window.__nativeTtsStatus('init_failed')")
            return
        }
        ttsRetries++
        val delay = if (ttsRetries == 1) 2000L else 6000L
        android.util.Log.w("MayaTTS", "init retry #" + ttsRetries + " in " + delay + "ms")
        android.os.Handler(Looper.getMainLooper()).postDelayed({
            if (!ttsReady && !ttsBooting) initTts()
        }, delay)
    }

    private var ttsRetries = 0

    /* ================= STT ================= */

    private fun stopRecognizer() {
        recognitionActive = false
        speechGeneration++
        try { recognizer?.destroy(); recognizer = null } catch (e: Exception) { recognitionActive = recognizer != null }
    }

    /* ================= JS BRIDGE ================= */

    inner class MayaBridge {

        @JavascriptInterface
        fun appVersion(): String = BuildConfig.VERSION_NAME + "-native"

        @JavascriptInterface
        fun legacyRestricted(): Boolean = true

        /** Navigation only. JS cannot provide an APK URL or trigger installation. */
        @JavascriptInterface
        fun openUpdates() {
            runOnUiThread {
                if(!voiceForeground()) return@runOnUiThread
                startActivity(Intent(this@MainActivity, com.maya.ai.update.UpdateActivity::class.java))
            }
        }

        /* 🎚️ P9 SUKOON — JS (SUKOON) har awaaz/mic ki HAAL yahan bhejti hai.
           KHALI | BOL_RAHI | APP_SUN — WakeWordService har mic-darwaze par isi
           ko poochhti hai. Isi se awaaz-katna + mic-larai dono khatam hain. */
        @JavascriptInterface
        fun setHaal(h: String) {
            if(h !in setOf("KHALI","BOL_RAHI","APP_SUN") || (h!="KHALI" && fishTalkId==null)) return
            try { WakeWordService.applyHaal(h) } catch (e: Exception) {}
        }

        /* v4.0.1: index.html boot-guard ye call karta hai — ab native alive flag true hota hai */
        @JavascriptInterface
        fun markAlive() { webViewAlive = true }

        /* v4.0.1: doctor report ke liye installed WebView package version */
        @JavascriptInterface
        fun webViewVersion(): String = try {
            WebViewCompat.getCurrentWebViewPackage(this@MainActivity)?.versionName ?: ""
        } catch (e: Exception) { "" }

        /** Native TTS v2 — voice picker + pitch (crispy awaaz) */
        // Not exposed to WebView: legacy capability is quarantined.
        fun speak(text: String, lang: String, rate: Double, pitch: Double, voiceName: String) {
            runOnUiThread {
                if (!ttsReady) {
                    /* v5.9.5: init abhi zinda hai (retry chal raha) to JS ko
                       khabar na karo — warna device tier "khatam" maan kar chain
                       chhod deta. Retry khatam + phir bhi murda = sacha jawab. */
                    if (!ttsBooting) {
                        android.util.Log.w("MayaTTS", "speak on dead engine — nakaam JS ko")
                        evalAsync("window.__nativeTtsDone && window.__nativeTtsDone('engine_not_ready')")
                    }
                    return@runOnUiThread
                }
                try {
                    val engine = tts ?: return@runOnUiThread
                    try {
                        if (voiceName.isNotEmpty()) {
                            engine.voices?.firstOrNull { it.name == voiceName }?.let { engine.setVoice(it) }
                        } else {
                            val loc = Locale.forLanguageTag(lang.replace('_', '-'))
                            val res = engine.setLanguage(loc)
                            if (res == TextToSpeech.LANG_MISSING_DATA || res == TextToSpeech.LANG_NOT_SUPPORTED) {
                                engine.language = Locale.getDefault()
                            }
                        }
                    } catch (e: Exception) {}
                    engine.setSpeechRate(rate.toFloat().coerceIn(0.5f, 2f))
                    engine.setPitch(pitch.toFloat().coerceIn(0.5f, 2f))
                    /* v5.9.5: 12s UTTERANCE WATCHDOG — system TTS ka onDone/onError
                       bhool jana (Tecno/HiOS) = SUKOON BOL_RAHI hamesha ke liye atak
                       jata tha. Ab native khud 12s baad JS ko azaad karta hai.
                       (Edge/device TTS engine ise override kar deta hai.) */
                    evalAsync("window.__nativeTtsWatch && window.__nativeTtsWatch(12000)")
                    engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, "maya")
                } catch (e: Exception) {
                    evalAsync("window.__nativeTtsDone && window.__nativeTtsDone('exception')")
                }
            }
        }

        /** Phone ki saari TTS voices ki list (JS ke liye JSON) */
        // Not exposed to WebView: legacy capability is quarantined.
        fun ttsVoices(): String {
            return try {
                val arr = JSONArray()
                tts?.voices?.forEach { v ->
                    arr.put(
                        JSONObject()
                            .put("name", v.name)
                            .put("locale", v.locale.toLanguageTag())
                            .put("network", v.isNetworkConnectionRequired)
                    )
                }
                arr.toString()
            } catch (e: Exception) { "[]" }
        }

        @JavascriptInterface
        fun stopSpeak() {
            runOnUiThread { try { tts?.stop() } catch (e: Exception) {} }
        }

        /** Fixed Fish streaming output; no alternate voice or arbitrary network destination. */
        // Not exposed to WebView: legacy capability is quarantined.
        fun fishStreamSpeak(body: String, headers: String, id: String) {
            runOnUiThread {
                if (fishPlayer == null) fishPlayer = com.maya.ai.voice.FishStreamPlayer(this@MainActivity) { request, event, status ->
                    evalAsync("window.__fishStreamEvent && window.__fishStreamEvent('$request','$event',$status)")
                }
                fishPlayer?.speak(body, headers, id)
            }
        }

        // Not exposed to WebView: legacy capability is quarantined.
        fun fishStreamStop() { runOnUiThread { fishPlayer?.stop() } }

        /** Native STT — Google voice recognition (Urdu ur-PK supported) */
        // Not exposed to WebView: legacy capability is quarantined.
        fun listen(lang: String) { listenSession(lang, "") }

        @JavascriptInterface
        fun listenOwned(lang: String, owner: String) {
            if(fishTalkId==null || !voiceForeground() || lang !in com.maya.ai.chat.NativeDictation.LANGUAGES) return
            if (!Regex("mi[a-z0-9]{1,20}_[0-9]{1,12}").matches(owner)) return
            listenSession(lang, owner)
        }

        private fun listenSession(lang: String, owner: String) {
            runOnUiThread {
                if(!voiceForeground() || fishTalkId==null) {evalAsync("window.__nativeSpeechErr && window.__nativeSpeechErr(8,'$owner')");return@runOnUiThread}
                if(composerMicLease!=null) {evalAsync("window.__nativeSpeechErr && window.__nativeSpeechErr(8,'$owner')");return@runOnUiThread}
                if (ContextCompat.checkSelfPermission(
                        this@MainActivity, Manifest.permission.RECORD_AUDIO
                    ) != PackageManager.PERMISSION_GRANTED
                ) {
                    requestMicPermission()
                    evalAsync("window.__nativeSpeechErr && window.__nativeSpeechErr(9,'$owner')")
                    return@runOnUiThread
                }
                if (!SpeechRecognizer.isRecognitionAvailable(this@MainActivity)) {
                    evalAsync("window.__nativeSpeechErr && window.__nativeSpeechErr(5,'$owner')")
                    return@runOnUiThread
                }
                stopRecognizer()
                /* 🤝 P9 MIC SULAH — app ka tap-to-speak sab se pehle. Wake service
                   apna mic chhor degi (do recognizer kabhi ek saath nahi chal sakte —
                   wahi jang v5.8.0 tak har tap-to-speak ko mar okat deti thi). */
                try { WakeWordService.pauseForApp() } catch (e: Exception) {}
                val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                    putExtra(
                        RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                        RecognizerIntent.LANGUAGE_MODEL_FREE_FORM
                    )
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang)
                    putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, packageName)
                    /* 🎙️ P8b — pehle 1 tha! SUNO ka poora nizam "kai andazon mein se
                       behtareen chuno" par khara hai, aur main mic use SIRF EK andaza
                       deta tha — yani wo feature asal mic par kabhi chala hi nahi.
                       ("Funk Taka" -> "اس لاوا فنک" ki yehi wajah thi.) */
                    putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 6)
                    putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                    /* Issue 2: 700ms bohat chhota tha — jumla poora hone se pehle hi
                       mic band ho jata tha. 1200ms = poori baat pakadta hai, phir
                       bhi response tez rehta hai. */
                    putExtra("android.speech.extra.SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS", 1200)
                }
                val session = speechGeneration
                var delivered = false
                android.os.Handler(Looper.getMainLooper()).postDelayed({
                    if (session == speechGeneration && !delivered) {
                        delivered = true
                        stopRecognizer()
                        WakeWordService.resumeFromApp()
                        evalAsync("window.__nativeSpeechErr && window.__nativeSpeechErr(1,'$owner')")
                    }
                }, 30000)
                val timing = com.maya.ai.voice.RecognitionTiming { android.os.SystemClock.elapsedRealtime() }
                try {
                recognitionActive = true
                recognizer = makeRecognizer().apply {
                    setRecognitionListener(object : RecognitionListener {
                        override fun onReadyForSpeech(params: Bundle?) {
                            if (session == speechGeneration && !delivered) evalAsync("window.__inputReady && window.__inputReady('$owner')")
                        }
                        override fun onBeginningOfSpeech() {
                            if (session == speechGeneration && !delivered) evalAsync("window.__inputBegan && window.__inputBegan('$owner')")
                        }
                        private var rmsTick = 0
                        override fun onRmsChanged(rmsdB: Float) {
                            rmsTick++
                            if (session == speechGeneration && !delivered && rmsTick % 4 == 0) evalAsync("window.__nativeRms && window.__nativeRms(" + rmsdB + ",'$owner')")
                        }
                        override fun onBufferReceived(buffer: ByteArray?) {}
                        override fun onEndOfSpeech() {
                            if (session != speechGeneration || delivered) return
                            timing.end()
                            evalAsync("window.__inputEnded && window.__inputEnded('$owner')")
                        }
                        override fun onError(error: Int) {
                            if (session != speechGeneration || delivered) return
                            recognitionActive = false
                            delivered = true
                            evalAsync("window.__nativeSpeechErr && window.__nativeSpeechErr($error,'$owner')")
                        }
                        override fun onResults(results: Bundle?) {
                            if (session != speechGeneration || delivered) return
                            recognitionActive = false
                            delivered = true
                            val recognitionMs = timing.endToFinal() ?: -1L
                            /* 🎙️ Android 3-5 andaze deta hai. Pehle sirf pehla liya jata tha
                               aur baqi phenk diye jate the — isi liye "Monarch" -> "منار" ban
                               jata tha. Ab SAARE andaze JS ko jate hain; SUNO un mein se wo
                               chunta hai jismein jaane-pehchane naam sab se zyada hon. */
                            val all = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                                ?: arrayListOf()
                            val text = all.firstOrNull() ?: ""
                            val conf = try {
                                results?.getFloatArray(SpeechRecognizer.CONFIDENCE_SCORES)
                            } catch (e: Exception) { null }
                            val arr = JSONArray()
                            for (i in 0 until minOf(all.size, 6)) {
                                /* har andaze ke sath uska yaqeen (0..1). Pehle ye kabhi
                                   parha hi nahi jata tha — ab SUNO isay bhi dekhta hai. */
                                val o = JSONObject()
                                o.put("t", all[i])
                                if (conf != null && i < conf.size && conf[i].isFinite() && conf[i] in 0f..1f) o.put("c", conf[i].toDouble())
                                arr.put(o)
                            }
                            evalAsync(
                                "window.__nativeSpeech && window.__nativeSpeech('" + jsEscape(text) +
                                "','" + jsEscape(arr.toString()) + "','$owner',$recognitionMs)"
                            )
                        }
                        override fun onPartialResults(partialResults: Bundle?) {
                            if (session != speechGeneration || delivered) return
                            val pt = partialResults
                                ?.getStringArrayList("android.speech.extra.RESULTS")?.firstOrNull() ?: ""
                            if (pt.isNotBlank()) evalAsync("window.__nativePartial && window.__nativePartial('" + jsEscape(pt) + "','$owner')")
                        }
                        override fun onEvent(eventType: Int, params: Bundle?) {}
                    })
                    startListening(intent)
                }
                } catch (_: Exception) {
                    stopRecognizer()
                    WakeWordService.resumeFromApp()
                    evalAsync("window.__nativeSpeechErr && window.__nativeSpeechErr(5,'$owner')")
                }
            }
        }

        @JavascriptInterface
        fun stopListen() {
            runOnUiThread { stopRecognizer() }
        }

        /** REAL alarm v2 — 3-layer: silent set > prefilled UI > fail */
        // Not exposed to WebView: legacy capability is quarantined.
        fun setAlarm(hour: Int, minute: Int, message: String): Int {
            val msg = message.ifEmpty { "MAYA Alarm" }
            try {
                val i = Intent(AlarmClock.ACTION_SET_ALARM).apply {
                    putExtra(AlarmClock.EXTRA_HOUR, hour)
                    putExtra(AlarmClock.EXTRA_MINUTES, minute)
                    putExtra(AlarmClock.EXTRA_MESSAGE, msg)
                    putExtra(AlarmClock.EXTRA_SKIP_UI, true)
                }
                startActivity(i)
                return 2
            } catch (e: Exception) {}
            try {
                val i = Intent(AlarmClock.ACTION_SET_ALARM).apply {
                    putExtra(AlarmClock.EXTRA_HOUR, hour)
                    putExtra(AlarmClock.EXTRA_MINUTES, minute)
                    putExtra(AlarmClock.EXTRA_MESSAGE, msg)
                }
                startActivity(i)
                return 1
            } catch (e: Exception) {}
            return 0
        }

        /** REAL system timer — screen band ho to bhi bajta hai */
        // Not exposed to WebView: legacy capability is quarantined.
        fun setTimer(seconds: Int, message: String): Boolean {
            return try {
                val i = Intent(AlarmClock.ACTION_SET_TIMER).apply {
                    putExtra(AlarmClock.EXTRA_LENGTH, seconds)
                    putExtra(AlarmClock.EXTRA_MESSAGE, message.ifEmpty { "MAYA Timer" })
                    putExtra(AlarmClock.EXTRA_SKIP_UI, true)
                }
                startActivity(i)
                true
            } catch (e: Exception) { false }
        }

        /** Battery status (JSON string — sync return) */
        @JavascriptInterface
        fun battery(): String {
            return try {
                val b = registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
                    ?: return "{}"
                val level = b.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
                val scale = b.getIntExtra(BatteryManager.EXTRA_SCALE, 100)
                val status = b.getIntExtra(BatteryManager.EXTRA_STATUS, -1)
                JSONObject()
                    .put("level", if (level >= 0) level * 100 / scale else -1)
                    .put(
                        "charging",
                        status == BatteryManager.BATTERY_STATUS_CHARGING ||
                            status == BatteryManager.BATTERY_STATUS_FULL
                    )
                    .toString()
            } catch (e: Exception) { "{}" }
        }

        // Not exposed to WebView: legacy capability is quarantined.
        fun vibrate(ms: Long) {
            try {
                val vib: Vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    (getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
                } else {
                    @Suppress("DEPRECATION")
                    getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vib.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE))
                } else {
                    @Suppress("DEPRECATION") vib.vibrate(ms)
                }
            } catch (e: Exception) {}
        }

        // Not exposed to WebView: legacy capability is quarantined.
        fun notify(title: String, text: String) {
            runOnUiThread {
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                        ContextCompat.checkSelfPermission(
                            this@MainActivity, Manifest.permission.POST_NOTIFICATIONS
                        ) != PackageManager.PERMISSION_GRANTED
                    ) {
                        requestNotificationPermission()
                        return@runOnUiThread
                    }
                    val pi = PendingIntent.getActivity(
                        this@MainActivity, 0,
                        Intent(this@MainActivity, MainActivity::class.java),
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                    )
                    val n = NotificationCompat.Builder(this@MainActivity, CHANNEL_ID)
                        .setSmallIcon(android.R.drawable.ic_dialog_info)
                        .setContentTitle(title)
                        .setContentText(text)
                        .setAutoCancel(true)
                        .setContentIntent(pi)
                        .build()
                    getSystemService(NotificationManager::class.java)
                        .notify((System.currentTimeMillis() % 10000).toInt(), n)
                } catch (e: Exception) {}
            }
        }

        /** Wake word service — background mein 'Maya'/'Boss' sunti hai */
        @JavascriptInterface
        fun wakeService(start: Boolean): Boolean {
            if(!voiceForeground() || !workspaceSettingsOpen) return false
            return try {
                if (start) {
                    if(!voiceForeground() || !workspaceSettingsOpen || fishTalkId!=null || composerMicLease!=null || recognitionActive) return false
                    if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.RECORD_AUDIO)
                        != PackageManager.PERMISSION_GRANTED) {
                        WakeWordService.updateHealth(com.maya.ai.voice.WakeStatus.State.ERROR, com.maya.ai.voice.WakeStatus.Reason.PERMISSION, 9)
                        requestMicPermission()
                        return false
                    }
                    prefs().edit().putBoolean("wake", true).apply()
                    WakeWordService.start(this@MainActivity)
                } else {
                    WakeWordService.stop(this@MainActivity)
                    prefs().edit().putBoolean("wake", false).apply()
                    true
                }
            } catch (e: Exception) { false }
        }

        /** Explicit local read, fixed fields only. No transcript/keys/raw exception messages. */
        @JavascriptInterface
        fun fishTalkSpeak(id: String,turn: Int,body: String,headers: String) {
            if(body.length>16000 || headers.length>4096) return
            runOnUiThread {
                if(fishTalkId!=id || !voiceForeground() || turn !in 1..5 || turn!=fishTalkLastSpoken+1 || talkPlayer!=null || !fishTalkEvents.readyForSpeech(turn)) return@runOnUiThread
                fishTalkLastSpoken=turn
                lateinit var player: com.maya.ai.voice.FishStreamPlayer
                player=com.maya.ai.voice.FishStreamPlayer(this@MainActivity,strictNetwork=true) {_,event,status ->
                    if(event!="playing" && talkPlayer===player) talkPlayer=null
                    if(fishTalkId==id && voiceForeground()) evalAsync("if(window.FISH_TALK) FISH_TALK.audioEvent('$id',$turn,'$event',$status)")
                }
                talkPlayer=player
                if(!player.speakExclusive(body,headers,"talk_${id}_$turn") {
                    if(fishTalkId==id) evalAsync("if(window.FISH_TALK) FISH_TALK.audioEvent('$id',$turn,'interrupted',0)")
                }) evalAsync("if(window.FISH_TALK) FISH_TALK.audioEvent('$id',$turn,'error',0)")
            }
        }

        @JavascriptInterface
        fun fishTalkEvent(id: String,kind: String,value: String) {
            if(id.length!=32 || value.length>2000 || kind.length>12) return
            runOnUiThread {
                if(fishTalkId!=id || !voiceForeground()) return@runOnUiThread
                if(!fishTalkEvents.accept(kind,value)) {stopFishTalk();nativeChat?.fishTalkEnded("Invalid voice event rejected. Nothing executed.");return@runOnUiThread}
                if(kind=="end") {stopFishTalk();nativeChat?.fishTalkEnded(value)}
                else nativeChat?.fishTalkEvent(kind,value)
            }
        }

        @JavascriptInterface
        fun nativeWakeNotice() {
            val presentation=hostPresentationEpoch
            if(!voiceForeground()) return
            runOnUiThread {
                if(voiceForeground() && presentation==hostPresentationEpoch) {WakeWordService.stop(this@MainActivity);nativeChat?.offerForegroundVoice()}
            }
        }

        @JavascriptInterface
        fun wakeStatus(): String = WakeWordService.statusJson().put("micPermission",
            ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED).toString()

        /** YouTube v2 — innertube JSON + consent cookie fallback (pakka videoId) */
        // Not exposed to WebView: legacy capability is quarantined.
        fun ytSearch(query: String): String {
            // 1) Innertube ANDROID client — JSON, reliable
            try {
                val conn = URL("https://www.youtube.com/youtubei/v1/search?prettyPrint=false")
                    .openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.doOutput = true
                conn.connectTimeout = 8000
                conn.readTimeout = 8000
                conn.setRequestProperty("Content-Type", "application/json")
                conn.setRequestProperty("User-Agent", "com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip")
                val esc = query.replace("\\", "\\\\").replace("\"", "\\\"")
                val body = "{\"context\":{\"client\":{\"clientName\":\"ANDROID\",\"clientVersion\":\"20.10.38\",\"androidSdkVersion\":30,\"hl\":\"en\",\"gl\":\"US\"}},\"query\":\"" + esc + "\"}"
                conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
                val txt = conn.inputStream.bufferedReader().use { it.readText() }
                conn.disconnect()
                val m = Regex("\"videoId\":\"([a-zA-Z0-9_-]{11})\"").find(txt)
                if (m != null) return m.groupValues[1]
            } catch (e: Exception) {}
            // 2) HTML + CONSENT cookie
            try {
                val conn = URL("https://www.youtube.com/results?search_query=" + URLEncoder.encode(query, "UTF-8"))
                    .openConnection() as HttpURLConnection
                conn.connectTimeout = 8000
                conn.readTimeout = 8000
                conn.instanceFollowRedirects = true
                conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36")
                conn.setRequestProperty("Cookie", "CONSENT=YES+cb.20240101-01-p0.en+FX+000; SOCS=CAI")
                conn.setRequestProperty("Accept-Language", "en-US,en;q=0.9")
                val html = conn.inputStream.bufferedReader().use { it.readText() }
                conn.disconnect()
                val m = Regex("\"videoId\":\"([a-zA-Z0-9_-]{11})\"").find(html)
                if (m != null) return m.groupValues[1]
            } catch (e: Exception) {}
            return ""
        }

        /** CONTACTS ENGINE (Phase 5) */
        // Not exposed to WebView: legacy capability is quarantined.
        fun contactsSearch(query: String): String {
            return try {
                if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.READ_CONTACTS)
                    != PackageManager.PERMISSION_GRANTED) {
                    ActivityCompat.requestPermissions(this@MainActivity, arrayOf(Manifest.permission.READ_CONTACTS), REQ_PERMS)
                    return "{\"error\":\"permission\"}"
                }
                val q = query.trim()
                if (q.isEmpty()) return "{\"matches\":[]}"
                val arr = JSONArray()
                val seen = HashSet<String>()
                // naam se contact
                val cur = contentResolver.query(
                    ContactsContract.Contacts.CONTENT_FILTER_URI.buildUpon().appendPath(q).build(),
                    arrayOf(ContactsContract.Contacts._ID, ContactsContract.Contacts.DISPLAY_NAME),
                    null, null, null
                )
                cur?.use { c ->
                    while (c.moveToNext() && arr.length() < 6) {
                        val id = c.getString(0) ?: continue
                        val name = c.getString(1) ?: continue
                        val pcur = contentResolver.query(
                            ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                            arrayOf(ContactsContract.CommonDataKinds.Phone.NUMBER),
                            ContactsContract.CommonDataKinds.Phone.CONTACT_ID + "=?",
                            arrayOf(id), null
                        )
                        pcur?.use { p ->
                            while (p.moveToNext() && arr.length() < 6) {
                                val num = p.getString(0) ?: continue
                                if (seen.add(name + "|" + num)) {
                                    arr.put(JSONObject().put("name", name).put("number", num))
                                }
                            }
                        }
                    }
                }
                // dialpad/number se bhi
                if (arr.length() == 0) {
                    val pcur = contentResolver.query(
                        ContactsContract.CommonDataKinds.Phone.CONTENT_FILTER_URI.buildUpon().appendPath(q).build(),
                        arrayOf(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
                                ContactsContract.CommonDataKinds.Phone.NUMBER),
                        null, null, null
                    )
                    pcur?.use { p ->
                        while (p.moveToNext() && arr.length() < 6) {
                            val name = p.getString(0) ?: continue
                            val num = p.getString(1) ?: continue
                            if (seen.add(name + "|" + num)) {
                                arr.put(JSONObject().put("name", name).put("number", num))
                            }
                        }
                    }
                }
                JSONObject().put("matches", arr).toString()
            } catch (e: Exception) { "{\"error\":\"" + (e.message ?: "x") + "\"}" }
        }

        /** Naam se seedha CALL (bina tap — ACTION_CALL) */
        // Not exposed to WebView: legacy capability is quarantined.
        fun autoCall(number: String): Boolean {
            return try {
                if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.CALL_PHONE)
                    != PackageManager.PERMISSION_GRANTED) {
                    ActivityCompat.requestPermissions(this@MainActivity, arrayOf(Manifest.permission.CALL_PHONE), REQ_PERMS)
                    return false
                }
                startActivity(Intent(Intent.ACTION_CALL, Uri.parse("tel:" + number)))
                true
            } catch (e: Exception) { false }
            }

        /** WhatsApp: number + message draft (PK normalization + auto-send flag) */
        // Not exposed to WebView: legacy capability is quarantined.
        fun openWhatsAppDraft(number: String, text: String, autoSend: Boolean): Boolean {
            return try {
                var n = number.replace(Regex("[^\\d]"), "")
                if (n.startsWith("00")) n = n.substring(2)
                if (n.startsWith("0") && n.length in 10..11) n = "92" + n.substring(1)
                if (autoSend) prefs().edit().putLong("autosend_at", System.currentTimeMillis()).apply()
                val u = "https://wa.me/" + n + "?text=" + URLEncoder.encode(text, "UTF-8")
                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(u)))
                true
            } catch (e: Exception) { false }
        }

        /** SMS draft (number + text) */
        // Not exposed to WebView: legacy capability is quarantined.
        fun smsDraft(number: String, text: String): Boolean {
            return try {
                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(
                    "sms:" + number + "?body=" + URLEncoder.encode(text, "UTF-8"))))
                true
            } catch (e: Exception) { false }
        }

        /** Battery shield — unrestricted (background mic kill se bachao) */
        @SuppressLint("BatteryLife")
        // Not exposed to WebView: legacy capability is quarantined.
        fun requestBatteryUnrestricted(): Boolean {
            return try {
                val pm = getSystemService(Context.POWER_SERVICE) as android.os.PowerManager
                if (pm.isIgnoringBatteryOptimizations(packageName)) return true
                startActivity(Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                    Uri.parse("package:" + packageName)))
                true
            } catch (e: Exception) { false }
        }

        // Not exposed to WebView: legacy capability is quarantined.
        fun batteryUnrestricted(): Boolean {
            return try {
                val pm = getSystemService(Context.POWER_SERVICE) as android.os.PowerManager
                pm.isIgnoringBatteryOptimizations(packageName)
            } catch (e: Exception) { false }
        }

        /** AutoSend accessibility status + settings kholna */
        // Not exposed to WebView: legacy capability is quarantined.
        fun accessibilityEnabled(): Boolean {
            return try {
                val s = Settings.Secure.getString(contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES)
                    ?: return false
                s.contains(".AutoSendService")
            } catch (e: Exception) { false }
        }

        @JavascriptInterface
        fun deviceBrand(): String = Build.MANUFACTURER ?: "unknown"

        // Not exposed to WebView: legacy capability is quarantined.
        fun openAppDetails(): Boolean {
            return try {
                startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                    Uri.parse("package:" + packageName)))
                true
            } catch (e: Exception) { false }
        }

        // Not exposed to WebView: legacy capability is quarantined.
        fun openAccessibilitySettings(): Boolean {
            return try {
                startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
                true
            } catch (e: Exception) { false }
        }

        /** FILE MANAGER (Phase 8) — list/open/share */
        // Not exposed to WebView: legacy capability is quarantined.
        fun listFiles(folder: String): String {
            return try {
                val f = folder.lowercase().trim()
                val uri: Uri = when (f) {
                    "pictures", "photos" -> MediaStore.Images.Media.EXTERNAL_CONTENT_URI
                    "music", "audio" -> MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
                    "videos", "movies" -> MediaStore.Video.Media.EXTERNAL_CONTENT_URI
                    else -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q)
                        MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL)
                    else MediaStore.Files.getContentUri("external")
                }
                val arr = JSONArray()
                val proj = arrayOf(
                    MediaStore.MediaColumns._ID,
                    MediaStore.MediaColumns.DISPLAY_NAME,
                    MediaStore.MediaColumns.MIME_TYPE,
                    MediaStore.MediaColumns.SIZE
                )
                val cur = contentResolver.query(uri, proj, null, null, MediaStore.MediaColumns.DATE_MODIFIED + " DESC")
                cur?.use { c ->
                    var i = 0
                    while (c.moveToNext() && i < 40) {
                        val id = c.getLong(0)
                        val name = c.getString(1) ?: continue
                        val mime = c.getString(2) ?: ""
                        val size = c.getLong(3)
                        val itemUri = Uri.withAppendedPath(uri, id.toString())
                        arr.put(JSONObject()
                            .put("name", name)
                            .put("type", mime)
                            .put("size", size)
                            .put("uri", itemUri.toString()))
                        i++
                    }
                }
                JSONObject().put("files", arr).put("folder", f).toString()
            } catch (e: Exception) { JSONObject().put("error", e.message ?: "x").toString() }
        }

        // Not exposed to WebView: legacy capability is quarantined.
        fun openFile(uriStr: String, mime: String): Boolean {
            return try {
                val i = Intent(Intent.ACTION_VIEW, Uri.parse(uriStr)).apply {
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    if (mime.isNotEmpty()) setDataAndType(Uri.parse(uriStr), mime)
                }
                startActivity(i)
                true
            } catch (e: Exception) { false }
        }

        // Not exposed to WebView: legacy capability is quarantined.
        fun shareFile(uriStr: String, mime: String): Boolean {
            return try {
                val i = Intent(Intent.ACTION_SEND).apply {
                    type = mime.ifEmpty { "*/*" }
                    putExtra(Intent.EXTRA_STREAM, Uri.parse(uriStr))
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                startActivity(Intent.createChooser(i, "MAYA share"))
                true
            } catch (e: Exception) { false }
        }

        // Not exposed to WebView: legacy capability is quarantined.
        fun requestFilesPerms(): Boolean {
            return try {
                val perms = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU)
                    arrayOf(Manifest.permission.READ_MEDIA_IMAGES, Manifest.permission.READ_MEDIA_VIDEO, Manifest.permission.READ_MEDIA_AUDIO)
                else arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE)
                ActivityCompat.requestPermissions(this@MainActivity, perms, REQ_PERMS)
                true
            } catch (e: Exception) { false }
        }

        /* ===== QUICK CONTROLS (Phase 9) ===== */
        // Not exposed to WebView: legacy capability is quarantined.
        fun torch(on: Boolean): Boolean {
            return try {
                val cm = getSystemService(Context.CAMERA_SERVICE) as CameraManager
                val id = cm.cameraIdList.firstOrNull { cid ->
                    cm.getCameraCharacteristics(cid)
                        .get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true
                } ?: return false
                cm.setTorchMode(id, on)
                true
            } catch (e: Exception) { false }
        }

        // Not exposed to WebView: legacy capability is quarantined.
        fun volume(pct: Int): Int {
            return try {
                val am = getSystemService(Context.AUDIO_SERVICE) as AudioManager
                val max = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
                val v = (max * pct.coerceIn(0, 100)) / 100
                am.setStreamVolume(AudioManager.STREAM_MUSIC, v, 0)
                v * 100 / max
            } catch (e: Exception) { -1 }
        }

        // Not exposed to WebView: legacy capability is quarantined.
        fun brightness(pct: Int): Int {
            return try {
                if (!Settings.System.canWrite(this@MainActivity)) {
                    startActivity(Intent(Settings.ACTION_MANAGE_WRITE_SETTINGS,
                        Uri.parse("package:" + packageName)))
                    return -2
                }
                val max = 255
                val b = (max * pct.coerceIn(5, 100)) / 100
                Settings.System.putInt(contentResolver, Settings.System.SCREEN_BRIGHTNESS, b)
                b * 100 / max
            } catch (e: Exception) { -1 }
        }

        // Not exposed to WebView: legacy capability is quarantined.
        fun lockScreen(): Boolean {
            return try {
                val svc = com.maya.ai.AutoSendService.instance
                svc?.performGlobalAction(android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_LOCK_SCREEN) == true
            } catch (e: Exception) { false }
        }

        // Not exposed to WebView: legacy capability is quarantined.
        fun scheduleTask(id: String, delayMs: Long): Boolean =
            try { com.maya.ai.ScheduledReceiver.schedule(this@MainActivity, id, delayMs) } catch (e: Exception) { false }

        /* ===== WHATSAPP READER ===== */
        // Not exposed to WebView: legacy capability is quarantined.
        fun notifHistory(): String =
            try { com.maya.ai.MayaNotifService.historyJson() } catch (e: Exception) { "[]" }

        // Not exposed to WebView: legacy capability is quarantined.
        fun notifClear() { try { com.maya.ai.MayaNotifService.clear() } catch (e: Exception) {} }

        // Not exposed to WebView: legacy capability is quarantined.
        fun notifSpeak(on: Boolean) { com.maya.ai.MayaNotifService.speakOn = on }

        // Not exposed to WebView: legacy capability is quarantined.
        fun notifEnabled(): Boolean {
            return try {
                val s = Settings.Secure.getString(contentResolver, "enabled_notification_listeners") ?: return false
                s.contains(packageName)
            } catch (e: Exception) { false }
        }

        // Not exposed to WebView: legacy capability is quarantined.
        fun openNotifAccess(): Boolean {
            return try { startActivity(Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS")); true }
            catch (e: Exception) { false }
        }

        /* ===== REPLY via notification action (asli auto-reply) ===== */
        // Not exposed to WebView: legacy capability is quarantined.
        fun notifReply(fromName: String, text: String): Int {
            return try {
                val nb = com.maya.ai.MayaNotifService.buffer
                val target = synchronized(nb) {
                    nb.toList().lastOrNull { it.optString("from") == fromName && it.optBoolean("canReply") }
                } ?: return -1
                // dobara live notification se action lo (posted list se)
                val sbns = this@MainActivity.let { _ ->
                    // listener instance ke through activeNotifications nahi milta yahan se,
                    // to buffer wala pendingIntent nahi hota — is liye reply sirf tab jab
                    // listener attached ho; hum notif list scan nahi kar sakte activity se.
                    null
                }
                // Simple robust raasta: WhatsApp draft kholo (auto-send ke saath)
                val okDraft = openWhatsAppDraftLookup(fromName, text)
                if (okDraft) 1 else 0
            } catch (e: Exception) { 0 }
        }

        private fun openWhatsAppDraftLookup(fromName: String, text: String): Boolean {
            return try {
                // contact se number dhoondo aur draft + autosend kholo
                if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.READ_CONTACTS)
                    == PackageManager.PERMISSION_GRANTED) {
                    val cur = contentResolver.query(
                        ContactsContract.Contacts.CONTENT_FILTER_URI.buildUpon().appendPath(fromName).build(),
                        arrayOf(ContactsContract.Contacts._ID), null, null, null)
                    var number: String? = null
                    cur?.use { c ->
                        if (c.moveToNext()) {
                            val id = c.getString(0)
                            val pc = contentResolver.query(
                                ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                                arrayOf(ContactsContract.CommonDataKinds.Phone.NUMBER),
                                ContactsContract.CommonDataKinds.Phone.CONTACT_ID + "=?",
                                arrayOf(id), null)
                            pc?.use { p -> if (p.moveToNext()) number = p.getString(0) }
                        }
                    }
                    if (number != null) {
                        return openWhatsAppDraft(number!!, text, true)
                    }
                }
                false
            } catch (e: Exception) { false }
        }

        /* ===== CAMERA / VISION ===== */
        // Not exposed to WebView: legacy capability is quarantined.
        fun takePhoto(): Boolean {
            return try {
                val dir = cacheDir
                val f = java.io.File(dir, "maya_photo.jpg")
                val uri = androidx.core.content.FileProvider.getUriForFile(
                    this@MainActivity, "$packageName.fileprovider", f)
                val i = Intent(android.provider.MediaStore.ACTION_IMAGE_CAPTURE).apply {
                    putExtra(android.provider.MediaStore.EXTRA_OUTPUT, uri)
                    addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                startActivityForResult(i, 5001)
                true
            } catch (e: Exception) { false }
        }

        // Not exposed to WebView: legacy capability is quarantined.
        fun pickImage(): Boolean {
            return try {
                val i = Intent(Intent.ACTION_GET_CONTENT)
                i.type = "image/*"
                startActivityForResult(Intent.createChooser(i, "Photo chunko"), 5002)
                true
            } catch (e: Exception) { false }
        }

        /** Universal HTTP (CORS-proof) — backup brains ke liye */
        // Not exposed to WebView: legacy capability is quarantined.
        fun httpPost(url: String, authHeader: String, body: String): String {
            return try {
                val conn = URL(url).openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.doOutput = true
                conn.connectTimeout = 6000
                conn.readTimeout = 15000
                conn.setRequestProperty("Content-Type", "application/json")
                if (authHeader.isNotEmpty()) conn.setRequestProperty("Authorization", authHeader)
                conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
                val code = conn.responseCode
                val txt = (if (code in 200..399) conn.inputStream else conn.errorStream)
                    ?.bufferedReader()?.use { it.readText() } ?: ""
                conn.disconnect()
                JSONObject().put("status", code).put("body", txt).toString()
            } catch (e: Exception) {
                JSONObject().put("status", 0).put("body", e.message ?: "error").toString()
            }
        }

        /**
         * v4.4.0 — BRAIN POOL ke liye async POST.
         * Sync httpPost() JS thread ko 21 second tak rok deta tha; pool mein 10 provider
         * ho to app jam jati hai. Ye version alag thread par chalta hai aur jawab
         * window.__httpDone(reqId, status, base64Body) se wapas deta hai.
         * base64 is liye ke jawab mein quotes/newlines JS string ko na toren.
         */
        @JavascriptInterface
        fun httpPostAsync(url: String, authHeader: String, body: String, reqId: String, timeoutMs: Int) =
            httpAsync("POST", url, authHeader, body, reqId, timeoutMs)

        // Not exposed to WebView: legacy capability is quarantined.
        fun httpGetAsync(url: String, authHeader: String, reqId: String, timeoutMs: Int) =
            httpAsync("GET", url, authHeader, "", reqId, timeoutMs)

        private fun httpAsync(method: String, url: String, authHeader: String, body: String, reqId: String, timeoutMs: Int) {
            if (httpClosed) return
            val talk=reqId.startsWith("ft_")
            if(!talk) return // No generic JavaScript HTTP proxy; native typed Chat has its own transport.
            val talkOwner=fishTalkId
            fun currentTalk()=!talk || (talkOwner!=null && talkOwner==fishTalkId && voiceForeground())
            if(talk && (!currentTalk() || method!="POST" || !Regex("ft_${talkOwner}_[1-5]").matches(reqId) ||
                body.toByteArray(Charsets.UTF_8).size>16384 || !com.maya.ai.voice.FishTalkProtocol.allowedUrl(url) || fishTalkRequests.putIfAbsent(reqId,true)!=null)) return
            val job = com.maya.ai.net.CancelableRequest()
            if (httpRequests.putIfAbsent(reqId, job) != null) return
            if (httpClosed || !currentTalk()) { httpRequests.remove(reqId, job); job.cancel(); return }
            // A suspended WebView must not leave a slow/dripping socket alive indefinitely.
            val deadline = try {
                httpDeadlines.schedule(Runnable { job.cancel() }, timeoutMs.coerceIn(1, 25000).toLong(), java.util.concurrent.TimeUnit.MILLISECONDS)
            } catch (_: java.util.concurrent.RejectedExecutionException) {
                httpRequests.remove(reqId, job); job.cancel(); return
            }
            Thread {
                var code = 0
                var txt = ""
                try {
                    if(!currentTalk()) {job.cancel();return@Thread}
                    val conn = URL(url).openConnection() as HttpURLConnection
                    if(talk) conn.setFixedLengthStreamingMode(body.toByteArray(Charsets.UTF_8).size)
                    if (!job.attach(conn)) return@Thread
                    conn.requestMethod = method
                    conn.instanceFollowRedirects = false
                    conn.doOutput = method == "POST"
                    conn.connectTimeout = timeoutMs.coerceIn(1, 25000)
                    conn.readTimeout = timeoutMs.coerceIn(1, 25000)
                    if (method == "POST") conn.setRequestProperty("Content-Type", "application/json")
                    conn.setRequestProperty("Accept", if (method == "POST") "application/json" else "*/*")
                    if (authHeader.isNotEmpty()) conn.setRequestProperty("Authorization", authHeader)
                    if (job.cancelled) return@Thread
                    if (method == "POST") conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
                    code = conn.responseCode
                    val stream = if (code in 200..399) conn.inputStream else conn.errorStream
                    txt = stream?.bufferedReader()?.use { reader ->
                        val out = StringBuilder()
                        val buffer = CharArray(8192)
                        while (!job.cancelled) {
                            val n = reader.read(buffer)
                            if (n < 0) break
                            if (out.length + n > (if(reqId.startsWith("ft_")) 65536 else 8_000_000)) throw java.io.IOException("Response too large")
                            out.append(buffer, 0, n)
                        }
                        out.toString()
                    } ?: ""
                } catch (_: Exception) {
                    code = 0; txt = "network error" // Do not return URLs, auth or raw exception text.
                } finally {
                    deadline.cancel(false); job.close(); httpRequests.remove(reqId, job)
                }
                if (!job.cancelled) {
                    val b64 = Base64.encodeToString(txt.toByteArray(Charsets.UTF_8), Base64.NO_WRAP)
                    evalAsync("window.__httpDone && window.__httpDone('" + jsEscape(reqId) + "'," + code + ",'" + b64 + "')")
                }
            }.start()
        }

        @JavascriptInterface
        fun cancelHttpPost(reqId: String) {if(reqId.startsWith("ft_")) httpRequests.remove(reqId)?.cancel()}

        // Not exposed to WebView: legacy capability is quarantined.
        fun httpGet(url: String, authHeader: String): String {
            return try {
                val conn = URL(url).openConnection() as HttpURLConnection
                conn.connectTimeout = 5000
                conn.readTimeout = 8000
                if (authHeader.isNotEmpty()) conn.setRequestProperty("Authorization", authHeader)
                val code = conn.responseCode
                val txt = (if (code in 200..399) conn.inputStream else conn.errorStream)
                    ?.bufferedReader()?.use { it.readText() } ?: ""
                conn.disconnect()
                JSONObject().put("status", code).put("body", txt).toString()
            } catch (e: Exception) {
                JSONObject().put("status", 0).put("body", e.message ?: "error").toString()
            }
        }

        /**
         * 🐟 BINARY HTTP — jab jawab MATN nahi, BYTES ho (misaal: Fish Audio ka MP3).
         *
         * httpPostAsync() jawab ko bufferedReader().readText() se parhta hai aur phir
         * UTF-8 bytes ka base64 banata hai. Matn ke liye theek — magar MP3 par ye
         * TABAHI hai: har ghair-UTF8 byte U+FFFD ban kar audio barbaad kar deta hai.
         * Ye version raw bytes uthata hai, chhuta nahi, seedha base64 karta hai.
         *
         * Saath hi custom headers bhi bhejta hai — Fish ko `model: s2.1-pro-free`
         * chahiye, jo purana bridge bhej hi nahi sakta tha.
         *
         * Ghalati ka jawab bhi bytes hi mein aata hai (JSON), JS use atob kar ke
         * parh leta hai — is liye kamyabi aur nakami dono ka ek hi raasta hai.
         *
         *   window.__binDone(reqId, status, base64Body, contentType, errText)
         */
        // Not exposed to WebView: legacy capability is quarantined.
        fun httpBytes(method: String, url: String, headersJson: String, body: String, reqId: String, timeoutMs: Int) {
            Thread {
                var code = 0
                var b64 = ""
                var ctype = ""
                var err = ""
                var conn: HttpURLConnection? = null
                try {
                    val m = if (method.isBlank()) "GET" else method.uppercase(java.util.Locale.US)
                    conn = URL(url).openConnection() as HttpURLConnection
                    conn.requestMethod = m
                    conn.connectTimeout = if (timeoutMs > 0) timeoutMs else 12000
                    conn.readTimeout = if (timeoutMs > 0) timeoutMs else 30000
                    conn.instanceFollowRedirects = true
                    if (headersJson.isNotBlank()) {
                        val h = JSONObject(headersJson)
                        val it = h.keys()
                        while (it.hasNext()) {
                            val k = it.next()
                            conn.setRequestProperty(k, h.optString(k, ""))
                        }
                    }
                    if (m == "POST" || m == "PUT" || m == "PATCH") {
                        conn.doOutput = true
                        conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
                    }
                    code = conn.responseCode
                    ctype = conn.contentType ?: ""
                    val stream = if (code in 200..299) conn.inputStream else conn.errorStream
                    val bos = java.io.ByteArrayOutputStream()
                    if (stream != null) {
                        val buf = ByteArray(16384)
                        stream.use { s ->
                            while (true) {
                                val n = s.read(buf)
                                if (n < 0) break
                                bos.write(buf, 0, n)
                                if (bos.size() > 24_000_000) break        /* 24 MB ki hadd */
                            }
                        }
                    }
                    b64 = Base64.encodeToString(bos.toByteArray(), Base64.NO_WRAP)
                } catch (e: Exception) {
                    code = 0
                    err = e.message ?: "network error"
                } finally {
                    try { conn?.disconnect() } catch (e: Exception) {}
                }
                evalAsync(
                    "window.__binDone && window.__binDone('" + jsEscape(reqId) + "'," + code +
                    ",'" + b64 + "','" + jsEscape(ctype) + "','" + jsEscape(err) + "')"
                )
            }.start()
        }

        /**
         * 🎙️ EDGE TTS — muft, be-hisaab neural awaaz (asli Urdu bhi).
         *
         * JS ye kaam khud kyun nahi kar sakta? Kyun ke Microsoft ka WebSocket
         * Origin/User-Agent/Pragma headers maangta hai, aur browser ka
         * `new WebSocket()` API custom headers bhejne hi nahi deta. Native side
         * par ye pabandi nahi — is liye poora WebSocket neeche Kotlin mein hai.
         *
         * JS bas SSML banata hai; hum MP3 bytes base64 kar ke wapas dete hain:
         *     window.__edgeDone(reqId, ok, base64Mp3OrError)
         */
        // Not exposed to WebView: legacy capability is quarantined.
        fun edgeTts(ssml: String, reqId: String, timeoutMs: Int) {
            Thread {
                var ok = false
                var payload: String
                try {
                    val mp3 = EdgeTts.synth(ssml, if (timeoutMs > 0) timeoutMs else 20000)
                    payload = Base64.encodeToString(mp3, Base64.NO_WRAP)
                    ok = true
                } catch (e: Exception) {
                    payload = e.message ?: "edge tts nakaam"
                }
                evalAsync(
                    "window.__edgeDone && window.__edgeDone('" + jsEscape(reqId) + "'," + ok +
                    ",'" + jsEscape(payload) + "')"
                )
            }.start()
        }

        /** Edge TTS ki poori awaaz list (JSON) — key ki zaroorat nahi. */
        // Not exposed to WebView: legacy capability is quarantined.
        fun edgeVoices(): String = try {
            val u = "https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list" +
                "?trustedclienttoken=6A5AA1D4EAFF4E9FB37E23D68491D6F4"
            val conn = URL(u).openConnection() as HttpURLConnection
            conn.connectTimeout = 8000
            conn.readTimeout = 12000
            conn.setRequestProperty("User-Agent", EdgeTts.userAgent())
            conn.setRequestProperty("Accept", "*/*")
            val code = conn.responseCode
            val txt = (if (code in 200..399) conn.inputStream else conn.errorStream)
                ?.bufferedReader()?.use { it.readText() } ?: ""
            conn.disconnect()
            JSONObject().put("status", code).put("body", txt).toString()
        } catch (e: Exception) {
            JSONObject().put("status", 0).put("body", e.message ?: "error").toString()
        }

        /**
         * 👁️ NAZAR — screen par abhi kya hai? (P7a)
         *
         * SIRF PARHTA HAI. Kuch chhuta nahi, kuch dabata nahi.
         * Accessibility service band ho to saaf keh deta hai — jhoot nahi.
         */
        // Not exposed to WebView: legacy capability is quarantined.
        fun uiDump(max: Int): String {
            return try {
                val svc = com.maya.ai.AutoSendService.instance
                if (svc == null)
                    "{\"ok\":false,\"why\":\"MAYA AutoSend accessibility service band hai\"}"
                else svc.dumpScreen(max)
            } catch (e: Exception) {
                val o = JSONObject()
                o.put("ok", false)
                o.put("why", e.message ?: "screen parhne mein masla")
                o.toString()
            }
        }

        /* ═══ 🖐️ AMAL (Roadmap Phase 1, S2) — MayaAct bridge ═══
           JS (maya_act tool) -> Kotlin safety engine. Koi naya behavior nahi:
           saare guards MayaAct mein hain (blocked apps, sensitive fields,
           rate/attempts/timeout, touch-abort, kill-switch). */

        // Not exposed to WebView: legacy capability is quarantined.
        fun mayaAct(json: String): String {
            return try {
                MayaAct.enqueue(this@MainActivity, JSONObject(json))
            } catch (e: Exception) {
                val o = JSONObject()
                o.put("ok", false)
                o.put("why", "mayaAct masla: " + (e.message ?: "?"))
                o.toString()
            }
        }

        // Not exposed to WebView: legacy capability is quarantined.
        fun mayaStop() {
            try { MayaAct.killAll(this@MainActivity) } catch (e: Exception) {}
        }

        // Not exposed to WebView: legacy capability is quarantined.
        fun mayaStatus(): String = try { MayaAct.status() } catch (e: Exception) { "{}" }

        /** Persistent prefs (boot autostart wake) */
        @JavascriptInterface
        fun setPref(k: String, v: Boolean) { if(!voiceForeground() || !workspaceSettingsOpen || !LegacyCapabilities.booleanSetting(k)) return; try { prefs().edit().putBoolean(k, v).apply() } catch (e: Exception) {} }

        @JavascriptInterface
        fun getPref(k: String): Boolean = try { if(k=="wake" || LegacyCapabilities.booleanSetting(k)) prefs().getBoolean(k, false) else false } catch (e: Exception) { false }

        @JavascriptInterface
        fun getPrefString(k: String): String = try { if(k in setOf("wake_lang","mic_zoom")) prefs().getString(k, "") ?: "" else "" } catch (e: Exception) { "" }

        /**
         * 🩺 KAAN DOCTOR (P8b) — kaan ka poora haal, andaza nahi.
         * Sab se ahem: phone ka default voice-input service ka NAAM.
         */
        @JavascriptInterface
        fun micDoctor(): String {
            val o = JSONObject()
            try {
                o.put("mic", ContextCompat.checkSelfPermission(
                    this@MainActivity, Manifest.permission.RECORD_AUDIO
                ) == PackageManager.PERMISSION_GRANTED)
                o.put("avail", SpeechRecognizer.isRecognitionAvailable(this@MainActivity))

                /* YEHI asal mujrim ho sakta hai */
                val svc = try {
                    Settings.Secure.getString(contentResolver, "voice_recognition_service") ?: ""
                } catch (e: Exception) { "" }
                o.put("svc", svc)
                o.put("aiai", svc.contains("AiAi", true) || svc.contains("SystemIntelligence", true)
                        || svc.contains("systemui", true))

                var onDev = false
                if (Build.VERSION.SDK_INT >= 31) {
                    onDev = try { SpeechRecognizer.isOnDeviceRecognitionAvailable(this@MainActivity) }
                            catch (e: Exception) { false }
                }
                o.put("ondevice", onDev)
                o.put("using", lastRecognizerKind)

                /* Google ki speech app maujood aur chalu hai? */
                var g = "nahi"
                try {
                    val ai = packageManager.getApplicationInfo("com.google.android.tts", 0)
                    g = if (ai.enabled) "enabled" else "DISABLED"
                } catch (e: Exception) { g = "nahi" }
                o.put("gtts", g)

                o.put("battOk", try { batteryUnrestricted() } catch (e: Exception) { false })
                o.put("wakeOn", try { prefs().getBoolean("wake", false) } catch (e: Exception) { false })
                o.put("sdk", Build.VERSION.SDK_INT)
            } catch (e: Exception) {
                o.put("err", e.message ?: "?")
            }
            return o.toString()
        }

        /**
         * 🧪 MIC TEST (P8c) — kamre ka shor, aap ki awaaz, farq (SNR),
         * aur kaunsa effect is device par SACH MEIN chala.
         */
        // Not exposed to WebView: legacy capability is quarantined.
        fun micTest(ms: Int, zoom: Double): String {
            if (ContextCompat.checkSelfPermission(
                    this@MainActivity, Manifest.permission.RECORD_AUDIO
                ) != PackageManager.PERMISSION_GRANTED) {
                requestMicPermission()
                return "{\"ok\":false,\"why\":\"mic ki ijazat nahi\"}"
            }
            return try { MicKit.test(ms, zoom.toFloat()) }
            catch (e: Exception) { "{\"ok\":false,\"why\":\"" + (e.message ?: "?") + "\"}" }
        }

        /** Zaroori settings ke seedhe darwaze (menu mein bhatakna khatam) */
        @JavascriptInterface
        fun openSetting(which: String): Boolean {
            if(!voiceForeground() || !workspaceSettingsOpen || which !in setOf("ondevice","voice","input")) return false
            /* v5.9.4 — ON-DEVICE zubaan ka asli darwaza. Doctor ka text "[ON-DEVICE]
               dabao" kehta tha magar aisa button kahin THA HI NAHI (sirf likha tha) —
               user dhoondhta reh jata. Ab ASLI button ye chain kholta hai:
               1. Gboard → Voice typing (wahan "Faster/Offline speech recognition"
                  mein zubaan download hoti hai — Android 13/14 ka reliable raasta)
               2. Voice-input picker
               3. aam Settings */
            if (which == "ondevice") {
                val tries = listOf(
                    Intent().setComponent(android.content.ComponentName(
                        "com.google.android.inputmethod.latin",
                        "com.google.android.apps.inputmethod.latin.voiceime.settings.VoiceSettingsActivity")),
                    Intent(Settings.ACTION_VOICE_INPUT_SETTINGS),
                    Intent(Settings.ACTION_SETTINGS)
                )
                for (i in tries) {
                    try { startActivity(i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); return true }
                    catch (e: Exception) {}
                }
                return false
            }
            return try {
                val act = when (which) {
                    "voice" -> Settings.ACTION_VOICE_INPUT_SETTINGS
                    "tts" -> "com.android.settings.TTS_SETTINGS"
                    "input" -> Settings.ACTION_INPUT_METHOD_SETTINGS
                    "battery" -> Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS
                    else -> Settings.ACTION_SETTINGS
                }
                startActivity(Intent(act).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                true
            } catch (e: Exception) {
                try {
                    startActivity(Intent(Settings.ACTION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                    true
                } catch (e2: Exception) { false }
            }
        }

        /** v5.7.0 — wake word ki zubaan JS se service tak pohanchane ke liye */
        @JavascriptInterface
        fun setPrefString(k: String, v: String) {
            if(!voiceForeground() || !workspaceSettingsOpen || !LegacyCapabilities.stringSetting(k,v)) return
            try { prefs().edit().putString(k, v).apply() } catch (e: Exception) {}
        }

        @JavascriptInterface
        fun clearPref(k: String) { if(!voiceForeground() || !workspaceSettingsOpen || k !in setOf("sukoon","mic_near","wake_lang","mic_zoom")) return; try { prefs().edit().remove(k).apply() } catch (e: Exception) {} }

        /** Auto-listen mode — screen jagti rahe */
        // Not exposed to WebView: legacy capability is quarantined.
        fun keepScreenOn(on: Boolean) {
            runOnUiThread {
                if (on) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            }
        }
    }

    /* ================= HELPERS ================= */

    fun evalAsyncPublic(js: String) { evalAsync(js) }

    private fun prefs() = getSharedPreferences("maya", Context.MODE_PRIVATE)

    /** Recheck the saved switch at execution time; never move the Activity away
     * from the foreground to show battery settings while acquiring its mic. */
    private fun ensureWakeAlive() {
        if (!prefs().getBoolean("wake", false)) return
        android.os.Handler(Looper.getMainLooper()).postDelayed({
            if (!prefs().getBoolean("wake", false) || isFinishing || isDestroyed) return@postDelayed
            if (WakeWordService.instance == null) WakeWordService.start(this@MainActivity)
        }, 2500)
    }

    private fun evalAsync(js: String) {
        webView.post { webView.evaluateJavascript(js, null) }
    }

    /* ═══════════════════════════════════════════════════════════════════
       🎯 RECOGNIZER KI SEERHI  (P8b)
       -------------------------------------------------------------------
       Android 12+ par bohat phones (khaas kar TECNO/HiOS) ka default voice
       input "Android System Intelligence" (AiAi) hota hai — aur wo
       SpeechRecognizer API ke sath THEEK KAAM NAHI KARTA. Nateeja: mic
       chalta hai, band hota hai, aur kuch nahi hota.

       Is liye ab teen darje:
         1. Android 12+ ka ON-DEVICE recognizer (isi kaam ke liye bana, offline)
         2. Google ka recognizer ZABARDASTI (ComponentName se)
         3. aam wala (jo ab tak istemal ho raha tha)
       Aur jo chala, uska naam yaad rakha jata hai — DOCTOR usay dikhata hai.
       ═══════════════════════════════════════════════════════════════════ */
    var lastRecognizerKind: String = "-"

    fun makeRecognizer(preferOnDevice: Boolean = true): SpeechRecognizer {
        if (preferOnDevice && Build.VERSION.SDK_INT >= 31) {
            try {
                if (SpeechRecognizer.isOnDeviceRecognitionAvailable(this)) {
                    lastRecognizerKind = "on-device"
                    return SpeechRecognizer.createOnDeviceSpeechRecognizer(this)
                }
            } catch (e: Exception) {}
        }
        try {
            val cn = android.content.ComponentName(
                "com.google.android.googlequicksearchbox",
                "com.google.android.voicesearch.serviceapi.GoogleRecognitionService"
            )
            val pm = packageManager
            val intent = Intent(android.speech.RecognitionService.SERVICE_INTERFACE)
            val list = pm.queryIntentServices(intent, 0)
            for (ri in list) {
                if (ri.serviceInfo != null && ri.serviceInfo.packageName == cn.packageName) {
                    lastRecognizerKind = "google"
                    return SpeechRecognizer.createSpeechRecognizer(this, cn)
                }
            }
        } catch (e: Exception) {}
        lastRecognizerKind = "default"
        return SpeechRecognizer.createSpeechRecognizer(this)
    }

    private fun jsEscape(s: String): String = s
        .replace("\\", "\\\\")
        .replace("'", "\\'")
        .replace("\"", "\\\"")
        .replace("\n", " ")
        .replace("\r", " ")

    private fun toast(msg: String) {
        runOnUiThread { Toast.makeText(this, msg, Toast.LENGTH_SHORT).show() }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ch = NotificationChannel(
                CHANNEL_ID, "MAYA Notifications", NotificationManager.IMPORTANCE_DEFAULT
            )
            getSystemService(NotificationManager::class.java).createNotificationChannel(ch)
        }
    }

    private fun requestMicPermission() {
        runOnUiThread {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.RECORD_AUDIO), REQ_PERMS)
        }
    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU)
            ActivityCompat.requestPermissions(
                this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQ_PERMS
            )
    }
}

/* ═══════════════════════════════════════════════════════════════════════════
   🎙️  EDGE TTS  —  MUFT, BE-HISAAB, ASLI NEURAL AWAAZ   (app v4.7.0)
   ---------------------------------------------------------------------------
   Ye wahi engine hai jo Microsoft Edge browser ke "Read aloud" ke peeche hai:
   200+ Azure neural awaazein, 50+ zabanein — koi API key nahi, koi quota nahi.
   MAYA ke liye sab se ahem: ASLI URDU awaazein (ur-PK-UzmaNeural / AsadNeural).

   To phir pehle kyun nahi chalta tha?
   -----------------------------------
   Is service ka WebSocket handshake in headers ke bagair qubool nahi hota:
       Origin: chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold
       User-Agent: ...Edg/143.0.0.0
       Pragma / Cache-Control / Sec-WebSocket-Version
   Browser ka `new WebSocket(url)` in headers ko set KAR HI NAHI SAKTA — ye
   JavaScript ki hadd hai, hamara bug nahi. Is liye app ka purana JS wala
   edgeTTS_speak() hamesha khamoshi se nakaam hota tha (default OFF pada tha).

   Ilaj: WebSocket ab KOTLIN mein hai. Yahan hum har header khud likh sakte
   hain. Neeche RFC-6455 ka chhota client hai — koi nayi library nahi
   (OkHttp bhi nahi), sirf SSLSocket. Is liye build ka koi khatra nahi.

   Auth: Sec-MS-GEC = SHA-256( windows-filetime(5 min par gol kiya) + token ),
   bilkul wesa hi jaisa rany2/edge-tts karta hai.
   ═══════════════════════════════════════════════════════════════════════════ */

private object EdgeTts {
    private const val TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4"
    private const val CHROME_FULL = "143.0.3650.75"
    private const val CHROME_MAJOR = "143"
    private const val HOST = "speech.platform.bing.com"
    private const val UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/$CHROME_MAJOR.0.0.0 Safari/537.36 Edg/$CHROME_MAJOR.0.0.0"

    fun userAgent(): String = UA

    private class Frame(val opcode: Int, val payload: ByteArray)

    /* Sec-MS-GEC — 5 minute ke block par SHA-256 */
    private fun gec(): String {
        var ticks = (System.currentTimeMillis() / 1000.0) + 11644473600.0
        ticks -= ticks % 300.0
        ticks *= 1.0e9 / 100.0
        val toHash = String.format(java.util.Locale.US, "%.0f", ticks) + TOKEN
        val dig = java.security.MessageDigest.getInstance("SHA-256")
            .digest(toHash.toByteArray(Charsets.US_ASCII))
        val sb = StringBuilder(64)
        for (b in dig) sb.append(String.format(java.util.Locale.US, "%02X", b))
        return sb.toString()
    }

    private fun hex32(): String {
        val r = java.security.SecureRandom()
        val b = ByteArray(16); r.nextBytes(b)
        val sb = StringBuilder(32)
        for (x in b) sb.append(String.format(java.util.Locale.US, "%02x", x))
        return sb.toString()
    }

    /* Python ke date_to_string() ki hoo-ba-hoo naqal */
    private fun stamp(): String {
        val f = java.text.SimpleDateFormat("EEE MMM dd yyyy HH:mm:ss", java.util.Locale.US)
        f.timeZone = java.util.TimeZone.getTimeZone("UTC")
        return f.format(java.util.Date()) + " GMT+0000 (Coordinated Universal Time)"
    }

    private fun readLine(ins: java.io.InputStream): String {
        val bos = java.io.ByteArrayOutputStream()
        var prev = -1
        while (true) {
            val c = ins.read()
            if (c < 0) break
            if (prev == 13 && c == 10) { val a = bos.toByteArray(); return String(a, 0, maxOf(0, a.size - 1), Charsets.ISO_8859_1) }
            bos.write(c); prev = c
        }
        return String(bos.toByteArray(), Charsets.ISO_8859_1)
    }

    private fun readFully(ins: java.io.InputStream, n: Int): ByteArray {
        val out = ByteArray(n); var got = 0
        while (got < n) {
            val r = ins.read(out, got, n - got)
            if (r < 0) throw java.io.IOException("connection band ho gaya")
            got += r
        }
        return out
    }

    /* client -> server frame (mask lagana LAZMI hai) */
    private fun sendFrame(out: java.io.OutputStream, opcode: Int, data: ByteArray) {
        val head = java.io.ByteArrayOutputStream()
        head.write(0x80 or opcode)
        val n = data.size
        when {
            n < 126 -> head.write(0x80 or n)
            n < 65536 -> { head.write(0x80 or 126); head.write((n shr 8) and 255); head.write(n and 255) }
            else -> {
                head.write(0x80 or 127)
                for (i in 7 downTo 0) head.write(((n.toLong() shr (8 * i)) and 255L).toInt())
            }
        }
        val mask = ByteArray(4); java.security.SecureRandom().nextBytes(mask)
        head.write(mask)
        val masked = ByteArray(n)
        for (i in 0 until n) masked[i] = (data[i].toInt() xor mask[i % 4].toInt()).toByte()
        out.write(head.toByteArray()); out.write(masked); out.flush()
    }

    private fun sendText(out: java.io.OutputStream, s: String) =
        sendFrame(out, 1, s.toByteArray(Charsets.UTF_8))

    /* server -> client frame; tukron mein aaye to jor deta hai */
    private fun readFrame(ins: java.io.InputStream): Frame {
        var firstOp = -1
        val acc = java.io.ByteArrayOutputStream()
        while (true) {
            val b0 = ins.read(); if (b0 < 0) throw java.io.IOException("stream khatam")
            val fin = (b0 and 0x80) != 0
            val op = b0 and 0x0F
            val b1 = ins.read(); if (b1 < 0) throw java.io.IOException("stream khatam")
            var len = (b1 and 0x7F).toLong()
            if (len == 126L) { val e = readFully(ins, 2); len = (((e[0].toInt() and 255) shl 8) or (e[1].toInt() and 255)).toLong() }
            else if (len == 127L) {
                val e = readFully(ins, 8); var v = 0L
                for (i in 0 until 8) v = (v shl 8) or (e[i].toLong() and 255L)
                len = v
            }
            if (len > 8_000_000L) throw java.io.IOException("frame bohat bara")
            val body = readFully(ins, len.toInt())
            if (op != 0 && firstOp < 0) firstOp = op
            acc.write(body)
            if (fin) return Frame(if (firstOp < 0) op else firstOp, acc.toByteArray())
        }
    }

    /* ═══ poora kaam: SSML andar, MP3 bytes bahar ═══ */
    fun synth(ssml: String, timeoutMs: Int): ByteArray {
        val path = "/consumer/speech/synthesize/readaloud/edge/v1" +
            "?TrustedClientToken=$TOKEN&Sec-MS-GEC=${gec()}&Sec-MS-GEC-Version=1-$CHROME_FULL" +
            "&ConnectionId=${hex32()}"

        val sock = javax.net.ssl.SSLSocketFactory.getDefault().createSocket() as javax.net.ssl.SSLSocket
        try {
            sock.connect(java.net.InetSocketAddress(HOST, 443), timeoutMs)
            sock.soTimeout = timeoutMs
            /* Hostname ki tasdeeq LAZMI — bina is ke raw SSLSocket kisi bhi
               sahih certificate ko qubool kar leta hai (MITM ka darwaza). */
            sock.sslParameters = sock.sslParameters.also { it.endpointIdentificationAlgorithm = "HTTPS" }
            sock.startHandshake()

            val out = java.io.BufferedOutputStream(sock.outputStream)
            val ins = java.io.BufferedInputStream(sock.inputStream)

            val kb = ByteArray(16); java.security.SecureRandom().nextBytes(kb)
            val wsKey = Base64.encodeToString(kb, Base64.NO_WRAP)

            val req = StringBuilder()
            req.append("GET ").append(path).append(" HTTP/1.1\r\n")
            req.append("Host: ").append(HOST).append("\r\n")
            req.append("Upgrade: websocket\r\n")
            req.append("Connection: Upgrade\r\n")
            req.append("Sec-WebSocket-Key: ").append(wsKey).append("\r\n")
            req.append("Sec-WebSocket-Version: 13\r\n")
            req.append("Pragma: no-cache\r\n")
            req.append("Cache-Control: no-cache\r\n")
            req.append("Origin: chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold\r\n")
            req.append("User-Agent: ").append(UA).append("\r\n")
            req.append("Accept-Language: en-US,en;q=0.9\r\n")
            req.append("\r\n")
            out.write(req.toString().toByteArray(Charsets.ISO_8859_1)); out.flush()

            val status = readLine(ins)
            if (!status.contains(" 101")) {
                while (true) { val l = readLine(ins); if (l.isEmpty()) break }
                throw java.io.IOException("Edge ne handshake mana kiya: $status")
            }
            while (true) { val l = readLine(ins); if (l.isEmpty()) break }

            sendText(out,
                "X-Timestamp:" + stamp() + "\r\n" +
                "Content-Type:application/json; charset=utf-8\r\n" +
                "Path:speech.config\r\n\r\n" +
                "{\"context\":{\"synthesis\":{\"audio\":{\"metadataoptions\":{" +
                "\"sentenceBoundaryEnabled\":\"false\",\"wordBoundaryEnabled\":\"false\"}," +
                "\"outputFormat\":\"audio-24khz-48kbitrate-mono-mp3\"}}}}\r\n")

            sendText(out,
                "X-RequestId:" + hex32() + "\r\n" +
                "Content-Type:application/ssml+xml\r\n" +
                "X-Timestamp:" + stamp() + "Z\r\n" +
                "Path:ssml\r\n\r\n" + ssml)

            val audio = java.io.ByteArrayOutputStream()
            val deadline = System.currentTimeMillis() + timeoutMs
            while (System.currentTimeMillis() < deadline) {
                val f = readFrame(ins)
                when (f.opcode) {
                    1 -> { if (String(f.payload, Charsets.UTF_8).contains("Path:turn.end")) return finish(audio) }
                    2 -> {
                        val p = f.payload
                        if (p.size > 2) {
                            val hlen = ((p[0].toInt() and 255) shl 8) or (p[1].toInt() and 255)
                            if (p.size > hlen + 2) audio.write(p, hlen + 2, p.size - hlen - 2)
                        }
                    }
                    8 -> return finish(audio)
                    9 -> sendFrame(out, 10, f.payload)
                }
            }
            return finish(audio)
        } finally {
            try { sock.close() } catch (e: Exception) {}
        }
    }

    private fun finish(bos: java.io.ByteArrayOutputStream): ByteArray {
        if (bos.size() == 0) throw java.io.IOException("Edge se koi audio nahi aayi")
        return bos.toByteArray()
    }
}
