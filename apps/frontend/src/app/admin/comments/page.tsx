// ===========================================
// Admin Comments Page
// ===========================================

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useComments, useApproveComment, useRejectComment, useDeleteComment } from '@/hooks';
import { formatRelativeTime, getStatusColor, cn } from '@/lib/utils';
import { Button, Pagination } from '@/components';
import type { CommentStatus } from '@/types';

export default function AdminCommentsPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data, isLoading } = useComments({
    page,
    limit: 20,
    status: (statusFilter as CommentStatus) || undefined,
  });

  const comments = data?.data ?? [];
  const pagination = data?.pagination;

  const { mutate: approve } = useApproveComment();
  const { mutate: reject } = useRejectComment();
  const { mutate: deleteComment } = useDeleteComment();

  const handleApprove = (id: string) => {
    approve(id);
  };

  const handleReject = (id: string) => {
    reject(id);
  };

  const handleDelete = (id: string) => {
    if (confirm('Supprimer ce commentaire ?')) {
      deleteComment(id);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Commentaires</h1>
        <p className="text-gray-600 mt-1">
          {pagination?.total ?? 0} commentaire(s) au total
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm mb-6">
        <div className="flex gap-4">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tous les statuts</option>
            <option value="PENDING">En attente</option>
            <option value="APPROVED">Approuvé</option>
            <option value="REJECTED">Rejeté</option>
            <option value="SPAM">Spam</option>
          </select>
        </div>
      </div>

      {/* Comments List */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Chargement...</div>
        ) : comments.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Aucun commentaire trouvé
          </div>
        ) : (
          <div className="divide-y">
            {comments.map((comment) => (
              <div key={comment.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Author & Meta */}
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold text-sm">
                        {comment.authorName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{comment.authorName}</p>
                        <p className="text-sm text-gray-500">{comment.authorEmail}</p>
                      </div>
                      <span className={cn(
                        'px-2 py-1 text-xs font-medium rounded ml-auto',
                        getStatusColor(comment.status)
                      )}>
                        {comment.status}
                      </span>
                    </div>

                    {/* Content */}
                    <p className="text-gray-700 mb-3 whitespace-pre-wrap">
                      {comment.content}
                    </p>

                    {/* Article Link */}
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>{formatRelativeTime(comment.createdAt)}</span>
                      {comment.article && (
                        <Link 
                          href={`/article/${comment.article.slug}`}
                          target="_blank"
                          className="text-blue-600 hover:underline"
                        >
                          📰 {comment.article.title}
                        </Link>
                      )}
                      {comment.reportCount > 0 && (
                        <span className="text-red-600">
                          🚩 {comment.reportCount} signalement(s)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {comment.status === 'PENDING' && (
                      <>
                        <Button 
                          variant="primary" 
                          size="sm"
                          onClick={() => handleApprove(comment.id)}
                        >
                          ✅ Approuver
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleReject(comment.id)}
                        >
                          ❌ Rejeter
                        </Button>
                      </>
                    )}
                    {comment.status === 'APPROVED' && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleReject(comment.id)}
                      >
                        ❌ Rejeter
                      </Button>
                    )}
                    {comment.status === 'REJECTED' && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleApprove(comment.id)}
                      >
                        ✅ Restaurer
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleDelete(comment.id)}
                    >
                      🗑️
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
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
