# FlowEngine 集成服务测试方案

本文档描述了如何测试 FlowEngine 的集成服务功能，包括对象存储、消息队列、微服务调用等场景。

## 一、增强后的流程 YAML

### 主流程：客户视图构建流程（增强版）

```yaml
flow:
    name: 客户视图构建流程
    desp: |
      根据客户标识获取完整客户视图，包括：
      - 基本信息（API）
      - 订单统计（数据库）
      - 客户头像（对象存储）
      - 信用评分（微服务）
      构建完成后保存报告并通知下游系统
    args:
        in:
            customerId: string
            from: string
        out:
            - name: id
              type: string
            - name: username
              type: string
            - name: orders
              type: int
            - name: avatarUrl
              type: string
            - name: creditScore
              type: int
            - name: creditLevel
              type: string
        entry:
            - customer
            - orderCount
            - fetchAvatar
            - creditCheck
    node:
        # ========== 原有节点 ==========
        customer:
            name: 获取客户基本信息
            exec: api://crm-service/user/${userid}?method=GET
            args: userid=customerId
            next: merge

        orderCount:
            name: 获取客户订单数量
            exec: db://ec.postgres.order/count
            args: exps = `customerId = ${customerId} && orderTime > '${from}'`
            next: merge

        # ========== 对象存储场景 ==========
        fetchAvatar:
            name: 获取客户头像
            desp: 从 MinIO 对象存储获取客户头像的预签名 URL
            oss: oss://customer-assets/avatars/${customerId}.jpg
            operation: presign
            args: |
                expiry = 3600  # URL 有效期 1 小时
            next: merge

        # ========== 微服务调用场景 ==========
        creditCheck:
            name: 检查客户信用评分
            desp: 调用风控微服务获取客户信用评分
            service: svc://risk-service/credit/evaluate
            method: POST
            args: |
                body = {
                    customerId: customerId,
                    checkType: "standard"
                }
            next: merge

        # ========== 数据合并 ==========
        merge:
            name: 合并客户视图
            with: |
                id = customer.id
                username = customer.username
                phone = customer.phone
                orders = orderCount.value
                avatarUrl = fetchAvatar.presignedUrl
                creditScore = creditCheck.score
                creditLevel = creditCheck.level
            next: saveReport

        # ========== 保存报告到对象存储 ==========
        saveReport:
            name: 保存客户报告
            desp: 将构建好的客户视图保存为 JSON 文件到对象存储
            oss: oss://customer-reports/${customerId}/view-${timestamp()}.json
            operation: upload
            args: |
                content = JSON.stringify({
                    generatedAt: now(),
                    customer: $
                })
                contentType = "application/json"
            next: notifyMQ

        # ========== 发送消息到队列 ==========
        notifyMQ:
            name: 发布客户视图更新事件
            desp: 向消息队列发送事件，通知下游系统客户视图已更新
            mq: mq://customer-events/view.updated
            operation: publish
            args: |
                message = {
                    eventType: "customer.view.updated",
                    eventId: uuid(),
                    timestamp: now(),
                    payload: {
                        customerId: customerId,
                        reportUrl: saveReport.objectUrl,
                        creditLevel: creditLevel
                    }
                }
                # RabbitMQ 特定配置
                exchange = "customer.events"
                routingKey = "view.updated"
```

### 消费者流程：客户视图更新通知服务

```yaml
flow:
    name: 客户视图通知服务
    desp: |
      订阅客户视图更新事件，根据信用等级执行不同的通知策略：
      - VIP 客户：发送邮件 + 短信
      - 普通客户：仅发送邮件
    trigger:
        type: mq
        mq: mq://customer-events/view.updated
        operation: subscribe
        args: |
            queue = "notification-service.customer-view"
            exchange = "customer.events"
            routingKey = "view.updated"
    node:
        parseEvent:
            name: 解析事件消息
            with: |
                event = $.message
                customerId = event.payload.customerId
                creditLevel = event.payload.creditLevel
            next: routeByLevel

        routeByLevel:
            name: 根据信用等级路由
            condition:
                when: creditLevel == "VIP"
                then: notifyVIP
                else: notifyNormal

        notifyVIP:
            name: VIP 客户通知
            desp: VIP 客户发送邮件和短信
            entry:
                - sendVIPEmail
                - sendVIPSms

        sendVIPEmail:
            name: 发送 VIP 邮件
            mail: mail://smtp-service/send
            args: |
                to = customer.email
                template = "vip-view-updated"
                data = event.payload
            next: logComplete

        sendVIPSms:
            name: 发送 VIP 短信
            sms: sms://aliyun-sms/template
            args: |
                phone = customer.phone
                templateCode = "SMS_VIP_UPDATE"
                templateParam = { customerName: customer.name }
            next: logComplete

        notifyNormal:
            name: 普通客户通知
            mail: mail://smtp-service/send
            args: |
                to = customer.email
                template = "standard-view-updated"
                data = event.payload
            next: logComplete

        logComplete:
            name: 记录通知完成
            exec: api://log-service/notification/complete
            args: |
                eventId = event.eventId
                notifiedAt = now()
```

## 二、需要部署的组件

| 组件 | 用途 | 端口 | 说明 |
|------|------|------|------|
| MinIO | 对象存储 | 9000/9001 | 模拟 OSS/S3 |
| RabbitMQ | 消息队列 | 5672/15672 | 消息发布/订阅 |
| PostgreSQL | 数据库 | 5432 | 存储订单数据 |
| MailHog | 邮件测试 | 1025/8025 | 捕获测试邮件 |
| risk-service | 风控微服务 | 8081 | 信用评分 |
| crm-service | CRM 微服务 | 8082 | 客户信息 |
| notification-service | 通知服务 | 8083 | 消息消费者 |

## 三、Docker Compose 配置

```yaml
# docker-compose.yml
version: '3.8'

services:
  # ============================================
  # 1. MinIO - 对象存储（模拟 OSS/S3）
  # ============================================
  minio:
    image: minio/minio:latest
    container_name: flowengine-minio
    ports:
      - "9000:9000"      # API 端口
      - "9001:9001"      # Console 端口
    environment:
      MINIO_ROOT_USER: flowengine
      MINIO_ROOT_PASSWORD: flowengine123
    volumes:
      - minio_data:/data
    command: server /data --console-address ":9001"
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 5s
      timeout: 5s
      retries: 5

  # MinIO 初始化（创建 bucket）
  minio-init:
    image: minio/mc:latest
    container_name: flowengine-minio-init
    depends_on:
      minio:
        condition: service_healthy
    entrypoint: >
      /bin/sh -c "
      mc alias set myminio http://minio:9000 flowengine flowengine123;
      mc mb myminio/customer-assets --ignore-existing;
      mc mb myminio/customer-reports --ignore-existing;
      mc anonymous set download myminio/customer-assets;
      echo 'MinIO buckets created successfully';
      "

  # ============================================
  # 2. RabbitMQ - 消息队列
  # ============================================
  rabbitmq:
    image: rabbitmq:3-management
    container_name: flowengine-rabbitmq
    ports:
      - "5672:5672"      # AMQP 端口
      - "15672:15672"    # Management UI 端口
    environment:
      RABBITMQ_DEFAULT_USER: flowengine
      RABBITMQ_DEFAULT_PASS: flowengine123
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    healthcheck:
      test: rabbitmq-diagnostics -q ping
      interval: 10s
      timeout: 5s
      retries: 5

  # RabbitMQ 初始化（创建 exchange 和 queue）
  rabbitmq-init:
    image: rabbitmq:3-management
    container_name: flowengine-rabbitmq-init
    depends_on:
      rabbitmq:
        condition: service_healthy
    entrypoint: >
      /bin/sh -c "
      sleep 5;
      rabbitmqadmin -H rabbitmq -u flowengine -p flowengine123 declare exchange name=customer.events type=topic durable=true;
      rabbitmqadmin -H rabbitmq -u flowengine -p flowengine123 declare queue name=notification-service.customer-view durable=true;
      rabbitmqadmin -H rabbitmq -u flowengine -p flowengine123 declare binding source=customer.events destination=notification-service.customer-view routing_key=view.updated;
      echo 'RabbitMQ exchanges and queues created successfully';
      "

  # ============================================
  # 3. Mock 微服务 - 风控服务
  # ============================================
  risk-service:
    build:
      context: ./mock-services/risk-service
      dockerfile: Dockerfile
    container_name: flowengine-risk-service
    ports:
      - "8081:8080"
    environment:
      SERVICE_NAME: risk-service
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 10s
      timeout: 5s
      retries: 3

  # ============================================
  # 4. Mock 微服务 - CRM 服务
  # ============================================
  crm-service:
    build:
      context: ./mock-services/crm-service
      dockerfile: Dockerfile
    container_name: flowengine-crm-service
    ports:
      - "8082:8080"
    environment:
      SERVICE_NAME: crm-service

  # ============================================
  # 5. Mock 微服务 - 通知服务
  # ============================================
  notification-service:
    build:
      context: ./mock-services/notification-service
      dockerfile: Dockerfile
    container_name: flowengine-notification-service
    ports:
      - "8083:8080"
    environment:
      SERVICE_NAME: notification-service
      RABBITMQ_URL: amqp://flowengine:flowengine123@rabbitmq:5672/
      QUEUE_NAME: notification-service.customer-view

  # ============================================
  # 6. PostgreSQL - 数据库
  # ============================================
  postgres:
    image: postgres:16-alpine
    container_name: flowengine-postgres
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: flowengine
      POSTGRES_PASSWORD: flowengine123
      POSTGRES_DB: flowengine
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init-scripts/postgres:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U flowengine"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ============================================
  # 7. MailHog - 邮件测试服务
  # ============================================
  mailhog:
    image: mailhog/mailhog:latest
    container_name: flowengine-mailhog
    ports:
      - "1025:1025"      # SMTP 端口
      - "8025:8025"      # Web UI 端口

volumes:
  minio_data:
  rabbitmq_data:
  postgres_data:
```

## 四、Mock 微服务实现

### 1. 风控服务 (risk-service)

**目录结构：**
```
mock-services/risk-service/
├── Cargo.toml
├── Dockerfile
└── src/
    └── main.rs
```

**Cargo.toml:**
```toml
[package]
name = "risk-service"
version = "0.1.0"
edition = "2021"

[dependencies]
axum = "0.7"
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
chrono = { version = "0.4", features = ["serde"] }
```

**src/main.rs:**
```rust
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
    // 模拟信用评分逻辑：基于 customerId 生成稳定的分数
    let hash: u32 = req.customer_id.bytes().map(|b| b as u32).sum();
    let score = 600 + (hash % 200) as i32; // 600-800 分

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

    println!("Risk Service running on :8080");
    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
```

**Dockerfile:**
```dockerfile
FROM rust:1.75 as builder
WORKDIR /app
COPY . .
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates curl && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/risk-service /usr/local/bin/
EXPOSE 8080
CMD ["risk-service"]
```

### 2. CRM 服务 (crm-service)

**src/main.rs:**
```rust
use axum::{
    extract::Path,
    routing::get,
    Json, Router,
};
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
    // 模拟客户数据
    let customers: HashMap<&str, Customer> = HashMap::from([
        ("C001", Customer {
            id: "C001".to_string(),
            name: "张三".to_string(),
            email: "zhangsan@example.com".to_string(),
            phone: "13800138001".to_string(),
            level: "VIP".to_string(),
            created_at: "2023-01-15T10:30:00Z".to_string(),
        }),
        ("C002", Customer {
            id: "C002".to_string(),
            name: "李四".to_string(),
            email: "lisi@example.com".to_string(),
            phone: "13800138002".to_string(),
            level: "普通".to_string(),
            created_at: "2023-06-20T14:00:00Z".to_string(),
        }),
    ]);

    let customer = customers.get(user_id.as_str()).cloned().unwrap_or(Customer {
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
```

### 3. 通知服务消费者 (notification-service)

**Cargo.toml:**
```toml
[package]
name = "notification-service"
version = "0.1.0"
edition = "2021"

[dependencies]
tokio = { version = "1", features = ["full"] }
lapin = "2"
tokio-amqp = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
futures-lite = "2"
```

**src/main.rs:**
```rust
use futures_lite::StreamExt;
use lapin::{
    options::*, types::FieldTable, Connection, ConnectionProperties,
};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct CustomerViewEvent {
    #[serde(rename = "eventType")]
    event_type: String,
    #[serde(rename = "eventId")]
    event_id: String,
    timestamp: String,
    payload: EventPayload,
}

#[derive(Debug, Deserialize)]
struct EventPayload {
    #[serde(rename = "customerId")]
    customer_id: String,
    #[serde(rename = "reportUrl")]
    report_url: Option<String>,
    #[serde(rename = "creditLevel")]
    credit_level: String,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let rabbitmq_url = std::env::var("RABBITMQ_URL")
        .unwrap_or_else(|_| "amqp://flowengine:flowengine123@localhost:5672/".to_string());
    let queue_name = std::env::var("QUEUE_NAME")
        .unwrap_or_else(|_| "notification-service.customer-view".to_string());

    println!("Notification Service starting...");
    println!("Connecting to RabbitMQ: {}", rabbitmq_url);

    let conn = Connection::connect(&rabbitmq_url, ConnectionProperties::default())
        .await?;

    let channel = conn.create_channel().await?;

    let mut consumer = channel
        .basic_consume(
            &queue_name,
            "notification-consumer",
            BasicConsumeOptions::default(),
            FieldTable::default(),
        )
        .await?;

    println!("Connected! Waiting for messages on queue: {}", queue_name);

    while let Some(delivery) = consumer.next().await {
        if let Ok(delivery) = delivery {
            let data = String::from_utf8_lossy(&delivery.data);
            println!("\nReceived message:");

            match serde_json::from_str::<CustomerViewEvent>(&data) {
                Ok(event) => {
                    println!("  Event Type: {}", event.event_type);
                    println!("  Event ID: {}", event.event_id);
                    println!("  Customer ID: {}", event.payload.customer_id);
                    println!("  Credit Level: {}", event.payload.credit_level);

                    // 模拟发送通知
                    match event.payload.credit_level.as_str() {
                        "VIP" => {
                            println!("  Sending VIP email notification...");
                            println!("  Sending VIP SMS notification...");
                        }
                        _ => {
                            println!("  Sending standard email notification...");
                        }
                    }
                    println!("  Notification sent successfully!");
                }
                Err(e) => {
                    println!("  Failed to parse message: {}", e);
                    println!("  Raw data: {}", data);
                }
            }

            delivery.ack(BasicAckOptions::default()).await?;
        }
    }

    Ok(())
}
```

## 五、FlowEngine 配置

```yaml
# flowengine-config.yaml
# FlowEngine 工具服务配置

tools:
  # 对象存储配置
  oss:
    default:
      provider: minio
      endpoint: http://localhost:9000
      accessKey: flowengine
      secretKey: flowengine123
      region: us-east-1
      buckets:
        customer-assets:
          public: true
        customer-reports:
          public: false

  # 消息队列配置
  mq:
    default:
      broker: rabbitmq
      url: amqp://flowengine:flowengine123@localhost:5672/
      exchanges:
        customer.events:
          type: topic
          durable: true

  # 微服务配置
  svc:
    risk-service:
      discovery: static
      endpoints:
        - http://localhost:8081
      protocol: http
      timeout: 30000
      loadBalancer: roundRobin

    crm-service:
      discovery: static
      endpoints:
        - http://localhost:8082
      protocol: http

    notification-service:
      discovery: static
      endpoints:
        - http://localhost:8083
      protocol: http

  # 邮件配置
  mail:
    smtp-service:
      provider: smtp
      host: localhost
      port: 1025
      secure: false

  # 短信配置（模拟）
  sms:
    aliyun-sms:
      provider: mock
      apiKey: mock-key
```

## 六、PostgreSQL 初始化脚本

```sql
-- init-scripts/postgres/01-init.sql

-- 订单表
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(36) PRIMARY KEY,
    customer_id VARCHAR(36) NOT NULL,
    order_time TIMESTAMP NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_customer_time ON orders (customer_id, order_time);

-- 插入测试数据
INSERT INTO orders (id, customer_id, order_time, amount, status) VALUES
('ORD001', 'C001', '2024-01-15 10:30:00', 299.00, 'completed'),
('ORD002', 'C001', '2024-02-20 14:00:00', 599.00, 'completed'),
('ORD003', 'C001', '2024-03-10 09:15:00', 199.00, 'completed'),
('ORD004', 'C002', '2024-01-25 16:45:00', 99.00, 'completed'),
('ORD005', 'C002', '2024-03-05 11:00:00', 399.00, 'pending')
ON CONFLICT (id) DO NOTHING;
```

## 七、启动脚本

```bash
#!/bin/bash
# start-demo.sh

echo "Starting FlowEngine Demo Environment..."

# 1. 启动基础设施
echo "Starting infrastructure services..."
docker-compose up -d minio rabbitmq postgres mailhog

# 2. 等待服务就绪
echo "Waiting for services to be ready..."
sleep 10

# 3. 初始化
echo "Initializing services..."
docker-compose up -d minio-init rabbitmq-init

# 4. 启动 Mock 微服务
echo "Starting mock microservices..."
docker-compose up -d risk-service crm-service notification-service

# 5. 验证服务状态
echo ""
echo "Services Status:"
echo "========================================"
echo "MinIO Console:     http://localhost:9001"
echo "                   (flowengine / flowengine123)"
echo ""
echo "RabbitMQ Console:  http://localhost:15672"
echo "                   (flowengine / flowengine123)"
echo ""
echo "MailHog UI:        http://localhost:8025"
echo ""
echo "Risk Service:      http://localhost:8081/health"
echo "CRM Service:       http://localhost:8082/health"
echo "========================================"

# 6. 测试风控服务
echo ""
echo "Testing Risk Service..."
curl -s -X POST http://localhost:8081/credit/evaluate \
  -H "Content-Type: application/json" \
  -d '{"customerId": "C001", "checkType": "standard"}' | jq .

echo ""
echo "Demo environment is ready!"
```

## 八、架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FlowEngine 执行器                             │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐      ┌───────────────┐      ┌───────────────┐
│   CRM API     │      │  PostgreSQL   │      │  Risk Service │
│  (客户信息)    │      │  (订单数据)    │      │  (信用评分)    │
│  :8082        │      │  :5432        │      │  :8081        │
└───────────────┘      └───────────────┘      └───────────────┘
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                                │
                                ▼
                       ┌───────────────┐
                       │   数据合并     │
                       │   (merge)     │
                       └───────┬───────┘
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
      ┌───────────────┐               ┌───────────────┐
      │    MinIO      │               │   RabbitMQ    │
      │  (保存报告)    │               │  (发布事件)    │
      │  :9000/:9001  │               │  :5672/:15672 │
      └───────────────┘               └───────┬───────┘
                                              │
                                              ▼
                                     ┌───────────────┐
                                     │ Notification  │
                                     │   Service     │
                                     │  (消费消息)    │
                                     │  :8083        │
                                     └───────┬───────┘
                                             │
                               ┌─────────────┴─────────────┐
                               ▼                           ▼
                      ┌───────────────┐           ┌───────────────┐
                      │   MailHog     │           │   SMS Mock    │
                      │  (邮件测试)    │           │  (短信模拟)    │
                      │  :1025/:8025  │           │               │
                      └───────────────┘           └───────────────┘
```

## 九、MQ 消息队列详细说明

### RabbitMQ 资源自动管理

FlowEngine 执行器在发布消息时会自动管理 RabbitMQ 资源：

```
┌─────────────────────────────────────────────────────────────┐
│                    MQ 发布流程                               │
├─────────────────────────────────────────────────────────────┤
│ 1. 建立 AMQP 连接                                           │
│                                                             │
│ 2. 自动资源声明（独立 Channel，失败不影响发布）              │
│    ├─ Channel A: 声明 Queue (默认选项)                      │
│    └─ Channel B: 声明 Exchange (durable=true, type=topic)   │
│                  + 绑定 Queue 到 Exchange                    │
│                                                             │
│ 3. 创建发布 Channel                                         │
│    ├─ 启用 Publisher Confirms                               │
│    └─ basic_publish() 发布消息                              │
│                                                             │
│ 4. 等待 Broker 确认 (ack=true/false)                        │
└─────────────────────────────────────────────────────────────┘
```

### MQ 配置示例

**数据库配置 (tool_services 表):**

```sql
INSERT INTO tool_services (tenant_id, tool_type, code, name, description, config)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'mq',
    'customer-events',
    '客户事件队列',
    'RabbitMQ 消息队列',
    '{
        "broker": "rabbitmq",
        "connection_string": "amqp://flowengine:flowengine123@localhost:5672/%2f",
        "default_exchange": "customer.events",
        "default_routing_key": "view.updated",
        "default_queue": "view.updated",
        "serialization": "json"
    }'::jsonb
);
```

### MQ URI 格式

```
mq://service-name/exchange/routing_key
mq://service-name/queue_name
```

| URI | Exchange | Routing Key | Queue |
|-----|----------|-------------|-------|
| `mq://svc/ex/rk` | `ex` | `rk` | `rk` |
| `mq://svc/queue` | `""` (默认) | `queue` | `queue` |

### YAML 节点配置

```yaml
notifyMQ:
    name: 发布客户视图更新事件
    desp: 向消息队列发送事件
    exec: mq://customer-events/customer.events/view.updated
    args: |
        operation = 'publish'
        message = toJson({
            eventType = 'customer.view.updated',
            eventId = uuid(),
            timestamp = now(),
            payload = {
                customerId = customerId,
                reportUrl = saveReport.objectUrl,
                creditLevel = creditLevel
            }
        })
        routingKey = 'view.updated'
```

### 日志输出说明

成功的 MQ 发布日志：
```
INFO  Setting up RabbitMQ resources: queue='view.updated', exchange='customer.events', routing_key='view.updated'
INFO  Queue 'view.updated' ready: 0 messages, 0 consumers
INFO  Exchange 'customer.events' declared successfully (durable=true)
INFO  Queue 'view.updated' bound to exchange 'customer.events' with routing key 'view.updated'
INFO  RabbitMQ publish: exchange='customer.events', routing_key='view.updated', queue='view.updated', payload_size=283
INFO  RabbitMQ publish confirmed: ack=true, nack=false, confirm=Ack(None)
```

常见警告（不影响功能）：
```
WARN  Queue 'xxx' declaration failed: PRECONDITION_FAILED - inequivalent arg 'durable'
WARN  Exchange 'xxx' declaration failed: PRECONDITION_FAILED - inequivalent arg 'durable'
```

**原因**: 资源已存在且配置不同。解决方案：
1. 删除现有资源后重新创建
2. 或确保配置一致（推荐使用 `durable=true`）

### 故障排查

| 症状 | 可能原因 | 解决方案 |
|------|----------|----------|
| `ack=false` | Exchange 不存在或无绑定 | 检查 Exchange 声明日志 |
| `Channel Closed` | 资源声明失败关闭了 Channel | 已自动处理，查看警告日志 |
| 消息未到达队列 | Queue 未绑定到 Exchange | 检查绑定日志或手动创建绑定 |
| 连接被拒绝 | 凭据错误 | 检查 connection_string |

## 十、测试步骤

### 1. 启动环境

```bash
cd /path/to/flowengine
./start-demo.sh
```

### 2. 验证服务

```bash
# 测试 CRM 服务
curl http://localhost:8082/user/C001

# 测试风控服务
curl -X POST http://localhost:8081/credit/evaluate \
  -H "Content-Type: application/json" \
  -d '{"customerId": "C001"}'

# 查看 RabbitMQ 队列
curl -u flowengine:flowengine123 http://localhost:15672/api/queues

# 查看特定队列消息数
curl -s -u flowengine:flowengine123 \
  http://localhost:15672/api/queues/%2f/view.updated | jq '{messages, consumers}'
```

### 3. 执行流程

通过 FlowEngine 执行客户视图构建流程：

```bash
# 使用 FlowEngine CLI
flowengine run customer-view.yaml \
  --input customerId=C001 \
  --input from="2024-01-01"
```

### 4. 验证结果

- **MinIO**: 访问 http://localhost:9001 查看上传的报告文件
- **RabbitMQ**: 访问 http://localhost:15672 查看消息队列
- **MailHog**: 访问 http://localhost:8025 查看发送的邮件
- **Notification Service**: 查看容器日志确认消息消费

```bash
docker logs -f flowengine-notification-service
```

## 十一、RabbitMQ 管理命令

### 使用 rabbitmqadmin

```bash
# 列出所有 Exchange
rabbitmqadmin -H localhost -u flowengine -p flowengine123 list exchanges

# 列出所有 Queue
rabbitmqadmin -H localhost -u flowengine -p flowengine123 list queues

# 列出所有 Binding
rabbitmqadmin -H localhost -u flowengine -p flowengine123 list bindings

# 手动创建 Exchange (durable)
rabbitmqadmin -H localhost -u flowengine -p flowengine123 \
  declare exchange name=customer.events type=topic durable=true

# 手动创建 Queue (durable)
rabbitmqadmin -H localhost -u flowengine -p flowengine123 \
  declare queue name=view.updated durable=true

# 手动绑定 Queue 到 Exchange
rabbitmqadmin -H localhost -u flowengine -p flowengine123 \
  declare binding source=customer.events destination=view.updated routing_key=view.updated

# 删除 Exchange
rabbitmqadmin -H localhost -u flowengine -p flowengine123 \
  delete exchange name=customer.events

# 删除 Queue
rabbitmqadmin -H localhost -u flowengine -p flowengine123 \
  delete queue name=view.updated

# 发布测试消息
rabbitmqadmin -H localhost -u flowengine -p flowengine123 \
  publish exchange=customer.events routing_key=view.updated \
  payload='{"test": true, "message": "Hello from rabbitmqadmin"}'

# 获取队列中的消息（不消费）
rabbitmqadmin -H localhost -u flowengine -p flowengine123 \
  get queue=view.updated count=10 ackmode=ack_requeue_false
```

### 使用 HTTP API

```bash
# 获取队列详情
curl -s -u flowengine:flowengine123 \
  http://localhost:15672/api/queues/%2f/view.updated | jq .

# 获取 Exchange 详情
curl -s -u flowengine:flowengine123 \
  http://localhost:15672/api/exchanges/%2f/customer.events | jq .

# 获取 Binding 列表
curl -s -u flowengine:flowengine123 \
  http://localhost:15672/api/bindings/%2f | jq '.[] | select(.source == "customer.events")'

# 清空队列
curl -X DELETE -u flowengine:flowengine123 \
  http://localhost:15672/api/queues/%2f/view.updated/contents
```

### 重置 RabbitMQ 资源（测试前推荐）

```bash
# 删除并重新创建资源，确保配置一致
rabbitmqadmin -H localhost -u flowengine -p flowengine123 delete queue name=view.updated
rabbitmqadmin -H localhost -u flowengine -p flowengine123 delete exchange name=customer.events

rabbitmqadmin -H localhost -u flowengine -p flowengine123 \
  declare exchange name=customer.events type=topic durable=true
rabbitmqadmin -H localhost -u flowengine -p flowengine123 \
  declare queue name=view.updated durable=true
rabbitmqadmin -H localhost -u flowengine -p flowengine123 \
  declare binding source=customer.events destination=view.updated routing_key=view.updated
```

## 十二、清理环境

```bash
# 停止所有服务
docker-compose down

# 删除数据卷（完全清理）
docker-compose down -v
```

## 十三、常见问题 FAQ

### Q: 为什么消息发布显示 `ack=true` 但队列中没有消息？

**A:** 这通常是因为 Queue 没有正确绑定到 Exchange。检查日志是否有：
```
INFO Queue 'xxx' bound to exchange 'yyy' with routing key 'zzz'
```

如果没有此日志或显示 `WARN`，说明绑定失败。解决方案：
1. 检查 Exchange 是否存在
2. 检查 Exchange 类型是否正确（应为 `topic`）
3. 手动创建绑定（见上方命令）

### Q: 如何解决 `PRECONDITION_FAILED - inequivalent arg 'durable'` 错误？

**A:** 这是因为资源已存在且 `durable` 设置不同。解决方案：
```bash
# 删除现有资源
rabbitmqadmin delete queue name=view.updated
rabbitmqadmin delete exchange name=customer.events

# FlowEngine 会自动使用 durable=true 重新创建
```

### Q: 消息序列化格式是什么？

**A:** 默认使用 JSON 格式，消息体会被 `serde_json::to_vec()` 序列化。Content-Type 设置为 `application/json`。

### Q: 如何确认消息已成功投递？

**A:** 检查日志中的 Publisher Confirms 结果：
- `ack=true, nack=false` - 消息已被 broker 接收
- `ack=false, nack=true` - 消息被 broker 拒绝
- `confirm=Ack(None)` - 正常的确认响应
