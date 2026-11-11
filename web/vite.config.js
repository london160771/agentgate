import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const here = path.dirname(fileURLToPath(import.meta.url));

// The web app reuses scripts/lib (classifier, attack suite, formatting, config)
// and config/seed.json from the repo root, so they stay one source of truth.
export default defineConfig({
  plugins: [react()],
  resolve: {
    // scripts/lib/chain.js imports near-api-js; always resolve it from web/node_modules.
    dedupe: ['near-api-js'],
  },
  server: { fs: { allow: [path.join(here, '..')] } },
  test: { environment: 'node', include: ['src/**/*.test.js'] },
});
