// ===========================================
// Comment Section Component
// ===========================================

'use client';

import { useArticleComments } from '@/hooks';
import { CommentList } from './CommentList';
import { CommentForm } from '@/components/forms/CommentForm';
import { cn } from '@/lib/utils';

interface CommentSectionProps {
  articleId: string;
  className?: string;
}

export function CommentSection({ articleId, className }: CommentSectionProps) {
  const { data: commentsData, isLoading, isError } = useArticleComments(articleId);
  const comments = commentsData?.data ?? [];

  return (
    <section className={cn('', className)}>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        Commentaires {comments.length > 0 && `(${comments.length})`}
      </h2>

      {/* Comment Form */}
      <div className="bg-gray-50 rounded-xl p-6 mb-8">
        <h3 className="font-semibold text-lg mb-4">Laisser un commentaire</h3>
        <CommentForm articleId={articleId} />
      </div>

      {/* Comments List */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <CommentSkeleton key={i} />
          ))}
        </div>
      ) : isError ? (
        <div className="text-center py-8">
          <p className="text-red-600">Erreur lors du chargement des commentaires</p>
        </div>
      ) : (
        <CommentList comments={comments} articleId={articleId} />
      )}
    </section>
  );
}

// Comment Skeleton
function CommentSkeleton() {
  return (
    <div className="bg-white rounded-lg p-4 border border-gray-100 animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-gray-200" />
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded w-24" />
          <div className="h-3 bg-gray-200 rounded w-16" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-4 bg-gray-200 rounded w-full" />
        <div className="h-4 bg-gray-200 rounded w-3/4" />
      </div>
    </div>
  );
}
