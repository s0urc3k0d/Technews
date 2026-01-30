// ===========================================
// React Query Hooks - Admin
// ===========================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { API_ENDPOINTS, DEFAULT_ADMIN_PAGE_SIZE } from '@/lib/config';
import type { AdminStats, CronJobLog, PaginatedResponse, ArticleImage } from '@/types';

// Query Keys
export const adminKeys = {
  all: ['admin'] as const,
  stats: () => [...adminKeys.all, 'stats'] as const,
  logs: () => [...adminKeys.all, 'logs'] as const,
  logList: (filters: LogFilters) => [...adminKeys.logs(), filters] as const,
};

export const imageKeys = {
  all: ['images'] as const,
  byArticle: (articleId: string) => [...imageKeys.all, 'article', articleId] as const,
};

// Filter Types
export interface LogFilters {
  page?: number;
  limit?: number;
  jobName?: string;
}

// ============================================
// ADMIN STATS & ACTIONS
// ============================================

// GET Admin Dashboard Stats
export function useAdminStats() {
  return useQuery({
    queryKey: adminKeys.stats(),
    queryFn: () => apiClient.get<AdminStats>(API_ENDPOINTS.adminStats),
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

// GET Cron Job Logs
export function useCronLogs(filters: LogFilters = {}) {
  return useQuery({
    queryKey: adminKeys.logList(filters),
    queryFn: () => apiClient.get<PaginatedResponse<CronJobLog>>(API_ENDPOINTS.adminLogs, {
      page: filters.page ?? 1,
      limit: filters.limit ?? DEFAULT_ADMIN_PAGE_SIZE,
      ...filters,
    }),
  });
}

// Trigger RSS Parse Manually
export function useRssParse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiClient.post<{ imported: number; skipped: number; success: boolean; errors: string[] }>(
      API_ENDPOINTS.adminRssParse
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
      queryClient.invalidateQueries({ queryKey: adminKeys.logs() });
    },
  });
}

// Generate Newsletter with AI
export function useGenerateNewsletter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiClient.post<{ message: string; newsletter?: any }>(
      API_ENDPOINTS.adminNewsletterGenerate
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['newsletter'] });
      queryClient.invalidateQueries({ queryKey: adminKeys.logs() });
    },
  });
}

// ============================================
// IMAGE UPLOAD
// ============================================

// Image Filters
export interface ImageFilters {
  page?: number;
  limit?: number;
  articleId?: string;
}

// GET All Images (Admin)
export function useImages(filters: ImageFilters = {}) {
  return useQuery({
    queryKey: [...imageKeys.all, 'list', filters],
    queryFn: () => apiClient.get<PaginatedResponse<ArticleImage>>(API_ENDPOINTS.images, {
      page: filters.page ?? 1,
      limit: filters.limit ?? DEFAULT_ADMIN_PAGE_SIZE,
      ...filters,
    }),
  });
}

// GET Images by Article
export function useArticleImages(articleId: string) {
  return useQuery({
    queryKey: imageKeys.byArticle(articleId),
    queryFn: () => apiClient.get<{ data: ArticleImage[] }>(API_ENDPOINTS.imagesByArticle(articleId)),
    enabled: !!articleId,
  });
}

// Upload Image
export function useUploadImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, articleId, alt, caption, isPrimary }: UploadImageInput) => {
      const formData = new FormData();
      formData.append('file', file);
      if (articleId) formData.append('articleId', articleId);
      if (alt) formData.append('alt', alt);
      if (caption) formData.append('caption', caption);
      if (isPrimary !== undefined) formData.append('isPrimary', String(isPrimary));
      
      return apiClient.upload<ArticleImage>(API_ENDPOINTS.imageUpload, formData);
    },
    onSuccess: (_, variables) => {
      if (variables.articleId) {
        queryClient.invalidateQueries({ queryKey: imageKeys.byArticle(variables.articleId) });
      }
    },
  });
}

// Delete Image
export function useDeleteImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`${API_ENDPOINTS.images}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: imageKeys.all });
    },
  });
}

// Input Types
export interface UploadImageInput {
  file: File;
  articleId?: string;
  alt?: string;
  caption?: string;
  isPrimary?: boolean;
}
