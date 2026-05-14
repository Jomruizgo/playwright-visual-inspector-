# playwright-visual-inspector

Herramienta de inspección visual de páginas web basada en Playwright. Abre un navegador, descubre automáticamente todos los elementos visibles por categoría semántica y captura screenshots con un panel de computed styles flotante junto a cada elemento — al estilo DevTools, pero embebido en la evidencia.

## Requisitos

- Node.js >= 18 (recomendado: usar [nvm](https://github.com/nvm-sh/nvm))
- pnpm >= 8

## Instalación

```bash
git clone https://github.com/Jomruizgo/playwright-visual-inspector-.git
cd playwright-visual-inspector-
pnpm install
pnpm exec playwright install chromium
```

### Comando global (opcional)

Para ejecutarlo desde cualquier directorio crea un wrapper en `~/.local/bin`:

```bash
cat > ~/.local/bin/visual-inspector << 'EOF'
#!/bin/sh
exec node /ruta/absoluta/playwright-visual-inspector-/inspect-page.js "$@"
EOF
chmod +x ~/.local/bin/visual-inspector
```

Asegúrate de que `~/.local/bin` esté en tu `PATH`.

## Uso

```bash
node inspect-page.js --url https://tu-sitio.com --width 1440 --height 768

# O si instalaste el wrapper global:
visual-inspector --url https://tu-sitio.com --width 1440 --height 768
```

| Argumento  | Descripción                              | Default              |
|-----------|------------------------------------------|----------------------|
| `--url`   | URL inicial que abre el browser          | **requerido**        |
| `--width` | Ancho del viewport (px)                  | 1440                 |
| `--height`| Alto del viewport (px)                   | 768                  |
| `--out`   | Carpeta de salida                        | `evidencia/inspector`|

## Flujo de uso

1. El browser abre en la URL indicada.
2. Navega hasta la vista que quieres documentar.
3. Presiona **Ctrl+Shift+S** → la herramienta recorre todos los elementos visibles y captura screenshots con el panel de estilos.
4. Navega a otra vista y repite el paso 3 las veces que necesites.
5. Presiona **Ctrl+Shift+X** → el browser se cierra y se genera el reporte HTML.

## Triggers de teclado

Los atajos se activan directamente en el browser abierto, sin necesidad de volver a la terminal.

| Teclas         | Acción                    |
|----------------|---------------------------|
| Ctrl+Shift+S   | Inspeccionar vista actual |
| Ctrl+Shift+X   | Cerrar herramienta        |

## Estructura de salida

```
evidencia/inspector/
├── sesion-001-<timestamp>/
│   ├── 00-vista-completa.png
│   ├── 01-Titulos-0.png
│   ├── 02-Parrafos-0.png
│   ├── 03-Cab_tabla-0.png
│   └── index.html
├── sesion-002-<timestamp>/
│   └── ...
└── reporte-inspector.html
```

Abre `reporte-inspector.html` para navegar todas las sesiones.

## Categorías que auto-descubre

| Categoría       | Color de outline |
|----------------|-----------------|
| Logo / Marca   | naranja          |
| Header         | rojo             |
| Navegación     | naranja oscuro   |
| Títulos        | azul             |
| Párrafos       | morado           |
| Inputs         | verde agua       |
| Botones        | amarillo         |
| Links          | azul claro       |
| Cabeceras tabla| azul oscuro      |
| Celdas datos   | verde            |
| Badges/Estado  | rosa             |
| Paginación     | violeta          |

## Panel de propiedades capturadas

Cada screenshot incluye un panel flotante con:

- Tag y clases del elemento
- Contenido de texto (primeros 60 caracteres)
- `font-family`, `font-size`, `font-weight`, `color`, `background`, `text-align`
- `width`, `height`, `padding`, `margin`, `border`
- `overflow-x`, `text-overflow`, `white-space`
- Posición en el viewport (`x`, `y`)

El panel se posiciona automáticamente para no tapar el outline del elemento inspeccionado.

## Licencia

MIT
