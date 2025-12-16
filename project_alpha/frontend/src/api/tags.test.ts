import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tagApi } from './tags';
import * as client from './client';

vi.mock('./client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('tagApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('fetches all tags', async () => {
      const mockTags = [{ id: 'tag-1', name: 'Bug' }];
      vi.mocked(client.apiClient.get).mockResolvedValueOnce(mockTags);

      const result = await tagApi.list();
      expect(client.apiClient.get).toHaveBeenCalledWith('/api/tags');
      expect(result).toEqual(mockTags);
    });
  });

  describe('get', () => {
    it('fetches single tag', async () => {
      const mockTag = { id: 'tag-1', name: 'Bug' };
      vi.mocked(client.apiClient.get).mockResolvedValueOnce(mockTag);

      const result = await tagApi.get('tag-1');
      expect(client.apiClient.get).toHaveBeenCalledWith('/api/tags/tag-1');
      expect(result).toEqual(mockTag);
    });
  });

  describe('create', () => {
    it('creates tag', async () => {
      const mockTag = { id: 'tag-1', name: 'New Tag' };
      const createData = { name: 'New Tag', color: '#EF4444' };
      vi.mocked(client.apiClient.post).mockResolvedValueOnce(mockTag);

      const result = await tagApi.create(createData);
      expect(client.apiClient.post).toHaveBeenCalledWith('/api/tags', createData);
      expect(result).toEqual(mockTag);
    });
  });

  describe('update', () => {
    it('updates tag', async () => {
      const mockTag = { id: 'tag-1', name: 'Updated Tag' };
      const updateData = { name: 'Updated Tag' };
      vi.mocked(client.apiClient.put).mockResolvedValueOnce(mockTag);

      const result = await tagApi.update('tag-1', updateData);
      expect(client.apiClient.put).toHaveBeenCalledWith('/api/tags/tag-1', updateData);
      expect(result).toEqual(mockTag);
    });
  });

  describe('delete', () => {
    it('deletes tag', async () => {
      vi.mocked(client.apiClient.delete).mockResolvedValueOnce(undefined);

      await tagApi.delete('tag-1');
      expect(client.apiClient.delete).toHaveBeenCalledWith('/api/tags/tag-1');
    });
  });
});

