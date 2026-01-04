use sqlx::{
    Connection, Executor, PgConnection, PgPool,
    migrate::{MigrationSource, Migrator},
};
use std::{path::Path, sync::Once, thread};
use ticket_backend::config::Config;
use tokio::runtime::Runtime;
use uuid::Uuid;

static INIT: Once = Once::new();

pub fn init_test_logging() {
    INIT.call_once(|| {
        tracing_subscriber::fmt()
            .with_env_filter("ticket_backend=debug,sqlx=warn")
            .with_test_writer()
            .init();
    });
}

// pub async fn setup_test_db() -> PgPool {
//     dotenvy::dotenv().ok();

//     let database_url = std::env::var("TEST_DATABASE_URL")
//         .unwrap_or_else(|_| "postgres://postgres:postgres@localhost:5432/ticket_db_test".into());

//     let pool = sqlx::postgres::PgPoolOptions::new()
//         .max_connections(5)
//         .connect(&database_url)
//         .await
//         .expect("Failed to connect to test database");

//     // Run migrations
//     sqlx::migrate!("./migrations")
//         .run(&pool)
//         .await
//         .expect("Failed to run migrations");

//     pool
// }

// pub async fn lock_and_cleanup_data(pool: &PgPool) -> Option<tokio::sync::MutexGuard<'static, ()>> {
//     // 使用锁确保 cleanup 操作的原子性，以及后续测试运行期间的独占访问
//     let lock = TEST_LOCK.lock().await;

//     // 按照外键依赖顺序删除
//     sqlx::query("DELETE FROM ticket_history")
//         .execute(pool)
//         .await
//         .ok();

//     sqlx::query("DELETE FROM ticket_tags")
//         .execute(pool)
//         .await
//         .ok();

//     sqlx::query("DELETE FROM attachments")
//         .execute(pool)
//         .await
//         .ok();

//     sqlx::query("DELETE FROM tickets")
//         .execute(pool)
//         .await
//         .ok();

//     sqlx::query("DELETE FROM tags WHERE is_predefined = false")
//         .execute(pool)
//         .await
//         .ok();

//     Some(lock)
// }
#[derive(Debug)]
pub struct TestPg {
    pub server_url: String,
    pub dbname: String,
}
impl TestPg {
    pub fn new<S>(database_url: String, migrations: S) -> Self
    where
        S: MigrationSource<'static> + Send + Sync + 'static,
    {
        let simple = Uuid::new_v4().simple();
        let (server_url, dbname) = parse_postgres_url(&database_url);
        let dbname = match dbname {
            Some(db_name) => format!("{}_test_{}", db_name, simple),
            None => format!("test_{}", simple),
        };
        let dbname_cloned = dbname.clone();

        let tdb = Self { server_url, dbname };

        let url = tdb.url();

        // create database dbname
        thread::spawn(move || {
            let rt = Runtime::new().unwrap();
            rt.block_on(async move {
                // use server url to create database
                let mut conn = PgConnection::connect(&database_url)
                    .await
                    .unwrap_or_else(|_| panic!("Error while connecting to {}", database_url));
                conn.execute(format!(r#"CREATE DATABASE "{dbname_cloned}""#).as_str())
                    .await
                    .unwrap();

                // now connect to test database for migration
                let mut conn = PgConnection::connect(&url)
                    .await
                    .unwrap_or_else(|_| panic!("Error while connecting to {}", &url));
                let m = Migrator::new(migrations).await.unwrap();
                m.run(&mut conn).await.unwrap();
            });
        })
        .join()
        .expect("failed to create database");

        tdb
    }

    pub fn url(&self) -> String {
        format!("{}/{}", self.server_url, self.dbname)
    }

    pub async fn get_pool(&self) -> PgPool {
        let url = self.url();
        PgPool::connect(&url)
            .await
            .unwrap_or_else(|_| panic!("Error while connecting to {}", url))
    }
}

impl Drop for TestPg {
    fn drop(&mut self) {
        let server_url = &self.server_url;
        let database_url = format!("{server_url}/postgres");
        let dbname = self.dbname.clone();
        thread::spawn(move || {
            let rt = Runtime::new().unwrap();
            rt.block_on(async move {
                    let mut conn = PgConnection::connect(&database_url).await
                    .unwrap_or_else(|_| panic!("Error while connecting to {}", database_url));
                    // terminate existing connections
                    sqlx::query(&format!(r#"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE pid <> pg_backend_pid() AND datname = '{dbname}'"#))
                    .execute( &mut conn)
                    .await
                    .expect("Terminate all other connections");
                    conn.execute(format!(r#"DROP DATABASE "{dbname}""#).as_str())
                        .await
                        .expect("Error while querying the drop database");
                });
            })
            .join()
            .expect("failed to drop database");
    }
}

impl Default for TestPg {
    fn default() -> Self {
        Self::new(
            "postgres://postgres:postgres@localhost:5432".to_string(),
            Path::new("migrations"),
        )
    }
}

fn parse_postgres_url(url: &str) -> (String, Option<String>) {
    let url_without_protocol = url.trim_start_matches("postgres://");

    let parts: Vec<&str> = url_without_protocol.split('/').collect();
    let server_url = format!("postgres://{}", parts[0]);

    let dbname = if parts.len() > 1 && !parts[1].is_empty() {
        Some(parts[1].to_string())
    } else {
        None
    };

    (server_url, dbname)
}

pub async fn get_test_pool(url: Option<String>) -> (TestPg, PgPool) {
    let url = match url {
        Some(url) => url.to_string(),
        None => "postgres://postgres:postgres@localhost:5432".to_string(),
    };
    let tdb = TestPg::new(url, Path::new("migrations"));
    let pool = tdb.get_pool().await;
    // run prepared sql t0 insert test data

    // let sql = include_str!("../fixtures/test.sql").split(";");
    // let mut ts = pool.begin().await.expect("begin transaction failed");
    // for s in sql {
    //     if s.trim().is_empty() {
    //         continue;
    //     }
    //     ts.execute(s).await.expect("execute sql failed");
    // }
    // ts.commit().await.expect("commit transaction failed");

    (tdb, pool)
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
