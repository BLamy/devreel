import type { Meta, StoryObj } from '@storybook/react-vite'
import { GradientDescent } from './GradientDescent'

const meta = {
  title: 'Viz/Gradient Descent',
  component: GradientDescent,
} satisfies Meta<typeof GradientDescent>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
