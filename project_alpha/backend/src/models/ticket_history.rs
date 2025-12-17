use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::error::{AppError, Result};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ChangeType {
    Status,
    Priority,
    Resolution,
    TagAdded,
    TagRemoved,
}

impl ChangeType {
    pub fn as_str(&self) -> &'static str {
        match self {
            ChangeType::Status => "status",
            ChangeType::Priority => "priority",
            ChangeType::Resolution => "resolution",
            ChangeType::TagAdded => "tag_added",
            ChangeType::TagRemoved => "tag_removed",
        }
    }

    pub fn from_str(s: &str) -> Result<Self> {
        match s {
            "status" => Ok(ChangeType::Status),
            "priority" => Ok(ChangeType::Priority),
            "resolution" => Ok(ChangeType::Resolution),
            "tag_added" => Ok(ChangeType::TagAdded),
            "tag_removed" => Ok(ChangeType::TagRemoved),
            _ => Err(AppError::Validation(format!("Invalid change type: {}", s))),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct TicketHistory {
    pub id: Uuid,
    pub ticket_id: Uuid,
    pub change_type: String,
    pub field_name: Option<String>,
    pub old_value: Option<String>,
    pub new_value: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Default)]
pub struct HistoryQuery {
    pub change_type: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct HistoryResponse {
    pub data: Vec<TicketHistory>,
    pub total: i64,
}
