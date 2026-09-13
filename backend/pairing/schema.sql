-- Non-secret replay metadata only; never store keys, signatures or message content.
CREATE TABLE IF NOT EXISTS pairing_nonces (
  key_id TEXT NOT NULL CHECK (length(key_id) = 43),
  nonce TEXT NOT NULL CHECK (length(nonce) = 32),
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (key_id, nonce)
);
CREATE INDEX IF NOT EXISTS pairing_nonce_expiry ON pairing_nonces(expires_at);
