// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  integrations: [react()],
  // Pages start loading as soon as a link is hovered or touched, so moving between them feels instant.
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  vite: {
    plugins: [tailwindcss()],
    // three.js is one large chunk; it only loads with the 3D islands.
    build: { chunkSizeWarningLimit: 900 },
  },
});
