mod common;

use common::{cleanup_test_data, init_test_logging, setup_test_db};
use ticket_backend::handlers::tickets;
use ticket_backend::models::{CreateTicketRequest, UpdateStatusRequest};

#[tokio::test]
async fn test_open_to_in_progress() {
    init_test_logging();
    let pool = setup_test_db().await;
    cleanup_test_data(&pool).await;

    let req = CreateTicketRequest {
        title: "Status Test".into(),
        description: None,
        priority: None,
    };
    let created = tickets::create_ticket(&pool, req).await.unwrap();
    assert_eq!(created.ticket.status, "open");

    // Transition to in_progress
    let status_req = UpdateStatusRequest {
        status: "in_progress".into(),
        resolution: None,
    };
    let result = tickets::update_status(&pool, created.ticket.id, status_req).await;
    assert!(result.is_ok());
    assert_eq!(result.unwrap().ticket.status, "in_progress");

    cleanup_test_data(&pool).await;
}

#[tokio::test]
async fn test_open_to_cancelled() {
    init_test_logging();
    let pool = setup_test_db().await;
    cleanup_test_data(&pool).await;

    let req = CreateTicketRequest {
        title: "Cancel Test".into(),
        description: None,
        priority: None,
    };
    let created = tickets::create_ticket(&pool, req).await.unwrap();

    let status_req = UpdateStatusRequest {
        status: "cancelled".into(),
        resolution: Some("No longer needed".into()),
    };
    let result = tickets::update_status(&pool, created.ticket.id, status_req).await;
    assert!(result.is_ok());
    
    let ticket = result.unwrap();
    assert_eq!(ticket.ticket.status, "cancelled");
    assert_eq!(ticket.ticket.resolution.as_deref(), Some("No longer needed"));

    cleanup_test_data(&pool).await;
}

#[tokio::test]
async fn test_in_progress_to_completed_requires_resolution() {
    init_test_logging();
    let pool = setup_test_db().await;
    cleanup_test_data(&pool).await;

    let req = CreateTicketRequest {
        title: "Complete Test".into(),
        description: None,
        priority: None,
    };
    let created = tickets::create_ticket(&pool, req).await.unwrap();

    // Move to in_progress first
    let status_req = UpdateStatusRequest {
        status: "in_progress".into(),
        resolution: None,
    };
    tickets::update_status(&pool, created.ticket.id, status_req).await.unwrap();

    // Try to complete without resolution - should fail
    let status_req = UpdateStatusRequest {
        status: "completed".into(),
        resolution: None,
    };
    let result = tickets::update_status(&pool, created.ticket.id, status_req).await;
    assert!(result.is_err());

    // Complete with resolution - should succeed
    let status_req = UpdateStatusRequest {
        status: "completed".into(),
        resolution: Some("Fixed the issue".into()),
    };
    let result = tickets::update_status(&pool, created.ticket.id, status_req).await;
    assert!(result.is_ok());
    
    let ticket = result.unwrap();
    assert_eq!(ticket.ticket.status, "completed");
    assert!(ticket.ticket.completed_at.is_some());
    assert_eq!(ticket.ticket.resolution.as_deref(), Some("Fixed the issue"));

    cleanup_test_data(&pool).await;
}

#[tokio::test]
async fn test_invalid_transition_open_to_completed() {
    init_test_logging();
    let pool = setup_test_db().await;
    cleanup_test_data(&pool).await;

    let req = CreateTicketRequest {
        title: "Invalid Transition".into(),
        description: None,
        priority: None,
    };
    let created = tickets::create_ticket(&pool, req).await.unwrap();

    // Try to go directly from open to completed - should fail
    let status_req = UpdateStatusRequest {
        status: "completed".into(),
        resolution: Some("Done".into()),
    };
    let result = tickets::update_status(&pool, created.ticket.id, status_req).await;
    assert!(result.is_err());

    cleanup_test_data(&pool).await;
}

#[tokio::test]
async fn test_completed_to_open_clears_completed_at() {
    init_test_logging();
    let pool = setup_test_db().await;
    cleanup_test_data(&pool).await;

    let req = CreateTicketRequest {
        title: "Reopen Test".into(),
        description: None,
        priority: None,
    };
    let created = tickets::create_ticket(&pool, req).await.unwrap();

    // Move through the workflow to completed
    let status_req = UpdateStatusRequest {
        status: "in_progress".into(),
        resolution: None,
    };
    tickets::update_status(&pool, created.ticket.id, status_req).await.unwrap();

    let status_req = UpdateStatusRequest {
        status: "completed".into(),
        resolution: Some("Done".into()),
    };
    let completed = tickets::update_status(&pool, created.ticket.id, status_req).await.unwrap();
    assert!(completed.ticket.completed_at.is_some());

    // Reopen the ticket
    let status_req = UpdateStatusRequest {
        status: "open".into(),
        resolution: None,
    };
    let reopened = tickets::update_status(&pool, created.ticket.id, status_req).await.unwrap();
    assert_eq!(reopened.ticket.status, "open");
    assert!(reopened.ticket.completed_at.is_none());

    cleanup_test_data(&pool).await;
}

#[tokio::test]
async fn test_cancelled_to_open() {
    init_test_logging();
    let pool = setup_test_db().await;
    cleanup_test_data(&pool).await;

    let req = CreateTicketRequest {
        title: "Reactivate Test".into(),
        description: None,
        priority: None,
    };
    let created = tickets::create_ticket(&pool, req).await.unwrap();

    // Cancel the ticket
    let status_req = UpdateStatusRequest {
        status: "cancelled".into(),
        resolution: None,
    };
    tickets::update_status(&pool, created.ticket.id, status_req).await.unwrap();

    // Reactivate it
    let status_req = UpdateStatusRequest {
        status: "open".into(),
        resolution: None,
    };
    let result = tickets::update_status(&pool, created.ticket.id, status_req).await;
    assert!(result.is_ok());
    assert_eq!(result.unwrap().ticket.status, "open");

    cleanup_test_data(&pool).await;
}

#[tokio::test]
async fn test_invalid_transition_cancelled_to_completed() {
    init_test_logging();
    let pool = setup_test_db().await;
    cleanup_test_data(&pool).await;

    let req = CreateTicketRequest {
        title: "Invalid Cancel->Complete".into(),
        description: None,
        priority: None,
    };
    let created = tickets::create_ticket(&pool, req).await.unwrap();

    // Cancel
    let status_req = UpdateStatusRequest {
        status: "cancelled".into(),
        resolution: None,
    };
    tickets::update_status(&pool, created.ticket.id, status_req).await.unwrap();

    // Try to complete directly - should fail
    let status_req = UpdateStatusRequest {
        status: "completed".into(),
        resolution: Some("Done".into()),
    };
    let result = tickets::update_status(&pool, created.ticket.id, status_req).await;
    assert!(result.is_err());

    cleanup_test_data(&pool).await;
}

#[tokio::test]
async fn test_in_progress_to_open() {
    init_test_logging();
    let pool = setup_test_db().await;
    // cleanup_test_data(&pool).await;

    let req = CreateTicketRequest {
        title: "Back to Open".into(),
        description: None,
        priority: None,
    };
    let created = tickets::create_ticket(&pool, req).await.unwrap();

    // Move to in_progress
    let status_req = UpdateStatusRequest {
        status: "in_progress".into(),
        resolution: None,
    };
    tickets::update_status(&pool, created.ticket.id, status_req).await.unwrap();

    // Move back to open
    let status_req = UpdateStatusRequest {
        status: "open".into(),
        resolution: None,
    };
    let result = tickets::update_status(&pool, created.ticket.id, status_req).await;
    assert!(result.is_ok());
    assert_eq!(result.unwrap().ticket.status, "open");

    cleanup_test_data(&pool).await;
}

#[tokio::test]
async fn test_in_progress_to_cancelled() {
    init_test_logging();
    let pool = setup_test_db().await;
    cleanup_test_data(&pool).await;

    let req = CreateTicketRequest {
        title: "Cancel from Progress".into(),
        description: None,
        priority: None,
    };
    let created = tickets::create_ticket(&pool, req).await.unwrap();

    // Move to in_progress
    let status_req = UpdateStatusRequest {
        status: "in_progress".into(),
        resolution: None,
    };
    tickets::update_status(&pool, created.ticket.id, status_req).await.unwrap();

    // Cancel
    let status_req = UpdateStatusRequest {
        status: "cancelled".into(),
        resolution: Some("Blocked by external issue".into()),
    };
    let result = tickets::update_status(&pool, created.ticket.id, status_req).await;
    assert!(result.is_ok());
    assert_eq!(result.unwrap().ticket.status, "cancelled");

    cleanup_test_data(&pool).await;
}

