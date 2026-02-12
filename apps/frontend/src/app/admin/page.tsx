// ===========================================
// Admin Dashboard Page
// ===========================================

'use client';

import { useAdminStats, useCronLogs } from '@/hooks';
import { formatDate, formatNumber, cn } from '@/lib/utils';

export default function AdminDashboardPage() {
  const { data: stats, isLoading: statsLoading } = useAdminStats();
  const { data: cronLogs, isLoading: logsLoading } = useCronLogs({ limit: 10 });

  const articleStats = typeof stats?.articles === 'number'
    ? { total: stats.articles }
    : stats?.articles;

  const commentStats = typeof stats?.comments === 'number'
    ? { total: stats.comments, pending: stats.pendingComments ?? 0 }
    : stats?.comments;

  const subscriberStats = typeof stats?.subscribers === 'number'
    ? { active: stats.subscribers }
    : stats?.subscribers;

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
          <ActionButton href="/admin/newsletter/send" icon="📤" label="Envoyer newsletter" />
          <ActionButton href="/admin/comments?status=PENDING" icon="⏳" label="Modérer commentaires" />
          <ActionButton href="/admin/images" icon="🖼️" label="Gérer images" />
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
