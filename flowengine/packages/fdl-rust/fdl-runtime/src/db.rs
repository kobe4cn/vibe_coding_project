//! Database connection pool and utilities

use sqlx::postgres::{PgPool, PgPoolOptions};
use std::time::Duration;

use crate::state::DatabaseConfig;

/// Database connection pool wrapper
#[derive(Clone)]
pub struct Database {
    pool: PgPool,
}

impl Database {
    /// Create a new database connection pool from configuration
    pub async fn connect(config: &DatabaseConfig) -> Result<Self, sqlx::Error> {
        let url = config
            .url
            .as_ref()
            .ok_or_else(|| sqlx::Error::Configuration("DATABASE_URL not set".into()))?;

        let pool = PgPoolOptions::new()
            .max_connections(config.pool_size)
            .acquire_timeout(Duration::from_secs(config.timeout_secs))
            .connect(url)
            .await?;

        tracing::info!("Database connected successfully");
        tracing::info!("  Pool size: {}", config.pool_size);

        Ok(Self { pool })
    }

    /// Get the underlying pool
    pub fn pool(&self) -> &PgPool {
        &self.pool
    }

    /// Check if database is healthy
    pub async fn is_healthy(&self) -> bool {
        sqlx::query("SELECT 1").fetch_one(&self.pool).await.is_ok()
    }

    /// Run pending migrations
    pub async fn run_migrations(&self) -> Result<(), sqlx::migrate::MigrateError> {
        sqlx::migrate!("./migrations").run(&self.pool).await
    }

    /// Set tenant context for row-level security
    pub async fn set_tenant_context(&self, tenant_id: &str) -> Result<(), sqlx::Error> {
        sqlx::query("SELECT set_config('app.current_tenant_id', $1, true)")
            .bind(tenant_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_database_config_default() {
        let config = DatabaseConfig::default();
        assert!(!config.enabled);
        assert!(config.url.is_none());
        assert_eq!(config.pool_size, 10);
    }
}
