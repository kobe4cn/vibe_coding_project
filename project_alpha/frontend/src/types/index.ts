// Ticket types
export type TicketStatus = 'open' | 'in_progress' | 'completed' | 'cancelled';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export interface Ticket {
  id: string;
  title: string;
  description: string | null;
  priority: Priority;
  status: TicketStatus;
  resolution: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketWithTags extends Ticket {
  tags: Tag[];
}

export interface CreateTicketRequest {
  title: string;
  description?: string;
  priority?: Priority;
}

export interface UpdateTicketRequest {
  title?: string;
  description?: string;
  priority?: Priority;
  status?: TicketStatus;
  resolution?: string;
}

export interface UpdateStatusRequest {
  status: TicketStatus;
  resolution?: string;
}

// Tag types
export interface Tag {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  is_predefined: boolean;
  created_at: string;
}

export interface CreateTagRequest {
  name: string;
  color?: string;
  icon?: string;
}

export interface UpdateTagRequest {
  name?: string;
  color?: string;
  icon?: string;
}

// Attachment types
export interface Attachment {
  id: string;
  ticket_id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
}

// API types
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface TicketQuery {
  search?: string;
  status?: TicketStatus;
  priority?: Priority;
  tag_ids?: string[];
  page?: number;
  per_page?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface ApiError {
  error: string;
  message: string;
  field?: string;
  current_status?: string;
  target_status?: string;
  allowed_transitions?: string[];
}

// Ticket History types
export type ChangeType = 'status' | 'priority' | 'resolution' | 'tag_added' | 'tag_removed';

export interface TicketHistory {
  id: string;
  ticket_id: string;
  change_type: ChangeType;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

export interface TicketHistoryResponse {
  data: TicketHistory[];
  total: number;
}

export interface HistoryQuery {
  change_type?: ChangeType;
  limit?: number;
  offset?: number;
}

// Status transitions
export const STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  open: ['in_progress', 'cancelled'],
  in_progress: ['open', 'completed', 'cancelled'],
  completed: ['open'],
  cancelled: ['open'],
};

export const STATUS_LABELS: Record<TicketStatus, string> = {
  open: '待处理',
  in_progress: '处理中',
  completed: '已完成',
  cancelled: '已取消',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: '低',
  medium: '中',
  high: '高',
  urgent: '紧急',
};

