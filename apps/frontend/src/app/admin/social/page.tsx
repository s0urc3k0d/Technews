'use client';

import { useState, useEffect } from 'react';
import { API_BASE_URL, API_ENDPOINTS } from '@/lib/config';
import { 
  Twitter, 
  Facebook, 
  Linkedin, 
  Instagram,
  CloudIcon,
  X, 
  ExternalLink,
  ToggleLeft,
  ToggleRight,
  Trash2,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

interface SocialConnection {
  id: string;
  platform: 'TWITTER' | 'FACEBOOK' | 'LINKEDIN' | 'INSTAGRAM' | 'BLUESKY';
  accountId: string;
  accountName: string;
  accountHandle?: string;
  isActive: boolean;
  connectedAt: string;
  lastUsedAt?: string;
}

const platformInfo = {
  TWITTER: {
    name: 'Twitter / X',
    icon: Twitter,
    color: 'bg-black hover:bg-gray-800',
    description: 'Partagez vos articles sur X (anciennement Twitter)',
  },
  FACEBOOK: {
    name: 'Facebook',
    icon: Facebook,
    color: 'bg-blue-600 hover:bg-blue-700',
    description: 'Publiez sur votre page Facebook',
  },
  LINKEDIN: {
    name: 'LinkedIn',
    icon: Linkedin,
    color: 'bg-blue-700 hover:bg-blue-800',
    description: 'Partagez sur votre profil LinkedIn',
  },
  INSTAGRAM: {
    name: 'Instagram',
    icon: Instagram,
    color: 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600',
    description: 'Publiez sur Instagram (via Facebook)',
  },
  BLUESKY: {
    name: 'Bluesky',
    icon: CloudIcon,
    color: 'bg-sky-500 hover:bg-sky-600',
    description: 'Partagez sur le réseau décentralisé Bluesky',
  },
};

export default function SocialConnectionsPage() {
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [blueskyModal, setBlueskyModal] = useState(false);
  const [blueskyHandle, setBlueskyHandle] = useState('');
  const [blueskyPassword, setBlueskyPassword] = useState('');

  useEffect(() => {
    fetchConnections();
  }, []);

  const fetchConnections = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}${API_ENDPOINTS.socialConnections}`, {
        credentials: 'include',
      });
      
      if (!res.ok) throw new Error('Erreur lors du chargement des connexions');
      
      const payload = await res.json();
      setConnections(payload.connections ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (platform: string) => {
    if (platform === 'BLUESKY') {
      setBlueskyModal(true);
      return;
    }

    setConnecting(platform);
    
    try {
      const res = await fetch(`${API_BASE_URL}${API_ENDPOINTS.socialAuth(platform.toLowerCase())}`, {
        credentials: 'include',
      });
      
      if (!res.ok) throw new Error('Erreur lors de la connexion');
      
      const payload = await res.json();
      window.location.href = payload.authUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion');
      setConnecting(null);
    }
  };

  const handleBlueskyConnect = async () => {
    setConnecting('BLUESKY');
    
    try {
      const res = await fetch(`${API_BASE_URL}${API_ENDPOINTS.socialConnectBluesky}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          handle: blueskyHandle, 
          appPassword: blueskyPassword 
        }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erreur de connexion');
      }
      
      setBlueskyModal(false);
      setBlueskyHandle('');
      setBlueskyPassword('');
      fetchConnections();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion Bluesky');
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (platform: string) => {
    if (!confirm(`Voulez-vous vraiment déconnecter ${platformInfo[platform as keyof typeof platformInfo].name} ?`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}${API_ENDPOINTS.socialDisconnect(platform.toLowerCase())}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (!res.ok) throw new Error('Erreur lors de la déconnexion');
      
      setConnections(prev => prev.filter(c => c.platform !== platform));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de déconnexion');
    }
  };

  const handleToggle = async (platform: string, currentState: boolean) => {
    try {
      const res = await fetch(`${API_BASE_URL}${API_ENDPOINTS.socialToggle(platform.toLowerCase())}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive: !currentState }),
      });
      
      if (!res.ok) throw new Error('Erreur lors de la mise à jour');
      
      setConnections(prev => 
        prev.map(c => 
          c.platform === platform 
            ? { ...c, isActive: !currentState } 
            : c
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de mise à jour');
    }
  };

  const getConnection = (platform: string) => 
    connections.find(c => c.platform === platform);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-4 w-96 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="grid gap-4 mt-8">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Réseaux Sociaux
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Connectez vos comptes pour partager automatiquement vos articles lors de leur publication.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            <span className="text-red-700 dark:text-red-300">{error}</span>
            <button 
              onClick={() => setError(null)}
              className="ml-auto text-red-600 dark:text-red-400 hover:text-red-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Connections Grid */}
        <div className="space-y-4">
          {Object.entries(platformInfo).map(([platform, info]) => {
            const connection = getConnection(platform);
            const Icon = info.icon;
            const isConnecting = connecting === platform;

            return (
              <div 
                key={platform}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
              >
                <div className="flex items-center gap-4">
                  {/* Platform Icon */}
                  <div className={`w-12 h-12 rounded-full ${info.color} flex items-center justify-center text-white`}>
                    <Icon className="w-6 h-6" />
                  </div>

                  {/* Platform Info */}
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {info.name}
                    </h3>
                    {connection ? (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Connecté : <span className="font-medium">@{connection.accountHandle || connection.accountName}</span>
                      </p>
                    ) : (
                      <p className="text-sm text-gray-500 dark:text-gray-500">
                        {info.description}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3">
                    {connection ? (
                      <>
                        {/* Toggle Active */}
                        <button
                          onClick={() => handleToggle(platform, connection.isActive)}
                          className="flex items-center gap-2 text-sm"
                          title={connection.isActive ? 'Désactiver' : 'Activer'}
                        >
                          {connection.isActive ? (
                            <ToggleRight className="w-8 h-8 text-green-500" />
                          ) : (
                            <ToggleLeft className="w-8 h-8 text-gray-400" />
                          )}
                        </button>

                        {/* Status Badge */}
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          connection.isActive 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                        }`}>
                          {connection.isActive ? 'Actif' : 'Inactif'}
                        </span>

                        {/* Disconnect Button */}
                        <button
                          onClick={() => handleDisconnect(platform)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                          title="Déconnecter"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleConnect(platform)}
                        disabled={isConnecting}
                        className={`px-4 py-2 rounded-lg text-white font-medium transition-all ${info.color} ${
                          isConnecting ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        {isConnecting ? (
                          <RefreshCw className="w-5 h-5 animate-spin" />
                        ) : (
                          'Connecter'
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Connection Details */}
                {connection && (
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
                      <span>
                        Connecté le {new Date(connection.connectedAt).toLocaleDateString('fr-FR')}
                      </span>
                      {connection.lastUsedAt && (
                        <span>
                          Dernier partage : {new Date(connection.lastUsedAt).toLocaleDateString('fr-FR')}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Info Box */}
        <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-2">
            💡 Comment ça marche ?
          </h4>
          <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1">
            <li>• Connectez vos comptes réseaux sociaux via OAuth (sécurisé)</li>
            <li>• Activez le partage automatique lors de la publication d&apos;un article</li>
            <li>• Ou partagez manuellement depuis la page d&apos;édition de l&apos;article</li>
            <li>• Les hashtags sont générés automatiquement à partir des catégories</li>
          </ul>
        </div>

        {/* Bluesky Modal */}
        {blueskyModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Connexion Bluesky
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Bluesky utilise des mots de passe d&apos;application. 
                <a 
                  href="https://bsky.app/settings/app-passwords" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline ml-1"
                >
                  Créez-en un ici <ExternalLink className="w-3 h-3 inline" />
                </a>
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Handle (ex: user.bsky.social)
                  </label>
                  <input
                    type="text"
                    value={blueskyHandle}
                    onChange={(e) => setBlueskyHandle(e.target.value)}
                    placeholder="votrecompte.bsky.social"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Mot de passe d&apos;application
                  </label>
                  <input
                    type="password"
                    value={blueskyPassword}
                    onChange={(e) => setBlueskyPassword(e.target.value)}
                    placeholder="xxxx-xxxx-xxxx-xxxx"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setBlueskyModal(false);
                    setBlueskyHandle('');
                    setBlueskyPassword('');
                  }}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  onClick={handleBlueskyConnect}
                  disabled={!blueskyHandle || !blueskyPassword || connecting === 'BLUESKY'}
                  className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {connecting === 'BLUESKY' ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    'Connecter'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
