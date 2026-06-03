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
      dockWidth: 280,
      measureColor: '#00d2ff'
    };
    
    const savedSettings = localStorage.getItem('__vi_settings');
    window.__vi_settings = savedSettings 
      ? { ...DEFAULT_SETTINGS, ...window.__vi_settings, ...JSON.parse(savedSettings) } 
      : { ...DEFAULT_SETTINGS, ...window.__vi_settings };

    // ── Utilidad: applyDockStyles ──────────────────────────────────────────────
    window.__vi_applyDockStyles = function() {
      const isDocked = !window.__vi_isMobile && window.__vi_settings.responsiveDock && (vpW <= 900);
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
          cursor: grab;
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 11px;
          font-weight: 600;
          box-shadow: 0 4px 15px rgba(0,0,0,0.5);
          transition: background 0.2s, color 0.2s, box-shadow 0.2s, transform 0.2s;
          display: flex;
          align-items: center;
          gap: 6px;
          user-select: none;
        }
        .__vi_btn_settings:active {
          cursor: grabbing;
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
        
        <!-- Modo Medición -->
        <div class="__vi_settings_section">
          <div class="__vi_settings_title">Modo Medición</div>
          <div class="__vi_row">
            <span>Color de cotas:</span>
            <div class="__vi_color_picker_wrap">
              <input type="color" class="__vi_color_input" id="__vi_opt_measure_color" value="${settings.measureColor}">
              <span id="__vi_measure_color_text" style="font-family:monospace;font-size:11px;">${settings.measureColor.toUpperCase()}</span>
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

      // Drag del botón de ajustes (distingue drag de clic)
      let __vi_btn_did_drag = false;
      btn.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        const r = btn.getBoundingClientRect();
        btn.style.left = r.left + 'px';
        btn.style.top  = r.top  + 'px';
        const startX = e.clientX, startY = e.clientY;
        const dx = e.clientX - r.left, dy = e.clientY - r.top;
        __vi_btn_did_drag = false;
        const mv = (ev) => {
          if (Math.abs(ev.clientX - startX) > 3 || Math.abs(ev.clientY - startY) > 3) {
            __vi_btn_did_drag = true;
            btn.style.left = (ev.clientX - dx) + 'px';
            btn.style.top  = (ev.clientY - dy) + 'px';
          }
        };
        const up = () => {
          document.removeEventListener('mousemove', mv);
          document.removeEventListener('mouseup', up);
        };
        document.addEventListener('mousemove', mv);
        document.addEventListener('mouseup', up);
        e.stopPropagation();
      }, true);

      btn.addEventListener('click', () => {
        if (__vi_btn_did_drag) { __vi_btn_did_drag = false; return; }
        const isVisible = panel.style.display === 'flex';
        if (!isVisible) {
          const r = btn.getBoundingClientRect();
          panel.style.left = r.left + 'px';
          panel.style.top  = (r.bottom + 4) + 'px';
        }
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

      const measureColorPicker = panel.querySelector('#__vi_opt_measure_color');
      const measureColorText   = panel.querySelector('#__vi_measure_color_text');
      measureColorPicker.addEventListener('input', () => {
        const c = measureColorPicker.value;
        measureColorText.textContent = c.toUpperCase();
        window.__vi_settings.measureColor = c;
        if (window.__vi_mode === 'measure') {
          const s = document.querySelector('.__vi_status');
          if (s) { s.style.borderColor = c; s.style.color = c; }
          if (window.__vi_measure_state && window.__vi_measure_state.svg) {
            window.__vi_measureDraw(null, null);
          }
        }
        saveSettings();
      });

      if (!sessionStorage.getItem('__vi_settings_shown')) {
        const r = btn.getBoundingClientRect();
        panel.style.left = r.left + 'px';
        panel.style.top  = (r.bottom + 4) + 'px';
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

      // Determinar si se acopla a un lado (solo en pantallas angostas con la opción activa, nunca en mobile)
      const isDocked = !window.__vi_isMobile && window.__vi_settings.responsiveDock && (vpW <= 900);

      const PANEL_W = isDocked ? (window.__vi_settings.dockWidth || 280) : 480;
      const PANEL_H = rows.length * 18 + 28;

      let cssText = '';
      if (isDocked) {
        cssText = `position:fixed;right:0;top:0;bottom:0;width:${PANEL_W}px;height:100vh;background:#1e1e1ee6;backdrop-filter:blur(8px);color:#d4d4d4;font-family:Consolas,monospace;font-size:11px;line-height:18px;padding:12px;z-index:2147483647;box-shadow:0 0 20px rgba(0,0,0,.7);overflow-y:auto;box-sizing:border-box;margin:0;border-radius:0;border-left:2.5px solid ${panelColor}`;
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
        cssText = `position:fixed;left:${pos.left}px;top:${pos.top}px;width:${PANEL_W}px;background:#1e1e1e;color:#d4d4d4;font-family:Consolas,monospace;font-size:11px;line-height:18px;padding:8px 10px 10px;border-radius:6px;border:1.5px solid ${panelColor};z-index:2147483647;box-shadow:0 4px 20px rgba(0,0,0,.7)`;
      }

      const KEY_W = 14;
      const lines = rows.map(([k, v]) => {
        if (k.startsWith('───')) return `<div style="color:#555;line-height:18px;margin:2px 0">${k}</div>`;
        return `<div style="display:flex;line-height:18px;margin:1px 0"><span style="color:#808080;min-width:${KEY_W}ch;flex-shrink:0">${k}</span><span style="color:#9cdcfe;word-break:break-all;overflow-wrap:anywhere;min-width:0">${v || ''}</span></div>`;
      });

      const panel = document.createElement('div');
      panel.className = '__vi_overlay';
      panel.style.cssText = cssText;
      panel.innerHTML = `<div style="color:${panelColor};font-weight:700;margin-bottom:4px">✦ ${el.tagName.toLowerCase()}</div>` + lines.join('');
      document.body.appendChild(panel);
      
      // Solo habilitar arrastrado si no está acoplado lateralmente
      if (!isDocked) {
        window.__vi_drag(panel);
      }

      // Handles de redimensionado por borde lateral (position:absolute dentro del fixed panel)
      const addRH = (side) => {
        const rh = document.createElement('div');
        rh.style.cssText = `position:absolute;${side}:0;top:0;bottom:0;width:6px;cursor:ew-resize;z-index:1`;
        rh.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const startX    = e.clientX;
          const startW    = panel.getBoundingClientRect().width;
          const startLeft = parseFloat(panel.style.left) || 0;
          const onMove = (me) => {
            const delta = me.clientX - startX;
            let newW;
            if (side === 'right') {
              newW = Math.max(200, Math.min(800, startW + delta));
            } else {
              newW = Math.max(200, Math.min(800, startW - delta));
              if (!isDocked) panel.style.left = (startLeft + startW - newW) + 'px';
            }
            panel.style.width = newW + 'px';
            if (isDocked) {
              window.__vi_settings.dockWidth = Math.round(newW);
              window.__vi_applyDockStyles();
            }
          };
          const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            if (isDocked) {
              localStorage.setItem('__vi_settings', JSON.stringify(window.__vi_settings));
              if (window.__vi_saveSettingsNode) window.__vi_saveSettingsNode(window.__vi_settings);
            }
          };
          document.addEventListener('mousemove', onMove);
          document.addEventListener('mouseup', onUp);
        });
        panel.appendChild(rh);
      };
      addRH('left');
      if (!isDocked) addRH('right');

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

    // ── Modo Medición ──────────────────────────────────────────────────────────
    // Flujo de 3 clics: pt1 (1er punto) → pt2 (2do punto) → offset (posición cota)
    // cotas[]: { x1,y1, x2,y2, isH, dist, offset }
    //   offset = posición perpendicular absoluta de la línea de cota
    //   (Y si isH, X si !isH)
    // selectedCota: índice seleccionado → Supr = eliminar
    // movingEndpoint: { cotaIdx, ptKey:'p1'|'p2' } → reubicando extremo
    window.__vi_measure_state = { pt1: null, pt2: null, svg: null, cotas: [], selectedCota: null, movingEndpoint: null };

    window.__vi_toggleMeasure = function() {
      const m = window.__vi_measure_state;
      const s = document.querySelector('.__vi_status');
      const C = (window.__vi_settings && window.__vi_settings.measureColor) || '#00d2ff';
      if (window.__vi_mode === 'measure') {
        window.__vi_mode = 'idle';
        document.body.style.cursor = '';
        m.pt1 = null; m.pt2 = null; m.movingEndpoint = null;
        window.__vi_measureDraw(null, null);
        if (s) { s.style.borderColor = '#27ae60'; s.style.color = '#27ae60'; s.textContent = '⏸ Listo  (S=auto | M=manual | Q=cola | D=medición | X=cerrar)  [Ctrl+Shift+…]'; }
        return;
      }
      if (m.svg) { m.svg.remove(); m.svg = null; }
      m.cotas = []; m.pt1 = null; m.pt2 = null; m.selectedCota = null; m.movingEndpoint = null;
      window.__vi_mode = 'measure';
      document.body.style.cursor = 'crosshair';
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.id = '__vi_measure_svg';
      svg.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483646;overflow:visible';
      document.body.appendChild(svg);
      m.svg = svg;
      if (s) { s.style.borderColor = C; s.style.color = C; s.textContent = '📏 Medición — clic en 1er punto | Ctrl+Shift+D = limpiar'; }
    };

    // Snap al borde de elemento más cercano dentro de 8px
    window.__vi_measureSnap = function(cx, cy) {
      const THR = 8;
      let snapX = cx, snapY = cy, dX = THR + 1, dY = THR + 1;
      const IGNORE = '.__vi_status, .__vi_overlay, .__vi_badge, .__vi_connector, .__vi_btn_settings, .__vi_settings_panel, .__vi_queue_badge';
      for (const el of document.elementsFromPoint(cx, cy)) {
        if (el === document.documentElement || el === document.body) continue;
        if (el.id === '__vi_measure_svg') continue;
        try { if (el.closest(IGNORE)) continue; } catch {}
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) continue;
        for (const ex of [r.left, r.right]) { const d = Math.abs(cx - ex); if (d < dX) { dX = d; snapX = ex; } }
        for (const ey of [r.top, r.bottom]) { const d = Math.abs(cy - ey); if (d < dY) { dY = d; snapY = ey; } }
      }
      return { x: Math.round(snapX), y: Math.round(snapY) };
    };

    // Hit-test: endpoint cerca (10px) o línea de cota en su posición offset (5px)
    window.__vi_measureHit = function(cx, cy) {
      const m = window.__vi_measure_state;
      const EP_THR = 10, LN_THR = 5;
      for (let i = 0; i < m.cotas.length; i++) {
        const c = m.cotas[i];
        const vp1x = c.x1, vp1y = c.y1;
        const vp2x = c.isH ? c.x2 : c.x1, vp2y = c.isH ? c.y1 : c.y2;
        if (Math.hypot(cx - vp1x, cy - vp1y) <= EP_THR) return { type: 'endpoint', cotaIdx: i, ptKey: 'p1' };
        if (Math.hypot(cx - vp2x, cy - vp2y) <= EP_THR) return { type: 'endpoint', cotaIdx: i, ptKey: 'p2' };
        // La línea de cota está en su posición real (offset), no sobre el objeto
        if (c.isH) {
          const minX = Math.min(c.x1, c.x2), maxX = Math.max(c.x1, c.x2);
          if (Math.abs(cy - c.offset) <= LN_THR && cx >= minX - LN_THR && cx <= maxX + LN_THR)
            return { type: 'line', cotaIdx: i };
        } else {
          const minY = Math.min(c.y1, c.y2), maxY = Math.max(c.y1, c.y2);
          if (Math.abs(cx - c.offset) <= LN_THR && cy >= minY - LN_THR && cy <= maxY + LN_THR)
            return { type: 'line', cotaIdx: i };
        }
      }
      return null;
    };

    // Dibujar el overlay SVG: cotas finalizadas + preview activo
    window.__vi_measureDraw = function(rawX, rawY) {
      const m = window.__vi_measure_state;
      if (!m.svg) return;
      const C    = (window.__vi_settings && window.__vi_settings.measureColor) || '#00d2ff';
      const CSEL = '#f39c12'; // naranja — seleccionada
      const CMOV = '#2ecc71'; // verde — endpoint en movimiento

      const guide = (x1, y1, x2, y2, col) =>
        `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col || C}" stroke-width="0.5" stroke-dasharray="5,4" opacity="0.4"/>`;
      const dot = (x, y, col, op) =>
        `<circle cx="${x}" cy="${y}" r="4" fill="${col || C}" stroke="#1e1e1e" stroke-width="1.5" opacity="${op !== undefined ? op : 1}"/>`;
      const ring = (x, y, col) =>
        `<circle cx="${x}" cy="${y}" r="7" fill="none" stroke="${col}" stroke-width="2" opacity="0.9"/>`;

      // Dibuja una cota completa con líneas de proyección + línea de cota en offset
      const drawCota = (c, col, alpha) => {
        const ax = c.x1, ay = c.y1;
        const bx = c.isH ? c.x2 : c.x1, by = c.isH ? c.y1 : c.y2;
        const GAP = 2, OVER = 4;
        let dlx1, dly1, dlx2, dly2, h = '';
        if (c.isH) {
          const oy = c.offset, dir = Math.sign(oy - ay) || -1;
          dlx1 = ax; dly1 = oy; dlx2 = bx; dly2 = oy;
          // Líneas de proyección (desde objeto hasta la línea de cota)
          h += `<line x1="${ax}" y1="${ay + dir * GAP}" x2="${ax}" y2="${oy + dir * OVER}" stroke="${col}" stroke-width="1" opacity="${(alpha * 0.65).toFixed(2)}"/>`;
          h += `<line x1="${bx}" y1="${by + dir * GAP}" x2="${bx}" y2="${oy + dir * OVER}" stroke="${col}" stroke-width="1" opacity="${(alpha * 0.65).toFixed(2)}"/>`;
          // Ticks en los extremos de la línea de cota
          h += `<line x1="${dlx1}" y1="${dly1 - 6}" x2="${dlx1}" y2="${dly1 + 6}" stroke="${col}" stroke-width="2" opacity="${alpha}"/>`;
          h += `<line x1="${dlx2}" y1="${dly2 - 6}" x2="${dlx2}" y2="${dly2 + 6}" stroke="${col}" stroke-width="2" opacity="${alpha}"/>`;
        } else {
          const ox = c.offset, dir = Math.sign(ox - ax) || -1;
          dlx1 = ox; dly1 = ay; dlx2 = ox; dly2 = by;
          h += `<line x1="${ax + dir * GAP}" y1="${ay}" x2="${ox + dir * OVER}" y2="${ay}" stroke="${col}" stroke-width="1" opacity="${(alpha * 0.65).toFixed(2)}"/>`;
          h += `<line x1="${bx + dir * GAP}" y1="${by}" x2="${ox + dir * OVER}" y2="${by}" stroke="${col}" stroke-width="1" opacity="${(alpha * 0.65).toFixed(2)}"/>`;
          h += `<line x1="${dlx1 - 6}" y1="${dly1}" x2="${dlx1 + 6}" y2="${dly1}" stroke="${col}" stroke-width="2" opacity="${alpha}"/>`;
          h += `<line x1="${dlx2 - 6}" y1="${dly2}" x2="${dlx2 + 6}" y2="${dly2}" stroke="${col}" stroke-width="2" opacity="${alpha}"/>`;
        }
        const midX = (dlx1 + dlx2) / 2, midY = (dly1 + dly2) / 2;
        const label = `${c.dist}px`;
        const lw = label.length * 8 + 18;
        // Línea de cota partida en el centro para no cruzar el texto
        const LGAP = 5;
        if (c.isH) {
          const xL = Math.min(dlx1, dlx2), xR = Math.max(dlx1, dlx2);
          const sL = midX - lw / 2 - LGAP, sR = midX + lw / 2 + LGAP;
          if (sL > xL) h += `<line x1="${xL}" y1="${dly1}" x2="${sL}" y2="${dly1}" stroke="${col}" stroke-width="2" opacity="${alpha}"/>`;
          if (sR < xR) h += `<line x1="${sR}" y1="${dly1}" x2="${xR}" y2="${dly1}" stroke="${col}" stroke-width="2" opacity="${alpha}"/>`;
        } else {
          const yT = Math.min(dly1, dly2), yB = Math.max(dly1, dly2);
          const sT = midY - 11 - LGAP, sB = midY + 8 + LGAP;
          if (sT > yT) h += `<line x1="${dlx1}" y1="${yT}" x2="${dlx1}" y2="${sT}" stroke="${col}" stroke-width="2" opacity="${alpha}"/>`;
          if (sB < yB) h += `<line x1="${dlx1}" y1="${sB}" x2="${dlx1}" y2="${yB}" stroke="${col}" stroke-width="2" opacity="${alpha}"/>`;
        }
        h += `<rect x="${midX - lw / 2}" y="${midY - 11}" width="${lw}" height="19" rx="4" fill="#1a1a2e" opacity="${(alpha * 0.93).toFixed(2)}"/>`;
        h += `<text x="${midX}" y="${midY + 5}" text-anchor="middle" font-family="Consolas,monospace" font-size="12" font-weight="700" fill="${col}" opacity="${alpha}">${label}</text>`;
        h += dot(ax, ay, col, alpha);
        h += dot(bx, by, col, alpha);
        return h;
      };

      let html = '';

      // 1. Cotas finalizadas
      for (let i = 0; i < m.cotas.length; i++) {
        if (m.movingEndpoint && m.movingEndpoint.cotaIdx === i) continue;
        const isSel = m.selectedCota === i;
        html += drawCota(m.cotas[i], isSel ? CSEL : C, isSel ? 1.0 : 0.55);
        if (isSel) {
          const c = m.cotas[i];
          html += ring(c.x1, c.y1, CSEL);
          html += ring(c.isH ? c.x2 : c.x1, c.isH ? c.y1 : c.y2, CSEL);
        }
      }

      // 2. Preview de endpoint en movimiento (verde)
      if (m.movingEndpoint) {
        const { cotaIdx, ptKey } = m.movingEndpoint;
        const orig = m.cotas[cotaIdx];
        if (rawX !== null) {
          const sp = window.__vi_measureSnap(rawX, rawY);
          let nc;
          if (ptKey === 'p1') {
            const ndx = Math.abs(orig.x2 - sp.x), ndy = Math.abs(orig.y2 - sp.y);
            const nH = ndx >= ndy;
            nc = { x1: sp.x, y1: sp.y, x2: orig.x2, y2: orig.y2, isH: nH, dist: nH ? ndx : ndy, offset: orig.offset };
          } else {
            const ndx = Math.abs(sp.x - orig.x1), ndy = Math.abs(sp.y - orig.y1);
            const nH = ndx >= ndy;
            nc = { x1: orig.x1, y1: orig.y1, x2: sp.x, y2: sp.y, isH: nH, dist: nH ? ndx : ndy, offset: orig.offset };
          }
          html += drawCota(nc, CMOV, 0.9);
          html += guide(0, sp.y, '10000', sp.y, CMOV);
          html += guide(sp.x, 0, sp.x, '10000', CMOV);
        } else {
          html += drawCota(orig, CMOV, 0.55);
        }
      }

      // 3. Fase 1: pt1 fijado, esperando pt2 (rubber-band)
      const pt1 = m.pt1;
      if (pt1 && !m.pt2) {
        html += guide(0, pt1.y, '10000', pt1.y);
        html += guide(pt1.x, 0, pt1.x, '10000');
        html += dot(pt1.x, pt1.y);
        if (rawX !== null) {
          const s2 = window.__vi_measureSnap(rawX, rawY);
          const isH2 = Math.abs(s2.x - pt1.x) >= Math.abs(s2.y - pt1.y);
          const lpx2 = isH2 ? s2.x : pt1.x, lpy2 = isH2 ? pt1.y : s2.y;
          const dist2 = Math.round(isH2 ? Math.abs(s2.x - pt1.x) : Math.abs(s2.y - pt1.y));
          html += guide(0, s2.y, '10000', s2.y);
          html += guide(s2.x, 0, s2.x, '10000');
          html += `<line x1="${pt1.x}" y1="${pt1.y}" x2="${lpx2}" y2="${lpy2}" stroke="${C}" stroke-width="1.5" stroke-dasharray="6,3" opacity="0.7"/>`;
          if (dist2 > 0) {
            const mx = (pt1.x + lpx2) / 2, my = (pt1.y + lpy2) / 2;
            const lbl = `${dist2}px`, lw2 = lbl.length * 8 + 18;
            html += `<rect x="${mx - lw2 / 2}" y="${my - 11}" width="${lw2}" height="19" rx="4" fill="#1e1e1e" opacity="0.6"/>`;
            html += `<text x="${mx}" y="${my + 5}" text-anchor="middle" font-family="Consolas,monospace" font-size="12" font-weight="700" fill="${C}" opacity="0.6">${lbl}</text>`;
          }
          html += dot(s2.x, s2.y);
        }
      }

      // 4. Fase 2: pt1+pt2 fijados, cursor define posición de la línea de cota
      if (pt1 && m.pt2) {
        const pt2 = m.pt2;
        const dx = Math.abs(pt2.x - pt1.x), dy = Math.abs(pt2.y - pt1.y);
        const isH = dx >= dy, dist = isH ? dx : dy;
        const offset = rawX !== null ? (isH ? rawY : rawX) : (isH ? pt1.y - 40 : pt1.x - 40);
        html += drawCota({ x1: pt1.x, y1: pt1.y, x2: pt2.x, y2: pt2.y, isH, dist, offset }, C, 0.85);
      }

      m.svg.innerHTML = html;
    };

    // mousemove → preview en vivo + cursor adaptativo
    document.addEventListener('mousemove', (e) => {
      if (window.__vi_mode !== 'measure') return;
      const m = window.__vi_measure_state;
      if (!m.pt1 && !m.movingEndpoint) {
        const hit = window.__vi_measureHit(e.clientX, e.clientY);
        if (hit && hit.type === 'endpoint')  document.body.style.cursor = 'move';
        else if (hit && hit.type === 'line') document.body.style.cursor = 'pointer';
        else                                 document.body.style.cursor = 'crosshair';
      }
      window.__vi_measureDraw(e.clientX, e.clientY);
    }, true);

    // click → flujo de 3 fases + edición de cotas existentes
    document.addEventListener('click', (e) => {
      if (window.__vi_mode !== 'measure') return;
      let node = e.target;
      while (node) {
        const cls = typeof node.className === 'string' ? node.className : '';
        if (cls.includes('__vi_btn_settings') || cls.includes('__vi_settings_panel') || cls.includes('__vi_status')) return;
        node = node.parentElement;
      }
      e.preventDefault(); e.stopPropagation();
      const m      = window.__vi_measure_state;
      const snapPt = window.__vi_measureSnap(e.clientX, e.clientY);
      const s      = document.querySelector('.__vi_status');

      // A. Finalizar reubicación de endpoint (preserva offset)
      if (m.movingEndpoint) {
        const { cotaIdx, ptKey } = m.movingEndpoint;
        const orig = m.cotas[cotaIdx];
        if (ptKey === 'p1') {
          const ndx = Math.abs(orig.x2 - snapPt.x), ndy = Math.abs(orig.y2 - snapPt.y);
          const nH = ndx >= ndy;
          m.cotas[cotaIdx] = { x1: snapPt.x, y1: snapPt.y, x2: orig.x2, y2: orig.y2, isH: nH, dist: nH ? ndx : ndy, offset: orig.offset };
        } else {
          const ndx = Math.abs(snapPt.x - orig.x1), ndy = Math.abs(snapPt.y - orig.y1);
          const nH = ndx >= ndy;
          m.cotas[cotaIdx] = { x1: orig.x1, y1: orig.y1, x2: snapPt.x, y2: snapPt.y, isH: nH, dist: nH ? ndx : ndy, offset: orig.offset };
        }
        m.movingEndpoint = null;
        document.body.style.cursor = 'crosshair';
        window.__vi_measureDraw(null, null);
        if (s) s.textContent = '📏 Clic en 1er punto | Ctrl+Shift+D = limpiar';
        return;
      }

      // B. Fase 0 (sin pt1) → edición o inicio de medición
      if (!m.pt1) {
        const hit = window.__vi_measureHit(e.clientX, e.clientY);
        if (hit && hit.type === 'endpoint') {
          m.movingEndpoint = { cotaIdx: hit.cotaIdx, ptKey: hit.ptKey };
          m.selectedCota = null;
          document.body.style.cursor = 'move';
          window.__vi_measureDraw(null, null);
          if (s) s.textContent = '📏 Moviendo extremo — clic para fijar | Esc = cancelar';
          return;
        }
        if (hit && hit.type === 'line') {
          const isSame = m.selectedCota === hit.cotaIdx;
          m.selectedCota = isSame ? null : hit.cotaIdx;
          window.__vi_measureDraw(null, null);
          if (s) s.textContent = isSame
            ? '📏 Clic en 1er punto | Ctrl+Shift+D = limpiar'
            : '📏 Cota seleccionada — Supr = eliminar | clic fuera = deseleccionar';
          return;
        }
        if (m.selectedCota !== null) {
          m.selectedCota = null;
          window.__vi_measureDraw(null, null);
          if (s) s.textContent = '📏 Clic en 1er punto | Ctrl+Shift+D = limpiar';
          return;
        }
        // Fase 1: fijar primer punto
        m.pt1 = { x: snapPt.x, y: snapPt.y };
        if (s) s.textContent = '📏 Clic en 2do punto | Esc = cancelar';
        return;
      }

      // C. Fase 1 → 2: fijar segundo punto
      if (!m.pt2) {
        m.pt2 = { x: snapPt.x, y: snapPt.y };
        if (s) s.textContent = '📏 Posiciona la línea de cota — clic para fijar | Esc = cancelar';
        return;
      }

      // D. Fase 2 → finalizar: el cursor define el offset de la línea de cota
      const dx = Math.abs(m.pt2.x - m.pt1.x), dy = Math.abs(m.pt2.y - m.pt1.y);
      const isH = dx >= dy, dist = isH ? dx : dy;
      const offset = isH ? e.clientY : e.clientX;
      m.cotas.push({ x1: m.pt1.x, y1: m.pt1.y, x2: m.pt2.x, y2: m.pt2.y, isH, dist, offset });
      m.pt1 = null; m.pt2 = null;
      window.__vi_measureDraw(null, null);
      if (s) s.textContent = '📏 Clic en 1er punto | Ctrl+Shift+D = limpiar';
    }, true);

    // Escape (niveles) + Delete → eliminar cota seleccionada
    document.addEventListener('keydown', (e) => {
      if (window.__vi_mode !== 'measure') return;
      const m = window.__vi_measure_state;
      const s = document.querySelector('.__vi_status');
      if (e.key === 'Escape') {
        if (m.movingEndpoint) {
          m.movingEndpoint = null;
          document.body.style.cursor = 'crosshair';
          window.__vi_measureDraw(null, null);
          if (s) s.textContent = '📏 Clic en 1er punto | Esc = salir';
        } else if (m.pt1) {
          m.pt1 = null; m.pt2 = null;
          window.__vi_measureDraw(null, null);
          if (s) s.textContent = '📏 Clic en 1er punto | Esc = salir';
        } else if (m.selectedCota !== null) {
          m.selectedCota = null;
          window.__vi_measureDraw(null, null);
          if (s) s.textContent = '📏 Clic en 1er punto | Esc = salir';
        } else {
          window.__vi_toggleMeasure();
        }
      }
      if (e.key === 'Delete' && m.selectedCota !== null) {
        m.cotas.splice(m.selectedCota, 1);
        m.selectedCota = null;
        window.__vi_measureDraw(null, null);
        if (s) s.textContent = '📏 Clic en 1er punto | Ctrl+Shift+D = limpiar';
      }
    });

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
      } else if (e.key === 'D') {
        e.preventDefault();
        window.__vi_toggleMeasure();
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
