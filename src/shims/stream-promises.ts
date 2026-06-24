// Stub for `stream/promises` — referenced by PGlite's Node-only dump-to-file
// path, which never runs in the browser. Present only so Vite can resolve it.
export const pipeline = async (): Promise<void> => {
  throw new Error('stream/promises is not available in the browser')
}
export const finished = async (): Promise<void> => {}
export default { pipeline, finished }
