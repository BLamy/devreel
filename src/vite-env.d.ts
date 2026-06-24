/// <reference types="vite/client" />

// almostnode ships its own types via the package, but the dev-server / bridge
// surface we touch is loosely typed here to keep the consumer build clean.
declare module 'almostnode/vite';

// Runtime CDN imports (PGlite) — resolved by the browser, not bundled.
declare module 'https://*';
