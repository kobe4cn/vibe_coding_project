use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use std::str::FromStr;
use uuid::Uuid;

use crate::error::{AppError, Result};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TicketStatus {
    Open,
    InProgress,
    Completed,
    Cancelled,
}

impl TicketStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            TicketStatus::Open => "open",
            TicketStatus::InProgress => "in_progress",
            TicketStatus::Completed => "completed",
            TicketStatus::Cancelled => "cancelled",
        }
    }

    pub fn from_str(s: &str) -> Result<Self> {
        s.parse()
    }

    pub fn allowed_transitions(&self) -> Vec<TicketStatus> {
        match self {
            TicketStatus::Open => vec![TicketStatus::InProgress, TicketStatus::Cancelled],
            TicketStatus::InProgress => vec![
                TicketStatus::Open,
                TicketStatus::Completed,
                TicketStatus::Cancelled,
            ],
            TicketStatus::Completed => vec![TicketStatus::Open],
            TicketStatus::Cancelled => vec![TicketStatus::Open],
        }
    }

    pub fn can_transition_to(&self, target: &TicketStatus) -> bool {
        self.allowed_transitions().contains(target)
    }
}

impl FromStr for TicketStatus {
    type Err = AppError;

    fn from_str(s: &str) -> Result<Self> {
        match s {
            "open" => Ok(TicketStatus::Open),
            "in_progress" => Ok(TicketStatus::InProgress),
            "completed" => Ok(TicketStatus::Completed),
            "cancelled" => Ok(TicketStatus::Cancelled),
            _ => Err(AppError::Validation(format!("Invalid status: {}", s))),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum Priority {
    Low,
    #[default]
    Medium,
    High,
    Urgent,
}

impl Priority {
    pub fn as_str(&self) -> &'static str {
        match self {
            Priority::Low => "low",
            Priority::Medium => "medium",
            Priority::High => "high",
            Priority::Urgent => "urgent",
        }
    }

    pub fn from_str(s: &str) -> Result<Self> {
        s.parse()
    }
}

impl FromStr for Priority {
    type Err = AppError;

    fn from_str(s: &str) -> Result<Self> {
        match s {
            "low" => Ok(Priority::Low),
            "medium" => Ok(Priority::Medium),
            "high" => Ok(Priority::High),
            "urgent" => Ok(Priority::Urgent),
            _ => Err(AppError::Validation(format!("Invalid priority: {}", s))),
        }
    }
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct Ticket {
    pub id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub priority: String,
    pub status: String,
    pub resolution: Option<String>,
    pub completed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TicketWithTags {
    #[serde(flatten)]
    pub ticket: Ticket,
    pub tags: Vec<super::Tag>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTicketRequest {
    pub title: String,
    pub description: Option<String>,
    pub priority: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTicketRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub priority: Option<String>,
    pub status: Option<String>,
    pub resolution: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateStatusRequest {
    pub status: String,
    pub resolution: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct TicketQuery {
    pub search: Option<String>,
    pub status: Option<String>,
    pub priority: Option<String>,
    pub tag_ids: Option<Vec<Uuid>>,
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub sort_by: Option<String>,
    pub sort_order: Option<String>,
}

impl Default for TicketQuery {
    fn default() -> Self {
        Self {
            search: None,
            status: None,
            priority: None,
            tag_ids: None,
            page: Some(1),
            per_page: Some(20),
            sort_by: Some("created_at".into()),
            sort_order: Some("desc".into()),
        }
    }
}

#[derive(Debug, Serialize)]
pub struct PaginatedResponse<T> {
    pub data: Vec<T>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
    pub total_pages: i64,
}
