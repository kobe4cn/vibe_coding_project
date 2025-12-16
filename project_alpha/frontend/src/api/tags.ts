import { apiClient } from './client';
import type { CreateTagRequest, Tag, UpdateTagRequest } from '@/types';

export const tagApi = {
  list(): Promise<Tag[]> {
    return apiClient.get('/api/tags');
  },

  get(id: string): Promise<Tag> {
    return apiClient.get(`/api/tags/${id}`);
  },

  create(data: CreateTagRequest): Promise<Tag> {
    return apiClient.post('/api/tags', data);
  },

  update(id: string, data: UpdateTagRequest): Promise<Tag> {
    return apiClient.put(`/api/tags/${id}`, data);
  },

  delete(id: string): Promise<void> {
    return apiClient.delete(`/api/tags/${id}`);
  },
};

