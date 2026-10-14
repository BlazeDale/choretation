import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves the site from /choretation/; the Pages workflow sets BASE_PATH.
  base: process.env.BASE_PATH ?? '/',
});
