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
  tag_ids?: string[];
}

export interface UpdateTicketRequest {
  title?: string;
  description?: string;
  priority?: Priority;
  status?: TicketStatus;
  resolution?: string;
  tag_ids?: string[];
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

export const PRIORITY_COLORS: Record<Priority, string> = {
  low: '#10B981',
  medium: '#3B82F6',
  high: '#F59E0B',
  urgent: '#EF4444',
};

export const STATUS_COLORS: Record<TicketStatus, string> = {
  open: '#3B82F6',
  in_progress: '#F59E0B',
  completed: '#10B981',
  cancelled: '#6B7280',
};
