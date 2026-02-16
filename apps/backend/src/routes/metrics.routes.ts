// ===========================================
// Routes API - Métriques (Prometheus)
// ===========================================

import { FastifyPluginAsync } from 'fastify';

// Simple metrics storage (in production, use prom-client)
interface Metrics {
  httpRequestsTotal: Map<string, number>;
  httpRequestDuration: number[];
  httpRequestDurationByRoute: Map<string, number[]>;
  webVitals: {
    LCP: number[];
    INP: number[];  // Interaction to Next Paint (remplace FID)
    CLS: number[];
    FCP: number[];
    TTFB: number[];
  };
}

const metrics: Metrics = {
  httpRequestsTotal: new Map(),
  httpRequestDuration: [],
  httpRequestDurationByRoute: new Map(),
  webVitals: {
    LCP: [],
    INP: [],
    CLS: [],
    FCP: [],
    TTFB: [],
  },
};

const metricsRoutes: FastifyPluginAsync = async (fastify) => {
  const { prisma } = fastify;

  // GET /metrics - Prometheus format metrics
  fastify.get('/', async (request, reply) => {
    let articleCount = 0;
    let commentCount = 0;
    let pendingCommentCount = 0;
    let subscriberCount = 0;
    let publishedCount = 0;
    let pageviewCount = 0;
    let newsletterSentCount = 0;
    let rssImportRuns = 0;
    let articleViews: Array<{ slug: string; viewCount: number }> = [];

    try {
      const [
        totalArticles,
        totalComments,
        totalPendingComments,
        activeSubscribers,
        publishedArticles,
        totalPageviews,
        totalNewsletterSent,
        totalRssRuns,
        articleViewRows,
      ] = await Promise.all([
        prisma.article.count(),
        prisma.comment.count(),
        prisma.comment.count({ where: { status: 'PENDING' } }),
        prisma.subscriber.count({ where: { isActive: true, isConfirmed: true } }),
        prisma.article.count({ where: { status: 'PUBLISHED' } }),
        prisma.pageView.count(),
        prisma.newsletterRecipient.count(),
        prisma.cronJobLog.count({ where: { jobName: 'rss-parser', status: 'SUCCESS' } }),
        prisma.article.findMany({
          where: { viewCount: { gt: 0 } },
          select: { slug: true, viewCount: true },
          take: 100,
          orderBy: { viewCount: 'desc' },
        }),
      ]);

      articleCount = totalArticles;
      commentCount = totalComments;
      pendingCommentCount = totalPendingComments;
      subscriberCount = activeSubscribers;
      publishedCount = publishedArticles;
      pageviewCount = totalPageviews;
      newsletterSentCount = totalNewsletterSent;
      rssImportRuns = totalRssRuns;
      articleViews = articleViewRows;
    } catch (err) {
      fastify.log.warn({ err }, 'Failed to compute DB-backed metrics');
    }

    // Calculate percentiles for response times
    const sortedDurations = [...metrics.httpRequestDuration].sort((a, b) => a - b);
    const p50 = sortedDurations[Math.floor(sortedDurations.length * 0.5)] || 0;
    const p95 = sortedDurations[Math.floor(sortedDurations.length * 0.95)] || 0;
    const p99 = sortedDurations[Math.floor(sortedDurations.length * 0.99)] || 0;

    // Calculate Web Vitals averages
    const avgLCP = metrics.webVitals.LCP.length 
      ? metrics.webVitals.LCP.reduce((a, b) => a + b, 0) / metrics.webVitals.LCP.length 
      : 0;
    const avgINP = metrics.webVitals.INP.length 
      ? metrics.webVitals.INP.reduce((a, b) => a + b, 0) / metrics.webVitals.INP.length 
      : 0;
    const avgCLS = metrics.webVitals.CLS.length 
      ? metrics.webVitals.CLS.reduce((a, b) => a + b, 0) / metrics.webVitals.CLS.length 
      : 0;

    const durationBuckets = [0.1, 0.3, 0.5, 1, 2, 5];
    const durationsSeconds = metrics.httpRequestDuration.map(d => d / 1000);
    const allDurationBucketLines = durationBuckets
      .map((bucket) => {
        const count = durationsSeconds.filter(v => v <= bucket).length;
        return `http_request_duration_seconds_bucket{le="${bucket}"} ${count}`;
      })
      .join('\n');
    const allDurationCount = durationsSeconds.length;
    const allDurationSum = durationsSeconds.reduce((sum, value) => sum + value, 0);

    const routeDurationLines: string[] = [];
    for (const [route, routeDurations] of metrics.httpRequestDurationByRoute.entries()) {
      const routeSeconds = routeDurations.map((d) => d / 1000);
      for (const bucket of durationBuckets) {
        const count = routeSeconds.filter(v => v <= bucket).length;
        routeDurationLines.push(
          `http_request_duration_seconds_bucket{route="${route}",le="${bucket}"} ${count}`
        );
      }
      routeDurationLines.push(
        `http_request_duration_seconds_count{route="${route}"} ${routeSeconds.length}`
      );
      routeDurationLines.push(
        `http_request_duration_seconds_sum{route="${route}"} ${routeSeconds.reduce((sum, value) => sum + value, 0)}`
      );
    }

    const httpRequestLines = Array.from(metrics.httpRequestsTotal.entries()).map(([key, value]) => {
      const [method, status, route] = key.split('|');
      return `http_requests_total{method="${method}",status="${status}",route="${route}"} ${value}`;
    });

    const articleViewLines = articleViews.map(
      (article) => `technews_article_views_total{article_slug="${article.slug}"} ${article.viewCount}`
    );

    // Build Prometheus format output
    const output = `
# HELP technews_articles_total Total number of articles
# TYPE technews_articles_total gauge
technews_articles_total ${articleCount}
technews_articles_total{status="PUBLISHED"} ${publishedCount}

# HELP technews_articles_published_total Total number of published articles
# TYPE technews_articles_published_total gauge
technews_articles_published_total ${publishedCount}

# HELP technews_comments_total Total number of comments
# TYPE technews_comments_total gauge
technews_comments_total ${commentCount}
technews_comments_total{status="PENDING"} ${pendingCommentCount}

# HELP technews_subscribers_active Total number of active subscribers
# TYPE technews_subscribers_active gauge
technews_subscribers_active ${subscriberCount}

# HELP technews_subscribers_total Total number of active subscribers
# TYPE technews_subscribers_total gauge
technews_subscribers_total{status="ACTIVE"} ${subscriberCount}

# HELP technews_pageviews_total Total number of tracked pageviews
# TYPE technews_pageviews_total counter
technews_pageviews_total ${pageviewCount}

# HELP technews_newsletter_sent_total Total sent newsletter emails
# TYPE technews_newsletter_sent_total counter
technews_newsletter_sent_total ${newsletterSentCount}

# HELP technews_rss_imports_total Total successful RSS imports
# TYPE technews_rss_imports_total counter
technews_rss_imports_total ${rssImportRuns}

# HELP technews_article_views_total Article view totals by slug
# TYPE technews_article_views_total gauge
${articleViewLines.join('\n')}

# HELP http_requests_total HTTP requests total by method/status/route
# TYPE http_requests_total counter
${httpRequestLines.join('\n')}

# HELP http_request_duration_seconds HTTP request latency histogram
# TYPE http_request_duration_seconds histogram
${allDurationBucketLines}
http_request_duration_seconds_bucket{le="+Inf"} ${allDurationCount}
http_request_duration_seconds_count ${allDurationCount}
http_request_duration_seconds_sum ${allDurationSum}
${routeDurationLines.join('\n')}

# HELP technews_http_request_duration_seconds HTTP request duration in seconds
# TYPE technews_http_request_duration_seconds summary
technews_http_request_duration_seconds{quantile="0.5"} ${p50 / 1000}
technews_http_request_duration_seconds{quantile="0.95"} ${p95 / 1000}
technews_http_request_duration_seconds{quantile="0.99"} ${p99 / 1000}

# HELP technews_web_vitals_lcp Largest Contentful Paint in milliseconds
# TYPE technews_web_vitals_lcp gauge
technews_web_vitals_lcp ${avgLCP}

# HELP technews_web_vitals_inp Interaction to Next Paint in milliseconds
# TYPE technews_web_vitals_inp gauge
technews_web_vitals_inp ${avgINP}

# HELP technews_web_vitals_cls Cumulative Layout Shift
# TYPE technews_web_vitals_cls gauge
technews_web_vitals_cls ${avgCLS}

# HELP technews_uptime_seconds Uptime in seconds
# TYPE technews_uptime_seconds gauge
technews_uptime_seconds ${process.uptime()}
`.trim();

    reply.header('Content-Type', 'text/plain; charset=utf-8');
    return reply.send(output);
  });

  // POST /metrics/vitals - Receive Web Vitals from frontend
  fastify.post<{
    Body: {
      name: 'LCP' | 'INP' | 'CLS' | 'TTFB' | 'FCP';
      value: number;
      rating?: 'good' | 'needs-improvement' | 'poor';
      delta?: number;
      id?: string;
      navigationType?: string;
      url?: string;
      timestamp?: number;
    };
  }>('/vitals', async (request, reply) => {
    const { name, value, rating, url } = request.body;
    const path = url ? new URL(url).pathname : '/';

    // Store in memory for Prometheus
    if (name in metrics.webVitals) {
      const key = name as keyof typeof metrics.webVitals;
      metrics.webVitals[key].push(value);
      // Keep only last 1000 values
      if (metrics.webVitals[key].length > 1000) {
        metrics.webVitals[key].shift();
      }
    }

    // Also store in database for detailed analytics
    try {
      await prisma.webVitals.create({
        data: {
          name,
          value,
          rating: rating || null,
          path,
          sessionId: request.headers['x-session-id'] as string || 'unknown',
          userAgent: request.headers['user-agent'] || null,
        },
      });
    } catch (err) {
      // Ignore DB errors for metrics
      fastify.log.warn({ err }, 'Failed to store Web Vitals in DB');
    }

    return reply.send({ received: true });
  });

  // POST /metrics/web-vitals - Legacy endpoint (keep for compatibility)
  fastify.post<{
    Body: {
      name: 'LCP' | 'FID' | 'CLS' | 'TTFB' | 'FCP';
      value: number;
      rating?: string;
      path?: string;
    };
  }>('/web-vitals', async (request, reply) => {
    const { name, value, rating, path } = request.body;

    // Map FID to INP for compatibility
    const metricName = name === 'FID' ? 'INP' : name;

    // Store in memory for Prometheus
    if (metricName in metrics.webVitals) {
      const key = metricName as keyof typeof metrics.webVitals;
      metrics.webVitals[key].push(value);
      // Keep only last 1000 values
      if (metrics.webVitals[key].length > 1000) {
        metrics.webVitals[key].shift();
      }
    }

    // Also store in database for detailed analytics
    try {
      await prisma.webVitals.create({
        data: {
          name: metricName,
          value,
          rating: rating || null,
          path: path || '/',
          sessionId: request.headers['x-session-id'] as string || 'unknown',
          userAgent: request.headers['user-agent'] || null,
        },
      });
    } catch (err) {
      fastify.log.warn({ err }, 'Failed to store Web Vitals in DB');
    }

    return reply.send({ received: true });
  });

  // POST /metrics/pageview - Track page views
  fastify.post<{
    Body: {
      path: string;
      articleId?: string;
      referrer?: string;
      utmSource?: string;
      utmMedium?: string;
      utmCampaign?: string;
    };
  }>('/pageview', async (request, reply) => {
    const { path, articleId, referrer, utmSource, utmMedium, utmCampaign } = request.body;

    await prisma.pageView.create({
      data: {
        path,
        articleId,
        sessionId: request.headers['x-session-id'] as string || 'unknown',
        ipHash: request.ip ? Buffer.from(request.ip).toString('base64').slice(0, 20) : null,
        userAgent: request.headers['user-agent'],
        referrer,
        utmSource,
        utmMedium,
        utmCampaign,
      },
    });

    return reply.send({ tracked: true });
  });
};

// Middleware to track response times
export const trackResponseTime = (fastify: any) => {
  fastify.addHook('onResponse', (request: any, reply: any, done: () => void) => {
    const duration = reply.getResponseTime();
    metrics.httpRequestDuration.push(duration);
    const route = request.routeOptions?.url || request.routerPath || request.url?.split('?')[0] || 'unknown';
    
    // Keep only last 10000 values
    if (metrics.httpRequestDuration.length > 10000) {
      metrics.httpRequestDuration.shift();
    }

    const routeDurations = metrics.httpRequestDurationByRoute.get(route) || [];
    routeDurations.push(duration);
    if (routeDurations.length > 2000) {
      routeDurations.shift();
    }
    metrics.httpRequestDurationByRoute.set(route, routeDurations);
    
    // Track by status code
    const key = `${request.method}|${reply.statusCode}|${route}`;
    metrics.httpRequestsTotal.set(key, (metrics.httpRequestsTotal.get(key) || 0) + 1);
    
    done();
  });
};

export default metricsRoutes;
