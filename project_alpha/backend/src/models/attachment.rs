use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct Attachment {
    pub id: Uuid,
    pub ticket_id: Uuid,
    pub filename: String,
    pub storage_path: String,
    pub content_type: String,
    pub size_bytes: i64,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct AttachmentResponse {
    pub id: Uuid,
    pub ticket_id: Uuid,
    pub filename: String,
    pub content_type: String,
    pub size_bytes: i64,
    pub created_at: DateTime<Utc>,
}

impl From<Attachment> for AttachmentResponse {
    fn from(a: Attachment) -> Self {
        Self {
            id: a.id,
            ticket_id: a.ticket_id,
            filename: a.filename,
            content_type: a.content_type,
            size_bytes: a.size_bytes,
            created_at: a.created_at,
        }
    }
}
