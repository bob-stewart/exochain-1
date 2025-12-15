use exo_core::Did as CoreDid;
use serde::{Deserialize, Serialize};
// ex-core defines Did as String for now. We might refine here or use that.
// Spec says: DID = did:exo:<base58(blake3(pubkey)[0..20])>

pub type Did = CoreDid;

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct DidDocument {
    pub id: Did,

    /// Current verification keys with versions.
    pub verification_methods: Vec<VerificationMethod>,

    /// Service endpoints.
    pub services: Vec<ServiceEndpoint>,

    /// Creation timestamp.
    pub created: u64,

    /// Last update timestamp.
    pub updated: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct VerificationMethod {
    /// Key identifier: {did}#key-{version}
    pub id: String,

    /// Key type (always Ed25519VerificationKey2020 for MVP).
    pub key_type: String,

    /// Controller DID (usually same as document id).
    pub controller: Did,

    /// Public key in multibase format.
    pub public_key_multibase: String,

    /// Key version (monotonically increasing per DID).
    pub version: u64,

    /// Whether this key is currently active.
    pub active: bool,

    /// Activation timestamp.
    pub valid_from: u64,

    /// Revocation timestamp (None if not revoked).
    pub revoked_at: Option<u64>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct ServiceEndpoint {
    pub id: String,
    pub type_: String,
    pub endpoint: String,
}

/// Normative DID Derivation (Spec 10.1)
pub fn derive_did(public_key_bytes: &[u8]) -> Did {
    let hash = blake3::hash(public_key_bytes);
    let truncated = &hash.as_bytes()[0..20];
    let encoded = bs58::encode(truncated).into_string();
    format!("did:exo:{}", encoded)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_did_derivation_structure() {
        let dummy_key = [0u8; 32];
        let did = derive_did(&dummy_key);
        assert!(did.starts_with("did:exo:"));
        // 20 bytes -> base58 (~27-28 chars).
        // Just check prefix and non-empty.
    }
}
