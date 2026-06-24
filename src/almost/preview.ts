// Boot a live in-browser web preview on top of the published `almostnode` core.
//
// This is the seam the `preview` tool uses: seed a set of files into an
// in-memory workspace, start a Vite dev server inside the browser, and route
// its requests through almostnode's service-worker bridge so the result can be
// shown in an <iframe>. React/JSX needs no npm install — the dev server
// transforms TSX via esbuild-wasm and injects an import map. Eruda devtools are
// injected into the preview HTML by the service worker (on by default).
//
// Adapted from almostnode's own examples/vite-demo.ts `startDevServer`.

import { createContainer, ViteDevServer, getServerBridge } from 'almostnode'

// The published .d.ts doesn't re-export ContainerInstance by name; derive it.
type ContainerInstance = ReturnType<typeof createContainer>

export interface PreviewHandle {
  container: ContainerInstance
  /** URL to put in the iframe src (already suffixed with `/`). */
  url: string
  stop: () => void
}

export type SeedFiles = Record<string, string>

// The service worker is a singleton for the whole page; initialise it once.
//
// almostnode's initServiceWorker() registers the SW and, on the *first* load,
// reloads the page so it becomes controlled (and gets COOP/COEP headers). Only
// once `navigator.serviceWorker.controller` is set will `/__virtual__/<port>/`
// requests be intercepted — otherwise the iframe falls through to our SPA and
// renders devreel recursively. So we resolve only when the page is controlled.
let swReady: Promise<void> | null = null
export function ensureServiceWorker(): Promise<void> {
  if (!swReady) {
    swReady = (async () => {
      const bridge = getServerBridge()
      // Suppress almostnode's first-load reload: it exists only so the SW can
      // inject COOP/COEP on the navigation response for static hosts that can't
      // set headers — but we set them in vite.config.ts (and the CF Worker). The
      // SW's activate handler calls clients.claim(), so we still become
      // controlled via a `controllerchange` event without the reload.
      try {
        sessionStorage.setItem('__almostnode_sw_init', '1')
      } catch {
        /* sessionStorage may be unavailable; reload path still works */
      }
      try {
        await bridge.initServiceWorker()
      } catch (err) {
        console.warn('[devreel] service worker init failed', err)
      }
      if (!navigator.serviceWorker?.controller) {
        await new Promise<void>((resolve) => {
          const done = () => resolve()
          navigator.serviceWorker?.addEventListener('controllerchange', done, { once: true })
          // Safety: on the first load initServiceWorker triggers a reload, so this
          // promise may simply be torn down. The timeout avoids a permanent hang
          // if controllerchange never fires on an already-isolated host.
          setTimeout(done, 4000)
        })
      }
    })()
  }
  return swReady
}

/** True once the SW controls the page and previews will be intercepted. */
export function isPreviewReady(): boolean {
  return !!navigator.serviceWorker?.controller
}

function seed(container: ContainerInstance, files: SeedFiles): void {
  for (const [path, content] of Object.entries(files)) {
    const dir = path.split('/').slice(0, -1).join('/')
    if (dir && dir !== '/') {
      container.vfs.mkdirSync(dir, { recursive: true })
    }
    container.vfs.writeFileSync(path, content)
  }
}

/** Minimal http.Server-compatible shim the bridge expects (see vite-demo.ts). */
function httpServerShim(server: ViteDevServer) {
  return {
    listening: true,
    address: () => ({ port: server.getPort(), address: '0.0.0.0', family: 'IPv4' }),
    async handleRequest(
      method: string,
      url: string,
      headers: Record<string, string>,
      body?: unknown,
    ) {
      return server.handleRequest(method, url, headers, body as never)
    },
  }
}

// Track live servers per port so a re-entrant boot (e.g. React StrictMode's
// double-invoke) tears down the previous one instead of leaking / racing the
// bridge registration.
const liveByPort = new Map<number, PreviewHandle>()

export async function startReactPreview(
  files: SeedFiles,
  opts: { port?: number } = {},
): Promise<PreviewHandle> {
  const port = opts.port ?? 3000

  await ensureServiceWorker()

  liveByPort.get(port)?.stop()

  const container = createContainer({ cwd: '/' })
  seed(container, files)

  const server = new ViteDevServer(container.vfs, { port, root: '/' })
  const bridge = getServerBridge()
  bridge.registerServer(httpServerShim(server) as never, port)
  server.start()

  const url = bridge.getServerUrl(port) + '/'
  const handle: PreviewHandle = {
    container,
    url,
    stop: () => {
      if (liveByPort.get(port) === handle) liveByPort.delete(port)
      try {
        server.stop()
      } catch {
        /* noop */
      }
      bridge.unregisterServer(port)
    },
  }
  liveByPort.set(port, handle)
  return handle
}

// The published almostnode SW injects no devtools/bridge, so we inject our own
// "agent bridge" into the seeded preview HTML. It (1) loads + controls Eruda
// devtools, (2) captures fetch/XHR so we can show + highlight network calls, and
// (3) exposes a Playwright-style command RPC over postMessage so the host can
// drive REAL DOM interactions (click/fill/type/hover/press) deterministically and
// animate a cursor to the returned element rect. Modeled on almostnode's shim.
const AGENT_BRIDGE = `
<script src="https://cdn.jsdelivr.net/npm/eruda"></script>
<script>
  (function () {
    // ---- Eruda devtools ---------------------------------------------------
    function erudaReady(fn, n) {
      n = n || 0;
      if (window.eruda && window.eruda._isInit) { try { fn(); } catch (e) {} return; }
      if (n < 80) setTimeout(function () { erudaReady(fn, n + 1); }, 50);
    }
    // useShadowDom:false so the host can query + click Eruda's network rows
    // (v3 defaults to a shadow root, which document.querySelector can't pierce).
    try { eruda.init({ useShadowDom: false, tool: ['console', 'network', 'elements', 'resources'], defaults: { theme: 'Dark' } }); } catch (e) {}
    function focusNetwork(url, n) {
      n = n || 0;
      var q = (url || '').toLowerCase();
      var rows = document.querySelectorAll('.eruda-network .eruda-request, .eruda-network tr, .eruda-network li');
      var hit = null;
      rows.forEach(function (r) { if (!hit && r.textContent && r.textContent.toLowerCase().indexOf(q) !== -1) hit = r; });
      if (hit) { hit.style.outline = '2px solid #38bdf8'; hit.style.background = 'rgba(56,189,248,0.18)'; hit.scrollIntoView({ block: 'center' }); }
      else if (n < 60) setTimeout(function () { focusNetwork(url, n + 1); }, 50);
    }

    // ---- network capture --------------------------------------------------
    function recordNet(entry) { try { parent.postMessage({ __devreel: 'net', entry: entry }, '*'); } catch (e) {} }
    var _fetch = window.fetch;
    if (_fetch) window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      var method = (init && init.method) || (input && input.method) || 'GET';
      var t0 = (performance && performance.now) ? performance.now() : Date.now();
      return _fetch.apply(this, arguments).then(function (r) {
        recordNet({ method: method, url: url, status: r.status, statusText: r.statusText, duration: Math.round(((performance.now ? performance.now() : Date.now())) - t0) });
        return r;
      }, function (err) { recordNet({ method: method, url: url, status: 0, statusText: String(err), duration: 0 }); throw err; });
    };
    var _open = XMLHttpRequest.prototype.open, _send = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (m, u) { this.__m = m; this.__u = u; return _open.apply(this, arguments); };
    XMLHttpRequest.prototype.send = function () {
      var x = this, t0 = Date.now();
      x.addEventListener('loadend', function () { recordNet({ method: x.__m || 'GET', url: x.__u || '', status: x.status, statusText: x.statusText, duration: Date.now() - t0 }); });
      return _send.apply(this, arguments);
    };

    // ---- Playwright-style command RPC ------------------------------------
    function rectOf(el) { var r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }
    function reply(id, ok, extra) { try { parent.postMessage(Object.assign({ __devreel: 'pw-result', id: id, ok: ok }, extra || {}), '*'); } catch (e) {} }
    function setNativeValue(el, value) {
      var proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      var d = Object.getOwnPropertyDescriptor(proto, 'value');
      if (d && d.set) d.set.call(el, value); else el.value = value;
      if (el._valueTracker) el._valueTracker.setValue(''); // let React see the change
    }
    function handle(m) {
      var el = m.selector ? document.querySelector(m.selector) : document.activeElement;
      if (m.cmd === 'waitFor') {
        var tries = 0;
        (function poll() {
          var t = document.querySelector(m.selector);
          if (t) return reply(m.id, true, { rect: rectOf(t) });
          if (tries++ < 80) setTimeout(poll, 50); else reply(m.id, false, { error: 'timeout: ' + m.selector });
        })();
        return;
      }
      if (m.selector && !el) return reply(m.id, false, { error: 'not found: ' + m.selector });
      try {
        if (m.cmd === 'locate') { el.scrollIntoView({ block: 'center' }); return reply(m.id, true, { rect: rectOf(el) }); }
        if (m.cmd === 'hover') { el.scrollIntoView({ block: 'center' }); el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })); return reply(m.id, true, { rect: rectOf(el) }); }
        if (m.cmd === 'click') { el.scrollIntoView({ block: 'center' }); var r = rectOf(el); if (typeof el.click === 'function') el.click(); else el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); return reply(m.id, true, { rect: r }); }
        if (m.cmd === 'fill') { el.focus(); setNativeValue(el, m.text || ''); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return reply(m.id, true, { rect: rectOf(el) }); }
        if (m.cmd === 'type') { var t = el || document.activeElement; var s = m.text || ''; for (var i = 0; i < s.length; i++) { var ch = s[i]; t.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: ch })); if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') setNativeValue(t, (t.value || '') + ch); t.dispatchEvent(new Event('input', { bubbles: true })); t.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: ch })); } return reply(m.id, true, {}); }
        if (m.cmd === 'press') { var p = el || document.activeElement; p.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: m.key })); p.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: m.key })); if (m.key === 'Enter' && p.form && p.form.requestSubmit) p.form.requestSubmit(); return reply(m.id, true, {}); }
        if (m.cmd === 'netRow' || m.cmd === 'netClick') { return handleNetRow(m); }
        if (m.cmd === 'netResponse') { return handleNetResponse(m); }
        reply(m.id, false, { error: 'unknown cmd: ' + m.cmd });
      } catch (err) { reply(m.id, false, { error: String(err) }); }
    }

    // Eruda network rows: cells render with no separators ("1GET200json..."), so
    // match the method as a plain substring (no word boundaries) and exclude the
    // header row (which contains the literal "Method"/"Status" labels).
    function netDataRows() {
      var rows = document.querySelectorAll('.eruda-network .eruda-request, .eruda-network tr, .eruda-network li');
      return [].slice.call(rows).filter(function (r) {
        if (r.offsetParent === null) return false;
        var txt = r.textContent || '';
        if (/Method/.test(txt) && /Status/.test(txt)) return false; // header row
        return /(GET|POST|PUT|DELETE|PATCH|HEAD)/i.test(txt) || /[1-5][0-9][0-9]/.test(txt);
      });
    }
    function handleNetRow(m) {
      var q = (m.match || '').toLowerCase();
      var tries = 0;
      (function poll() {
        var list = netDataRows();
        var hit = q ? list.filter(function (r) { return (r.textContent || '').toLowerCase().indexOf(q) !== -1; })[0] : null;
        if (!hit) hit = list[0];
        if (hit) {
          hit.scrollIntoView({ block: 'center' });
          if (m.cmd === 'netClick') { if (typeof hit.click === 'function') hit.click(); else hit.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); }
          return reply(m.id, true, { rect: rectOf(hit) });
        }
        if (tries++ < 80) setTimeout(poll, 50); else reply(m.id, false, { error: 'no network row' });
      })();
    }
    function handleNetResponse(m) {
      var tries = 0;
      (function poll() {
        var nodes = document.querySelectorAll('.eruda-network *');
        var hit = null;
        [].slice.call(nodes).forEach(function (el) {
          if (!hit && el.children.length === 0 && /^response$/i.test((el.textContent || '').trim())) hit = el;
        });
        if (hit) { hit.scrollIntoView({ block: 'center' }); return reply(m.id, true, { rect: rectOf(hit) }); }
        if (tries++ < 60) setTimeout(poll, 50); else reply(m.id, true, {}); // best-effort
      })();
    }

    window.addEventListener('message', function (e) {
      var m = e.data || {};
      if (m.__devreel === 'pw') return handle(m);
      if (m.__devreel === 'eruda-open') return erudaReady(function () { eruda.show(); if (m.tab) eruda.show(m.tab); });
      if (m.__devreel === 'eruda-hide') return erudaReady(function () { eruda.hide(); });
      if (m.__devreel === 'eruda-focus-network') return erudaReady(function () { eruda.show('network'); focusNetwork(m.url); });
    });
  })();
</script>
`

// almostnode's preview injects the React Fast Refresh preamble with a top-level
// `await import()` from esm.sh — a network race that can leave $RefreshReg$
// undefined when the app module evaluates, crashing the render. We don't need HMR
// for scripted lessons, so define no-op globals first (classic script in <head>,
// runs before any module). The real preamble may overwrite them later; harmless.
const REFRESH_GUARD =
  `<script>window.$RefreshReg$=window.$RefreshReg$||function(){};` +
  `window.$RefreshSig$=window.$RefreshSig$||function(){return function(t){return t}};</script>`

/** Prepare seed files: refresh guard in <head>, agent bridge before </body>. */
export function prepareSeed(files: SeedFiles): SeedFiles {
  const out = { ...files }
  let html = out['/index.html']
  if (html) {
    html = html.includes('<head>')
      ? html.replace('<head>', `<head>${REFRESH_GUARD}`)
      : REFRESH_GUARD + html
    html = html.includes('</body>')
      ? html.replace('</body>', `${AGENT_BRIDGE}\n</body>`)
      : html + AGENT_BRIDGE
    out['/index.html'] = html
  }
  return out
}

/** @deprecated use prepareSeed */
export const injectEruda = prepareSeed
