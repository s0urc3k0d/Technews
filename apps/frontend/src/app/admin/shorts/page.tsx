// ===========================================
// Admin Shorts Page
// ===========================================

'use client';

import { useState, useRef } from 'react';
import { 
  useCurrentShort, 
  useShortsPreview, 
  useShortsTags,
  useShortsBackgrounds,
  useGenerateShort,
  useUploadBackground,
  useDeleteBackground,
  getShortsVideoUrl,
  getShortsThumbnailUrl,
} from '@/hooks';
import { formatDate, cn } from '@/lib/utils';
import { Button } from '@/components';

export default function AdminShortsPage() {
  const [tab, setTab] = useState<'current' | 'backgrounds'>('current');
  const [copiedTag, setCopiedTag] = useState<'tiktok' | 'youtube' | null>(null);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">🎬 Shorts Vidéo</h1>
          <p className="text-gray-600 mt-1">Générez des vidéos courtes pour TikTok et YouTube Shorts</p>
        </div>
        <GenerateShortButton />
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setTab('current')}
          className={cn(
            'px-4 py-2 font-medium rounded-lg transition-colors',
            tab === 'current' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          )}
        >
          📹 Short du jour
        </button>
        <button
          onClick={() => setTab('backgrounds')}
          className={cn(
            'px-4 py-2 font-medium rounded-lg transition-colors',
            tab === 'backgrounds' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          )}
        >
          🖼️ Arrière-plans
        </button>
      </div>

      {/* Content */}
      {tab === 'current' ? (
        <CurrentShortSection copiedTag={copiedTag} setCopiedTag={setCopiedTag} />
      ) : (
        <BackgroundsSection />
      )}
    </div>
  );
}

// Generate Short Button
function GenerateShortButton() {
  const { mutate: generate, isPending } = useGenerateShort();
  const { data: preview } = useShortsPreview();

  const handleGenerate = () => {
    if (confirm('Générer une nouvelle vidéo short ? Cela remplacera la vidéo actuelle.')) {
      generate();
    }
  };

  return (
    <Button 
      variant="primary" 
      onClick={handleGenerate}
      isLoading={isPending}
      disabled={!preview?.canGenerate}
      title={!preview?.canGenerate ? 'Aucun article disponible pour générer une vidéo' : ''}
    >
      🎬 Générer maintenant
    </Button>
  );
}

// Current Short Section
function CurrentShortSection({ 
  copiedTag, 
  setCopiedTag 
}: { 
  copiedTag: 'tiktok' | 'youtube' | null;
  setCopiedTag: (tag: 'tiktok' | 'youtube' | null) => void;
}) {
  const { data: currentShort, isLoading } = useCurrentShort();
  const { data: tags } = useShortsTags();
  const { data: preview } = useShortsPreview();

  const copyToClipboard = async (text: string, platform: 'tiktok' | 'youtube') => {
    await navigator.clipboard.writeText(text);
    setCopiedTag(platform);
    setTimeout(() => setCopiedTag(null), 2000);
  };

  if (isLoading) {
    return <div className="text-center py-8 text-gray-500">Chargement...</div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Video Preview */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-xl font-semibold mb-4">Aperçu vidéo</h2>
        
        {currentShort ? (
          <div className="space-y-4">
            {/* Video Player */}
            <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '9/16', maxHeight: '500px' }}>
              <video 
                controls 
                className="w-full h-full object-contain"
                poster={getShortsThumbnailUrl()}
              >
                <source src={getShortsVideoUrl()} type="video/mp4" />
                Votre navigateur ne supporte pas la lecture vidéo.
              </video>
            </div>

            {/* Video Info */}
            <div className="text-sm text-gray-600 space-y-1">
              <p>📅 Généré le : {formatDate(currentShort.generatedAt)}</p>
              <p>🎞️ {currentShort.slidesCount} slides</p>
              <p>⏱️ Durée : {currentShort.duration} secondes</p>
            </div>

            {/* Download Button */}
            <a 
              href={getShortsVideoUrl()} 
              download={`revuetech-short-${new Date().toISOString().split('T')[0]}.mp4`}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              ⬇️ Télécharger la vidéo
            </a>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <span className="text-6xl mb-4">🎬</span>
            <p className="text-lg font-medium">Aucune vidéo générée</p>
            <p className="text-sm mt-1">Cliquez sur &quot;Générer maintenant&quot; pour créer une vidéo</p>
          </div>
        )}
      </div>

      {/* Tags & Articles */}
      <div className="space-y-6">
        {/* Tags Section */}
        {tags && currentShort && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">Tags pour les plateformes</h2>
            
            {/* TikTok Tags */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium flex items-center gap-2">
                  <span className="text-xl">📱</span> TikTok
                </h3>
                <span className="text-xs text-gray-500">{tags.tiktok.characterCount} caractères</span>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-sm font-mono break-all">
                {tags.tiktok.formatted}
              </div>
              <Button
                variant={copiedTag === 'tiktok' ? 'secondary' : 'outline'}
                size="sm"
                className="mt-2 w-full"
                onClick={() => copyToClipboard(tags.tiktok.formatted, 'tiktok')}
              >
                {copiedTag === 'tiktok' ? '✅ Copié !' : '📋 Copier les tags TikTok'}
              </Button>
            </div>

            {/* YouTube Tags */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium flex items-center gap-2">
                  <span className="text-xl">▶️</span> YouTube Shorts
                </h3>
                <span className="text-xs text-gray-500">{tags.youtube.characterCount} caractères</span>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-sm font-mono break-all">
                {tags.youtube.formatted}
              </div>
              <Button
                variant={copiedTag === 'youtube' ? 'secondary' : 'outline'}
                size="sm"
                className="mt-2 w-full"
                onClick={() => copyToClipboard(tags.youtube.formatted, 'youtube')}
              >
                {copiedTag === 'youtube' ? '✅ Copié !' : '📋 Copier les tags YouTube'}
              </Button>
            </div>
          </div>
        )}

        {/* Articles in video */}
        {currentShort && currentShort.articles.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">Articles inclus</h2>
            <ul className="space-y-3">
              {currentShort.articles.map((article, index) => (
                <li key={article.id} className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{article.title}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{article.summary}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Preview - articles available */}
        {preview && preview.articles.length > 0 && !currentShort && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">Articles disponibles aujourd&apos;hui</h2>
            <ul className="space-y-2">
              {preview.articles.map((article) => (
                <li key={article.id} className="flex items-center gap-2 text-sm">
                  <span className="text-blue-500">•</span>
                  <span className="text-gray-700">{article.title}</span>
                  <span className="text-gray-400 text-xs">({article.category})</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// Backgrounds Section
function BackgroundsSection() {
  const { data: backgrounds, isLoading } = useShortsBackgrounds();
  const { mutate: uploadBackground, isPending: isUploading } = useUploadBackground();
  const { mutate: deleteBackground } = useDeleteBackground();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadBackground(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = (filename: string) => {
    if (confirm(`Supprimer l'arrière-plan "${filename}" ?`)) {
      deleteBackground(filename);
    }
  };

  if (isLoading) {
    return <div className="text-center py-8 text-gray-500">Chargement...</div>;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">Arrière-plans disponibles</h2>
          <p className="text-gray-500 text-sm mt-1">
            Images utilisées comme fond pour les slides (format recommandé : 1080x1920)
          </p>
        </div>
        
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
            id="background-upload"
          />
          <Button 
            variant="primary"
            onClick={() => fileInputRef.current?.click()}
            isLoading={isUploading}
          >
            ➕ Ajouter un arrière-plan
          </Button>
        </div>
      </div>

      {backgrounds && backgrounds.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {backgrounds.map((bg) => (
            <div 
              key={bg.filename} 
              className="relative group rounded-lg overflow-hidden border border-gray-200"
              style={{ aspectRatio: '9/16' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={bg.url} 
                alt={bg.filename}
                className="w-full h-full object-cover"
              />
              
              {/* Overlay */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleDelete(bg.filename)}
                >
                  🗑️ Supprimer
                </Button>
              </div>

              {/* Filename */}
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
                <p className="text-white text-xs truncate">{bg.filename}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
          <span className="text-6xl mb-4">🖼️</span>
          <p className="text-lg font-medium">Aucun arrière-plan</p>
          <p className="text-sm mt-1">Ajoutez des images pour personnaliser vos shorts</p>
        </div>
      )}

      {/* Tips */}
      <div className="mt-6 bg-blue-50 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 mb-2">💡 Conseils</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Utilisez des images sombres ou avec un dégradé pour une meilleure lisibilité du texte</li>
          <li>• Format recommandé : 1080x1920 pixels (ratio 9:16)</li>
          <li>• Formats acceptés : JPG, PNG, WebP</li>
          <li>• Les arrière-plans sont utilisés aléatoirement pour chaque slide</li>
        </ul>
      </div>
    </div>
  );
}
