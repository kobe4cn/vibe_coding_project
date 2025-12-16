import { apiClient } from './client';
import type { Attachment } from '@/types';

export const attachmentApi = {
  list(ticketId: string): Promise<Attachment[]> {
    return apiClient.get(`/api/tickets/${ticketId}/attachments`);
  },

  upload(ticketId: string, file: File): Promise<Attachment> {
    return apiClient.upload(`/api/tickets/${ticketId}/attachments`, file);
  },

  delete(id: string): Promise<void> {
    return apiClient.delete(`/api/attachments/${id}`);
  },

  downloadUrl(id: string): string {
    return apiClient.downloadUrl(`/api/attachments/${id}/download`);
  },
};

