// The lesson-facing catalog of 3b1b-style animations — plain JS so the Node
// generator (validate.mjs, storyboard authoring) can import it without a TS
// build. `src/viz/registry.ts` cross-checks this file against the real
// definitions at dev time; if you add or rename an animation or act, update
// BOTH or Storybook will log a loud mismatch error.
//
// Lesson usage: a scene with focus "viz" and
//   action: { tool: "viz", animation: "<id>", act: "<act name>" }
// plays that act across the scene, paced by the narration. Use consecutive
// scenes for consecutive acts. Omit `act` to sweep the whole animation.

export const VIZ_MANIFEST = [
  {
    id: 'linear-transformation',
    title: 'A matrix moves space',
    summary: 'A 2×2 matrix morphs the plane: basis vectors, a passenger vector, determinant as area.',
    acts: ['the plane', 'a matrix moves space', 'rewind', 'meet a vector', 'v rides along', 'determinant'],
  },
  {
    id: 'linear-transformation-shear',
    title: 'A shear',
    summary: 'Same story with a pure shear matrix [1 1; 0 1].',
    acts: ['the plane', 'a matrix moves space', 'rewind', 'meet a vector', 'v rides along', 'determinant'],
  },
  {
    id: 'linear-transformation-rotation',
    title: 'A rotation',
    summary: 'Same story with a (slightly scaled) rotation — nothing stretches unevenly.',
    acts: ['the plane', 'a matrix moves space', 'rewind', 'meet a vector', 'v rides along', 'determinant'],
  },
  {
    id: 'linear-transformation-singular',
    title: 'A singular matrix',
    summary: 'det = 0: the plane collapses onto a line, a dimension is lost.',
    acts: ['the plane', 'a matrix moves space', 'rewind', 'meet a vector', 'v rides along', 'determinant'],
  },
  {
    id: 'eigenvectors',
    title: 'Eigenvectors',
    summary: 'A ring of vectors hit by M — two directions never turn; finale is power iteration (PageRank).',
    acts: ['a ring of vectors', 'transform them all', 'two directions survive', 'they only scale', 'repeat M: power iteration'],
  },
  {
    id: 'svd-decomposition',
    title: 'SVD',
    summary: 'Every matrix staged as rotate → stretch → rotate (M = U·Σ·Vᵀ), with proof overlay.',
    acts: ['any matrix', 'first: rotate', 'then: stretch', 'finally: rotate again', 'M = U Σ Vᵀ'],
  },
  {
    id: 'fourier-epicycles',
    title: 'Fourier epicycles',
    summary: 'Rotating vector chain draws a square wave; harmonics sharpen the corners.',
    acts: ['one circle', 'add the 3rd harmonic', 'seven terms', 'twenty-five terms'],
  },
  {
    id: 'fourier-winding',
    title: 'Fourier winding machine',
    summary: 'Wind a signal around a circle; the center of mass lurches at frequencies hidden inside — the transform itself.',
    acts: ['a chord of two notes', 'wrap it around a circle', 'sweep to two hertz', 'and three', 'the Fourier transform'],
  },
  {
    id: 'convolution-smooth',
    title: 'Convolution (smoothing)',
    summary: 'Flip–slide–multiply–sum with a Gaussian kernel: blur / moving average / low-pass.',
    acts: ['two functions', 'flip and slide', 'multiply, then sum', 'the result', 'why it matters'],
  },
  {
    id: 'convolution-edge',
    title: 'Convolution (edge detection)',
    summary: 'Same machine with a derivative kernel: fires only at changes — a CNN first layer.',
    acts: ['two functions', 'flip and slide', 'multiply, then sum', 'the result', 'why it matters'],
  },
  {
    id: 'taylor-series',
    title: 'Taylor series',
    summary: 'Polynomials hug sin(x) one order at a time; higher orders hold on longer.',
    acts: ['a difficult function', 'the best line', 'add a cubic', 'higher orders', 'the payoff'],
  },
  {
    id: 'gradient-descent',
    title: 'Gradient descent vs momentum vs Adam',
    summary: 'Three optimizers race on a two-valley landscape; only momentum escapes the local minimum.',
    acts: ['the loss landscape', 'gradient descent', 'momentum', 'Adam', 'compare'],
  },
  {
    id: 'central-limit',
    title: 'Central limit theorem',
    summary: 'A Galton board: 220 balls of coin flips stack into a bell curve.',
    acts: ['one ball', 'two hundred more', 'the bell emerges', 'the central limit theorem'],
  },
  {
    id: 'bayes-theorem',
    title: "Bayes' theorem",
    summary: 'The medical-test classic as areas: 90 true positives drown in 891 false ones → 9.2%.',
    acts: ['a population', 'the prior', 'the test', 'you test positive', 'the posterior'],
  },
  {
    id: 'kl-divergence',
    title: 'KL divergence',
    summary: 'Two distributions compared pointwise; the weighted surprise integrates to KL — and it is not symmetric.',
    acts: ['two beliefs', 'pointwise surprise', 'weight by P', 'swap them', 'why ML cares'],
  },
  {
    id: 'neural-network',
    title: 'Neural network learns',
    summary: 'Real forward pass, softmax loss, backprop blame, one honest gradient step.',
    acts: ['the network', 'forward pass', 'prediction vs target', 'backpropagation', 'one gradient step'],
  },
  {
    id: 'attention-mechanism',
    title: 'Attention',
    summary: 'Tokens → Q/K/V; one query scores every key, softmax mixes the values; finale is the n×n matrix.',
    acts: ['tokens become vectors', 'queries, keys, values', 'one token asks', 'softmax', 'mix the values', 'every pair at once'],
  },
  {
    id: 'embedding-arithmetic',
    title: 'Embedding arithmetic',
    summary: 'king − man + woman ≈ queen: meaning as directions in vector space.',
    acts: ['words as points', 'meaning has directions', 'move the direction', 'the analogy completes', 'directions are everywhere'],
  },
  {
    id: 'diffusion-process',
    title: 'Diffusion models',
    summary: 'Two moons noised to a Gaussian and denoised back along the exact same paths.',
    acts: ['the data', 'forward: drown it in noise', 'pure noise', 'reverse: learn the way back', 'that is the whole trick'],
  },
  {
    id: 'graph-bfs',
    title: 'Breadth-first search',
    summary: 'A wavefront floods a network level by level; shortest paths fall out for free.',
    acts: ['a network', 'start somewhere', 'explore in waves', 'shortest paths for free', 'the pattern everywhere'],
  },
  {
    id: 'differential-dataflow',
    title: 'Differential dataflow',
    summary: 'A counting pipeline: batch recomputes the world per change; differential ships (data, time, ±1) deltas and the frontier decides when outputs commit.',
    acts: ['a dataflow', 'the batch way', 'differences, not snapshots', 'timestamps and the frontier', 'why it scales'],
  },
  {
    id: 'arch-cache-aside',
    title: 'Cache-aside architecture',
    summary: 'Client → CDN → LB → services with Redis + Postgres: a cold miss, a warm hit, and the invalidation trap.',
    acts: ['the architecture', 'cold read: a cache miss', 'warm read: a cache hit', 'the hard part: invalidation'],
  },
  {
    id: 'arch-aws-multi-az',
    title: 'AWS multi-AZ failover',
    summary: 'ALB + instances across two availability zones + RDS primary/standby: normal traffic, an AZ outage, failover.',
    acts: ['the architecture', 'a normal request', 'zone A goes dark', 'failover: the standby takes over'],
  },
  {
    id: 'arch-vercel-edge',
    title: 'Edge deployment (Vercel-style)',
    summary: 'Browser → edge network (CDN + middleware) → serverless origin: an edge hit, a dynamic render, and ISR.',
    acts: ['the architecture', 'static: answered at the edge', 'dynamic: render at the origin', 'ISR: stale now, fresh in the background'],
  },
  {
    // Built with the 3b1bd3 channel-timeline adapter (src/viz/lib3b1bd3.ts):
    // act names are derived from the library timeline's captions (cap-<id>).
    id: 'lib-3b1b-demo',
    title: 'Channels, not acts',
    summary: 'Adapter demo: a 3b1bd3 channel timeline — a dot easing across, a draw-on ring, a counting label — driven beat by beat as devreel acts.',
    acts: ['cap-1', 'cap-3', 'cap-5'],
  },
]
