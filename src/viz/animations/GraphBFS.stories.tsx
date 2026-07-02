import type { Meta, StoryObj } from '@storybook/react-vite'
import { GraphBFS } from './GraphBFS'

const meta = {
  title: 'Viz/Graph BFS',
  component: GraphBFS,
} satisfies Meta<typeof GraphBFS>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
