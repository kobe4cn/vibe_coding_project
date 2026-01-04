mod common;

use common::{cleanup_test_data, init_test_logging, setup_test_db, test_config};
use std::path::PathBuf;
use ticket_backend::handlers::{attachments, tickets};
use ticket_backend::models::CreateTicketRequest;
use tokio::fs;
use uuid::Uuid;

#[allow(dead_code)]
async fn setup_test_upload_dir() -> PathBuf {
    let dir = PathBuf::from("/tmp/ticket_test_uploads");
    fs::create_dir_all(&dir).await.ok();
    dir
}

#[allow(dead_code)]
async fn cleanup_test_upload_dir() {
    let dir = PathBuf::from("/tmp/ticket_test_uploads");
    fs::remove_dir_all(&dir).await.ok();
}

#[tokio::test]
async fn test_list_attachments_empty() {
    init_test_logging();
    let pool = setup_test_db().await;
    cleanup_test_data(&pool).await;

    // Create a ticket
    let req = CreateTicketRequest {
        title: "Test Ticket".into(),
        description: None,
        priority: None,
        tag_ids: None,
    };
    let ticket = tickets::create_ticket(&pool, req).await.unwrap();

    // List attachments (should be empty)
    let result = attachments::list_attachments(&pool, ticket.ticket.id).await;
    assert!(result.is_ok());
    assert!(result.unwrap().is_empty());

    cleanup_test_data(&pool).await;
}

#[tokio::test]
async fn test_list_attachments_for_nonexistent_ticket() {
    init_test_logging();
    let pool = setup_test_db().await;

    let fake_id = Uuid::new_v4();
    let result = attachments::list_attachments(&pool, fake_id).await;
    // Should return empty list, not error
    assert!(result.is_ok());
    assert!(result.unwrap().is_empty());
}

#[tokio::test]
async fn test_delete_nonexistent_attachment() {
    init_test_logging();
    let pool = setup_test_db().await;
    let config = test_config();

    let fake_id = Uuid::new_v4();
    let result = attachments::delete_attachment(&pool, &config, fake_id).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_get_attachment_file_nonexistent() {
    init_test_logging();
    let pool = setup_test_db().await;
    let config = test_config();

    let fake_id = Uuid::new_v4();
    let result = attachments::get_attachment_file(&pool, &config, fake_id).await;
    assert!(result.is_err());
}

// Note: Full upload tests require multipart handling which is complex to mock.
// These tests cover the basic CRUD operations that don't require file upload.
// Integration tests with actual file upload should be done via HTTP endpoints.

#[tokio::test]
async fn test_attachment_cascade_delete() {
    init_test_logging();
    let pool = setup_test_db().await;
    cleanup_test_data(&pool).await;

    // Create a ticket
    let req = CreateTicketRequest {
        title: "Cascade Delete Test".into(),
        description: None,
        priority: None,
        tag_ids: None,
    };
    let ticket = tickets::create_ticket(&pool, req).await.unwrap();

    // Insert a mock attachment directly (bypassing file upload)
    sqlx::query(
        r#"
        INSERT INTO attachments (id, ticket_id, filename, storage_path, content_type, size_bytes)
        VALUES ($1, $2, 'test.txt', '/tmp/test.txt', 'text/plain', 100)
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(ticket.ticket.id)
    .execute(&pool)
    .await
    .unwrap();

    // Verify attachment exists
    let attachments_before = attachments::list_attachments(&pool, ticket.ticket.id)
        .await
        .unwrap();
    assert_eq!(attachments_before.len(), 1);

    // Delete ticket (should cascade delete attachment)
    tickets::delete_ticket(&pool, ticket.ticket.id)
        .await
        .unwrap();

    // Verify attachment is deleted (list returns empty because ticket doesn't exist)
    let attachments_after = attachments::list_attachments(&pool, ticket.ticket.id)
        .await
        .unwrap();
    assert!(attachments_after.is_empty());

    cleanup_test_data(&pool).await;
}

#[tokio::test]
async fn test_multiple_attachments_per_ticket() {
    init_test_logging();
    let pool = setup_test_db().await;
    cleanup_test_data(&pool).await;

    // Create a ticket
    let req = CreateTicketRequest {
        title: "Multiple Attachments Test".into(),
        description: None,
        priority: None,
        tag_ids: None,
    };
    let ticket = tickets::create_ticket(&pool, req).await.unwrap();

    // Insert multiple mock attachments
    for i in 1..=3 {
        sqlx::query(
            r#"
            INSERT INTO attachments (id, ticket_id, filename, storage_path, content_type, size_bytes)
            VALUES ($1, $2, $3, $4, 'text/plain', 100)
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(ticket.ticket.id)
        .bind(format!("file{}.txt", i))
        .bind(format!("/tmp/file{}.txt", i))
        .execute(&pool)
        .await
        .unwrap();
    }

    // List attachments
    let attachments_list = attachments::list_attachments(&pool, ticket.ticket.id)
        .await
        .unwrap();
    assert_eq!(attachments_list.len(), 3);

    cleanup_test_data(&pool).await;
}
