import type { Meta, StoryObj } from '@storybook/react-vite'
import { FourierWinding } from './FourierWinding'

const meta = {
  title: 'Viz/Fourier Winding Machine',
  component: FourierWinding,
} satisfies Meta<typeof FourierWinding>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
