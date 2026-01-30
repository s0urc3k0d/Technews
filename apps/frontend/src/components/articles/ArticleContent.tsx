// ===========================================
// Article Content Component
// ===========================================

import Image from 'next/image';
import Link from 'next/link';
import { Article } from '@/types';
import { formatDate, getArticleTypeIcon, cn } from '@/lib/utils';

interface ArticleContentProps {
  article: Article;
  className?: string;
}

export function ArticleContent({ article, className }: ArticleContentProps) {
  const typeIcon = getArticleTypeIcon(article.type);

  return (
    <article className={cn('max-w-4xl mx-auto', className)}>
      {/* Header */}
      <header className="mb-8">
        {/* Category & Type */}
        <div className="flex items-center gap-3 mb-4">
          {article.category && (
            <Link
              href={`/category/${article.category.slug}`}
              className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-full hover:bg-blue-200 transition-colors"
            >
              {article.category.icon && <span className="mr-1">{article.category.icon}</span>}
              {article.category.name}
            </Link>
          )}
          {article.type !== 'ARTICLE' && (
            <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm font-medium rounded-full">
              {typeIcon} {article.type}
            </span>
          )}
        </div>

        {/* Title */}
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-4 leading-tight">
          {article.title}
        </h1>

        {/* Excerpt */}
        {article.excerpt && (
          <p className="text-xl text-gray-600 mb-6">
            {article.excerpt}
          </p>
        )}

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 pb-6 border-b">
          <time dateTime={article.publishedAt?.toString()}>
            {formatDate(article.publishedAt || article.createdAt)}
          </time>
          {article.readingTime && (
            <>
              <span>•</span>
              <span>{article.readingTime} min de lecture</span>
            </>
          )}
          {article.viewCount > 0 && (
            <>
              <span>•</span>
              <span>{article.viewCount} vues</span>
            </>
          )}
          {article.source && (
            <>
              <span>•</span>
              <span>Source: {article.source}</span>
            </>
          )}
        </div>
      </header>

      {/* Featured Image */}
      {article.imageUrl && (
        <figure className="mb-8 -mx-4 md:mx-0">
          <div className="relative aspect-[16/9] rounded-lg overflow-hidden">
            <Image
              src={article.imageUrl}
              alt={article.imageAlt || article.title}
              fill
              className="object-cover"
              priority
            />
          </div>
          {article.imageAlt && (
            <figcaption className="text-sm text-gray-500 text-center mt-2">
              {article.imageAlt}
            </figcaption>
          )}
        </figure>
      )}

      {/* Podcast Player */}
      {article.type === 'PODCAST' && article.podcastUrl && (
        <div className="mb-8 p-6 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-100">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">🎙️</span>
            <h2 className="font-semibold text-lg">Écouter l'épisode</h2>
          </div>
          <audio 
            controls 
            className="w-full"
            src={article.podcastUrl}
          >
            Votre navigateur ne supporte pas l'élément audio.
          </audio>
          {article.podcastDuration && (
            <p className="text-sm text-gray-600 mt-2">
              Durée: {Math.floor(article.podcastDuration / 60)} minutes
            </p>
          )}
        </div>
      )}

      {/* Video Player */}
      {article.type === 'VIDEO' && article.videoUrl && (
        <div className="mb-8 aspect-video rounded-xl overflow-hidden bg-black">
          <iframe
            src={article.videoUrl}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {/* Content */}
      <div 
        className="prose prose-lg max-w-none prose-headings:font-bold prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline prose-img:rounded-lg"
        dangerouslySetInnerHTML={{ __html: article.content }}
      />

      {/* Source Link */}
      {article.sourceUrl && (
        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">
            📎 Source originale:{' '}
            <a
              href={article.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              {new URL(article.sourceUrl).hostname}
            </a>
          </p>
        </div>
      )}

      {/* Tags */}
      {article.tags && article.tags.length > 0 && (
        <div className="mt-8 pt-6 border-t">
          <div className="flex flex-wrap gap-2">
            {article.tags.map((tag) => (
              <Link
                key={tag.id}
                href={`/tag/${tag.slug}`}
                className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full hover:bg-gray-200 transition-colors"
              >
                #{tag.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Share */}
      <div className="mt-8 pt-6 border-t">
        <h3 className="font-semibold mb-4">Partager cet article</h3>
        <div className="flex gap-3">
          <ShareButton 
            platform="twitter" 
            url={typeof window !== 'undefined' ? window.location.href : ''} 
            title={article.title} 
          />
          <ShareButton 
            platform="linkedin" 
            url={typeof window !== 'undefined' ? window.location.href : ''} 
            title={article.title} 
          />
          <ShareButton 
            platform="copy" 
            url={typeof window !== 'undefined' ? window.location.href : ''} 
            title={article.title} 
          />
        </div>
      </div>
    </article>
  );
}

// Share Button Component
function ShareButton({ platform, url, title }: { platform: string; url: string; title: string }) {
  const handleShare = () => {
    if (platform === 'twitter') {
      window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`, '_blank');
    } else if (platform === 'linkedin') {
      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank');
    } else if (platform === 'copy') {
      navigator.clipboard.writeText(url);
    }
  };

  const icons: Record<string, string> = {
    twitter: '𝕏',
    linkedin: 'in',
    copy: '🔗',
  };

  const labels: Record<string, string> = {
    twitter: 'Twitter',
    linkedin: 'LinkedIn',
    copy: 'Copier le lien',
  };

  return (
    <button
      onClick={handleShare}
      className="p-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
      title={labels[platform]}
    >
      {icons[platform]}
    </button>
  );
}
