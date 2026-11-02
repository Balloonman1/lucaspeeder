import { defineConfig } from 'vite';
export default defineConfig({ base: './', build: { assetsDir: 'bundle', chunkSizeWarningLimit: 1200 } });
