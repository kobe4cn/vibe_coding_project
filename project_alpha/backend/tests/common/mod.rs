use sqlx::PgPool;
use std::sync::Once;
use ticket_backend::config::Config;
use tokio::sync::Mutex;

// 使用全局锁确保测试串行执行，避免数据库竞争
static TEST_LOCK: Mutex<()> = Mutex::const_new(());

static INIT: Once = Once::new();

pub fn init_test_logging() {
    INIT.call_once(|| {
        tracing_subscriber::fmt()
            .with_env_filter("ticket_backend=debug,sqlx=warn")
            .with_test_writer()
            .init();
    });
}

pub async fn setup_test_db() -> PgPool {
    dotenvy::dotenv().ok();

    let database_url = std::env::var("TEST_DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:postgres@localhost:5432/ticket_db_test".into());

    let pool = sqlx::postgres::PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("Failed to connect to test database");

    // Run migrations
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("Failed to run migrations");

    pool
}

pub async fn lock_and_cleanup_data(pool: &PgPool) -> Option<tokio::sync::MutexGuard<'static, ()>> {
    // 使用锁确保 cleanup 操作的原子性，以及后续测试运行期间的独占访问
    let lock = TEST_LOCK.lock().await;
    
    // 按照外键依赖顺序删除
    sqlx::query("DELETE FROM ticket_history")
        .execute(pool)
        .await
        .ok();
    
    sqlx::query("DELETE FROM ticket_tags")
        .execute(pool)
        .await
        .ok();
    
    sqlx::query("DELETE FROM attachments")
        .execute(pool)
        .await
        .ok();
    
    sqlx::query("DELETE FROM tickets")
        .execute(pool)
        .await
        .ok();
    
    sqlx::query("DELETE FROM tags WHERE is_predefined = false")
        .execute(pool)
        .await
        .ok();

    Some(lock)
}

#[allow(dead_code)]
pub fn test_config() -> Config {
    Config {
        database_url: std::env::var("TEST_DATABASE_URL").unwrap_or_else(|_| {
            "postgres://postgres:postgres@localhost:5432/ticket_db_test".into()
        }),
        host: "127.0.0.1".into(),
        port: 3001,
        upload_dir: "/tmp/ticket_test_uploads".into(),
        max_file_size: 1024 * 1024, // 1MB for tests
    }
}
