// ===========================================
// Search Page
// ===========================================

import { Metadata } from 'next';
import { Suspense } from 'react';
import { ArticleList, CardSkeleton } from '@/components';
import { API_ENDPOINTS } from '@/lib/api-client';
import { Article, PaginatedResponse } from '@/types';
import { SITE_NAME } from '@/lib/config';

interface SearchPageProps {
  searchParams: Promise<{ q?: string; page?: string }>;
}

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const { q } = await searchParams;
  return {
    title: q ? `Recherche: ${q}` : 'Recherche',
    description: `Résultats de recherche sur ${SITE_NAME}`,
  };
}

async function searchArticles(query: string, page: number = 1): Promise<PaginatedResponse<Article>> {
  if (!query) {
    return { data: [], pagination: { page: 1, limit: 12, total: 0, totalPages: 0 } };
  }

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}${API_ENDPOINTS.articles}?search=${encodeURIComponent(query)}&page=${page}&limit=12&status=PUBLISHED`,
      { next: { revalidate: 0 } }
    );
    
    if (!response.ok) {
      return { data: [], pagination: { page: 1, limit: 12, total: 0, totalPages: 0 } };
    }
    
    return response.json();
  } catch {
    return { data: [], pagination: { page: 1, limit: 12, total: 0, totalPages: 0 } };
  }
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q, page } = await searchParams;
  const query = q || '';
  const currentPage = parseInt(page || '1', 10);
  const { data: articles, pagination } = await searchArticles(query, currentPage);

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl lg:text-4xl font-bold mb-4">Recherche</h1>
          
          {/* Search Form */}
          <form action="/search" method="get" className="max-w-xl">
            <div className="flex gap-2">
              <input
                type="text"
                name="q"
                defaultValue={query}
                placeholder="Rechercher des articles..."
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="submit"
                className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Rechercher
              </button>
            </div>
          </form>
        </div>

        {/* Results */}
        {query && (
          <div className="mb-8">
            <p className="text-gray-600">
              {pagination.total} résultat{pagination.total > 1 ? 's' : ''} pour "{query}"
            </p>
          </div>
        )}

        {/* No Query */}
        {!query && (
          <div className="text-center py-12">
            <span className="text-5xl mb-4 block">🔍</span>
            <p className="text-gray-500">Entrez un terme de recherche pour commencer</p>
          </div>
        )}

        {/* Results Grid */}
        {query && (
          <Suspense fallback={<SearchResultsSkeleton />}>
            <ArticleList 
              articles={articles} 
              columns={3}
              emptyMessage={`Aucun résultat pour "${query}"`}
            />
          </Suspense>
        )}

        {/* Pagination */}
        {query && pagination.totalPages > 1 && (
          <div className="mt-12">
            <nav className="flex items-center justify-center gap-4">
              {currentPage > 1 && (
                <a 
                  href={`/search?q=${encodeURIComponent(query)}&page=${currentPage - 1}`}
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
                  href={`/search?q=${encodeURIComponent(query)}&page=${currentPage + 1}`}
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
function SearchResultsSkeleton() {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
