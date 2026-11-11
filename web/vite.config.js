import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const here = path.dirname(fileURLToPath(import.meta.url));
const scriptsDir = path.join(here, '..', 'scripts') + path.sep;

// scripts/lib/chain.js imports near-api-js. Resolve that import from web/node_modules
// (scripts/node_modules isn't installed on Vercel). Only for files under scripts/:
// the Meteor wallet SDK needs its own nested near-api-js 6, so no global dedupe.
const scriptsUseWebNearApi = {
  name: 'scripts-use-web-near-api-js',
  enforce: 'pre',
  resolveId(source, importer, options) {
    if (source !== 'near-api-js' || !importer?.startsWith(scriptsDir)) return null;
    return this.resolve(source, path.join(here, 'src', 'main.jsx'), { ...options, skipSelf: true });
  },
};

// The web app reuses scripts/lib (classifier, attack suite, formatting, config)
// and config/seed.json from the repo root, so they stay one source of truth.
export default defineConfig({
  plugins: [scriptsUseWebNearApi, react()],
  server: { fs: { allow: [path.join(here, '..')] } },
  test: { environment: 'node', include: ['src/**/*.test.js'] },
});
