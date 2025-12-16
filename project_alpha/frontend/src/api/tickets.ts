import { apiClient } from './client';
import type {
  CreateTicketRequest,
  HistoryQuery,
  PaginatedResponse,
  TicketHistoryResponse,
  TicketQuery,
  TicketWithTags,
  UpdateStatusRequest,
  UpdateTicketRequest,
} from '@/types';

export const ticketApi = {
  list(query: TicketQuery = {}): Promise<PaginatedResponse<TicketWithTags>> {
    return apiClient.get('/api/tickets', {
      search: query.search,
      status: query.status,
      priority: query.priority,
      tag_ids: query.tag_ids,
      page: query.page?.toString(),
      per_page: query.per_page?.toString(),
      sort_by: query.sort_by,
      sort_order: query.sort_order,
    });
  },

  get(id: string): Promise<TicketWithTags> {
    return apiClient.get(`/api/tickets/${id}`);
  },

  create(data: CreateTicketRequest): Promise<TicketWithTags> {
    return apiClient.post('/api/tickets', data);
  },

  update(id: string, data: UpdateTicketRequest): Promise<TicketWithTags> {
    return apiClient.put(`/api/tickets/${id}`, data);
  },

  delete(id: string): Promise<void> {
    return apiClient.delete(`/api/tickets/${id}`);
  },

  updateStatus(id: string, data: UpdateStatusRequest): Promise<TicketWithTags> {
    return apiClient.patch(`/api/tickets/${id}/status`, data);
  },

  addTag(ticketId: string, tagId: string): Promise<TicketWithTags> {
    return apiClient.post(`/api/tickets/${ticketId}/tags`, { tag_id: tagId });
  },

  removeTag(ticketId: string, tagId: string): Promise<TicketWithTags> {
    return apiClient.delete(`/api/tickets/${ticketId}/tags/${tagId}`);
  },

  getHistory(id: string, query: HistoryQuery = {}): Promise<TicketHistoryResponse> {
    return apiClient.get(`/api/tickets/${id}/history`, {
      change_type: query.change_type,
      limit: query.limit?.toString(),
      offset: query.offset?.toString(),
    });
  },
};

