package com.maya.ai.voice

import android.content.Context
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.BaseDataSource
import androidx.media3.datasource.DataSource
import androidx.media3.datasource.DataSpec
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.ProgressiveMediaSource
import androidx.media3.exoplayer.upstream.DefaultLoadErrorHandlingPolicy
import java.io.IOException
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.atomic.AtomicBoolean

/** Plays the provider's MP3 stream as bytes arrive, not after a base64/full-file download. */
@UnstableApi
class FishStreamPlayer(private val context: Context, private val event: (String, String, Int) -> Unit) {
    companion object { private var owner: FishStreamPlayer? = null }
    private val handler = Handler(Looper.getMainLooper())
    private var player: ExoPlayer? = null
    private var generation = 0L
    private var timeout: Runnable? = null

    fun stop() {
        if (owner === this) {
            com.maya.ai.WakeWordService.lastBolAt = System.currentTimeMillis()
            com.maya.ai.WakeWordService.fishOutputActive = false
            owner = null
        }
        generation++
        timeout?.let { handler.removeCallbacks(it) }; timeout = null
        player?.release(); player = null
    }

    fun speak(body: String, headers: String, id: String) {
        owner?.stop()
        stop()
        if (!Regex("[a-zA-Z0-9_]{1,80}").matches(id)) return
        val gen = generation
        var terminal = false
        var started = false
        fun finish(kind: String, status: Int) {
            if (terminal || gen != generation) return
            terminal = true
            stop()
            event(id, kind, status)
        }
        try {
            val requestHeaders = FishRequestPolicy.validate(body, headers)
            val opened = AtomicBoolean(false)
            // No load retry: replaying a synthesis POST could duplicate speech/usage.
            val factory = DataSource.Factory { FishSource(body, requestHeaders, opened) }
            val source = ProgressiveMediaSource.Factory(factory)
                .setLoadErrorHandlingPolicy(DefaultLoadErrorHandlingPolicy(0))
                .createMediaSource(MediaItem.fromUri(FishRequestPolicy.URL))
            val p = ExoPlayer.Builder(context)
                .setReleaseTimeoutMs(1000)
                .setLoadControl(DefaultLoadControl.Builder().setBufferDurationsMs(1500, 8000, 300, 700).build())
                .build()
            player = p
            owner = this
            com.maya.ai.WakeWordService.fishOutputActive = true
            p.setAudioAttributes(AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_SPEECH).build(), true)
            p.addListener(object : Player.Listener {
                override fun onPlayWhenReadyChanged(playWhenReady: Boolean, reason: Int) {
                    if (!playWhenReady && reason == Player.PLAY_WHEN_READY_CHANGE_REASON_AUDIO_FOCUS_LOSS) finish("interrupted", 0)
                }
                override fun onPlaybackSuppressionReasonChanged(reason: Int) {
                    if (reason != Player.PLAYBACK_SUPPRESSION_REASON_NONE) finish("interrupted", 0)
                }
                override fun onIsPlayingChanged(isPlaying: Boolean) {
                    if (isPlaying && !started && !terminal && gen == generation) {
                        started = true
                        timeout?.let { handler.removeCallbacks(it) }
                        timeout = Runnable { finish("timeout", 0) }.also { handler.postDelayed(it, 180000) }
                        event(id, "playing", 200)
                    }
                }
                override fun onPlaybackStateChanged(state: Int) {
                    if (state == Player.STATE_ENDED) finish(if (started) "done" else "error", if (started) 200 else 0)
                }
                override fun onPlayerError(error: PlaybackException) {
                    var cause: Throwable? = error
                    var code = 0
                    while (cause != null) { if (cause is FishHttpError) { code = cause.status; break }; cause = cause.cause }
                    finish("error", code) // Never expose raw response bodies, text, or credentials.
                }
            })
            timeout = Runnable { finish("timeout", 0) }.also { handler.postDelayed(it, 30000) }
            p.setMediaSource(source)
            p.prepare()
            p.play()
        } catch (_: Exception) { finish("error", 0) }
    }
}

private class FishHttpError(val status: Int) : IOException("Fish HTTP request rejected")

/** One fixed HTTPS POST, no redirect, seek/re-POST, disk cache or unbounded read. */
@UnstableApi
private class FishSource(private val body: String, private val headers: Map<String, String>, private val opened: AtomicBoolean) : BaseDataSource(true) {
    private var connection: HttpURLConnection? = null
    private var input: InputStream? = null
    private var total = 0L
    private var transferred = false
    override fun open(dataSpec: DataSpec): Long {
        if (dataSpec.position != 0L || !opened.compareAndSet(false, true)) throw IOException("Synthesis cannot be replayed or seeked")
        transferInitializing(dataSpec)
        try {
            val c = URL(FishRequestPolicy.URL).openConnection() as HttpURLConnection
            connection = c
            c.requestMethod = "POST"; c.doOutput = true
            c.instanceFollowRedirects = false; c.useCaches = false
            c.connectTimeout = 6000; c.readTimeout = 12000
            headers.forEach { (key, value) -> c.setRequestProperty(key, value) }
            c.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            val status = c.responseCode
            if (status !in 200..299) throw FishHttpError(status)
            val type = (c.contentType ?: "").substringBefore(';').trim().lowercase()
            if (type !in listOf("audio/mpeg", "audio/mp3", "application/octet-stream")) throw IOException("Fish returned non-audio data")
            if (c.contentLengthLong > 24_000_000) throw IOException("Audio exceeds size limit")
            input = c.inputStream
            transferred = true; transferStarted(dataSpec)
            return C.LENGTH_UNSET.toLong() // Streaming, non-seekable synthesis.
        } catch (e: Exception) { close(); throw e }
    }
    override fun read(buffer: ByteArray, offset: Int, length: Int): Int {
        if (length == 0) return 0
        val n = input?.read(buffer, offset, length) ?: C.RESULT_END_OF_INPUT
        if (n > 0) {
            total += n
            if (total > 24_000_000) throw IOException("Audio exceeds size limit")
            bytesTransferred(n)
        }
        return n
    }
    override fun getUri(): Uri = Uri.parse(FishRequestPolicy.URL)
    override fun close() {
        try { input?.close() } finally {
            input = null; connection?.disconnect(); connection = null
            if (transferred) { transferred = false; transferEnded() }
        }
    }
}
