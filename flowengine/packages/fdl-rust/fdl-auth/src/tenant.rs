//! Multi-tenant support

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Tenant context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TenantContext {
    /// Tenant ID
    pub tenant_id: String,
    /// Tenant name
    pub name: String,
    /// Business unit code
    pub bu_code: String,
    /// Tenant configuration
    pub config: TenantConfig,
    /// Whether tenant is active
    pub active: bool,
}

/// Tenant configuration
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TenantConfig {
    /// Maximum concurrent flow executions
    pub max_concurrent_executions: Option<u32>,
    /// Maximum flow execution time in seconds
    pub max_execution_time_seconds: Option<u32>,
    /// Allowed tool types
    pub allowed_tool_types: Option<Vec<String>>,
    /// Custom settings
    pub settings: HashMap<String, serde_json::Value>,
}

/// Tenant quota
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TenantQuota {
    /// Maximum number of flows
    pub max_flows: u32,
    /// Maximum number of versions per flow
    pub max_versions_per_flow: u32,
    /// Maximum executions per day
    pub max_executions_per_day: u32,
    /// Maximum storage in bytes
    pub max_storage_bytes: u64,
}

impl Default for TenantQuota {
    fn default() -> Self {
        Self {
            max_flows: 100,
            max_versions_per_flow: 50,
            max_executions_per_day: 10000,
            max_storage_bytes: 1024 * 1024 * 1024, // 1GB
        }
    }
}

/// Tenant usage statistics
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TenantUsage {
    /// Current number of flows
    pub flow_count: u32,
    /// Total version count
    pub version_count: u32,
    /// Executions today
    pub executions_today: u32,
    /// Storage used in bytes
    pub storage_used_bytes: u64,
}

impl TenantContext {
    /// Create a new tenant context
    pub fn new(tenant_id: &str, name: &str, bu_code: &str) -> Self {
        Self {
            tenant_id: tenant_id.to_string(),
            name: name.to_string(),
            bu_code: bu_code.to_string(),
            config: TenantConfig::default(),
            active: true,
        }
    }

    /// Check if a quota is within limits
    pub fn check_quota(&self, quota: &TenantQuota, usage: &TenantUsage) -> crate::AuthResult<()> {
        if usage.flow_count >= quota.max_flows {
            return Err(crate::AuthError::QuotaExceeded(format!(
                "Maximum flows ({}) reached",
                quota.max_flows
            )));
        }
        if usage.executions_today >= quota.max_executions_per_day {
            return Err(crate::AuthError::QuotaExceeded(format!(
                "Daily execution limit ({}) reached",
                quota.max_executions_per_day
            )));
        }
        if usage.storage_used_bytes >= quota.max_storage_bytes {
            return Err(crate::AuthError::QuotaExceeded(
                "Storage limit reached".to_string(),
            ));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tenant_creation() {
        let tenant = TenantContext::new("tenant-1", "Test Tenant", "BU001");
        assert_eq!(tenant.tenant_id, "tenant-1");
        assert_eq!(tenant.name, "Test Tenant");
        assert_eq!(tenant.bu_code, "BU001");
        assert!(tenant.active);
    }

    #[test]
    fn test_tenant_config_default() {
        let config = TenantConfig::default();
        assert!(config.max_concurrent_executions.is_none());
        assert!(config.max_execution_time_seconds.is_none());
        assert!(config.allowed_tool_types.is_none());
        assert!(config.settings.is_empty());
    }

    #[test]
    fn test_tenant_quota_default() {
        let quota = TenantQuota::default();
        assert_eq!(quota.max_flows, 100);
        assert_eq!(quota.max_versions_per_flow, 50);
        assert_eq!(quota.max_executions_per_day, 10000);
        assert_eq!(quota.max_storage_bytes, 1024 * 1024 * 1024);
    }

    #[test]
    fn test_tenant_usage_default() {
        let usage = TenantUsage::default();
        assert_eq!(usage.flow_count, 0);
        assert_eq!(usage.version_count, 0);
        assert_eq!(usage.executions_today, 0);
        assert_eq!(usage.storage_used_bytes, 0);
    }

    #[test]
    fn test_quota_check_success() {
        let tenant = TenantContext::new("tenant-1", "Test", "BU001");
        let quota = TenantQuota::default();
        let usage = TenantUsage {
            flow_count: 50,
            version_count: 100,
            executions_today: 5000,
            storage_used_bytes: 512 * 1024 * 1024,
        };

        assert!(tenant.check_quota(&quota, &usage).is_ok());
    }

    #[test]
    fn test_quota_check_flow_limit() {
        let tenant = TenantContext::new("tenant-1", "Test", "BU001");
        let quota = TenantQuota::default();
        let usage = TenantUsage {
            flow_count: 100,
            ..Default::default()
        };

        let result = tenant.check_quota(&quota, &usage);
        assert!(result.is_err());
    }

    #[test]
    fn test_quota_check_execution_limit() {
        let tenant = TenantContext::new("tenant-1", "Test", "BU001");
        let quota = TenantQuota::default();
        let usage = TenantUsage {
            executions_today: 10000,
            ..Default::default()
        };

        let result = tenant.check_quota(&quota, &usage);
        assert!(result.is_err());
    }

    #[test]
    fn test_quota_check_storage_limit() {
        let tenant = TenantContext::new("tenant-1", "Test", "BU001");
        let quota = TenantQuota::default();
        let usage = TenantUsage {
            storage_used_bytes: 1024 * 1024 * 1024, // 1GB
            ..Default::default()
        };

        let result = tenant.check_quota(&quota, &usage);
        assert!(result.is_err());
    }

    #[test]
    fn test_tenant_config_custom() {
        let mut config = TenantConfig::default();
        config.max_concurrent_executions = Some(50);
        config.max_execution_time_seconds = Some(300);
        config.allowed_tool_types = Some(vec!["api".to_string(), "db".to_string()]);
        config
            .settings
            .insert("custom_key".to_string(), serde_json::json!("custom_value"));

        assert_eq!(config.max_concurrent_executions, Some(50));
        assert_eq!(config.max_execution_time_seconds, Some(300));
        assert_eq!(
            config.allowed_tool_types,
            Some(vec!["api".to_string(), "db".to_string()])
        );
    }
}
