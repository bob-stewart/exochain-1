use crate::policy::Policy;
use exo_core::{Blake3Hash, Did};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Bailment {
    /// ID of the data being bailed.
    pub resource_id: String,

    /// Depositor (Data Owner).
    pub depositor: Did,

    /// Custodian (Holding the data off-chain).
    pub custodian: Did,

    /// Hash of the encrypted payload.
    pub payload_hash: Blake3Hash,

    /// Governing Policy for access.
    pub policy: Policy,

    /// Creation timestamp.
    pub created_at: u64,
}

impl Bailment {
    pub fn new(
        resource_id: String,
        depositor: Did,
        custodian: Did,
        payload_hash: Blake3Hash,
        policy: Policy,
        created_at: u64,
    ) -> Self {
        Self {
            resource_id,
            depositor,
            custodian,
            payload_hash,
            policy,
            created_at,
        }
    }
}
