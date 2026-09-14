package com.maya.ai.update

import android.app.AlertDialog
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.FileProvider
import com.maya.ai.BuildConfig
import com.maya.ai.MayaAct
import org.json.JSONArray
import java.io.File
import java.util.concurrent.Executors

/** Native recovery entry; independent of WebView/JS and the assistant's microphones. */
class UpdateActivity : AppCompatActivity() {
    private val executor = Executors.newSingleThreadExecutor()
    private var request: UpdateRepository.Request? = null
    private var epoch = 0
    private var release: UpdatePolicy.Release? = null
    private var apk: File? = null
    private var handedToInstaller = false
    private var operation = "Idle"
    private var lastFailure = "None"
    private var lastFailureStage = "None"
    private var lastCheck = 0L
    private val prefs by lazy { getSharedPreferences("maya_updates", MODE_PRIVATE) }
    private var channel = "stable"
    private lateinit var status: TextView
    private lateinit var details: TextView
    private lateinit var progress: ProgressBar
    private lateinit var checkButton: Button
    private lateinit var downloadButton: Button
    private lateinit var installButton: Button
    private lateinit var cancelButton: Button
    private lateinit var channelPicker: Spinner
    private lateinit var feedback: LinearLayout
    private var trusted = false
    private val repository by lazy { UpdateRepository(BuildConfig.UPDATE_PUBLIC_KEY_B64) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        channel = prefs.getString("channel", "stable").let { if (it == "beta") "beta" else "stable" }
        buildUi()
        try {
            val key = UpdatePolicy.publicKey(BuildConfig.UPDATE_PUBLIC_KEY_B64)
            trusted = true
            status.text = "Ready. Updates are checked only when you tap CHECK.\nTrust fingerprint: ${UpdatePolicy.sha256(key.encoded).take(16)}"
        } catch (_: Exception) {
            status.text = "Update trust is not configured in this APK. A signed bootstrap release is required. Unverified updates are disabled; your current app is unchanged."
        }
        showInstalledTest()
        paint()
        // Delete abandoned files only after 24 hours; an external installer may still be reading one.
        File(cacheDir, "updates").listFiles()?.filter { System.currentTimeMillis() - it.lastModified() > 86400000 }?.forEach { it.delete() }
    }

    private fun buildUi() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(20), dp(20), dp(28))
            setBackgroundColor(Color.rgb(13, 15, 24))
        }
        fun label(text: String, size: Float = 15f): TextView = TextView(this).apply {
            this.text = text; textSize = size; setTextColor(Color.rgb(232, 235, 244))
            setPadding(0, dp(8), 0, dp(8)); root.addView(this)
        }
        label("MAYA UPDATE CENTER", 24f)
        val installed = ApkVerifier.installed(this)
        label("Installed: ${installed.versionName} (${ApkVerifier.versionCode(installed)})\nAndroid ${Build.VERSION.RELEASE} · API ${Build.VERSION.SDK_INT}")
        label("Full APK updates • No background downloads • Android asks before installation")
        label("CHANNEL")
        channelPicker = Spinner(this).apply {
            adapter = object : ArrayAdapter<String>(this@UpdateActivity, android.R.layout.simple_spinner_dropdown_item, listOf("Stable — tested releases", "Beta — experimental test builds")) {
                override fun getView(position: Int, convertView: View?, parent: android.view.ViewGroup): View =
                    super.getView(position, convertView, parent).also { (it as? TextView)?.setTextColor(Color.WHITE) }
            }
            setSelection(if (channel == "beta") 1 else 0)
            root.addView(this)
            onItemSelectedListener = object : android.widget.AdapterView.OnItemSelectedListener {
                override fun onNothingSelected(parent: android.widget.AdapterView<*>?) {}
                override fun onItemSelected(parent: android.widget.AdapterView<*>?, view: View?, position: Int, id: Long) {
                    val chosen = if (position == 1) "beta" else "stable"
                    if (chosen == channel) return
                    channel = chosen; prefs.edit().putString("channel", channel).apply()
                    discardCandidate(); lastCheck = 0
                    status.text = "Channel changed to $channel. Tap CHECK. Switching channels never forces a downgrade."
                    paint()
                }
            }
        }
        status = label("Loading local update settings…")
        status.accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
        progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply { max = 100; root.addView(this) }
        details = label("")
        fun button(title: String, action: () -> Unit): Button = Button(this).apply {
            text = title; isAllCaps = false; minHeight = dp(48)
            setOnClickListener { action() }; root.addView(this)
        }
        checkButton = button("CHECK FOR UPDATE") { check() }
        downloadButton = button("DOWNLOAD VERIFIED UPDATE") { download() }
        installButton = button("INSTALL UPDATE") { confirmInstall() }
        cancelButton = button("CANCEL OPERATION") { cancel() }
        button("COPY UPDATE DIAGNOSTIC") { copyDiagnostic() }
        button("OPEN MAYA") {
            startActivity(Intent(this, com.maya.ai.MainActivity::class.java)); finish()
        }
        label("SAFETY: Never uninstall or clear app data to force an update. This updater rejects older, altered, debug or differently signed APKs. The legacy signing key was exposed; signed update metadata adds a separate trust check but does not repair that exposure.", 13f)
        feedback = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; root.addView(this) }
        setContentView(ScrollView(this).apply { isFillViewport = true; addView(root) })
    }

    private fun paint() {
        val busy = request != null
        checkButton.isEnabled = trusted && !busy
        channelPicker.isEnabled = !busy
        downloadButton.visibility = if (release != null && apk == null) View.VISIBLE else View.GONE
        downloadButton.isEnabled = trusted && !busy
        installButton.visibility = if (apk != null) View.VISIBLE else View.GONE
        installButton.isEnabled = !busy
        cancelButton.visibility = if (busy) View.VISIBLE else View.GONE
        progress.visibility = if (busy) View.VISIBLE else View.GONE
    }

    private fun begin(name: String): Pair<Int, UpdateRepository.Request> {
        kotlin.check(request == null)
        operation = name; status.text = name; lastFailure = "None"; lastFailureStage = "None"
        val r = UpdateRepository.Request(); request = r
        epoch++; progress.progress = 0; progress.isIndeterminate = name != "Downloading APK…"
        paint()
        return Pair(epoch, r)
    }

    private fun deliver(id: Int, r: UpdateRepository.Request, stale: () -> Unit = {}, block: () -> Unit) {
        runOnUiThread {
            if (!isDestroyed && epoch == id && !r.cancelled.get()) block() else stale()
        }
    }

    private fun finishOperation() { request = null; operation = "Idle"; paint() }

    private fun failure(id: Int, r: UpdateRepository.Request, e: Exception) {
        deliver(id, r) {
            // No raw response bodies, URLs, credentials, transcripts or contacts in diagnostics.
            lastFailureStage = operation
            lastFailure = e.javaClass.simpleName
            status.text = when (e) {
                is IllegalArgumentException, is IllegalStateException -> e.message ?: "Update verification failed"
                is java.io.InterruptedIOException -> "Request cancelled or timed out. Tap CHECK or DOWNLOAD to retry."
                is java.io.IOException -> "Network or storage error. Your installed app was not changed. Retry when ready."
                else -> "Update failed safely. Nothing was installed."
            }
            finishOperation()
        }
    }

    private fun check() {
        if (!trusted || request != null) return
        if (System.currentTimeMillis() - lastCheck < 30000) {
            status.text = "Please wait 30 seconds between checks to avoid GitHub rate limits."; return
        }
        discardCandidate()
        lastCheck = System.currentTimeMillis()
        val selected = channel
        val (id, r) = begin("Checking signed $channel releases…")
        executor.execute {
            try {
                val result = repository.check(selected, ApkVerifier.versionCode(ApkVerifier.installed(this)), Build.VERSION.SDK_INT, r)
                deliver(id, r) {
                    release = result.release
                    status.text = result.message
                    details.text = result.release?.let {
                        "${it.versionName} (${it.versionCode}) · ${it.channel.uppercase()}\n${"%.1f".format(it.apkSize / 1048576.0)} MB\nBuild: ${it.commit.take(12)}\n\nWHAT CHANGED\n${it.notes}\n\nWHAT TO TEST\n${it.tests.joinToString("\n") { t -> "• $t" }}"
                    } ?: ""
                    finishOperation()
                }
            } catch (e: Exception) { failure(id, r, e) }
        }
    }

    private fun download() {
        val target = release ?: return
        if (!trusted || request != null) return
        val (id, r) = begin("Downloading APK…")
        executor.execute {
            var file: File? = null
            try {
                val downloaded = repository.download(target, File(cacheDir, "updates"), r) { percent ->
                    deliver(id, r) { progress.progress = percent; status.text = "Downloading… $percent%" }
                }
                file = downloaded
                deliver(id, r) { status.text = "Verifying APK identity and checksum…" }
                ApkVerifier.verify(this, downloaded, target, r)
                if (r.cancelled.get()) { downloaded.delete(); return@execute }
                val verified = downloaded
                deliver(id, r, stale = { verified.delete() }) {
                    apk = verified; handedToInstaller = false
                    status.text = "Download verified. Tap INSTALL when ready. Android will ask for confirmation."
                    finishOperation()
                }
                if (r.cancelled.get()) downloaded.delete()
            } catch (e: Exception) { file?.delete(); failure(id, r, e) }
        }
    }

    private fun confirmInstall() {
        if (request != null || apk == null) return
        if (automationPending()) {
            status.text = "Finish or cancel the active automation/message before installing an update."; return
        }
        AlertDialog.Builder(this).setTitle("Install MAYA update?")
            .setMessage("Finish any active call or task first. Android will replace this app and may stop its current services. Do not uninstall or clear data. Installation is never silent.")
            .setNegativeButton("Not now", null)
            .setPositiveButton("Continue") { _, _ -> install() }.show()
    }

    private fun automationPending(): Boolean {
        val state = org.json.JSONObject(MayaAct.status())
        return state.optBoolean("executing") || state.optInt("queued") > 0 || com.maya.ai.AutoSendService.pending(this)
    }

    private fun install() {
        val target = release ?: return
        val file = apk ?: return
        if (!packageManager.canRequestPackageInstalls()) {
            status.text = "Allow updates from MAYA in Android settings, return here, then tap INSTALL again."
            try { startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:$packageName"))) }
            catch (_: Exception) { status.text = "Open Android Settings → Special app access → Install unknown apps → MAYA." }
            return
        }
        val (id, r) = begin("Re-verifying APK before installation…")
        executor.execute {
            try {
                ApkVerifier.verify(this, file, target, r)
                deliver(id, r) {
                    try {
                        if (automationPending()) {
                            status.text = "Automation started while verifying. Finish or cancel it, then tap INSTALL again."
                            finishOperation()
                            return@deliver
                        }
                        val uri = FileProvider.getUriForFile(this, "$packageName.updates", file)
                        val intent = Intent(Intent.ACTION_VIEW).apply {
                            setDataAndType(uri, "application/vnd.android.package-archive")
                            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                            clipData = ClipData.newRawUri("MAYA update", uri)
                        }
                        startActivity(intent)
                        handedToInstaller = true
                        prefs.edit().putLong("pendingCode", target.versionCode).putString("pendingVersion", target.versionName)
                            .putString("pendingTests", JSONArray(target.tests).toString()).putString("pendingCommit", target.commit).apply()
                        status.text = "Android installer opened. This is NOT installation confirmation. After updating, reopen MAYA Updates to verify the installed version."
                    } catch (_: Exception) { status.text = "Android installer could not open. Nothing was installed." }
                    finishOperation()
                }
            } catch (e: Exception) {
                // A cancelled/stale verification must not delete the retained APK
                // behind the current UI (or another request using the same file).
                deliver(id, r) {
                    file.delete(); apk = null
                    failure(id, r, e)
                }
            }
        }
    }

    private fun cancel() {
        epoch++; request?.cancel(); request = null; operation = "Cancelled"
        status.text = "Operation cancelled. Nothing was installed. Tap CHECK or DOWNLOAD to retry."
        paint()
    }

    private fun discardCandidate() {
        if (!handedToInstaller) apk?.delete()
        apk = null; release = null; handedToInstaller = false
        details.text = ""
    }

    private fun showInstalledTest() {
        val current = ApkVerifier.versionCode(ApkVerifier.installed(this))
        if (prefs.getLong("pendingCode", -1) != current) return
        val heading = TextView(this).apply {
            text = "UPDATE INSTALLED ✅\nTest this build (${prefs.getString("pendingVersion", "")})"
            setTextColor(Color.WHITE); textSize = 18f
        }
        feedback.addView(heading)
        try {
            val list = JSONArray(prefs.getString("pendingTests", "[]"))
            for (i in 0 until list.length()) feedback.addView(CheckBox(this).apply {
                text = list.getString(i); setTextColor(Color.WHITE)
            })
        } catch (_: Exception) { /* A malformed local checklist never blocks recovery. */ }
        for (result in listOf("PASS", "FAIL")) feedback.addView(Button(this).apply {
            text = "MARK $result (LOCAL ONLY)"
            setOnClickListener {
                prefs.edit().putString("feedback", result).putLong("feedbackCode", current).apply()
                status.text = "$result saved on this phone. COPY UPDATE DIAGNOSTIC to preview and share manually."
            }
        })
    }

    private fun copyDiagnostic() {
        val info = ApkVerifier.installed(this)
        val text = "MAYA UPDATE DIAGNOSTIC\nVersion: ${info.versionName} (${ApkVerifier.versionCode(info)})\nAndroid API: ${Build.VERSION.SDK_INT}\nDevice: ${Build.MANUFACTURER} ${Build.MODEL}\nChannel: $channel\nTrust configured: $trusted\nOperation: $operation\nFailure stage: $lastFailureStage\nFailure class: $lastFailure\nCandidate: ${release?.tag ?: "none"}\nFeedback: ${if (prefs.getLong("feedbackCode", -1) == ApkVerifier.versionCode(info)) prefs.getString("feedback", "none") else "none"}\nNo API keys, chats, contacts or audio included."
        AlertDialog.Builder(this).setTitle("Preview diagnostic").setMessage(text)
            .setNegativeButton("Cancel", null).setPositiveButton("Copy") { _, _ ->
                (getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newPlainText("MAYA update diagnostic", text))
                Toast.makeText(this, "Copied. Share only with someone you trust.", Toast.LENGTH_SHORT).show()
            }.show()
    }

    override fun onStop() {
        super.onStop()
        if (request != null) cancel() // No download continues in the background.
    }

    override fun onDestroy() {
        epoch++; request?.cancel(); executor.shutdownNow()
        if (!handedToInstaller) apk?.delete()
        super.onDestroy()
    }

    private fun dp(value: Int): Int = (resources.displayMetrics.density * value).toInt()
}
