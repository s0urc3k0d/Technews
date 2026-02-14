// ===========================================
// Admin Images Page
// ===========================================

'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { useUploadImage, useImages, useDeleteImage } from '@/hooks';
import { Button, Pagination } from '@/components';

export default function AdminImagesPage() {
  const [page, setPage] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useImages({ page, limit: 24 });
  const { mutate: uploadImage, isPending: isUploading } = useUploadImage();
  const { mutate: deleteImage } = useDeleteImage();

  const images = data?.data ?? [];
  const pagination = data?.pagination;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      Array.from(files).forEach(file => {
        uploadImage({ file });
      });
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const getImageName = (url: string) => {
    const parts = url.split('/');
    return parts[parts.length - 1] || 'image';
  };

  const handleDelete = (id: string, imageName: string) => {
    if (confirm(`Supprimer "${imageName}" ?`)) {
      deleteImage(id);
    }
  };

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    alert('URL copiée !');
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Images</h1>
          <p className="text-gray-600 mt-1">
            {pagination?.total ?? 0} image(s) au total
          </p>
        </div>
        
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button 
            variant="primary"
            onClick={() => fileInputRef.current?.click()}
            isLoading={isUploading}
          >
            📤 Uploader des images
          </Button>
        </div>
      </div>

      {/* Upload Zone */}
      <div 
        className="bg-white rounded-xl p-8 shadow-sm mb-8 border-2 border-dashed border-gray-300 text-center cursor-pointer hover:border-blue-500 transition-colors"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const files = e.dataTransfer.files;
          if (files && files.length > 0) {
            Array.from(files).forEach(file => {
              if (file.type.startsWith('image/')) {
                uploadImage({ file });
              }
            });
          }
        }}
      >
        <span className="text-4xl mb-4 block">🖼️</span>
        <p className="text-gray-600">
          Glissez-déposez des images ici ou cliquez pour sélectionner
        </p>
        <p className="text-sm text-gray-400 mt-2">
          Formats acceptés: JPG, PNG, GIF, WebP (max 10MB)
        </p>
      </div>

      {/* Images Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-square bg-gray-200 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : images.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          Aucune image uploadée
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {images.map((image) => (
            <div 
              key={image.id} 
              className="group relative aspect-square bg-gray-100 rounded-lg overflow-hidden"
            >
              {(() => {
                const imageName = getImageName(image.url);
                return (
                  <>
              <Image
                src={image.url}
                alt={imageName}
                fill
                className="object-cover"
              />
              
              {/* Overlay */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                <p className="text-white text-xs text-center truncate w-full">
                  {imageName}
                </p>
                <div className="flex gap-2">
                  <Button 
                    variant="secondary" 
                    size="sm"
                    onClick={() => copyToClipboard(image.url)}
                  >
                    📋
                  </Button>
                  <Button 
                    variant="danger" 
                    size="sm"
                    onClick={() => handleDelete(image.id, imageName)}
                  >
                    🗑️
                  </Button>
                </div>
              </div>
                  </>
                );
              })()}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-8">
          <Pagination
            currentPage={page}
            totalPages={pagination.totalPages}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
