use chrono::Utc;
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    error::{AppError, Result},
    handlers::ticket_history::create_history_entry,
    models::{
        ChangeType, CreateTicketRequest, PaginatedResponse, Priority, Tag, Ticket, TicketQuery,
        TicketStatus, TicketWithTags, UpdateStatusRequest, UpdateTicketRequest,
    },
};

pub async fn list_tickets(
    pool: &PgPool,
    query: TicketQuery,
) -> Result<PaginatedResponse<TicketWithTags>> {
    let page = query.page.unwrap_or(1).max(1);
    let per_page = query.per_page.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * per_page;

    // Build dynamic query
    let mut conditions = vec!["1=1".to_string()];
    
    if let Some(ref search) = query.search {
        if !search.trim().is_empty() {
            conditions.push(format!("title ILIKE '%{}%'", search.replace('\'', "''")));
        }
    }
    
    if let Some(ref status) = query.status {
        conditions.push(format!("status = '{}'", status.replace('\'', "''")));
    }
    
    if let Some(ref priority_str) = query.priority {
        // Validate priority format
        let _ = Priority::from_str(priority_str)?;
        conditions.push(format!("priority = '{}'", priority_str.replace('\'', "''")));
    }

    let where_clause = conditions.join(" AND ");
    let sort_by = query.sort_by.as_deref().unwrap_or("created_at");
    let sort_order = query.sort_order.as_deref().unwrap_or("desc");

    // Count total
    let count_sql = format!("SELECT COUNT(*) as count FROM tickets WHERE {}", where_clause);
    let total: (i64,) = sqlx::query_as(&count_sql).fetch_one(pool).await?;

    // Fetch tickets
    let sql = format!(
        "SELECT * FROM tickets WHERE {} ORDER BY {} {} LIMIT {} OFFSET {}",
        where_clause, sort_by, sort_order, per_page, offset
    );
    let tickets: Vec<Ticket> = sqlx::query_as(&sql).fetch_all(pool).await?;

    // Fetch tags for all tickets
    let mut result = Vec::with_capacity(tickets.len());
    for ticket in tickets {
        let tags = get_ticket_tags(pool, ticket.id).await?;
        result.push(TicketWithTags { ticket, tags });
    }

    // Filter by tag_ids if specified
    let result = if let Some(ref tag_ids) = query.tag_ids {
        if !tag_ids.is_empty() {
            result
                .into_iter()
                .filter(|t| tag_ids.iter().all(|tid| t.tags.iter().any(|tag| &tag.id == tid)))
                .collect()
        } else {
            result
        }
    } else {
        result
    };

    let total_pages = (total.0 as f64 / per_page as f64).ceil() as i64;

    Ok(PaginatedResponse {
        data: result,
        total: total.0,
        page,
        per_page,
        total_pages,
    })
}

pub async fn create_ticket(pool: &PgPool, req: CreateTicketRequest) -> Result<TicketWithTags> {
    if req.title.trim().is_empty() {
        return Err(AppError::Validation("Title cannot be empty".into()));
    }

    // Validate and parse priority
    let priority = if let Some(ref priority_str) = req.priority {
        Priority::from_str(priority_str)?
    } else {
        Priority::default()
    };

    let ticket = sqlx::query_as::<_, Ticket>(
        r#"
        INSERT INTO tickets (title, description, priority)
        VALUES ($1, $2, $3)
        RETURNING *
        "#,
    )
    .bind(&req.title)
    .bind(&req.description)
    .bind(priority.as_str())
    .fetch_one(pool)
    .await?;

    Ok(TicketWithTags {
        ticket,
        tags: vec![],
    })
}

pub async fn get_ticket(pool: &PgPool, id: Uuid) -> Result<TicketWithTags> {
    let ticket = sqlx::query_as::<_, Ticket>("SELECT * FROM tickets WHERE id = $1")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Ticket {} not found", id)))?;

    let tags = get_ticket_tags(pool, id).await?;

    Ok(TicketWithTags { ticket, tags })
}

pub async fn update_ticket(
    pool: &PgPool,
    id: Uuid,
    req: UpdateTicketRequest,
) -> Result<TicketWithTags> {
    // Get current ticket state
    let current = get_ticket(pool, id).await?;
    let current_ticket = &current.ticket;

    // Handle status change if provided
    let mut target_status: Option<TicketStatus> = None;
    let mut completed_at = current_ticket.completed_at;
    let mut final_resolution = current_ticket.resolution.clone();

    if let Some(ref status_str) = req.status {
        let new_status = TicketStatus::from_str(status_str)?;
        let current_status = TicketStatus::from_str(&current_ticket.status)?;

        // Check if transition is allowed
        if !current_status.can_transition_to(&new_status) {
            return Err(AppError::InvalidTransition {
                from: current_status.as_str().into(),
                to: new_status.as_str().into(),
                allowed: current_status
                    .allowed_transitions()
                    .iter()
                    .map(|s| s.as_str().into())
                    .collect(),
            });
        }

        // Validate resolution for completed status
        if new_status == TicketStatus::Completed {
            let resolution = req.resolution.as_ref().or(current_ticket.resolution.as_ref());
            if resolution.map_or(true, |r| r.trim().is_empty()) {
                return Err(AppError::Validation(
                    "Resolution is required when completing a ticket".into(),
                ));
            }
            final_resolution = resolution.cloned();
            completed_at = Some(Utc::now());
        } else if current_status == TicketStatus::Completed && new_status == TicketStatus::Open {
            completed_at = None;
        }

        target_status = Some(new_status);
    } else if req.resolution.is_some() {
        // If only resolution is updated (without status change)
        final_resolution = req.resolution.clone();
    }

    // Validate priority if provided
    let priority_value = if let Some(ref priority_str) = req.priority {
        Some(Priority::from_str(priority_str)?.as_str())
    } else {
        None
    };

    // Build update query
    let status_value = target_status.as_ref().map(|s| s.as_str());
    
    let ticket = sqlx::query_as::<_, Ticket>(
        r#"
        UPDATE tickets
        SET title = COALESCE($2, title),
            description = COALESCE($3, description),
            priority = COALESCE($4, priority),
            status = COALESCE($5, status),
            resolution = COALESCE($6, resolution),
            completed_at = COALESCE($7, completed_at),
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
        "#,
    )
    .bind(id)
    .bind(&req.title)
    .bind(&req.description)
    .bind(priority_value)
    .bind(status_value)
    .bind(&final_resolution)
    .bind(completed_at)
    .fetch_one(pool)
    .await?;

    // Record history for changes
    if let Some(ref new_status) = target_status {
        let old_status = TicketStatus::from_str(&current_ticket.status)?;
        if old_status != *new_status {
            create_history_entry(
                pool,
                id,
                ChangeType::Status,
                Some("status"),
                Some(current_ticket.status.as_str()),
                Some(new_status.as_str()),
            )
            .await?;
        }
    }

    if let Some(ref new_priority) = req.priority {
        if current_ticket.priority != *new_priority {
            create_history_entry(
                pool,
                id,
                ChangeType::Priority,
                Some("priority"),
                Some(current_ticket.priority.as_str()),
                Some(new_priority.as_str()),
            )
            .await?;
        }
    }

    if let Some(ref new_resolution) = req.resolution {
        let old_resolution = current_ticket.resolution.as_deref().unwrap_or("");
        let new_resolution_str = new_resolution.as_str();
        if old_resolution != new_resolution_str {
            create_history_entry(
                pool,
                id,
                ChangeType::Resolution,
                Some("resolution"),
                if old_resolution.is_empty() { None } else { Some(old_resolution) },
                Some(new_resolution_str),
            )
            .await?;
        }
    }

    let tags = get_ticket_tags(pool, id).await?;

    Ok(TicketWithTags { ticket, tags })
}

pub async fn delete_ticket(pool: &PgPool, id: Uuid) -> Result<()> {
    let result = sqlx::query("DELETE FROM tickets WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Ticket {} not found", id)));
    }

    Ok(())
}

pub async fn update_status(
    pool: &PgPool,
    id: Uuid,
    req: UpdateStatusRequest,
) -> Result<TicketWithTags> {
    let current = get_ticket(pool, id).await?;
    let current_status = TicketStatus::from_str(&current.ticket.status)?;
    let target_status = TicketStatus::from_str(&req.status)?;

    // Check if transition is allowed
    if !current_status.can_transition_to(&target_status) {
        return Err(AppError::InvalidTransition {
            from: current_status.as_str().into(),
            to: target_status.as_str().into(),
            allowed: current_status
                .allowed_transitions()
                .iter()
                .map(|s| s.as_str().into())
                .collect(),
        });
    }

    // Validate resolution for completed status
    if target_status == TicketStatus::Completed {
        if req.resolution.as_ref().map_or(true, |r| r.trim().is_empty()) {
            return Err(AppError::Validation(
                "Resolution is required when completing a ticket".into(),
            ));
        }
    }

    // Prepare completed_at
    let completed_at = if target_status == TicketStatus::Completed {
        Some(Utc::now())
    } else if current_status == TicketStatus::Completed && target_status == TicketStatus::Open {
        None
    } else {
        current.ticket.completed_at
    };

    // Update resolution if provided or keep existing
    let old_resolution = current.ticket.resolution.clone();
    let resolution = if target_status == TicketStatus::Completed || target_status == TicketStatus::Cancelled {
        req.resolution.or_else(|| old_resolution.clone())
    } else {
        old_resolution.clone()
    };

    let ticket = sqlx::query_as::<_, Ticket>(
        r#"
        UPDATE tickets
        SET status = $2,
            resolution = $3,
            completed_at = $4,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
        "#,
    )
    .bind(id)
    .bind(target_status.as_str())
    .bind(&resolution)
    .bind(completed_at)
    .fetch_one(pool)
    .await?;

    // Record status change history
    create_history_entry(
        pool,
        id,
        ChangeType::Status,
        Some("status"),
        Some(current.ticket.status.as_str()),
        Some(target_status.as_str()),
    )
    .await?;

    // Record resolution change history if resolution changed
    let old_resolution_str = old_resolution.as_deref().unwrap_or("");
    let new_resolution_str = resolution.as_deref().unwrap_or("");
    if old_resolution_str != new_resolution_str {
        create_history_entry(
            pool,
            id,
            ChangeType::Resolution,
            Some("resolution"),
            if old_resolution_str.is_empty() { None } else { Some(old_resolution_str) },
            if new_resolution_str.is_empty() { None } else { Some(new_resolution_str) },
        )
        .await?;
    }

    let tags = get_ticket_tags(pool, id).await?;

    Ok(TicketWithTags { ticket, tags })
}

pub async fn add_tag(pool: &PgPool, ticket_id: Uuid, tag_id: Uuid) -> Result<TicketWithTags> {
    // Verify ticket exists
    get_ticket(pool, ticket_id).await?;

    // Verify tag exists
    sqlx::query("SELECT id FROM tags WHERE id = $1")
        .bind(tag_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Tag {} not found", tag_id)))?;

    // Add tag (ignore if already exists)
    let result = sqlx::query(
        r#"
        INSERT INTO ticket_tags (ticket_id, tag_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
        "#,
    )
    .bind(ticket_id)
    .bind(tag_id)
    .execute(pool)
    .await?;

    // Record history only if tag was actually added
    if result.rows_affected() > 0 {
        create_history_entry(
            pool,
            ticket_id,
            ChangeType::TagAdded,
            None,
            None,
            Some(&tag_id.to_string()),
        )
        .await?;
    }

    get_ticket(pool, ticket_id).await
}

pub async fn remove_tag(pool: &PgPool, ticket_id: Uuid, tag_id: Uuid) -> Result<TicketWithTags> {
    let result = sqlx::query("DELETE FROM ticket_tags WHERE ticket_id = $1 AND tag_id = $2")
        .bind(ticket_id)
        .bind(tag_id)
        .execute(pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!(
            "Tag {} not associated with ticket {}",
            tag_id, ticket_id
        )));
    }

    // Record history
    create_history_entry(
        pool,
        ticket_id,
        ChangeType::TagRemoved,
        None,
        Some(&tag_id.to_string()),
        None,
    )
    .await?;

    get_ticket(pool, ticket_id).await
}

async fn get_ticket_tags(pool: &PgPool, ticket_id: Uuid) -> Result<Vec<Tag>> {
    let tags = sqlx::query_as::<_, Tag>(
        r#"
        SELECT t.* FROM tags t
        JOIN ticket_tags tt ON t.id = tt.tag_id
        WHERE tt.ticket_id = $1
        ORDER BY t.name
        "#,
    )
    .bind(ticket_id)
    .fetch_all(pool)
    .await?;

    Ok(tags)
}

