"""Data models for A2UI Agent Server."""
from datetime import datetime
from enum import Enum
from typing import Any, Optional
from pydantic import BaseModel


# Ticket types
class TicketStatus(str, Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Priority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class Tag(BaseModel):
    id: str
    name: str
    color: str
    icon: Optional[str] = None
    is_predefined: bool
    created_at: str


class Ticket(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    priority: Priority
    status: TicketStatus
    resolution: Optional[str] = None
    completed_at: Optional[str] = None
    created_at: str
    updated_at: str
    tags: list[Tag] = []


class Attachment(BaseModel):
    id: str
    ticket_id: str
    filename: str
    content_type: str
    size_bytes: int
    created_at: str


class TicketHistory(BaseModel):
    id: str
    ticket_id: str
    change_type: str
    field_name: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    created_at: str


class PaginatedResponse(BaseModel):
    data: list[Any]
    total: int
    page: int
    per_page: int
    total_pages: int


# Request types
class CreateTicketRequest(BaseModel):
    title: str
    description: Optional[str] = None
    priority: Priority = Priority.MEDIUM


class UpdateTicketRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[Priority] = None
    status: Optional[TicketStatus] = None
    resolution: Optional[str] = None


class UpdateStatusRequest(BaseModel):
    status: TicketStatus
    resolution: Optional[str] = None


class CreateTagRequest(BaseModel):
    name: str
    color: str = "#3B82F6"
    icon: Optional[str] = None


# userAction types
class UserAction(BaseModel):
    name: str
    surfaceId: str
    sourceComponentId: str
    timestamp: str
    context: dict[str, Any] = {}


# Status labels
STATUS_LABELS = {
    TicketStatus.OPEN: "待处理",
    TicketStatus.IN_PROGRESS: "处理中",
    TicketStatus.COMPLETED: "已完成",
    TicketStatus.CANCELLED: "已取消",
}

PRIORITY_LABELS = {
    Priority.LOW: "低",
    Priority.MEDIUM: "中",
    Priority.HIGH: "高",
    Priority.URGENT: "紧急",
}

# Status transitions
STATUS_TRANSITIONS = {
    TicketStatus.OPEN: [TicketStatus.IN_PROGRESS, TicketStatus.CANCELLED],
    TicketStatus.IN_PROGRESS: [TicketStatus.OPEN, TicketStatus.COMPLETED, TicketStatus.CANCELLED],
    TicketStatus.COMPLETED: [TicketStatus.OPEN],
    TicketStatus.CANCELLED: [TicketStatus.OPEN],
}
