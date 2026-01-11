//! 短信服务 Mock - 模拟阿里云/腾讯云/Twilio 短信发送

use axum::{
    extract::Json,
    http::StatusCode,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

static MESSAGE_COUNTER: AtomicU64 = AtomicU64::new(1);

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SendSmsRequest {
    phone: String,
    #[serde(default)]
    template_code: Option<String>,
    #[serde(default)]
    template_param: Option<serde_json::Value>,
    #[serde(default)]
    content: Option<String>,
    #[serde(default)]
    sign_name: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SendSmsResponse {
    success: bool,
    request_id: String,
    biz_id: String,
    code: String,
    message: String,
}

#[derive(Serialize)]
struct HealthResponse {
    status: String,
    service: String,
    provider: String,
}

#[derive(Clone)]
struct AppState {
    sent_messages: Arc<tokio::sync::RwLock<Vec<SmsRecord>>>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SmsRecord {
    id: u64,
    phone: String,
    template_code: Option<String>,
    content: String,
    sent_at: String,
}

async fn health() -> Json<HealthResponse> {
    let provider = std::env::var("SMS_PROVIDER").unwrap_or_else(|_| "mock".to_string());
    Json(HealthResponse {
        status: "healthy".to_string(),
        service: "sms-service".to_string(),
        provider,
    })
}

async fn send_sms(
    axum::extract::State(state): axum::extract::State<AppState>,
    Json(req): Json<SendSmsRequest>,
) -> Result<Json<SendSmsResponse>, (StatusCode, Json<SendSmsResponse>)> {
    // 验证手机号
    if req.phone.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(SendSmsResponse {
                success: false,
                request_id: generate_request_id(),
                biz_id: String::new(),
                code: "InvalidPhone".to_string(),
                message: "Phone number is required".to_string(),
            }),
        ));
    }

    // 生成 ID
    let msg_id = MESSAGE_COUNTER.fetch_add(1, Ordering::SeqCst);
    let request_id = generate_request_id();
    let biz_id = format!("BIZ{:016}", msg_id);

    // 构建短信内容
    let content = if let Some(content) = req.content {
        content
    } else if let Some(template_code) = &req.template_code {
        let params = req
            .template_param
            .as_ref()
            .map(|p| serde_json::to_string(p).unwrap_or_default())
            .unwrap_or_default();
        format!("[Template: {}] Params: {}", template_code, params)
    } else {
        "[Empty Message]".to_string()
    };

    // 记录短信
    let record = SmsRecord {
        id: msg_id,
        phone: req.phone.clone(),
        template_code: req.template_code.clone(),
        content: content.clone(),
        sent_at: chrono::Utc::now().to_rfc3339(),
    };

    // 存储记录
    {
        let mut messages = state.sent_messages.write().await;
        messages.push(record.clone());
        // 只保留最近 100 条
        if messages.len() > 100 {
            messages.remove(0);
        }
    }

    // 打印日志
    println!(
        "[SMS] #{} -> {} | Template: {:?} | Content: {}",
        msg_id,
        req.phone,
        req.template_code.as_deref().unwrap_or("none"),
        if content.len() > 50 {
            format!("{}...", &content[..50])
        } else {
            content
        }
    );

    Ok(Json(SendSmsResponse {
        success: true,
        request_id,
        biz_id,
        code: "OK".to_string(),
        message: "SMS sent successfully (mock)".to_string(),
    }))
}

/// 发送模板短信（阿里云风格 API）
async fn send_template(
    state: axum::extract::State<AppState>,
    Json(req): Json<SendSmsRequest>,
) -> Result<Json<SendSmsResponse>, (StatusCode, Json<SendSmsResponse>)> {
    send_sms(state, Json(req)).await
}

/// 查询已发送的短信记录
async fn list_messages(
    axum::extract::State(state): axum::extract::State<AppState>,
) -> Json<Vec<SmsRecord>> {
    let messages = state.sent_messages.read().await;
    Json(messages.clone())
}

/// 清空短信记录
async fn clear_messages(
    axum::extract::State(state): axum::extract::State<AppState>,
) -> Json<serde_json::Value> {
    let mut messages = state.sent_messages.write().await;
    let count = messages.len();
    messages.clear();
    Json(serde_json::json!({
        "success": true,
        "cleared": count
    }))
}

fn generate_request_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    format!("{:032X}", now)
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let state = AppState {
        sent_messages: Arc::new(tokio::sync::RwLock::new(Vec::new())),
    };

    let app = Router::new()
        .route("/health", get(health))
        .route("/send", post(send_sms))
        .route("/template", post(send_template))
        .route("/messages", get(list_messages))
        .route("/messages/clear", post(clear_messages))
        .with_state(state);

    let port = std::env::var("PORT").unwrap_or_else(|_| "8080".to_string());
    let addr = format!("0.0.0.0:{}", port);

    println!("SMS Service (Mock) running on {}", addr);
    println!(
        "Provider: {}",
        std::env::var("SMS_PROVIDER").unwrap_or_else(|_| "mock".to_string())
    );

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
