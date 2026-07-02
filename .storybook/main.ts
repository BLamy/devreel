import type { StorybookConfig } from '@storybook/react-vite'

const config: StorybookConfig = {
  stories: ['../src/viz/**/*.mdx', '../src/viz/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@chromatic-com/storybook',
    '@storybook/addon-vitest',
    '@storybook/addon-a11y',
    '@storybook/addon-docs',
    '@storybook/addon-mcp',
  ],
  framework: '@storybook/react-vite',
  viteFinal: async (config) => {
    // The viz suite doesn't use almostnode (the in-browser Node runtime), so
    // drop its plugins and the cross-origin-isolation headers the app needs
    // for SharedArrayBuffer — Storybook stays lean and service-worker-free.
    config.plugins = (config.plugins ?? [])
      .flat()
      .filter((p) => !(p && typeof p === 'object' && 'name' in p && /almostnode/.test(String(p.name))))
    config.server = { ...config.server, headers: {} }
    return config
  },
}
export default config
