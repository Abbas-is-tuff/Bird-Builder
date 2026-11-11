import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Source entry is dev.html. `npm run build` makes ONE self-contained file and copies it to
// ./index.html, which GitHub Pages serves straight from the main branch.
// `npm run build:multi` -> normal multi-file build (dist/), for app packaging later.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'single' ? [viteSingleFile()] : [],
  build: {
    rollupOptions: { input: 'dev.html' },
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    chunkSizeWarningLimit: 2000,
  },
  server: { host: true },
}));
