mod common;

use common::{cleanup_test_data, init_test_logging, setup_test_db};
use ticket_backend::handlers::{tags, tickets};
use ticket_backend::models::{CreateTagRequest, CreateTicketRequest, UpdateTagRequest};

#[tokio::test]
async fn test_create_tag() {
    init_test_logging();
    let pool = setup_test_db().await;
    cleanup_test_data(&pool).await;

    let req = CreateTagRequest {
        name: "Test Tag".into(),
        color: Some("#FF5733".into()),
        icon: Some("alert-circle".into()),
    };

    let result = tags::create_tag(&pool, req).await;
    assert!(result.is_ok());

    let tag = result.unwrap();
    assert_eq!(tag.name, "Test Tag");
    assert_eq!(tag.color, "#FF5733");
    assert_eq!(tag.icon.as_deref(), Some("alert-circle"));
    assert!(!tag.is_predefined);

    cleanup_test_data(&pool).await;
}

#[tokio::test]
async fn test_create_tag_with_default_color() {
    init_test_logging();
    let pool = setup_test_db().await;
    cleanup_test_data(&pool).await;

    let req = CreateTagRequest {
        name: "Default Color Tag".into(),
        color: None,
        icon: None,
    };

    let result = tags::create_tag(&pool, req).await;
    assert!(result.is_ok());

    let tag = result.unwrap();
    assert_eq!(tag.color, "#6B7280"); // default color

    cleanup_test_data(&pool).await;
}

#[tokio::test]
async fn test_create_tag_empty_name_fails() {
    init_test_logging();
    let pool = setup_test_db().await;

    let req = CreateTagRequest {
        name: "".into(),
        color: None,
        icon: None,
    };

    let result = tags::create_tag(&pool, req).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_create_tag_invalid_color_fails() {
    init_test_logging();
    let pool = setup_test_db().await;

    let req = CreateTagRequest {
        name: "Invalid Color".into(),
        color: Some("not-a-color".into()),
        icon: None,
    };

    let result = tags::create_tag(&pool, req).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_create_duplicate_tag_fails() {
    init_test_logging();
    let pool = setup_test_db().await;
    cleanup_test_data(&pool).await;

    let req = CreateTagRequest {
        name: "Unique Tag".into(),
        color: None,
        icon: None,
    };
    tags::create_tag(&pool, req).await.unwrap();

    // Try to create another tag with the same name
    let req = CreateTagRequest {
        name: "Unique Tag".into(),
        color: None,
        icon: None,
    };
    let result = tags::create_tag(&pool, req).await;
    assert!(result.is_err());

    cleanup_test_data(&pool).await;
}

#[tokio::test]
async fn test_get_tag() {
    init_test_logging();
    let pool = setup_test_db().await;
    cleanup_test_data(&pool).await;

    let req = CreateTagRequest {
        name: "Get Test Tag".into(),
        color: None,
        icon: None,
    };
    let created = tags::create_tag(&pool, req).await.unwrap();

    let result = tags::get_tag(&pool, created.id).await;
    assert!(result.is_ok());
    assert_eq!(result.unwrap().name, "Get Test Tag");

    cleanup_test_data(&pool).await;
}

#[tokio::test]
async fn test_update_tag() {
    init_test_logging();
    let pool = setup_test_db().await;
    cleanup_test_data(&pool).await;

    let req = CreateTagRequest {
        name: "Original Tag".into(),
        color: Some("#000000".into()),
        icon: None,
    };
    let created = tags::create_tag(&pool, req).await.unwrap();

    let update_req = UpdateTagRequest {
        name: Some("Updated Tag".into()),
        color: Some("#FFFFFF".into()),
        icon: Some("star".into()),
    };
    let result = tags::update_tag(&pool, created.id, update_req).await;
    assert!(result.is_ok());

    let updated = result.unwrap();
    assert_eq!(updated.name, "Updated Tag");
    assert_eq!(updated.color, "#FFFFFF");
    assert_eq!(updated.icon.as_deref(), Some("star"));

    cleanup_test_data(&pool).await;
}

#[tokio::test]
async fn test_delete_tag() {
    init_test_logging();
    let pool = setup_test_db().await;
    cleanup_test_data(&pool).await;

    let req = CreateTagRequest {
        name: "To Delete Tag".into(),
        color: None,
        icon: None,
    };
    let created = tags::create_tag(&pool, req).await.unwrap();

    let result = tags::delete_tag(&pool, created.id).await;
    assert!(result.is_ok());

    let get_result = tags::get_tag(&pool, created.id).await;
    assert!(get_result.is_err());

    cleanup_test_data(&pool).await;
}

#[tokio::test]
async fn test_cannot_delete_predefined_tag() {
    init_test_logging();
    let pool = setup_test_db().await;

    // Get a predefined tag
    let tags_list = tags::list_tags(&pool).await.unwrap();
    let predefined = tags_list.iter().find(|t| t.is_predefined);

    if let Some(tag) = predefined {
        let result = tags::delete_tag(&pool, tag.id).await;
        assert!(result.is_err());
    }
}

#[tokio::test]
async fn test_list_tags() {
    init_test_logging();
    let pool = setup_test_db().await;

    let result = tags::list_tags(&pool).await;
    assert!(result.is_ok());

    // Should include predefined tags
    let tags_list = result.unwrap();
    assert!(!tags_list.is_empty());
    assert!(tags_list.iter().any(|t| t.is_predefined));
}

#[tokio::test]
async fn test_add_tag_to_ticket() {
    init_test_logging();
    let pool = setup_test_db().await;
    cleanup_test_data(&pool).await;

    // Create a ticket
    let ticket_req = CreateTicketRequest {
        title: "Tagged Ticket".into(),
        description: None,
        priority: None,
    };
    let ticket = tickets::create_ticket(&pool, ticket_req).await.unwrap();

    // Create a tag
    let tag_req = CreateTagRequest {
        name: "Custom Tag".into(),
        color: None,
        icon: None,
    };
    let tag = tags::create_tag(&pool, tag_req).await.unwrap();

    // Add tag to ticket
    let result = tickets::add_tag(&pool, ticket.ticket.id, tag.id).await;
    assert!(result.is_ok());

    let updated_ticket = result.unwrap();
    assert_eq!(updated_ticket.tags.len(), 1);
    assert_eq!(updated_ticket.tags[0].name, "Custom Tag");

    cleanup_test_data(&pool).await;
}

#[tokio::test]
async fn test_remove_tag_from_ticket() {
    init_test_logging();
    let pool = setup_test_db().await;
    cleanup_test_data(&pool).await;

    // Create ticket and tag
    let ticket_req = CreateTicketRequest {
        title: "Tag Remove Test".into(),
        description: None,
        priority: None,
    };
    let ticket = tickets::create_ticket(&pool, ticket_req).await.unwrap();

    let tag_req = CreateTagRequest {
        name: "Removable Tag".into(),
        color: None,
        icon: None,
    };
    let tag = tags::create_tag(&pool, tag_req).await.unwrap();

    // Add then remove tag
    tickets::add_tag(&pool, ticket.ticket.id, tag.id).await.unwrap();
    let result = tickets::remove_tag(&pool, ticket.ticket.id, tag.id).await;
    assert!(result.is_ok());

    let updated_ticket = result.unwrap();
    assert!(updated_ticket.tags.is_empty());

    cleanup_test_data(&pool).await;
}

