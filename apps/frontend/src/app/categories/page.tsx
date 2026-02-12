// ===========================================
// Categories List Page
// ===========================================

// Force dynamic rendering to avoid build-time API calls
export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import Link from 'next/link';
import { API_ENDPOINTS } from '@/lib/api-client';
import { Category } from '@/types';
import { API_BASE_URL, SITE_NAME } from '@/lib/config';

export const metadata: Metadata = {
  title: 'Catégories',
  description: `Toutes les catégories d'articles sur ${SITE_NAME}`,
};

async function getCategories(): Promise<Category[]> {
  try {
    const response = await fetch(
      `${API_BASE_URL}${API_ENDPOINTS.categories}`,
      { next: { revalidate: 300 } }
    );
    
    if (!response.ok) return [];
    const data = await response.json();
    return data.data;
  } catch {
    return [];
  }
}

export default async function CategoriesPage() {
  const categories = await getCategories();

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-3xl lg:text-4xl font-bold mb-4">Catégories</h1>
          <p className="text-gray-600">
            Explorez nos articles par thématique
          </p>
        </div>

        {/* Categories Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/category/${category.slug}`}
              className="group bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-200 transition-all"
            >
              <div className="flex items-start gap-4">
                {category.icon && (
                  <span className="text-4xl shrink-0">{category.icon}</span>
                )}
                <div>
                  <h2 className="font-bold text-lg text-gray-900 group-hover:text-blue-600 transition-colors">
                    {category.name}
                  </h2>
                  {category.description && (
                    <p className="text-gray-600 text-sm mt-1 line-clamp-2">
                      {category.description}
                    </p>
                  )}
                  <p className="text-blue-600 text-sm font-medium mt-3">
                    Voir les articles →
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {categories.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">Aucune catégorie disponible</p>
          </div>
        )}
      </div>
    </div>
  );
}
