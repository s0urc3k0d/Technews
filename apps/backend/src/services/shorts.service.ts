// ===========================================
// Service de génération de vidéos Shorts
// Résumés quotidiens pour TikTok/YouTube Shorts
// Utilise Sharp pour la génération d'images (pas de canvas)
// ===========================================

import { PrismaClient, ArticleStatus } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import sharp from 'sharp';

// Mistral AI client - lazy loaded to handle ESM/CJS compatibility
let mistralClient: any = null;

async function getMistralClient(apiKey: string): Promise<any> {
  if (mistralClient) return mistralClient;
  
  try {
    // Dynamic import for ESM module in CommonJS context
    const MistralModule = await import('@mistralai/mistralai');
    const MistralClass = MistralModule.default || MistralModule.Mistral || MistralModule;
    mistralClient = new MistralClass({ apiKey });
    return mistralClient;
  } catch (error) {
    console.error('Failed to load Mistral AI:', error);
    throw new Error('Mistral AI module could not be loaded');
  }
}

const execAsync = promisify(exec);

// Configuration vidéo
const VIDEO_CONFIG = {
  width: 1080,
  height: 1920,
  fps: 30,
  slideDuration: 5, // secondes par slide
  transitionDuration: 0.5, // durée du fade
  fontSize: 48,
  textColor: '#FFFFFF',
  maxCharsPerLine: 30,
};

interface ShortSlide {
  articleId: string;
  title: string;
  summary: string;
  category: string;
  imagePath: string;
}

interface GeneratedShort {
  videoPath: string;
  thumbnailPath: string;
  slides: ShortSlide[];
  duration: number;
  tagsTikTok: string[];
  tagsYouTube: string[];
  generatedAt: Date;
}

interface ShortsConfig {
  mistralApiKey: string;
  shortsDir: string;
  backgroundsDir: string;
  tempDir: string;
}

export function createShortsService(prisma: PrismaClient, config: ShortsConfig) {
  // Mistral client will be loaded lazily
  let mistralPromise: Promise<any> | null = null;

  async function getMistral(): Promise<any | null> {
    if (!config.mistralApiKey) return null;
    if (!mistralPromise) {
      mistralPromise = getMistralClient(config.mistralApiKey);
    }
    return mistralPromise;
  }

  /**
   * Récupère les articles publiés aujourd'hui
   */
  async function getTodayArticles() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return prisma.article.findMany({
      where: {
        status: ArticleStatus.PUBLISHED,
        publishedAt: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: {
        categories: {
          include: {
            category: true,
          },
        },
      },
      orderBy: {
        publishedAt: 'desc',
      },
      take: 10, // Maximum 10 articles pour une vidéo de ~50 secondes
    });
  }

  /**
   * Génère un résumé d'une phrase via Mistral
   */
  async function generateSummary(title: string, excerpt: string): Promise<string> {
    const mistral = await getMistral();
    if (!mistral) {
      // Fallback si pas de Mistral : utiliser le titre
      return title.length > 80 ? title.substring(0, 77) + '...' : title;
    }

    try {
      const response = await mistral.chat.complete({
        model: 'mistral-small-latest',
        messages: [
          {
            role: 'system',
            content: `Tu es un rédacteur de news tech. Génère UN SEUL résumé percutant et accrocheur de maximum 15 mots.
Le résumé doit être informatif, engageant et donner envie d'en savoir plus.
Ne mets pas de guillemets, pas de point final, pas de préfixe comme "Résumé:".
Réponds UNIQUEMENT avec la phrase résumé, rien d'autre.`,
          },
          {
            role: 'user',
            content: `Titre: ${title}\nExtrait: ${excerpt}`,
          },
        ],
        maxTokens: 50,
        temperature: 0.7,
      });

      const summary = response.choices?.[0]?.message?.content?.trim() || title;
      return summary.replace(/^["']|["']$/g, '').replace(/\.$/, '');
    } catch (error) {
      console.error('Erreur Mistral summary:', error);
      return title.length > 80 ? title.substring(0, 77) + '...' : title;
    }
  }

  /**
   * Récupère une image de fond aléatoire
   */
  async function getRandomBackground(): Promise<string | null> {
    try {
      await fs.mkdir(config.backgroundsDir, { recursive: true });
      const files = await fs.readdir(config.backgroundsDir);
      const images = files.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
      
      if (images.length === 0) {
        return null; // Pas d'image, on utilisera un fond gradient
      }
      
      const randomImage = images[Math.floor(Math.random() * images.length)];
      if (!randomImage) {
        return null;
      }
      return path.join(config.backgroundsDir, randomImage);
    } catch (error) {
      console.error('Erreur récupération background:', error);
      return null;
    }
  }

  /**
   * Crée une image de fond gradient par défaut avec Sharp
   */
  async function createGradientBackground(): Promise<Buffer> {
    // Créer un gradient SVG
    const svg = `
      <svg width="${VIDEO_CONFIG.width}" height="${VIDEO_CONFIG.height}">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#0f172a;stop-opacity:1" />
            <stop offset="50%" style="stop-color:#1e3a5f;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#0f172a;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grad)"/>
        <circle cx="200" cy="400" r="150" fill="#3b82f6" opacity="0.1"/>
        <circle cx="880" cy="800" r="200" fill="#3b82f6" opacity="0.1"/>
        <circle cx="540" cy="1400" r="180" fill="#3b82f6" opacity="0.1"/>
      </svg>
    `;

    return Buffer.from(svg);
  }

  /**
   * Découpe le texte en lignes pour l'affichage SVG
   */
  function wrapText(text: string, maxChars: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      
      if (testLine.length > maxChars && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines;
  }

  /**
   * Échappe les caractères spéciaux pour SVG
   */
  function escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Crée une image slide avec le texte superposé en utilisant Sharp
   */
  async function createSlideImage(
    backgroundPath: string | null,
    summary: string,
    category: string,
    slideNumber: number,
    totalSlides: number
  ): Promise<string> {
    // Préparer le texte
    const lines = wrapText(summary, VIDEO_CONFIG.maxCharsPerLine);
    const lineHeight = VIDEO_CONFIG.fontSize * 1.4;
    const totalTextHeight = lines.length * lineHeight;
    const startY = (VIDEO_CONFIG.height - totalTextHeight) / 2;

    // Générer les lignes de texte SVG
    const textLines = lines.map((line, index) => {
      const y = startY + index * lineHeight;
      const escapedLine = escapeXml(line);
      return `
        <text x="${VIDEO_CONFIG.width / 2}" y="${y}" 
              text-anchor="middle" dominant-baseline="middle"
              font-family="Arial, sans-serif" font-size="${VIDEO_CONFIG.fontSize}" font-weight="bold"
              fill="black" opacity="0.8">
          ${escapedLine}
        </text>
        <text x="${VIDEO_CONFIG.width / 2 - 2}" y="${y - 2}" 
              text-anchor="middle" dominant-baseline="middle"
              font-family="Arial, sans-serif" font-size="${VIDEO_CONFIG.fontSize}" font-weight="bold"
              fill="${VIDEO_CONFIG.textColor}">
          ${escapedLine}
        </text>
      `;
    }).join('\n');

    // Générer les points de progression
    const dotRadius = 8;
    const dotSpacing = 30;
    const dotsWidth = (totalSlides - 1) * dotSpacing;
    const dotsStartX = (VIDEO_CONFIG.width - dotsWidth) / 2;
    const dotsY = VIDEO_CONFIG.height - 150;

    const dots = Array.from({ length: totalSlides }, (_, i) => {
      const fill = i === slideNumber ? '#3b82f6' : 'rgba(255, 255, 255, 0.5)';
      return `<circle cx="${dotsStartX + i * dotSpacing}" cy="${dotsY}" r="${dotRadius}" fill="${fill}"/>`;
    }).join('\n');

    // Créer le SVG overlay
    const overlaySvg = `
      <svg width="${VIDEO_CONFIG.width}" height="${VIDEO_CONFIG.height}">
        <!-- Overlay semi-transparent -->
        <rect width="100%" height="100%" fill="black" opacity="0.5"/>
        
        <!-- Badge catégorie -->
        <rect x="${VIDEO_CONFIG.width / 2 - 100}" y="115" width="200" height="50" rx="10" fill="#3b82f6"/>
        <text x="${VIDEO_CONFIG.width / 2}" y="145" 
              text-anchor="middle" dominant-baseline="middle"
              font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="white">
          #${escapeXml(category.toUpperCase())}
        </text>
        
        <!-- Texte principal -->
        ${textLines}
        
        <!-- Points de progression -->
        ${dots}
        
        <!-- Watermark -->
        <text x="${VIDEO_CONFIG.width / 2}" y="${VIDEO_CONFIG.height - 80}" 
              text-anchor="middle" font-family="Arial, sans-serif" 
              font-size="28" font-weight="bold" fill="white" opacity="0.7">
          RevueTech.fr
        </text>
      </svg>
    `;

    let baseImage: sharp.Sharp;

    if (backgroundPath) {
      // Charger et redimensionner l'image de fond
      try {
        baseImage = sharp(backgroundPath)
          .resize(VIDEO_CONFIG.width, VIDEO_CONFIG.height, {
            fit: 'cover',
            position: 'center',
          });
      } catch {
        // Fallback au gradient
        const gradientBuffer = await createGradientBackground();
        baseImage = sharp(gradientBuffer)
          .resize(VIDEO_CONFIG.width, VIDEO_CONFIG.height);
      }
    } else {
      // Utiliser le gradient par défaut
      const gradientBuffer = await createGradientBackground();
      baseImage = sharp(gradientBuffer)
        .resize(VIDEO_CONFIG.width, VIDEO_CONFIG.height);
    }

    // Composer l'image finale
    const slidePath = path.join(config.tempDir, `slide_${slideNumber.toString().padStart(3, '0')}.png`);
    
    await baseImage
      .composite([
        {
          input: Buffer.from(overlaySvg),
          top: 0,
          left: 0,
        },
      ])
      .png()
      .toFile(slidePath);

    return slidePath;
  }

  /**
   * Assemble les images en vidéo avec FFmpeg
   */
  async function assembleVideo(slidePaths: string[], outputPath: string): Promise<void> {
    // Créer le fichier de liste pour FFmpeg
    const listPath = path.join(config.tempDir, 'slides.txt');
    const listContent = slidePaths
      .map(p => `file '${p}'\nduration ${VIDEO_CONFIG.slideDuration}`)
      .join('\n');
    // Ajouter la dernière image sans durée (requis par FFmpeg)
    const fullContent = listContent + `\nfile '${slidePaths[slidePaths.length - 1]}'`;
    await fs.writeFile(listPath, fullContent);

    // Commande FFmpeg pour créer la vidéo avec fade entre les slides
    const ffmpegCmd = `ffmpeg -y -f concat -safe 0 -i "${listPath}" \
      -vf "fps=${VIDEO_CONFIG.fps},format=yuv420p" \
      -c:v libx264 -preset medium -crf 23 \
      -movflags +faststart \
      "${outputPath}"`;

    try {
      await execAsync(ffmpegCmd);
    } catch (error) {
      console.error('Erreur FFmpeg:', error);
      throw new Error('Échec de la création de la vidéo');
    }
  }

  /**
   * Génère la miniature (première slide)
   */
  async function generateThumbnail(firstSlidePath: string, outputPath: string): Promise<void> {
    await fs.copyFile(firstSlidePath, outputPath);
  }

  /**
   * Génère les tags optimisés pour TikTok
   */
  function generateTikTokTags(categories: string[]): string[] {
    const baseTags = [
      'tech', 'technews', 'actualitetech', 'innovation',
      'fyp', 'pourtoi', 'foryou', 'viral', 'trending',
      'revuetech', 'techfrancaise', 'apprendretiktok'
    ];

    const categoryTags: Record<string, string[]> = {
      ia: ['intelligenceartificielle', 'ia', 'ai', 'chatgpt', 'machinelearning'],
      securite: ['cybersecurite', 'hacking', 'securite', 'privacy'],
      mobile: ['smartphone', 'android', 'iphone', 'mobile', 'apps'],
      gaming: ['gaming', 'jeuxvideo', 'gamer', 'esport'],
      hardware: ['hardware', 'pc', 'composants', 'gpu', 'processeur'],
      cloud: ['cloud', 'devops', 'aws', 'azure', 'serveur'],
      blockchain: ['crypto', 'blockchain', 'bitcoin', 'nft', 'web3'],
      business: ['startup', 'business', 'entrepreneur', 'techindustry'],
      science: ['science', 'espace', 'nasa', 'futur', 'decouverte'],
      logiciels: ['software', 'apps', 'logiciel', 'coding', 'dev'],
    };

    const allTags = [...baseTags];
    categories.forEach(cat => {
      const catKey = cat.toLowerCase();
      if (categoryTags[catKey]) {
        allTags.push(...categoryTags[catKey]);
      }
    });

    // Dédupliquer et limiter
    return [...new Set(allTags)].slice(0, 20);
  }

  /**
   * Génère les tags optimisés pour YouTube Shorts
   */
  function generateYouTubeTags(categories: string[]): string[] {
    const baseTags = [
      'tech news', 'actualité tech', 'technologie', 'innovation',
      'revue tech', 'news du jour', 'shorts', 'tech française',
      'résumé tech', 'actualités', 'high tech', 'nouvelles technologies'
    ];

    const categoryTags: Record<string, string[]> = {
      ia: ['intelligence artificielle', 'IA', 'ChatGPT', 'machine learning', 'deep learning'],
      securite: ['cybersécurité', 'sécurité informatique', 'hacking éthique', 'vie privée'],
      mobile: ['smartphone', 'Android', 'iPhone', 'applications mobiles'],
      gaming: ['jeux vidéo', 'gaming', 'esport', 'console'],
      hardware: ['hardware', 'PC gaming', 'composants PC', 'GPU', 'processeur'],
      cloud: ['cloud computing', 'DevOps', 'serveur', 'hébergement'],
      blockchain: ['cryptomonnaie', 'blockchain', 'Bitcoin', 'NFT', 'Web3'],
      business: ['startup', 'tech business', 'entreprise tech'],
      science: ['science', 'espace', 'NASA', 'découverte scientifique'],
      logiciels: ['logiciel', 'application', 'software', 'développement'],
    };

    const allTags = [...baseTags];
    categories.forEach(cat => {
      const catKey = cat.toLowerCase();
      if (categoryTags[catKey]) {
        allTags.push(...categoryTags[catKey]);
      }
    });

    return [...new Set(allTags)].slice(0, 30);
  }

  /**
   * Nettoie les anciens fichiers
   */
  async function cleanupOldFiles(): Promise<void> {
    try {
      // Supprimer les fichiers temporaires
      const tempFiles = await fs.readdir(config.tempDir).catch(() => []);
      for (const file of tempFiles) {
        await fs.unlink(path.join(config.tempDir, file)).catch(() => {});
      }

      // Supprimer l'ancienne vidéo
      const videoPath = path.join(config.shortsDir, 'current.mp4');
      await fs.unlink(videoPath).catch(() => {});

      // Supprimer l'ancienne miniature
      const thumbPath = path.join(config.shortsDir, 'thumbnail.png');
      await fs.unlink(thumbPath).catch(() => {});
    } catch (error) {
      console.error('Erreur cleanup:', error);
    }
  }

  /**
   * Génère le short quotidien
   */
  async function generateDailyShort(): Promise<GeneratedShort | null> {
    // Créer les dossiers si nécessaire
    await fs.mkdir(config.shortsDir, { recursive: true });
    await fs.mkdir(config.backgroundsDir, { recursive: true });
    await fs.mkdir(config.tempDir, { recursive: true });

    // Récupérer les articles du jour
    const articles = await getTodayArticles();
    
    if (articles.length === 0) {
      console.log('Aucun article publié aujourd\'hui, pas de short généré');
      return null;
    }

    console.log(`Génération du short avec ${articles.length} articles...`);

    // Nettoyer les anciens fichiers
    await cleanupOldFiles();

    // Générer les slides
    const slides: ShortSlide[] = [];
    const slidePaths: string[] = [];
    const categories: string[] = [];

    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];
      if (!article) continue;
      
      const summary = await generateSummary(article.title, article.excerpt || '');
      const backgroundPath = await getRandomBackground();
      const category = article.categories?.[0]?.category?.name || 'Tech';
      
      if (!categories.includes(category)) {
        categories.push(category);
      }

      const slidePath = await createSlideImage(
        backgroundPath,
        summary,
        category,
        i,
        articles.length
      );

      slides.push({
        articleId: article.id,
        title: article.title,
        summary,
        category,
        imagePath: slidePath,
      });

      slidePaths.push(slidePath);
      console.log(`Slide ${i + 1}/${articles.length} créée: ${summary}`);
    }

    // Assembler la vidéo
    const videoPath = path.join(config.shortsDir, 'current.mp4');
    await assembleVideo(slidePaths, videoPath);
    console.log('Vidéo assemblée avec succès');

    // Générer la miniature
    const thumbnailPath = path.join(config.shortsDir, 'thumbnail.png');
    const firstSlide = slidePaths[0];
    if (firstSlide) {
      await generateThumbnail(firstSlide, thumbnailPath);
    }

    // Générer les tags
    const tagsTikTok = generateTikTokTags(categories);
    const tagsYouTube = generateYouTubeTags(categories);

    // Calculer la durée
    const duration = articles.length * VIDEO_CONFIG.slideDuration;

    // Sauvegarder les métadonnées
    const metadata: GeneratedShort = {
      videoPath,
      thumbnailPath,
      slides,
      duration,
      tagsTikTok,
      tagsYouTube,
      generatedAt: new Date(),
    };

    const metadataPath = path.join(config.shortsDir, 'metadata.json');
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    // Nettoyer les fichiers temporaires
    for (const slidePath of slidePaths) {
      await fs.unlink(slidePath).catch(() => {});
    }
    await fs.unlink(path.join(config.tempDir, 'slides.txt')).catch(() => {});

    console.log('Short quotidien généré avec succès!');
    return metadata;
  }

  /**
   * Récupère les métadonnées du short actuel
   */
  async function getCurrentShort(): Promise<GeneratedShort | null> {
    try {
      const metadataPath = path.join(config.shortsDir, 'metadata.json');
      const content = await fs.readFile(metadataPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Vérifie si un short existe
   */
  async function shortExists(): Promise<boolean> {
    try {
      const videoPath = path.join(config.shortsDir, 'current.mp4');
      await fs.access(videoPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Récupère le chemin de la vidéo
   */
  function getVideoPath(): string {
    return path.join(config.shortsDir, 'current.mp4');
  }

  /**
   * Récupère le chemin de la miniature
   */
  function getThumbnailPath(): string {
    return path.join(config.shortsDir, 'thumbnail.png');
  }

  /**
   * Liste les backgrounds disponibles
   */
  async function listBackgrounds(): Promise<string[]> {
    try {
      await fs.mkdir(config.backgroundsDir, { recursive: true });
      const files = await fs.readdir(config.backgroundsDir);
      return files.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f) && !f.startsWith('_'));
    } catch {
      return [];
    }
  }

  /**
   * Ajoute une image de fond
   */
  async function addBackground(filename: string, buffer: Buffer): Promise<void> {
    await fs.mkdir(config.backgroundsDir, { recursive: true });
    const filePath = path.join(config.backgroundsDir, filename);
    await fs.writeFile(filePath, buffer);
  }

  /**
   * Supprime une image de fond
   */
  async function removeBackground(filename: string): Promise<void> {
    const filePath = path.join(config.backgroundsDir, filename);
    await fs.unlink(filePath);
  }

  return {
    generateDailyShort,
    getCurrentShort,
    shortExists,
    getVideoPath,
    getThumbnailPath,
    listBackgrounds,
    addBackground,
    removeBackground,
    getTodayArticles,
  };
}

export type ShortsService = ReturnType<typeof createShortsService>;
