import type { Meta, StoryObj } from '@storybook/react-vite'
import { DifferentialDataflow } from './DifferentialDataflow'

const meta = {
  title: 'Viz/Differential Dataflow',
  component: DifferentialDataflow,
} satisfies Meta<typeof DifferentialDataflow>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
