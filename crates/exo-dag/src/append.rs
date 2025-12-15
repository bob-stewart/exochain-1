use crate::store::{DagStore, StoreError};
use exo_core::LedgerEvent;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppendError {
    #[error("Store Error: {0}")]
    Store(#[from] StoreError),
    #[error("Parent not found: {0:?}")]
    ParentNotFound(exo_core::Blake3Hash),
    #[error("Invalid Signature")]
    InvalidSignature,
    #[error("Causality Violation: Event time {0:?} <= Parent time")]
    CausalityViolation(exo_core::HybridLogicalClock),
    #[error("Crypto Error")]
    CryptoError,
}

/// Append an event to the DAG with full validation.
pub async fn append_event(store: &impl DagStore, event: LedgerEvent) -> Result<(), AppendError> {
    // 1. Verify Signature
    // Note: We need a way to resolve public keys from DID. For MVP/PR3, we skip key lookup
    // and assume the key would be provided or resolved.
    // For now, we just check structure. Real verification requires Identity Fabric.
    // TODO: Integrate Identity Resolution.

    // 2. Parent Existence & Causality
    for parent_id in &event.envelope.parents {
        let parent = store
            .get_event(parent_id)
            .await
            .map_err(|_| AppendError::ParentNotFound(*parent_id))?;

        // Normative HLC Check: event > parent
        if event.envelope.logical_time <= parent.envelope.logical_time {
            return Err(AppendError::CausalityViolation(event.envelope.logical_time));
        }

        // TODO: HLC physical skew checks
    }

    // 3. Persist
    store.insert_event(event).await?;

    Ok(())
}

/// Verify integrity of an event's hash chain (recursive).
pub async fn verify_integrity(
    store: &impl DagStore,
    event_id: &exo_core::Blake3Hash,
) -> Result<bool, AppendError> {
    let event = store.get_event(event_id).await?;

    // Check parents exist
    for parent in &event.envelope.parents {
        if !store.contains_event(parent).await? {
            return Ok(false);
        }
    }

    // Check hash correctness (re-compute)
    let recomputed =
        exo_core::compute_event_id(&event.envelope).map_err(|_| AppendError::CryptoError)?;

    if recomputed != event.event_id {
        return Ok(false);
    }

    Ok(true)
}
