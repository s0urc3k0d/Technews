// ===========================================
// Shorts Hooks
// ===========================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL, API_ENDPOINTS } from '@/lib/config';

// Types
export interface ShortMetadata {
  generatedAt: string;
  slidesCount: number;
  duration: number;
  articles: Array<{
    id: string;
    title: string;
    summary: string;
  }>;
  tiktokTags: string[];
  youtubeTags: string[];
}

export interface ShortsPreview {
  articles: Array<{
    id: string;
    title: string;
    category: string;
    publishedAt: string;
  }>;
  backgroundsCount: number;
  canGenerate: boolean;
}

export interface ShortsTags {
  tiktok: {
    tags: string[];
    formatted: string;
    characterCount: number;
  };
  youtube: {
    tags: string[];
    formatted: string;
    characterCount: number;
  };
}

export interface BackgroundImage {
  filename: string;
  path: string;
  url: string;
}

// Fetch current short metadata
export function useCurrentShort() {
  return useQuery<ShortMetadata | null>({
    queryKey: ['shorts', 'current'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}${API_ENDPOINTS.shortsCurrent}`, { credentials: 'include' });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('Failed to fetch current short');
      const data = await res.json();

      return {
        generatedAt: data.generatedAt,
        slidesCount: data.slides?.length || 0,
        duration: data.duration || 0,
        articles: (data.slides || []).map((slide: any) => ({
          id: slide.articleId,
          title: slide.title,
          summary: slide.summary,
        })),
        tiktokTags: data.tagsTikTok || [],
        youtubeTags: data.tagsYouTube || [],
      } satisfies ShortMetadata;
    },
  });
}

// Fetch shorts preview (articles available for today)
export function useShortsPreview() {
  return useQuery<ShortsPreview>({
    queryKey: ['shorts', 'preview'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}${API_ENDPOINTS.shortsPreview}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch shorts preview');
      const data = await res.json();

      return {
        articles: (data.articles || []).map((article: any) => ({
          id: article.id,
          title: article.title,
          category: article.category,
          publishedAt: article.publishedAt,
        })),
        backgroundsCount: data.backgroundsCount || 0,
        canGenerate: (data.count || 0) > 0,
      } satisfies ShortsPreview;
    },
  });
}

// Fetch shorts tags
export function useShortsTags() {
  return useQuery<ShortsTags>({
    queryKey: ['shorts', 'tags'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}${API_ENDPOINTS.shortsTags}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch shorts tags');
      const data = await res.json();
      return {
        tiktok: {
          tags: data.tiktok?.tags || [],
          formatted: data.tiktok?.formatted || '',
          characterCount: (data.tiktok?.formatted || '').length,
        },
        youtube: {
          tags: data.youtube?.tags || [],
          formatted: data.youtube?.formatted || '',
          characterCount: (data.youtube?.formatted || '').length,
        },
      } satisfies ShortsTags;
    },
    enabled: true,
  });
}

// Fetch backgrounds
export function useShortsBackgrounds() {
  return useQuery<BackgroundImage[]>({
    queryKey: ['shorts', 'backgrounds'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}${API_ENDPOINTS.shortsBackgrounds}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch backgrounds');
      const data = await res.json();
      return data.backgrounds || [];
    },
  });
}

// Generate short video
export function useGenerateShort() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE_URL}${API_ENDPOINTS.shortsGenerate}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to generate short');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shorts'] });
    },
  });
}

// Upload background
export function useUploadBackground() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('image', file);

      const res = await fetch(`${API_BASE_URL}${API_ENDPOINTS.shortsBackgrounds}`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to upload background');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shorts', 'backgrounds'] });
    },
  });
}

// Delete background
export function useDeleteBackground() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (filename: string) => {
      const res = await fetch(`${API_BASE_URL}${API_ENDPOINTS.shortsBackgroundDelete(filename)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete background');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shorts', 'backgrounds'] });
    },
  });
}

// Helper to get video URL
export function getShortsVideoUrl() {
  return `${API_BASE_URL}${API_ENDPOINTS.shortsVideo}`;
}

// Helper to get thumbnail URL
export function getShortsThumbnailUrl() {
  return `${API_BASE_URL}${API_ENDPOINTS.shortsThumbnail}`;
}
