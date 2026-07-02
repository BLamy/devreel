import { createArchDefinition } from './build'
import type { ArchSpec } from './types'
import type { VizDefinition } from '../core/definition'

// Exemplar architectures — pure data. These double as the reference examples
// for authoring new specs: a lesson-authoring model (even a small one) can
// pattern-match these shapes and only invent node positions and labels.

export const cacheAsideSpec: ArchSpec = {
  id: 'arch-cache-aside',
  title: 'Cache-aside — the pattern behind every fast API',
  summary: 'Client → CDN → LB → services with Redis + Postgres: a cold miss, a warm hit, and the invalidation trap.',
  intro: {
    say: 'A classic web backend. Requests come through a CDN and a load balancer to stateless API servers, which talk to a cache and a database.',
    caption: 'the standard three-tier + cache setup',
  },
  nodes: [
    { id: 'browser', label: 'browser', kind: 'browser', x: 90, y: 255 },
    { id: 'cdn', label: 'CDN', kind: 'cdn', x: 235, y: 255 },
    { id: 'lb', label: 'load balancer', kind: 'loadbalancer', x: 385, y: 255 },
    { id: 'api1', label: 'api-1', kind: 'service', sublabel: 'stateless', x: 545, y: 165 },
    { id: 'api2', label: 'api-2', kind: 'service', sublabel: 'stateless', x: 545, y: 345 },
    { id: 'cache', label: 'Redis', kind: 'cache', sublabel: 'TTL 60s', x: 745, y: 165 },
    { id: 'db', label: 'Postgres', kind: 'database', sublabel: 'source of truth', x: 745, y: 375 },
  ],
  edges: [
    { from: 'browser', to: 'cdn' },
    { from: 'cdn', to: 'lb' },
    { from: 'lb', to: 'api1' },
    { from: 'lb', to: 'api2' },
    { from: 'api1', to: 'cache' },
    { from: 'api2', to: 'cache' },
    { from: 'api1', to: 'db' },
    { from: 'api2', to: 'db' },
  ],
  flows: [
    {
      name: 'cold read: a cache miss',
      say: 'The first read is the expensive one. The cache says miss, so the API pays for a real database query — and then writes the answer back into the cache on its way out.',
      caption: 'miss → query the DB → fill the cache',
      steps: [
        { from: 'browser', to: 'cdn', label: 'GET /user/42' },
        { from: 'cdn', to: 'lb' },
        { from: 'lb', to: 'api1' },
        { from: 'api1', to: 'cache', label: 'GET user:42' },
        { from: 'cache', to: 'api1', label: 'MISS', kind: 'error' },
        { from: 'api1', to: 'db', label: 'SELECT …' },
        { from: 'db', to: 'api1', label: 'row', kind: 'data' },
        { from: 'api1', to: 'cache', label: 'SET user:42', kind: 'data' },
        { from: 'api1', to: 'lb', kind: 'response' },
        { from: 'lb', to: 'browser', label: '200', kind: 'response' },
      ],
      badges: [
        { node: 'db', text: '42ms', tone: 'warn' },
        { node: 'browser', text: 'total 68ms', tone: 'warn' },
      ],
    },
    {
      name: 'warm read: a cache hit',
      say: 'Every read after that skips the database entirely. One hop to Redis, one millisecond, done. This is why the pattern is everywhere.',
      caption: 'the hit path never touches the database',
      steps: [
        { from: 'browser', to: 'cdn', label: 'GET /user/42' },
        { from: 'cdn', to: 'lb' },
        { from: 'lb', to: 'api2' },
        { from: 'api2', to: 'cache', label: 'GET user:42' },
        { from: 'cache', to: 'api2', label: 'HIT · 1ms', kind: 'response' },
        { from: 'api2', to: 'lb', kind: 'response' },
        { from: 'lb', to: 'browser', label: '200', kind: 'response' },
      ],
      badges: [
        { node: 'cache', text: 'hit rate 94%', tone: 'ok' },
        { node: 'browser', text: 'total 9ms', tone: 'ok' },
      ],
    },
    {
      name: 'the hard part: invalidation',
      say: "Then someone updates the row. The database has the new value — but the cache still holds the old one, and readers keep getting it. That's the trap: every cache strategy is really an invalidation strategy.",
      caption: 'the DB moved on; the cache did not',
      steps: [
        { from: 'api1', to: 'db', label: 'UPDATE user 42' },
        { from: 'db', to: 'api1', label: 'ok', kind: 'response' },
        { from: 'lb', to: 'api2', label: 'GET /user/42' },
        { from: 'api2', to: 'cache', label: 'GET user:42' },
        { from: 'cache', to: 'api2', label: 'HIT — stale!', kind: 'error' },
        { from: 'api1', to: 'cache', label: 'DEL user:42', kind: 'event' },
      ],
      badges: [{ node: 'cache', text: 'evicted → next read refills', tone: 'ok' }],
    },
  ],
}

export const awsMultiAzSpec: ArchSpec = {
  id: 'arch-aws-multi-az',
  title: 'Multi-AZ on AWS — surviving a datacenter failure',
  summary: 'ALB + instances across two availability zones + RDS primary/standby: normal traffic, an AZ outage, failover.',
  intro: {
    say: 'One AWS region, two availability zones — separate buildings, separate power, separate failure domains. A load balancer spans both; the database replicates from A to B.',
    caption: 'two failure domains inside one region',
  },
  groups: [
    { id: 'region', label: 'aws · us-east-1', kind: 'region', x: 150, y: 60, w: 780, h: 425 },
    { id: 'az-a', label: 'us-east-1a', kind: 'az', x: 180, y: 130, w: 330, h: 330 },
    { id: 'az-b', label: 'us-east-1b', kind: 'az', x: 575, y: 130, w: 330, h: 330 },
  ],
  nodes: [
    { id: 'browser', label: 'clients', kind: 'browser', x: 70, y: 165 },
    { id: 'alb', label: 'ALB', kind: 'loadbalancer', sublabel: 'spans both AZs', x: 543, y: 105 },
    { id: 'ec2-a1', label: 'ec2-a1', kind: 'vm', x: 265, y: 215 },
    { id: 'ec2-a2', label: 'ec2-a2', kind: 'vm', x: 415, y: 215 },
    { id: 'ec2-b1', label: 'ec2-b1', kind: 'vm', x: 660, y: 215 },
    { id: 'ec2-b2', label: 'ec2-b2', kind: 'vm', x: 810, y: 215 },
    { id: 'rds-a', label: 'RDS primary', kind: 'database', sublabel: 'PostgreSQL', x: 340, y: 385 },
    { id: 'rds-b', label: 'RDS standby', kind: 'replica', sublabel: 'sync replica', x: 735, y: 385 },
  ],
  edges: [
    { from: 'browser', to: 'alb' },
    { from: 'alb', to: 'ec2-a1' },
    { from: 'alb', to: 'ec2-a2' },
    { from: 'alb', to: 'ec2-b1' },
    { from: 'alb', to: 'ec2-b2' },
    { from: 'ec2-a1', to: 'rds-a' },
    { from: 'ec2-a2', to: 'rds-a' },
    { from: 'ec2-b1', to: 'rds-a' },
    { from: 'ec2-b2', to: 'rds-a' },
    { from: 'rds-a', to: 'rds-b', label: 'sync replication', dashed: true },
  ],
  flows: [
    {
      name: 'a normal request',
      say: 'On a good day: the load balancer picks a healthy instance, the write lands on the primary database, and the standby in the other zone gets a synchronous copy before we even reply.',
      caption: 'every write exists in two buildings before the 200',
      steps: [
        { from: 'browser', to: 'alb', label: 'HTTPS' },
        { from: 'alb', to: 'ec2-a1' },
        { from: 'ec2-a1', to: 'rds-a', label: 'INSERT' },
        { from: 'rds-a', to: 'rds-b', label: 'replicate', kind: 'data' },
        { from: 'rds-a', to: 'ec2-a1', label: 'commit', kind: 'response' },
        { from: 'ec2-a1', to: 'alb', kind: 'response' },
        { from: 'alb', to: 'browser', label: '200', kind: 'response' },
      ],
    },
    {
      name: 'zone A goes dark',
      say: 'Now zone A fails — instances, database primary, everything. The load balancer’s health checks notice within seconds and simply stop sending traffic there. Reads keep flowing.',
      caption: 'health checks reroute around the dead zone',
      fail: ['ec2-a1', 'ec2-a2', 'rds-a'],
      steps: [
        { from: 'browser', to: 'alb', label: 'HTTPS' },
        { from: 'alb', to: 'ec2-b1', label: 'healthy target' },
        { from: 'ec2-b1', to: 'alb', kind: 'response' },
        { from: 'alb', to: 'browser', label: '200', kind: 'response' },
      ],
      badges: [{ node: 'alb', text: 'health: 2/4 targets', tone: 'warn' }],
    },
    {
      name: 'failover: the standby takes over',
      say: 'And the standby is promoted to primary — that is the whole reason it existed. Writes resume in zone B. Total downtime: about a minute, and no data lost, because replication was synchronous.',
      caption: 'RDS promotes the standby — writes resume',
      steps: [
        { from: 'ec2-b2', to: 'rds-b', label: 'INSERT' },
        { from: 'rds-b', to: 'ec2-b2', label: 'commit', kind: 'response' },
        { from: 'ec2-b2', to: 'alb', kind: 'response' },
        { from: 'alb', to: 'browser', label: '200', kind: 'response' },
      ],
      badges: [
        { node: 'rds-b', text: 'promoted → primary', tone: 'ok' },
        { node: 'browser', text: 'RTO ≈ 60s · RPO = 0', tone: 'ok' },
      ],
    },
  ],
}

export const vercelEdgeSpec: ArchSpec = {
  id: 'arch-vercel-edge',
  title: 'Edge deployments — static, dynamic, and ISR',
  summary: 'Browser → edge network (CDN + middleware) → serverless origin: an edge hit, a dynamic render, and background regeneration.',
  intro: {
    say: 'A modern edge deployment. The edge network sits close to users — static cache and middleware. The origin — serverless functions, the ISR store, the database — lives in one region.',
    caption: 'edge close to users, origin in one region',
  },
  groups: [
    { id: 'edge', label: 'edge network · 100+ PoPs', kind: 'edge-network', x: 235, y: 75, w: 290, h: 400 },
    { id: 'origin', label: 'origin · us-east', kind: 'platform', x: 585, y: 75, w: 330, h: 400 },
  ],
  nodes: [
    { id: 'browser', label: 'browser', kind: 'browser', sublabel: 'Tokyo', x: 90, y: 250 },
    { id: 'cdn', label: 'edge cache', kind: 'cdn', sublabel: 'static + ISR pages', x: 380, y: 165 },
    { id: 'mw', label: 'middleware', kind: 'edge-function', sublabel: 'auth · rewrite', x: 380, y: 370 },
    { id: 'fn', label: 'route handler', kind: 'lambda', sublabel: 'SSR', x: 720, y: 165 },
    { id: 'blob', label: 'ISR store', kind: 'blob', x: 660, y: 385 },
    { id: 'db', label: 'Postgres', kind: 'database', x: 835, y: 385 },
  ],
  edges: [
    { from: 'browser', to: 'cdn' },
    { from: 'cdn', to: 'mw' },
    { from: 'mw', to: 'fn' },
    { from: 'fn', to: 'db' },
    { from: 'fn', to: 'blob', label: 'revalidate', dashed: true },
    { from: 'blob', to: 'cdn', label: 'propagate', dashed: true },
  ],
  flows: [
    {
      name: 'static: answered at the edge',
      say: 'The best request is one that never leaves the neighborhood. A static page is served from the edge cache a few milliseconds away — the origin never hears about it.',
      caption: 'served from the PoP — origin untouched',
      steps: [
        { from: 'browser', to: 'cdn', label: 'GET /' },
        { from: 'cdn', to: 'browser', label: 'HIT · 18ms', kind: 'response' },
      ],
      badges: [{ node: 'cdn', text: 'edge HIT', tone: 'ok' }],
    },
    {
      name: 'dynamic: render at the origin',
      say: 'A personalized page cannot be cached. Middleware checks the session at the edge, then the request crosses the ocean: a serverless function renders it, the database answers, and the HTML rides all the way back.',
      caption: 'the round-trip you pay for dynamic pages',
      steps: [
        { from: 'browser', to: 'cdn', label: 'GET /dashboard' },
        { from: 'cdn', to: 'mw', label: 'MISS → middleware' },
        { from: 'mw', to: 'fn', label: 'session ok · render' },
        { from: 'fn', to: 'db', label: 'SELECT' },
        { from: 'db', to: 'fn', label: 'rows', kind: 'data' },
        { from: 'fn', to: 'mw', label: 'HTML', kind: 'response' },
        { from: 'mw', to: 'cdn', kind: 'response' },
        { from: 'cdn', to: 'browser', label: '200 · 280ms', kind: 'response' },
      ],
      badges: [{ node: 'browser', text: '280ms (cross-region)', tone: 'warn' }],
    },
    {
      name: 'ISR: stale now, fresh in the background',
      say: 'Incremental static regeneration splits the difference: serve the stale copy instantly, and regenerate it in the background. The next visitor gets a fresh page at edge speed.',
      caption: 'serve stale in 20ms, regenerate behind the scenes',
      steps: [
        { from: 'browser', to: 'cdn', label: 'GET /blog' },
        { from: 'cdn', to: 'browser', label: 'stale · 20ms', kind: 'response' },
        { from: 'cdn', to: 'mw', label: 'revalidate', kind: 'event' },
        { from: 'mw', to: 'fn', label: 'regenerate', kind: 'event' },
        { from: 'fn', to: 'db', label: 'SELECT' },
        { from: 'db', to: 'fn', label: 'rows', kind: 'data' },
        { from: 'fn', to: 'blob', label: 'write HTML', kind: 'data' },
        { from: 'blob', to: 'cdn', label: 'propagate', kind: 'event' },
      ],
      badges: [{ node: 'cdn', text: 'fresh for the next visitor', tone: 'ok' }],
    },
  ],
}

export const archDefinitions: VizDefinition[] = [
  createArchDefinition(cacheAsideSpec),
  createArchDefinition(awsMultiAzSpec),
  createArchDefinition(vercelEdgeSpec),
]
