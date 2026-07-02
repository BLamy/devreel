import type { Meta, StoryObj } from '@storybook/react-vite'
import { KLDivergence } from './KLDivergence'

const meta = {
  title: 'Viz/KL Divergence',
  component: KLDivergence,
} satisfies Meta<typeof KLDivergence>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
