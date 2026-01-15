import type { ApiError } from '@/types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public data: ApiError
  ) {
    super(data.message);
    this.name = 'ApiClientError';
  }
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    method: string,
    path: string,
    options?: {
      body?: unknown;
      params?: Record<string, string | string[] | undefined>;
    }
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`, window.location.origin);

    if (options?.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        if (value === undefined) return;
        if (Array.isArray(value)) {
          value.forEach((v) => url.searchParams.append(key, v));
        } else {
          url.searchParams.set(key, value);
        }
      });
    }

    const response = await fetch(url.toString(), {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      // 安全地解析错误响应，处理空响应或非 JSON 响应
      const contentType = response.headers.get('content-type');
      let error: ApiError;
      
      if (contentType?.includes('application/json')) {
        const text = await response.text();
        if (text) {
          try {
            error = JSON.parse(text);
          } catch {
            // 如果 JSON 解析失败，使用默认错误
            error = {
              error: 'parse_error',
              message: `服务器返回了无效的 JSON 响应 (状态码: ${response.status})`,
            };
          }
        } else {
          // 空响应体
          error = {
            error: 'empty_response',
            message: `服务器返回了空响应 (状态码: ${response.status})`,
          };
        }
      } else {
        // 非 JSON 响应（可能是 HTML 错误页面）
        const text = await response.text();
        error = {
          error: 'invalid_response',
          message: text || `服务器返回了非 JSON 响应 (状态码: ${response.status})`,
        };
      }
      
      throw new ApiClientError(response.status, error);
    }

    // Handle empty responses
    const text = await response.text();
    if (!text) return {} as T;
    return JSON.parse(text);
  }

  get<T>(path: string, params?: Record<string, string | string[] | undefined>) {
    return this.request<T>('GET', path, { params });
  }

  post<T>(path: string, body?: unknown) {
    return this.request<T>('POST', path, { body });
  }

  put<T>(path: string, body: unknown) {
    return this.request<T>('PUT', path, { body });
  }

  patch<T>(path: string, body: unknown) {
    return this.request<T>('PATCH', path, { body });
  }

  delete<T>(path: string) {
    return this.request<T>('DELETE', path);
  }

  async upload<T>(path: string, file: File): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`, window.location.origin);
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(url.toString(), {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      // 安全地解析错误响应，处理空响应或非 JSON 响应
      const contentType = response.headers.get('content-type');
      let error: ApiError;
      
      if (contentType?.includes('application/json')) {
        const text = await response.text();
        if (text) {
          try {
            error = JSON.parse(text);
          } catch {
            // 如果 JSON 解析失败，使用默认错误
            error = {
              error: 'parse_error',
              message: `服务器返回了无效的 JSON 响应 (状态码: ${response.status})`,
            };
          }
        } else {
          // 空响应体
          error = {
            error: 'empty_response',
            message: `服务器返回了空响应 (状态码: ${response.status})`,
          };
        }
      } else {
        // 非 JSON 响应（可能是 HTML 错误页面）
        const text = await response.text();
        error = {
          error: 'invalid_response',
          message: text || `服务器返回了非 JSON 响应 (状态码: ${response.status})`,
        };
      }
      
      throw new ApiClientError(response.status, error);
    }

    // 安全地解析成功响应
    const text = await response.text();
    if (!text) return {} as T;
    try {
      return JSON.parse(text);
    } catch {
      // 如果响应不是有效的 JSON，返回空对象
      return {} as T;
    }
  }

  downloadUrl(path: string): string {
    return `${this.baseUrl}${path}`;
  }
}

export const apiClient = new ApiClient(API_BASE);

