import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { apiClient, ApiClientError } from './client';
import { server } from '@/test/mocks/server';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as typeof fetch;

describe('ApiClient', () => {
  // Disable MSW for these tests since we're mocking fetch directly
  beforeAll(() => {
    server.close();
  });

  afterAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset API_BASE for tests
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3000');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('GET requests', () => {
    it('makes GET request with params', async () => {
      const mockResponse = { data: 'test' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockResponse),
      });

      const result = await apiClient.get('/api/test', { page: '1', per_page: '10' });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/test?page=1&per_page=10'),
        expect.objectContaining({ method: 'GET' })
      );
      expect(result).toEqual(mockResponse);
    });

    it('handles array params', async () => {
      const mockResponse = { data: 'test' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockResponse),
      });

      await apiClient.get('/api/test', { tags: ['tag1', 'tag2'] });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/test?tags=tag1&tags=tag2'),
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('ignores undefined params', async () => {
      const mockResponse = { data: 'test' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockResponse),
      });

      await apiClient.get('/api/test', { page: '1', undefined: undefined });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.not.stringContaining('undefined'),
        expect.any(Object)
      );
    });
  });

  describe('POST requests', () => {
    it('makes POST request with body', async () => {
      const mockResponse = { id: '123' };
      const body = { name: 'Test' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockResponse),
      });

      const result = await apiClient.post('/api/test', body);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/test'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(body),
          headers: { 'Content-Type': 'application/json' },
        })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('PUT requests', () => {
    it('makes PUT request with body', async () => {
      const mockResponse = { updated: true };
      const body = { name: 'Updated' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockResponse),
      });

      const result = await apiClient.put('/api/test', body);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/test'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(body),
        })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('PATCH requests', () => {
    it('makes PATCH request with body', async () => {
      const mockResponse = { patched: true };
      const body = { status: 'completed' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockResponse),
      });

      const result = await apiClient.patch('/api/test', body);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/test'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify(body),
        })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('DELETE requests', () => {
    it('makes DELETE request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => '',
      });

      await apiClient.delete('/api/test/123');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/test/123'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('Error handling', () => {
    it('throws ApiClientError on non-ok response', async () => {
      const errorData = { error: 'Not Found', message: 'Resource not found' };
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => errorData,
      });

      await expect(apiClient.get('/api/test')).rejects.toThrow(ApiClientError);
      
      // Reset and test again
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => errorData,
      });
      await expect(apiClient.get('/api/test')).rejects.toThrow('Resource not found');
    });

    it('handles empty response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => '',
      });

      const result = await apiClient.delete('/api/test');
      expect(result).toEqual({});
    });
  });

  describe('File upload', () => {
    it('uploads file with FormData', async () => {
      const mockResponse = { id: 'file-123' };
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await apiClient.upload('/api/upload', file);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/upload'),
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('throws error on upload failure', async () => {
      const errorData = { error: 'Upload failed', message: 'File too large' };
      const file = new File(['content'], 'test.txt');
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => errorData,
      });

      await expect(apiClient.upload('/api/upload', file)).rejects.toThrow(ApiClientError);
    });
  });

  describe('downloadUrl', () => {
    it('generates download URL', () => {
      const url = apiClient.downloadUrl('/api/files/123');
      // The actual URL depends on API_BASE, just check it contains the path
      expect(url).toContain('/api/files/123');
    });
  });
});

