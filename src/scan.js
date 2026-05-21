import path from 'path';
import fs from 'fs';
import { generateSessionReport } from './reports.js';

function log(msg) { console.log(`[INSPECTOR] ${msg}`); }

export const CATEGORIES = [
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

export async function discoverElements(page) {
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
        if (el.closest('.__vi_status, .__vi_overlay, .__vi_badge, .__vi_connector, .__vi_queue_badge')) continue;

        const r = el.getBoundingClientRect();
        const cs = window.getComputedStyle(el);

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

export async function captureElement(page, el, vp, sessionDir, idx) {
  const { category, color, classList, discIdx } = el;
  const label = `${String(idx + 1).padStart(2, '0')}-${category}`;
  const isTable = category === 'Cab_tabla' || category === 'Celdas_datos';

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

  const ok = await page.evaluate(({ discIdx, color, classList, vpW, vpH }) => {
    document.querySelectorAll('.__vi_overlay, .__vi_badge, .__vi_connector').forEach(e => e.remove());
    document.querySelectorAll('[data-__vi-disc]').forEach(e => { e.style.outline = ''; e.style.outlineOffset = ''; });

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

export async function runInspection(page, vp, outDir, sessionNum, prebuiltElements = null) {
  const url = page.url();
  const ts  = Date.now();
  const suffix = prebuiltElements ? '-cola' : '';
  const sessionDir = path.join(outDir, `sesion-${String(sessionNum).padStart(3, '0')}-${ts}${suffix}`);
  fs.mkdirSync(sessionDir, { recursive: true });

  const hostname = new URL(url).hostname + new URL(url).pathname;
  log(`Sesión ${sessionNum} iniciada (${hostname})${prebuiltElements ? ` — ${prebuiltElements.length} elementos en cola` : ''}`);

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

  const elements = prebuiltElements ?? await discoverElements(page);
  if (!prebuiltElements)
    log(`  → ${elements.length} elementos en ${new Set(elements.map(e => e.category)).size} categorías`);

  if (elements.length === 0) {
    log('  → No se encontraron elementos visibles.');
    generateSessionReport(sessionDir, { sessionNum, url, vpW: vp.width, vpH: vp.height, timestamp: ts }, [], []);
    return { dir: sessionDir, url, num: sessionNum, count: 0 };
  }

  const updateStatus = async (t) => {
    await page.evaluate((t) => {
      const s = document.querySelector('.__vi_status');
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

  await page.evaluate(() => {
    document.querySelectorAll('[data-__vi-disc]').forEach(el => { delete el.dataset.__viDisc; });
  });

  const metadata = { sessionNum, url, vpW: vp.width, vpH: vp.height, timestamp: ts, isQueued: !!prebuiltElements };
  generateSessionReport(sessionDir, metadata, captured, []);

  const count = captured.filter(Boolean).length;
  log(`  → Sesión ${sessionNum} completada. ${count} capturas en ${path.relative(process.cwd(), sessionDir)}/`);

  return { dir: sessionDir, url, num: sessionNum, count, isQueued: !!prebuiltElements };
}
