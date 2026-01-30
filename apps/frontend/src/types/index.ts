// ===========================================
// Types partagés Frontend
// ===========================================

// Articles
export interface Article {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  imageUrl: string | null;
  imageAlt: string | null;
  thumbnailUrl: string | null;
  type: ArticleType;
  status: ArticleStatus;
  source: ArticleSource;
  sourceUrl: string | null;
  isFeatured: boolean;
  featuredAt: string | null;
  viewCount: number;
  readingTime: number | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  metaTitle: string | null;
  metaDescription: string | null;
  metaKeywords: string | null;
  podcastUrl: string | null;
  podcastDuration: number | null;
  videoUrl: string | null;
  category: Category | null;
  categories?: Category[];
  tags: Tag[];
  images?: ArticleImage[];
  comments?: Comment[];
}

export type ArticleType = 'ARTICLE' | 'PODCAST' | 'VIDEO';
export type ArticleStatus = 'DRAFT' | 'PENDING' | 'PUBLISHED' | 'REJECTED' | 'ARCHIVED';
export type ArticleSource = 'MANUAL' | 'RSS';

export interface ArticleImage {
  id: string;
  url: string;
  filename: string;
  thumbnail: string | null;
  medium: string | null;
  alt: string | null;
  caption: string | null;
  width: number | null;
  height: number | null;
  isPrimary: boolean;
}

// Categories & Tags
export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  order: number;
  _count?: { articles: number };
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  _count?: { articles: number };
}

// Comments
export interface Comment {
  id: string;
  authorName: string;
  authorEmail: string;
  content: string;
  status: CommentStatus;
  reportCount: number;
  articleId: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  replies?: Comment[];
  article?: { title: string; slug: string };
}

export type CommentStatus = 'APPROVED' | 'PENDING' | 'SPAM' | 'DELETED' | 'REJECTED';

// Newsletter
export interface Subscriber {
  id: string;
  email: string;
  firstName: string | null;
  isConfirmed: boolean;
  isActive: boolean;
  source: string | null;
  status: 'ACTIVE' | 'UNSUBSCRIBED' | 'PENDING';
  createdAt: string;
  confirmedAt: string | null;
  unsubscribedAt: string | null;
}

export interface Newsletter {
  id: string;
  subject: string;
  previewText: string | null;
  htmlContent: string;
  status: NewsletterStatus;
  scheduledAt: string | null;
  sentAt: string | null;
  totalRecipients: number;
  sentCount: number;
  aiGenerated: boolean;
  createdAt: string;
}

export type NewsletterStatus = 'DRAFT' | 'SCHEDULED' | 'SENDING' | 'SENT' | 'FAILED';

// API Response
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  error: string;
  message?: string;
}

// Admin Stats
export interface AdminStats {
  articles: number;
  comments: number;
  subscribers: number;
  views: number;
  pendingComments: number;
  articlesDetail?: {
    total: number;
    published: number;
    draft: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  commentsDetail?: {
    total: number;
    pending: number;
    recent: Comment[];
  };
  subscribersDetail?: {
    total: number;
    active: number;
  };
  topArticles?: Pick<Article, 'id' | 'title' | 'slug' | 'viewCount' | 'publishedAt'>[];
}

// Cron Job Logs
export interface CronJobLog {
  id: string;
  jobName: string;
  status: 'RUNNING' | 'SUCCESS' | 'FAILED';
  startedAt: string;
  completedAt: string | null;
  duration: number | null;
  message: string | null;
  details: unknown;
}
