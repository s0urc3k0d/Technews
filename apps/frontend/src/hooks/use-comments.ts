// ===========================================
// React Query Hooks - Comments
// ===========================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { API_ENDPOINTS, DEFAULT_ADMIN_PAGE_SIZE } from '@/lib/config';
import type { Comment, PaginatedResponse, CommentStatus } from '@/types';

// Query Keys
export const commentKeys = {
  all: ['comments'] as const,
  lists: () => [...commentKeys.all, 'list'] as const,
  list: (filters: CommentFilters) => [...commentKeys.lists(), filters] as const,
  byArticle: (articleId: string) => [...commentKeys.all, 'article', articleId] as const,
};

// Filter Types
export interface CommentFilters {
  page?: number;
  limit?: number;
  status?: CommentStatus;
  articleId?: string;
  orderBy?: 'createdAt' | 'reportCount';
  order?: 'asc' | 'desc';
}

// GET Comments List (Admin)
export function useComments(filters: CommentFilters = {}) {
  return useQuery({
    queryKey: commentKeys.list(filters),
    queryFn: () => apiClient.get<PaginatedResponse<Comment>>(API_ENDPOINTS.comments, {
      page: filters.page ?? 1,
      limit: filters.limit ?? DEFAULT_ADMIN_PAGE_SIZE,
      ...filters,
    }),
  });
}

// GET Comments by Article (Public)
export function useArticleComments(articleId: string) {
  return useQuery({
    queryKey: commentKeys.byArticle(articleId),
    queryFn: () => apiClient.get<{ data: Comment[] }>(API_ENDPOINTS.commentsByArticle(articleId)),
    enabled: !!articleId,
  });
}

// Create Comment (Public)
export function useCreateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCommentInput) => 
      apiClient.post<Comment>(API_ENDPOINTS.comments, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: commentKeys.byArticle(variables.articleId) });
    },
  });
}

// Update Comment Status (Admin)
export function useUpdateCommentStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: CommentStatus }) => 
      apiClient.put<Comment>(API_ENDPOINTS.commentStatus(id), { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentKeys.lists() });
    },
  });
}

// Report Comment (Public)
export function useReportComment() {
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => 
      apiClient.post<{ message: string }>(API_ENDPOINTS.commentReport(id), { reason }),
  });
}

// Delete Comment (Admin)
export function useDeleteComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`${API_ENDPOINTS.comments}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentKeys.lists() });
    },
  });
}

// Approve Comment (Admin)
export function useApproveComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => 
      apiClient.put<Comment>(API_ENDPOINTS.commentStatus(id), { status: 'APPROVED' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentKeys.lists() });
    },
  });
}

// Reject Comment (Admin)
export function useRejectComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => 
      apiClient.put<Comment>(API_ENDPOINTS.commentStatus(id), { status: 'DELETED' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentKeys.lists() });
    },
  });
}

// Input Types
export interface CreateCommentInput {
  authorName: string;
  authorEmail: string;
  content: string;
  articleId: string;
  parentId?: string | null;
  website?: string; // Honeypot
}
