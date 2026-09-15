import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * `base` must match the GitHub Pages sub-path (`/<repo>/`) or every asset 404s once deployed.
 * It is overridable so a fork under a different repository name still builds correctly.
 */
const base = process.env.VITE_BASE ?? '/label-lens/';

export default defineConfig({
  base,
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: true },
});
