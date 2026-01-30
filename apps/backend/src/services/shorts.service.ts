// ===========================================
// Service de génération de vidéos Shorts
// Résumés quotidiens pour TikTok/YouTube Shorts
// ===========================================

import { PrismaClient, ArticleStatus } from '@technews/database';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import Mistral from '@mistralai/mistralai';

// Import canvas dynamiquement pour éviter les erreurs de type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let createCanvas: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let loadImage: any;

// Charger canvas de manière asynchrone
async function loadCanvasModule() {
  if (!createCanvas) {
    const canvas = await import('canvas');
    createCanvas = canvas.createCanvas;
    loadImage = canvas.loadImage;
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
  fontFamily: 'Arial',
  textColor: '#FFFFFF',
  textShadow: true,
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
  const mistral = config.mistralApiKey ? new Mistral(config.mistralApiKey) : null;

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
    if (!mistral) {
      // Fallback si pas de Mistral : utiliser le titre
      return title.length > 80 ? title.substring(0, 77) + '...' : title;
    }

    try {
      const response = await mistral.chat({
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
  async function getRandomBackground(): Promise<string> {
    try {
      await fs.mkdir(config.backgroundsDir, { recursive: true });
      const files = await fs.readdir(config.backgroundsDir);
      const images = files.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
      
      if (images.length === 0) {
        // Créer une image de fond par défaut si aucune n'existe
        return await createDefaultBackground();
      }
      
      const randomImage = images[Math.floor(Math.random() * images.length)];
      if (!randomImage) {
        return await createDefaultBackground();
      }
      return path.join(config.backgroundsDir, randomImage);
    } catch (error) {
      console.error('Erreur récupération background:', error);
      return await createDefaultBackground();
    }
  }

  /**
   * Crée une image de fond par défaut (gradient)
   */
  async function createDefaultBackground(): Promise<string> {
    await loadCanvasModule();
    const canvas = createCanvas(VIDEO_CONFIG.width, VIDEO_CONFIG.height);
    const ctx = canvas.getContext('2d');

    // Gradient bleu tech
    const gradient = ctx.createLinearGradient(0, 0, VIDEO_CONFIG.width, VIDEO_CONFIG.height);
    gradient.addColorStop(0, '#0f172a');
    gradient.addColorStop(0.5, '#1e3a5f');
    gradient.addColorStop(1, '#0f172a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, VIDEO_CONFIG.width, VIDEO_CONFIG.height);

    // Ajouter des cercles décoratifs
    ctx.globalAlpha = 0.1;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(
        Math.random() * VIDEO_CONFIG.width,
        Math.random() * VIDEO_CONFIG.height,
        Math.random() * 300 + 100,
        0,
        Math.PI * 2
      );
      ctx.fillStyle = '#3b82f6';
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const defaultBgPath = path.join(config.backgroundsDir, '_default.png');
    await fs.mkdir(config.backgroundsDir, { recursive: true });
    const buffer = canvas.toBuffer('image/png');
    await fs.writeFile(defaultBgPath, buffer);
    
    return defaultBgPath;
  }

  /**
   * Découpe le texte en lignes pour l'affichage
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function wrapText(ctx: any, text: string, maxWidth: number): string[] {
    if (!ctx) return [text];
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);
      
      if (metrics.width > maxWidth && currentLine) {
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
   * Crée une image slide avec le texte superposé
   */
  async function createSlideImage(
    backgroundPath: string,
    summary: string,
    category: string,
    slideNumber: number,
    totalSlides: number
  ): Promise<string> {
    await loadCanvasModule();
    const canvas = createCanvas(VIDEO_CONFIG.width, VIDEO_CONFIG.height);
    const ctx = canvas.getContext('2d');

    // Charger et dessiner le fond
    try {
      const background = await loadImage(backgroundPath);
      // Couvrir tout le canvas en gardant le ratio
      const scale = Math.max(
        VIDEO_CONFIG.width / background.width,
        VIDEO_CONFIG.height / background.height
      );
      const x = (VIDEO_CONFIG.width - background.width * scale) / 2;
      const y = (VIDEO_CONFIG.height - background.height * scale) / 2;
      ctx.drawImage(background, x, y, background.width * scale, background.height * scale);
    } catch {
      // Fallback : fond gradient
      const gradient = ctx.createLinearGradient(0, 0, VIDEO_CONFIG.width, VIDEO_CONFIG.height);
      gradient.addColorStop(0, '#0f172a');
      gradient.addColorStop(1, '#1e3a5f');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, VIDEO_CONFIG.width, VIDEO_CONFIG.height);
    }

    // Overlay semi-transparent pour lisibilité
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, VIDEO_CONFIG.width, VIDEO_CONFIG.height);

    // Badge catégorie en haut
    ctx.font = `bold 32px ${VIDEO_CONFIG.fontFamily}`;
    const categoryText = `#${category.toUpperCase()}`;
    const categoryMetrics = ctx.measureText(categoryText);
    const categoryPadding = 20;
    const categoryX = (VIDEO_CONFIG.width - categoryMetrics.width) / 2 - categoryPadding;
    const categoryY = 150;

    // Fond du badge
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.roundRect(
      categoryX,
      categoryY - 35,
      categoryMetrics.width + categoryPadding * 2,
      50,
      10
    );
    ctx.fill();

    // Texte catégorie
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(categoryText, categoryX + categoryPadding, categoryY);

    // Texte principal centré
    ctx.font = `bold ${VIDEO_CONFIG.fontSize}px ${VIDEO_CONFIG.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const maxTextWidth = VIDEO_CONFIG.width - 120;
    const lines = wrapText(ctx, summary, maxTextWidth);
    const lineHeight = VIDEO_CONFIG.fontSize * 1.4;
    const totalTextHeight = lines.length * lineHeight;
    const startY = (VIDEO_CONFIG.height - totalTextHeight) / 2;

    lines.forEach((line, index) => {
      const y = startY + index * lineHeight;
      
      // Ombre du texte
      if (VIDEO_CONFIG.textShadow) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillText(line, VIDEO_CONFIG.width / 2 + 3, y + 3);
      }
      
      // Texte principal
      ctx.fillStyle = VIDEO_CONFIG.textColor;
      ctx.fillText(line, VIDEO_CONFIG.width / 2, y);
    });

    // Indicateur de progression en bas
    const dotRadius = 8;
    const dotSpacing = 30;
    const dotsWidth = (totalSlides - 1) * dotSpacing;
    const dotsStartX = (VIDEO_CONFIG.width - dotsWidth) / 2;
    const dotsY = VIDEO_CONFIG.height - 150;

    for (let i = 0; i < totalSlides; i++) {
      ctx.beginPath();
      ctx.arc(dotsStartX + i * dotSpacing, dotsY, dotRadius, 0, Math.PI * 2);
      ctx.fillStyle = i === slideNumber ? '#3b82f6' : 'rgba(255, 255, 255, 0.5)';
      ctx.fill();
    }

    // Logo/Watermark
    ctx.font = `bold 28px ${VIDEO_CONFIG.fontFamily}`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.textAlign = 'center';
    ctx.fillText('RevueTech.fr', VIDEO_CONFIG.width / 2, VIDEO_CONFIG.height - 80);

    // Sauvegarder l'image
    const slidePath = path.join(config.tempDir, `slide_${slideNumber.toString().padStart(3, '0')}.png`);
    const buffer = canvas.toBuffer('image/png');
    await fs.writeFile(slidePath, buffer);

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
