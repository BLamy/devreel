import type { Meta, StoryObj } from '@storybook/react-vite'
import { DiffusionProcess } from './DiffusionProcess'

const meta = {
  title: 'Viz/Diffusion Process',
  component: DiffusionProcess,
} satisfies Meta<typeof DiffusionProcess>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
