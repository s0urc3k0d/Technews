// ===========================================
// Podcasts Page
// ===========================================

import { Metadata } from 'next';
import { Suspense } from 'react';
import { ArticleList, CardSkeleton } from '@/components';
import { API_ENDPOINTS } from '@/lib/api-client';
import { Article, PaginatedResponse } from '@/types';
import { SITE_NAME } from '@/lib/config';

export const metadata: Metadata = {
  title: 'Podcasts',
  description: `Tous les épisodes de podcast sur ${SITE_NAME}`,
};

interface PodcastsPageProps {
  searchParams: Promise<{ page?: string }>;
}

async function getPodcasts(page: number = 1): Promise<PaginatedResponse<Article>> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}${API_ENDPOINTS.articles}?type=PODCAST&page=${page}&limit=12&status=PUBLISHED`,
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

export default async function PodcastsPage({ searchParams }: PodcastsPageProps) {
  const { page } = await searchParams;
  const currentPage = parseInt(page || '1', 10);
  const { data: podcasts, pagination } = await getPodcasts(currentPage);

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-12 text-center">
          <span className="text-5xl mb-4 block">🎙️</span>
          <h1 className="text-3xl lg:text-4xl font-bold mb-4">Podcasts</h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Écoutez nos épisodes sur les dernières tendances tech, innovations et analyses du secteur.
          </p>
          <p className="text-sm text-gray-500 mt-4">
            {pagination.total} épisode{pagination.total > 1 ? 's' : ''} disponible{pagination.total > 1 ? 's' : ''}
          </p>
        </div>

        {/* Podcast Platforms */}
        <div className="mb-12 p-6 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl">
          <h2 className="font-semibold text-lg mb-4 text-center">Écoutez-nous sur</h2>
          <div className="flex flex-wrap justify-center gap-4">
            <a 
              href="https://open.spotify.com/show/technews" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
            >
              🎵 Spotify
            </a>
            <a 
              href="https://podcasts.apple.com/podcast/technews" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
            >
              🍎 Apple Podcasts
            </a>
            <a 
              href="https://www.youtube.com/@technews" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
            >
              ▶️ YouTube
            </a>
            <a 
              href="/rss-podcast.xml"
              className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
            >
              📡 RSS Feed
            </a>
          </div>
        </div>

        {/* Podcasts Grid */}
        <Suspense fallback={<PodcastsGridSkeleton />}>
          <ArticleList 
            articles={podcasts} 
            columns={3}
            emptyMessage="Aucun épisode disponible"
          />
        </Suspense>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="mt-12">
            <nav className="flex items-center justify-center gap-4">
              {currentPage > 1 && (
                <a 
                  href={`/podcasts?page=${currentPage - 1}`}
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
                  href={`/podcasts?page=${currentPage + 1}`}
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
function PodcastsGridSkeleton() {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 12 }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
