import type { Lesson } from '../lesson/types'

// A demo lesson exercising the M2 tools: the architecture diagram, the PGlite
// database inspector, and the terminal. Timer-clocked (no audio) for dev preview
// at ?sample=tools.
export const toolsDemo: Lesson = {
  slug: 'tools-demo',
  title: 'devreel tools',
  subtitle: 'diagram · database · terminal',
  library: 'devreel',
  throughline: 'tools',
  persona: 'devreel',
  accent: '#34d399',
  workspace: {
    files: {
      '/answer.js': "const answer = 6 * 7\nconsole.log('the answer is ' + answer)\n",
    },
    dbSchema:
      "CREATE TABLE todos (id serial primary key, title text, done boolean default false);" +
      " INSERT INTO todos (title, done) VALUES ('Learn devreel', true), ('Ship M2', false), ('Record a reel', false);",
  },
  diagram: {
    nodes: [
      { id: 'client', label: 'Browser', kind: 'client', x: 18, y: 50 },
      { id: 'api', label: 'API', kind: 'service', x: 50, y: 50 },
      { id: 'db', label: 'Postgres', kind: 'database', sublabel: 'PGlite', x: 82, y: 50 },
    ],
    edges: [
      { id: 'e1', from: 'client', to: 'api', label: 'HTTP' },
      { id: 'e2', from: 'api', to: 'db', label: 'SQL' },
    ],
  },
  scenes: [
    {
      id: 'd1', chapter: 'Architecture', focus: 'diagram',
      narration: 'A lesson can keep the **architecture view** — the browser talks to an API.',
      autoAdvanceMs: 4000,
      action: { tool: 'diagram', reveal: ['client', 'api'], messages: [{ from: 'client', to: 'api', label: 'GET /todos', kind: 'request' }] },
    },
    {
      id: 'd2', chapter: 'Architecture', focus: 'diagram',
      narration: 'The API queries **Postgres** — running fully in the browser via PGlite.',
      autoAdvanceMs: 4000,
      action: { tool: 'diagram', reveal: ['db'], highlight: ['db'], messages: [{ from: 'api', to: 'db', label: 'SQL', kind: 'data' }] },
    },
    {
      id: 'db1', chapter: 'Database', focus: 'database',
      narration: 'Here are the rows that query returns — a **real** table, queried live.',
      autoAdvanceMs: 4500,
      action: { tool: 'database', query: 'SELECT id, title, done FROM todos ORDER BY id;', highlight: 'done' },
    },
    {
      id: 'db2', chapter: 'Database', focus: 'database',
      narration: 'Filter to just the open todos — the result updates instantly.',
      autoAdvanceMs: 4500,
      action: { tool: 'database', query: 'SELECT title FROM todos WHERE done = false;' },
    },
    {
      id: 't1', chapter: 'Terminal', focus: 'terminal',
      narration: 'And a real **terminal** — it runs `node answer.js` for real.',
      say: 'And a real terminal. It runs node answer dot js for real.',
      autoAdvanceMs: 5000,
      action: { tool: 'terminal', run: 'node answer.js' },
    },
  ],
}
