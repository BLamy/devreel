import type { Preview } from '@storybook/react-vite'

const preview: Preview = {
  parameters: {
    layout: 'centered',
    backgrounds: {
      options: {
        dark: { name: 'devreel dark', value: '#0a0d15' },
        surface: { name: 'scene surface', value: '#0f131e' },
      },
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      // 'todo' - show a11y violations in the test UI only
      test: 'todo',
    },
  },
  initialGlobals: {
    backgrounds: { value: 'dark' },
  },
}

export default preview
