use blake3;
use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use std::fmt;

/// 32-byte BLAKE3 hash wrapper.
#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Blake3Hash(pub [u8; 32]);

impl Serialize for Blake3Hash {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        if serializer.is_human_readable() {
            serializer.serialize_str(&hex::encode(self.0))
        } else {
            serializer.serialize_bytes(&self.0)
        }
    }
}

impl<'de> Deserialize<'de> for Blake3Hash {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        if deserializer.is_human_readable() {
            let s = String::deserialize(deserializer)?;
            let bytes = hex::decode(s).map_err(serde::de::Error::custom)?;
            let array: [u8; 32] = bytes
                .try_into()
                .map_err(|_| serde::de::Error::custom("Invalid hash length"))?;
            Ok(Blake3Hash(array))
        } else {
            let bytes = <Vec<u8>>::deserialize(deserializer)?;
            let array: [u8; 32] = bytes
                .try_into()
                .map_err(|_| serde::de::Error::custom("Invalid hash length"))?;
            Ok(Blake3Hash(array))
        }
    }
}

impl fmt::Debug for Blake3Hash {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Blake3Hash({})", hex::encode(self.0))
    }
}

impl From<[u8; 32]> for Blake3Hash {
    fn from(bytes: [u8; 32]) -> Self {
        Blake3Hash(bytes)
    }
}

impl AsRef<[u8]> for Blake3Hash {
    fn as_ref(&self) -> &[u8] {
        &self.0
    }
}

/// Computes BLAKE3 hash of byte slice.
pub fn hash_bytes(data: &[u8]) -> Blake3Hash {
    let hash = blake3::hash(data);
    Blake3Hash(*hash.as_bytes())
}

/// Normative Domain Separator from Spec 9.1
const DOMAIN_SEPARATOR: &[u8] = b"EXOCHAIN-EVENT-SIG-v1";
const PROTOCOL_VERSION: u8 = 1;

/// Compute signature over event_id using Spec 9.1 rules.
pub fn compute_signature(signing_key: &SigningKey, event_id: &Blake3Hash) -> Signature {
    let mut preimage = Vec::new();
    preimage.extend_from_slice(DOMAIN_SEPARATOR);
    preimage.push(PROTOCOL_VERSION);
    preimage.extend_from_slice(&event_id.0);
    signing_key.sign(&preimage)
}

/// Verify signature over event_id using Spec 9.1 rules.
pub fn verify_signature(
    public_key: &VerifyingKey,
    event_id: &Blake3Hash,
    signature: &Signature,
) -> Result<(), ed25519_dalek::SignatureError> {
    let mut preimage = Vec::new();
    preimage.extend_from_slice(DOMAIN_SEPARATOR);
    preimage.push(PROTOCOL_VERSION);
    preimage.extend_from_slice(&event_id.0);
    public_key.verify(&preimage, signature)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::rngs::OsRng;

    #[test]
    fn test_signature_roundtrip() {
        let mut csprng = OsRng;
        let signing_key = SigningKey::generate(&mut csprng);
        let public_key = signing_key.verifying_key();

        let dummy_hash = Blake3Hash([0u8; 32]);
        let sig = compute_signature(&signing_key, &dummy_hash);

        assert!(verify_signature(&public_key, &dummy_hash, &sig).is_ok());
    }

    #[test]
    fn test_signature_domain_separation() {
        let mut csprng = OsRng;
        let signing_key = SigningKey::generate(&mut csprng);
        let public_key = signing_key.verifying_key();
        let dummy_hash = Blake3Hash([0u8; 32]);

        let sig = compute_signature(&signing_key, &dummy_hash);

        // Manual verification without domain sep should fail
        assert!(public_key.verify(&dummy_hash.0, &sig).is_err());
    }
}
