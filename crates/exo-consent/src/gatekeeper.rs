use crate::policy::Policy;
use exo_core::{Blake3Hash, Did};
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum GatekeeperError {
    #[error("Policy Denied")]
    PolicyDenied,
    #[error("Attestation Failed")]
    AttestationFailed,
    #[error("System Error: {0}")]
    System(String),
}

/// TEE Attestation Report (Mock).
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TeeReport {
    pub measurement: Blake3Hash,
    pub signature: Vec<u8>,
}

/// Gatekeeper Interface (Spec 12.2).
/// Enforces policy-based access to data keys.
pub trait Gatekeeper {
    /// Request access to a resource.
    fn request_access(
        &self,
        subject: &Did,
        resource_id: &str,
        context: &str, // Context for policy evaluation
    ) -> Result<AccessGrant, GatekeeperError>;

    /// Verify TEE integrity.
    fn attest(&self) -> Result<TeeReport, GatekeeperError>;
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AccessGrant {
    pub token: String,
    pub expires_at: u64,
}

/// Mock Gatekeeper for development.
pub struct MockGatekeeper {
    pub policies: Vec<Policy>,
}

impl MockGatekeeper {
    pub fn new() -> Self {
        Self {
            policies: Vec::new(),
        }
    }

    pub fn register_policy(&mut self, policy: Policy) {
        self.policies.push(policy);
    }
}

impl Gatekeeper for MockGatekeeper {
    fn request_access(
        &self,
        subject: &Did,
        resource_id: &str,
        _context: &str,
    ) -> Result<AccessGrant, GatekeeperError> {
        // Find matching policy
        let matching = self
            .policies
            .iter()
            .find(|p| p.is_match(subject, resource_id)); // Basic match

        match matching {
            Some(policy) => match policy.effect {
                crate::policy::Effect::Allow => Ok(AccessGrant {
                    token: "mock_token".to_string(),
                    expires_at: 0,
                }),
                crate::policy::Effect::Deny => Err(GatekeeperError::PolicyDenied),
            },
            None => Err(GatekeeperError::PolicyDenied), // Default deny
        }
    }

    fn attest(&self) -> Result<TeeReport, GatekeeperError> {
        Ok(TeeReport {
            measurement: exo_core::Blake3Hash([0u8; 32]),
            signature: vec![],
        })
    }
}
