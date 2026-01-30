// ===========================================
// Service Anti-Spam pour les commentaires
// ===========================================

import { PrismaClient, SpamBlockType } from '@technews/database';

interface SpamCheckResult {
  isSpam: boolean;
  reason?: string;
}

interface SpamServiceConfig {
  maxLinksAllowed: number;
  maxCommentsPerMinute: number;
  suspiciousPatterns: RegExp[];
}

export class SpamService {
  private prisma: PrismaClient;
  private config: SpamServiceConfig;
  private recentComments: Map<string, number[]> = new Map();

  constructor(prisma: PrismaClient, config?: Partial<SpamServiceConfig>) {
    this.prisma = prisma;
    this.config = {
      maxLinksAllowed: 2,
      maxCommentsPerMinute: 3,
      suspiciousPatterns: [
        /\b(viagra|cialis|casino|lottery|prize|winner|congratulations|click here|act now)\b/i,
        /\b(buy now|limited time|free money|make money fast)\b/i,
        /\b(bitcoin|crypto|investment opportunity)\b/i,
        /(http[s]?:\/\/[^\s]+){3,}/i, // More than 2 URLs
      ],
      ...config,
    };
  }

  async checkSpam(
    content: string,
    email: string,
    ip: string,
    honeypot?: string
  ): Promise<SpamCheckResult> {
    // 1. Honeypot check (should be empty)
    if (honeypot && honeypot.length > 0) {
      return { isSpam: true, reason: 'Bot detected (honeypot)' };
    }

    // 2. Rate limiting check
    const rateLimited = this.checkRateLimit(ip);
    if (rateLimited) {
      return { isSpam: true, reason: 'Too many comments in short time' };
    }

    // 3. Blocklist check (email)
    const emailBlocked = await this.isBlocked('EMAIL', email);
    if (emailBlocked) {
      return { isSpam: true, reason: 'Email is blocked' };
    }

    // 4. Blocklist check (IP)
    const ipBlocked = await this.isBlocked('IP', ip);
    if (ipBlocked) {
      return { isSpam: true, reason: 'IP is blocked' };
    }

    // 5. Blocklist check (domain)
    const domain = email.split('@')[1];
    if (domain) {
      const domainBlocked = await this.isBlocked('DOMAIN', domain);
      if (domainBlocked) {
        return { isSpam: true, reason: 'Email domain is blocked' };
      }
    }

    // 6. Keyword blocklist check
    const keywordBlocked = await this.checkKeywords(content);
    if (keywordBlocked) {
      return { isSpam: true, reason: 'Contains blocked keywords' };
    }

    // 7. Suspicious patterns check
    for (const pattern of this.config.suspiciousPatterns) {
      if (pattern.test(content)) {
        return { isSpam: true, reason: 'Suspicious content pattern detected' };
      }
    }

    // 8. Link count check
    const linkCount = (content.match(/https?:\/\//gi) || []).length;
    if (linkCount > this.config.maxLinksAllowed) {
      return { isSpam: true, reason: 'Too many links' };
    }

    return { isSpam: false };
  }

  private checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute
    const timestamps = this.recentComments.get(ip) || [];

    // Clean old timestamps
    const recentTimestamps = timestamps.filter(t => now - t < windowMs);
    
    if (recentTimestamps.length >= this.config.maxCommentsPerMinute) {
      return true;
    }

    // Add current timestamp
    recentTimestamps.push(now);
    this.recentComments.set(ip, recentTimestamps);

    // Cleanup old entries periodically
    if (this.recentComments.size > 10000) {
      this.cleanupRateLimitCache();
    }

    return false;
  }

  private cleanupRateLimitCache(): void {
    const now = Date.now();
    const windowMs = 60 * 1000;

    for (const [ip, timestamps] of this.recentComments.entries()) {
      const recent = timestamps.filter(t => now - t < windowMs);
      if (recent.length === 0) {
        this.recentComments.delete(ip);
      } else {
        this.recentComments.set(ip, recent);
      }
    }
  }

  private async isBlocked(type: SpamBlockType, value: string): Promise<boolean> {
    const entry = await this.prisma.spamBlocklist.findUnique({
      where: { type_value: { type, value: value.toLowerCase() } },
    });
    return !!entry;
  }

  private async checkKeywords(content: string): Promise<boolean> {
    const keywords = await this.prisma.spamBlocklist.findMany({
      where: { type: 'KEYWORD' },
      select: { value: true },
    });

    const lowerContent = content.toLowerCase();
    return keywords.some(k => lowerContent.includes(k.value.toLowerCase()));
  }

  async addToBlocklist(
    type: SpamBlockType,
    value: string,
    reason?: string
  ): Promise<void> {
    await this.prisma.spamBlocklist.upsert({
      where: { type_value: { type, value: value.toLowerCase() } },
      update: { reason },
      create: { type, value: value.toLowerCase(), reason },
    });
  }

  async removeFromBlocklist(type: SpamBlockType, value: string): Promise<void> {
    await this.prisma.spamBlocklist.delete({
      where: { type_value: { type, value: value.toLowerCase() } },
    }).catch(() => {});
  }
}

export const createSpamService = (prisma: PrismaClient): SpamService => {
  return new SpamService(prisma);
};
