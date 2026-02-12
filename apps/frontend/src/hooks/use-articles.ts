// ===========================================
// React Query Hooks - Articles
// ===========================================

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { API_ENDPOINTS, DEFAULT_PAGE_SIZE } from '@/lib/config';
import type { Article, PaginatedResponse, ArticleType, ArticleStatus, ArticleSource } from '@/types';

// Query Keys
export const articleKeys = {
  all: ['articles'] as const,
  lists: () => [...articleKeys.all, 'list'] as const,
  list: (filters: ArticleFilters) => [...articleKeys.lists(), filters] as const,
  details: () => [...articleKeys.all, 'detail'] as const,
  detail: (slug: string) => [...articleKeys.details(), slug] as const,
  featured: () => [...articleKeys.all, 'featured'] as const,
};

// Filter Types
export interface ArticleFilters {
  page?: number;
  limit?: number;
  status?: ArticleStatus;
  type?: ArticleType;
  source?: ArticleSource;
  categorySlug?: string;
  tagSlug?: string;
  search?: string;
  featured?: boolean;
  orderBy?: 'publishedAt' | 'viewCount' | 'title' | 'createdAt';
  order?: 'asc' | 'desc';
}

// GET Articles List
export function useArticles(filters: ArticleFilters = {}, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: articleKeys.list(filters),
    queryFn: () => apiClient.get<PaginatedResponse<Article>>(API_ENDPOINTS.articles, {
      page: filters.page ?? 1,
      limit: filters.limit ?? DEFAULT_PAGE_SIZE,
      ...filters,
    }),
    enabled: options?.enabled ?? true,
  });
}

// GET Articles with Infinite Scroll
export function useInfiniteArticles(filters: Omit<ArticleFilters, 'page'> = {}) {
  return useInfiniteQuery({
    queryKey: articleKeys.list({ ...filters, infinite: true } as ArticleFilters),
    queryFn: ({ pageParam = 1 }) => 
      apiClient.get<PaginatedResponse<Article>>(API_ENDPOINTS.articles, {
        page: pageParam,
        limit: filters.limit ?? DEFAULT_PAGE_SIZE,
        ...filters,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { page, totalPages } = lastPage.pagination;
      return page < totalPages ? page + 1 : undefined;
    },
  });
}

// GET Single Article
export function useArticle(slug: string) {
  return useQuery({
    queryKey: articleKeys.detail(slug),
    queryFn: async () => {
      const response = await apiClient.get<{ data: Article }>(API_ENDPOINTS.articleBySlug(slug));
      return response.data;
    },
    enabled: !!slug,
  });
}

// GET Featured Article
export function useFeaturedArticle() {
  return useQuery({
    queryKey: articleKeys.featured(),
    queryFn: async () => {
      const response = await apiClient.get<{ data: Article }>(API_ENDPOINTS.articleFeatured);
      return response.data;
    },
  });
}

// Create Article (Admin)
export function useCreateArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateArticleInput) => {
      const response = await apiClient.post<{ data: Article }>(API_ENDPOINTS.articles, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: articleKeys.lists() });
    },
  });
}

// Update Article (Admin)
export function useUpdateArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateArticleInput }) => {
      const response = await apiClient.put<{ data: Article }>(`${API_ENDPOINTS.articles}/${id}`, data);
      return response.data;
    },
    onSuccess: (article) => {
      queryClient.invalidateQueries({ queryKey: articleKeys.lists() });
      queryClient.setQueryData(articleKeys.detail(article.slug), article);
    },
  });
}

// Delete Article (Admin)
export function useDeleteArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`${API_ENDPOINTS.articles}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: articleKeys.lists() });
    },
  });
}

// Publish Article (Admin)
export function usePublishArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.post<{ data: Article }>(API_ENDPOINTS.articlePublish(id));
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: articleKeys.lists() });
    },
  });
}

// Reject Article (Admin)
export function useRejectArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.post<{ data: Article }>(API_ENDPOINTS.articleReject(id));
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: articleKeys.lists() });
    },
  });
}

// Input Types
export interface CreateArticleInput {
  slug: string;
  title: string;
  excerpt?: string;
  content: string;
  featuredImage?: string;
  type?: ArticleType;
  status?: ArticleStatus;
  isFeatured?: boolean;
  categoryIds?: string[];
  tagIds?: string[];
}

export interface UpdateArticleInput extends Partial<CreateArticleInput> {}
