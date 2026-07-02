import type { Meta, StoryObj } from '@storybook/react-vite'
import { Lib3b1bDemo } from './Lib3b1bDemo'

const meta = {
  title: 'Viz/Lib 3b1b Demo',
  component: Lib3b1bDemo,
} satisfies Meta<typeof Lib3b1bDemo>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
