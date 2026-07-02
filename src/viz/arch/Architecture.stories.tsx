import React from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Scene } from '../core/Scene'
import { archDefinitions } from './catalog'

const byId = Object.fromEntries(archDefinitions.map((d) => [d.id, d]))

function ArchScene({ id }: { id: string }) {
  const def = byId[id]
  return <Scene title={def.title} acts={def.acts} setup={def.setup} />
}

const meta = {
  title: 'Viz/Architecture',
  component: ArchScene,
} satisfies Meta<typeof ArchScene>

export default meta
type Story = StoryObj<typeof meta>

export const CacheAside: Story = { args: { id: 'arch-cache-aside' } }
export const AwsMultiAz: Story = { args: { id: 'arch-aws-multi-az' } }
export const VercelEdge: Story = { args: { id: 'arch-vercel-edge' } }
