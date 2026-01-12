//! CRM 服务 - 提供客户信息查询

use axum::{extract::Path, routing::get, Json, Router};
use serde::Serialize;
use std::collections::HashMap;

#[derive(Serialize, Clone)]
struct Customer {
    id: String,
    name: String,
    email: String,
    phone: String,
    level: String,
    #[serde(rename = "createdAt")]
    created_at: String,
}

async fn health() -> &'static str {
    "OK"
}

async fn get_user(Path(user_id): Path<String>) -> Json<Customer> {
    let customers: HashMap<&str, Customer> = HashMap::from([
        (
            "C001",
            Customer {
                id: "C001".to_string(),
                name: "张三".to_string(),
                email: "zhangsan@example.com".to_string(),
                phone: "13800138001".to_string(),
                level: "VIP".to_string(),
                created_at: "2023-01-15T10:30:00Z".to_string(),
            },
        ),
        (
            "C002",
            Customer {
                id: "C002".to_string(),
                name: "李四".to_string(),
                email: "lisi@example.com".to_string(),
                phone: "13800138002".to_string(),
                level: "普通".to_string(),
                created_at: "2023-06-20T14:00:00Z".to_string(),
            },
        ),
    ]);

    let customer = customers
        .get(user_id.as_str())
        .cloned()
        .unwrap_or(Customer {
            id: user_id.clone(),
            name: format!("用户_{}", user_id),
            email: format!("user_{}@example.com", user_id),
            phone: "13800000000".to_string(),
            level: "普通".to_string(),
            created_at: chrono::Utc::now().to_rfc3339(),
        });

    Json(customer)
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/health", get(health))
        .route("/user/:id", get(get_user));

    println!("CRM Service running on :8080");
    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
