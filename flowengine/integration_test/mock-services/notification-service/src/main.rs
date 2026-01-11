//! 通知服务 - RabbitMQ 消息消费者

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
        .unwrap_or_else(|_| "amqp://flowengine:flowengine123@localhost:5672".to_string());
    // 处理 URL 末尾的 `/`，lapin 会将其解析为空 vhost
    let rabbitmq_url = rabbitmq_url.trim_end_matches('/').to_string();
    let queue_name = std::env::var("QUEUE_NAME")
        .unwrap_or_else(|_| "notification-service.customer-view".to_string());

    println!("Notification Service starting...");
    println!("Connecting to RabbitMQ: {}", rabbitmq_url);

    let conn = Connection::connect(&rabbitmq_url, ConnectionProperties::default()).await?;
    let channel = conn.create_channel().await?;

    // 声明 exchange
    let exchange_name = std::env::var("EXCHANGE_NAME")
        .unwrap_or_else(|_| "customer.events".to_string());
    let routing_key = std::env::var("ROUTING_KEY")
        .unwrap_or_else(|_| "view.updated".to_string());

    channel
        .exchange_declare(
            &exchange_name,
            lapin::ExchangeKind::Topic,
            ExchangeDeclareOptions {
                durable: true,
                ..Default::default()
            },
            FieldTable::default(),
        )
        .await?;
    println!("Exchange '{}' declared", exchange_name);

    // 声明队列
    channel
        .queue_declare(
            &queue_name,
            QueueDeclareOptions {
                durable: true,
                ..Default::default()
            },
            FieldTable::default(),
        )
        .await?;
    println!("Queue '{}' declared", queue_name);

    // 绑定队列到 exchange
    channel
        .queue_bind(
            &queue_name,
            &exchange_name,
            &routing_key,
            QueueBindOptions::default(),
            FieldTable::default(),
        )
        .await?;
    println!("Queue bound to exchange with routing key '{}'", routing_key);

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
