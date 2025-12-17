mod common;

use common::{cleanup_test_data, init_test_logging, setup_test_db};
use ticket_backend::handlers::tickets;
use ticket_backend::models::{CreateTicketRequest, TicketQuery, UpdateTicketRequest};

#[tokio::test]
async fn test_create_ticket() {
    init_test_logging();
    let pool = setup_test_db().await;
    cleanup_test_data(&pool).await;

    let req = CreateTicketRequest {
        title: "Test Ticket".into(),
        description: Some("Test description".into()),
        priority: Some("high".into()),
    };

    let result = tickets::create_ticket(&pool, req).await;
    assert!(result.is_ok());

    let ticket = result.unwrap();
    assert_eq!(ticket.ticket.title, "Test Ticket");
    assert_eq!(
        ticket.ticket.description.as_deref(),
        Some("Test description")
    );
    assert_eq!(ticket.ticket.priority, "high");
    assert_eq!(ticket.ticket.status, "open");
    assert!(ticket.tags.is_empty());

    cleanup_test_data(&pool).await;
}

#[tokio::test]
async fn test_create_ticket_with_default_priority() {
    init_test_logging();
    let pool = setup_test_db().await;
    cleanup_test_data(&pool).await;

    let req = CreateTicketRequest {
        title: "Default Priority Ticket".into(),
        description: None,
        priority: None,
    };

    let result = tickets::create_ticket(&pool, req).await;
    assert!(result.is_ok());

    let ticket = result.unwrap();
    assert_eq!(ticket.ticket.priority, "medium");

    cleanup_test_data(&pool).await;
}

#[tokio::test]
async fn test_create_ticket_empty_title_fails() {
    init_test_logging();
    let pool = setup_test_db().await;

    let req = CreateTicketRequest {
        title: "".into(),
        description: None,
        priority: None,
    };

    let result = tickets::create_ticket(&pool, req).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_get_ticket() {
    init_test_logging();
    let pool = setup_test_db().await;
    cleanup_test_data(&pool).await;

    // Create a ticket first
    let req = CreateTicketRequest {
        title: "Get Test".into(),
        description: Some("Description".into()),
        priority: Some("low".into()),
    };
    let created = tickets::create_ticket(&pool, req).await.unwrap();

    // Get the ticket
    let result = tickets::get_ticket(&pool, created.ticket.id).await;
    assert!(result.is_ok());

    let ticket = result.unwrap();
    assert_eq!(ticket.ticket.id, created.ticket.id);
    assert_eq!(ticket.ticket.title, "Get Test");

    cleanup_test_data(&pool).await;
}

#[tokio::test]
async fn test_get_nonexistent_ticket() {
    init_test_logging();
    let pool = setup_test_db().await;

    let fake_id = uuid::Uuid::new_v4();
    let result = tickets::get_ticket(&pool, fake_id).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_update_ticket() {
    init_test_logging();
    let pool = setup_test_db().await;
    cleanup_test_data(&pool).await;

    // Create a ticket
    let req = CreateTicketRequest {
        title: "Original Title".into(),
        description: None,
        priority: None,
    };
    let created = tickets::create_ticket(&pool, req).await.unwrap();

    // Update the ticket
    let update_req = UpdateTicketRequest {
        title: Some("Updated Title".into()),
        description: Some("New description".into()),
        priority: Some("urgent".into()),
        status: None,
        resolution: None,
    };

    let result = tickets::update_ticket(&pool, created.ticket.id, update_req).await;
    assert!(result.is_ok());

    let updated = result.unwrap();
    assert_eq!(updated.ticket.title, "Updated Title");
    assert_eq!(
        updated.ticket.description.as_deref(),
        Some("New description")
    );
    assert_eq!(updated.ticket.priority, "urgent");

    cleanup_test_data(&pool).await;
}

#[tokio::test]
async fn test_delete_ticket() {
    init_test_logging();
    let pool = setup_test_db().await;
    cleanup_test_data(&pool).await;

    // Create a ticket
    let req = CreateTicketRequest {
        title: "To Delete".into(),
        description: None,
        priority: None,
    };
    let created = tickets::create_ticket(&pool, req).await.unwrap();

    // Delete the ticket
    let result = tickets::delete_ticket(&pool, created.ticket.id).await;
    assert!(result.is_ok());

    // Verify it's deleted
    let get_result = tickets::get_ticket(&pool, created.ticket.id).await;
    assert!(get_result.is_err());

    cleanup_test_data(&pool).await;
}

#[tokio::test]
async fn test_list_tickets_with_pagination() {
    init_test_logging();
    let pool = setup_test_db().await;
    cleanup_test_data(&pool).await;

    // Create multiple tickets
    for i in 1..=5 {
        let req = CreateTicketRequest {
            title: format!("Ticket {}", i),
            description: None,
            priority: None,
        };
        tickets::create_ticket(&pool, req).await.unwrap();
    }

    // Test pagination
    let query = TicketQuery {
        page: Some(1),
        per_page: Some(2),
        ..Default::default()
    };

    let result = tickets::list_tickets(&pool, query).await;
    assert!(result.is_ok());

    let response = result.unwrap();
    assert_eq!(response.data.len(), 2);
    assert_eq!(response.total, 5);
    assert_eq!(response.total_pages, 3);

    cleanup_test_data(&pool).await;
}

#[tokio::test]
async fn test_list_tickets_with_status_filter() {
    init_test_logging();
    let pool = setup_test_db().await;
    cleanup_test_data(&pool).await;

    // Create tickets
    let req = CreateTicketRequest {
        title: "Open Ticket".into(),
        description: None,
        priority: None,
    };
    tickets::create_ticket(&pool, req).await.unwrap();

    // Filter by status
    let query = TicketQuery {
        status: Some("open".into()),
        ..Default::default()
    };

    let result = tickets::list_tickets(&pool, query).await;
    assert!(result.is_ok());
    assert!(!result.unwrap().data.is_empty());

    // Filter by non-matching status
    let query = TicketQuery {
        status: Some("completed".into()),
        ..Default::default()
    };

    let result = tickets::list_tickets(&pool, query).await;
    assert!(result.is_ok());
    assert!(result.unwrap().data.is_empty());

    cleanup_test_data(&pool).await;
}

#[tokio::test]
async fn test_list_tickets_with_search() {
    init_test_logging();
    let pool = setup_test_db().await;
    cleanup_test_data(&pool).await;

    // Create tickets
    let req = CreateTicketRequest {
        title: "Bug in login page".into(),
        description: None,
        priority: None,
    };
    tickets::create_ticket(&pool, req).await.unwrap();

    let req = CreateTicketRequest {
        title: "Feature request".into(),
        description: None,
        priority: None,
    };
    tickets::create_ticket(&pool, req).await.unwrap();

    // Search for "bug"
    let query = TicketQuery {
        search: Some("bug".into()),
        ..Default::default()
    };

    let result = tickets::list_tickets(&pool, query).await;
    assert!(result.is_ok());
    let response = result.unwrap();
    assert_eq!(response.data.len(), 1);
    assert!(response.data[0].ticket.title.contains("Bug"));

    cleanup_test_data(&pool).await;
}
