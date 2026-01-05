//! Tenant-aware repository pattern
//!
//! Provides data isolation for multi-tenant applications.

use crate::error::{AuthError, AuthResult};
use crate::tenant::{TenantConfig, TenantContext, TenantQuota, TenantUsage};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

/// Tenant-aware repository trait
///
/// All repositories that need tenant isolation should implement this trait.
/// It provides automatic tenant_id filtering for all operations.
#[async_trait::async_trait]
pub trait TenantAwareRepository: Send + Sync {
    /// Get the current tenant ID
    fn tenant_id(&self) -> &str;

    /// Set the current tenant ID
    fn set_tenant_id(&mut self, tenant_id: &str);

    /// Validate that a resource belongs to the current tenant
    fn validate_tenant_access<T: TenantOwned>(&self, resource: &T) -> AuthResult<()> {
        if resource.tenant_id() != self.tenant_id() {
            return Err(AuthError::InsufficientPermissions);
        }
        Ok(())
    }
}

/// Trait for resources that belong to a tenant
pub trait TenantOwned {
    /// Get the tenant ID that owns this resource
    fn tenant_id(&self) -> &str;
}

/// Tenant entity for database storage
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TenantEntity {
    /// Unique tenant ID
    pub id: String,
    /// Tenant name
    pub name: String,
    /// Business unit code
    pub bu_code: String,
    /// Tenant configuration as JSON
    pub config: TenantConfig,
    /// Quota configuration
    pub quota: TenantQuota,
    /// Whether tenant is active
    pub active: bool,
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
    /// Last update timestamp
    pub updated_at: DateTime<Utc>,
}

impl TenantEntity {
    /// Create a new tenant entity
    pub fn new(name: &str, bu_code: &str) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4().to_string(),
            name: name.to_string(),
            bu_code: bu_code.to_string(),
            config: TenantConfig::default(),
            quota: TenantQuota::default(),
            active: true,
            created_at: now,
            updated_at: now,
        }
    }

    /// Convert to TenantContext
    pub fn to_context(&self) -> TenantContext {
        TenantContext {
            tenant_id: self.id.clone(),
            name: self.name.clone(),
            bu_code: self.bu_code.clone(),
            config: self.config.clone(),
            active: self.active,
        }
    }
}

/// Tenant repository trait for CRUD operations
#[async_trait::async_trait]
pub trait TenantRepository: Send + Sync {
    /// Create a new tenant
    async fn create(&self, tenant: &TenantEntity) -> AuthResult<TenantEntity>;

    /// Get tenant by ID
    async fn get(&self, tenant_id: &str) -> AuthResult<Option<TenantEntity>>;

    /// Get tenant by business unit code
    async fn get_by_bu_code(&self, bu_code: &str) -> AuthResult<Option<TenantEntity>>;

    /// List all tenants
    async fn list(&self, limit: usize, offset: usize) -> AuthResult<Vec<TenantEntity>>;

    /// Update tenant
    async fn update(&self, tenant: &TenantEntity) -> AuthResult<TenantEntity>;

    /// Delete tenant (soft delete - marks as inactive)
    async fn delete(&self, tenant_id: &str) -> AuthResult<()>;

    /// Get tenant usage statistics
    async fn get_usage(&self, tenant_id: &str) -> AuthResult<TenantUsage>;

    /// Update tenant usage
    async fn update_usage(&self, tenant_id: &str, usage: &TenantUsage) -> AuthResult<()>;
}

/// In-memory tenant repository for testing
#[derive(Default)]
pub struct InMemoryTenantRepository {
    tenants: Arc<RwLock<HashMap<String, TenantEntity>>>,
    usage: Arc<RwLock<HashMap<String, TenantUsage>>>,
}

impl InMemoryTenantRepository {
    pub fn new() -> Self {
        Self {
            tenants: Arc::new(RwLock::new(HashMap::new())),
            usage: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}

#[async_trait::async_trait]
impl TenantRepository for InMemoryTenantRepository {
    async fn create(&self, tenant: &TenantEntity) -> AuthResult<TenantEntity> {
        let mut tenants = self.tenants.write().await;

        // Check for duplicate bu_code
        for existing in tenants.values() {
            if existing.bu_code == tenant.bu_code && existing.active {
                return Err(AuthError::ValidationError(format!(
                    "Business unit code '{}' already exists",
                    tenant.bu_code
                )));
            }
        }

        let mut new_tenant = tenant.clone();
        new_tenant.created_at = Utc::now();
        new_tenant.updated_at = Utc::now();

        tenants.insert(new_tenant.id.clone(), new_tenant.clone());

        // Initialize usage
        let mut usage = self.usage.write().await;
        usage.insert(new_tenant.id.clone(), TenantUsage::default());

        Ok(new_tenant)
    }

    async fn get(&self, tenant_id: &str) -> AuthResult<Option<TenantEntity>> {
        let tenants = self.tenants.read().await;
        Ok(tenants.get(tenant_id).cloned())
    }

    async fn get_by_bu_code(&self, bu_code: &str) -> AuthResult<Option<TenantEntity>> {
        let tenants = self.tenants.read().await;
        Ok(tenants
            .values()
            .find(|t| t.bu_code == bu_code && t.active)
            .cloned())
    }

    async fn list(&self, limit: usize, offset: usize) -> AuthResult<Vec<TenantEntity>> {
        let tenants = self.tenants.read().await;
        let mut result: Vec<_> = tenants.values().filter(|t| t.active).cloned().collect();
        result.sort_by(|a, b| a.created_at.cmp(&b.created_at));
        Ok(result.into_iter().skip(offset).take(limit).collect())
    }

    async fn update(&self, tenant: &TenantEntity) -> AuthResult<TenantEntity> {
        let mut tenants = self.tenants.write().await;

        if !tenants.contains_key(&tenant.id) {
            return Err(AuthError::ValidationError(format!(
                "Tenant '{}' not found",
                tenant.id
            )));
        }

        let mut updated = tenant.clone();
        updated.updated_at = Utc::now();
        tenants.insert(updated.id.clone(), updated.clone());

        Ok(updated)
    }

    async fn delete(&self, tenant_id: &str) -> AuthResult<()> {
        let mut tenants = self.tenants.write().await;

        if let Some(tenant) = tenants.get_mut(tenant_id) {
            tenant.active = false;
            tenant.updated_at = Utc::now();
            Ok(())
        } else {
            Err(AuthError::ValidationError(format!(
                "Tenant '{}' not found",
                tenant_id
            )))
        }
    }

    async fn get_usage(&self, tenant_id: &str) -> AuthResult<TenantUsage> {
        let usage = self.usage.read().await;
        Ok(usage.get(tenant_id).cloned().unwrap_or_default())
    }

    async fn update_usage(&self, tenant_id: &str, new_usage: &TenantUsage) -> AuthResult<()> {
        let mut usage = self.usage.write().await;
        usage.insert(tenant_id.to_string(), new_usage.clone());
        Ok(())
    }
}

/// Tenant-aware query builder
///
/// Provides helper methods for building tenant-scoped queries
pub struct TenantQueryBuilder {
    tenant_id: String,
}

impl TenantQueryBuilder {
    pub fn new(tenant_id: &str) -> Self {
        Self {
            tenant_id: tenant_id.to_string(),
        }
    }

    /// Get SQL WHERE clause for tenant filtering
    pub fn where_clause(&self) -> String {
        format!("tenant_id = '{}'", self.tenant_id)
    }

    /// Get parameterized WHERE clause
    pub fn where_clause_param(&self) -> (&'static str, &str) {
        ("tenant_id = $1", &self.tenant_id)
    }

    /// Build a tenant-scoped SELECT query
    pub fn select(&self, table: &str, columns: &[&str]) -> String {
        format!(
            "SELECT {} FROM {} WHERE tenant_id = $1",
            columns.join(", "),
            table
        )
    }

    /// Build a tenant-scoped INSERT query (auto-adds tenant_id)
    pub fn insert(&self, table: &str, columns: &[&str]) -> String {
        let all_columns: Vec<&str> = std::iter::once("tenant_id")
            .chain(columns.iter().copied())
            .collect();
        let placeholders: Vec<String> = (1..=all_columns.len())
            .map(|i| format!("${}", i))
            .collect();
        format!(
            "INSERT INTO {} ({}) VALUES ({})",
            table,
            all_columns.join(", "),
            placeholders.join(", ")
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tenant_entity_new() {
        let tenant = TenantEntity::new("Test Company", "TC001");
        assert!(!tenant.id.is_empty());
        assert_eq!(tenant.name, "Test Company");
        assert_eq!(tenant.bu_code, "TC001");
        assert!(tenant.active);
    }

    #[test]
    fn test_tenant_entity_to_context() {
        let tenant = TenantEntity::new("Test Company", "TC001");
        let context = tenant.to_context();
        assert_eq!(context.tenant_id, tenant.id);
        assert_eq!(context.name, "Test Company");
        assert_eq!(context.bu_code, "TC001");
        assert!(context.active);
    }

    #[tokio::test]
    async fn test_in_memory_repository_create() {
        let repo = InMemoryTenantRepository::new();
        let tenant = TenantEntity::new("Test", "T001");

        let created = repo.create(&tenant).await.unwrap();
        assert_eq!(created.name, "Test");
        assert_eq!(created.bu_code, "T001");
    }

    #[tokio::test]
    async fn test_in_memory_repository_get() {
        let repo = InMemoryTenantRepository::new();
        let tenant = TenantEntity::new("Test", "T001");
        let created = repo.create(&tenant).await.unwrap();

        let retrieved = repo.get(&created.id).await.unwrap();
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().name, "Test");
    }

    #[tokio::test]
    async fn test_in_memory_repository_get_by_bu_code() {
        let repo = InMemoryTenantRepository::new();
        let tenant = TenantEntity::new("Test", "T001");
        repo.create(&tenant).await.unwrap();

        let retrieved = repo.get_by_bu_code("T001").await.unwrap();
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().bu_code, "T001");
    }

    #[tokio::test]
    async fn test_in_memory_repository_duplicate_bu_code() {
        let repo = InMemoryTenantRepository::new();
        let tenant1 = TenantEntity::new("Test 1", "T001");
        let tenant2 = TenantEntity::new("Test 2", "T001");

        repo.create(&tenant1).await.unwrap();
        let result = repo.create(&tenant2).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_in_memory_repository_list() {
        let repo = InMemoryTenantRepository::new();

        for i in 0..5 {
            let tenant = TenantEntity::new(&format!("Test {}", i), &format!("T00{}", i));
            repo.create(&tenant).await.unwrap();
        }

        let list = repo.list(10, 0).await.unwrap();
        assert_eq!(list.len(), 5);

        let list_limited = repo.list(3, 0).await.unwrap();
        assert_eq!(list_limited.len(), 3);

        let list_offset = repo.list(10, 2).await.unwrap();
        assert_eq!(list_offset.len(), 3);
    }

    #[tokio::test]
    async fn test_in_memory_repository_update() {
        let repo = InMemoryTenantRepository::new();
        let tenant = TenantEntity::new("Test", "T001");
        let created = repo.create(&tenant).await.unwrap();

        let mut updated = created.clone();
        updated.name = "Updated Test".to_string();

        let result = repo.update(&updated).await.unwrap();
        assert_eq!(result.name, "Updated Test");
    }

    #[tokio::test]
    async fn test_in_memory_repository_delete() {
        let repo = InMemoryTenantRepository::new();
        let tenant = TenantEntity::new("Test", "T001");
        let created = repo.create(&tenant).await.unwrap();

        repo.delete(&created.id).await.unwrap();

        let retrieved = repo.get(&created.id).await.unwrap();
        assert!(retrieved.is_some());
        assert!(!retrieved.unwrap().active); // Soft delete
    }

    #[tokio::test]
    async fn test_in_memory_repository_usage() {
        let repo = InMemoryTenantRepository::new();
        let tenant = TenantEntity::new("Test", "T001");
        let created = repo.create(&tenant).await.unwrap();

        let usage = repo.get_usage(&created.id).await.unwrap();
        assert_eq!(usage.flow_count, 0);

        let new_usage = TenantUsage {
            flow_count: 10,
            version_count: 50,
            executions_today: 100,
            storage_used_bytes: 1024,
        };
        repo.update_usage(&created.id, &new_usage).await.unwrap();

        let updated_usage = repo.get_usage(&created.id).await.unwrap();
        assert_eq!(updated_usage.flow_count, 10);
        assert_eq!(updated_usage.executions_today, 100);
    }

    #[test]
    fn test_tenant_query_builder_where_clause() {
        let builder = TenantQueryBuilder::new("tenant-123");
        assert_eq!(builder.where_clause(), "tenant_id = 'tenant-123'");
    }

    #[test]
    fn test_tenant_query_builder_select() {
        let builder = TenantQueryBuilder::new("tenant-123");
        let query = builder.select("flows", &["id", "name", "created_at"]);
        assert_eq!(
            query,
            "SELECT id, name, created_at FROM flows WHERE tenant_id = $1"
        );
    }

    #[test]
    fn test_tenant_query_builder_insert() {
        let builder = TenantQueryBuilder::new("tenant-123");
        let query = builder.insert("flows", &["id", "name"]);
        assert_eq!(
            query,
            "INSERT INTO flows (tenant_id, id, name) VALUES ($1, $2, $3)"
        );
    }
}
