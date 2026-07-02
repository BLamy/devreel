import type { Meta, StoryObj } from '@storybook/react-vite'
import { NeuralNetwork } from './NeuralNetwork'

const meta = {
  title: 'Viz/Neural Network',
  component: NeuralNetwork,
} satisfies Meta<typeof NeuralNetwork>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
