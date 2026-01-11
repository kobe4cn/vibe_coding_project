//! 风控服务 - 提供信用评分功能

use axum::{
    extract::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
struct CreditCheckRequest {
    #[serde(rename = "customerId")]
    customer_id: String,
    #[serde(rename = "checkType")]
    check_type: Option<String>,
}

#[derive(Serialize)]
struct CreditCheckResponse {
    success: bool,
    #[serde(rename = "customerId")]
    customer_id: String,
    score: i32,
    level: String,
    factors: Vec<String>,
    #[serde(rename = "checkedAt")]
    checked_at: String,
}

async fn health() -> &'static str {
    "OK"
}

async fn credit_evaluate(Json(req): Json<CreditCheckRequest>) -> Json<CreditCheckResponse> {
    let hash: u32 = req.customer_id.bytes().map(|b| b as u32).sum();
    let score = 600 + (hash % 200) as i32;

    let level = match score {
        750..=800 => "VIP",
        700..=749 => "优质",
        650..=699 => "良好",
        _ => "普通",
    };

    Json(CreditCheckResponse {
        success: true,
        customer_id: req.customer_id,
        score,
        level: level.to_string(),
        factors: vec![
            "历史订单记录良好".to_string(),
            "账户活跃度高".to_string(),
        ],
        checked_at: chrono::Utc::now().to_rfc3339(),
    })
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/health", get(health))
        .route("/credit/evaluate", post(credit_evaluate));

    let port = std::env::var("PORT").unwrap_or_else(|_| "8081".to_string());
    println!("Risk Service running on :{}", port);
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port)).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
