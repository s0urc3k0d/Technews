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
  variants?: {
    webp?: string;
    avif?: string;
  };
  width: number;
  height: number;
  size: number;
  mimeType: string;
}

type OutputFormat = 'webp' | 'avif' | 'both';

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

  async processImage(buffer: Buffer, originalFilename: string, outputFormat: OutputFormat = 'webp'): Promise<ProcessedImage> {
    await this.ensureUploadDir();

    // Generate unique filename
    const basename = `${randomUUID()}`;

    const makeOriginal = async (format: 'webp' | 'avif') => {
      const filename = `${basename}.${format}`;
      const originalPath = path.join(this.config.uploadPath, 'original', filename);
      const pipeline = sharp(buffer).rotate();
      const converted = format === 'avif'
        ? await pipeline.avif({ quality: Math.max(55, this.config.quality - 10) }).toBuffer()
        : await pipeline.webp({ quality: this.config.quality }).toBuffer();

      await fs.writeFile(originalPath, converted);
      return {
        filename,
        url: `/uploads/original/${filename}`,
        size: converted.length,
        mimeType: format === 'avif' ? 'image/avif' : 'image/webp',
      };
    };

    // Get image metadata
    const metadata = await sharp(buffer).metadata();
    const width = metadata.width || 0;
    const height = metadata.height || 0;

    const shouldCreateWebp = outputFormat === 'webp' || outputFormat === 'both';
    const shouldCreateAvif = outputFormat === 'avif' || outputFormat === 'both';

    const webpOriginal = shouldCreateWebp ? await makeOriginal('webp') : null;
    const avifOriginal = shouldCreateAvif ? await makeOriginal('avif') : null;

    const primaryOriginal = webpOriginal || avifOriginal;

    if (!primaryOriginal) {
      throw new Error('No output format generated');
    }

    // Generate thumbnail (300px width)
    const thumbnailFilename = `${basename}.${outputFormat === 'avif' ? 'avif' : 'webp'}`;
    const thumbnailPath = path.join(this.config.uploadPath, 'thumbnail', thumbnailFilename);
    const thumbPipeline = sharp(buffer).rotate().resize(300, null, { withoutEnlargement: true });
    if (outputFormat === 'avif') {
      await thumbPipeline.avif({ quality: 70 }).toFile(thumbnailPath);
    } else {
      await thumbPipeline.webp({ quality: 80 }).toFile(thumbnailPath);
    }

    // Generate medium (800px width)
    const mediumFilename = `${basename}.${outputFormat === 'avif' ? 'avif' : 'webp'}`;
    const mediumPath = path.join(this.config.uploadPath, 'medium', mediumFilename);
    const mediumPipeline = sharp(buffer).rotate().resize(800, null, { withoutEnlargement: true });
    if (outputFormat === 'avif') {
      await mediumPipeline.avif({ quality: 72 }).toFile(mediumPath);
    } else {
      await mediumPipeline.webp({ quality: 85 }).toFile(mediumPath);
    }

    return {
      filename: primaryOriginal.filename,
      url: primaryOriginal.url,
      thumbnail: `/uploads/thumbnail/${thumbnailFilename}`,
      medium: `/uploads/medium/${mediumFilename}`,
      variants: {
        webp: webpOriginal?.url,
        avif: avifOriginal?.url,
      },
      width,
      height,
      size: primaryOriginal.size,
      mimeType: primaryOriginal.mimeType,
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
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];
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
