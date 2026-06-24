// Validate (and lightly repair) an authored Lesson before narration. Mirrors
// orly's validate-then-repair discipline: mutate safe fixes in place, return
// { ok, errors, warnings }. The author loop re-runs until ok:true.

const TOOLS = new Set(['editor', 'preview', 'terminal', 'database', 'diagram']);

const isStr = (v) => typeof v === 'string' && v.length > 0;

export function validateLesson(lesson) {
  const errors = [];
  const warnings = [];
  const err = (m) => errors.push(m);
  const warn = (m) => warnings.push(m);

  if (!lesson || typeof lesson !== 'object') {
    return { ok: false, errors: ['lesson must be an object'], warnings };
  }

  if (!isStr(lesson.slug) || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(lesson.slug)) {
    err('slug must be kebab-case (a-z, 0-9, dashes)');
  }
  for (const f of ['title', 'library', 'throughline']) {
    if (!isStr(lesson[f])) err(`${f} is required (non-empty string)`);
  }

  // Workspace
  lesson.workspace = lesson.workspace || {};
  const ws = lesson.workspace;
  ws.files = ws.files || {};
  if (typeof ws.previewPort !== 'number') ws.previewPort = 3000; // repair
  const usesPreview = Array.isArray(lesson.scenes) && lesson.scenes.some((s) => s.focus === 'preview');
  const usesEditor = Array.isArray(lesson.scenes) && lesson.scenes.some((s) => s.focus === 'editor');
  if ((usesPreview || usesEditor) && Object.keys(ws.files).length === 0) {
    err('workspace.files must be non-empty when the lesson uses the editor or preview');
  }
  if (usesPreview && !ws.files['/index.html']) {
    warn('preview scenes usually need workspace.files["/index.html"]');
  }

  // Scenes
  if (!Array.isArray(lesson.scenes) || lesson.scenes.length < 2) {
    err('scenes must be an array of at least 2');
    return { ok: errors.length === 0, errors, warnings };
  }
  if (lesson.scenes.length > 40) warn('more than 40 scenes — consider splitting into a series');

  const seenIds = new Set();
  lesson.scenes.forEach((s, i) => {
    const at = `scene[${i}]`;
    if (!isStr(s.id)) s.id = `s${i + 1}`; // repair
    if (seenIds.has(s.id)) err(`${at}: duplicate scene id "${s.id}"`);
    seenIds.add(s.id);

    if (!TOOLS.has(s.focus)) err(`${at}: focus must be one of ${[...TOOLS].join(', ')}`);
    if (!isStr(s.narration)) err(`${at}: narration is required`);

    if (s.action) {
      if (s.action.tool !== s.focus) err(`${at}: action.tool (${s.action.tool}) must equal focus (${s.focus})`);
      const a = s.action;
      if (a.tool === 'editor') {
        if (!isStr(a.file) || !a.file.startsWith('/')) err(`${at}: editor action needs an absolute file path`);
        if (a.type == null && a.replace == null && !a.reveal && !a.callouts && !a.diagnostics)
          warn(`${at}: editor action has no type/replace/reveal/callouts/diagnostics`);
        for (const d of a.diagnostics || []) if (!(d.line >= 1)) err(`${at}: diagnostic.line must be >= 1`);
        for (const c of a.callouts || []) if (!(c.line >= 1)) err(`${at}: callout.line must be >= 1`);
      } else if (a.tool === 'database') {
        if (!isStr(a.query)) err(`${at}: database action needs a query`);
        if (!isStr(ws.dbSchema)) warn(`${at}: database scene but workspace.dbSchema is unset`);
      } else if (a.tool === 'terminal') {
        if (!isStr(a.run)) warn(`${at}: terminal action has no command`);
      } else if (a.tool === 'diagram') {
        if (!lesson.diagram || !Array.isArray(lesson.diagram.nodes) || !lesson.diagram.nodes.length)
          err(`${at}: diagram scene requires lesson.diagram.nodes`);
      }
    }
  });

  // Diagram referential integrity
  if (lesson.diagram) {
    const ids = new Set((lesson.diagram.nodes || []).map((n) => n.id));
    for (const e of lesson.diagram.edges || []) {
      if (!ids.has(e.from)) err(`diagram edge ${e.id}: unknown from "${e.from}"`);
      if (!ids.has(e.to)) err(`diagram edge ${e.id}: unknown to "${e.to}"`);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}
