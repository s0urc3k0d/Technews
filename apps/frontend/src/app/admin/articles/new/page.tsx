// ===========================================
// Page Administration - Création/Édition d'Article
// ===========================================

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';

// Import dynamique de l'éditeur WYSIWYG (SSR disabled)
const WysiwygEditor = dynamic(() => import('@/components/admin/WysiwygEditor'), {
  ssr: false,
  loading: () => (
    <div className="border border-gray-300 rounded-lg p-4 min-h-[400px] bg-gray-50 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
    </div>
  ),
});

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Tag {
  id: string;
  name: string;
  slug: string;
}

interface ArticleFormData {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
  categoryId: string;
  tagIds: string[];
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  publishedAt: string;
  metaTitle: string;
  metaDescription: string;
}

const initialFormData: ArticleFormData = {
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  coverImage: '',
  categoryId: '',
  tagIds: [],
  status: 'DRAFT',
  publishedAt: '',
  metaTitle: '',
  metaDescription: '',
};

export default function ArticleEditorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('id');
  const isEditing = !!editId;

  const [formData, setFormData] = useState<ArticleFormData>(initialFormData);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Charger les catégories et tags au montage
  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const [catRes, tagRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/categories`),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/tags`),
        ]);

        if (catRes.ok) {
          const catData = await catRes.json();
          setCategories(catData.categories || catData);
        }

        if (tagRes.ok) {
          const tagData = await tagRes.json();
          setTags(tagData.tags || tagData);
        }
      } catch (err) {
        console.error('Erreur lors du chargement des métadonnées:', err);
      }
    };

    fetchMeta();
  }, []);

  // Charger l'article si en mode édition
  useEffect(() => {
    if (editId) {
      const fetchArticle = async () => {
        setIsLoading(true);
        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/articles/${editId}`);
          if (res.ok) {
            const article = await res.json();
            setFormData({
              title: article.title || '',
              slug: article.slug || '',
              excerpt: article.excerpt || '',
              content: article.content || '',
              coverImage: article.coverImage || '',
              categoryId: article.categoryId || '',
              tagIds: article.tags?.map((t: Tag) => t.id) || [],
              status: article.status || 'DRAFT',
              publishedAt: article.publishedAt ? new Date(article.publishedAt).toISOString().slice(0, 16) : '',
              metaTitle: article.metaTitle || '',
              metaDescription: article.metaDescription || '',
            });
          } else {
            setError('Article non trouvé');
          }
        } catch (err) {
          setError('Erreur lors du chargement de l\'article');
          console.error(err);
        } finally {
          setIsLoading(false);
        }
      };

      fetchArticle();
    }
  }, [editId]);

  // Générer le slug à partir du titre
  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value;
    setFormData(prev => ({
      ...prev,
      title,
      slug: prev.slug || generateSlug(title),
    }));
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleTagToggle = (tagId: string) => {
    setFormData(prev => ({
      ...prev,
      tagIds: prev.tagIds.includes(tagId)
        ? prev.tagIds.filter(id => id !== tagId)
        : [...prev.tagIds, tagId],
    }));
  };

  const handleContentChange = (content: string) => {
    setFormData(prev => ({ ...prev, content }));
  };

  const handleSubmit = async (e: React.FormEvent, status?: 'DRAFT' | 'PUBLISHED') => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    const dataToSubmit = {
      ...formData,
      status: status || formData.status,
      publishedAt: status === 'PUBLISHED' && !formData.publishedAt 
        ? new Date().toISOString() 
        : formData.publishedAt || null,
    };

    try {
      const url = isEditing
        ? `${process.env.NEXT_PUBLIC_API_URL}/articles/${editId}`
        : `${process.env.NEXT_PUBLIC_API_URL}/articles`;

      const res = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(dataToSubmit),
      });

      if (res.ok) {
        const savedArticle = await res.json();
        setSuccessMessage(isEditing ? 'Article mis à jour !' : 'Article créé !');
        
        if (!isEditing) {
          // Rediriger vers l'édition de l'article créé
          router.push(`/admin/articles/new?id=${savedArticle.id}`);
        }
      } else {
        const errorData = await res.json();
        setError(errorData.message || 'Erreur lors de la sauvegarde');
      }
    } catch (err) {
      setError('Erreur réseau lors de la sauvegarde');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {isEditing ? 'Modifier l\'article' : 'Nouvel article'}
            </h1>
            <p className="text-gray-600 mt-1">
              {isEditing ? 'Modifiez les informations de l\'article' : 'Créez un nouvel article pour le blog'}
            </p>
          </div>
          <button
            onClick={() => router.push('/admin/articles')}
            className="px-4 py-2 text-gray-600 hover:text-gray-900"
          >
            ← Retour à la liste
          </button>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            {successMessage}
          </div>
        )}

        <form onSubmit={(e) => handleSubmit(e)}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Colonne principale */}
            <div className="lg:col-span-2 space-y-6">
              {/* Titre */}
              <div className="bg-white rounded-lg shadow p-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Titre de l&apos;article *
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleTitleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                  placeholder="Un titre accrocheur pour votre article"
                />
              </div>

              {/* Slug */}
              <div className="bg-white rounded-lg shadow p-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Slug (URL)
                </label>
                <div className="flex items-center">
                  <span className="text-gray-500 mr-2">revuetech.fr/article/</span>
                  <input
                    type="text"
                    name="slug"
                    value={formData.slug}
                    onChange={handleChange}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="mon-super-article"
                  />
                </div>
              </div>

              {/* Extrait */}
              <div className="bg-white rounded-lg shadow p-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Extrait / Chapeau
                </label>
                <textarea
                  name="excerpt"
                  value={formData.excerpt}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Un court résumé de l'article (affiché dans les listes et les partages)"
                />
                <p className="text-sm text-gray-500 mt-2">
                  {formData.excerpt.length}/300 caractères recommandés
                </p>
              </div>

              {/* Contenu WYSIWYG */}
              <div className="bg-white rounded-lg shadow p-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contenu de l&apos;article *
                </label>
                <WysiwygEditor
                  content={formData.content}
                  onChange={handleContentChange}
                  placeholder="Rédigez votre article ici..."
                />
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Actions */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Publication</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Statut
                    </label>
                    <select
                      name="status"
                      value={formData.status}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="DRAFT">Brouillon</option>
                      <option value="PUBLISHED">Publié</option>
                      <option value="ARCHIVED">Archivé</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date de publication
                    </label>
                    <input
                      type="datetime-local"
                      name="publishedAt"
                      value={formData.publishedAt}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex gap-2 pt-4">
                    <button
                      type="button"
                      onClick={(e) => handleSubmit(e, 'DRAFT')}
                      disabled={isSaving}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                      {isSaving ? '...' : 'Brouillon'}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleSubmit(e, 'PUBLISHED')}
                      disabled={isSaving}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isSaving ? '...' : 'Publier'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Image de couverture */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Image de couverture</h3>
                <input
                  type="url"
                  name="coverImage"
                  value={formData.coverImage}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 mb-3"
                  placeholder="https://exemple.com/image.jpg"
                />
                {formData.coverImage && (
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-100">
                    <img
                      src={formData.coverImage}
                      alt="Aperçu"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/placeholder-image.jpg';
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Catégorie */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Catégorie</h3>
                <select
                  name="categoryId"
                  value={formData.categoryId}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Sélectionner une catégorie</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tags */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {tags.map(tag => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => handleTagToggle(tag.id)}
                      className={`px-3 py-1 rounded-full text-sm transition-colors ${
                        formData.tagIds.includes(tag.id)
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
                {tags.length === 0 && (
                  <p className="text-gray-500 text-sm">Aucun tag disponible</p>
                )}
              </div>

              {/* SEO */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-semibold text-gray-900 mb-4">SEO</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Meta Title
                    </label>
                    <input
                      type="text"
                      name="metaTitle"
                      value={formData.metaTitle}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder={formData.title || 'Titre pour les moteurs de recherche'}
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      {(formData.metaTitle || formData.title).length}/60 caractères
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Meta Description
                    </label>
                    <textarea
                      name="metaDescription"
                      value={formData.metaDescription}
                      onChange={handleChange}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder={formData.excerpt || 'Description pour les moteurs de recherche'}
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      {(formData.metaDescription || formData.excerpt).length}/160 caractères
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
