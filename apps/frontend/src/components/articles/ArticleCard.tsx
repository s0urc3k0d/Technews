// ===========================================
// Article Card Component
// ===========================================

import Link from 'next/link';
import Image from 'next/image';
import { Article } from '@/types';
import { formatRelativeTime, truncate, getArticleTypeIcon, cn } from '@/lib/utils';

interface ArticleCardProps {
  article: Article;
  variant?: 'default' | 'compact' | 'featured' | 'horizontal';
  className?: string;
}

export function ArticleCard({ article, variant = 'default', className }: ArticleCardProps) {
  const typeIcon = getArticleTypeIcon(article.type);
  const imageUrl = article.imageUrl || article.featuredImage || null;
  const primaryCategory = article.category || article.categories?.[0] || null;
  const isExternalImage = Boolean(imageUrl && /^https?:\/\//i.test(imageUrl));
  
  // Featured variant (large)
  if (variant === 'featured') {
    return (
      <article className={cn(
        'group relative rounded-2xl overflow-hidden bg-gray-900 aspect-[16/9] md:aspect-[21/9]',
        className
      )}>
        {imageUrl && (
          isExternalImage ? (
            <img
              src={imageUrl}
              alt={article.title}
              className="w-full h-full object-cover opacity-60 group-hover:opacity-70 transition-opacity"
            />
          ) : (
            <Image
              src={imageUrl}
              alt={article.title}
              fill
              className="object-cover opacity-60 group-hover:opacity-70 transition-opacity"
              priority
            />
          )
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-10">
          <div className="flex items-center gap-3 mb-3">
            {primaryCategory && (
              <Link
                href={`/category/${primaryCategory.slug}`}
                className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded-full hover:bg-blue-700 transition-colors"
              >
                {primaryCategory.name}
              </Link>
            )}
            {article.type !== 'STANDARD' && (
              <span className="text-white/80 text-sm">{typeIcon} {article.type}</span>
            )}
          </div>
          <Link href={`/article/${article.slug}`}>
            <h2 className="text-2xl md:text-4xl font-bold text-white group-hover:text-blue-300 transition-colors mb-3">
              {article.title}
            </h2>
          </Link>
          {article.excerpt && (
            <p className="text-gray-300 text-sm md:text-base mb-4 max-w-3xl line-clamp-2">
              {article.excerpt}
            </p>
          )}
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <time dateTime={article.publishedAt?.toString()}>
              {formatRelativeTime(article.publishedAt || article.createdAt)}
            </time>
            {article.readingTime && (
              <span>{article.readingTime} min de lecture</span>
            )}
          </div>
        </div>
      </article>
    );
  }

  // Horizontal variant
  if (variant === 'horizontal') {
    return (
      <article className={cn('group flex gap-4', className)}>
        <Link href={`/article/${article.slug}`} className="shrink-0">
          <div className="relative w-32 h-24 md:w-48 md:h-32 rounded-lg overflow-hidden bg-gray-100">
            {imageUrl ? (
              isExternalImage ? (
                <img
                  src={imageUrl}
                  alt={article.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              ) : (
              <Image
                src={imageUrl}
                alt={article.title}
                fill
                className="object-cover group-hover:scale-105 transition-transform"
              />
              )
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl">
                {typeIcon}
              </div>
            )}
          </div>
        </Link>
        <div className="flex flex-col justify-center min-w-0">
          {article.category && (
            <Link
              href={`/category/${article.category.slug}`}
              className="text-xs font-medium text-blue-600 hover:text-blue-800 mb-1"
            >
              {article.category.name}
            </Link>
          )}
          <Link href={`/article/${article.slug}`}>
            <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2">
              {article.title}
            </h3>
          </Link>
          <p className="text-sm text-gray-500 mt-1">
            {formatRelativeTime(article.publishedAt || article.createdAt)}
          </p>
        </div>
      </article>
    );
  }

  // Compact variant
  if (variant === 'compact') {
    return (
      <article className={cn('group', className)}>
        <Link href={`/article/${article.slug}`} className="flex items-start gap-3">
          <span className="text-xl shrink-0">{typeIcon}</span>
          <div>
            <h3 className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2">
              {article.title}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {formatRelativeTime(article.publishedAt || article.createdAt)}
            </p>
          </div>
        </Link>
      </article>
    );
  }

  // Default variant
  return (
    <article className={cn(
      'group bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-gray-100',
      className
    )}>
      <Link href={`/article/${article.slug}`} className="block">
        <div className="relative aspect-[16/9] bg-gray-100">
          {imageUrl ? (
            isExternalImage ? (
              <img
                src={imageUrl}
                alt={article.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
            ) : (
              <Image
                src={imageUrl}
                alt={article.title}
                fill
                className="object-cover group-hover:scale-105 transition-transform"
              />
            )
          ) : (
            <div className="w-full h-full flex items-center justify-center text-5xl">
              {typeIcon}
            </div>
          )}
          {article.type !== 'STANDARD' && (
            <span className="absolute top-3 left-3 px-2 py-1 bg-black/70 text-white text-xs font-medium rounded">
              {typeIcon} {article.type}
            </span>
          )}
        </div>
      </Link>

      <div className="p-5">
        {primaryCategory && (
          <Link
            href={`/category/${primaryCategory.slug}`}
            className="inline-block text-xs font-semibold text-blue-600 hover:text-blue-800 mb-2"
          >
            {primaryCategory.icon && <span className="mr-1">{primaryCategory.icon}</span>}
            {primaryCategory.name}
          </Link>
        )}
        
        <Link href={`/article/${article.slug}`}>
          <h3 className="font-bold text-lg text-gray-900 group-hover:text-blue-600 transition-colors mb-2 line-clamp-2">
            {article.title}
          </h3>
        </Link>

        {article.excerpt && (
          <p className="text-gray-600 text-sm mb-4 line-clamp-2">
            {truncate(article.excerpt, 120)}
          </p>
        )}

        <div className="flex items-center justify-between text-sm text-gray-500">
          <time dateTime={article.publishedAt?.toString()}>
            {formatRelativeTime(article.publishedAt || article.createdAt)}
          </time>
          {article.readingTime && (
            <span>{article.readingTime} min</span>
          )}
        </div>

        {article.tags && article.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
            {article.tags.slice(0, 3).map((tag) => (
              <Link
                key={tag.id}
                href={`/tag/${tag.slug}`}
                className="text-xs text-gray-500 hover:text-blue-600 transition-colors"
              >
                #{tag.name}
              </Link>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
