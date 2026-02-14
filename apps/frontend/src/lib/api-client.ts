// ===========================================
// Client API - Fetch wrapper
// ===========================================

import { API_BASE_URL, API_ENDPOINTS } from './config';
import { getAccessTokenClient } from './auth-client';
import type { ApiError } from '@/types';

// Re-export API_ENDPOINTS for convenience
export { API_ENDPOINTS };

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string | null) {
    this.token = token;
  }

  private buildUrl(endpoint: string, params?: Record<string, string | number | boolean | undefined>): string {
    const isAbsoluteBase = /^https?:\/\//i.test(this.baseUrl);
    const isAbsoluteEndpoint = /^https?:\/\//i.test(endpoint);

    const appendParamsToPath = (path: string): string => {
      if (!params) return path;
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
      const query = searchParams.toString();
      if (!query) return path;
      return path.includes('?') ? `${path}&${query}` : `${path}?${query}`;
    };

    if (isAbsoluteEndpoint) {
      const url = new URL(endpoint);
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined) {
            url.searchParams.append(key, String(value));
          }
        });
      }
      return url.toString();
    }

    if (!isAbsoluteBase) {
      const base = this.baseUrl.endsWith('/') ? this.baseUrl.slice(0, -1) : this.baseUrl;
      const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
      return appendParamsToPath(`${base}${path}`);
    }

    const url = new URL(endpoint, this.baseUrl);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      });
    }
    return url.toString();
  }

  private async request<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
    const { params, ...fetchOptions } = options;
    const url = this.buildUrl(endpoint, params);

    if (!this.token && typeof window !== 'undefined') {
      this.token = await getAccessTokenClient();
    }

    const headers: HeadersInit = {
      ...fetchOptions.headers,
    };

    const hasBody = fetchOptions.body !== undefined && fetchOptions.body !== null;
    const isFormDataBody = typeof FormData !== 'undefined' && fetchOptions.body instanceof FormData;
    const normalizedHeaders = headers as Record<string, string>;

    if (hasBody && !isFormDataBody && !normalizedHeaders['Content-Type']) {
      normalizedHeaders['Content-Type'] = 'application/json';
    }

    if (this.token) {
      normalizedHeaders['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...fetchOptions,
      headers,
    });

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        error: 'Unknown error',
        message: response.statusText,
      }));
      throw new Error(error.message || error.error);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  async get<T>(endpoint: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET', params });
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  async upload<T>(endpoint: string, formData: FormData): Promise<T> {
    if (!this.token && typeof window !== 'undefined') {
      this.token = await getAccessTokenClient();
    }

    const headers: HeadersInit = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(this.buildUrl(endpoint), {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        error: 'Upload failed',
      }));
      throw new Error(error.message || error.error);
    }

    return response.json();
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
export default apiClient;
