// ===========================================
// Service de gestion des images (Sharp)
// ===========================================

import sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs/promises';
import { randomUUID } from 'crypto';

interface ProcessedImage {
  filename: string;
  url: string;
  thumbnail: string;
  medium: string;
  width: number;
  height: number;
  size: number;
  mimeType: string;
}

interface ImageServiceConfig {
  uploadPath: string;
  maxSizeMB: number;
  quality: number;
}

export class ImageService {
  private config: ImageServiceConfig;

  constructor(config: ImageServiceConfig) {
    this.config = config;
  }

  async ensureUploadDir(): Promise<void> {
    const dirs = [
      this.config.uploadPath,
      path.join(this.config.uploadPath, 'original'),
      path.join(this.config.uploadPath, 'thumbnail'),
      path.join(this.config.uploadPath, 'medium'),
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  async processImage(buffer: Buffer, originalFilename: string): Promise<ProcessedImage> {
    await this.ensureUploadDir();

    // Generate unique filename
    const ext = path.extname(originalFilename).toLowerCase();
    const basename = `${randomUUID()}`;
    const filename = `${basename}.webp`;

    // Get image metadata
    const metadata = await sharp(buffer).metadata();
    const width = metadata.width || 0;
    const height = metadata.height || 0;

    // Process original (convert to WebP, optimize)
    const originalPath = path.join(this.config.uploadPath, 'original', filename);
    const originalBuffer = await sharp(buffer)
      .webp({ quality: this.config.quality })
      .toBuffer();
    await fs.writeFile(originalPath, originalBuffer);

    // Generate thumbnail (300px width)
    const thumbnailPath = path.join(this.config.uploadPath, 'thumbnail', filename);
    await sharp(buffer)
      .resize(300, null, { withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(thumbnailPath);

    // Generate medium (800px width)
    const mediumPath = path.join(this.config.uploadPath, 'medium', filename);
    await sharp(buffer)
      .resize(800, null, { withoutEnlargement: true })
      .webp({ quality: 85 })
      .toFile(mediumPath);

    return {
      filename,
      url: `/uploads/original/${filename}`,
      thumbnail: `/uploads/thumbnail/${filename}`,
      medium: `/uploads/medium/${filename}`,
      width,
      height,
      size: originalBuffer.length,
      mimeType: 'image/webp',
    };
  }

  async deleteImage(filename: string): Promise<void> {
    const paths = [
      path.join(this.config.uploadPath, 'original', filename),
      path.join(this.config.uploadPath, 'thumbnail', filename),
      path.join(this.config.uploadPath, 'medium', filename),
    ];

    for (const filePath of paths) {
      try {
        await fs.unlink(filePath);
      } catch {
        // Ignore if file doesn't exist
      }
    }
  }

  validateFileType(mimetype: string): boolean {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    return allowedTypes.includes(mimetype);
  }

  validateFileSize(size: number): boolean {
    const maxBytes = this.config.maxSizeMB * 1024 * 1024;
    return size <= maxBytes;
  }
}

export const createImageService = (uploadPath: string, maxSizeMB = 5): ImageService => {
  return new ImageService({
    uploadPath,
    maxSizeMB,
    quality: 85,
  });
};
