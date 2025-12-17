import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ticketApi } from './tickets';
import * as client from './client';
import type { Priority, TicketStatus } from '@/types';

vi.mock('./client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
}));

describe('ticketApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('fetches tickets with default query', async () => {
      const mockResponse = { data: [], total: 0, page: 1, per_page: 20, total_pages: 0 };
      vi.mocked(client.apiClient.get).mockResolvedValueOnce(mockResponse);

      const result = await ticketApi.list();
      expect(client.apiClient.get).toHaveBeenCalledWith('/api/tickets', {});
      expect(result).toEqual(mockResponse);
    });

    it('fetches tickets with search query', async () => {
      const mockResponse = { data: [], total: 0, page: 1, per_page: 20, total_pages: 0 };
      vi.mocked(client.apiClient.get).mockResolvedValueOnce(mockResponse);

      await ticketApi.list({ search: 'test' });
      expect(client.apiClient.get).toHaveBeenCalledWith('/api/tickets', {
        search: 'test',
        status: undefined,
        priority: undefined,
        tag_ids: undefined,
        page: undefined,
        per_page: undefined,
        sort_by: undefined,
        sort_order: undefined,
      });
    });

    it('fetches tickets with all query params', async () => {
      const mockResponse = { data: [], total: 0, page: 1, per_page: 20, total_pages: 0 };
      vi.mocked(client.apiClient.get).mockResolvedValueOnce(mockResponse);

      await ticketApi.list({
        search: 'bug',
        status: 'open',
        priority: 'high',
        tag_ids: ['tag-1', 'tag-2'],
        page: 2,
        per_page: 10,
        sort_by: 'created_at',
        sort_order: 'desc',
      });

      expect(client.apiClient.get).toHaveBeenCalledWith('/api/tickets', {
        search: 'bug',
        status: 'open',
        priority: 'high',
        tag_ids: ['tag-1', 'tag-2'],
        page: '2',
        per_page: '10',
        sort_by: 'created_at',
        sort_order: 'desc',
      });
    });
  });

  describe('get', () => {
    it('fetches single ticket', async () => {
      const mockTicket = { id: 'ticket-1', title: 'Test' };
      vi.mocked(client.apiClient.get).mockResolvedValueOnce(mockTicket);

      const result = await ticketApi.get('ticket-1');
      expect(client.apiClient.get).toHaveBeenCalledWith('/api/tickets/ticket-1');
      expect(result).toEqual(mockTicket);
    });
  });

  describe('create', () => {
    it('creates ticket', async () => {
      const mockTicket = { id: 'ticket-1', title: 'New Ticket' };
      const createData = { title: 'New Ticket', priority: 'high' as Priority };
      vi.mocked(client.apiClient.post).mockResolvedValueOnce(mockTicket);

      const result = await ticketApi.create(createData);
      expect(client.apiClient.post).toHaveBeenCalledWith('/api/tickets', createData);
      expect(result).toEqual(mockTicket);
    });
  });

  describe('update', () => {
    it('updates ticket', async () => {
      const mockTicket = { id: 'ticket-1', title: 'Updated Ticket' };
      const updateData = { title: 'Updated Ticket' };
      vi.mocked(client.apiClient.put).mockResolvedValueOnce(mockTicket);

      const result = await ticketApi.update('ticket-1', updateData);
      expect(client.apiClient.put).toHaveBeenCalledWith('/api/tickets/ticket-1', updateData);
      expect(result).toEqual(mockTicket);
    });
  });

  describe('delete', () => {
    it('deletes ticket', async () => {
      vi.mocked(client.apiClient.delete).mockResolvedValueOnce(undefined);

      await ticketApi.delete('ticket-1');
      expect(client.apiClient.delete).toHaveBeenCalledWith('/api/tickets/ticket-1');
    });
  });

  describe('updateStatus', () => {
    it('updates ticket status', async () => {
      const mockTicket = { id: 'ticket-1', status: 'completed' };
      const statusData = { status: 'completed' as TicketStatus, resolution: 'Fixed' };
      vi.mocked(client.apiClient.patch).mockResolvedValueOnce(mockTicket);

      const result = await ticketApi.updateStatus('ticket-1', statusData);
      expect(client.apiClient.patch).toHaveBeenCalledWith('/api/tickets/ticket-1/status', statusData);
      expect(result).toEqual(mockTicket);
    });
  });

  describe('addTag', () => {
    it('adds tag to ticket', async () => {
      const mockTicket = { id: 'ticket-1', tags: [] };
      vi.mocked(client.apiClient.post).mockResolvedValueOnce(mockTicket);

      const result = await ticketApi.addTag('ticket-1', 'tag-1');
      expect(client.apiClient.post).toHaveBeenCalledWith('/api/tickets/ticket-1/tags', {
        tag_id: 'tag-1',
      });
      expect(result).toEqual(mockTicket);
    });
  });

  describe('removeTag', () => {
    it('removes tag from ticket', async () => {
      const mockTicket = { id: 'ticket-1', tags: [] };
      vi.mocked(client.apiClient.delete).mockResolvedValueOnce(mockTicket);

      const result = await ticketApi.removeTag('ticket-1', 'tag-1');
      expect(client.apiClient.delete).toHaveBeenCalledWith('/api/tickets/ticket-1/tags/tag-1');
      expect(result).toEqual(mockTicket);
    });
  });
});

