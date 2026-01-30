// ===========================================
// React Query Hooks - Newsletter
// ===========================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { API_ENDPOINTS, DEFAULT_ADMIN_PAGE_SIZE } from '@/lib/config';
import type { Newsletter, Subscriber, PaginatedResponse, NewsletterStatus } from '@/types';

// Query Keys
export const newsletterKeys = {
  all: ['newsletter'] as const,
  subscribers: () => [...newsletterKeys.all, 'subscribers'] as const,
  subscriberList: (filters: SubscriberFilters) => [...newsletterKeys.subscribers(), filters] as const,
  newsletters: () => [...newsletterKeys.all, 'newsletters'] as const,
  newsletterList: (filters: NewsletterFilters) => [...newsletterKeys.newsletters(), filters] as const,
};

// Filter Types
export interface SubscriberFilters {
  page?: number;
  limit?: number;
  isActive?: boolean;
  isConfirmed?: boolean;
  search?: string;
}

export interface NewsletterFilters {
  page?: number;
  limit?: number;
  status?: NewsletterStatus;
}

// ============================================
// PUBLIC
// ============================================

// Subscribe to Newsletter
export function useSubscribe() {
  return useMutation({
    mutationFn: (data: SubscribeInput) => 
      apiClient.post<{ message: string }>(API_ENDPOINTS.newsletterSubscribe, data),
  });
}

// ============================================
// ADMIN - Subscribers
// ============================================

// GET Subscribers List
export function useSubscribers(filters: SubscriberFilters = {}) {
  return useQuery({
    queryKey: newsletterKeys.subscriberList(filters),
    queryFn: () => apiClient.get<PaginatedResponse<Subscriber> & { stats: { activeSubscribers: number } }>(
      API_ENDPOINTS.newsletterSubscribers, 
      {
        page: filters.page ?? 1,
        limit: filters.limit ?? DEFAULT_ADMIN_PAGE_SIZE,
        ...filters,
      }
    ),
  });
}

// ============================================
// ADMIN - Newsletters
// ============================================

// GET Newsletters List
export function useNewsletters(filters: NewsletterFilters = {}) {
  return useQuery({
    queryKey: newsletterKeys.newsletterList(filters),
    queryFn: () => apiClient.get<PaginatedResponse<Newsletter>>(API_ENDPOINTS.newsletters, {
      page: filters.page ?? 1,
      limit: filters.limit ?? DEFAULT_ADMIN_PAGE_SIZE,
      ...filters,
    }),
  });
}

// Create Newsletter
export function useCreateNewsletter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateNewsletterInput) => 
      apiClient.post<Newsletter>(API_ENDPOINTS.newsletters, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: newsletterKeys.newsletters() });
    },
  });
}

// Update Newsletter
export function useUpdateNewsletter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateNewsletterInput }) => 
      apiClient.put<Newsletter>(`${API_ENDPOINTS.newsletters}/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: newsletterKeys.newsletters() });
    },
  });
}

// Send Newsletter
export function useSendNewsletter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => 
      apiClient.post<{ message: string; stats: { successful: number; failed: number; total: number } }>(
        API_ENDPOINTS.newsletterSend(id)
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: newsletterKeys.newsletters() });
    },
  });
}

// Delete Newsletter
export function useDeleteNewsletter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`${API_ENDPOINTS.newsletters}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: newsletterKeys.newsletters() });
    },
  });
}

// Input Types
export interface SubscribeInput {
  email: string;
  firstName?: string;
  source?: string;
}

export interface CreateNewsletterInput {
  subject: string;
  previewText?: string;
  htmlContent: string;
  scheduledAt?: string;
}

export interface UpdateNewsletterInput extends Partial<CreateNewsletterInput> {}
