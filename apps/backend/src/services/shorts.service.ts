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
let mistralLoadAttempted = false;
let mistralLoadError: Error | null = null;

async function getMistralClient(apiKey: string): Promise<any | null> {
  if (mistralClient) return mistralClient;
  if (mistralLoadAttempted && mistralLoadError) return null;
  
  mistralLoadAttempted = true;
  
  try {
    // Dynamic import for ESM module in CommonJS context
    // Use Function constructor to prevent tsup from transforming this import
    const dynamicImport = new Function('specifier', 'return import(specifier)');
    const MistralModule = await dynamicImport('@mistralai/mistralai');
    const MistralClass = MistralModule.default || MistralModule.Mistral || MistralModule;
    mistralClient = new MistralClass({ apiKey });
    console.log('✅ Mistral AI client loaded successfully');
    return mistralClient;
  } catch (error) {
    mistralLoadError = error as Error;
    console.warn('⚠️ Mistral AI not available, using fallback summaries:', (error as Error).message);
    return null;
  }
}

const execAsync = promisify(exec);

// Configuration vidéo
const VIDEO_CONFIG = {
  width: 1080,
  height: 1920,
  fps: 30,
  slideDuration: 6, // secondes par slide
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

function formatShortDate(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${day}/${month}`;
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
      return title.trim();
    }

    try {
      const payload = {
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
      };

      let response: any;

      if (typeof mistral?.chat?.complete === 'function') {
        response = await mistral.chat.complete(payload);
      } else if (typeof mistral?.chat?.completions?.create === 'function') {
        response = await mistral.chat.completions.create(payload);
      } else {
        const httpResponse = await fetch('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.mistralApiKey}`,
          },
          body: JSON.stringify(payload),
        });

        if (!httpResponse.ok) {
          throw new Error(`Mistral API error: ${httpResponse.status}`);
        }

        response = await httpResponse.json();
      }

      const summary = response?.choices?.[0]?.message?.content?.trim() || title;
      return summary.replace(/^["']|["']$/g, '').replace(/\.$/, '');
    } catch (error) {
      console.error('Erreur Mistral summary:', error);
      return title.trim();
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
   * Nettoie le texte pour un rendu SVG fiable
   */
  function sanitizeSummaryForSlide(summary: string, fallbackTitle: string): string {
    const source = (summary || '').trim();
    const fallback = (fallbackTitle || '').trim();

    const cleaned = source
      .replace(/https?:\/\/\S+/gi, ' ')
      .replace(/[#*_`~\[\](){}<>|]/g, ' ')
      .replace(/[\u{1F300}-\u{1FAFF}]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const candidate = cleaned.length >= 8 ? cleaned : fallback;
    return candidate;
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
    const textPanelTop = Math.max(220, startY - 90);
    const textPanelHeight = Math.min(980, totalTextHeight + 180);

    const rawCategory = category
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
    const safeCategory = rawCategory.length > 24 ? `${rawCategory.slice(0, 21)}...` : rawCategory;
    const categoryLabel = `#${safeCategory}`;
    const categoryFontSize = 28;
    const categoryPaddingX = 44;
    const estimatedCharWidth = 15;
    const categoryBadgeWidth = Math.min(
      VIDEO_CONFIG.width - 120,
      Math.max(220, categoryLabel.length * estimatedCharWidth + categoryPaddingX)
    );
    const categoryBadgeX = (VIDEO_CONFIG.width - categoryBadgeWidth) / 2;

    // Générer les lignes de texte SVG
    const textLines = lines.map((line, index) => {
      const y = startY + index * lineHeight;
      const escapedLine = escapeXml(line);
      return `
        <text x="${VIDEO_CONFIG.width / 2}" y="${y}" 
              text-anchor="middle" dominant-baseline="middle"
              font-family="Noto Sans, DejaVu Sans, Arial, Helvetica, sans-serif" font-size="${VIDEO_CONFIG.fontSize}" font-weight="700"
              fill="${VIDEO_CONFIG.textColor}" stroke="rgba(0,0,0,0.75)" stroke-width="6" paint-order="stroke fill"
              letter-spacing="0.2">
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
        <rect width="100%" height="100%" fill="black" opacity="0.45"/>
        
        <!-- Badge catégorie -->
        <rect x="${categoryBadgeX}" y="115" width="${categoryBadgeWidth}" height="50" rx="10" fill="#3b82f6"/>
        <text x="${VIDEO_CONFIG.width / 2}" y="145" 
              text-anchor="middle" dominant-baseline="middle"
              font-family="Noto Sans, DejaVu Sans, Arial, Helvetica, sans-serif" font-size="${categoryFontSize}" font-weight="700" fill="white">
          ${escapeXml(categoryLabel)}
        </text>

          <!-- Panneau contraste pour le texte -->
          <rect x="80" y="${textPanelTop}" width="920" height="${textPanelHeight}" rx="28" fill="rgba(10, 17, 32, 0.52)"/>
        
        <!-- Texte principal -->
        ${textLines}
        
        <!-- Points de progression -->
        ${dots}
        
        <!-- Watermark -->
        <text x="${VIDEO_CONFIG.width / 2}" y="${VIDEO_CONFIG.height - 80}" 
              text-anchor="middle" font-family="Noto Sans, DejaVu Sans, Arial, Helvetica, sans-serif" 
              font-size="28" font-weight="700" fill="white" opacity="0.7">
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
   * Crée une slide spéciale d'intro ou de fin
   */
  async function createSpecialSlideImage(
    type: 'intro' | 'outro',
    dateLabel: string,
    slideNumber: number,
    totalSlides: number
  ): Promise<string> {
    const dotRadius = 8;
    const dotSpacing = 30;
    const dotsWidth = (totalSlides - 1) * dotSpacing;
    const dotsStartX = (VIDEO_CONFIG.width - dotsWidth) / 2;
    const dotsY = VIDEO_CONFIG.height - 150;

    const dots = Array.from({ length: totalSlides }, (_, i) => {
      const fill = i === slideNumber ? '#3b82f6' : 'rgba(255, 255, 255, 0.5)';
      return `<circle cx="${dotsStartX + i * dotSpacing}" cy="${dotsY}" r="${dotRadius}" fill="${fill}"/>`;
    }).join('\n');

    const isIntro = type === 'intro';
    const badgeText = isIntro ? `NEWS DU ${dateLabel}` : 'REVUE TECH';
    const mainText = isIntro ? 'Les actus tech essentielles du jour' : 'Plus d\'infos sur revuetech.fr';
    const subText = isIntro ? 'Swipe pour le résumé du jour' : 'Retrouve tous les articles sur le site';

    const overlaySvg = `
      <svg width="${VIDEO_CONFIG.width}" height="${VIDEO_CONFIG.height}">
        <rect width="100%" height="100%" fill="black" opacity="0.42"/>

        <rect x="250" y="320" width="580" height="70" rx="14" fill="#3b82f6"/>
        <text x="${VIDEO_CONFIG.width / 2}" y="365"
              text-anchor="middle" dominant-baseline="middle"
              font-family="Noto Sans, DejaVu Sans, Arial, Helvetica, sans-serif" font-size="34" font-weight="800" fill="white">
          ${escapeXml(badgeText)}
        </text>

        <rect x="90" y="730" width="900" height="390" rx="30" fill="rgba(10, 17, 32, 0.55)"/>
        <text x="${VIDEO_CONFIG.width / 2}" y="860"
              text-anchor="middle"
              font-family="Noto Sans, DejaVu Sans, Arial, Helvetica, sans-serif" font-size="62" font-weight="800"
              fill="white" stroke="rgba(0,0,0,0.75)" stroke-width="6" paint-order="stroke fill">
          ${isIntro ? 'RevueTech' : 'Merci de suivre'}
        </text>
        <text x="${VIDEO_CONFIG.width / 2}" y="960"
              text-anchor="middle"
              font-family="Noto Sans, DejaVu Sans, Arial, Helvetica, sans-serif" font-size="42" font-weight="700"
              fill="white">
          ${escapeXml(mainText)}
        </text>
        <text x="${VIDEO_CONFIG.width / 2}" y="1035"
              text-anchor="middle"
              font-family="Noto Sans, DejaVu Sans, Arial, Helvetica, sans-serif" font-size="34" font-weight="600"
              fill="rgba(255,255,255,0.9)">
          ${escapeXml(subText)}
        </text>

        ${dots}

        <text x="${VIDEO_CONFIG.width / 2}" y="${VIDEO_CONFIG.height - 80}"
              text-anchor="middle" font-family="Noto Sans, DejaVu Sans, Arial, Helvetica, sans-serif"
              font-size="28" font-weight="700" fill="white" opacity="0.7">
          RevueTech.fr
        </text>
      </svg>
    `;

    const gradientBuffer = await createGradientBackground();
    const slidePath = path.join(config.tempDir, `${type}_slide.png`);

    await sharp(gradientBuffer)
      .resize(VIDEO_CONFIG.width, VIDEO_CONFIG.height)
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
    const inputArgs = slidePaths
      .map(slidePath => `-loop 1 -t ${VIDEO_CONFIG.slideDuration} -i "${slidePath}"`)
      .join(' ');

    const preprocessed = slidePaths.map((_, index) => {
      return `[${index}:v]scale=${VIDEO_CONFIG.width}:${VIDEO_CONFIG.height},fps=${VIDEO_CONFIG.fps},format=yuv420p,setsar=1[v${index}]`;
    }).join(';');

    let transitionChain = '';
    if (slidePaths.length === 1) {
      transitionChain = '[v0]format=yuv420p[vout]';
    } else {
      let currentLabel = 'v0';
      for (let i = 1; i < slidePaths.length; i++) {
        const offset = i * (VIDEO_CONFIG.slideDuration - VIDEO_CONFIG.transitionDuration);
        const outputLabel = i === slidePaths.length - 1 ? 'vout' : `vx${i}`;
        transitionChain += `[${currentLabel}][v${i}]xfade=transition=fade:duration=${VIDEO_CONFIG.transitionDuration}:offset=${offset}[${outputLabel}];`;
        currentLabel = outputLabel;
      }
      transitionChain = transitionChain.slice(0, -1);
    }

    const filterComplex = `${preprocessed};${transitionChain}`;

    const ffmpegCmd = `ffmpeg -y ${inputArgs} -filter_complex "${filterComplex}" -map "[vout]" -c:v libx264 -preset medium -crf 23 -movflags +faststart "${outputPath}"`;

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
    const articleSlidePaths: string[] = [];
    const allSlidePaths: string[] = [];
    const categories: string[] = [];
    const totalSlides = articles.length + 2;
    const dateLabel = formatShortDate(new Date());

    const introSlidePath = await createSpecialSlideImage('intro', dateLabel, 0, totalSlides);
    allSlidePaths.push(introSlidePath);

    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];
      if (!article) continue;
      
      const rawSummary = await generateSummary(article.title, article.excerpt || '');
      const summary = sanitizeSummaryForSlide(rawSummary, article.title);
      const backgroundPath = await getRandomBackground();
      const category = article.categories?.[0]?.category?.name || 'Tech';
      
      if (!categories.includes(category)) {
        categories.push(category);
      }

      const slidePath = await createSlideImage(
        backgroundPath,
        summary,
        category,
        i + 1,
        totalSlides
      );

      slides.push({
        articleId: article.id,
        title: article.title,
        summary,
        category,
        imagePath: slidePath,
      });

      articleSlidePaths.push(slidePath);
      allSlidePaths.push(slidePath);
      console.log(`Slide ${i + 1}/${articles.length} créée: ${summary}`);
    }

    const outroSlidePath = await createSpecialSlideImage('outro', dateLabel, totalSlides - 1, totalSlides);
    allSlidePaths.push(outroSlidePath);

    // Assembler la vidéo
    const videoPath = path.join(config.shortsDir, 'current.mp4');
    await assembleVideo(allSlidePaths, videoPath);
    console.log('Vidéo assemblée avec succès');

    // Générer la miniature
    const thumbnailPath = path.join(config.shortsDir, 'thumbnail.png');
    const firstSlide = articleSlidePaths[0] || allSlidePaths[0];
    if (firstSlide) {
      await generateThumbnail(firstSlide, thumbnailPath);
    }

    // Générer les tags
    const tagsTikTok = generateTikTokTags(categories);
    const tagsYouTube = generateYouTubeTags(categories);

    // Calculer la durée
    const duration =
      allSlidePaths.length * VIDEO_CONFIG.slideDuration -
      Math.max(0, allSlidePaths.length - 1) * VIDEO_CONFIG.transitionDuration;

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
    for (const slidePath of allSlidePaths) {
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
