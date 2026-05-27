#!/usr/bin/env node
/**
 * inspect-page.js — entry point
 *
 * Uso:
 *   node inspect-page.js --url https://example.com --width 1440 --height 768
 *
 * Triggers (en el navegador abierto):
 *   Ctrl+Shift+S  →  auto-scan / capturar (modo manual) / escanear cola
 *   Ctrl+Shift+M  →  activar/desactivar modo manual
 *   Ctrl+Shift+Q  →  activar/desactivar modo cola de selección
 *   Ctrl+Shift+X  →  cerrar herramienta
 */

import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { injectListeners, injectStatusBadge } from './src/browser-ui.js';
import { runInspection } from './src/scan.js';
import { generateSessionReport, generateMasterReport } from './src/reports.js';

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };
  const url = get('--url') ?? 'https://github.com/Jomruizgo/playwright-visual-inspector-';
  return {
    url,
    width:  parseInt(get('--width')  ?? '1440', 10),
    height: parseInt(get('--height') ?? '768',  10),
    out:    get('--out') ?? path.join(process.cwd(), 'evidencia', 'inspector'),
  };
}

function log(msg) { console.log(`[INSPECTOR] ${msg}`); }

async function main() {
  const { url, width, height, out } = parseArgs();
  const vp = { width, height };
  fs.mkdirSync(out, { recursive: true });

  log(`Iniciando browser → ${url}`);
  log(`Viewport: ${width} × ${height} | Salida: ${out}`);
  log('');

  const settingsFile = path.join(process.cwd(), 'visual-inspector-settings.json');
  const DEFAULT_SETTINGS = {
    colorFormat: 'hex',
    highlightColorSource: 'category',
    customHighlightColor: '#e74c3c',
    highlightThickness: 2,
    visibleProperties: {
      'element': true,
      'content': true,
      'font-family': true,
      'font-size': true,
      'font-weight': true,
      'color': true,
      'background': true,
      'text-align': true,
      'width': true,
      'height': true,
      'padding': true,
      'margin': true,
      'border': true,
      'overflow-x': false,
      'text-overflow': false,
      'white-space': false,
      'pos x': true,
      'pos y': true
    },
    responsiveDock: true,
    dockSide: 'right',
    dockWidth: 280
  };

  let settings = { ...DEFAULT_SETTINGS };
  if (fs.existsSync(settingsFile)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
      // Asegurar que estén todas las propiedades nuevas si las hubiera
      settings = { ...DEFAULT_SETTINGS, ...settings };
    } catch (err) {
      log(`Error leyendo configuración: ${err.message}`);
    }
  } else {
    fs.writeFileSync(settingsFile, JSON.stringify(DEFAULT_SETTINGS, null, 2), 'utf8');
  }

  const isDocked = settings.responsiveDock && (width <= 900);
  const playViewport = {
    width: isDocked ? (width + (settings.dockWidth || 280)) : width,
    height: height
  };

  const browser = await chromium.launch({ headless: false, slowMo: 50 });
  const ctx     = await browser.newContext({ viewport: playViewport });

  // Exponer función para guardar configuraciones desde el navegador
  await ctx.exposeFunction('__vi_saveSettingsNode', (newSettings) => {
    settings = { ...settings, ...newSettings };
    try {
      fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2), 'utf8');
    } catch (err) {
      log(`Error guardando configuración: ${err.message}`);
    }
  });

  // Inyectar configuraciones iniciales
  await ctx.addInitScript((s) => {
    window.__vi_settings = s;
  }, settings);

  const page    = await ctx.newPage();

  await page.goto(url, { waitUntil: 'load', timeout: 60000 });

  const inject = async () => {
    try {
      await injectListeners(page, vp);
      await injectStatusBadge(page, '⏸ Listo  (S=auto | M=manual | Q=cola | D=medición | X=cerrar)  [Ctrl+Shift+…]');
    } catch { /* navegación en curso */ }
  };

  page.on('load', inject);
  await inject();

  log('Browser abierto. Navega a la vista que quieras documentar.');
  log('Ctrl+Shift+S → auto-scan  |  Ctrl+Shift+M → manual  |  Ctrl+Shift+Q → cola  |  Ctrl+Shift+D → medición  |  Ctrl+Shift+X → cerrar');
  log('');

  let sessionNum     = 0;
  const allSessions  = [];
  let closed         = false;
  let manualMode     = false;
  let manualDir      = null;
  let manualCaptures = [];
  let manualIdx      = 0;

  page.on('console', async (msg) => {
    if (closed) return;
    const text = msg.text();

    if (text === '__INSPECT__') {
      sessionNum++;
      try {
        await injectStatusBadge(page, `⚙ Auto-scan sesión ${sessionNum}...`);
        const session = await runInspection(page, vp, out, sessionNum);
        allSessions.push(session);
        if (session.isModalScoped) {
          await injectStatusBadge(page, `✓ Sesión ${sessionNum} — scan acotado al modal`);
          await page.waitForTimeout(2500);
        }
        await inject();
      } catch (err) {
        log(`Error en auto-scan: ${err.message}`);
        await inject();
      }
    }

    if (text === '__TOGGLE_MANUAL__') {
      manualMode = !manualMode;

      if (manualMode) {
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
          fs.rmdirSync(manualDir, { recursive: true });
          sessionNum--;
        }
        manualDir = null;
        await inject();
      }
    }

    if (text === '__TOGGLE_QUEUE__') {
      const isQueue = await page.evaluate(() => window.__vi_mode === 'queue');
      if (isQueue) {
        await page.evaluate(() => {
          window.__vi_clearQueue();
          window.__vi_mode = 'idle';
          document.body.style.cursor = '';
        });
        await inject();
        log('Modo cola desactivado');
      } else {
        await page.evaluate(() => {
          window.__vi_mode = 'queue';
          document.body.style.cursor = 'cell';
          const s = document.querySelector('.__vi_status');
          if (s) { s.style.borderColor = '#a29bfe'; s.style.color = '#a29bfe'; s.textContent = '⬡ Cola — Alt+clic en los elementos que quieres escanear | Ctrl+Shift+Q cancela'; }
        });
        log('Modo cola activado — Alt+clic en los elementos que quieres escanear, luego Ctrl+Shift+S');
      }
    }

    if (text === '__INSPECT_QUEUED__') {
      sessionNum++;
      try {
        const queuedElements = await page.evaluate(() =>
          window.__vi_queue.map(item => {
            const el = item.el;
            const r  = el.getBoundingClientRect();
            return {
              category: 'Seleccion',
              color:    '#a29bfe',
              tag:      el.tagName.toLowerCase(),
              classList: [...el.classList].slice(0, 3).join('.'),
              text:     el.textContent.trim().substring(0, 60),
              discIdx:  item.discIdx,
              rect:     { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height },
            };
          })
        );
        await page.evaluate(() => {
          document.querySelectorAll('.__vi_queue_badge').forEach(e => e.remove());
        });
        await injectStatusBadge(page, `⬡ Escaneando cola (${queuedElements.length} elementos)...`);
        const session = await runInspection(page, vp, out, sessionNum, queuedElements);
        allSessions.push(session);
        await page.evaluate(() => {
          window.__vi_clearQueue();
          window.__vi_mode = 'idle';
          document.body.style.cursor = '';
        });
        await inject();
      } catch (err) {
        log(`Error en escaneo de cola: ${err.message}`);
        await inject();
      }
    }

    if (text === '__QUEUE_EMPTY__') {
      log('Cola vacía — usa Alt+clic para añadir elementos primero');
    }

    if (text === '__CAPTURE_MANUAL__') {
      if (!manualDir) return;
      manualIdx++;
      const filename = path.join(manualDir, `manual-${String(manualIdx).padStart(2, '0')}.png`);
      // Ocultar botón y panel de configuración antes del screenshot
      await page.evaluate(() => {
        const btn = document.querySelector('.__vi_btn_settings');
        const pnl = document.querySelector('.__vi_settings_panel');
        if (btn) btn.style.setProperty('display', 'none', 'important');
        if (pnl) pnl.style.setProperty('display', 'none', 'important');
      });
      await page.screenshot({ path: filename });
      manualCaptures.push(filename);
      log(`  ✓ Captura manual ${manualIdx} guardada`);
      await page.evaluate(() => {
        const btn = document.querySelector('.__vi_btn_settings');
        if (btn) btn.style.display = '';
        document.querySelectorAll('.__vi_overlay, .__vi_badge, .__vi_connector').forEach(e => e.remove());
        document.querySelectorAll('[data-__vi]').forEach(el => {
          el.style.outline = ''; el.style.outlineOffset = ''; delete el.dataset.__vi;
        });
        const s = document.querySelector('.__vi_status');
        if (s) s.textContent = '✦ Manual — clic en cualquier elemento';
      });
    }

    if (text === '__EXIT__') {
      closed = true;
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
