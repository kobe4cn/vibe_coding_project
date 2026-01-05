//! # FDL-Runtime
//!
//! FDL runtime service with REST API and WebSocket support.
//!
//! ## Features
//!
//! - REST API for flow management
//! - WebSocket for real-time execution updates
//! - JSON-RPC 2.0 protocol
//! - OpenAPI documentation
//! - Health checks
//! - PostgreSQL storage with in-memory fallback

pub mod converter;
pub mod db;
pub mod error;
pub mod jsonrpc;
pub mod routes;
pub mod state;
pub mod storage;
pub mod ws;

pub use db::Database;
pub use error::{RuntimeError, RuntimeResult};
pub use state::{AppState, DatabaseConfig, ServerConfig, StorageMode};
pub use storage::{FlowStorage, MemoryStorage, PostgresStorage, Storage, StorageError};

pub use fdl_auth;
pub use fdl_executor;
pub use fdl_gml;
pub use fdl_tools;
