// ===========================================
// RSS Feed - Next.js Route Handler
// ===========================================

import { NextResponse } from 'next/server';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://revuetech.fr';
const SITE_NAME = 'Revue Tech';
const SITE_DESCRIPTION = 'Actualités tech et podcasts sur les dernières tendances technologiques';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://revuetech.fr';

interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  publishedAt: string;
  updatedAt: string;
  type: string;
  category?: {
    name: string;
  };
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

export async function GET() {
  try {
    const res = await fetch(`${API_URL}/api/v1/articles?status=PUBLISHED&limit=50`, {
      next: { revalidate: 3600 },
    });

    let articles: Article[] = [];
    if (res.ok) {
      const data = await res.json();
      articles = data.data || [];
    }

    const lastBuildDate = articles.length > 0 
      ? new Date(articles[0].publishedAt).toUTCString()
      : new Date().toUTCString();

    const rssItems = articles.map((article) => {
      const description = article.excerpt || stripHtml(article.content).slice(0, 300) + '...';
      const pubDate = new Date(article.publishedAt).toUTCString();
      const category = article.category?.name || 'Tech';

      return `
    <item>
      <title>${escapeXml(article.title)}</title>
      <link>${SITE_URL}/article/${article.slug}</link>
      <guid isPermaLink="true">${SITE_URL}/article/${article.slug}</guid>
      <description>${escapeXml(description)}</description>
      <pubDate>${pubDate}</pubDate>
      <category>${escapeXml(category)}</category>
    </item>`;
    }).join('');

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(SITE_NAME)}</title>
    <link>${SITE_URL}</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>fr-FR</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml"/>
    <image>
      <url>${SITE_URL}/icon-512.png</url>
      <title>${escapeXml(SITE_NAME)}</title>
      <link>${SITE_URL}</link>
    </image>
    ${rssItems}
  </channel>
</rss>`;

    return new NextResponse(rss, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (error) {
    console.error('RSS generation error:', error);
    return new NextResponse('Error generating RSS feed', { status: 500 });
  }
}
