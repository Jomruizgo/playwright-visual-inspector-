import path from 'path';
import fs from 'fs';

export function generateSessionReport(sessionDir, metadata, autoCaps, manualCaps) {
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
<title>Sesión ${metadata.sessionNum}${metadata.isManual ? ' (manual)' : metadata.isQueued ? ' (cola)' : ''} — ${metadata.url}</title>
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
<h1>Sesión ${metadata.sessionNum}${metadata.isManual ? ' — manual' : metadata.isQueued ? ' — selección personalizada' : ''} — ${metadata.url}</h1>
<h2>Viewport: ${metadata.vpW} × ${metadata.vpH} &nbsp;|&nbsp; ${new Date(metadata.timestamp).toLocaleString()} &nbsp;|&nbsp; ${(autoCaps || []).filter(Boolean).length + (manualCaps || []).filter(Boolean).length} capturas</h2>
${renderGrid(autoCaps, 'Auto-scan')}
${renderGrid(manualCaps, 'Capturas manuales')}
</body>
</html>`;

  fs.writeFileSync(path.join(sessionDir, 'index.html'), html);
}

export function generateMasterReport(outDir, sessions) {
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
