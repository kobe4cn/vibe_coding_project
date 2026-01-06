//! Storage abstraction layer
//!
//! Provides a unified interface for flow storage that can use either
//! in-memory storage or PostgreSQL database.

mod memory;
mod postgres;
pub mod traits;

pub use memory::MemoryStorage;
pub use postgres::PostgresStorage;
pub use traits::{FlowRecord, FlowStorage, StorageError, VersionRecord};

use crate::db::Database;
use crate::state::DatabaseConfig;
use std::sync::Arc;

/// Storage backend type
pub enum Storage {
    Memory(MemoryStorage),
    Postgres(PostgresStorage),
}

impl Storage {
    /// Create a new storage backend based on configuration
    pub async fn new(config: &DatabaseConfig) -> Result<Self, StorageError> {
        if config.enabled {
            let db = Database::connect(config).await.map_err(|e| {
                StorageError::Connection(format!("Failed to connect to database: {}", e))
            })?;
            Ok(Storage::Postgres(PostgresStorage::new(Arc::new(db))))
        } else {
            Ok(Storage::Memory(MemoryStorage::new()))
        }
    }

    /// Create in-memory storage
    pub fn memory() -> Self {
        Storage::Memory(MemoryStorage::new())
    }

    /// Check if using database storage
    pub fn is_database(&self) -> bool {
        matches!(self, Storage::Postgres(_))
    }

    /// Get reference to inner storage as trait object
    pub fn as_flow_storage(&self) -> &dyn FlowStorage {
        match self {
            Storage::Memory(s) => s,
            Storage::Postgres(s) => s,
        }
    }
}
