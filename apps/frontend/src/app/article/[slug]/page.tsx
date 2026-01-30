// ===========================================
// Article Detail Page
// ===========================================

// Force dynamic rendering to avoid build-time API calls
export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ArticleContent, ArticleList, CommentSection, TextSkeleton } from '@/components';
import { API_ENDPOINTS } from '@/lib/api-client';
import { Article, PaginatedResponse } from '@/types';
import { SITE_NAME, SITE_URL } from '@/lib/config';

interface ArticlePageProps {
  params: Promise<{ slug: string }>;
}

// Generate metadata
export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);
  
  if (!article) {
    return { title: 'Article non trouvé' };
  }

  return {
    title: article.title,
    description: article.excerpt || article.metaDescription,
    keywords: article.metaKeywords,
    openGraph: {
      title: article.title,
      description: article.excerpt || article.metaDescription || '',
      type: 'article',
      publishedTime: article.publishedAt?.toString(),
      authors: [SITE_NAME],
      images: article.imageUrl ? [{ url: article.imageUrl, alt: article.imageAlt || article.title }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.excerpt || article.metaDescription || '',
      images: article.imageUrl ? [article.imageUrl] : [],
    },
    alternates: {
      canonical: `${SITE_URL}/article/${article.slug}`,
    },
  };
}

// Fetch article
async function getArticle(slug: string): Promise<Article | null> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}${API_ENDPOINTS.articleBySlug(slug)}`,
      { next: { revalidate: 60 } }
    );
    
    if (!response.ok) return null;
    const data = await response.json();
    return data.data;
  } catch {
    return null;
  }
}

// Fetch related articles
async function getRelatedArticles(categoryId: string, excludeId: string): Promise<Article[]> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}${API_ENDPOINTS.articles}?categoryId=${categoryId}&limit=4&status=PUBLISHED`,
      { next: { revalidate: 60 } }
    );
    
    if (!response.ok) return [];
    const data: PaginatedResponse<Article> = await response.json();
    return data.data.filter(a => a.id !== excludeId).slice(0, 3);
  } catch {
    return [];
  }
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const article = await getArticle(slug);

  if (!article) {
    notFound();
  }

  const relatedArticles = article.category 
    ? await getRelatedArticles(article.category.id, article.id)
    : [];

  // JSON-LD structured data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': article.type === 'PODCAST' ? 'PodcastEpisode' : 'Article',
    headline: article.title,
    description: article.excerpt || article.metaDescription,
    image: article.imageUrl,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    author: {
      '@type': 'Organization',
      name: SITE_NAME,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/logo.png`,
      },
    },
  };

  return (
    <>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="min-h-screen py-8 lg:py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid lg:grid-cols-3 gap-12">
            {/* Main Content */}
            <div className="lg:col-span-2">
              <Suspense fallback={<ArticleSkeleton />}>
                <ArticleContent article={article} />
              </Suspense>

              {/* Comments */}
              <div className="mt-12 pt-12 border-t">
                <Suspense fallback={<CommentsSkeleton />}>
                  <CommentSection articleId={article.id} />
                </Suspense>
              </div>
            </div>

            {/* Sidebar */}
            <aside className="lg:col-span-1">
              <div className="sticky top-24 space-y-8">
                {/* Article Info */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                  <h3 className="font-semibold mb-4">À propos de cet article</h3>
                  <dl className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Type</dt>
                      <dd className="font-medium">
                        {article.type === 'PODCAST' ? '🎙️ Podcast' : 
                         article.type === 'VIDEO' ? '🎬 Vidéo' : '📰 Article'}
                      </dd>
                    </div>
                    {article.readingTime && (
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Temps de lecture</dt>
                        <dd className="font-medium">{article.readingTime} min</dd>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Vues</dt>
                      <dd className="font-medium">{article.viewCount}</dd>
                    </div>
                    {article.source && (
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Source</dt>
                        <dd className="font-medium">{article.source}</dd>
                      </div>
                    )}
                  </dl>
                </div>

                {/* Related Articles */}
                {relatedArticles.length > 0 && (
                  <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <h3 className="font-semibold mb-4">Articles similaires</h3>
                    <ArticleList 
                      articles={relatedArticles} 
                      variant="compact"
                    />
                  </div>
                )}

                {/* Newsletter CTA */}
                <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl p-6 text-white">
                  <h3 className="font-semibold mb-2">📬 Newsletter</h3>
                  <p className="text-sm text-white/80 mb-4">
                    Recevez nos meilleurs articles chaque semaine.
                  </p>
                  <a 
                    href="/#newsletter"
                    className="block w-full text-center px-4 py-2 bg-white text-blue-600 font-medium rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    S'inscrire
                  </a>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}

// Skeletons
function ArticleSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 bg-gray-200 rounded w-1/4 animate-pulse" />
      <div className="h-12 bg-gray-200 rounded w-3/4 animate-pulse" />
      <div className="aspect-[16/9] bg-gray-200 rounded-lg animate-pulse" />
      <TextSkeleton lines={10} />
    </div>
  );
}

function CommentsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8 bg-gray-200 rounded w-1/4 animate-pulse" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-white rounded-lg p-4 border animate-pulse">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-gray-200" />
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded w-24" />
              <div className="h-3 bg-gray-200 rounded w-16" />
            </div>
          </div>
          <div className="h-4 bg-gray-200 rounded w-full" />
          <div className="h-4 bg-gray-200 rounded w-3/4 mt-2" />
        </div>
      ))}
    </div>
  );
}
