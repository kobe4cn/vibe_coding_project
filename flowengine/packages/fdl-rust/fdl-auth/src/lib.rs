//! # FDL-Auth
//!
//! Authentication and authorization module for FDL runtime.
//!
//! ## Features
//!
//! - JWT token generation and validation
//! - Role-based access control (RBAC)
//! - Multi-tenant support
//! - Axum middleware integration
//! - Audit logging

pub mod audit;
pub mod error;
pub mod jwt;
pub mod middleware;
pub mod rbac;
pub mod repository;
pub mod tenant;

pub use audit::{AuditEntry, AuditEventType, AuditLogger, AuditSeverity, InMemoryAuditLogger};
pub use error::{AuthError, AuthResult};
pub use jwt::{Claims, JwtConfig, JwtService};
pub use middleware::AuthLayer;
pub use rbac::{Permission, Role};
pub use repository::{
    InMemoryTenantRepository, TenantAwareRepository, TenantEntity, TenantOwned, TenantQueryBuilder,
    TenantRepository,
};
pub use tenant::{TenantConfig, TenantContext, TenantQuota, TenantUsage};
