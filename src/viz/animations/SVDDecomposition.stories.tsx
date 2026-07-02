import type { Meta, StoryObj } from '@storybook/react-vite'
import { SVDDecomposition } from './SVDDecomposition'

const meta = {
  title: 'Viz/SVD Decomposition',
  component: SVDDecomposition,
} satisfies Meta<typeof SVDDecomposition>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
