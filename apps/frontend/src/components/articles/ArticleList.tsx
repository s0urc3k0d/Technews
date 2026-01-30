// ===========================================
// Article List Component
// ===========================================

'use client';

import { ArticleCard } from './ArticleCard';
import { Article } from '@/types';
import { cn } from '@/lib/utils';

interface ArticleListProps {
  articles: Article[];
  variant?: 'grid' | 'list' | 'compact';
  columns?: 2 | 3 | 4;
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
}

export function ArticleList({ 
  articles, 
  variant = 'grid',
  columns = 3,
  loading = false,
  emptyMessage = 'Aucun article trouvé',
  className 
}: ArticleListProps) {
  // Loading skeleton
  if (loading) {
    return (
      <div className={cn(
        variant === 'grid' && `grid gap-6 ${
          columns === 2 ? 'md:grid-cols-2' : 
          columns === 3 ? 'md:grid-cols-2 lg:grid-cols-3' : 
          'md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
        }`,
        variant === 'list' && 'space-y-4',
        variant === 'compact' && 'space-y-3',
        className
      )}>
        {Array.from({ length: 6 }).map((_, i) => (
          <ArticleSkeleton key={i} variant={variant === 'grid' ? 'default' : variant === 'list' ? 'horizontal' : 'compact'} />
        ))}
      </div>
    );
  }

  // Empty state
  if (articles.length === 0) {
    return (
      <div className={cn('text-center py-12', className)}>
        <p className="text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  // Grid layout
  if (variant === 'grid') {
    return (
      <div className={cn(
        'grid gap-6',
        columns === 2 && 'md:grid-cols-2',
        columns === 3 && 'md:grid-cols-2 lg:grid-cols-3',
        columns === 4 && 'md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
        className
      )}>
        {articles.map((article) => (
          <ArticleCard key={article.id} article={article} variant="default" />
        ))}
      </div>
    );
  }

  // List layout
  if (variant === 'list') {
    return (
      <div className={cn('space-y-4', className)}>
        {articles.map((article) => (
          <ArticleCard key={article.id} article={article} variant="horizontal" />
        ))}
      </div>
    );
  }

  // Compact layout
  return (
    <div className={cn('space-y-3', className)}>
      {articles.map((article) => (
        <ArticleCard key={article.id} article={article} variant="compact" />
      ))}
    </div>
  );
}

// Skeleton component
function ArticleSkeleton({ variant }: { variant: 'default' | 'horizontal' | 'compact' }) {
  if (variant === 'compact') {
    return (
      <div className="flex items-start gap-3 animate-pulse">
        <div className="w-6 h-6 bg-gray-200 rounded shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-3/4" />
          <div className="h-3 bg-gray-200 rounded w-1/4" />
        </div>
      </div>
    );
  }

  if (variant === 'horizontal') {
    return (
      <div className="flex gap-4 animate-pulse">
        <div className="w-48 h-32 bg-gray-200 rounded-lg shrink-0" />
        <div className="flex-1 space-y-2 py-2">
          <div className="h-3 bg-gray-200 rounded w-1/4" />
          <div className="h-5 bg-gray-200 rounded w-3/4" />
          <div className="h-5 bg-gray-200 rounded w-1/2" />
          <div className="h-3 bg-gray-200 rounded w-1/4 mt-4" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 animate-pulse">
      <div className="aspect-[16/9] bg-gray-200" />
      <div className="p-5 space-y-3">
        <div className="h-3 bg-gray-200 rounded w-1/4" />
        <div className="h-5 bg-gray-200 rounded w-3/4" />
        <div className="h-5 bg-gray-200 rounded w-1/2" />
        <div className="h-4 bg-gray-200 rounded w-full" />
        <div className="flex justify-between pt-3">
          <div className="h-3 bg-gray-200 rounded w-1/4" />
          <div className="h-3 bg-gray-200 rounded w-1/6" />
        </div>
      </div>
    </div>
  );
}
