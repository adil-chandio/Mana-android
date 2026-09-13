package com.maya.ai.chat

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.SecureRandom
import java.security.Signature
import java.security.interfaces.ECPublicKey
import java.security.spec.ECGenParameterSpec

/**
 * Independent APK signing identity. Never imports/exports a private key.
 * Not wired to an Activity yet. Creating a key must be an explicit owner action;
 * reading/signing must never silently create or replace an existing identity.
 * AndroidKeyStore-backed does not imply verified hardware backing/attestation.
 */
class NativeChatIdentity {
    companion object { private const val ALIAS = "com.maya.ai.private-text-chat.p256.v1" }
    private fun store(): KeyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    private fun publicKey(store: KeyStore): ECPublicKey {
        if (!store.containsAlias(ALIAS)) throw NativeChatProtocol.Rejected("KEY_REQUIRED")
        val key = store.getCertificate(ALIAS)?.publicKey as? ECPublicKey
            ?: throw NativeChatProtocol.Rejected("INVALID_LOCAL_KEY")
        NativeChatProtocol.publicJwk(key)
        return key
    }
    private fun <T> safe(action: () -> T): T = try { action() }
        catch (e: NativeChatProtocol.Rejected) { throw e }
        catch (_: Exception) { throw NativeChatProtocol.Rejected("KEYSTORE_UNAVAILABLE") }

    @Synchronized fun publicJwk(): String = safe { NativeChatProtocol.publicJwk(publicKey(store())) }

    @Synchronized fun createExplicitly(): String = safe {
        val storage = store()
        if (!storage.containsAlias(ALIAS)) {
            val generator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, "AndroidKeyStore")
            generator.initialize(KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_SIGN)
                .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
                .setDigests(KeyProperties.DIGEST_SHA256)
                .setUserAuthenticationRequired(false).build())
            generator.generateKeyPair()
        }
        // Existing/corrupt entries are never overwritten or deleted on failure.
        NativeChatProtocol.publicJwk(publicKey(store()))
    }

    @Synchronized fun sign(messages: List<NativeChatProtocol.Message>?): NativeChatProtocol.SignedRequest = safe {
        val storage = store()
        val public = publicKey(storage)
        val entry = storage.getEntry(ALIAS, null) as? KeyStore.PrivateKeyEntry
            ?: throw NativeChatProtocol.Rejected("INVALID_LOCAL_KEY")
        val nonce = ByteArray(24).also { SecureRandom().nextBytes(it) }
        NativeChatProtocol.sign(messages, public, System.currentTimeMillis(), nonce) { canonical ->
            Signature.getInstance("SHA256withECDSA").run {
                initSign(entry.privateKey); update(canonical); sign()
            }
        }
    }
}
