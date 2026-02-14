'use client';

import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL, API_ENDPOINTS } from '@/lib/config';
import { authFetch } from '@/lib/auth-client';
import { 
  Twitter, 
  Facebook, 
  Linkedin, 
  Instagram,
  CloudIcon,
  Check, 
  X, 
  Clock,
  ExternalLink,
  Send,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

interface SocialShare {
  id: string;
  platform: 'TWITTER' | 'FACEBOOK' | 'LINKEDIN' | 'INSTAGRAM' | 'BLUESKY';
  status: 'PENDING' | 'PUBLISHED' | 'FAILED' | 'SKIPPED';
  postUrl?: string;
  postId?: string;
  errorMessage?: string;
  sharedAt?: string;
  createdAt: string;
}

interface SocialConnection {
  platform: 'TWITTER' | 'FACEBOOK' | 'LINKEDIN' | 'INSTAGRAM' | 'BLUESKY';
  isActive: boolean;
}

interface ArticleSocialPanelProps {
  articleId: string;
  shareOnPublish: boolean;
  onShareOnPublishChange: (value: boolean) => void;
}

const platformInfo = {
  TWITTER: { name: 'Twitter', icon: Twitter, color: 'text-black' },
  FACEBOOK: { name: 'Facebook', icon: Facebook, color: 'text-blue-600' },
  LINKEDIN: { name: 'LinkedIn', icon: Linkedin, color: 'text-blue-700' },
  INSTAGRAM: { name: 'Instagram', icon: Instagram, color: 'text-pink-600' },
  BLUESKY: { name: 'Bluesky', icon: CloudIcon, color: 'text-sky-500' },
};

const statusInfo = {
  PENDING: { label: 'En attente', icon: Clock, color: 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' },
  PUBLISHED: { label: 'Publié', icon: Check, color: 'text-green-500 bg-green-50 dark:bg-green-900/20' },
  FAILED: { label: 'Échec', icon: X, color: 'text-red-500 bg-red-50 dark:bg-red-900/20' },
  SKIPPED: { label: 'Ignoré', icon: AlertCircle, color: 'text-gray-500 bg-gray-50 dark:bg-gray-900/20' },
};

export default function ArticleSocialPanel({ 
  articleId, 
  shareOnPublish, 
  onShareOnPublishChange 
}: ArticleSocialPanelProps) {
  const [shares, setShares] = useState<SocialShare[]>([]);
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [sharesRes, connectionsRes] = await Promise.all([
        authFetch(`${API_BASE_URL}${API_ENDPOINTS.socialSharesByArticle(articleId)}`),
        authFetch(`${API_BASE_URL}${API_ENDPOINTS.socialConnections}`),
      ]);

      if (sharesRes.ok) {
        const sharesData = await sharesRes.json();
        setShares(sharesData);
      }

      if (connectionsRes.ok) {
        const connectionsData = await connectionsRes.json();
        setConnections(connectionsData.connections ?? []);
      }
    } catch (err) {
      console.error('Error fetching social data:', err);
    } finally {
      setLoading(false);
    }
  }, [articleId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleShare = async (platform?: string) => {
    setSharing(platform || 'all');
    setError(null);

    try {
      const url = platform 
        ? `${API_BASE_URL}${API_ENDPOINTS.socialShareArticle(articleId)}?platform=${platform}`
        : `${API_BASE_URL}${API_ENDPOINTS.socialShareArticle(articleId)}`;
      
      const res = await authFetch(url, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erreur lors du partage');
      }

      await res.json(); // Consume response
      fetchData(); // Refresh shares list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de partage');
    } finally {
      setSharing(null);
    }
  };

  const activeConnections = connections.filter(c => c.isActive);
  const hasConnections = activeConnections.length > 0;

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
      <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
        <Send className="w-4 h-4" />
        Partage Réseaux Sociaux
      </h3>

      {/* Share on Publish Toggle */}
      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
        <div>
          <p className="font-medium text-gray-900 dark:text-white text-sm">
            Partager à la publication
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Publier automatiquement sur les réseaux connectés
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={shareOnPublish}
            onChange={(e) => onShareOnPublishChange(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
        </label>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Connected Platforms */}
      {hasConnections ? (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Plateformes connectées
          </p>
          <div className="flex flex-wrap gap-2">
            {activeConnections.map(conn => {
              const info = platformInfo[conn.platform];
              const Icon = info.icon;
              const share = shares.find(s => s.platform === conn.platform);
              const isSharing = sharing === conn.platform.toLowerCase();

              return (
                <button
                  key={conn.platform}
                  onClick={() => handleShare(conn.platform.toLowerCase())}
                  disabled={isSharing || sharing === 'all'}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                    share?.status === 'PUBLISHED'
                      ? 'border-green-300 bg-green-50 dark:bg-green-900/20'
                      : share?.status === 'FAILED'
                      ? 'border-red-300 bg-red-50 dark:bg-red-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  title={share?.status === 'PUBLISHED' ? 'Déjà partagé' : 'Cliquez pour partager'}
                >
                  {isSharing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Icon className={`w-4 h-4 ${info.color}`} />
                  )}
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {info.name}
                  </span>
                  {share?.status === 'PUBLISHED' && (
                    <Check className="w-3 h-3 text-green-500" />
                  )}
                  {share?.status === 'FAILED' && (
                    <X className="w-3 h-3 text-red-500" />
                  )}
                </button>
              );
            })}
          </div>
          
          {/* Share All Button */}
          <button
            onClick={() => handleShare()}
            disabled={sharing !== null}
            className="w-full mt-2 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {sharing === 'all' ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Partage en cours...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Partager sur tous les réseaux
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            Aucun réseau social connecté
          </p>
          <a
            href="/admin/social"
            className="text-blue-600 hover:text-blue-700 text-sm font-medium inline-flex items-center gap-1"
          >
            Configurer les réseaux
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {/* Share History */}
      {shares.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Historique des partages
          </p>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {shares.map(share => {
              const platform = platformInfo[share.platform];
              const status = statusInfo[share.status];
              const PlatformIcon = platform.icon;
              const StatusIcon = status.icon;

              return (
                <div 
                  key={share.id}
                  className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50"
                >
                  <PlatformIcon className={`w-4 h-4 ${platform.color}`} />
                  <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">
                    {platform.name}
                  </span>
                  <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${status.color}`}>
                    <StatusIcon className="w-3 h-3" />
                    {status.label}
                  </span>
                  {share.postUrl && (
                    <a
                      href={share.postUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
