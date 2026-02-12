// ===========================================
// Utils - Helper Functions
// ===========================================

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Merge Tailwind classes
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format date
export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...options,
  });
}

// Format relative time
export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 7) {
    return formatDate(d);
  } else if (days > 0) {
    return `il y a ${days} jour${days > 1 ? 's' : ''}`;
  } else if (hours > 0) {
    return `il y a ${hours} heure${hours > 1 ? 's' : ''}`;
  } else if (minutes > 0) {
    return `il y a ${minutes} minute${minutes > 1 ? 's' : ''}`;
  } else {
    return 'à l\'instant';
  }
}

// Estimate reading time
export function estimateReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const words = content.trim().split(/\s+/).length;
  return Math.ceil(words / wordsPerMinute);
}

// Truncate text
export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length).trim() + '...';
}

// Generate slug
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Validate email
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Format number with separator
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('fr-FR').format(num);
}

// Get initials from name
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Debounce function
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Get article type label
export function getArticleTypeLabel(type: 'STANDARD' | 'PODCAST'): string {
  const labels = {
    STANDARD: 'Article',
    PODCAST: 'Podcast',
  };
  return labels[type] || type;
}

// Get article type icon
export function getArticleTypeIcon(type: 'STANDARD' | 'PODCAST'): string {
  const icons = {
    STANDARD: '📰',
    PODCAST: '🎙️',
  };
  return icons[type] || '📄';
}

// Get status badge color
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    PUBLISHED: 'bg-green-100 text-green-800',
    DRAFT: 'bg-gray-100 text-gray-800',
    PENDING: 'bg-yellow-100 text-yellow-800',
    REJECTED: 'bg-red-100 text-red-800',
    ARCHIVED: 'bg-purple-100 text-purple-800',
    APPROVED: 'bg-green-100 text-green-800',
    SPAM: 'bg-red-100 text-red-800',
    DELETED: 'bg-gray-100 text-gray-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}
