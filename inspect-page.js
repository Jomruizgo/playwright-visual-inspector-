#!/usr/bin/env node
/**
 * inspect-page.js — v2
 *
 * Uso:
 *   node inspect-page.js --url https://example.com --width 1440 --height 768
 *
 * Triggers (en el navegador abierto):
 *   Ctrl+Shift+S  →  auto-scan de la vista actual  /  capturar (en modo manual)
 *   Ctrl+Shift+M  →  activar/desactivar modo manual
 *   Ctrl+Shift+X  →  cerrar herramienta
 */

import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };
  const url = get('--url');
  if (!url) { console.error('[INSPECTOR] Error: --url es requerido.'); process.exit(1); }
  return {
    url,
    width:  parseInt(get('--width')  ?? '1440', 10),
    height: parseInt(get('--height') ?? '768',  10),
    out:    get('--out') ?? path.join(process.cwd(), 'evidencia', 'inspector'),
  };
}

function log(msg) { console.log(`[INSPECTOR] ${msg}`); }

// ── Categorías semánticas ─────────────────────────────────────────────────────

const CATEGORIES = [
  { name: 'Logo_Marca',    color: '#ff6b35', sel: 'header img, [class*="logo"] img, nav img, [class*="brand"] img' },
  { name: 'Header',        color: '#e74c3c', sel: 'header, [role="banner"]' },
  { name: 'Perfil_usuario',color: '#fd79a8', sel: '[class*="avatar"], [class*="user-info"], [class*="user-name"], [class*="username"], [class*="profile"], [class*="account-info"]' },
  { name: 'Navegacion',    color: '#e67e22', sel: 'nav a, aside a, [role="navigation"] a, [class*="sidebar"] a, [class*="nav"] a' },
  { name: 'Titulos',       color: '#3498db', sel: 'h1, h2, h3, h4' },
  { name: 'Parrafos',      color: '#9b59b6', sel: 'p, [class*="subtitle"], [class*="description"], [class*="caption"]' },
  { name: 'Inputs',        color: '#1abc9c', sel: 'input:not([type="hidden"]), textarea, select' },
  { name: 'Botones',       color: '#f39c12', sel: 'button, [role="button"], [type="submit"], [class*="logout"], [class*="signout"], [class*="cerrar-sesion"]' },
  { name: 'Links',         color: '#5dade2', sel: 'a[href]' },
  { name: 'Cab_tabla',     color: '#2980b9', sel: 'th, [role="columnheader"]' },
  { name: 'Celdas_datos',  color: '#27ae60', sel: 'tbody td, [role="cell"]' },
  { name: 'Badges',        color: '#e91e63', sel: '[class*="badge"], [class*="status"], [class*="chip"], [class*="tag"], [class*="pill"]' },
  { name: 'Paginacion',    color: '#8e44ad', sel: '[class*="pagination"] button, [aria-label*="page"], [aria-label*="página"]' },
  { name: 'Scroll_horiz',  color: '#95a5a6', sel: '[class*="table-wrap"], [class*="table-container"], [class*="scroll-x"], [class*="overflow-x"]' },
];

// ── Descubrimiento de elementos visibles ──────────────────────────────────────

async function discoverElements(page) {
  // Limpiar marcadores de discovery anteriores
  await page.evaluate(() => {
    document.querySelectorAll('[data-__vi-disc]').forEach(el => { delete el.dataset.__viDisc; });
  });

  return await page.evaluate((categories) => {
    const MAX_CELLS = 2;
    const seen = new Set();
    const results = [];
    let globalIdx = 0;
    const vpW = window.innerWidth, vpH = window.innerHeight;

    for (const cat of categories) {
      let nodes;
      try { nodes = Array.from(document.querySelectorAll(cat.sel)); }
      catch { continue; }

      const isTable = cat.name === 'Cab_tabla' || cat.name === 'Celdas_datos';
      let cellCount = 0;

      for (const el of nodes) {
        if (seen.has(el)) continue;

        const r = el.getBoundingClientRect();
        const cs = window.getComputedStyle(el);

        // Para tabla: relajar filtro horizontal (columnas fuera del viewport)
        const visX = isTable
          ? r.width > 0 && r.right > -100
          : r.width > 0 && r.left < vpW && r.right > 0;
        const visY = r.height > 0 && r.top < vpH && r.bottom > 0;
        const visStyle = cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0';

        if (!visX || !visY || !visStyle) continue;

        if (cat.name === 'Celdas_datos') {
          if (cellCount >= MAX_CELLS) continue;
          cellCount++;
        }

        seen.add(el);
        const discIdx = globalIdx++;
        el.dataset.__viDisc = String(discIdx);

        results.push({
          category: cat.name,
          color:    cat.color,
          tag:      el.tagName.toLowerCase(),
          classList: Array.from(el.classList).slice(0, 3).join('.'),
          text:     el.textContent.trim().substring(0, 60),
          discIdx,
          rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height },
        });
      }
    }
    return results;
  }, CATEGORIES);
}

// ── Captura de un elemento ────────────────────────────────────────────────────

async function captureElement(page, el, vp, sessionDir, idx) {
  const { category, color, classList, discIdx } = el;
  const label = `${String(idx + 1).padStart(2, '0')}-${category}`;
  const isTable = category === 'Cab_tabla' || category === 'Celdas_datos';

  // Paso 1: scroll para traer el elemento al viewport
  const found = await page.evaluate(({ discIdx, isTable }) => {
    const el = document.querySelector(`[data-__vi-disc="${discIdx}"]`);
    if (!el) return false;
    el.scrollIntoView({ block: 'nearest', inline: isTable ? 'start' : 'nearest' });
    return true;
  }, { discIdx, isTable });

  if (!found) {
    log(`  ⚠ ${label} — no encontrado en DOM, omitiendo`);
    return null;
  }

  await page.waitForTimeout(isTable ? 350 : 150);

  // Paso 2: inyectar panel y capturar
  const ok = await page.evaluate(({ discIdx, color, classList, vpW, vpH }) => {
    document.querySelectorAll('.__vi_overlay, .__vi_badge, .__vi_connector').forEach(e => e.remove());

    const el = document.querySelector(`[data-__vi-disc="${discIdx}"]`);
    if (!el) return false;

    const cs  = window.getComputedStyle(el);
    const rec = el.getBoundingClientRect();

    el.style.outline      = `2px solid ${color}`;
    el.style.outlineOffset = '2px';
    el.dataset.__vi        = '1';

    const rows = [
      ['element',       el.tagName.toLowerCase() + (classList ? '.' + classList : '')],
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

    const PANEL_W = 480, PANEL_H = rows.length * 18 + 28;
    const OUTLINE = 4, GAP = 12;
    const exp = { left: rec.left - OUTLINE, top: rec.top - OUTLINE, right: rec.right + OUTLINE, bottom: rec.bottom + OUTLINE };
    const cands = [
      { left: exp.right + GAP,         top: Math.max(8, exp.top) },
      { left: exp.left - GAP - PANEL_W, top: Math.max(8, exp.top) },
      { left: Math.max(8, exp.left),   top: exp.bottom + GAP },
      { left: Math.max(8, exp.left),   top: exp.top - GAP - PANEL_H },
    ];
    let pos = null;
    for (const c of cands) {
      const p = { ...c, right: c.left + PANEL_W, bottom: c.top + PANEL_H };
      if (p.left < 8 || p.right > vpW - 8 || p.top < 8 || p.bottom > vpH - 8) continue;
      if (!(p.right < exp.left || p.left > exp.right || p.bottom < exp.top || p.top > exp.bottom)) { pos = c; break; }
    }
    if (!pos) {
      const cx = (exp.left + exp.right) / 2, cy = (exp.top + exp.bottom) / 2;
      pos = { left: cx < vpW / 2 ? vpW - PANEL_W - 8 : 8, top: cy < vpH / 2 ? vpH - PANEL_H - 8 : 8 };
    }

    const KEY_W = 14;
    const lines = rows.map(([k, v]) => {
      if (k.startsWith('───')) return `<span style="color:#555">${k}</span>`;
      return `<span style="color:#808080">${(k + ' ').padEnd(KEY_W, '·')}</span> <span style="color:#9cdcfe">${v || ''}</span>`;
    });

    const panel = document.createElement('div');
    panel.className = '__vi_overlay';
    panel.style.cssText = `position:fixed;left:${pos.left}px;top:${pos.top}px;width:${PANEL_W}px;background:#1e1e1e;color:#d4d4d4;font-family:Consolas,monospace;font-size:11px;line-height:18px;padding:8px 10px 10px;border-radius:6px;border:1.5px solid ${color};z-index:2147483647;box-shadow:0 4px 20px rgba(0,0,0,.7);white-space:pre`;
    panel.innerHTML = `<div style="color:${color};font-weight:700;margin-bottom:4px">▶ ${el.tagName.toLowerCase()} [${color}]</div>` + lines.join('\n');
    document.body.appendChild(panel);
    if (window.__vi_drag) window.__vi_drag(panel);

    const badge = document.createElement('div');
    badge.className = '__vi_badge';
    badge.textContent = `${vpW} × ${vpH}`;
    badge.style.cssText = 'position:fixed;bottom:8px;right:8px;background:rgba(0,0,0,.65);color:#fff;font-family:monospace;font-size:11px;padding:3px 8px;border-radius:3px;z-index:2147483647';
    document.body.appendChild(badge);
    if (window.__vi_drag) window.__vi_drag(badge);

    return true;
  }, { discIdx, color, classList, vpW: vp.width, vpH: vp.height });

  if (!ok) return null;

  const filename = path.join(sessionDir, `${label}.png`);
  await page.screenshot({ path: filename });

  await page.evaluate(() => {
    document.querySelectorAll('.__vi_overlay, .__vi_badge, .__vi_connector').forEach(e => e.remove());
    document.querySelectorAll('[data-__vi]').forEach(el => {
      el.style.outline = ''; el.style.outlineOffset = ''; delete el.dataset.__vi;
    });
  });

  return filename;
}

// ── Reporte HTML de sesión ────────────────────────────────────────────────────

function generateSessionReport(sessionDir, metadata, autoCaps, manualCaps) {
  const renderGrid = (files, title) => {
    if (!files || files.filter(Boolean).length === 0) return '';
    const items = files.filter(Boolean).map(f => {
      const name = path.basename(f);
      return `<div class="item"><p class="label">${name}</p><img src="${name}" loading="lazy"></div>`;
    }).join('\n');
    return `<h3 class="section-title">${title}</h3><div class="grid">${items}</div>`;
  };

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Sesión ${metadata.sessionNum}${metadata.isManual ? ' (manual)' : ''} — ${metadata.url}</title>
<style>
  body { margin:0; background:#111; color:#ddd; font-family:sans-serif; }
  h1 { padding:16px; font-size:16px; background:#1e1e1e; margin:0; }
  h2 { padding:8px 16px; font-size:13px; color:#888; margin:0; }
  h3.section-title { padding:8px 16px 4px; font-size:12px; color:#f39c12; margin:0; text-transform:uppercase; letter-spacing:1px; }
  .grid { display:flex; flex-wrap:wrap; gap:12px; padding:8px 16px 16px; }
  .item { background:#1a1a1a; border-radius:6px; overflow:hidden; max-width:800px; }
  .item img { max-width:100%; display:block; }
  .label { margin:0; padding:6px 10px; font-size:11px; color:#9cdcfe; font-family:monospace; }
</style>
</head>
<body>
<h1>Sesión ${metadata.sessionNum}${metadata.isManual ? ' — manual' : ''} — ${metadata.url}</h1>
<h2>Viewport: ${metadata.vpW} × ${metadata.vpH} &nbsp;|&nbsp; ${new Date(metadata.timestamp).toLocaleString()} &nbsp;|&nbsp; ${(autoCaps || []).filter(Boolean).length + (manualCaps || []).filter(Boolean).length} capturas</h2>
${renderGrid(autoCaps, 'Auto-scan')}
${renderGrid(manualCaps, 'Capturas manuales')}
</body>
</html>`;

  fs.writeFileSync(path.join(sessionDir, 'index.html'), html);
}

// ── Reporte maestro HTML ──────────────────────────────────────────────────────

function generateMasterReport(outDir, sessions) {
  const links = sessions.map(s =>
    `<li><a href="${path.relative(outDir, s.dir)}/index.html">Sesión ${s.num}${s.isManual ? ' (manual)' : ''} — ${s.url} <span class="dim">${s.count} capturas</span></a></li>`
  ).join('\n');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Visual Inspector — Reporte</title>
<style>
  body { margin:0; background:#111; color:#ddd; font-family:sans-serif; }
  h1 { padding:20px; font-size:18px; background:#1e1e1e; margin:0; }
  ul { padding:20px 40px; }
  li { margin-bottom:10px; font-size:14px; }
  a { color:#9cdcfe; text-decoration:none; }
  a:hover { text-decoration:underline; }
  .dim { color:#666; font-size:12px; }
</style>
</head>
<body>
<h1>Visual Inspector — Reporte maestro</h1>
<ul>${links}</ul>
</body>
</html>`;

  const p = path.join(outDir, 'reporte-inspector.html');
  fs.writeFileSync(p, html);
  return p;
}

// ── Auto-scan de una sesión ───────────────────────────────────────────────────

async function runInspection(page, vp, outDir, sessionNum) {
  const url = page.url();
  const ts  = Date.now();
  const sessionDir = path.join(outDir, `sesion-${String(sessionNum).padStart(3, '0')}-${ts}`);
  fs.mkdirSync(sessionDir, { recursive: true });

  const hostname = new URL(url).hostname + new URL(url).pathname;
  log(`Sesión ${sessionNum} iniciada (${hostname})`);

  // Vista completa
  await page.evaluate((vp) => {
    document.querySelectorAll('.__vi_overlay, .__vi_badge, .__vi_connector').forEach(e => e.remove());
    const b = document.createElement('div');
    b.className = '__vi_badge';
    b.textContent = `${vp.width} × ${vp.height}`;
    b.style.cssText = 'position:fixed;bottom:8px;right:8px;background:rgba(0,0,0,.65);color:#fff;font-family:monospace;font-size:11px;padding:3px 8px;border-radius:3px;z-index:2147483647';
    document.body.appendChild(b);
    if (window.__vi_drag) window.__vi_drag(b);
  }, vp);
  await page.screenshot({ path: path.join(sessionDir, '00-vista-completa.png') });
  await page.evaluate(() => document.querySelectorAll('.__vi_badge').forEach(e => e.remove()));

  // Descubrir elementos
  const elements = await discoverElements(page);
  log(`  → ${elements.length} elementos en ${new Set(elements.map(e => e.category)).size} categorías`);

  if (elements.length === 0) {
    log('  → No se encontraron elementos visibles.');
    generateSessionReport(sessionDir, { sessionNum, url, vpW: vp.width, vpH: vp.height, timestamp: ts }, [], []);
    return { dir: sessionDir, url, num: sessionNum, count: 0 };
  }

  const updateStatus = async (t) => {
    await page.evaluate((t) => {
      let s = document.querySelector('.__vi_status');
      if (s) s.textContent = t;
    }, t);
  };

  const captured = [];
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    await updateStatus(`⚙ [${i + 1}/${elements.length}] ${el.category}`);
    process.stdout.write(`  → [${i + 1}/${elements.length}] ${el.category.padEnd(16)} `);
    const file = await captureElement(page, el, vp, sessionDir, i);
    captured.push(file);
    process.stdout.write(file ? '✓\n' : '⚠\n');
  }

  // Limpiar marcadores de discovery
  await page.evaluate(() => {
    document.querySelectorAll('[data-__vi-disc]').forEach(el => { delete el.dataset.__viDisc; });
  });

  const metadata = { sessionNum, url, vpW: vp.width, vpH: vp.height, timestamp: ts };
  generateSessionReport(sessionDir, metadata, captured, []);

  const count = captured.filter(Boolean).length;
  log(`  → Sesión ${sessionNum} completada. ${count} capturas en ${path.relative(process.cwd(), sessionDir)}/`);

  return { dir: sessionDir, url, num: sessionNum, count };
}

// ── Listeners inyectados en la página ────────────────────────────────────────

async function injectListeners(page, vp) {
  await page.evaluate(({ vpW, vpH }) => {
    if (window.__vi_listener) return;
    window.__vi_listener = true;
    window.__vi_mode = 'idle';
    window.__vi_el_A = null;

    // ── makeDraggable ──────────────────────────────────────────────────────────
    window.__vi_drag = function(el) {
      el.style.cursor = 'move';
      el.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        const r = el.getBoundingClientRect();
        el.style.right = 'auto'; el.style.bottom = 'auto';
        el.style.left = r.left + 'px'; el.style.top = r.top + 'px';
        const dx = e.clientX - r.left, dy = e.clientY - r.top;
        const mv = (ev) => { el.style.left = (ev.clientX - dx) + 'px'; el.style.top = (ev.clientY - dy) + 'px'; };
        const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); };
        document.addEventListener('mousemove', mv);
        document.addEventListener('mouseup', up);
        e.preventDefault(); e.stopPropagation();
      });
    };

    // ── showPanel (usado por el click handler del modo manual) ─────────────────
    window.__vi_showPanel = function(el) {
      document.querySelectorAll('.__vi_overlay, .__vi_badge, .__vi_connector').forEach(e => e.remove());

      const cs  = window.getComputedStyle(el);
      const rec = el.getBoundingClientRect();
      const cls = [...el.classList].slice(0, 3).join('.');

      const rows = [
        ['element',       el.tagName.toLowerCase() + (cls ? '.' + cls : '')],
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

      const PANEL_W = 480, PANEL_H = rows.length * 18 + 28;
      const OUTLINE = 4, GAP = 12;
      const exp = { left: rec.left - OUTLINE, top: rec.top - OUTLINE, right: rec.right + OUTLINE, bottom: rec.bottom + OUTLINE };
      const cands = [
        { left: exp.right + GAP,          top: Math.max(8, exp.top) },
        { left: exp.left - GAP - PANEL_W, top: Math.max(8, exp.top) },
        { left: Math.max(8, exp.left),    top: exp.bottom + GAP },
        { left: Math.max(8, exp.left),    top: exp.top - GAP - PANEL_H },
      ];
      let pos = null;
      for (const c of cands) {
        const p = { ...c, right: c.left + PANEL_W, bottom: c.top + PANEL_H };
        if (p.left < 8 || p.right > vpW - 8 || p.top < 8 || p.bottom > vpH - 8) continue;
        if (!(p.right < exp.left || p.left > exp.right || p.bottom < exp.top || p.top > exp.bottom)) { pos = c; break; }
      }
      if (!pos) {
        const cx = (exp.left + exp.right) / 2, cy = (exp.top + exp.bottom) / 2;
        pos = { left: cx < vpW / 2 ? vpW - PANEL_W - 8 : 8, top: cy < vpH / 2 ? vpH - PANEL_H - 8 : 8 };
      }

      const KEY_W = 14;
      const lines = rows.map(([k, v]) => {
        if (k.startsWith('───')) return `<span style="color:#555">${k}</span>`;
        return `<span style="color:#808080">${(k + ' ').padEnd(KEY_W, '·')}</span> <span style="color:#9cdcfe">${v || ''}</span>`;
      });

      const panel = document.createElement('div');
      panel.className = '__vi_overlay';
      panel.style.cssText = `position:fixed;left:${pos.left}px;top:${pos.top}px;width:${PANEL_W}px;background:#1e1e1e;color:#d4d4d4;font-family:Consolas,monospace;font-size:11px;line-height:18px;padding:8px 10px 10px;border-radius:6px;border:1.5px solid #f1c40f;z-index:2147483647;box-shadow:0 4px 20px rgba(0,0,0,.7);white-space:pre`;
      panel.innerHTML = `<div style="color:#f1c40f;font-weight:700;margin-bottom:4px">✦ ${el.tagName.toLowerCase()}</div>` + lines.join('\n');
      document.body.appendChild(panel);
      window.__vi_drag(panel);

      const badge = document.createElement('div');
      badge.className = '__vi_badge';
      badge.textContent = `${vpW} × ${vpH}`;
      badge.style.cssText = 'position:fixed;bottom:8px;right:8px;background:rgba(0,0,0,.65);color:#fff;font-family:monospace;font-size:11px;padding:3px 8px;border-radius:3px;z-index:2147483647';
      document.body.appendChild(badge);
      window.__vi_drag(badge);

      const s = document.querySelector('.__vi_status');
      if (s) s.textContent = '✦ Manual — Shift+clic para comparar | Ctrl+Shift+S para capturar | Ctrl+Shift+M para salir';
    };

    // ── showComparison (shift+clic sobre segundo elemento) ─────────────────────
    window.__vi_showComparison = function(elA, elB) {
      document.querySelectorAll('.__vi_overlay, .__vi_badge, .__vi_connector').forEach(e => e.remove());

      const recA = elA.getBoundingClientRect();
      const recB = elB.getBoundingClientRect();

      elA.style.outline      = '2px solid #f1c40f'; elA.style.outlineOffset = '2px'; elA.dataset.__vi = '1';
      elB.style.outline      = '2px solid #e74c3c'; elB.style.outlineOffset = '2px'; elB.dataset.__vi = '1';

      // SVG conector entre centros
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.className = '__vi_connector';
      svg.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:2147483646';
      const cx1 = recA.left + recA.width  / 2, cy1 = recA.top + recA.height / 2;
      const cx2 = recB.left + recB.width  / 2, cy2 = recB.top + recB.height / 2;
      const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      ln.setAttribute('x1', cx1); ln.setAttribute('y1', cy1);
      ln.setAttribute('x2', cx2); ln.setAttribute('y2', cy2);
      ln.setAttribute('stroke', 'rgba(255,255,255,0.45)');
      ln.setAttribute('stroke-width', '1.5');
      ln.setAttribute('stroke-dasharray', '6,4');
      svg.appendChild(ln);
      [[cx1, cy1, '#f1c40f'], [cx2, cy2, '#e74c3c']].forEach(([cx, cy, fill]) => {
        const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        c.setAttribute('cx', cx); c.setAttribute('cy', cy); c.setAttribute('r', '4'); c.setAttribute('fill', fill);
        svg.appendChild(c);
      });
      document.body.appendChild(svg);

      // Deltas
      const THRESHOLD = 2;
      const fmt = (v) => Math.round(v) + 'px';
      const delta = (a, b) => {
        const d = Math.round(b - a);
        return { a: fmt(a), b: fmt(b), d: (d >= 0 ? '+' : '') + d + 'px', ok: Math.abs(d) <= THRESHOLD };
      };
      const comparisons = [
        ['left',   delta(recA.left,   recB.left)],
        ['top',    delta(recA.top,    recB.top)],
        ['right',  delta(recA.right,  recB.right)],
        ['bottom', delta(recA.bottom, recB.bottom)],
        ['width',  delta(recA.width,  recB.width)],
        ['height', delta(recA.height, recB.height)],
      ];
      const aligned    = comparisons.filter(([, d]) => d.ok).length;
      const misaligned = comparisons.length - aligned;

      const labelA = elA.tagName.toLowerCase() + ([...elA.classList].slice(0,2).join('.') ? '.' + [...elA.classList].slice(0,2).join('.') : '');
      const labelB = elB.tagName.toLowerCase() + ([...elB.classList].slice(0,2).join('.') ? '.' + [...elB.classList].slice(0,2).join('.') : '');

      const tableRows = comparisons.map(([prop, d]) => {
        const clr = d.ok ? '#27ae60' : '#e74c3c';
        return `<tr><td style="color:#808080;padding-right:8px">${prop}</td><td style="color:#f1c40f;text-align:right;padding-right:8px">${d.a}</td><td style="color:#e74c3c;text-align:right;padding-right:8px">${d.b}</td><td style="color:${clr};text-align:right;padding-right:6px">${d.d}</td><td style="color:${clr}">${d.ok ? '✓' : '⚠'}</td></tr>`;
      }).join('');

      const PANEL_W = 420, PANEL_H = 210;
      const combined = {
        left:   Math.min(recA.left,   recB.left)   - 4,
        top:    Math.min(recA.top,    recB.top)    - 4,
        right:  Math.max(recA.right,  recB.right)  + 4,
        bottom: Math.max(recA.bottom, recB.bottom) + 4,
      };
      const cands = [
        { left: combined.right + 12,           top: Math.max(8, combined.top) },
        { left: combined.left  - 12 - PANEL_W, top: Math.max(8, combined.top) },
        { left: Math.max(8, combined.left),    top: combined.bottom + 12 },
        { left: Math.max(8, combined.left),    top: combined.top - 12 - PANEL_H },
      ];
      let pos = null;
      for (const c of cands) {
        const p = { ...c, right: c.left + PANEL_W, bottom: c.top + PANEL_H };
        if (p.left < 8 || p.right > vpW - 8 || p.top < 8 || p.bottom > vpH - 8) continue;
        if (!(p.right < combined.left || p.left > combined.right || p.bottom < combined.top || p.top > combined.bottom)) { pos = c; break; }
      }
      if (!pos) pos = { left: vpW - PANEL_W - 8, top: vpH - PANEL_H - 8 };

      const panel = document.createElement('div');
      panel.className = '__vi_overlay';
      panel.style.cssText = `position:fixed;left:${pos.left}px;top:${pos.top}px;width:${PANEL_W}px;background:#1e1e1e;color:#d4d4d4;font-family:Consolas,monospace;font-size:11px;line-height:18px;padding:10px 12px;border-radius:6px;border:1.5px solid #9b59b6;z-index:2147483647;box-shadow:0 4px 20px rgba(0,0,0,.8)`;
      panel.innerHTML = `<div style="color:#9b59b6;font-weight:700;margin-bottom:5px">⟺ Comparación de alineación</div><div style="margin-bottom:6px;font-size:10px"><span style="color:#f1c40f">A: ${labelA}</span> &nbsp; <span style="color:#e74c3c">B: ${labelB}</span></div><table style="border-collapse:collapse;width:100%"><tr style="font-size:10px;color:#555"><td style="padding-right:8px"></td><td style="color:#f1c40f;text-align:right;padding-right:8px">A</td><td style="color:#e74c3c;text-align:right;padding-right:8px">B</td><td style="text-align:right;padding-right:6px">Δ</td><td></td></tr>${tableRows}</table><div style="margin-top:7px;border-top:1px solid #333;padding-top:5px;font-size:10px"><span style="color:#27ae60">✓ ${aligned} alineados</span>${misaligned > 0 ? ` &nbsp; <span style="color:#e74c3c">⚠ ${misaligned} desviados</span>` : ''}</div>`;
      document.body.appendChild(panel);
      window.__vi_drag(panel);

      const badge = document.createElement('div');
      badge.className = '__vi_badge';
      badge.textContent = `${vpW} × ${vpH}`;
      badge.style.cssText = 'position:fixed;bottom:8px;right:8px;background:rgba(0,0,0,.65);color:#fff;font-family:monospace;font-size:11px;padding:3px 8px;border-radius:3px;z-index:2147483647';
      document.body.appendChild(badge);
      window.__vi_drag(badge);

      const s = document.querySelector('.__vi_status');
      if (s) s.textContent = '⟺ Comparación — Ctrl+Shift+S para capturar | clic para nueva selección';
    };

    // ── keydown ────────────────────────────────────────────────────────────────
    document.addEventListener('keydown', (e) => {
      if (!e.ctrlKey || !e.shiftKey) return;
      if (e.key === 'S') {
        e.preventDefault();
        console.log(window.__vi_mode === 'manual' ? '__CAPTURE_MANUAL__' : '__INSPECT__');
      } else if (e.key === 'M') {
        e.preventDefault();
        console.log('__TOGGLE_MANUAL__');
      } else if (e.key === 'X') {
        e.preventDefault();
        console.log('__EXIT__');
      }
    });

    // ── click (modo manual) ────────────────────────────────────────────────────
    document.addEventListener('click', (e) => {
      if (window.__vi_mode !== 'manual') return;
      // Ignorar clics en nuestros propios paneles
      let node = e.target;
      while (node) {
        const cls = typeof node.className === 'string' ? node.className : '';
        if (cls.includes('__vi_overlay') || cls.includes('__vi_badge') || cls.includes('__vi_status')) return;
        node = node.parentElement;
      }
      e.preventDefault();
      e.stopPropagation();
      const el = e.target;

      if (e.shiftKey && window.__vi_el_A && window.__vi_el_A !== el) {
        // Shift+clic: modo comparación con el elemento A ya seleccionado
        window.__vi_showComparison(window.__vi_el_A, el);
      } else {
        // Clic normal: seleccionar nuevo elemento A
        document.querySelectorAll('[data-__vi]').forEach(prev => {
          prev.style.outline = ''; prev.style.outlineOffset = ''; delete prev.dataset.__vi;
        });
        document.querySelectorAll('.__vi_connector').forEach(c => c.remove());
        el.style.outline       = '2px solid #f1c40f';
        el.style.outlineOffset = '2px';
        el.dataset.__vi        = '1';
        window.__vi_el_A       = el;
        window.__vi_showPanel(el);
      }
    }, true);

  }, { vpW: vp.width, vpH: vp.height });
}

async function injectStatusBadge(page, text) {
  await page.evaluate((t) => {
    let s = document.querySelector('.__vi_status');
    const isNew = !s;
    if (isNew) {
      s = document.createElement('div');
      s.className = '__vi_status';
      s.style.cssText = 'position:fixed;top:8px;right:8px;background:#1e1e1e;color:#27ae60;font-family:monospace;font-size:12px;padding:5px 10px;border-radius:5px;border:1px solid #27ae60;z-index:2147483647';
      document.body.appendChild(s);
      if (window.__vi_drag) window.__vi_drag(s);
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
  log(`Viewport: ${width} × ${height} | Salida: ${out}`);
  log('');

  const browser = await chromium.launch({ headless: false, slowMo: 50 });
  const ctx     = await browser.newContext({ viewport: vp });
  const page    = await ctx.newPage();

  await page.goto(url, { waitUntil: 'load', timeout: 60000 });

  const inject = async () => {
    try {
      await injectListeners(page, vp);
      await injectStatusBadge(page, '⏸ Listo  (Ctrl+Shift+S = auto | Ctrl+Shift+M = manual | Ctrl+Shift+X = cerrar)');
    } catch { /* navegación en curso */ }
  };

  page.on('load', inject);
  await inject();

  log('Browser abierto. Navega a la vista que quieras documentar.');
  log('Ctrl+Shift+S → auto-scan  |  Ctrl+Shift+M → modo manual  |  Ctrl+Shift+X → cerrar');
  log('');

  let sessionNum    = 0;
  const allSessions = [];
  let closed        = false;
  let manualMode    = false;
  let manualDir     = null;
  let manualCaptures = [];
  let manualIdx     = 0;

  page.on('console', async (msg) => {
    if (closed) return;
    const text = msg.text();

    // ── Auto-scan ────────────────────────────────────────────────────────────
    if (text === '__INSPECT__') {
      sessionNum++;
      try {
        await injectStatusBadge(page, `⚙ Auto-scan sesión ${sessionNum}...`);
        const session = await runInspection(page, vp, out, sessionNum);
        allSessions.push(session);
        await inject();
      } catch (err) {
        log(`Error en auto-scan: ${err.message}`);
        await inject();
      }
    }

    // ── Toggle modo manual ───────────────────────────────────────────────────
    if (text === '__TOGGLE_MANUAL__') {
      manualMode = !manualMode;

      if (manualMode) {
        // Crear sesión para capturas manuales
        sessionNum++;
        const ts = Date.now();
        manualDir = path.join(out, `sesion-${String(sessionNum).padStart(3, '0')}-${ts}-manual`);
        fs.mkdirSync(manualDir, { recursive: true });
        manualCaptures = [];
        manualIdx = 0;
        log(`Modo manual activado — sesión ${sessionNum}`);
        await page.evaluate(() => {
          window.__vi_mode = 'manual';
          document.body.style.cursor = 'crosshair';
          const s = document.querySelector('.__vi_status');
          if (s) { s.style.borderColor = '#f1c40f'; s.style.color = '#f1c40f'; s.textContent = '✦ Manual — clic en cualquier elemento'; }
        });
      } else {
        // Finalizar sesión manual
        await page.evaluate(() => {
          window.__vi_mode = 'idle';
          window.__vi_el_A = null;
          document.body.style.cursor = '';
          document.querySelectorAll('.__vi_overlay, .__vi_badge, .__vi_connector').forEach(e => e.remove());
          document.querySelectorAll('[data-__vi]').forEach(el => {
            el.style.outline = ''; el.style.outlineOffset = ''; delete el.dataset.__vi;
          });
        });
        if (manualCaptures.length > 0) {
          const sessionUrl = page.url();
          generateSessionReport(manualDir, { sessionNum, url: sessionUrl, vpW: vp.width, vpH: vp.height, timestamp: Date.now(), isManual: true }, [], manualCaptures);
          allSessions.push({ dir: manualDir, url: sessionUrl, num: sessionNum, count: manualCaptures.length, isManual: true });
          log(`Modo manual desactivado — ${manualCaptures.length} capturas guardadas en sesión ${sessionNum}`);
        } else {
          log('Modo manual desactivado — sin capturas');
          // Limpiar dir vacío
          fs.rmdirSync(manualDir, { recursive: true });
          sessionNum--;
        }
        manualDir = null;
        await inject();
      }
    }

    // ── Captura manual ────────────────────────────────────────────────────────
    if (text === '__CAPTURE_MANUAL__') {
      if (!manualDir) return;
      manualIdx++;
      const filename = path.join(manualDir, `manual-${String(manualIdx).padStart(2, '0')}.png`);
      await page.screenshot({ path: filename });
      manualCaptures.push(filename);
      log(`  ✓ Captura manual ${manualIdx} guardada`);
      // Limpiar paneles, mantener modo manual
      await page.evaluate(() => {
        document.querySelectorAll('.__vi_overlay, .__vi_badge, .__vi_connector').forEach(e => e.remove());
        document.querySelectorAll('[data-__vi]').forEach(el => {
          el.style.outline = ''; el.style.outlineOffset = ''; delete el.dataset.__vi;
        });
        const s = document.querySelector('.__vi_status');
        if (s) s.textContent = '✦ Manual — clic en cualquier elemento';
      });
    }

    // ── Cerrar ────────────────────────────────────────────────────────────────
    if (text === '__EXIT__') {
      closed = true;
      // Finalizar sesión manual pendiente
      if (manualMode && manualCaptures.length > 0) {
        generateSessionReport(manualDir, { sessionNum, url: page.url(), vpW: vp.width, vpH: vp.height, timestamp: Date.now(), isManual: true }, [], manualCaptures);
        allSessions.push({ dir: manualDir, url: page.url(), num: sessionNum, count: manualCaptures.length, isManual: true });
      }
      log('');
      log('Cerrando...');
      if (allSessions.length > 0) {
        const reportPath = generateMasterReport(out, allSessions);
        log(`  → Reporte final: ${path.relative(process.cwd(), reportPath)}`);
      }
      await browser.close();
      process.exit(0);
    }
  });

  await new Promise((resolve) => {
    browser.on('disconnected', resolve);
    process.on('SIGINT', async () => {
      if (!closed) {
        closed = true;
        if (manualMode && manualCaptures.length > 0) {
          generateSessionReport(manualDir, { sessionNum, url: page.url(), vpW: vp.width, vpH: vp.height, timestamp: Date.now(), isManual: true }, [], manualCaptures);
          allSessions.push({ dir: manualDir, url: page.url(), num: sessionNum, count: manualCaptures.length, isManual: true });
        }
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

main().catch((err) => { console.error('[INSPECTOR] Error fatal:', err); process.exit(1); });
