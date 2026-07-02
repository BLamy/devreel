/// <reference types="vitest/config" />
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { almostnodePlugin } from 'almostnode/vite';
import path from 'node:path';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
const streamPromisesStub = fileURLToPath(new URL('./src/shims/stream-promises.ts', import.meta.url));
const swSource = fileURLToPath(new URL('./node_modules/almostnode/dist/__sw__.js', import.meta.url));
const almostnodeAssets = fileURLToPath(new URL('./node_modules/almostnode/dist/assets', import.meta.url));
const publicAssets = fileURLToPath(new URL('./public/assets', import.meta.url));

// almostnode hosting glue:
//  - emit /__sw__.js into the build (the published almostnode/vite plugin only
//    serves it in dev), and
//  - stage almostnode's prebuilt /assets/* (the optional runtime-worker the dist
//    references by absolute URL) into public/assets so both dev and the Vite
//    worker bundler can resolve it. Tracks the installed almostnode version.
function almostnodeHosting() {
  const stageAssets = () => {
    try {
      fs.mkdirSync(publicAssets, {
        recursive: true
      });
      for (const f of fs.readdirSync(almostnodeAssets)) {
        fs.copyFileSync(`${almostnodeAssets}/${f}`, `${publicAssets}/${f}`);
      }
    } catch (e) {
      console.warn('[devreel] could not stage almostnode assets:', e);
    }
  };
  return {
    name: 'devreel-almostnode-hosting',
    buildStart() {
      stageAssets();
    },
    configureServer() {
      stageAssets();
    },
    generateBundle() {
      // @ts-expect-error rollup plugin context
      this.emitFile({
        type: 'asset',
        fileName: '__sw__.js',
        source: fs.readFileSync(swSource, 'utf8')
      });
    }
  };
}

// almostnode requires cross-origin isolation for its service worker + WASM
// (esbuild-wasm transforms, PGlite, the /__virtual__ preview proxy). The
// almostnode vite plugin only serves /__sw__.js, so we set the headers here.
const crossOriginIsolation = {
  'Cross-Origin-Embedder-Policy': 'credentialless',
  'Cross-Origin-Opener-Policy': 'same-origin'
};
export default defineConfig({
  plugins: [{
    // Stub two things almostnode/PGlite reference but we never execute:
    //  - PGlite's dead-branch import('node:stream/promises')
    //  - almostnode's OPTIONAL web-worker runtime (we run on the main thread)
    name: 'devreel-stubs',
    enforce: 'pre',
    resolveId(source) {
      if (source === 'stream/promises' || source === 'node:stream/promises') return streamPromisesStub;
      return null;
    }
  }, react(), wasm(), topLevelAwait(), nodePolyfills({
    include: ['path', 'util', 'events', 'buffer', 'url', 'string_decoder', 'querystring', 'crypto', 'assert', 'stream', 'http', 'https', 'zlib', 'tty', 'os'],
    globals: {
      Buffer: true,
      global: true,
      process: true
    }
  }), almostnodePlugin(), almostnodeHosting()],
  define: {
    global: 'globalThis'
  },
  server: {
    headers: crossOriginIsolation,
    // Allow tunneled hosts (ngrok, etc.) to reach the dev server.
    allowedHosts: true
  },
  preview: {
    headers: crossOriginIsolation
  },
  optimizeDeps: {
    include: ['buffer', 'process'],
    // PGlite ships a browser build; exclude it from pre-bundling so its wasm
    // loads from the package. Its dep scan still hits a Node-only
    // stream/promises import, so stub that at the esbuild layer too.
    exclude: ['@electric-sql/pglite'],
    esbuildOptions: {
      target: 'esnext',
      plugins: [{
        name: 'stub-stream-promises',
        setup(build: {
          onResolve: (opts: {
            filter: RegExp;
          }, cb: () => {
            path: string;
          }) => void;
        }) {
          build.onResolve({
            filter: /^(node:)?stream\/promises$/
          }, () => ({
            path: streamPromisesStub
          }));
        }
      }]
    }
  },
  worker: {
    format: 'es'
  },
  build: {
    target: 'esnext'
  },
  assetsInclude: ['**/*.wasm'],
  test: {
    projects: [{
      extends: true,
      plugins: [
      // The plugin will run tests for the stories defined in your Storybook config
      // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      storybookTest({
        configDir: path.join(dirname, '.storybook')
      })],
      test: {
        name: 'storybook',
        browser: {
          enabled: true,
          headless: true,
          provider: playwright({}),
          instances: [{
            browser: 'chromium'
          }]
        }
      }
    }]
  }
});