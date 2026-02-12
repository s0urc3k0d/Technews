// ===========================================
// Configuration API
// ===========================================

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3051';
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
export const SITE_NAME = 'TechNews';
export const SITE_DESCRIPTION = 'Actualités tech et podcasts sur les dernières tendances technologiques';

// API Endpoints
export const API_ENDPOINTS = {
  // Articles
  articles: '/api/v1/articles',
  articleBySlug: (slug: string) => `/api/v1/articles/${slug}`,
  articleFeatured: '/api/v1/articles/featured',
  articlePublish: (id: string) => `/api/v1/articles/${id}/publish`,
  articleReject: (id: string) => `/api/v1/articles/${id}/reject`,
  
  // Categories
  categories: '/api/v1/categories',
  categoryBySlug: (slug: string) => `/api/v1/categories/${slug}`,
  
  // Tags
  tags: '/api/v1/tags',
  tagBySlug: (slug: string) => `/api/v1/tags/${slug}`,
  
  // Comments
  comments: '/api/v1/comments',
  commentsByArticle: (articleId: string) => `/api/v1/comments/article/${articleId}`,
  commentStatus: (id: string) => `/api/v1/comments/${id}/status`,
  commentReport: (id: string) => `/api/v1/comments/${id}/report`,
  
  // Newsletter
  newsletterSubscribe: '/api/v1/newsletter/subscribe',
  newsletterConfirm: '/api/v1/newsletter/confirm',
  newsletterUnsubscribe: '/api/v1/newsletter/unsubscribe',
  newsletterSubscribers: '/api/v1/newsletter/subscribers',
  newsletters: '/api/v1/newsletter/newsletters',
  newsletterSend: (id: string) => `/api/v1/newsletter/newsletters/${id}/send`,
  
  // Images
  images: '/api/v1/images',
  imageUpload: '/api/v1/images/upload',
  imagesByArticle: (articleId: string) => `/api/v1/images/article/${articleId}`,
  
  // Admin
  adminStats: '/api/v1/admin/stats',
  adminRssParse: '/api/v1/admin/rss/parse',
  adminNewsletterGenerate: '/api/v1/admin/newsletter/generate',
  adminLogs: '/api/v1/admin/logs',

  // Social
  socialConnections: '/api/v1/social/connections',
  socialAuth: (platform: string) => `/api/v1/social/auth/${platform}`,
  socialCallback: (platform: string) => `/api/v1/social/callback/${platform}`,
  socialConnectBluesky: '/api/v1/social/connect/bluesky',
  socialDisconnect: (platform: string) => `/api/v1/social/connections/${platform}`,
  socialToggle: (platform: string) => `/api/v1/social/connections/${platform}/toggle`,
  socialShareArticle: (articleId: string) => `/api/v1/social/share/${articleId}`,
  socialSharesByArticle: (articleId: string) => `/api/v1/social/shares/${articleId}`,
  
  // Shorts
  shorts: '/api/v1/shorts',
  shortsCurrent: '/api/v1/shorts/current',
  shortsVideo: '/api/v1/shorts/video',
  shortsThumbnail: '/api/v1/shorts/thumbnail',
  shortsGenerate: '/api/v1/shorts/generate',
  shortsBackgrounds: '/api/v1/shorts/backgrounds',
  shortsBackgroundDelete: (filename: string) => `/api/v1/shorts/backgrounds/${filename}`,
  shortsPreview: '/api/v1/shorts/preview',
  shortsTags: '/api/v1/shorts/tags',
  
  // Metrics
  metrics: '/metrics',
  webVitals: '/metrics/web-vitals',
  pageview: '/metrics/pageview',
} as const;

// Default pagination
export const DEFAULT_PAGE_SIZE = 12;
export const DEFAULT_ADMIN_PAGE_SIZE = 20;
