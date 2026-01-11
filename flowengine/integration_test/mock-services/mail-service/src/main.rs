//! 邮件服务 - 提供 REST API 并通过 SMTP 发送邮件到 MailHog

use axum::{
    extract::Json,
    http::StatusCode,
    routing::{get, post},
    Router,
};
use lettre::{
    message::header::ContentType, transport::smtp::client::Tls, AsyncSmtpTransport,
    AsyncTransport, Message, Tokio1Executor,
};
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
struct SendEmailRequest {
    to: String,
    subject: Option<String>,
    template: Option<String>,
    body: Option<String>,
    data: Option<serde_json::Value>,
}

#[derive(Serialize)]
struct SendEmailResponse {
    success: bool,
    message_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Serialize)]
struct HealthResponse {
    status: String,
    service: String,
}

async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "healthy".to_string(),
        service: "mail-service".to_string(),
    })
}

async fn send_email(
    Json(req): Json<SendEmailRequest>,
) -> Result<Json<SendEmailResponse>, (StatusCode, Json<SendEmailResponse>)> {
    let smtp_host = std::env::var("SMTP_HOST").unwrap_or_else(|_| "localhost".to_string());
    let smtp_port: u16 = std::env::var("SMTP_PORT")
        .unwrap_or_else(|_| "1025".to_string())
        .parse()
        .unwrap_or(1025);
    let from_address =
        std::env::var("FROM_ADDRESS").unwrap_or_else(|_| "noreply@flowengine.local".to_string());

    // 构建邮件主题
    let subject = req.subject.unwrap_or_else(|| {
        req.template
            .as_ref()
            .map(|t| format!("[FlowEngine] {}", t))
            .unwrap_or_else(|| "[FlowEngine] Notification".to_string())
    });

    // 构建邮件正文
    let body = req.body.unwrap_or_else(|| {
        let template = req.template.as_deref().unwrap_or("default");
        let data = req
            .data
            .as_ref()
            .map(|d| serde_json::to_string_pretty(d).unwrap_or_default())
            .unwrap_or_default();

        format!(
            "FlowEngine Notification\n\
             ========================\n\n\
             Template: {}\n\n\
             Data:\n{}\n\n\
             ---\n\
             This is an automated message from FlowEngine.",
            template, data
        )
    });

    // 生成消息 ID
    let message_id = format!(
        "{}@flowengine.local",
        uuid::Uuid::new_v4().to_string().replace('-', "")
    );

    // 构建邮件
    let email = match Message::builder()
        .from(from_address.parse().unwrap())
        .to(req.to.parse().map_err(|e| {
            (
                StatusCode::BAD_REQUEST,
                Json(SendEmailResponse {
                    success: false,
                    message_id: String::new(),
                    error: Some(format!("Invalid email address: {}", e)),
                }),
            )
        })?)
        .subject(subject)
        .header(ContentType::TEXT_PLAIN)
        .body(body)
    {
        Ok(email) => email,
        Err(e) => {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(SendEmailResponse {
                    success: false,
                    message_id: String::new(),
                    error: Some(format!("Failed to build email: {}", e)),
                }),
            ));
        }
    };

    // 创建 SMTP 传输
    let mailer: AsyncSmtpTransport<Tokio1Executor> =
        AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(&smtp_host)
            .port(smtp_port)
            .tls(Tls::None)
            .build();

    // 发送邮件
    match mailer.send(email).await {
        Ok(_) => {
            println!(
                "[MAIL] Sent email to {} (template: {:?})",
                req.to,
                req.template.as_deref().unwrap_or("none")
            );
            Ok(Json(SendEmailResponse {
                success: true,
                message_id,
                error: None,
            }))
        }
        Err(e) => {
            eprintln!("[MAIL] Failed to send email: {}", e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(SendEmailResponse {
                    success: false,
                    message_id: String::new(),
                    error: Some(format!("SMTP error: {}", e)),
                }),
            ))
        }
    }
}

/// 发送测试邮件
async fn send_test() -> Json<SendEmailResponse> {
    let test_req = SendEmailRequest {
        to: "test@example.com".to_string(),
        subject: Some("Test Email from Mail Service".to_string()),
        template: Some("test".to_string()),
        body: Some("This is a test email to verify the mail service is working.".to_string()),
        data: None,
    };

    match send_email(Json(test_req)).await {
        Ok(resp) => resp,
        Err((_, resp)) => resp,
    }
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let app = Router::new()
        .route("/health", get(health))
        .route("/send", post(send_email))
        .route("/test", post(send_test));

    let port = std::env::var("PORT").unwrap_or_else(|_| "8080".to_string());
    let addr = format!("0.0.0.0:{}", port);

    println!("Mail Service running on {}", addr);
    println!(
        "SMTP Server: {}:{}",
        std::env::var("SMTP_HOST").unwrap_or_else(|_| "localhost".to_string()),
        std::env::var("SMTP_PORT").unwrap_or_else(|_| "1025".to_string())
    );

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

mod uuid {
    pub struct Uuid;

    impl Uuid {
        pub fn new_v4() -> Self {
            Uuid
        }
    }

    impl std::fmt::Display for Uuid {
        fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            use std::time::{SystemTime, UNIX_EPOCH};
            let now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos();
            write!(f, "{:032x}", now)
        }
    }
}
