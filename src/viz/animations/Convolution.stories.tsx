import type { Meta, StoryObj } from '@storybook/react-vite'
import { Convolution } from './Convolution'

const meta = {
  title: 'Viz/Convolution',
  component: Convolution,
} satisfies Meta<typeof Convolution>

export default meta
type Story = StoryObj<typeof meta>

export const Smoothing: Story = {
  args: { kernel: 'smooth' },
}

export const EdgeDetection: Story = {
  args: { kernel: 'edge' },
}
