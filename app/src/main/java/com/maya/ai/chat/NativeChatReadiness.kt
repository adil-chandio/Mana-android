package com.maya.ai.chat

/** Local read-only readiness. A READY snapshot is never network authorization. */
object NativeChatReadiness {
    enum class Reason(val hint: String) {
        NOT_CHECKED("Run the local readiness check first; it sends no request."),
        CHECKING("Reading local assistant state; no request sent."),
        READY("Local assistant is idle at this check. Send still requires consent, a valid key and server authorization."),
        WAKE_ENABLED("Saved Wake setting is ON. Turn Wake OFF in the original Maya; selected Fish voice stays unchanged."),
        WAKE_SERVICE("Wake service is still present. Stop it through the original Maya and wait for its notification to close."),
        FISH_OUTPUT("Selected Fish output is still active. Finish or STOP the old reply; do not change the selected voice."),
        AUDIO_BUSY("The existing audio/microphone owner is busy. Use STOP in the original assistant."),
        AUDIO_UNKNOWN("Existing audio state is unknown; readiness cannot be confirmed."),
        ACTIONS_BUSY("Existing phone actions are queued/running. Stop them using the original automation STOP control."),
        MAIN_TRANSITION("The original Maya screen is closing or not ready. Let it finish before checking again."),
        LEGACY_HTTP("The original Maya still owns a network request. Finish or STOP that request."),
        LEGACY_MIC("The original Maya is recording or waiting for recognition results. Finish or STOP listening."),
        LEGACY_TTS("The original Maya is still speaking. Finish or STOP its reply."),
        UNTRUSTED_VIEW("Original assistant page is not the trusted packaged page; readiness is blocked."),
        JS_LOADING("The original assistant page has not finished loading."),
        JS_WAKE_ENABLED("Wake is ON in the original assistant's UI. Turn that switch OFF there."),
        AUTO_LISTEN_ENABLED("Auto-listen is ON in the original assistant. Turn that switch OFF there."),
        PROACTIVE_ENABLED("Proactive speech is enabled. Turn Proactive OFF in the original assistant for isolated text Chat."),
        NOTIFY_SPEECH_ENABLED("Speak notifications is enabled. Turn it OFF in the original assistant for isolated text Chat."),
        JS_SPEAKING("Original assistant UI reports speaking. Use its STOP control."),
        JS_LISTENING("Original assistant UI reports listening. Use its STOP control."),
        JS_THINKING("Original assistant UI reports a pending reply. Finish or STOP that turn."),
        TURN_BUSY("An original-assistant turn is still owned. Finish or STOP it."),
        INPUT_BUSY("An original-assistant input session is still owned. Finish or STOP it."),
        UI_UNRESPONSIVE("Original assistant did not answer the local readiness check. No network request was sent."),
        CANCELLED("Local readiness check was interrupted. No READY result is assumed."),
        UNKNOWN("Local assistant state could not be validated. No request was sent through this gate.")
    }
    fun restore(value: String?): Reason = Reason.values().firstOrNull { it.name == value }?.let {
        if (it == Reason.CHECKING) Reason.CANCELLED else it
    } ?: Reason.NOT_CHECKED
    fun fromJavascript(value: String?): Reason = jsReasons.firstOrNull { value == "\"${it.name}\"" } ?: Reason.UNKNOWN
    private val jsReasons = setOf(Reason.READY, Reason.JS_LOADING, Reason.JS_WAKE_ENABLED, Reason.AUTO_LISTEN_ENABLED,
        Reason.PROACTIVE_ENABLED, Reason.NOTIFY_SPEECH_ENABLED, Reason.JS_SPEAKING, Reason.JS_LISTENING,
        Reason.JS_THINKING, Reason.TURN_BUSY, Reason.INPUT_BUSY, Reason.UNKNOWN)
    fun runtime(wake: Boolean, service: Boolean, fish: Boolean, audio: String, actions: Boolean): Reason = when {
        fish -> Reason.FISH_OUTPUT
        audio !in setOf("KHALI", "BOL_RAHI", "APP_SUN") -> Reason.AUDIO_UNKNOWN
        audio != "KHALI" -> Reason.AUDIO_BUSY
        actions -> Reason.ACTIONS_BUSY
        wake -> Reason.WAKE_ENABLED
        service -> Reason.WAKE_SERVICE
        else -> Reason.READY
    }
    fun main(transition: Boolean, http: Boolean, microphoneActive: Boolean, speaking: Boolean, trusted: Boolean): Reason = when {
        transition -> Reason.MAIN_TRANSITION
        http -> Reason.LEGACY_HTTP
        microphoneActive -> Reason.LEGACY_MIC
        speaking -> Reason.LEGACY_TTS
        !trusted -> Reason.UNTRUSTED_VIEW
        else -> Reason.READY
    }
    // Fixed script evaluated ONLY in the trusted local MainActivity document.
    // convoMode changes wording/pitch; it is not an active task or auto-listening.
    const val LOCAL_SCRIPT = """(function(){try{
      if (window.__mayaJSOK!==true) return 'JS_LOADING';
      if (typeof settings!=='object' || !settings || typeof TURNS!=='object' || !TURNS ||
          typeof INPUT_SESSION!=='object' || !INPUT_SESSION) return 'UNKNOWN';
      var flags=['wakeWord','autoListen','proactive','notifSpeak'];
      for(var i=0;i<flags.length;i++) if(typeof settings[flags[i]]!=='boolean') return 'UNKNOWN';
      if(typeof speaking!=='boolean'||typeof listening!=='boolean'||typeof thinking!=='boolean'||
         !Object.prototype.hasOwnProperty.call(TURNS,'active')||!Object.prototype.hasOwnProperty.call(INPUT_SESSION,'active')) return 'UNKNOWN';
      if(settings.wakeWord) return 'JS_WAKE_ENABLED';
      if(settings.autoListen) return 'AUTO_LISTEN_ENABLED';
      if(settings.proactive) return 'PROACTIVE_ENABLED';
      if(settings.notifSpeak) return 'NOTIFY_SPEECH_ENABLED';
      if(speaking) return 'JS_SPEAKING';
      if(listening) return 'JS_LISTENING';
      if(thinking) return 'JS_THINKING';
      if(TURNS.active!==null) return 'TURN_BUSY';
      if(INPUT_SESSION.active!==null) return 'INPUT_BUSY';
      return 'READY';
    }catch(e){return 'UNKNOWN';}})()"""
}
