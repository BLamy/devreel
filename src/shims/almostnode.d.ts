// almostnode ships no type declarations. The app has always consumed it
// untyped — this shim makes that explicit so full (non-incremental) builds
// typecheck; the committed tsconfig.tsbuildinfo previously masked it.
declare module 'almostnode' {
  export const createContainer: any
  export const getServerBridge: any
  export class ViteDevServer {
    constructor(...args: any[])
    ;[key: string]: any
  }
}
