import type { Meta, StoryObj } from '@storybook/react-vite'
import { EmbeddingArithmetic } from './EmbeddingArithmetic'

const meta = {
  title: 'Viz/Embedding Arithmetic',
  component: EmbeddingArithmetic,
} satisfies Meta<typeof EmbeddingArithmetic>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
