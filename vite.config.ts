import { createReadStream, existsSync } from 'node:fs';
import { join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Serves avatars-private/ at /coloring/avatars/ under `npm run dev` only, so personal avatars can be
 * tried locally. They're never copied into a build, so the public site doesn't have them.
 */
function privateAvatars(): Plugin {
  const root = fileURLToPath(new URL('./avatars-private', import.meta.url));
  return {
    name: 'private-avatars',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/coloring/avatars', (req, res, next) => {
        const file = normalize(join(root, decodeURIComponent((req.url ?? '').split('?')[0])));
        if (!file.startsWith(root) || !file.endsWith('.png') || !existsSync(file)) return next();
        res.setHeader('Content-Type', 'image/png');
        createReadStream(file).pipe(res);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), privateAvatars()],
  // GitHub Pages serves the site from /choretation/; the Pages workflow sets BASE_PATH.
  base: process.env.BASE_PATH ?? '/',
});
