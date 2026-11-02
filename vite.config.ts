import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the build works when itch.io or GitHub Pages serves it from a nested path.
  base: './',
  define: {
    BUILD_ID: JSON.stringify(process.env.GITHUB_SHA?.slice(0, 7) ?? 'dev'),
  },
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
    globals: false,
    setupFiles: ['tests/setup.ts'],
  },
});
