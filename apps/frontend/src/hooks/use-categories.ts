// ===========================================
// React Query Hooks - Categories & Tags
// ===========================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { API_ENDPOINTS } from '@/lib/config';
import type { Category, Tag } from '@/types';

// Query Keys
export const categoryKeys = {
  all: ['categories'] as const,
  list: () => [...categoryKeys.all, 'list'] as const,
  detail: (slug: string) => [...categoryKeys.all, 'detail', slug] as const,
};

export const tagKeys = {
  all: ['tags'] as const,
  list: () => [...tagKeys.all, 'list'] as const,
  detail: (slug: string) => [...tagKeys.all, 'detail', slug] as const,
};

// ============================================
// CATEGORIES
// ============================================

export function useCategories() {
  return useQuery({
    queryKey: categoryKeys.list(),
    queryFn: () => apiClient.get<{ data: Category[] }>(API_ENDPOINTS.categories),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useCategory(slug: string) {
  return useQuery({
    queryKey: categoryKeys.detail(slug),
    queryFn: () => apiClient.get<Category>(API_ENDPOINTS.categoryBySlug(slug)),
    enabled: !!slug,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCategoryInput) => 
      apiClient.post<Category>(API_ENDPOINTS.categories, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.list() });
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCategoryInput }) => 
      apiClient.put<Category>(`${API_ENDPOINTS.categories}/${id}`, data),
    onSuccess: (category) => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.list() });
      queryClient.setQueryData(categoryKeys.detail(category.slug), category);
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`${API_ENDPOINTS.categories}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.list() });
    },
  });
}

// ============================================
// TAGS
// ============================================

export function useTags() {
  return useQuery({
    queryKey: tagKeys.list(),
    queryFn: () => apiClient.get<{ data: Tag[] }>(API_ENDPOINTS.tags),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useTag(slug: string) {
  return useQuery({
    queryKey: tagKeys.detail(slug),
    queryFn: () => apiClient.get<Tag>(API_ENDPOINTS.tagBySlug(slug)),
    enabled: !!slug,
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTagInput) => 
      apiClient.post<Tag>(API_ENDPOINTS.tags, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagKeys.list() });
    },
  });
}

export function useUpdateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTagInput }) => 
      apiClient.put<Tag>(`${API_ENDPOINTS.tags}/${id}`, data),
    onSuccess: (tag) => {
      queryClient.invalidateQueries({ queryKey: tagKeys.list() });
      queryClient.setQueryData(tagKeys.detail(tag.slug), tag);
    },
  });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`${API_ENDPOINTS.tags}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagKeys.list() });
    },
  });
}

// Input Types
export interface CreateCategoryInput {
  name: string;
  slug: string;
  description?: string;
  color?: string;
  icon?: string;
  order?: number;
}

export interface UpdateCategoryInput extends Partial<CreateCategoryInput> {}

export interface CreateTagInput {
  name: string;
  slug: string;
}

export interface UpdateTagInput extends Partial<CreateTagInput> {}
