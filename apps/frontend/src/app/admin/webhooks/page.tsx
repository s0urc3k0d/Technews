'use client';

import { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL, API_ENDPOINTS } from '@/lib/config';
import { authFetch, buildAuthHeaders } from '@/lib/auth-client';

type WebhookEvent =
  | 'article_created'
  | 'article_updated'
  | 'article_published'
  | 'rss_import'
  | 'newsletter_generated'
  | 'newsletter_sent'
  | 'short_generated'
  | 'job_failed';

interface WebhookSettings {
  enabled: boolean;
  url: string;
  events: WebhookEvent[];
}

const EVENT_LABELS: Record<WebhookEvent, string> = {
  article_created: 'Article créé',
  article_updated: 'Article mis à jour',
  article_published: 'Article publié',
  rss_import: 'Import RSS terminé',
  newsletter_generated: 'Newsletter générée',
  newsletter_sent: 'Newsletter envoyée',
  short_generated: 'Short généré',
  job_failed: 'Erreur cron/job',
};

export default function AdminWebhooksPage() {
  const [settings, setSettings] = useState<WebhookSettings>({ enabled: false, url: '', events: [] });
  const [availableEvents, setAvailableEvents] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const hasValidUrl = useMemo(() => /^https:\/\//i.test(settings.url.trim()), [settings.url]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await authFetch(`${API_BASE_URL}${API_ENDPOINTS.adminWebhooks}`);
        if (!res.ok) throw new Error('Impossible de charger la configuration webhook');
        const payload = await res.json();
        setSettings(payload.data || { enabled: false, url: '', events: [] });
        setAvailableEvents(payload.events || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur de chargement');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const toggleEvent = (event: WebhookEvent) => {
    setSettings((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`${API_BASE_URL}${API_ENDPOINTS.adminWebhooks}`, {
        method: 'PUT',
        headers: await buildAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify(settings),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || payload.message || 'Erreur de sauvegarde');
      }

      const payload = await res.json();
      setSettings(payload.data || settings);
      setSuccess('Configuration webhook sauvegardée.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    setTesting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`${API_BASE_URL}${API_ENDPOINTS.adminWebhookTest}`, {
        method: 'POST',
        headers: await buildAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || payload.message || 'Test webhook échoué');
      }

      setSuccess('Notification de test envoyée sur Discord.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur test webhook');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <div className="text-gray-500">Chargement de la configuration webhook...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Webhooks Discord</h1>
        <p className="text-gray-600 mt-1">
          Configurez votre URL webhook et choisissez précisément les événements qui déclenchent une notification.
        </p>
      </div>

      {error && <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700">{error}</div>}
      {success && <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-green-700">{success}</div>}

      <div className="bg-white rounded-xl shadow-sm p-6 space-y-5">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => setSettings((prev) => ({ ...prev, enabled: e.target.checked }))}
            className="h-4 w-4"
          />
          <span className="font-medium text-gray-900">Activer les notifications webhook</span>
        </label>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">URL Webhook Discord</label>
          <input
            type="url"
            value={settings.url}
            onChange={(e) => setSettings((prev) => ({ ...prev, url: e.target.value }))}
            placeholder="https://discord.com/api/webhooks/..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-2">
            L’URL saisie ici priorise la variable `DISCORD_WEBHOOK_URL`.
          </p>
        </div>

        <div>
          <h2 className="text-sm font-medium text-gray-700 mb-3">Événements notifiés</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {availableEvents.map((event) => (
              <label key={event} className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg">
                <input
                  type="checkbox"
                  checked={settings.events.includes(event)}
                  onChange={() => toggleEvent(event)}
                  className="h-4 w-4"
                />
                <span className="text-sm text-gray-800">{EVENT_LABELS[event] || event}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={save}
            disabled={saving || (settings.enabled && !hasValidUrl)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
          <button
            onClick={sendTest}
            disabled={testing || !settings.enabled || !hasValidUrl}
            className="px-4 py-2 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 disabled:opacity-50"
          >
            {testing ? 'Envoi test...' : 'Envoyer un test'}
          </button>
        </div>
      </div>
    </div>
  );
}
