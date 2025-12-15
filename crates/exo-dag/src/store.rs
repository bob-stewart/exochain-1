use async_trait::async_trait;
use exo_core::{Blake3Hash, LedgerEvent};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum StoreError {
    #[error("Event not found: {0:?}")]
    EventNotFound(Blake3Hash),
    #[error("IO Error: {0}")]
    IoError(String),
}

#[async_trait]
pub trait DagStore: Send + Sync {
    /// Retrieve event by hash.
    async fn get_event(&self, id: &Blake3Hash) -> Result<LedgerEvent, StoreError>;

    /// Check if event exists.
    async fn contains_event(&self, id: &Blake3Hash) -> Result<bool, StoreError>;

    /// Append validated event to storage.
    async fn insert_event(&self, event: LedgerEvent) -> Result<(), StoreError>;
}

/// In-memory reference implementation.
#[derive(Default)]
pub struct MemoryStore {
    events: Arc<RwLock<HashMap<Blake3Hash, LedgerEvent>>>,
}

impl MemoryStore {
    pub fn new() -> Self {
        Self::default()
    }
}

#[async_trait]
impl DagStore for MemoryStore {
    async fn get_event(&self, id: &Blake3Hash) -> Result<LedgerEvent, StoreError> {
        let read = self
            .events
            .read()
            .map_err(|_| StoreError::IoError("Lock poisoned".into()))?;
        read.get(id).cloned().ok_or(StoreError::EventNotFound(*id))
    }

    async fn contains_event(&self, id: &Blake3Hash) -> Result<bool, StoreError> {
        let read = self
            .events
            .read()
            .map_err(|_| StoreError::IoError("Lock poisoned".into()))?;
        Ok(read.contains_key(id))
    }

    async fn insert_event(&self, event: LedgerEvent) -> Result<(), StoreError> {
        let mut write = self
            .events
            .write()
            .map_err(|_| StoreError::IoError("Lock poisoned".into()))?;
        write.insert(event.event_id, event);
        Ok(())
    }
}
