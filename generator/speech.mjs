// Turn on-screen narration into a smoother *spoken* script: drop markdown and
// rewrite code-ish symbols that read terribly aloud. Ported from the orly engine
// speech.ts `speechify`. A scene's `say` field bypasses this.
export function speechify(text) {
  return String(text)
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\*/g, ' ')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/(?<=[A-Za-z0-9])\.(?=[A-Za-z0-9])/g, ' dot ')
    .replace(/->|→|⇄|⟶/g, ' to ')
    .replace(/\/?__([a-z0-9]+)__\/?/gi, ' $1 ')
    .replace(/__/g, ' ')
    .replace(/_/g, ' ')
    .replace(/[(){}\[\]<>]/g, ' ')
    .replace(/\//g, ' ')
    .replace(/~/g, ' ')
    .replace(/·/g, ', ')
    .replace(/&/g, ' and ')
    .replace(/\s=\s/g, ' equals ')
    .replace(/\s\|\s/g, ' or ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
