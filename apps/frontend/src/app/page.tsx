// ===========================================
// Home Page
// ===========================================

// Force dynamic rendering to avoid build-time API calls
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Suspense } from 'react';
import { ArticleCard, ArticleList, CardSkeleton } from '@/components';
import { NewsletterForm } from '@/components/forms';
import { API_ENDPOINTS } from '@/lib/api-client';
import { API_BASE_URL } from '@/lib/config';
import { Article, PaginatedResponse, Category } from '@/types';

const API_TIMEOUT_MS = 8000;

function withTimeoutSignal(timeoutMs = API_TIMEOUT_MS): AbortSignal {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  controller.signal.addEventListener('abort', () => clearTimeout(timeout), { once: true });
  return controller.signal;
}

// Fetch latest standard article
async function getLatestArticle(): Promise<Article | null> {
  try {
    const response = await fetch(
      `${API_BASE_URL}${API_ENDPOINTS.articles}?type=STANDARD&limit=1&status=PUBLISHED`,
      { next: { revalidate: 60 }, signal: withTimeoutSignal() }
    );
    if (!response.ok) return null;
    const data: PaginatedResponse<Article> = await response.json();
    return data.data[0] ?? null;
  } catch {
    return null;
  }
}

// Fetch latest articles
async function getLatestArticles(): Promise<Article[]> {
  try {
    const response = await fetch(
      `${API_BASE_URL}${API_ENDPOINTS.articles}?limit=6&status=PUBLISHED`,
      { next: { revalidate: 60 }, signal: withTimeoutSignal() }
    );
    if (!response.ok) return [];
    const data: PaginatedResponse<Article> = await response.json();
    return data.data;
  } catch {
    return [];
  }
}

// Fetch categories
async function getCategories(): Promise<Category[]> {
  try {
    const response = await fetch(
      `${API_BASE_URL}${API_ENDPOINTS.categories}`,
      { next: { revalidate: 300 }, signal: withTimeoutSignal() }
    );
    if (!response.ok) return [];
    const data = await response.json();
    return data.data;
  } catch {
    return [];
  }
}

// Fetch podcasts
async function getPodcasts(): Promise<Article[]> {
  try {
    const response = await fetch(
      `${API_BASE_URL}${API_ENDPOINTS.articles}?type=PODCAST&limit=4&status=PUBLISHED`,
      { next: { revalidate: 60 }, signal: withTimeoutSignal() }
    );
    if (!response.ok) return [];
    const data: PaginatedResponse<Article> = await response.json();
    return data.data;
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const [latestArticle, latestArticles, categories, podcasts] = await Promise.all([
    getLatestArticle(),
    getLatestArticles(),
    getCategories(),
    getPodcasts(),
  ]);
  const latestPodcast = podcasts[0] ?? null;

  return (
    <div className="min-h-screen">
      {/* Hero Section with Featured Article */}
      <section className="bg-gradient-to-b from-gray-900 to-gray-800 text-white">
        <div className="max-w-7xl mx-auto px-4 py-12 lg:py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl lg:text-6xl font-bold mb-6 leading-tight">
                L'actualité <span className="text-blue-400">tech</span> qui compte
              </h1>
              <p className="text-xl text-gray-300 mb-8">
                Restez informé des dernières innovations, analyses et tendances du monde de la technologie.
              </p>
              
              {/* Newsletter CTA */}
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-3">Newsletter hebdomadaire</h2>
                <p className="text-gray-300 text-sm mb-4">
                  Les meilleurs articles de la semaine, sélectionnés par la rédaction.
                </p>
                <NewsletterForm variant="hero" />
              </div>
            </div>

            {/* Hero highlights */}
            {(latestArticle || latestPodcast) && (
              <div className="space-y-4">
                {latestArticle && (
                  <div>
                    <p className="text-sm uppercase tracking-wide text-blue-300 mb-2">À la une · Article</p>
                    <ArticleCard article={latestArticle} variant="featured" />
                  </div>
                )}
                {latestPodcast && (
                  <div>
                    <p className="text-sm uppercase tracking-wide text-purple-300 mb-2">À la une · Podcast</p>
                    <ArticleCard article={latestPodcast} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Categories */}
      {categories.length > 0 && (
        <section className="py-8 bg-white border-b">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center gap-4 overflow-x-auto scrollbar-hide pb-2">
              <span className="text-gray-500 shrink-0">Catégories:</span>
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/category/${category.slug}`}
                  className="shrink-0 px-4 py-2 bg-gray-100 text-gray-700 rounded-full hover:bg-blue-100 hover:text-blue-700 transition-colors"
                >
                  {category.icon && <span className="mr-2">{category.icon}</span>}
                  {category.name}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Latest Articles */}
      <section className="py-12 lg:py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl lg:text-3xl font-bold">Derniers articles</h2>
            <Link
              href="/articles"
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Voir tout →
            </Link>
          </div>

          <Suspense fallback={<ArticleListSkeleton />}>
            <ArticleList articles={latestArticles} columns={3} />
          </Suspense>
        </div>
      </section>

      {/* Podcasts Section */}
      {podcasts.length > 0 && (
        <section className="py-12 lg:py-16 bg-gradient-to-r from-purple-50 to-blue-50">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🎙️</span>
                <h2 className="text-2xl lg:text-3xl font-bold">Podcasts</h2>
              </div>
              <Link
                href="/podcasts"
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                Tous les épisodes →
              </Link>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {podcasts.map((podcast) => (
                <ArticleCard key={podcast.id} article={podcast} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Newsletter Section */}
      <section className="py-16 lg:py-24 bg-gray-900 text-white">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <span className="text-4xl mb-4 block">📬</span>
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            Ne manquez rien de l'actualité tech
          </h2>
          <p className="text-gray-300 text-lg mb-8">
            Chaque semaine, recevez une sélection des meilleurs articles, podcasts et analyses directement dans votre boîte mail.
          </p>
          <div className="max-w-xl mx-auto">
            <NewsletterForm variant="hero" />
          </div>
          <p className="text-gray-500 text-sm mt-4">
            Rejoignez +1000 passionnés de tech. Désabonnement en un clic.
          </p>
        </div>
      </section>
    </div>
  );
}

// Skeleton for loading state
function ArticleListSkeleton() {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
