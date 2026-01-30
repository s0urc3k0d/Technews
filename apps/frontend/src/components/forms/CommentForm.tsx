// ===========================================
// Comment Form Component
// ===========================================

'use client';

import { useState, FormEvent } from 'react';
import { useCreateComment, CreateCommentInput } from '@/hooks';
import { isValidEmail, cn } from '@/lib/utils';

interface CommentFormProps {
  articleId: string;
  parentId?: string | null;
  onSuccess?: () => void;
  onCancel?: () => void;
  className?: string;
}

export function CommentForm({ 
  articleId, 
  parentId = null, 
  onSuccess, 
  onCancel,
  className 
}: CommentFormProps) {
  const [authorName, setAuthorName] = useState('');
  const [authorEmail, setAuthorEmail] = useState('');
  const [content, setContent] = useState('');
  const [website, setWebsite] = useState(''); // Honeypot
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { mutate: createComment, isPending, isError, error } = useCreateComment();

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!authorName.trim()) {
      newErrors.authorName = 'Le nom est requis';
    } else if (authorName.length < 2) {
      newErrors.authorName = 'Le nom doit contenir au moins 2 caractères';
    }

    if (!authorEmail.trim()) {
      newErrors.authorEmail = "L'email est requis";
    } else if (!isValidEmail(authorEmail)) {
      newErrors.authorEmail = "L'email n'est pas valide";
    }

    if (!content.trim()) {
      newErrors.content = 'Le commentaire est requis';
    } else if (content.length < 3) {
      newErrors.content = 'Le commentaire doit contenir au moins 3 caractères';
    } else if (content.length > 2000) {
      newErrors.content = 'Le commentaire ne peut pas dépasser 2000 caractères';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    const data: CreateCommentInput = {
      articleId,
      parentId: parentId || undefined,
      authorName: authorName.trim(),
      authorEmail: authorEmail.trim().toLowerCase(),
      content: content.trim(),
      website, // Honeypot - should be empty
    };

    createComment(data, {
      onSuccess: () => {
        setAuthorName('');
        setAuthorEmail('');
        setContent('');
        onSuccess?.();
      },
    });
  };

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-4', className)}>
      {/* Honeypot field - hidden from real users */}
      <input
        type="text"
        name="website"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        className="absolute opacity-0 h-0 w-0 pointer-events-none"
        aria-hidden="true"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="comment-name" className="block text-sm font-medium text-gray-700 mb-1">
            Nom *
          </label>
          <input
            id="comment-name"
            type="text"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            placeholder="Votre nom"
            maxLength={100}
            className={cn(
              'w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
              errors.authorName ? 'border-red-500' : 'border-gray-300'
            )}
          />
          {errors.authorName && (
            <p className="mt-1 text-sm text-red-600">{errors.authorName}</p>
          )}
        </div>

        <div>
          <label htmlFor="comment-email" className="block text-sm font-medium text-gray-700 mb-1">
            Email *
          </label>
          <input
            id="comment-email"
            type="email"
            value={authorEmail}
            onChange={(e) => setAuthorEmail(e.target.value)}
            placeholder="votre@email.com"
            className={cn(
              'w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
              errors.authorEmail ? 'border-red-500' : 'border-gray-300'
            )}
          />
          {errors.authorEmail && (
            <p className="mt-1 text-sm text-red-600">{errors.authorEmail}</p>
          )}
          <p className="mt-1 text-xs text-gray-500">Votre email ne sera pas publié</p>
        </div>
      </div>

      <div>
        <label htmlFor="comment-content" className="block text-sm font-medium text-gray-700 mb-1">
          Commentaire *
        </label>
        <textarea
          id="comment-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={parentId ? 'Écrire une réponse...' : 'Écrire un commentaire...'}
          rows={4}
          maxLength={2000}
          className={cn(
            'w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none',
            errors.content ? 'border-red-500' : 'border-gray-300'
          )}
        />
        {errors.content && (
          <p className="mt-1 text-sm text-red-600">{errors.content}</p>
        )}
        <p className="mt-1 text-xs text-gray-500 text-right">
          {content.length}/2000
        </p>
      </div>

      {isError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error.message}</p>
        </div>
      )}

      <div className="flex justify-end gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
          >
            Annuler
          </button>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? 'Envoi...' : parentId ? 'Répondre' : 'Publier'}
        </button>
      </div>
    </form>
  );
}
