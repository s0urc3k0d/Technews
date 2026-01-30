import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create default categories
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { slug: 'intelligence-artificielle' },
      update: {},
      create: {
        name: 'Intelligence Artificielle',
        slug: 'intelligence-artificielle',
        description: 'Actualités sur l\'IA, le machine learning et le deep learning',
        color: '#8B5CF6',
        icon: '🤖',
        order: 1,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'developpement' },
      update: {},
      create: {
        name: 'Développement',
        slug: 'developpement',
        description: 'Langages, frameworks et outils de développement',
        color: '#10B981',
        icon: '💻',
        order: 2,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'cloud-devops' },
      update: {},
      create: {
        name: 'Cloud & DevOps',
        slug: 'cloud-devops',
        description: 'Infrastructure cloud, containerisation et CI/CD',
        color: '#3B82F6',
        icon: '☁️',
        order: 3,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'cybersecurite' },
      update: {},
      create: {
        name: 'Cybersécurité',
        slug: 'cybersecurite',
        description: 'Sécurité informatique, vulnérabilités et protection des données',
        color: '#EF4444',
        icon: '🔒',
        order: 4,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'hardware' },
      update: {},
      create: {
        name: 'Hardware',
        slug: 'hardware',
        description: 'Processeurs, cartes graphiques et matériel informatique',
        color: '#F59E0B',
        icon: '🖥️',
        order: 5,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'startups-business' },
      update: {},
      create: {
        name: 'Startups & Business',
        slug: 'startups-business',
        description: 'Levées de fonds, acquisitions et actualités business tech',
        color: '#EC4899',
        icon: '🚀',
        order: 6,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'podcast' },
      update: {},
      create: {
        name: 'Podcast',
        slug: 'podcast',
        description: 'Épisodes du podcast TechNews',
        color: '#6366F1',
        icon: '🎙️',
        order: 7,
      },
    }),
  ]);

  console.log(`✅ Created ${categories.length} categories`);

  // Create some default tags
  const tags = await Promise.all([
    prisma.tag.upsert({
      where: { slug: 'javascript' },
      update: {},
      create: { name: 'JavaScript', slug: 'javascript' },
    }),
    prisma.tag.upsert({
      where: { slug: 'typescript' },
      update: {},
      create: { name: 'TypeScript', slug: 'typescript' },
    }),
    prisma.tag.upsert({
      where: { slug: 'python' },
      update: {},
      create: { name: 'Python', slug: 'python' },
    }),
    prisma.tag.upsert({
      where: { slug: 'react' },
      update: {},
      create: { name: 'React', slug: 'react' },
    }),
    prisma.tag.upsert({
      where: { slug: 'nodejs' },
      update: {},
      create: { name: 'Node.js', slug: 'nodejs' },
    }),
    prisma.tag.upsert({
      where: { slug: 'docker' },
      update: {},
      create: { name: 'Docker', slug: 'docker' },
    }),
    prisma.tag.upsert({
      where: { slug: 'kubernetes' },
      update: {},
      create: { name: 'Kubernetes', slug: 'kubernetes' },
    }),
    prisma.tag.upsert({
      where: { slug: 'aws' },
      update: {},
      create: { name: 'AWS', slug: 'aws' },
    }),
    prisma.tag.upsert({
      where: { slug: 'openai' },
      update: {},
      create: { name: 'OpenAI', slug: 'openai' },
    }),
    prisma.tag.upsert({
      where: { slug: 'chatgpt' },
      update: {},
      create: { name: 'ChatGPT', slug: 'chatgpt' },
    }),
  ]);

  console.log(`✅ Created ${tags.length} tags`);

  // Create default spam keywords
  const spamKeywords = await Promise.all([
    prisma.spamBlocklist.upsert({
      where: { type_value: { type: 'KEYWORD', value: 'casino' } },
      update: {},
      create: { type: 'KEYWORD', value: 'casino', reason: 'Spam keyword' },
    }),
    prisma.spamBlocklist.upsert({
      where: { type_value: { type: 'KEYWORD', value: 'viagra' } },
      update: {},
      create: { type: 'KEYWORD', value: 'viagra', reason: 'Spam keyword' },
    }),
    prisma.spamBlocklist.upsert({
      where: { type_value: { type: 'KEYWORD', value: 'crypto giveaway' } },
      update: {},
      create: { type: 'KEYWORD', value: 'crypto giveaway', reason: 'Spam keyword' },
    }),
  ]);

  console.log(`✅ Created ${spamKeywords.length} spam blocklist entries`);

  console.log('🎉 Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
