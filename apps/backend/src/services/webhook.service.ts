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

const EVENT_STYLES: Record<WebhookEvent, { emoji: string; label: string; color: number }> = {
  article_created: { emoji: '📝', label: 'Article créé', color: 0x3b82f6 },
  article_updated: { emoji: '✏️', label: 'Article mis à jour', color: 0x0ea5e9 },
  article_published: { emoji: '🚀', label: 'Article publié', color: 0x22c55e },
  rss_import: { emoji: '📰', label: 'Import RSS', color: 0x8b5cf6 },
  newsletter_generated: { emoji: '📬', label: 'Newsletter générée', color: 0x0ea5e9 },
  newsletter_sent: { emoji: '✅', label: 'Newsletter envoyée', color: 0x22c55e },
  short_generated: { emoji: '🎬', label: 'Short généré', color: 0xf59e0b },
  job_failed: { emoji: '⚠️', label: 'Échec job', color: 0xef4444 },
};

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

  const style = EVENT_STYLES[event];
  const titleWithEmoji = `${style.emoji} ${title || style.label}`;
  const safeDescription = description && description.trim()
    ? description.trim()
    : 'Mise à jour disponible.';

  const extraEntries = extra
    ? Object.entries(extra).filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
    : [];

  const articleUrl = extraEntries.find(([name]) => name === 'url')?.[1];
  const imageUrl = extraEntries.find(([name]) => name === 'imageUrl' || name === 'thumbnailUrl')?.[1];
  const fields = extraEntries
    .filter(([name]) => name !== 'url' && name !== 'imageUrl' && name !== 'thumbnailUrl')
    .slice(0, 8)
    .map(([name, value]) => ({
      name: name.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
      value: String(value),
      inline: true,
    }));

  try {
    await fetch(settings.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Revue Tech Bot',
        embeds: [
          {
            title: titleWithEmoji,
            description: safeDescription,
            color: style.color || color,
            ...(articleUrl ? { url: String(articleUrl) } : {}),
            author: {
              name: 'Revue Tech · Notifications',
              icon_url: 'https://revuetech.fr/logo-revue-tech-nobg.png',
            },
            timestamp: new Date().toISOString(),
            footer: { text: `Revue Tech • ${style.label}` },
            ...(fields.length > 0 ? { fields } : {}),
            ...(imageUrl ? { thumbnail: { url: String(imageUrl) } } : {}),
          },
        ],
      }),
    });
    return true;
  } catch {
    return false;
  }
}
