// ===========================================
// Tag Page
// ===========================================

// Force dynamic rendering to avoid build-time API calls
export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ArticleList, CardSkeleton } from '@/components';
import { API_ENDPOINTS } from '@/lib/api-client';
import { Article, PaginatedResponse } from '@/types';
import { API_BASE_URL, SITE_NAME } from '@/lib/config';

interface TagPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

// Fetch tag by slug
async function getTag(slug: string): Promise<{ id: string; name: string; slug: string } | null> {
  try {
    const response = await fetch(
      `${API_BASE_URL}${API_ENDPOINTS.tagBySlug(slug)}`,
      { next: { revalidate: 300 } }
    );
    
    if (!response.ok) return null;
    const data = await response.json();
    return data.data;
  } catch {
    return null;
  }
}

// Fetch articles by tag
async function getTagArticles(tagId: string, page: number = 1): Promise<PaginatedResponse<Article>> {
  try {
    const response = await fetch(
      `${API_BASE_URL}${API_ENDPOINTS.articles}?tagId=${tagId}&page=${page}&limit=12&status=PUBLISHED`,
      { next: { revalidate: 60 } }
    );
    
    if (!response.ok) {
      return { data: [], pagination: { page: 1, limit: 12, total: 0, totalPages: 0 } };
    }
    
    return response.json();
  } catch {
    return { data: [], pagination: { page: 1, limit: 12, total: 0, totalPages: 0 } };
  }
}

// Generate metadata
export async function generateMetadata({ params }: TagPageProps): Promise<Metadata> {
  const { slug } = await params;
  const tag = await getTag(slug);
  
  if (!tag) {
    return { title: 'Tag non trouvé' };
  }

  return {
    title: `#${tag.name}`,
    description: `Articles avec le tag #${tag.name} sur ${SITE_NAME}`,
  };
}

export default async function TagPage({ params, searchParams }: TagPageProps) {
  const { slug } = await params;
  const { page } = await searchParams;
  
  const tag = await getTag(slug);
  
  if (!tag) {
    notFound();
  }

  const currentPage = parseInt(page || '1', 10);
  const { data: articles, pagination } = await getTagArticles(tag.id, currentPage);

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-12 text-center">
          <span className="text-5xl mb-4 block">#️⃣</span>
          <h1 className="text-3xl lg:text-4xl font-bold mb-4">#{tag.name}</h1>
          <p className="text-sm text-gray-500">
            {pagination.total} article{pagination.total > 1 ? 's' : ''}
          </p>
        </div>

        {/* Articles Grid */}
        <Suspense fallback={<ArticlesGridSkeleton />}>
          <ArticleList 
            articles={articles} 
            columns={3}
            emptyMessage="Aucun article avec ce tag"
          />
        </Suspense>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="mt-12">
            <nav className="flex items-center justify-center gap-4">
              {currentPage > 1 && (
                <a 
                  href={`/tag/${slug}?page=${currentPage - 1}`}
                  className="px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-100"
                >
                  ← Précédent
                </a>
              )}
              
              <span className="text-gray-600">
                Page {currentPage} sur {pagination.totalPages}
              </span>
              
              {currentPage < pagination.totalPages && (
                <a 
                  href={`/tag/${slug}?page=${currentPage + 1}`}
                  className="px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-100"
                >
                  Suivant →
                </a>
              )}
            </nav>
          </div>
        )}
      </div>
    </div>
  );
}

// Skeleton
function ArticlesGridSkeleton() {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 12 }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
