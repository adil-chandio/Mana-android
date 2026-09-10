package com.maya.ai.update

import org.json.JSONArray
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.InterruptedIOException
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.atomic.AtomicBoolean

/** Explicit foreground requests only. No timers, boot hooks, credentials or auto-install. */
class UpdateRepository(
    private val publicKey: String,
    private val connectionFactory: (URL) -> HttpURLConnection = { it.openConnection() as HttpURLConnection }
) {
    class Request {
        val cancelled = AtomicBoolean(false)
        @Volatile var connection: HttpURLConnection? = null
        fun cancel() { cancelled.set(true); connection?.disconnect() }
        fun check(deadline: Long) {
            if (cancelled.get() || Thread.currentThread().isInterrupted) throw InterruptedIOException("Operation cancelled")
            if (System.nanoTime() > deadline) throw InterruptedIOException("Update request timed out. Retry when the connection is stable.")
        }
    }

    data class Check(val release: UpdatePolicy.Release?, val message: String)

    fun check(channel: String, installed: Long, sdk: Int, request: Request): Check {
        UpdatePolicy.channel(channel)
        UpdatePolicy.publicKey(publicKey) // Fail before making any network request.
        val deadline = System.nanoTime() + 90_000_000_000L
        val releases = JSONArray(String(read("https://api.github.com/repos/${UpdatePolicy.REPOSITORY}/releases?per_page=30", 1024 * 1024, request, deadline), Charsets.UTF_8))
        // GitHub /latest omits prereleases. Inspect a bounded list and sort numerically instead.
        val candidates = (0 until releases.length()).map { releases.getJSONObject(it) }
            .filter { !it.optBoolean("draft", true) && it.optBoolean("prerelease") == (channel == "beta") }
            .mapNotNull {
                val tag = it.optString("tag_name")
                val m = Regex("v[0-9]+\\.[0-9]+\\.[0-9]+-$channel\\.([0-9]+)").matchEntire(tag)
                val code = m?.groupValues?.get(1)?.toLongOrNull()
                if (code != null && code > installed) Pair(tag, code) else null
            }.sortedByDescending { it.second }
        var incompatible = false
        // Never skip a corrupt/untrusted candidate silently. The user gets an explicit failure.
        for ((tag, _) in candidates.take(5)) {
            request.check(deadline)
            val bytes = read(UpdatePolicy.assetUrl(tag, "update.json"), UpdatePolicy.MAX_MANIFEST_BYTES, request, deadline)
            val sig = read(UpdatePolicy.assetUrl(tag, "update.sig"), 1024, request, deadline)
            UpdatePolicy.verifyManifest(bytes, sig, publicKey)
            val r = UpdatePolicy.parse(bytes, channel, tag)
            if (UpdatePolicy.eligible(r, installed, sdk)) return Check(r, "Verified update available")
            incompatible = true
        }
        return Check(null, if (incompatible) "Newer releases require a newer Android version. Your installed app was not changed."
            else "No newer signed $channel update found in the latest 30 releases. Older legacy releases are not update candidates.")
    }

    fun download(r: UpdatePolicy.Release, directory: File, request: Request, progress: (Int) -> Unit): File {
        require(directory.exists() || directory.mkdirs()) { "Cannot create update cache" }
        require(directory.usableSpace >= r.apkSize + 20L * 1024 * 1024) { "Not enough free storage for this download" }
        val name = "${r.versionCode}-${java.util.UUID.randomUUID()}"
        val part = File(directory, "$name.part")
        val apk = File(directory, "$name.apk")
        val deadline = System.nanoTime() + 300_000_000_000L
        try {
            val conn = connect(r.apkUrl, request, deadline)
            try {
                val declared = conn.getHeaderFieldLong("Content-Length", -1)
                require(declared == -1L || declared == r.apkSize) { "APK size does not match signed metadata" }
                val digest = MessageDigest.getInstance("SHA-256")
                var total = 0L
                var lastPercent = -1
                conn.inputStream.use { input ->
                    part.outputStream().use { output ->
                        val buffer = ByteArray(32 * 1024)
                        while (true) {
                            request.check(deadline)
                            val n = input.read(buffer)
                            if (n == -1) break
                            total += n
                            require(total <= r.apkSize) { "APK exceeds its signed size" }
                            digest.update(buffer, 0, n)
                            output.write(buffer, 0, n)
                            val percent = (total * 100 / r.apkSize).toInt()
                            if (percent != lastPercent) { progress(percent); lastPercent = percent }
                        }
                        output.fd.sync()
                    }
                }
                request.check(deadline)
                require(total == r.apkSize && UpdatePolicy.hex(digest.digest()) == r.sha256) { "APK checksum mismatch. Download rejected." }
                require(part.renameTo(apk)) { "Cannot finalize update download" }
                return apk
            } finally { conn.disconnect(); request.connection = null }
        } catch (e: Exception) {
            part.delete(); apk.delete()
            throw e
        }
    }

    private fun read(url: String, limit: Int, request: Request, deadline: Long): ByteArray {
        val conn = connect(url, request, deadline)
        try {
            require(conn.getHeaderFieldLong("Content-Length", -1) <= limit) { "Update response is too large" }
            val out = ByteArrayOutputStream()
            conn.inputStream.use { input ->
                val buffer = ByteArray(8192)
                while (true) {
                    request.check(deadline)
                    val n = input.read(buffer)
                    if (n == -1) break
                    require(out.size() + n <= limit) { "Update response is too large" }
                    out.write(buffer, 0, n)
                }
            }
            return out.toByteArray()
        } finally { conn.disconnect(); request.connection = null }
    }

    private fun connect(initial: String, request: Request, deadline: Long): HttpURLConnection {
        var url = initial
        repeat(6) {
            request.check(deadline)
            UpdatePolicy.requireSafeUrl(url)
            val conn = connectionFactory(URL(url))
            request.connection = conn
            try {
                conn.instanceFollowRedirects = false
                conn.connectTimeout = 12000
                conn.readTimeout = 15000
                conn.useCaches = false
                conn.setRequestProperty("User-Agent", "MAYA-Update-Center/1")
                conn.setRequestProperty("Accept-Encoding", "identity")
                conn.setRequestProperty("Accept", if (URL(url).host == "api.github.com") "application/vnd.github+json" else "application/octet-stream")
                request.check(deadline)
                val code = conn.responseCode
                if (code in listOf(301, 302, 303, 307, 308)) {
                    val location = conn.getHeaderField("Location") ?: error("Missing update redirect")
                    url = URL(URL(url), location).toString()
                    conn.disconnect()
                } else {
                    when (code) {
                        200 -> return conn
                        403, 429 -> error("GitHub refused or rate-limited the request. Please retry later.")
                        404 -> error("Release files are unavailable. No update was installed.")
                        else -> error("Update server returned HTTP $code")
                    }
                }
            } catch (e: Exception) { conn.disconnect(); request.connection = null; throw e }
        }
        throw IllegalArgumentException("Too many download redirects")
    }
}
