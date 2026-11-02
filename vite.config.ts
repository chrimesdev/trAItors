import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the build works when itch.io serves it from a nested path.
  base: './',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 2000,
  },
  server: {
    port: 5173,
    open: false,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
