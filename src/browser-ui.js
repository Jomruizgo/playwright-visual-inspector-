export async function injectListeners(page, vp) {
  await page.evaluate(({ vpW, vpH }) => {
    if (window.__vi_listener) return;
    window.__vi_listener = true;
    window.__vi_mode = 'idle';
    window.__vi_el_A = null;
    window.__vi_queue = [];
    window.__vi_q_counter = 0;

    // ── Cargar y fusionar configuraciones ──────────────────────────────────────
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
    
    const savedSettings = localStorage.getItem('__vi_settings');
    window.__vi_settings = savedSettings 
      ? { ...DEFAULT_SETTINGS, ...window.__vi_settings, ...JSON.parse(savedSettings) } 
      : { ...DEFAULT_SETTINGS, ...window.__vi_settings };

    // ── Utilidad: applyDockStyles ──────────────────────────────────────────────
    window.__vi_applyDockStyles = function() {
      const isDocked = window.__vi_settings.responsiveDock && (vpW <= 900);
      const styleId = '__vi_dock_layout_styles';
      let style = document.getElementById(styleId);
      
      if (isDocked) {
        if (!style) {
          style = document.createElement('style');
          style.id = styleId;
          document.head.appendChild(style);
        }
        const width = window.__vi_settings.dockWidth || 280;

        style.innerHTML = `
          html, body {
            width: ${vpW}px !important;
            max-width: ${vpW}px !important;
            min-width: ${vpW}px !important;
            margin-right: ${width}px !important;
            margin-left: 0 !important;
            box-sizing: border-box !important;
            overflow-x: hidden !important;
          }
        `;
      } else {
        if (style) style.remove();
      }
    };

    // Aplicar estilos de docking al cargar
    window.__vi_applyDockStyles();

    // ── Utilidad: rgbToHex ──────────────────────────────────────────────────────
    window.__vi_rgbToHex = function(rgbStr) {
      if (!rgbStr || rgbStr === 'rgba(0, 0, 0, 0)' || rgbStr === 'transparent') return 'transparent';
      const match = rgbStr.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
      if (!match) return rgbStr;
      
      const r = parseInt(match[1], 10);
      const g = parseInt(match[2], 10);
      const b = parseInt(match[3], 10);
      const a = match[4] !== undefined ? parseFloat(match[4]) : 1;
      
      const hex = (x) => x.toString(16).padStart(2, '0');
      
      if (a < 1) {
        const alphaHex = Math.round(a * 255).toString(16).padStart(2, '0');
        return `#${hex(r)}${hex(g)}${hex(b)}${alphaHex}`.toUpperCase();
      }
      return `#${hex(r)}${hex(g)}${hex(b)}`.toUpperCase();
    };

    // ── Inyectar Estilos del Configurador ─────────────────────────────────────
    if (!document.getElementById('__vi_settings_styles')) {
      const style = document.createElement('style');
      style.id = '__vi_settings_styles';
      style.innerHTML = `
        .__vi_btn_settings {
          position: fixed;
          top: 8px;
          left: 8px;
          background: #1e1e1ecc;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          color: #f1c40f;
          border: 1.5px solid #f1c40f;
          padding: 6px 12px;
          border-radius: 6px;
          z-index: 2147483647;
          cursor: pointer;
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 11px;
          font-weight: 600;
          box-shadow: 0 4px 15px rgba(0,0,0,0.5);
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          align-items: center;
          gap: 6px;
          user-select: none;
        }
        .__vi_btn_settings:hover {
          background: #f1c40f;
          color: #1e1e1e;
          box-shadow: 0 4px 20px rgba(241, 196, 15, 0.4);
          transform: translateY(-1px);
        }
        .__vi_btn_settings:active {
          transform: translateY(0);
        }
        
        .__vi_settings_panel {
          position: fixed;
          top: 45px;
          left: 8px;
          width: 320px;
          max-height: 80vh;
          background: rgba(30, 30, 30, 0.95);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          color: #e0e0e0;
          border: 1.5px solid #f1c40f;
          border-radius: 10px;
          padding: 14px;
          z-index: 2147483647;
          box-shadow: 0 10px 30px rgba(0,0,0,0.6);
          display: none;
          flex-direction: column;
          gap: 12px;
          overflow-y: auto;
          box-sizing: border-box;
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 12px;
        }
        
        .__vi_settings_section {
          border-bottom: 1px solid #333;
          padding-bottom: 10px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .__vi_settings_section:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }
        
        .__vi_settings_title {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #888;
          font-weight: 700;
          margin-bottom: 4px;
        }
        
        .__vi_row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        }
        
        .__vi_radio_group {
          display: flex;
          background: #2a2a2a;
          border-radius: 6px;
          padding: 2px;
          border: 1px solid #444;
        }
        .__vi_radio_btn {
          padding: 4px 10px;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s ease;
          font-weight: 600;
          font-size: 11px;
          user-select: none;
        }
        .__vi_radio_btn.active {
          background: #f1c40f;
          color: #1e1e1e;
        }
        
        .__vi_checkbox_grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 6px;
          max-height: 180px;
          overflow-y: auto;
          padding: 4px;
          background: #252525;
          border-radius: 6px;
          border: 1px solid #333;
        }
        
        .__vi_checkbox_label {
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          font-family: monospace;
          font-size: 11px;
          user-select: none;
        }
        .__vi_checkbox_label input {
          cursor: pointer;
          accent-color: #f1c40f;
        }
        
        .__vi_input_range {
          flex-grow: 1;
          accent-color: #f1c40f;
          cursor: pointer;
        }
        
        .__vi_color_picker_wrap {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .__vi_color_input {
          border: none;
          background: none;
          width: 32px;
          height: 24px;
          cursor: pointer;
          padding: 0;
        }
      `;
      document.head.appendChild(style);
    }

    // ── Inyectar Botón y Panel de Ajustes ────────────────────────────────────
    if (!document.querySelector('.__vi_btn_settings')) {
      const settings = window.__vi_settings;

      const btn = document.createElement('div');
      btn.className = '__vi_btn_settings';
      btn.innerHTML = `<span>⚙</span><span>Ajustes</span>`;
      document.body.appendChild(btn);

      const panel = document.createElement('div');
      panel.className = '__vi_settings_panel';
      
      panel.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #444;padding-bottom:8px;margin-bottom:6px;">
          <span style="color:#f1c40f;font-weight:700;font-size:13px;letter-spacing:0.5px;">⚙ CONFIGURACIÓN</span>
          <span id="__vi_close_settings" style="cursor:pointer;font-size:16px;color:#888;font-weight:bold;">&times;</span>
        </div>
        
        <!-- Formato de Color -->
        <div class="__vi_settings_section">
          <div class="__vi_settings_title">Formato de Color</div>
          <div class="__vi_row">
            <span>Mostrar colores en:</span>
            <div class="__vi_radio_group" id="__vi_opt_color_format">
              <div class="__vi_radio_btn ${settings.colorFormat === 'hex' ? 'active' : ''}" data-value="hex">Hex</div>
              <div class="__vi_radio_btn ${settings.colorFormat === 'rgb' ? 'active' : ''}" data-value="rgb">RGB</div>
            </div>
          </div>
        </div>
        
        <!-- Recuadro (Highlight) -->
        <div class="__vi_settings_section">
          <div class="__vi_settings_title">Recuadro del Elemento</div>
          <div class="__vi_row">
            <span>Espesor de línea:</span>
            <span id="__vi_thickness_val" style="font-weight:bold;color:#f1c40f;">${settings.highlightThickness}px</span>
          </div>
          <div class="__vi_row">
            <input type="range" class="__vi_input_range" id="__vi_opt_thickness" min="1" max="8" value="${settings.highlightThickness}">
          </div>
          
          <div class="__vi_row" style="margin-top:4px;">
            <span>Color de recuadro:</span>
            <div class="__vi_radio_group" id="__vi_opt_color_source">
              <div class="__vi_radio_btn ${settings.highlightColorSource === 'category' ? 'active' : ''}" data-value="category">Categoría</div>
              <div class="__vi_radio_btn ${settings.highlightColorSource === 'custom' ? 'active' : ''}" data-value="custom">Personalizado</div>
            </div>
          </div>
          
          <div class="__vi_row" id="__vi_custom_color_row" style="display: ${settings.highlightColorSource === 'custom' ? 'flex' : 'none'};">
            <span>Color personalizado:</span>
            <div class="__vi_color_picker_wrap">
              <input type="color" class="__vi_color_input" id="__vi_opt_custom_color" value="${settings.customHighlightColor}">
              <span id="__vi_custom_color_text" style="font-family:monospace;font-size:11px;">${settings.customHighlightColor}</span>
            </div>
          </div>
        </div>
        
        <!-- Propiedades Visibles -->
        <div class="__vi_settings_section">
          <div class="__vi_settings_title">Propiedades a Mostrar</div>
          <div class="__vi_checkbox_grid" id="__vi_opt_properties">
            ${Object.keys(settings.visibleProperties).map(prop => `
              <label class="__vi_checkbox_label">
                <input type="checkbox" data-prop="${prop}" ${settings.visibleProperties[prop] ? 'checked' : ''}>
                <span>${prop}</span>
              </label>
            `).join('')}
          </div>
        </div>

        <!-- Acoplamiento Responsivo -->
        <div class="__vi_settings_section">
          <div class="__vi_settings_title">Diseño Responsivo (Celular/Tablet)</div>
          <div class="__vi_row">
            <span>Fijar lateral en pantallas &le; 900px:</span>
            <input type="checkbox" id="__vi_opt_responsive_dock" ${settings.responsiveDock ? 'checked' : ''} style="accent-color:#f1c40f;cursor:pointer;">
          </div>
          
          <div id="__vi_dock_options" style="display: ${settings.responsiveDock ? 'block' : 'none'}; margin-top: 4px;">
            <div class="__vi_row">
              <span>Ancho de barra:</span>
              <span id="__vi_dock_width_val" style="font-weight:bold;color:#f1c40f;">${settings.dockWidth}px</span>
            </div>
            <div class="__vi_row">
              <input type="range" class="__vi_input_range" id="__vi_opt_dock_width" min="200" max="450" value="${settings.dockWidth}">
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(panel);

      const saveSettings = () => {
        localStorage.setItem('__vi_settings', JSON.stringify(window.__vi_settings));
        if (window.__vi_saveSettingsNode) {
          window.__vi_saveSettingsNode(window.__vi_settings);
        }
        if (window.__vi_el_A && window.__vi_mode === 'manual') {
          const thickness = window.__vi_settings.highlightThickness || 2;
          const color = window.__vi_settings.highlightColorSource === 'custom' 
            ? window.__vi_settings.customHighlightColor 
            : '#f1c40f';
          window.__vi_el_A.style.outline = `${thickness}px solid ${color}`;
          window.__vi_showPanel(window.__vi_el_A);
        }
      };

      btn.addEventListener('click', () => {
        const isVisible = panel.style.display === 'flex';
        panel.style.display = isVisible ? 'none' : 'flex';
      });
      panel.querySelector('#__vi_close_settings').addEventListener('click', () => {
        panel.style.display = 'none';
      });

      panel.querySelectorAll('#__vi_opt_color_format .__vi_radio_btn').forEach(b => {
        b.addEventListener('click', () => {
          panel.querySelectorAll('#__vi_opt_color_format .__vi_radio_btn').forEach(x => x.classList.remove('active'));
          b.classList.add('active');
          window.__vi_settings.colorFormat = b.dataset.value;
          saveSettings();
        });
      });

      const thicknessInput = panel.querySelector('#__vi_opt_thickness');
      const thicknessVal = panel.querySelector('#__vi_thickness_val');
      thicknessInput.addEventListener('input', () => {
        thicknessVal.textContent = `${thicknessInput.value}px`;
        window.__vi_settings.highlightThickness = parseInt(thicknessInput.value, 10);
        saveSettings();
      });

      const customColorRow = panel.querySelector('#__vi_custom_color_row');
      panel.querySelectorAll('#__vi_opt_color_source .__vi_radio_btn').forEach(b => {
        b.addEventListener('click', () => {
          panel.querySelectorAll('#__vi_opt_color_source .__vi_radio_btn').forEach(x => x.classList.remove('active'));
          b.classList.add('active');
          window.__vi_settings.highlightColorSource = b.dataset.value;
          customColorRow.style.display = b.dataset.value === 'custom' ? 'flex' : 'none';
          saveSettings();
        });
      });

      const colorPicker = panel.querySelector('#__vi_opt_custom_color');
      const colorText = panel.querySelector('#__vi_custom_color_text');
      colorPicker.addEventListener('input', () => {
        colorText.textContent = colorPicker.value.toUpperCase();
        window.__vi_settings.customHighlightColor = colorPicker.value;
        saveSettings();
      });

      panel.querySelectorAll('#__vi_opt_properties input').forEach(cb => {
        cb.addEventListener('change', () => {
          const prop = cb.dataset.prop;
          window.__vi_settings.visibleProperties[prop] = cb.checked;
          saveSettings();
        });
      });

      const responsiveDockCheckbox = panel.querySelector('#__vi_opt_responsive_dock');
      const dockOptionsDiv = panel.querySelector('#__vi_dock_options');
      responsiveDockCheckbox.addEventListener('change', () => {
        window.__vi_settings.responsiveDock = responsiveDockCheckbox.checked;
        dockOptionsDiv.style.display = responsiveDockCheckbox.checked ? 'block' : 'none';
        saveSettings();
      });

      const dockWidthInput = panel.querySelector('#__vi_opt_dock_width');
      const dockWidthVal = panel.querySelector('#__vi_dock_width_val');
      dockWidthInput.addEventListener('input', () => {
        dockWidthVal.textContent = `${dockWidthInput.value}px`;
        window.__vi_settings.dockWidth = parseInt(dockWidthInput.value, 10);
        saveSettings();
      });

      if (!sessionStorage.getItem('__vi_settings_shown')) {
        panel.style.display = 'flex';
        sessionStorage.setItem('__vi_settings_shown', 'true');
      }
    }

    window.__vi_clearQueue = function() {
      window.__vi_queue.forEach(item => {
        item.el.style.outline = ''; item.el.style.outlineOffset = '';
        delete item.el.dataset.__viDisc;
        if (item.badge) item.badge.remove();
      });
      window.__vi_queue = [];
    };

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

    // ── showPanel (modo manual) ────────────────────────────────────────────────
    window.__vi_showPanel = function(el) {
      document.querySelectorAll('.__vi_overlay, .__vi_badge, .__vi_connector').forEach(e => e.remove());

      const cs  = window.getComputedStyle(el);
      const rec = el.getBoundingClientRect();
      const cls = [...el.classList].slice(0, 3).join('.');

      // Filtrar y dar formato a las propiedades
      const rows = [];
      const showProp = (k) => window.__vi_settings.visibleProperties[k];
      const formatColor = (c) => window.__vi_settings.colorFormat === 'hex' ? window.__vi_rgbToHex(c) : c;

      // Secciones dinámicas
      let s1 = [];
      if (showProp('element')) s1.push(['element', el.tagName.toLowerCase() + (cls ? '.' + cls : '')]);
      if (showProp('content')) s1.push(['content', el.textContent.trim().substring(0, 60) || '—']);
      if (s1.length) rows.push(...s1);

      let s2 = [];
      if (showProp('font-family')) s2.push(['font-family', cs.fontFamily]);
      if (showProp('font-size')) s2.push(['font-size', cs.fontSize]);
      if (showProp('font-weight')) s2.push(['font-weight', cs.fontWeight]);
      if (showProp('color')) s2.push(['color', formatColor(cs.color)]);
      if (showProp('background')) s2.push(['background', formatColor(cs.backgroundColor)]);
      if (showProp('text-align')) s2.push(['text-align', cs.textAlign]);
      if (s2.length) {
        if (rows.length) rows.push(['───────────', '']);
        rows.push(...s2);
      }

      let s3 = [];
      if (showProp('width')) s3.push(['width', Math.round(rec.width) + 'px']);
      if (showProp('height')) s3.push(['height', Math.round(rec.height) + 'px']);
      if (showProp('padding')) s3.push(['padding', cs.padding]);
      if (showProp('margin')) s3.push(['margin', cs.margin]);
      if (showProp('border')) s3.push(['border', cs.border]);
      if (showProp('overflow-x')) s3.push(['overflow-x', cs.overflowX]);
      if (showProp('text-overflow')) s3.push(['text-overflow', cs.textOverflow]);
      if (showProp('white-space')) s3.push(['white-space', cs.whiteSpace]);
      if (s3.length) {
        if (rows.length) rows.push(['───────────', '']);
        rows.push(...s3);
      }

      let s4 = [];
      if (showProp('pos x')) s4.push(['pos x', Math.round(rec.left) + 'px']);
      if (showProp('pos y')) s4.push(['pos y', Math.round(rec.top) + 'px']);
      if (s4.length) {
        if (rows.length) rows.push(['───────────', '']);
        rows.push(...s4);
      }

      const panelColor = window.__vi_settings.highlightColorSource === 'custom' 
        ? window.__vi_settings.customHighlightColor 
        : '#f1c40f';

      // Determinar si se acopla a un lado en base al diseño responsivo (ancho <= 900)
      const isDocked = window.__vi_settings.responsiveDock && (vpW <= 900);

      const PANEL_W = isDocked ? (window.__vi_settings.dockWidth || 280) : 480;
      const PANEL_H = rows.length * 18 + 28;

      let cssText = '';
      if (isDocked) {
        cssText = `position:fixed;right:0;top:0;bottom:0;width:${PANEL_W}px;height:100vh;background:#1e1e1ee6;backdrop-filter:blur(8px);color:#d4d4d4;font-family:Consolas,monospace;font-size:11px;line-height:18px;padding:12px;z-index:2147483647;box-shadow:0 0 20px rgba(0,0,0,.7);white-space:pre;overflow-y:auto;box-sizing:border-box;margin:0;border-radius:0;border-left:2.5px solid ${panelColor}`;
      } else {
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
        cssText = `position:fixed;left:${pos.left}px;top:${pos.top}px;width:${PANEL_W}px;background:#1e1e1e;color:#d4d4d4;font-family:Consolas,monospace;font-size:11px;line-height:18px;padding:8px 10px 10px;border-radius:6px;border:1.5px solid ${panelColor};z-index:2147483647;box-shadow:0 4px 20px rgba(0,0,0,.7);white-space:pre`;
      }

      const KEY_W = 14;
      const lines = rows.map(([k, v]) => {
        if (k.startsWith('───')) return `<span style="color:#555">${k}</span>`;
        return `<span style="color:#808080">${(k + ' ').padEnd(KEY_W, '·')}</span> <span style="color:#9cdcfe">${v || ''}</span>`;
      });

      const panel = document.createElement('div');
      panel.className = '__vi_overlay';
      panel.style.cssText = cssText;
      panel.innerHTML = `<div style="color:${panelColor};font-weight:700;margin-bottom:4px">✦ ${el.tagName.toLowerCase()}</div>` + lines.join('\n');
      document.body.appendChild(panel);
      
      // Solo habilitar arrastrado si no está acoplado lateralmente
      if (!isDocked) {
        window.__vi_drag(panel);
      }

      const badge = document.createElement('div');
      badge.className = '__vi_badge';
      badge.textContent = `${vpW} × ${vpH}`;
      badge.style.cssText = 'position:fixed;bottom:8px;right:8px;background:rgba(0,0,0,.65);color:#fff;font-family:monospace;font-size:11px;padding:3px 8px;border-radius:3px;z-index:2147483647';
      document.body.appendChild(badge);
      window.__vi_drag(badge);

      const s = document.querySelector('.__vi_status');
      if (s) s.textContent = '✦ Manual — Shift+clic para comparar | Ctrl+Shift+S para capturar | Ctrl+Shift+M para salir';
    };

    // ── showComparison (Shift+clic sobre segundo elemento) ─────────────────────
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
        if      (window.__vi_mode === 'manual') console.log('__CAPTURE_MANUAL__');
        else if (window.__vi_mode === 'queue')  console.log(window.__vi_queue.length ? '__INSPECT_QUEUED__' : '__QUEUE_EMPTY__');
        else                                    console.log('__INSPECT__');
      } else if (e.key === 'M') {
        e.preventDefault();
        console.log('__TOGGLE_MANUAL__');
      } else if (e.key === 'Q') {
        e.preventDefault();
        console.log('__TOGGLE_QUEUE__');
      } else if (e.key === 'X') {
        e.preventDefault();
        console.log('__EXIT__');
      }
    });

    // ── click (modo manual) ────────────────────────────────────────────────────
    document.addEventListener('click', (e) => {
      if (window.__vi_mode !== 'manual') return;
      let node = e.target;
      while (node) {
        const cls = typeof node.className === 'string' ? node.className : '';
        if (
          cls.includes('__vi_overlay') || 
          cls.includes('__vi_badge') || 
          cls.includes('__vi_status') ||
          cls.includes('__vi_btn_settings') ||
          cls.includes('__vi_settings_panel')
        ) return;
        node = node.parentElement;
      }
      e.preventDefault();
      e.stopPropagation();
      const el = e.target;

      const thickness = window.__vi_settings.highlightThickness || 2;
      const color = window.__vi_settings.highlightColorSource === 'custom' 
        ? window.__vi_settings.customHighlightColor 
        : '#f1c40f';

      if (e.shiftKey && window.__vi_el_A && window.__vi_el_A !== el) {
        window.__vi_showComparison(window.__vi_el_A, el);
      } else {
        document.querySelectorAll('[data-__vi]').forEach(prev => {
          prev.style.outline = ''; prev.style.outlineOffset = ''; delete prev.dataset.__vi;
        });
        document.querySelectorAll('.__vi_connector').forEach(c => c.remove());
        el.style.outline       = `${thickness}px solid ${color}`;
        el.style.outlineOffset = '2px';
        el.dataset.__vi        = '1';
        window.__vi_el_A       = el;
        window.__vi_showPanel(el);
      }
    }, true);

    // ── Alt+clic (modo cola de selección) ─────────────────────────────────────
    document.addEventListener('click', (e) => {
      if (window.__vi_mode !== 'queue' || !e.altKey) return;
      let node = e.target;
      while (node) {
        const cls = typeof node.className === 'string' ? node.className : '';
        if (cls.includes('__vi_status') || cls.includes('__vi_queue_badge') ||
            cls.includes('__vi_btn_settings') || cls.includes('__vi_settings_panel')) return;
        node = node.parentElement;
      }
      e.preventDefault(); e.stopPropagation();
      const el = e.target;
      const existingIdx = window.__vi_queue.findIndex(item => item.el === el);
      if (existingIdx !== -1) {
        const item = window.__vi_queue.splice(existingIdx, 1)[0];
        item.el.style.outline = ''; item.el.style.outlineOffset = '';
        delete item.el.dataset.__viDisc;
        if (item.badge) item.badge.remove();
        window.__vi_queue.forEach((it, i) => { if (it.badge) it.badge.textContent = i + 1; });
      } else {
        const discIdx = `q_${++window.__vi_q_counter}`;
        el.dataset.__viDisc    = discIdx;
        el.style.outline       = '2px solid #a29bfe';
        el.style.outlineOffset = '2px';
        const rec = el.getBoundingClientRect();
        const badge = document.createElement('div');
        badge.className = '__vi_queue_badge';
        badge.textContent = window.__vi_queue.length + 1;
        badge.style.cssText = `position:fixed;left:${Math.round(rec.left)}px;top:${Math.round(rec.top)}px;min-width:16px;background:#a29bfe;color:#1e1e1e;font-family:monospace;font-size:10px;font-weight:700;text-align:center;padding:1px 4px;border-radius:3px;z-index:2147483647;pointer-events:none`;
        document.body.appendChild(badge);
        window.__vi_queue.push({ el, discIdx, badge });
      }
      const s = document.querySelector('.__vi_status');
      if (s) s.textContent = `⬡ Cola (${window.__vi_queue.length}) — Alt+clic añade/quita | Ctrl+Shift+S escanea | Ctrl+Shift+Q cancela`;
    }, true);

  }, { vpW: vp.width, vpH: vp.height });
}

export async function injectStatusBadge(page, text) {
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
