import type { Meta, StoryObj } from '@storybook/react-vite'
import { BayesTheorem } from './BayesTheorem'

const meta = {
  title: 'Viz/Bayes Theorem',
  component: BayesTheorem,
} satisfies Meta<typeof BayesTheorem>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
