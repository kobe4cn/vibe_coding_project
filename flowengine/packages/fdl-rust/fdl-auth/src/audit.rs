//! Audit logging for security and compliance
//!
//! Records all significant operations for security auditing.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn};
use uuid::Uuid;

/// Audit event type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AuditEventType {
    // Authentication events
    Login,
    Logout,
    LoginFailed,
    TokenRefresh,
    TokenExpired,

    // Authorization events
    PermissionGranted,
    PermissionDenied,
    RoleAssigned,
    RoleRevoked,

    // Resource events
    ResourceCreated,
    ResourceRead,
    ResourceUpdated,
    ResourceDeleted,

    // Tenant events
    TenantCreated,
    TenantUpdated,
    TenantDeleted,
    TenantQuotaExceeded,

    // Execution events
    FlowExecutionStarted,
    FlowExecutionCompleted,
    FlowExecutionFailed,

    // Security events
    CrossTenantAccessAttempt,
    SuspiciousActivity,
    RateLimitExceeded,
}

impl std::fmt::Display for AuditEventType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AuditEventType::Login => write!(f, "LOGIN"),
            AuditEventType::Logout => write!(f, "LOGOUT"),
            AuditEventType::LoginFailed => write!(f, "LOGIN_FAILED"),
            AuditEventType::TokenRefresh => write!(f, "TOKEN_REFRESH"),
            AuditEventType::TokenExpired => write!(f, "TOKEN_EXPIRED"),
            AuditEventType::PermissionGranted => write!(f, "PERMISSION_GRANTED"),
            AuditEventType::PermissionDenied => write!(f, "PERMISSION_DENIED"),
            AuditEventType::RoleAssigned => write!(f, "ROLE_ASSIGNED"),
            AuditEventType::RoleRevoked => write!(f, "ROLE_REVOKED"),
            AuditEventType::ResourceCreated => write!(f, "RESOURCE_CREATED"),
            AuditEventType::ResourceRead => write!(f, "RESOURCE_READ"),
            AuditEventType::ResourceUpdated => write!(f, "RESOURCE_UPDATED"),
            AuditEventType::ResourceDeleted => write!(f, "RESOURCE_DELETED"),
            AuditEventType::TenantCreated => write!(f, "TENANT_CREATED"),
            AuditEventType::TenantUpdated => write!(f, "TENANT_UPDATED"),
            AuditEventType::TenantDeleted => write!(f, "TENANT_DELETED"),
            AuditEventType::TenantQuotaExceeded => write!(f, "TENANT_QUOTA_EXCEEDED"),
            AuditEventType::FlowExecutionStarted => write!(f, "FLOW_EXECUTION_STARTED"),
            AuditEventType::FlowExecutionCompleted => write!(f, "FLOW_EXECUTION_COMPLETED"),
            AuditEventType::FlowExecutionFailed => write!(f, "FLOW_EXECUTION_FAILED"),
            AuditEventType::CrossTenantAccessAttempt => write!(f, "CROSS_TENANT_ACCESS_ATTEMPT"),
            AuditEventType::SuspiciousActivity => write!(f, "SUSPICIOUS_ACTIVITY"),
            AuditEventType::RateLimitExceeded => write!(f, "RATE_LIMIT_EXCEEDED"),
        }
    }
}

/// Audit event severity level
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AuditSeverity {
    /// Informational event
    Info,
    /// Warning that may require attention
    Warning,
    /// Security alert requiring immediate attention
    Alert,
    /// Critical security event
    Critical,
}

impl AuditSeverity {
    pub fn from_event_type(event_type: AuditEventType) -> Self {
        match event_type {
            AuditEventType::Login
            | AuditEventType::Logout
            | AuditEventType::TokenRefresh
            | AuditEventType::PermissionGranted
            | AuditEventType::ResourceCreated
            | AuditEventType::ResourceRead
            | AuditEventType::ResourceUpdated
            | AuditEventType::ResourceDeleted
            | AuditEventType::TenantCreated
            | AuditEventType::TenantUpdated
            | AuditEventType::FlowExecutionStarted
            | AuditEventType::FlowExecutionCompleted
            | AuditEventType::RoleAssigned => AuditSeverity::Info,

            AuditEventType::TokenExpired
            | AuditEventType::RoleRevoked
            | AuditEventType::TenantDeleted
            | AuditEventType::FlowExecutionFailed => AuditSeverity::Warning,

            AuditEventType::LoginFailed
            | AuditEventType::PermissionDenied
            | AuditEventType::TenantQuotaExceeded
            | AuditEventType::RateLimitExceeded => AuditSeverity::Alert,

            AuditEventType::CrossTenantAccessAttempt | AuditEventType::SuspiciousActivity => {
                AuditSeverity::Critical
            }
        }
    }
}

/// Audit log entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEntry {
    /// Unique entry ID
    pub id: String,
    /// Event timestamp
    pub timestamp: DateTime<Utc>,
    /// Event type
    pub event_type: AuditEventType,
    /// Event severity
    pub severity: AuditSeverity,
    /// Tenant ID (if applicable)
    pub tenant_id: Option<String>,
    /// User ID (if applicable)
    pub user_id: Option<String>,
    /// IP address of the request
    pub ip_address: Option<String>,
    /// User agent string
    pub user_agent: Option<String>,
    /// Resource type (e.g., "flow", "version")
    pub resource_type: Option<String>,
    /// Resource ID
    pub resource_id: Option<String>,
    /// Action performed
    pub action: String,
    /// Result (success/failure)
    pub success: bool,
    /// Error message if failed
    pub error: Option<String>,
    /// Additional metadata
    pub metadata: HashMap<String, String>,
}

impl AuditEntry {
    /// Create a new audit entry
    pub fn new(event_type: AuditEventType, action: &str) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            timestamp: Utc::now(),
            event_type,
            severity: AuditSeverity::from_event_type(event_type),
            tenant_id: None,
            user_id: None,
            ip_address: None,
            user_agent: None,
            resource_type: None,
            resource_id: None,
            action: action.to_string(),
            success: true,
            error: None,
            metadata: HashMap::new(),
        }
    }

    /// Set tenant ID
    pub fn with_tenant(mut self, tenant_id: &str) -> Self {
        self.tenant_id = Some(tenant_id.to_string());
        self
    }

    /// Set user ID
    pub fn with_user(mut self, user_id: &str) -> Self {
        self.user_id = Some(user_id.to_string());
        self
    }

    /// Set IP address
    pub fn with_ip(mut self, ip: &str) -> Self {
        self.ip_address = Some(ip.to_string());
        self
    }

    /// Set resource info
    pub fn with_resource(mut self, resource_type: &str, resource_id: &str) -> Self {
        self.resource_type = Some(resource_type.to_string());
        self.resource_id = Some(resource_id.to_string());
        self
    }

    /// Mark as failed
    pub fn failed(mut self, error: &str) -> Self {
        self.success = false;
        self.error = Some(error.to_string());
        self
    }

    /// Add metadata
    pub fn with_metadata(mut self, key: &str, value: &str) -> Self {
        self.metadata.insert(key.to_string(), value.to_string());
        self
    }
}

/// Audit logger trait
#[async_trait::async_trait]
pub trait AuditLogger: Send + Sync {
    /// Log an audit entry
    async fn log(&self, entry: &AuditEntry);

    /// Query audit entries
    async fn query(
        &self,
        tenant_id: Option<&str>,
        event_type: Option<AuditEventType>,
        from: Option<DateTime<Utc>>,
        to: Option<DateTime<Utc>>,
        limit: usize,
    ) -> Vec<AuditEntry>;
}

/// In-memory audit logger for testing
#[derive(Default)]
pub struct InMemoryAuditLogger {
    entries: Arc<RwLock<Vec<AuditEntry>>>,
}

impl InMemoryAuditLogger {
    pub fn new() -> Self {
        Self {
            entries: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// Get all entries (for testing)
    pub async fn entries(&self) -> Vec<AuditEntry> {
        self.entries.read().await.clone()
    }
}

#[async_trait::async_trait]
impl AuditLogger for InMemoryAuditLogger {
    async fn log(&self, entry: &AuditEntry) {
        // Log to tracing based on severity
        match entry.severity {
            AuditSeverity::Info => {
                info!(
                    event_type = %entry.event_type,
                    tenant_id = ?entry.tenant_id,
                    user_id = ?entry.user_id,
                    action = %entry.action,
                    success = entry.success,
                    "Audit: {}", entry.action
                );
            }
            AuditSeverity::Warning => {
                warn!(
                    event_type = %entry.event_type,
                    tenant_id = ?entry.tenant_id,
                    user_id = ?entry.user_id,
                    action = %entry.action,
                    success = entry.success,
                    error = ?entry.error,
                    "Audit Warning: {}", entry.action
                );
            }
            AuditSeverity::Alert | AuditSeverity::Critical => {
                warn!(
                    event_type = %entry.event_type,
                    tenant_id = ?entry.tenant_id,
                    user_id = ?entry.user_id,
                    action = %entry.action,
                    success = entry.success,
                    error = ?entry.error,
                    ip_address = ?entry.ip_address,
                    "SECURITY ALERT: {}", entry.action
                );
            }
        }

        // Store in memory
        let mut entries = self.entries.write().await;
        entries.push(entry.clone());

        // Keep only last 10000 entries
        if entries.len() > 10000 {
            entries.remove(0);
        }
    }

    async fn query(
        &self,
        tenant_id: Option<&str>,
        event_type: Option<AuditEventType>,
        from: Option<DateTime<Utc>>,
        to: Option<DateTime<Utc>>,
        limit: usize,
    ) -> Vec<AuditEntry> {
        let entries = self.entries.read().await;

        entries
            .iter()
            .filter(|e| {
                if let Some(tid) = tenant_id
                    && e.tenant_id.as_deref() != Some(tid)
                {
                    return false;
                }
                if let Some(et) = event_type
                    && e.event_type != et
                {
                    return false;
                }
                if let Some(f) = from
                    && e.timestamp < f
                {
                    return false;
                }
                if let Some(t) = to
                    && e.timestamp > t
                {
                    return false;
                }
                true
            })
            .rev() // Most recent first
            .take(limit)
            .cloned()
            .collect()
    }
}

/// Log a cross-tenant access attempt
pub async fn log_cross_tenant_access<L: AuditLogger>(
    logger: &L,
    user_id: &str,
    from_tenant: &str,
    to_tenant: &str,
    resource_type: &str,
    resource_id: &str,
) {
    let entry = AuditEntry::new(
        AuditEventType::CrossTenantAccessAttempt,
        &format!(
            "Cross-tenant access attempt from {} to {} for {}/{}",
            from_tenant, to_tenant, resource_type, resource_id
        ),
    )
    .with_user(user_id)
    .with_tenant(from_tenant)
    .with_resource(resource_type, resource_id)
    .with_metadata("target_tenant", to_tenant)
    .failed("Cross-tenant access denied");

    logger.log(&entry).await;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_audit_entry_creation() {
        let entry = AuditEntry::new(AuditEventType::Login, "User login");
        assert!(!entry.id.is_empty());
        assert_eq!(entry.event_type, AuditEventType::Login);
        assert_eq!(entry.severity, AuditSeverity::Info);
        assert!(entry.success);
    }

    #[test]
    fn test_audit_entry_builder() {
        let entry = AuditEntry::new(AuditEventType::ResourceCreated, "Created flow")
            .with_tenant("tenant-1")
            .with_user("user-1")
            .with_ip("192.168.1.1")
            .with_resource("flow", "flow-123")
            .with_metadata("version", "1");

        assert_eq!(entry.tenant_id, Some("tenant-1".to_string()));
        assert_eq!(entry.user_id, Some("user-1".to_string()));
        assert_eq!(entry.ip_address, Some("192.168.1.1".to_string()));
        assert_eq!(entry.resource_type, Some("flow".to_string()));
        assert_eq!(entry.resource_id, Some("flow-123".to_string()));
        assert_eq!(entry.metadata.get("version"), Some(&"1".to_string()));
    }

    #[test]
    fn test_audit_entry_failed() {
        let entry = AuditEntry::new(AuditEventType::LoginFailed, "Login attempt")
            .failed("Invalid credentials");

        assert!(!entry.success);
        assert_eq!(entry.error, Some("Invalid credentials".to_string()));
    }

    #[test]
    fn test_severity_from_event_type() {
        assert_eq!(
            AuditSeverity::from_event_type(AuditEventType::Login),
            AuditSeverity::Info
        );
        assert_eq!(
            AuditSeverity::from_event_type(AuditEventType::TokenExpired),
            AuditSeverity::Warning
        );
        assert_eq!(
            AuditSeverity::from_event_type(AuditEventType::LoginFailed),
            AuditSeverity::Alert
        );
        assert_eq!(
            AuditSeverity::from_event_type(AuditEventType::CrossTenantAccessAttempt),
            AuditSeverity::Critical
        );
    }

    #[tokio::test]
    async fn test_in_memory_logger() {
        let logger = InMemoryAuditLogger::new();

        let entry = AuditEntry::new(AuditEventType::Login, "Test login").with_tenant("tenant-1");
        logger.log(&entry).await;

        let entries = logger.entries().await;
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].action, "Test login");
    }

    #[tokio::test]
    async fn test_in_memory_logger_query() {
        let logger = InMemoryAuditLogger::new();

        // Add some entries
        for i in 0..5 {
            let entry = AuditEntry::new(AuditEventType::Login, &format!("Login {}", i))
                .with_tenant("tenant-1");
            logger.log(&entry).await;
        }

        for i in 0..3 {
            let entry = AuditEntry::new(AuditEventType::ResourceCreated, &format!("Create {}", i))
                .with_tenant("tenant-2");
            logger.log(&entry).await;
        }

        // Query by tenant
        let tenant1_entries = logger.query(Some("tenant-1"), None, None, None, 100).await;
        assert_eq!(tenant1_entries.len(), 5);

        // Query by event type
        let login_entries = logger
            .query(None, Some(AuditEventType::Login), None, None, 100)
            .await;
        assert_eq!(login_entries.len(), 5);

        // Query with limit
        let limited = logger.query(None, None, None, None, 3).await;
        assert_eq!(limited.len(), 3);
    }

    #[tokio::test]
    async fn test_log_cross_tenant_access() {
        let logger = InMemoryAuditLogger::new();

        log_cross_tenant_access(
            &logger, "user-1", "tenant-1", "tenant-2", "flow", "flow-123",
        )
        .await;

        let entries = logger.entries().await;
        assert_eq!(entries.len(), 1);
        assert_eq!(
            entries[0].event_type,
            AuditEventType::CrossTenantAccessAttempt
        );
        assert!(!entries[0].success);
    }

    #[test]
    fn test_event_type_display() {
        assert_eq!(format!("{}", AuditEventType::Login), "LOGIN");
        assert_eq!(
            format!("{}", AuditEventType::CrossTenantAccessAttempt),
            "CROSS_TENANT_ACCESS_ATTEMPT"
        );
    }
}
