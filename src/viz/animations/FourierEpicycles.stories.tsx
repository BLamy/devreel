import type { Meta, StoryObj } from '@storybook/react-vite'
import { FourierEpicycles } from './FourierEpicycles'

const meta = {
  title: 'Viz/Fourier Epicycles',
  component: FourierEpicycles,
} satisfies Meta<typeof FourierEpicycles>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
