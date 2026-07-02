import type { Meta, StoryObj } from '@storybook/react-vite'
import { CentralLimit } from './CentralLimit'

const meta = {
  title: 'Viz/Central Limit Theorem',
  component: CentralLimit,
} satisfies Meta<typeof CentralLimit>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
