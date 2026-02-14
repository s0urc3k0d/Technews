// ===========================================
// Admin Articles Page
// ===========================================

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useArticles, useDeleteArticle, useUpdateArticle, useRssParse, useRssStatus } from '@/hooks';
import { useFiltersStore } from '@/lib/store';
import { formatDate, getStatusColor, getArticleTypeIcon, cn } from '@/lib/utils';
import { Article, ArticleStatus, ArticleType } from '@/types';
import { Button, Pagination } from '@/components';

export default function AdminArticlesPage() {
  const [page, setPage] = useState(1);
  const { status, type, search, setFilter, clearFilters } = useFiltersStore();
  
  const { data, isLoading } = useArticles({
    page,
    limit: 20,
    status: (status as ArticleStatus) || undefined,
    type: (type as ArticleType) || undefined,
    search: search || undefined,
  });

  const articles = data?.data ?? [];
  const pagination = data?.pagination;

  const { mutate: deleteArticle } = useDeleteArticle();
  const { mutate: updateArticle } = useUpdateArticle();
  const { data: rssStatus } = useRssStatus();
  const { mutate: parseRss, isPending: isParsingRss } = useRssParse();

  const handleDelete = (article: Article) => {
    if (confirm(`Supprimer "${article.title}" ?`)) {
      deleteArticle(article.id);
    }
  };

  const handleToggleStatus = (article: Article) => {
    const newStatus = article.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    updateArticle({ id: article.id, data: { status: newStatus } });
  };

  const handleRssImport = () => {
    parseRss(undefined, {
      onSuccess: (result) => {
        const imported = result.imported ?? 0;
        const updated = result.updated ?? 0;
        const skipped = result.skipped ?? 0;
        alert(`Import RSS terminé : ${imported} importé(s), ${updated} mis à jour, ${skipped} ignoré(s).`);
      },
      onError: (error) => {
        const message = error instanceof Error ? error.message : 'Erreur inconnue';
        alert(`Échec de l'import RSS : ${message}`);
      },
    });
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Articles</h1>
          <p className="text-gray-600 mt-1">
            {pagination?.total ?? 0} article(s) au total
          </p>
          {rssStatus?.feedUrl && (
            <p className="text-xs text-gray-500 mt-1">
              Flux RSS configuré: {rssStatus.feedUrl}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleRssImport}
            isLoading={isParsingRss}
          >
            📡 Importer depuis RSS
          </Button>
          <Link href="/admin/articles/new">
            <Button variant="primary">
              ✍️ Nouvel article
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm mb-6">
        <div className="flex flex-wrap gap-4">
          {/* Search */}
          <input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setFilter('search', e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* Status Filter */}
          <select
            value={status}
            onChange={(e) => setFilter('status', e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tous les statuts</option>
            <option value="PUBLISHED">Publié</option>
            <option value="DRAFT">Brouillon</option>
            <option value="ARCHIVED">Archivé</option>
          </select>

          {/* Type Filter */}
          <select
            value={type ?? ''}
            onChange={(e) => setFilter('type', e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tous les types</option>
            <option value="STANDARD">Article</option>
            <option value="PODCAST">Podcast</option>
          </select>

          {/* Clear Filters */}
          <Button variant="ghost" onClick={clearFilters}>
            Réinitialiser
          </Button>
        </div>
      </div>

      {/* Articles Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Chargement...</div>
        ) : articles.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Aucun article trouvé
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Article</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Catégorie</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Statut</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Date</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Vues</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {articles.map((article) => (
                <tr key={article.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{getArticleTypeIcon(article.type)}</span>
                      <div>
                        <p className="font-medium text-gray-900 line-clamp-1">{article.title}</p>
                        <p className="text-sm text-gray-500">/{article.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {article.category ? (
                      <span className="text-sm text-gray-700">
                        {article.category.icon} {article.category.name}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      'px-2 py-1 text-xs font-medium rounded',
                      getStatusColor(article.status)
                    )}>
                      {article.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {formatDate(article.publishedAt || article.createdAt)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {article.viewCount}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/article/${article.slug}`} target="_blank">
                        <Button variant="ghost" size="sm">👁️</Button>
                      </Link>
                      <Link href={`/admin/articles/new?id=${article.id}`}>
                        <Button variant="ghost" size="sm">✏️</Button>
                      </Link>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleToggleStatus(article)}
                      >
                        {article.status === 'PUBLISHED' ? '📤' : '📥'}
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleDelete(article)}
                      >
                        🗑️
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="border-t px-6 py-4">
            <Pagination
              currentPage={page}
              totalPages={pagination.totalPages}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
