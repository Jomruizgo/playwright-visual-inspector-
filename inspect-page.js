#!/usr/bin/env node
/**
 * inspect-page.js
 * Herramienta genérica de inspección visual de páginas web.
 *
 * Uso:
 *   node inspect-page.js --url https://example.com --width 1440 --height 768
 *
 * Triggers (en el navegador abierto):
 *   Ctrl+Shift+S  →  iniciar inspección de la vista actual
 *   Ctrl+Shift+X  →  cerrar herramienta
 */

import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import readline from 'readline';
import { fileURLToPath } from 'url';

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag) => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : null;
  };
  const url = get('--url');
  if (!url) {
    console.error('[INSPECTOR] Error: --url es requerido.');
    process.exit(1);
  }
  return {
    url,
    width:  parseInt(get('--width')  ?? '1440', 10),
    height: parseInt(get('--height') ?? '768',  10),
    out:    get('--out') ?? path.join(process.cwd(), 'evidencia', 'inspector'),
  };
}

function log(msg) {
  console.log(`[INSPECTOR] ${msg}`);
}

function slugify(str) {
  return str.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_').substring(0, 30);
}

// ── Categorías semánticas ─────────────────────────────────────────────────────

const CATEGORIES = [
  { name: 'Logo_Marca',    color: '#ff6b35', sel: 'header img, [class*="logo"] img, nav img, [class*="brand"] img' },
  { name: 'Header',        color: '#e74c3c', sel: 'header, [role="banner"]' },
  { name: 'Navegacion',    color: '#e67e22', sel: 'nav a, aside a, [role="navigation"] a, [class*="sidebar"] a, [class*="nav"] a' },
  { name: 'Titulos',       color: '#3498db', sel: 'h1, h2, h3, h4' },
  { name: 'Parrafos',      color: '#9b59b6', sel: 'p, [class*="subtitle"], [class*="description"], [class*="caption"]' },
  { name: 'Inputs',        color: '#1abc9c', sel: 'input:not([type="hidden"]), textarea, select' },
  { name: 'Botones',       color: '#f39c12', sel: 'button, [role="button"], [type="submit"]' },
  { name: 'Links',         color: '#5dade2', sel: 'a[href]' },
  { name: 'Cab_tabla',     color: '#2980b9', sel: 'th, [role="columnheader"]' },
  { name: 'Celdas_datos',  color: '#27ae60', sel: 'tbody td, [role="cell"]' },
  { name: 'Badges',        color: '#e91e63', sel: '[class*="badge"], [class*="status"], [class*="chip"], [class*="tag"], [class*="pill"]' },
  { name: 'Paginacion',    color: '#8e44ad', sel: '[class*="pagination"] button, [aria-label*="page"], [aria-label*="página"]' },
];

// ── Posicionamiento del panel (sin overlap con el elemento) ───────────────────

function positionPanel(elRect, panelW, panelH, vpW, vpH) {
  const OUTLINE = 4;
  const GAP     = 12;

  const el = {
    left:   elRect.left   - OUTLINE,
    top:    elRect.top    - OUTLINE,
    right:  elRect.right  + OUTLINE,
    bottom: elRect.bottom + OUTLINE,
  };

  const candidates = [
    { left: el.right + GAP,          top: Math.max(8, el.top) },
    { left: el.left - GAP - panelW,  top: Math.max(8, el.top) },
    { left: Math.max(8, el.left),    top: el.bottom + GAP },
    { left: Math.max(8, el.left),    top: el.top - GAP - panelH },
  ];

  for (const pos of candidates) {
    const p = { ...pos, right: pos.left + panelW, bottom: pos.top + panelH };
    if (p.left < 8 || p.right > vpW - 8) continue;
    if (p.top  < 8 || p.bottom > vpH - 8) continue;
    const overlaps = !(p.right < el.left || p.left > el.right ||
                       p.bottom < el.top || p.top  > el.bottom);
    if (!overlaps) return pos;
  }

  // Fallback: esquina más alejada del centro del elemento
  const elCx = (el.left + el.right)  / 2;
  const elCy = (el.top  + el.bottom) / 2;
  return {
    left: elCx < vpW / 2 ? vpW - panelW - 8 : 8,
    top:  elCy < vpH / 2 ? vpH - panelH - 8 : 8,
  };
}

// ── Descubrimiento de elementos visibles ──────────────────────────────────────

async function discoverElements(page) {
  return await page.evaluate((categories) => {
    const MAX_CELLS = 2;
    const seen = new Set();
    const results = [];

    for (const cat of categories) {
      let nodes;
      try { nodes = Array.from(document.querySelectorAll(cat.sel)); }
      catch { continue; }

      let cellCount = 0;
      for (const el of nodes) {
        if (seen.has(el)) continue;

        const r = el.getBoundingClientRect();
        const cs = window.getComputedStyle(el);
        const visible = r.width > 0 && r.height > 0
          && r.top < window.innerHeight && r.bottom > 0
          && r.left < window.innerWidth && r.right > 0
          && cs.visibility !== 'hidden'
          && cs.display !== 'none'
          && cs.opacity !== '0';

        if (!visible) continue;

        if (cat.name === 'Celdas_datos') {
          if (cellCount >= MAX_CELLS) continue;
          cellCount++;
        }

        seen.add(el);
        results.push({
          category:  cat.name,
          color:     cat.color,
          tag:       el.tagName.toLowerCase(),
          classList: Array.from(el.classList).slice(0, 3).join('.'),
          text:      el.textContent.trim().substring(0, 60),
          rect: {
            left:   r.left,
            top:    r.top,
            right:  r.right,
            bottom: r.bottom,
            width:  r.width,
            height: r.height,
          },
        });
      }
    }
    return results;
  }, CATEGORIES);
}

// ── Captura de un elemento ────────────────────────────────────────────────────

async function captureElement(page, el, vp, sessionDir, idx) {
  const { category, color, tag, classList, rect } = el;
  const label = `${String(idx + 1).padStart(2, '0')}-${category}`;

  // Scroll al elemento si está fuera del viewport (por y)
  if (rect.top < 0 || rect.bottom > vp.height) {
    await page.evaluate((r) => window.scrollBy(0, r.top - 100), rect);
    await page.waitForTimeout(300);
  }

  const result = await page.evaluate(
    ({ r, color, tag, classList, text, vpW, vpH }) => {
      // Limpiar overlays anteriores
      document.querySelectorAll('.__vi_overlay, .__vi_badge').forEach(e => e.remove());

      // Encontrar el elemento por coordenadas exactas (más fiable que pasar el nodo)
      const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (!el) return null;

      const cs  = window.getComputedStyle(el);
      const rec = el.getBoundingClientRect();

      // Outline en el elemento
      const prevOutline       = el.style.outline;
      const prevOutlineOffset = el.style.outlineOffset;
      el.style.outline        = `2px solid ${color}`;
      el.style.outlineOffset  = '2px';
      el.dataset.__vi         = '1';

      // Propiedades
      const rows = [
        ['element',       `${el.tagName.toLowerCase()}${classList ? '.' + classList : ''}`],
        ['content',       el.textContent.trim().substring(0, 60) || '—'],
        ['───────────', ''],
        ['font-family',   cs.fontFamily],
        ['font-size',     cs.fontSize],
        ['font-weight',   cs.fontWeight],
        ['color',         cs.color],
        ['background',    cs.backgroundColor],
        ['text-align',    cs.textAlign],
        ['───────────', ''],
        ['width',         Math.round(rec.width)  + 'px'],
        ['height',        Math.round(rec.height) + 'px'],
        ['padding',       cs.padding],
        ['margin',        cs.margin],
        ['border',        cs.border],
        ['overflow-x',    cs.overflowX],
        ['text-overflow', cs.textOverflow],
        ['white-space',   cs.whiteSpace],
        ['───────────', ''],
        ['pos x',         Math.round(rec.left) + 'px'],
        ['pos y',         Math.round(rec.top)  + 'px'],
      ];

      const PANEL_W = 480;
      const PANEL_H = rows.length * 18 + 28;

      // Posicionamiento (calculado en page context — misma lógica que positionPanel)
      const OUTLINE_PX = 4, GAP = 12;
      const expanded = {
        left:   rec.left   - OUTLINE_PX,
        top:    rec.top    - OUTLINE_PX,
        right:  rec.right  + OUTLINE_PX,
        bottom: rec.bottom + OUTLINE_PX,
      };
      const candidates = [
        { left: expanded.right + GAP,          top: Math.max(8, expanded.top) },
        { left: expanded.left - GAP - PANEL_W, top: Math.max(8, expanded.top) },
        { left: Math.max(8, expanded.left),    top: expanded.bottom + GAP },
        { left: Math.max(8, expanded.left),    top: expanded.top - GAP - PANEL_H },
      ];
      let pos = null;
      for (const c of candidates) {
        const p = { ...c, right: c.left + PANEL_W, bottom: c.top + PANEL_H };
        if (p.left < 8 || p.right > vpW - 8) continue;
        if (p.top  < 8 || p.bottom > vpH - 8) continue;
        const overlaps = !(p.right < expanded.left || p.left > expanded.right ||
                           p.bottom < expanded.top || p.top > expanded.bottom);
        if (!overlaps) { pos = c; break; }
      }
      if (!pos) {
        const cx = (expanded.left + expanded.right)  / 2;
        const cy = (expanded.top  + expanded.bottom) / 2;
        pos = {
          left: cx < vpW / 2 ? vpW - PANEL_W - 8 : 8,
          top:  cy < vpH / 2 ? vpH - PANEL_H - 8 : 8,
        };
      }

      // Panel DOM
      const panel = document.createElement('div');
      panel.className = '__vi_overlay';
      panel.style.cssText = [
        'position:fixed',
        `left:${pos.left}px`,
        `top:${pos.top}px`,
        `width:${PANEL_W}px`,
        'background:#1e1e1e',
        'color:#d4d4d4',
        'font-family:Consolas,monospace',
        'font-size:11px',
        'line-height:18px',
        'padding:8px 10px 10px',
        'border-radius:6px',
        `border:1.5px solid ${color}`,
        'z-index:2147483647',
        'box-shadow:0 4px 20px rgba(0,0,0,0.7)',
        'pointer-events:none',
        'white-space:pre',
      ].join(';');

      const KEY_W = 14;
      const lines = rows.map(([k, v]) => {
        if (k.startsWith('───')) return `<span style="color:#555">${k}</span>`;
        const key = (k + ' ').padEnd(KEY_W, '·');
        const val = v ? `<span style="color:#9cdcfe">${v}</span>` : '';
        return `<span style="color:#808080">${key}</span> ${val}`;
      });

      const header = `<div style="color:${color};font-weight:700;margin-bottom:4px">`
        + `▶ ${el.tagName.toLowerCase()} [${color}]</div>`;
      panel.innerHTML = header + lines.join('\n');
      document.body.appendChild(panel);

      // Badge viewport
      const badge = document.createElement('div');
      badge.className = '__vi_badge';
      badge.textContent = `${vpW} × ${vpH}`;
      badge.style.cssText = [
        'position:fixed',
        'bottom:8px',
        'right:8px',
        'background:rgba(0,0,0,0.65)',
        'color:#fff',
        'font-family:monospace',
        'font-size:11px',
        'padding:3px 8px',
        'border-radius:3px',
        'z-index:2147483647',
        'pointer-events:none',
      ].join(';');
      document.body.appendChild(badge);

      return {
        prevOutline,
        prevOutlineOffset,
        elSelector: el.tagName.toLowerCase() + (el.id ? '#' + el.id : ''),
        panelH: PANEL_H,
      };
    },
    { r: rect, color, tag, classList, text: el.text, vpW: vp.width, vpH: vp.height }
  );

  if (!result) {
    log(`  ⚠ ${label} — elemento no encontrado en DOM, omitiendo`);
    return null;
  }

  const filename = path.join(sessionDir, `${label}.png`);
  await page.screenshot({ path: filename });

  // Limpiar
  await page.evaluate(() => {
    document.querySelectorAll('.__vi_overlay, .__vi_badge').forEach(e => e.remove());
    document.querySelectorAll('[data-__vi]').forEach(el => {
      el.style.outline = '';
      el.style.outlineOffset = '';
      delete el.dataset.__vi;
    });
  });

  return filename;
}

// ── Reporte HTML de sesión ────────────────────────────────────────────────────

function generateSessionReport(sessionDir, metadata, elements) {
  const items = elements
    .filter(Boolean)
    .map((f, i) => {
      const name = path.basename(f);
      return `<div class="item">
        <p class="label">${name}</p>
        <img src="${name}" loading="lazy">
      </div>`;
    })
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Sesión ${metadata.sessionNum} — ${metadata.url}</title>
<style>
  body { margin:0; background:#111; color:#ddd; font-family:sans-serif; }
  h1   { padding:16px; font-size:16px; background:#1e1e1e; margin:0; }
  h2   { padding:8px 16px; font-size:13px; color:#888; margin:0; }
  .grid { display:flex; flex-wrap:wrap; gap:12px; padding:16px; }
  .item { background:#1a1a1a; border-radius:6px; overflow:hidden; max-width:800px; }
  .item img  { max-width:100%; display:block; }
  .label { margin:0; padding:6px 10px; font-size:11px; color:#9cdcfe; font-family:monospace; }
</style>
</head>
<body>
<h1>Sesión ${metadata.sessionNum} — ${metadata.url}</h1>
<h2>Viewport: ${metadata.vpW} × ${metadata.vpH} &nbsp;|&nbsp; ${new Date(metadata.timestamp).toLocaleString()} &nbsp;|&nbsp; ${elements.filter(Boolean).length} capturas</h2>
<div class="grid">
${items}
</div>
</body>
</html>`;

  fs.writeFileSync(path.join(sessionDir, 'index.html'), html);
}

// ── Reporte maestro HTML ──────────────────────────────────────────────────────

function generateMasterReport(outDir, sessions) {
  const sessionLinks = sessions.map((s) =>
    `<li><a href="${path.relative(outDir, s.dir)}/index.html">
      Sesión ${s.num} — ${s.url} &nbsp;<span class="dim">${s.count} capturas</span>
    </a></li>`
  ).join('\n');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Visual Inspector — Reporte</title>
<style>
  body { margin:0; background:#111; color:#ddd; font-family:sans-serif; }
  h1   { padding:20px; font-size:18px; background:#1e1e1e; margin:0; }
  ul   { padding:20px 40px; }
  li   { margin-bottom:10px; font-size:14px; }
  a    { color:#9cdcfe; text-decoration:none; }
  a:hover { text-decoration:underline; }
  .dim { color:#666; font-size:12px; }
</style>
</head>
<body>
<h1>Visual Inspector — Reporte maestro</h1>
<ul>
${sessionLinks}
</ul>
</body>
</html>`;

  const reportPath = path.join(outDir, 'reporte-inspector.html');
  fs.writeFileSync(reportPath, html);
  return reportPath;
}

// ── Inspección de una sesión ──────────────────────────────────────────────────

async function runInspection(page, vp, outDir, sessionNum) {
  const url       = page.url();
  const ts        = Date.now();
  const dirName   = `sesion-${String(sessionNum).padStart(3, '0')}-${ts}`;
  const sessionDir = path.join(outDir, dirName);
  fs.mkdirSync(sessionDir, { recursive: true });

  const hostname = new URL(url).hostname + new URL(url).pathname;
  log(`Sesión ${sessionNum} iniciada (${hostname})`);

  // Screenshot completo de la vista
  await page.evaluate((vp) => {
    document.querySelectorAll('.__vi_overlay, .__vi_badge, .__vi_status').forEach(e => e.remove());
    const badge = document.createElement('div');
    badge.className = '__vi_badge';
    badge.textContent = `${vp.width} × ${vp.height}`;
    badge.style.cssText = 'position:fixed;bottom:8px;right:8px;background:rgba(0,0,0,0.65);color:#fff;font-family:monospace;font-size:11px;padding:3px 8px;border-radius:3px;z-index:2147483647;pointer-events:none';
    document.body.appendChild(badge);
  }, vp);
  await page.screenshot({ path: path.join(sessionDir, '00-vista-completa.png') });
  await page.evaluate(() => document.querySelectorAll('.__vi_badge').forEach(e => e.remove()));

  // Descubrir elementos
  const elements = await discoverElements(page);
  log(`  → ${elements.length} elementos encontrados en ${new Set(elements.map(e => e.category)).size} categorías`);

  if (elements.length === 0) {
    log('  → No se encontraron elementos visibles.');
    return { dir: sessionDir, url, num: sessionNum, count: 0 };
  }

  // Actualizar badge de estado en la página (visible solo en el browser, no en screenshots)
  const updateStatus = async (text) => {
    await page.evaluate((t) => {
      let s = document.querySelector('.__vi_status');
      if (!s) {
        s = document.createElement('div');
        s.className = '__vi_status';
        s.style.cssText = 'position:fixed;top:8px;right:8px;background:#1e1e1e;color:#f39c12;font-family:monospace;font-size:12px;padding:5px 10px;border-radius:5px;border:1px solid #f39c12;z-index:2147483647;pointer-events:none';
        document.body.appendChild(s);
      }
      s.textContent = t;
    }, text);
  };

  const captured = [];
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    await updateStatus(`⚙ [${i + 1}/${elements.length}] ${el.category}`);
    process.stdout.write(`  → [${i + 1}/${elements.length}] ${el.category.padEnd(14)} `);
    const file = await captureElement(page, el, vp, sessionDir, i);
    captured.push(file);
    process.stdout.write(file ? '✓\n' : '⚠\n');
  }

  // Limpiar status badge
  await page.evaluate(() => document.querySelectorAll('.__vi_status').forEach(e => e.remove()));

  const metadata = { sessionNum, url, vpW: vp.width, vpH: vp.height, timestamp: ts };
  generateSessionReport(sessionDir, metadata, captured);

  const count = captured.filter(Boolean).length;
  log(`  → Sesión ${sessionNum} completada. ${count} capturas en ${path.relative(process.cwd(), sessionDir)}/`);

  return { dir: sessionDir, url, num: sessionNum, count };
}

// ── Listener de teclado inyectado en la página ────────────────────────────────

async function injectKeyboardListener(page) {
  await page.evaluate(() => {
    if (window.__vi_listener) return;
    window.__vi_listener = true;
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        console.log('__INSPECT__');
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'X') {
        e.preventDefault();
        console.log('__EXIT__');
      }
    });
  });
}

async function injectStatusBadge(page, text) {
  await page.evaluate((t) => {
    let s = document.querySelector('.__vi_status');
    if (!s) {
      s = document.createElement('div');
      s.className = '__vi_status';
      s.style.cssText = 'position:fixed;top:8px;right:8px;background:#1e1e1e;color:#27ae60;font-family:monospace;font-size:12px;padding:5px 10px;border-radius:5px;border:1px solid #27ae60;z-index:2147483647;pointer-events:none';
      document.body.appendChild(s);
    }
    s.textContent = t;
  }, text);
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { url, width, height, out } = parseArgs();
  const vp = { width, height };
  fs.mkdirSync(out, { recursive: true });

  log(`Iniciando browser → ${url}`);
  log(`Viewport: ${width} × ${height}`);
  log(`Salida: ${out}`);
  log('');

  const browser = await chromium.launch({ headless: false, slowMo: 50 });
  const ctx     = await browser.newContext({ viewport: vp });
  const page    = await ctx.newPage();

  await page.goto(url, { waitUntil: 'load', timeout: 60000 });

  // Inyectar listener después de cada carga
  const inject = async () => {
    try {
      await injectKeyboardListener(page);
      await injectStatusBadge(page, '⏸ Listo  (Ctrl+Shift+S = inspeccionar  |  Ctrl+Shift+X = cerrar)');
    } catch { /* navegación en curso */ }
  };

  page.on('load', inject);
  await inject();

  log('Browser abierto. Navega a la vista que quieras documentar.');
  log('Ctrl+Shift+S → inspeccionar  |  Ctrl+Shift+X → cerrar');
  log('');

  let sessionNum    = 0;
  const allSessions = [];
  let closed        = false;

  // Escuchar mensajes de consola del browser
  page.on('console', async (msg) => {
    if (closed) return;
    const text = msg.text();

    if (text === '__INSPECT__') {
      sessionNum++;
      try {
        await injectStatusBadge(page, `⚙ Inspeccionando sesión ${sessionNum}...`);
        const session = await runInspection(page, vp, out, sessionNum);
        allSessions.push(session);
        await inject(); // restaurar badge de listo
      } catch (err) {
        log(`Error durante inspección: ${err.message}`);
        await inject();
      }
    }

    if (text === '__EXIT__') {
      closed = true;
      log('');
      log('Cerrando...');
      const reportPath = generateMasterReport(out, allSessions);
      log(`  → Reporte final: ${path.relative(process.cwd(), reportPath)}`);
      await browser.close();
      process.exit(0);
    }
  });

  // Esperar hasta que el browser se cierre manualmente o por __EXIT__
  await new Promise((resolve) => {
    browser.on('disconnected', resolve);
    process.on('SIGINT', async () => {
      if (!closed) {
        closed = true;
        log('\nInterrupción recibida. Cerrando...');
        if (allSessions.length > 0) {
          const reportPath = generateMasterReport(out, allSessions);
          log(`  → Reporte final: ${path.relative(process.cwd(), reportPath)}`);
        }
        await browser.close().catch(() => {});
      }
      resolve();
    });
  });
}

main().catch((err) => {
  console.error('[INSPECTOR] Error fatal:', err);
  process.exit(1);
});
