use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    error::Result,
    models::ticket_history::{ChangeType, HistoryQuery, HistoryResponse, TicketHistory},
};

pub async fn list_history(
    pool: &PgPool,
    ticket_id: Uuid,
    query: HistoryQuery,
) -> Result<HistoryResponse> {
    let limit = query.limit.unwrap_or(50).clamp(1, 100);
    let offset = query.offset.unwrap_or(0).max(0);

    // Verify ticket exists first
    let ticket_exists: Option<(bool,)> =
        sqlx::query_as("SELECT EXISTS(SELECT 1 FROM tickets WHERE id = $1)")
            .bind(ticket_id)
            .fetch_optional(pool)
            .await?;

    if ticket_exists.is_none() || !ticket_exists.unwrap().0 {
        return Ok(HistoryResponse {
            data: vec![],
            total: 0,
        });
    }

    // Build count query
    let total = if let Some(ref change_type) = query.change_type {
        if !change_type.trim().is_empty() {
            sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(*) FROM ticket_history WHERE ticket_id = $1 AND change_type = $2",
            )
            .bind(ticket_id)
            .bind(change_type.as_str())
            .fetch_one(pool)
            .await?
        } else {
            sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM ticket_history WHERE ticket_id = $1")
                .bind(ticket_id)
                .fetch_one(pool)
                .await?
        }
    } else {
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM ticket_history WHERE ticket_id = $1")
            .bind(ticket_id)
            .fetch_one(pool)
            .await?
    };

    // Build fetch query
    let history = if let Some(ref change_type) = query.change_type {
        if !change_type.trim().is_empty() {
            sqlx::query_as::<_, TicketHistory>(
                "SELECT * FROM ticket_history WHERE ticket_id = $1 AND change_type = $2 ORDER BY created_at DESC LIMIT $3 OFFSET $4"
            )
            .bind(ticket_id)
            .bind(change_type.as_str())
            .bind(limit)
            .bind(offset)
            .fetch_all(pool)
            .await?
        } else {
            sqlx::query_as::<_, TicketHistory>(
                "SELECT * FROM ticket_history WHERE ticket_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3"
            )
            .bind(ticket_id)
            .bind(limit)
            .bind(offset)
            .fetch_all(pool)
            .await?
        }
    } else {
        sqlx::query_as::<_, TicketHistory>(
            "SELECT * FROM ticket_history WHERE ticket_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3"
        )
        .bind(ticket_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await?
    };

    Ok(HistoryResponse {
        data: history,
        total,
    })
}

pub async fn create_history_entry(
    pool: &PgPool,
    ticket_id: Uuid,
    change_type: ChangeType,
    field_name: Option<&str>,
    old_value: Option<&str>,
    new_value: Option<&str>,
) -> Result<()> {
    sqlx::query(
        r#"
        INSERT INTO ticket_history (ticket_id, change_type, field_name, old_value, new_value)
        VALUES ($1, $2, $3, $4, $5)
        "#,
    )
    .bind(ticket_id)
    .bind(change_type.as_str())
    .bind(field_name)
    .bind(old_value)
    .bind(new_value)
    .execute(pool)
    .await?;

    Ok(())
}
