import type { Meta, StoryObj } from '@storybook/react-vite'
import { Eigenvectors } from './Eigenvectors'

const meta = {
  title: 'Viz/Eigenvectors',
  component: Eigenvectors,
} satisfies Meta<typeof Eigenvectors>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
