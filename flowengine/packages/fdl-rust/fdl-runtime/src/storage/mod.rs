//! 存储抽象层
//!
//! 提供统一的存储接口，支持两种后端：
//! - 内存存储：用于开发和测试
//! - PostgreSQL 存储：用于生产环境
//!
//! 通过 trait 抽象实现存储后端的可替换性。

mod memory;
mod postgres;
pub mod traits;

pub use memory::MemoryStorage;
pub use postgres::PostgresStorage;
pub use traits::{FlowRecord, FlowStorage, StorageError, VersionRecord};

use crate::db::Database;
use crate::state::DatabaseConfig;
use std::sync::Arc;

/// 存储后端类型
/// 
/// 枚举类型，支持内存和数据库两种存储方式。
/// 运行时根据配置选择，失败时回退到内存存储。
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
