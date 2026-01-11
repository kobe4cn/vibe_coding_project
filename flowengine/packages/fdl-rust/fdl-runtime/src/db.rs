//! 数据库连接池和工具函数
//!
//! 提供 PostgreSQL 数据库连接管理、健康检查和迁移功能。

use sqlx::postgres::{PgPool, PgPoolOptions};
use std::time::Duration;

use crate::state::DatabaseConfig;

/// 数据库连接池包装器
///
/// 封装 PostgreSQL 连接池，提供统一的数据库访问接口。
#[derive(Clone)]
pub struct Database {
    pool: PgPool,
}

impl Database {
    /// Create a new database connection pool from configuration
    ///
    /// 连接后会设置会话时区为 UTC，确保时间戳处理一致性。
    pub async fn connect(config: &DatabaseConfig) -> Result<Self, sqlx::Error> {
        let url = config
            .url
            .as_ref()
            .ok_or_else(|| sqlx::Error::Configuration("DATABASE_URL not set".into()))?;

        // 在连接后回调中设置时区为 UTC，确保所有时间操作使用统一时区
        let pool = PgPoolOptions::new()
            .max_connections(config.pool_size)
            .acquire_timeout(Duration::from_secs(config.timeout_secs))
            .after_connect(|conn, _meta| {
                Box::pin(async move {
                    // 设置会话时区为 UTC，确保时间戳一致性
                    sqlx::query("SET timezone = 'UTC'").execute(conn).await?;
                    Ok(())
                })
            })
            .connect(url)
            .await?;

        tracing::info!("Database connected successfully");
        tracing::info!("  Pool size: {}", config.pool_size);
        tracing::info!("  Timezone: UTC");

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

    /// 设置租户上下文（用于行级安全）
    ///
    /// 使用 PostgreSQL 的会话变量实现多租户数据隔离。
    /// 设置后，所有查询都会自动过滤到当前租户的数据。
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
