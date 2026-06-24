// Stub for almostnode's OPTIONAL web-worker runtime
// (new Worker(new URL("/assets/runtime-worker-*.js", import.meta.url))). We run
// the runtime on the main thread (never pass useWorker), so this worker is never
// instantiated — present only so Vite's build can resolve the URL.
export {}
