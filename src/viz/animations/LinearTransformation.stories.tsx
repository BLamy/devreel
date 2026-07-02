import type { Meta, StoryObj } from '@storybook/react-vite'
import { LinearTransformation } from './LinearTransformation'

const meta = {
  title: 'Viz/Linear Transformation',
  component: LinearTransformation,
} satisfies Meta<typeof LinearTransformation>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Shear: Story = {
  args: {
    title: 'A shear — one basis vector drags the plane sideways',
    matrix: { a: 1, b: 0, c: 1, d: 1 },
  },
}

export const Rotation: Story = {
  args: {
    title: 'A rotation (slightly scaled) — nothing stretches unevenly',
    matrix: { a: 0.87, b: 0.5, c: -0.5, d: 0.87 },
  },
}

export const Singular: Story = {
  args: {
    title: 'A singular matrix — det = 0 collapses the plane',
    matrix: { a: 1.2, b: 0.6, c: 0.6, d: 0.3 },
  },
}
