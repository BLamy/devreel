import type { Meta, StoryObj } from '@storybook/react-vite'
import { AttentionMechanism } from './AttentionMechanism'

const meta = {
  title: 'Viz/Attention Mechanism',
  component: AttentionMechanism,
} satisfies Meta<typeof AttentionMechanism>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
