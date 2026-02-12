// ===========================================
// Sitemap Generation - Next.js
// ===========================================

import { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://revuetech.fr';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://revuetech.fr';

interface Article {
  slug: string;
  updatedAt: string;
  type: string;
}

interface Category {
  slug: string;
}

interface Tag {
  slug: string;
}

async function getArticles(): Promise<Article[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/articles?status=PUBLISHED&limit=1000`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.data || [];
  } catch {
    return [];
  }
}

async function getCategories(): Promise<Category[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/categories`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.data || data || [];
  } catch {
    return [];
  }
}

async function getTags(): Promise<Tag[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/tags`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.data || data || [];
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [articles, categories, tags] = await Promise.all([
    getArticles(),
    getCategories(),
    getTags(),
  ]);

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${SITE_URL}/articles`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/podcasts`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/categories`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/mentions-legales`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/confidentialite`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/cgu`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];

  // Article pages
  const articlePages: MetadataRoute.Sitemap = articles.map((article) => ({
    url: `${SITE_URL}/article/${article.slug}`,
    lastModified: new Date(article.updatedAt),
    changeFrequency: 'weekly' as const,
    priority: article.type === 'PODCAST' ? 0.9 : 0.8,
  }));

  // Category pages
  const categoryPages: MetadataRoute.Sitemap = categories.map((category) => ({
    url: `${SITE_URL}/category/${category.slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));

  // Tag pages
  const tagPages: MetadataRoute.Sitemap = tags.map((tag) => ({
    url: `${SITE_URL}/tag/${tag.slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.5,
  }));

  return [...staticPages, ...articlePages, ...categoryPages, ...tagPages];
}
