import type { Redis } from 'ioredis';

export const WEBHOOK_SETTINGS_KEY = 'settings:webhooks:discord';

export const WEBHOOK_EVENTS = [
  'article_created',
  'article_updated',
  'article_published',
  'rss_import',
  'newsletter_generated',
  'newsletter_sent',
  'short_generated',
  'job_failed',
] as const;

export type WebhookEvent = typeof WEBHOOK_EVENTS[number];

export interface WebhookSettings {
  enabled: boolean;
  url: string;
  events: WebhookEvent[];
}

const DEFAULT_EVENTS: WebhookEvent[] = [
  'article_published',
  'rss_import',
  'newsletter_sent',
  'short_generated',
  'job_failed',
];

function sanitizeEvents(events: unknown): WebhookEvent[] {
  if (!Array.isArray(events)) return [];
  const allowed = new Set(WEBHOOK_EVENTS);
  return events
    .filter((event): event is WebhookEvent => typeof event === 'string' && allowed.has(event as WebhookEvent));
}

export async function getWebhookSettings(
  redis: Redis,
  fallbackUrl?: string
): Promise<WebhookSettings> {
  const raw = await redis.get(WEBHOOK_SETTINGS_KEY);

  if (!raw) {
    return {
      enabled: !!fallbackUrl,
      url: fallbackUrl || '',
      events: DEFAULT_EVENTS,
    };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<WebhookSettings>;
    const url = typeof parsed.url === 'string' && parsed.url.trim()
      ? parsed.url.trim()
      : (fallbackUrl || '');

    const events = sanitizeEvents(parsed.events);

    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : !!url,
      url,
      events: events.length > 0 ? events : DEFAULT_EVENTS,
    };
  } catch {
    return {
      enabled: !!fallbackUrl,
      url: fallbackUrl || '',
      events: DEFAULT_EVENTS,
    };
  }
}

export async function saveWebhookSettings(
  redis: Redis,
  settings: WebhookSettings
): Promise<WebhookSettings> {
  const sanitized: WebhookSettings = {
    enabled: settings.enabled,
    url: settings.url.trim(),
    events: sanitizeEvents(settings.events),
  };

  await redis.set(WEBHOOK_SETTINGS_KEY, JSON.stringify(sanitized));
  return sanitized;
}

export async function sendDiscordWebhookEvent(
  redis: Redis,
  fallbackUrl: string | undefined,
  event: WebhookEvent,
  title: string,
  description: string,
  color = 0x0ea5e9,
  extra?: Record<string, unknown>
): Promise<boolean> {
  const settings = await getWebhookSettings(redis, fallbackUrl);

  if (!settings.enabled || !settings.url) {
    return false;
  }

  if (!settings.events.includes(event)) {
    return false;
  }

  try {
    await fetch(settings.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [
          {
            title,
            description,
            color,
            timestamp: new Date().toISOString(),
            footer: { text: `Revue Tech • ${event}` },
            ...(extra ? { fields: Object.entries(extra).slice(0, 8).map(([name, value]) => ({ name, value: String(value), inline: true })) } : {}),
          },
        ],
      }),
    });
    return true;
  } catch {
    return false;
  }
}
