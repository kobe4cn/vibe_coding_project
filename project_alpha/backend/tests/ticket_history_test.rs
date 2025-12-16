mod common;

use common::{cleanup_test_data, init_test_logging, setup_test_db};
use ticket_backend::{
    handlers::{
        tickets::{add_tag, create_ticket, remove_tag, update_status, update_ticket},
        ticket_history::list_history,
    },
    models::{
        ChangeType, CreateTicketRequest, HistoryQuery, UpdateStatusRequest, UpdateTicketRequest,
    },
};
use uuid::Uuid;

#[tokio::test]
async fn test_status_change_history() {
    init_test_logging();
    let pool = setup_test_db().await;
    cleanup_test_data(&pool).await;

    // Create ticket
    let ticket = create_ticket(
        &pool,
        CreateTicketRequest {
            title: "Test Ticket".into(),
            description: None,
            priority: None,
        },
    )
    .await
    .unwrap();

    // Change status
    update_status(
        &pool,
        ticket.ticket.id,
        UpdateStatusRequest {
            status: "in_progress".into(),
            resolution: None,
        },
    )
    .await
    .unwrap();

    // Query history
    let history = list_history(&pool, ticket.ticket.id, HistoryQuery::default())
        .await
        .unwrap();

    assert_eq!(history.data.len(), 1);
    assert_eq!(history.data[0].change_type, ChangeType::Status.as_str());
    assert_eq!(history.data[0].old_value.as_deref(), Some("open"));
    assert_eq!(history.data[0].new_value.as_deref(), Some("in_progress"));
}

#[tokio::test]
async fn test_priority_change_history() {
    init_test_logging();
    let pool = setup_test_db().await;
    cleanup_test_data(&pool).await;

    // Create ticket
    let ticket = create_ticket(
        &pool,
        CreateTicketRequest {
            title: "Test Ticket".into(),
            description: None,
            priority: Some("medium".into()),
        },
    )
    .await
    .unwrap();

    // Update priority
    update_ticket(
        &pool,
        ticket.ticket.id,
        UpdateTicketRequest {
            title: None,
            description: None,
            priority: Some("high".into()),
            status: None,
            resolution: None,
        },
    )
    .await
    .unwrap();

    // Query history
    let history = list_history(&pool, ticket.ticket.id, HistoryQuery::default())
        .await
        .unwrap();

    assert_eq!(history.data.len(), 1);
    assert_eq!(history.data[0].change_type, ChangeType::Priority.as_str());
    assert_eq!(history.data[0].old_value.as_deref(), Some("medium"));
    assert_eq!(history.data[0].new_value.as_deref(), Some("high"));
}

#[tokio::test]
async fn test_resolution_change_history() {
    init_test_logging();
    let pool = setup_test_db().await;
    cleanup_test_data(&pool).await;

    // Create ticket
    let ticket = create_ticket(
        &pool,
        CreateTicketRequest {
            title: "Test Ticket".into(),
            description: None,
            priority: None,
        },
    )
    .await
    .unwrap();

    // Update resolution
    update_ticket(
        &pool,
        ticket.ticket.id,
        UpdateTicketRequest {
            title: None,
            description: None,
            priority: None,
            status: None,
            resolution: Some("Fixed the issue".into()),
        },
    )
    .await
    .unwrap();

    // Query history
    let history = list_history(&pool, ticket.ticket.id, HistoryQuery::default())
        .await
        .unwrap();

    assert_eq!(history.data.len(), 1);
    assert_eq!(history.data[0].change_type, ChangeType::Resolution.as_str());
    assert_eq!(history.data[0].old_value.as_deref(), None);
    assert_eq!(
        history.data[0].new_value.as_deref(),
        Some("Fixed the issue")
    );
}

#[tokio::test]
async fn test_tag_add_history() {
    init_test_logging();
    let pool = setup_test_db().await;
    cleanup_test_data(&pool).await;

    // Create ticket
    let ticket = create_ticket(
        &pool,
        CreateTicketRequest {
            title: "Test Ticket".into(),
            description: None,
            priority: None,
        },
    )
    .await
    .unwrap();

    // Get a tag (use first predefined tag)
    let tag_result = sqlx::query_as::<_, (Uuid,)>("SELECT id FROM tags LIMIT 1")
        .fetch_one(&pool)
        .await
        .unwrap();
    let tag_id = tag_result.0;

    // Add tag
    add_tag(&pool, ticket.ticket.id, tag_id).await.unwrap();

    // Query history
    let history = list_history(&pool, ticket.ticket.id, HistoryQuery::default())
        .await
        .unwrap();

    assert_eq!(history.data.len(), 1);
    assert_eq!(history.data[0].change_type, ChangeType::TagAdded.as_str());
    assert_eq!(history.data[0].old_value, None);
    assert_eq!(history.data[0].new_value, Some(tag_id.to_string()));
}

#[tokio::test]
async fn test_tag_remove_history() {
    init_test_logging();
    let pool = setup_test_db().await;
    cleanup_test_data(&pool).await;

    // Create ticket
    let ticket = create_ticket(
        &pool,
        CreateTicketRequest {
            title: "Test Ticket".into(),
            description: None,
            priority: None,
        },
    )
    .await
    .unwrap();

    // Get a tag
    let tag_result = sqlx::query_as::<_, (Uuid,)>("SELECT id FROM tags LIMIT 1")
        .fetch_one(&pool)
        .await
        .unwrap();
    let tag_id = tag_result.0;

    // Add tag first
    add_tag(&pool, ticket.ticket.id, tag_id).await.unwrap();

    // Remove tag
    remove_tag(&pool, ticket.ticket.id, tag_id).await.unwrap();

    // Query history
    let history = list_history(&pool, ticket.ticket.id, HistoryQuery::default())
        .await
        .unwrap();

    assert_eq!(history.data.len(), 2);
    // Most recent should be tag_removed
    assert_eq!(history.data[0].change_type, ChangeType::TagRemoved.as_str());
    assert_eq!(history.data[0].old_value, Some(tag_id.to_string()));
    assert_eq!(history.data[0].new_value, None);
}

#[tokio::test]
async fn test_history_filter_by_type() {
    init_test_logging();
    let pool = setup_test_db().await;
    cleanup_test_data(&pool).await;

    // Create ticket
    let ticket = create_ticket(
        &pool,
        CreateTicketRequest {
            title: "Test Ticket".into(),
            description: None,
            priority: None,
        },
    )
    .await
    .unwrap();

    // Change status
    update_status(
        &pool,
        ticket.ticket.id,
        UpdateStatusRequest {
            status: "in_progress".into(),
            resolution: None,
        },
    )
    .await
    .unwrap();

    // Change priority
    update_ticket(
        &pool,
        ticket.ticket.id,
        UpdateTicketRequest {
            title: None,
            description: None,
            priority: Some("high".into()),
            status: None,
            resolution: None,
        },
    )
    .await
    .unwrap();

    // Query only status history
    let history = list_history(
        &pool,
        ticket.ticket.id,
        HistoryQuery {
            change_type: Some("status".into()),
            limit: None,
            offset: None,
        },
    )
    .await
    .unwrap();

    assert_eq!(history.data.len(), 1);
    assert_eq!(history.data[0].change_type, "status");
}

#[tokio::test]
async fn test_edit_with_status_change() {
    init_test_logging();
    let pool = setup_test_db().await;
    cleanup_test_data(&pool).await;

    // Create ticket
    let ticket = create_ticket(
        &pool,
        CreateTicketRequest {
            title: "Test Ticket".into(),
            description: None,
            priority: None,
        },
    )
    .await
    .unwrap();

    // Update with status change
    let updated = update_ticket(
        &pool,
        ticket.ticket.id,
        UpdateTicketRequest {
            title: Some("Updated Title".into()),
            description: None,
            priority: Some("high".into()),
            status: Some("in_progress".into()),
            resolution: None,
        },
    )
    .await
    .unwrap();

    assert_eq!(updated.ticket.status, "in_progress");
    assert_eq!(updated.ticket.priority, "high");
    assert_eq!(updated.ticket.title, "Updated Title");

    // Check history
    let history = list_history(&pool, ticket.ticket.id, HistoryQuery::default())
        .await
        .unwrap();

    // Should have status and priority changes
    assert!(history.data.len() >= 2);
    let status_change = history
        .data
        .iter()
        .find(|h| h.change_type == ChangeType::Status.as_str());
    assert!(status_change.is_some());
    assert_eq!(status_change.unwrap().old_value.as_deref(), Some("open"));
    assert_eq!(
        status_change.unwrap().new_value.as_deref(),
        Some("in_progress")
    );
}

#[tokio::test]
async fn test_edit_with_completed_status() {
    init_test_logging();
    let pool = setup_test_db().await;
    cleanup_test_data(&pool).await;

    // Create ticket
    let ticket = create_ticket(
        &pool,
        CreateTicketRequest {
            title: "Test Ticket".into(),
            description: None,
            priority: None,
        },
    )
    .await
    .unwrap();

    // First change to in_progress
    update_status(
        &pool,
        ticket.ticket.id,
        UpdateStatusRequest {
            status: "in_progress".into(),
            resolution: None,
        },
    )
    .await
    .unwrap();

    // Update with completed status and resolution
    let updated = update_ticket(
        &pool,
        ticket.ticket.id,
        UpdateTicketRequest {
            title: None,
            description: None,
            priority: None,
            status: Some("completed".into()),
            resolution: Some("Fixed the bug".into()),
        },
    )
    .await
    .unwrap();

    assert_eq!(updated.ticket.status, "completed");
    assert_eq!(updated.ticket.resolution.as_deref(), Some("Fixed the bug"));
    assert!(updated.ticket.completed_at.is_some());
}

#[tokio::test]
async fn test_edit_with_invalid_status_transition() {
    init_test_logging();
    let pool = setup_test_db().await;
    cleanup_test_data(&pool).await;

    // Create ticket
    let ticket = create_ticket(
        &pool,
        CreateTicketRequest {
            title: "Test Ticket".into(),
            description: None,
            priority: None,
        },
    )
    .await
    .unwrap();

    // Try invalid transition: open -> completed (should fail)
    let result = update_ticket(
        &pool,
        ticket.ticket.id,
        UpdateTicketRequest {
            title: None,
            description: None,
            priority: None,
            status: Some("completed".into()),
            resolution: Some("Fixed".into()),
        },
    )
    .await;

    assert!(result.is_err());
}

