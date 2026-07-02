import type { Meta, StoryObj } from '@storybook/react-vite'
import { TaylorSeries } from './TaylorSeries'

const meta = {
  title: 'Viz/Taylor Series',
  component: TaylorSeries,
} satisfies Meta<typeof TaylorSeries>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
