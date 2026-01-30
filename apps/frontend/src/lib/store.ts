// ===========================================
// Zustand Store - Global State
// ===========================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// UI Store - Theme, sidebar, modals
interface UIState {
  isSidebarOpen: boolean;
  isSearchOpen: boolean;
  theme: 'light' | 'dark' | 'system';
  toggleSidebar: () => void;
  toggleSearch: () => void;
  openSearch: () => void;
  closeSearch: () => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      isSidebarOpen: false,
      isSearchOpen: false,
      theme: 'system',
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      toggleSearch: () => set((state) => ({ isSearchOpen: !state.isSearchOpen })),
      openSearch: () => set({ isSearchOpen: true }),
      closeSearch: () => set({ isSearchOpen: false }),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'technews-ui',
      partialize: (state) => ({ theme: state.theme }),
    }
  )
);

// Auth Store - User session (synced with Auth0)
interface User {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setLoading: (isLoading) => set({ isLoading }),
  logout: () => set({ user: null, isAuthenticated: false }),
}));

// Newsletter Store - Subscription state
interface NewsletterState {
  email: string;
  isSubscribed: boolean;
  isSubmitting: boolean;
  message: string | null;
  setEmail: (email: string) => void;
  setSubscribed: (subscribed: boolean) => void;
  setSubmitting: (submitting: boolean) => void;
  setMessage: (message: string | null) => void;
  reset: () => void;
}

export const useNewsletterStore = create<NewsletterState>()((set) => ({
  email: '',
  isSubscribed: false,
  isSubmitting: false,
  message: null,
  setEmail: (email) => set({ email }),
  setSubscribed: (isSubscribed) => set({ isSubscribed }),
  setSubmitting: (isSubmitting) => set({ isSubmitting }),
  setMessage: (message) => set({ message }),
  reset: () => set({ email: '', isSubmitting: false, message: null }),
}));

// Filters Store - Article filters
interface FiltersState {
  search: string;
  categorySlug: string | null;
  tagSlug: string | null;
  type: 'ARTICLE' | 'PODCAST' | 'VIDEO' | null;
  status: string;
  sortBy: 'publishedAt' | 'viewCount' | 'title';
  sortOrder: 'asc' | 'desc';
  setSearch: (search: string) => void;
  setCategory: (slug: string | null) => void;
  setTag: (slug: string | null) => void;
  setType: (type: 'ARTICLE' | 'PODCAST' | 'VIDEO' | null) => void;
  setStatus: (status: string) => void;
  setSortBy: (sortBy: 'publishedAt' | 'viewCount' | 'title') => void;
  setSortOrder: (order: 'asc' | 'desc') => void;
  setFilter: (key: string, value: string) => void;
  clearFilters: () => void;
  resetFilters: () => void;
}

export const useFiltersStore = create<FiltersState>()((set) => ({
  search: '',
  categorySlug: null,
  tagSlug: null,
  type: null,
  status: '',
  sortBy: 'publishedAt',
  sortOrder: 'desc',
  setSearch: (search) => set({ search }),
  setCategory: (categorySlug) => set({ categorySlug }),
  setTag: (tagSlug) => set({ tagSlug }),
  setType: (type) => set({ type }),
  setStatus: (status) => set({ status }),
  setSortBy: (sortBy) => set({ sortBy }),
  setSortOrder: (sortOrder) => set({ sortOrder }),
  setFilter: (key, value) => set((state) => ({ ...state, [key]: value })),
  clearFilters: () => set({
    search: '',
    categorySlug: null,
    tagSlug: null,
    type: null,
    status: '',
    sortBy: 'publishedAt',
    sortOrder: 'desc',
  }),
  resetFilters: () => set({
    search: '',
    categorySlug: null,
    tagSlug: null,
    type: null,
    status: '',
    sortBy: 'publishedAt',
    sortOrder: 'desc',
  }),
}));
