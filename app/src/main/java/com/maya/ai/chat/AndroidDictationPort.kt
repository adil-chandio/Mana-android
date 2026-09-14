package com.maya.ai.chat

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.maya.ai.MainActivity
import com.maya.ai.WakeWordService

/** No TTS, provider key, audio file, Activity navigation or recognizer fallback ladder.
 * The owner explicitly chooses on-device-only OR their installed default system service. */
class AndroidDictationPort(private val activity: AppCompatActivity): NativeDictation.Port {
    private var recognizer: SpeechRecognizer?=null
    private var lease: Any?=null
    private var readinessEpoch=0L
    private var checkedAt: Long?=null
    private var checkedLanguage=""
    private var checkedOnDevice=true
    private val main get()=(activity as? MainActivity)?.takeIf {MainActivity.instance===it}
    private fun permission()=ContextCompat.checkSelfPermission(activity,Manifest.permission.RECORD_AUDIO)==PackageManager.PERMISSION_GRANTED
    private fun runtimeReady()=NativeChatReadiness.runtime(
        activity.getSharedPreferences("maya",0).getBoolean("wake",false),WakeWordService.instance!=null,
        WakeWordService.fishOutputActive,WakeWordService.haal,com.maya.ai.MayaAct.hasPendingActions())==NativeChatReadiness.Reason.READY
    /** Package/service presence only: no engine creation, mic permission, audio, download or language guarantee. */
    fun serviceFailure(onDeviceOnly: Boolean): NativeDictation.State?=try {
        if(onDeviceOnly) {
            if(Build.VERSION.SDK_INT>=31 && SpeechRecognizer.isOnDeviceRecognitionAvailable(activity)) null
            else NativeDictation.State.ON_DEVICE_UNAVAILABLE
        } else if(SpeechRecognizer.isRecognitionAvailable(activity)) null else NativeDictation.State.SYSTEM_UNAVAILABLE
    } catch(_: Exception) {NativeDictation.State.UNAVAILABLE}
    override fun check(language: String,onDeviceOnly: Boolean,done: (NativeDictation.State?)->Unit) {
        val ticket=++readinessEpoch;checkedAt=null
        val owner=main
        if(owner==null) {done(NativeDictation.State.MAIN_REQUIRED);return}
        if(language !in NativeDictation.LANGUAGES) {done(NativeDictation.State.LANGUAGE_UNSUPPORTED);return}
        serviceFailure(onDeviceOnly)?.let {done(it);return}
        if(!permission()) {done(NativeDictation.State.PERMISSION_REQUIRED);return}
        if(!runtimeReady()) {done(NativeDictation.State.BLOCKED);return}
        owner.nativeChatReady {reason ->
            if(ticket!=readinessEpoch) return@nativeChatReady
            val ready=reason==NativeChatReadiness.Reason.READY && runtimeReady()
            if(ready) {checkedAt=android.os.SystemClock.elapsedRealtime();checkedLanguage=language;checkedOnDevice=onDeviceOnly}
            done(if(ready) null else NativeDictation.State.BLOCKED)
        }
    }
    override fun start(language: String,onDeviceOnly: Boolean,events: NativeDictation.Events) {
        if(!permission()) {events.error(NativeDictation.State.PERMISSION_REQUIRED);return}
        val owner=main
        if(owner==null || !runtimeReady() || recognizer!=null) {events.error(NativeDictation.State.BLOCKED);return}
        if(language !in NativeDictation.LANGUAGES) {events.error(NativeDictation.State.LANGUAGE_UNSUPPORTED);return}
        serviceFailure(onDeviceOnly)?.let {events.error(it);return}
        val checkTime=checkedAt;checkedAt=null
        if(checkTime==null || android.os.SystemClock.elapsedRealtime()-checkTime !in 0..1499 || language!=checkedLanguage || onDeviceOnly!=checkedOnDevice) {
            events.error(NativeDictation.State.BLOCKED);return
        }
        val token=Any()
        if(!owner.acquireComposerMicrophone(token)) {events.error(NativeDictation.State.BLOCKED);return}
        lease=token
        try {
            val engine=if(onDeviceOnly && Build.VERSION.SDK_INT>=31) SpeechRecognizer.createOnDeviceSpeechRecognizer(activity)
                else SpeechRecognizer.createSpeechRecognizer(activity)
            recognizer=engine
            fun current()=lease===token && owner.composerMicrophoneCurrent(token) && runtimeReady()
            fun text(bundle: Bundle?)=bundle?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull() ?: ""
            engine.setRecognitionListener(object : RecognitionListener {
                override fun onReadyForSpeech(params: Bundle?) {if(current()) events.ready() else events.error(NativeDictation.State.BLOCKED)}
                override fun onBeginningOfSpeech() {}
                override fun onRmsChanged(rmsdB: Float) {if(lease===token && !current()) events.error(NativeDictation.State.BLOCKED)}
                override fun onBufferReceived(buffer: ByteArray?) {} // Never store/log audio buffers.
                override fun onEndOfSpeech() {}
                override fun onError(error: Int) {
                    if(lease!==token) return
                    events.error(recognitionFailure(error))
                }
                override fun onResults(results: Bundle?) {if(current()) events.result(text(results)) else if(lease===token) events.error(NativeDictation.State.BLOCKED)}
                override fun onPartialResults(partialResults: Bundle?) {if(current()) events.partial(text(partialResults))}
                override fun onEvent(eventType: Int,params: Bundle?) {}
            })
            engine.startListening(Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE,language)
                putExtra(RecognizerIntent.EXTRA_MAX_RESULTS,1)
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS,true)
            })
        } catch(_: Exception) {stop();events.error(NativeDictation.State.ERROR)}
    }
    companion object {
        internal fun recognitionFailure(error: Int)=when(error) {
            SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> NativeDictation.State.PERMISSION_REQUIRED
            SpeechRecognizer.ERROR_NO_MATCH,SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> NativeDictation.State.NO_MATCH
            SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> NativeDictation.State.BLOCKED
            SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED -> NativeDictation.State.LANGUAGE_UNSUPPORTED
            SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE -> NativeDictation.State.LANGUAGE_UNAVAILABLE
            SpeechRecognizer.ERROR_NETWORK,SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> NativeDictation.State.NETWORK_ERROR
            else -> NativeDictation.State.ERROR
        }
    }
    override fun stop() {
        readinessEpoch++;checkedAt=null;checkedLanguage=""
        val token=lease;lease=null
        val engine=recognizer;recognizer=null
        try {engine?.cancel()} catch(_: Exception) {}
        try {engine?.destroy()} catch(_: Exception) {}
        if(token!=null) main?.releaseComposerMicrophone(token)
    }
    override fun requestPermission() {
        // A grant never starts recognition. Owner returns and explicitly starts Voice again.
        if(main!=null && !permission()) ActivityCompat.requestPermissions(activity,arrayOf(Manifest.permission.RECORD_AUDIO),7012)
    }
}
