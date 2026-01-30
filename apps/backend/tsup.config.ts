import { defineConfig } from 'tsup';
import path from 'path';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  clean: true,
  // Bundle ALL dependencies except native modules
  noExternal: [/.*/],
  // Keep these as external (native binaries that can't be bundled)
  external: [
    'sharp',
    '@prisma/client',
    '.prisma/client',
  ],
  // Handle node built-ins
  platform: 'node',
  // Generate sourcemaps for debugging
  sourcemap: true,
  // Don't split chunks
  splitting: false,
  // Shims for __dirname, __filename in ESM
  shims: true,
  // Resolve workspace packages
  esbuildOptions(options) {
    options.alias = {
      '@technews/database': path.resolve(__dirname, '../../packages/database/src/index.ts'),
    };
  },
});
