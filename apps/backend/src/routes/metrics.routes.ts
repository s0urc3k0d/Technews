// ===========================================
// Routes API - Métriques (Prometheus)
// ===========================================

import { FastifyPluginAsync } from 'fastify';

// Simple metrics storage (in production, use prom-client)
interface Metrics {
  httpRequestsTotal: Map<string, number>;
  httpRequestDuration: number[];
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
    // Get DB stats
    const [
      articleCount,
      commentCount,
      subscriberCount,
      publishedCount,
    ] = await Promise.all([
      prisma.article.count(),
      prisma.comment.count(),
      prisma.subscriber.count({ where: { isActive: true, isConfirmed: true } }),
      prisma.article.count({ where: { status: 'PUBLISHED' } }),
    ]);

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

    // Build Prometheus format output
    const output = `
# HELP technews_articles_total Total number of articles
# TYPE technews_articles_total gauge
technews_articles_total ${articleCount}

# HELP technews_articles_published_total Total number of published articles
# TYPE technews_articles_published_total gauge
technews_articles_published_total ${publishedCount}

# HELP technews_comments_total Total number of comments
# TYPE technews_comments_total gauge
technews_comments_total ${commentCount}

# HELP technews_subscribers_active Total number of active subscribers
# TYPE technews_subscribers_active gauge
technews_subscribers_active ${subscriberCount}

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
    
    // Keep only last 10000 values
    if (metrics.httpRequestDuration.length > 10000) {
      metrics.httpRequestDuration.shift();
    }
    
    // Track by status code
    const key = `${request.method}_${reply.statusCode}`;
    metrics.httpRequestsTotal.set(key, (metrics.httpRequestsTotal.get(key) || 0) + 1);
    
    done();
  });
};

export default metricsRoutes;
