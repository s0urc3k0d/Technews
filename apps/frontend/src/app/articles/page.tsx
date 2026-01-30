// ===========================================
// Articles List Page
// ===========================================

import { Suspense } from 'react';
import { Metadata } from 'next';
import { ArticleList, CardSkeleton } from '@/components';
import { API_ENDPOINTS } from '@/lib/api-client';
import { Article, PaginatedResponse } from '@/types';
import { SITE_NAME } from '@/lib/config';

export const metadata: Metadata = {
  title: 'Articles',
  description: `Tous les articles et actualités tech sur ${SITE_NAME}`,
};

interface ArticlesPageProps {
  searchParams: Promise<{
    page?: string;
    category?: string;
    tag?: string;
    type?: string;
  }>;
}

async function getArticles(params: {
  page?: string;
  category?: string;
  tag?: string;
  type?: string;
}): Promise<PaginatedResponse<Article>> {
  const searchParams = new URLSearchParams();
  searchParams.set('limit', '12');
  searchParams.set('status', 'PUBLISHED');
  
  if (params.page) searchParams.set('page', params.page);
  if (params.category) searchParams.set('categoryId', params.category);
  if (params.tag) searchParams.set('tagId', params.tag);
  if (params.type) searchParams.set('type', params.type);

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}${API_ENDPOINTS.articles}?${searchParams}`,
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

export default async function ArticlesPage({ searchParams }: ArticlesPageProps) {
  const params = await searchParams;
  const { data: articles, pagination } = await getArticles(params);
  const currentPage = parseInt(params.page || '1', 10);

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl lg:text-4xl font-bold mb-4">Articles</h1>
          <p className="text-gray-600">
            Découvrez toutes nos actualités et analyses tech
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-8 pb-6 border-b">
          <FilterButton href="/articles" active={!params.type}>
            Tous
          </FilterButton>
          <FilterButton href="/articles?type=ARTICLE" active={params.type === 'ARTICLE'}>
            📰 Articles
          </FilterButton>
          <FilterButton href="/articles?type=PODCAST" active={params.type === 'PODCAST'}>
            🎙️ Podcasts
          </FilterButton>
          <FilterButton href="/articles?type=VIDEO" active={params.type === 'VIDEO'}>
            🎬 Vidéos
          </FilterButton>
        </div>

        {/* Articles Grid */}
        <Suspense fallback={<ArticlesGridSkeleton />}>
          <ArticleList 
            articles={articles} 
            columns={3}
            emptyMessage="Aucun article trouvé"
          />
        </Suspense>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="mt-12">
            <PaginationWrapper 
              currentPage={currentPage} 
              totalPages={pagination.totalPages}
              baseUrl="/articles"
              params={params}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// Filter Button Component
function FilterButton({ 
  href, 
  active, 
  children 
}: { 
  href: string; 
  active: boolean; 
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
        active 
          ? 'bg-blue-600 text-white' 
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      {children}
    </a>
  );
}

// Client-side pagination wrapper
function PaginationWrapper({ 
  currentPage, 
  totalPages, 
  baseUrl,
  params 
}: { 
  currentPage: number; 
  totalPages: number;
  baseUrl: string;
  params: Record<string, string | undefined>;
}) {
  const buildUrl = (page: number) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value && key !== 'page') searchParams.set(key, value);
    });
    searchParams.set('page', page.toString());
    return `${baseUrl}?${searchParams}`;
  };

  return (
    <nav className="flex items-center justify-center gap-1">
      {currentPage > 1 && (
        <a 
          href={buildUrl(currentPage - 1)}
          className="p-2 rounded-lg text-gray-700 hover:bg-gray-100"
        >
          ← Précédent
        </a>
      )}
      
      <span className="px-4 py-2 text-gray-600">
        Page {currentPage} sur {totalPages}
      </span>
      
      {currentPage < totalPages && (
        <a 
          href={buildUrl(currentPage + 1)}
          className="p-2 rounded-lg text-gray-700 hover:bg-gray-100"
        >
          Suivant →
        </a>
      )}
    </nav>
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
