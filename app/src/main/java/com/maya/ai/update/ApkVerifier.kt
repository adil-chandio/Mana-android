package com.maya.ai.update

import android.content.Context
import android.content.pm.ApplicationInfo
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.os.Build
import java.io.File
import java.security.MessageDigest

object ApkVerifier {
    @Suppress("DEPRECATION")
    fun installed(context: Context): PackageInfo = context.packageManager.getPackageInfo(context.packageName, flags())

    @Suppress("DEPRECATION")
    fun versionCode(info: PackageInfo): Long = if (Build.VERSION.SDK_INT >= 28) info.longVersionCode else info.versionCode.toLong()

    @Suppress("DEPRECATION")
    private fun flags(): Int = if (Build.VERSION.SDK_INT >= 28) PackageManager.GET_SIGNING_CERTIFICATES else PackageManager.GET_SIGNATURES

    @Suppress("DEPRECATION")
    fun signer(info: PackageInfo): String {
        val signatures = if (Build.VERSION.SDK_INT >= 28) info.signingInfo?.apkContentsSigners else info.signatures
        require(signatures != null && signatures.size == 1) { "Unsupported APK signing identity" }
        return UpdatePolicy.sha256(signatures[0].toByteArray())
    }

    /** Called after download AND immediately before handing the file to Android. */
    @Suppress("DEPRECATION")
    fun verify(context: Context, file: File, release: UpdatePolicy.Release, request: UpdateRepository.Request) {
        require(file.isFile && file.length() == release.apkSize) { "Downloaded APK is missing or incomplete. Download it again." }
        val digest = MessageDigest.getInstance("SHA-256")
        val deadline = System.nanoTime() + 60_000_000_000L
        file.inputStream().use { input ->
            val buf = ByteArray(32 * 1024)
            while (true) {
                request.check(deadline)
                val n = input.read(buf)
                if (n == -1) break
                digest.update(buf, 0, n)
            }
        }
        require(UpdatePolicy.hex(digest.digest()) == release.sha256) { "APK checksum changed. Installation blocked." }
        val candidate = context.packageManager.getPackageArchiveInfo(file.absolutePath, flags())
            ?: error("Android could not read the downloaded APK")
        val current = installed(context)
        fun identity(info: PackageInfo): UpdatePolicy.ApkIdentity {
            val app = info.applicationInfo ?: error("Missing APK application information")
            return UpdatePolicy.ApkIdentity(info.packageName, info.versionName ?: "", versionCode(info),
                app.minSdkVersion, signer(info), (app.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0)
        }
        UpdatePolicy.verifyApkIdentity(identity(candidate), identity(current), release, Build.VERSION.SDK_INT)
        // Android Package Installer performs the platform's cryptographic APK verification too.
    }
}
