package com.maya.ai.update

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.Rule
import org.junit.rules.TemporaryFolder
import java.io.ByteArrayInputStream
import java.io.InterruptedIOException
import java.net.HttpURLConnection
import java.net.URL
import java.security.KeyPairGenerator
import java.security.Signature
import java.util.Base64

/** Executes production Kotlin policy/transport, using real RSA and fake HTTP (no live services). */
class UpdatePolicyTest {
    @get:Rule val temp = TemporaryFolder()
    companion object {
        private val keys = KeyPairGenerator.getInstance("RSA").apply { initialize(3072) }.generateKeyPair()
        private val key = Base64.getEncoder().encodeToString(keys.public.encoded)
        private const val tag = "v5.17.0-beta.82"
        private val payload = "dummy-apk-bytes-for-transport-test".toByteArray()
    }

    private fun manifest(): JSONObject = JSONObject().apply {
        put("schema", 1); put("repository", UpdatePolicy.REPOSITORY); put("packageName", UpdatePolicy.PACKAGE)
        put("versionName", "5.17.0"); put("versionCode", 82); put("channel", "beta"); put("tag", tag)
        put("minSdk", 26); put("apkUrl", UpdatePolicy.assetUrl(tag, "MAYA.apk")); put("apkSize", payload.size)
        put("sha256", UpdatePolicy.sha256(payload)); put("signerSha256", "b".repeat(64))
        put("notes", "Test release"); put("tests", JSONArray().put("Check this build")); put("commit", "c".repeat(40))
    }
    private fun bytes(j: JSONObject = manifest()) = j.toString().toByteArray(Charsets.UTF_8)
    private fun sign(bytes: ByteArray): ByteArray = Signature.getInstance("SHA256withRSA").run {
        initSign(keys.private); update(bytes); sign()
    }
    private fun release(j: JSONObject = manifest()) = UpdatePolicy.parse(bytes(j), "beta", tag)
    private fun rejected(block: () -> Unit) {
        try { block(); fail("Expected rejection") } catch (_: IllegalArgumentException) { }
    }

    @Test fun exactBytesVerifyAndParse() {
        val b = bytes(); UpdatePolicy.verifyManifest(b, sign(b), key)
        assertEquals(82L, release().versionCode)
    }
    @Test fun tamperedSignatureIsRejected() { val b = bytes(); rejected { UpdatePolicy.verifyManifest(b + ' '.code.toByte(), sign(b), key) } }
    @Test fun truncatedSignatureIsRejected() { val b = bytes(); rejected { UpdatePolicy.verifyManifest(b, sign(b).copyOf(100), key) } }
    @Test fun noTrustKeyFailsClosed() { rejected { UpdatePolicy.publicKey("") } }
    @Test fun weakKeyIsRejected() {
        val weak = KeyPairGenerator.getInstance("RSA").apply { initialize(2048) }.generateKeyPair()
        rejected { UpdatePolicy.publicKey(Base64.getEncoder().encodeToString(weak.public.encoded)) }
    }
    @Test fun wrongKeyIsRejected() {
        val other = KeyPairGenerator.getInstance("RSA").apply { initialize(3072) }.generateKeyPair()
        val b = bytes()
        rejected { UpdatePolicy.verifyManifest(b, sign(b), Base64.getEncoder().encodeToString(other.public.encoded)) }
    }
    @Test fun mismatchedChannelOrTagIsRejected() {
        rejected { UpdatePolicy.parse(bytes(), "stable", tag) }
        rejected { UpdatePolicy.parse(bytes(), "beta", "v5.17.0-beta.83") }
    }
    @Test fun strictProtocolFields() {
        for ((field, value) in listOf(
            "schema" to 2, "packageName" to "com.other", "repository" to "other/repo",
            "versionCode" to 0, "versionCode" to 1.5, "versionCode" to "82", "versionCode" to 2100000001L,
            "versionName" to "../x", "minSdk" to 25, "minSdk" to "26", "apkSize" to 0,
            "apkSize" to UpdatePolicy.MAX_APK_BYTES + 1, "sha256" to "invalid", "signerSha256" to "",
            "notes" to "", "notes" to "x".repeat(6001), "tests" to JSONArray(), "commit" to "main",
            "apkUrl" to "https://evil.example/MAYA.apk"
        )) rejected { release(manifest().put(field, value)) }
    }
    @Test fun versionAndAndroidEligibility() {
        val r = release()
        assertTrue(UpdatePolicy.eligible(r, 74, 26))
        assertFalse(UpdatePolicy.eligible(r, 82, 34))
        assertFalse(UpdatePolicy.eligible(r, 83, 34))
        assertFalse(UpdatePolicy.eligible(r, 74, 25))
    }
    @Test fun rejectsNonHttpsForeignHostsAndCredentials() {
        for (url in listOf("http://github.com/x", "https://github.com.evil.test/x", "https://127.0.0.1/x",
            "https://user@github.com/${UpdatePolicy.REPOSITORY}/releases/download/a", "https://github.com:444/x",
            "https://github.com/other/repo/releases/download/a", "https://api.github.com/user", "file:///tmp/app.apk",
            "https://objects.githubusercontent.com/x#fragment")) rejected { UpdatePolicy.requireSafeUrl(url) }
        UpdatePolicy.requireSafeUrl(UpdatePolicy.assetUrl(tag, "MAYA.apk"))
        UpdatePolicy.requireSafeUrl("https://release-assets.githubusercontent.com/github-production-release-asset/x?token=temporary")
    }
    @Test fun cancellationIsExplicit() {
        val r = UpdateRepository.Request(); r.cancel()
        try { r.check(Long.MAX_VALUE); fail("Must cancel") } catch (_: InterruptedIOException) { }
    }
    @Test fun deadlineIsBounded() {
        try { UpdateRepository.Request().check(0); fail("Must time out") } catch (_: InterruptedIOException) { }
    }
    private fun response(code: Int, body: ByteArray, headers: Map<String, String> = emptyMap()): HttpURLConnection =
        object : HttpURLConnection(URL("https://github.com/")) {
            override fun connect() {}
            override fun disconnect() {}
            override fun usingProxy() = false
            override fun getResponseCode() = code
            override fun getInputStream() = ByteArrayInputStream(body)
            override fun getHeaderField(name: String) = headers[name]
        }
    @Test fun downloadVerifiesExactBytesAndProgress() {
        val repo = UpdateRepository(key) { response(200, payload, mapOf("Content-Length" to payload.size.toString())) }
        val progress = mutableListOf<Int>()
        val file = repo.download(release(), temp.newFolder(), UpdateRepository.Request()) { progress.add(it) }
        assertArrayEquals(payload, file.readBytes()); assertEquals(100, progress.last())
    }
    @Test fun corruptDownloadIsDeleted() {
        val dir = temp.newFolder()
        val repo = UpdateRepository(key) { response(200, ByteArray(payload.size)) }
        rejected { repo.download(release(), dir, UpdateRepository.Request()) {} }
        assertEquals(0, dir.listFiles()!!.size)
    }
    @Test fun truncatedAndOversizedDownloadsAreDeleted() {
        for (body in listOf(payload.copyOf(2), payload + payload)) {
            val dir = temp.newFolder(); val repo = UpdateRepository(key) { response(200, body) }
            rejected { repo.download(release(), dir, UpdateRepository.Request()) {} }
            assertEquals(0, dir.listFiles()!!.size)
        }
    }
    @Test fun redirectsCannotEscapeToOtherHosts() {
        var n = 0
        val repo = UpdateRepository(key) { n++; response(302, byteArrayOf(), mapOf("Location" to "https://evil.example/app.apk")) }
        rejected { repo.download(release(), temp.newFolder(), UpdateRepository.Request()) {} }
        assertEquals(1, n)
    }
    @Test fun redirectLoopsAreBounded() {
        var n = 0
        val repo = UpdateRepository(key) { n++; response(302, byteArrayOf(), mapOf("Location" to UpdatePolicy.assetUrl(tag, "MAYA.apk"))) }
        rejected { repo.download(release(), temp.newFolder(), UpdateRepository.Request()) {} }
        assertEquals(6, n)
    }
    @Test fun signedBetaDiscoveryIgnoresDraftsAndOtherChannels() {
        val b = bytes()
        val list = JSONArray().put(JSONObject().put("tag_name", "v5.17.0-beta.99").put("draft", true).put("prerelease", true))
            .put(JSONObject().put("tag_name", "v5.17.0-stable.98").put("draft", false).put("prerelease", false))
            .put(JSONObject().put("tag_name", tag).put("draft", false).put("prerelease", true))
        val repo = UpdateRepository(key) { u -> response(200, when {
            u.host == "api.github.com" -> list.toString().toByteArray()
            u.path.endsWith("update.json") -> b
            u.path.endsWith("update.sig") -> sign(b)
            else -> error("Unexpected request")
        }) }
        assertEquals(82L, repo.check("beta", 74, 34, UpdateRepository.Request()).release!!.versionCode)
    }
    @Test fun missingTrustMakesNoNetworkRequests() {
        val repo = UpdateRepository("") { error("Must not access network") }
        rejected { repo.check("stable", 74, 34, UpdateRepository.Request()) }
    }
    @Test fun corruptedMetadataNeverOffersAnApk() {
        val b = bytes()
        val list = """[{"tag_name":"$tag","draft":false,"prerelease":true}]"""
        val repo = UpdateRepository(key) { u -> response(200, when {
            u.host == "api.github.com" -> list.toByteArray()
            u.path.endsWith("update.json") -> b + ' '.code.toByte()
            else -> sign(b)
        }) }
        rejected { repo.check("beta", 74, 34, UpdateRepository.Request()) }
    }
    private fun candidate() = UpdatePolicy.ApkIdentity(UpdatePolicy.PACKAGE, "5.17.0", 82, 26, "b".repeat(64), false)
    private fun installed() = candidate().copy(versionCode = 74, versionName = "5.9.5")
    @Test fun compatibleApkIdentityIsAccepted() { UpdatePolicy.verifyApkIdentity(candidate(), installed(), release(), 34) }
    @Test fun wrongApkSignerOrPackageIsBlocked() {
        rejected { UpdatePolicy.verifyApkIdentity(candidate().copy(signerSha256 = "c".repeat(64)), installed(), release(), 34) }
        rejected { UpdatePolicy.verifyApkIdentity(candidate().copy(packageName = "com.fake"), installed(), release(), 34) }
    }
    @Test fun signedMetadataMustMatchActualApk() {
        rejected { UpdatePolicy.verifyApkIdentity(candidate().copy(versionCode = 83), installed(), release(), 34) }
        rejected { UpdatePolicy.verifyApkIdentity(candidate().copy(versionName = "9.0.0"), installed(), release(), 34) }
        rejected { UpdatePolicy.verifyApkIdentity(candidate().copy(minSdk = 27), installed(), release(), 34) }
    }
    @Test fun debugCandidateAndDowngradeAreRejected() {
        rejected { UpdatePolicy.verifyApkIdentity(candidate().copy(debuggable = true), installed(), release(), 34) }
        rejected { UpdatePolicy.verifyApkIdentity(candidate(), installed().copy(versionCode = 90), release(), 34) }
    }
    @Test fun signingMigrationCannotBeAssumed() {
        rejected { UpdatePolicy.verifyApkIdentity(candidate(), installed().copy(signerSha256 = "d".repeat(64)), release(), 34) }
    }

}
