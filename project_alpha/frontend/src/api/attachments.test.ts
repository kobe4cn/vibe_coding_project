import { describe, it, expect, vi, beforeEach } from 'vitest';
import { attachmentApi } from './attachments';
import * as client from './client';

vi.mock('./client', () => ({
  apiClient: {
    get: vi.fn(),
    upload: vi.fn(),
    delete: vi.fn(),
    downloadUrl: vi.fn(),
  },
}));

describe('attachmentApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('fetches attachments for ticket', async () => {
      const mockAttachments = [{ id: 'att-1', filename: 'test.txt' }];
      vi.mocked(client.apiClient.get).mockResolvedValueOnce(mockAttachments);

      const result = await attachmentApi.list('ticket-1');
      expect(client.apiClient.get).toHaveBeenCalledWith('/api/tickets/ticket-1/attachments');
      expect(result).toEqual(mockAttachments);
    });
  });

  describe('upload', () => {
    it('uploads file for ticket', async () => {
      const mockAttachment = { id: 'att-1', filename: 'test.txt' };
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      vi.mocked(client.apiClient.upload).mockResolvedValueOnce(mockAttachment);

      const result = await attachmentApi.upload('ticket-1', file);
      expect(client.apiClient.upload).toHaveBeenCalledWith(
        '/api/tickets/ticket-1/attachments',
        file
      );
      expect(result).toEqual(mockAttachment);
    });
  });

  describe('delete', () => {
    it('deletes attachment', async () => {
      vi.mocked(client.apiClient.delete).mockResolvedValueOnce(undefined);

      await attachmentApi.delete('att-1');
      expect(client.apiClient.delete).toHaveBeenCalledWith('/api/attachments/att-1');
    });
  });

  describe('downloadUrl', () => {
    it('generates download URL', () => {
      vi.mocked(client.apiClient.downloadUrl).mockReturnValueOnce('http://localhost:3000/api/attachments/att-123/download');

      const url = attachmentApi.downloadUrl('att-123');
      expect(client.apiClient.downloadUrl).toHaveBeenCalledWith('/api/attachments/att-123/download');
      expect(url).toBe('http://localhost:3000/api/attachments/att-123/download');
    });
  });
});

