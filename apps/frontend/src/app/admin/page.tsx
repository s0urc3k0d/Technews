// ===========================================
// Admin Dashboard Page
// ===========================================

'use client';

import { useAdminStats, useAutoPublishStatus, useCronLogs, useRunAutoPublish } from '@/hooks';
import { formatDate, formatNumber, cn } from '@/lib/utils';

export default function AdminDashboardPage() {
  const { data: stats, isLoading: statsLoading } = useAdminStats();
  const { data: cronLogs, isLoading: logsLoading } = useCronLogs({ limit: 10 });
  const { data: autoPublishStatusData, isLoading: autoPublishStatusLoading } = useAutoPublishStatus();
  const autoPublishMutation = useRunAutoPublish();

  const articleStats = typeof stats?.articles === 'number'
    ? { total: stats.articles }
    : stats?.articles;

  const commentStats = typeof stats?.comments === 'number'
    ? { total: stats.comments, pending: stats.pendingComments ?? 0 }
    : stats?.comments;

  const subscriberStats = typeof stats?.subscribers === 'number'
    ? { active: stats.subscribers }
    : stats?.subscribers;

  const latestAutoPublishLog = cronLogs?.data?.find((log) =>
    log.jobName === 'auto-publish' || log.jobName === 'auto-publish-manual'
  );
  const autoPublishStatus = autoPublishStatusData?.data;

  const handleRunAutoPublish = async (dryRun: boolean) => {
    try {
      await autoPublishMutation.mutateAsync({ dryRun });
    } catch {
      // handled by mutation state in UI
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Vue d'ensemble de votre site</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Articles"
          value={articleStats?.total ?? stats?.articlesDetail?.total ?? 0}
          icon="📰"
          loading={statsLoading}
        />
        <StatCard
          title="Commentaires"
          value={commentStats?.total ?? stats?.commentsDetail?.total ?? 0}
          icon="💬"
          loading={statsLoading}
        />
        <StatCard
          title="Abonnés"
          value={subscriberStats?.active ?? stats?.subscribersDetail?.active ?? 0}
          icon="📬"
          loading={statsLoading}
        />
        <StatCard
          title="Vues (30j)"
          value={stats?.topArticles?.reduce((acc, article) => acc + (article.viewCount || 0), 0) ?? 0}
          icon="👁️"
          loading={statsLoading}
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl p-6 shadow-sm mb-8">
        <h2 className="text-lg font-semibold mb-4">Actions rapides</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ActionButton href="/admin/articles/new" icon="✍️" label="Nouvel article" />
          <ActionButton href="/admin/newsletter" icon="📤" label="Envoyer newsletter" />
          <ActionButton href="/admin/comments?status=PENDING" icon="⏳" label="Modérer commentaires" />
          <ActionButton href="/admin/images" icon="🖼️" label="Gérer images" />
        </div>
      </div>

      {/* Auto Publish IA */}
      <div className="bg-white rounded-xl p-6 shadow-sm mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Auto-publication IA</h2>
            <p className="text-sm text-gray-600 mt-1">
              Lance un run manuel pour tester ou publier immédiatement un draft RSS éligible.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleRunAutoPublish(true)}
              disabled={autoPublishMutation.isPending}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Dry run
            </button>
            <button
              onClick={() => handleRunAutoPublish(false)}
              disabled={autoPublishMutation.isPending}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Publier maintenant
            </button>
          </div>
        </div>

        <div className="mt-4 text-sm">
          <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-gray-700">
            {autoPublishStatusLoading ? (
              <p>Chargement de la configuration auto-publish...</p>
            ) : autoPublishStatus ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <p>
                  <span className="font-medium">Auto-publish:</span>{' '}
                  <span className={autoPublishStatus.enabled ? 'text-green-700 font-medium' : 'text-gray-600 font-medium'}>
                    {autoPublishStatus.enabled ? 'ACTIVÉ' : 'DÉSACTIVÉ'}
                  </span>
                </p>
                <p>
                  <span className="font-medium">Mode:</span>{' '}
                  {autoPublishStatus.dryRun ? 'Dry run' : 'Publication réelle'}
                </p>
                <p>
                  <span className="font-medium">Fenêtre drafts:</span> {autoPublishStatus.lookbackHours}h
                </p>
                <p>
                  <span className="font-medium">Cadence:</span> {autoPublishStatus.intervalMinMinutes}-{autoPublishStatus.intervalMaxMinutes} min
                </p>
                <p>
                  <span className="font-medium">Mistral:</span>{' '}
                  <span className={autoPublishStatus.mistralConfigured ? 'text-green-700' : 'text-red-700'}>
                    {autoPublishStatus.mistralConfigured ? 'configuré' : 'non configuré'}
                  </span>
                </p>
                <p>
                  <span className="font-medium">Prochaine exécution autorisée:</span>{' '}
                  {autoPublishStatus.cooldownUntil
                    ? formatDate(autoPublishStatus.cooldownUntil, { hour: '2-digit', minute: '2-digit' })
                    : 'immédiate'}
                </p>
              </div>
            ) : (
              <p>Configuration auto-publish indisponible.</p>
            )}
          </div>

          {autoPublishMutation.isSuccess && (
            <p className="text-green-700">Run auto-publish exécuté avec succès.</p>
          )}
          {autoPublishMutation.isError && (
            <p className="text-red-700">Échec du run auto-publish.</p>
          )}
          {latestAutoPublishLog ? (
            <p className="text-gray-600">
              Dernier run: <span className="font-medium">{latestAutoPublishLog.jobName}</span> •{' '}
              <span
                className={cn(
                  'font-medium',
                  latestAutoPublishLog.status === 'SUCCESS' && 'text-green-700',
                  latestAutoPublishLog.status === 'FAILED' && 'text-red-700',
                  latestAutoPublishLog.status === 'RUNNING' && 'text-amber-700'
                )}
              >
                {latestAutoPublishLog.status}
              </span>{' '}
              • {formatDate(latestAutoPublishLog.startedAt, { hour: '2-digit', minute: '2-digit' })}
            </p>
          ) : (
            <p className="text-gray-500">Aucun run auto-publish détecté pour le moment.</p>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Cron Jobs */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Tâches automatiques</h2>
          {logsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {cronLogs?.data?.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-sm">{log.jobName}</p>
                    <p className="text-xs text-gray-500">
                      {formatDate(log.startedAt, { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className={cn(
                    'px-2 py-1 text-xs font-medium rounded',
                    log.status === 'SUCCESS' ? 'bg-green-100 text-green-800' :
                    log.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  )}>
                    {log.status}
                  </span>
                </div>
              ))}
              {(!cronLogs?.data || cronLogs.data.length === 0) && (
                <p className="text-gray-500 text-center py-4">Aucune tâche récente</p>
              )}
            </div>
          )}
        </div>

        {/* Pending Comments */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Commentaires en attente</h2>
          <div className="text-center py-8 text-gray-500">
            <span className="text-4xl mb-2 block">💬</span>
            <p>{commentStats?.pending ?? stats?.commentsDetail?.pending ?? 0} commentaire(s) en attente</p>
            {(commentStats?.pending ?? stats?.commentsDetail?.pending ?? 0) > 0 && (
              <a href="/admin/comments?status=PENDING" className="text-blue-600 hover:underline mt-2 inline-block">
                Voir les commentaires →
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({ 
  title, 
  value, 
  icon, 
  loading 
}: { 
  title: string; 
  value: number; 
  icon: string; 
  loading: boolean;
}) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <span className="text-2xl">{icon}</span>
      </div>
      {loading ? (
        <div className="h-8 bg-gray-200 rounded animate-pulse w-20" />
      ) : (
        <p className="text-3xl font-bold text-gray-900">{formatNumber(value)}</p>
      )}
      <p className="text-gray-500 text-sm mt-1">{title}</p>
    </div>
  );
}

// Action Button Component
function ActionButton({ 
  href, 
  icon, 
  label 
}: { 
  href: string; 
  icon: string; 
  label: string;
}) {
  return (
    <a
      href={href}
      className="flex flex-col items-center gap-2 p-4 bg-gray-50 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors"
    >
      <span className="text-2xl">{icon}</span>
      <span className="text-sm font-medium text-center">{label}</span>
    </a>
  );
}
