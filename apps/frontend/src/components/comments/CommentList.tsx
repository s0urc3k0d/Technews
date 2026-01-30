// ===========================================
// Comment List Component
// ===========================================

'use client';

import { useState } from 'react';
import { Comment } from '@/types';
import { useReportComment } from '@/hooks';
import { formatRelativeTime, getInitials, cn } from '@/lib/utils';
import { CommentForm } from '@/components/forms/CommentForm';

interface CommentListProps {
  comments: Comment[];
  articleId: string;
  className?: string;
}

export function CommentList({ comments, articleId, className }: CommentListProps) {
  // Filter to only show root comments (no parent)
  const rootComments = comments.filter(c => !c.parentId);

  if (rootComments.length === 0) {
    return (
      <div className={cn('text-center py-8', className)}>
        <p className="text-gray-500">Aucun commentaire pour le moment. Soyez le premier à réagir !</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {rootComments.map((comment) => (
        <CommentItem 
          key={comment.id} 
          comment={comment} 
          articleId={articleId}
          allComments={comments}
        />
      ))}
    </div>
  );
}

// Single Comment Item
interface CommentItemProps {
  comment: Comment;
  articleId: string;
  allComments: Comment[];
  depth?: number;
}

function CommentItem({ comment, articleId, allComments, depth = 0 }: CommentItemProps) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [showReplies, setShowReplies] = useState(true);
  const { mutate: reportComment, isPending: isReporting } = useReportComment();

  // Find replies to this comment
  const replies = allComments.filter(c => c.parentId === comment.id);

  const handleReport = () => {
    if (window.confirm('Signaler ce commentaire comme inapproprié ?')) {
      reportComment({ id: comment.id });
    }
  };

  return (
    <div className={cn(
      'relative',
      depth > 0 && 'ml-8 pl-4 border-l-2 border-gray-100'
    )}>
      <div className="bg-white rounded-lg p-4 border border-gray-100">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold text-sm">
              {getInitials(comment.authorName)}
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">{comment.authorName}</h4>
              <p className="text-sm text-gray-500">
                {formatRelativeTime(comment.createdAt)}
              </p>
            </div>
          </div>

          {/* Report Button */}
          <button
            onClick={handleReport}
            disabled={isReporting}
            className="text-gray-400 hover:text-red-500 transition-colors text-sm"
            title="Signaler"
          >
            🚩
          </button>
        </div>

        {/* Content */}
        <div className="text-gray-700 whitespace-pre-wrap">
          {comment.content}
        </div>

        {/* Actions */}
        <div className="mt-3 flex items-center gap-4">
          {depth < 3 && (
            <button
              onClick={() => setShowReplyForm(!showReplyForm)}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              {showReplyForm ? 'Annuler' : 'Répondre'}
            </button>
          )}
          {replies.length > 0 && (
            <button
              onClick={() => setShowReplies(!showReplies)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              {showReplies ? 'Masquer' : 'Afficher'} {replies.length} réponse{replies.length > 1 ? 's' : ''}
            </button>
          )}
        </div>

        {/* Reply Form */}
        {showReplyForm && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <CommentForm
              articleId={articleId}
              parentId={comment.id}
              onSuccess={() => setShowReplyForm(false)}
              onCancel={() => setShowReplyForm(false)}
            />
          </div>
        )}
      </div>

      {/* Replies */}
      {showReplies && replies.length > 0 && (
        <div className="mt-4 space-y-4">
          {replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              articleId={articleId}
              allComments={allComments}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
