package com.maya.ai.update

import org.json.JSONObject
import java.net.URI
import java.security.KeyFactory
import java.security.MessageDigest
import java.security.Signature
import java.security.interfaces.RSAPublicKey
import java.security.spec.X509EncodedKeySpec
import java.util.Base64

/** Pure JVM policy. No Android, network, storage or UI side effects. */
object UpdatePolicy {
    const val REPOSITORY = "adil-chandio/Mana-android"
    const val PACKAGE = "com.maya.ai"
    const val MAX_APK_BYTES = 150L * 1024 * 1024
    const val MAX_MANIFEST_BYTES = 64 * 1024
    private val versionPattern = Regex("[0-9]+\\.[0-9]+\\.[0-9]+")
    private val hashPattern = Regex("[a-f0-9]{64}")

    data class Release(
        val versionName: String,
        val versionCode: Long,
        val channel: String,
        val minSdk: Int,
        val apkUrl: String,
        val apkSize: Long,
        val sha256: String,
        val signerSha256: String,
        val notes: String,
        val tests: List<String>,
        val commit: String,
        val tag: String
    )

    data class ApkIdentity(
        val packageName: String, val versionName: String, val versionCode: Long,
        val minSdk: Int, val signerSha256: String, val debuggable: Boolean
    )

    fun verifyApkIdentity(candidate: ApkIdentity, installed: ApkIdentity, r: Release, sdk: Int) {
        require(candidate.packageName == PACKAGE && installed.packageName == PACKAGE) { "Wrong application package" }
        require(candidate.versionCode == r.versionCode && candidate.versionName == r.versionName) { "APK version differs from signed metadata" }
        require(eligible(r, installed.versionCode, sdk)) { "Update is older, already installed, or incompatible" }
        require(candidate.minSdk == r.minSdk && candidate.minSdk <= sdk) { "APK Android requirement mismatch" }
        require(!candidate.debuggable) { "Debug APKs cannot be installed through Update Center" }
        require(candidate.signerSha256 == r.signerSha256 && candidate.signerSha256 == installed.signerSha256) {
            "APK signing identity differs from the installed app. Key rotation requires a separately tested migration; do not uninstall or clear data."
        }
    }

    fun channel(value: String): String {
        require(value == "stable" || value == "beta") { "Unknown update channel" }
        return value
    }

    fun publicKey(encoded: String): RSAPublicKey {
        require(encoded.isNotBlank()) { "Update trust is not configured in this APK. Install a trusted bootstrap release first." }
        val key = KeyFactory.getInstance("RSA").generatePublic(
            X509EncodedKeySpec(Base64.getDecoder().decode(encoded))
        ) as RSAPublicKey
        require(key.modulus.bitLength() >= 3072) { "Update signing key is too weak" }
        return key
    }

    fun verifyManifest(bytes: ByteArray, signature: ByteArray, key: String) {
        require(bytes.size in 1..MAX_MANIFEST_BYTES) { "Invalid update manifest size" }
        require(signature.size in 384..1024) { "Invalid metadata signature size" }
        val verifier = Signature.getInstance("SHA256withRSA")
        verifier.initVerify(publicKey(key))
        verifier.update(bytes)
        require(verifier.verify(signature)) { "Update metadata signature is invalid. Nothing was downloaded or installed." }
    }

    /** Strictly binds signed metadata to the selected repository, release and channel. */
    fun parse(bytes: ByteArray, selectedChannel: String, releaseTag: String): Release {
        require(bytes.size in 1..MAX_MANIFEST_BYTES) { "Invalid manifest size" }
        val j = JSONObject(String(bytes, Charsets.UTF_8))
        require(integer(j, "schema") == 1L) { "Unsupported update protocol" }
        require(j.getString("repository") == REPOSITORY && j.getString("packageName") == PACKAGE) { "Wrong application" }
        val name = j.getString("versionName")
        val code = integer(j, "versionCode")
        require(versionPattern.matches(name) && code in 1..2100000000L) { "Invalid version" }
        val c = channel(j.getString("channel"))
        require(c == channel(selectedChannel)) { "Update channel mismatch" }
        val tag = "v$name-$c.$code"
        require(releaseTag == tag && j.getString("tag") == tag) { "Release tag mismatch" }
        val sdk = integer(j, "minSdk")
        require(sdk in 26..1000) { "Invalid minimum Android version" }
        val size = integer(j, "apkSize")
        require(size in 1..MAX_APK_BYTES) { "APK exceeds the download limit" }
        val hash = j.getString("sha256")
        val signer = j.getString("signerSha256")
        require(hashPattern.matches(hash) && hashPattern.matches(signer)) { "Invalid checksum or signing identity" }
        val url = assetUrl(tag, "MAYA.apk")
        require(j.getString("apkUrl") == url) { "Unexpected APK source" }
        val notes = j.getString("notes")
        require(notes.length in 1..6000) { "Invalid release notes" }
        val checklist = j.getJSONArray("tests")
        require(checklist.length() in 1..20) { "Missing or oversized test checklist" }
        val tests = (0 until checklist.length()).map { checklist.getString(it).also { t ->
            require(t.length in 1..300) { "Invalid test item" }
        } }
        val commit = j.getString("commit")
        require(Regex("[a-f0-9]{40}").matches(commit)) { "Invalid source commit" }
        return Release(name, code, c, sdk.toInt(), url, size, hash, signer, notes, tests, commit, tag)
    }

    private fun integer(j: JSONObject, name: String): Long {
        val raw = j.get(name)
        require(raw is Int || raw is Long) { "$name must be an integer" }
        return (raw as Number).toLong()
    }

    fun assetUrl(tag: String, file: String): String {
        require(Regex("v[0-9]+\\.[0-9]+\\.[0-9]+-(stable|beta)\\.[0-9]+").matches(tag)) { "Invalid release tag" }
        require(file in listOf("MAYA.apk", "update.json", "update.sig")) { "Unexpected release asset" }
        return "https://github.com/$REPOSITORY/releases/download/$tag/$file"
    }

    /** Redirects are only allowed to GitHub's HTTPS asset delivery hosts. No credentials. */
    fun requireSafeUrl(url: String) {
        val u = URI(url)
        require(u.scheme == "https" && u.rawUserInfo == null && u.rawFragment == null && u.port in listOf(-1, 443)) { "Unsafe update URL" }
        when (u.host) {
            "api.github.com" -> require(u.path == "/repos/$REPOSITORY/releases") { "Unexpected API path" }
            "github.com" -> require(u.path.startsWith("/$REPOSITORY/releases/download/")) { "Unexpected repository" }
            "release-assets.githubusercontent.com", "objects.githubusercontent.com" -> Unit
            else -> throw IllegalArgumentException("Untrusted update host")
        }
    }

    fun eligible(r: Release, installedCode: Long, sdk: Int): Boolean =
        r.versionCode > installedCode && r.minSdk <= sdk

    fun sha256(bytes: ByteArray): String = hex(MessageDigest.getInstance("SHA-256").digest(bytes))
    fun hex(bytes: ByteArray): String = bytes.joinToString("") { "%02x".format(it.toInt() and 255) }
}
