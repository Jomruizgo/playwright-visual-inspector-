# playwright-visual-inspector

Herramienta de inspección visual de páginas web basada en Playwright. Abre un navegador, descubre automáticamente todos los elementos visibles por categoría semántica y captura screenshots con un panel de computed styles flotante junto a cada elemento — al estilo DevTools, pero embebido en la evidencia.

## Requisitos

- Node.js >= 18
- pnpm >= 8

---

## Instalación

### Ubuntu / Linux

```bash
# 1. Instalar Node.js con nvm (si no lo tienes)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20

# 2. Instalar pnpm
npm install -g pnpm

# 3. Clonar e instalar
git clone https://github.com/Jomruizgo/playwright-visual-inspector-.git
cd playwright-visual-inspector-
pnpm install
pnpm exec playwright install chromium

# 4. Comando global (opcional)
echo '#!/bin/sh
exec node '"$(pwd)"'/inspect-page.js "$@"' > ~/.local/bin/visual-inspector
chmod +x ~/.local/bin/visual-inspector
# Verificar que ~/.local/bin esté en PATH:
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc && source ~/.bashrc
```

### macOS

```bash
# 1. Instalar Node.js con nvm (si no lo tienes)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.zshrc
nvm install 20

# 2. Instalar pnpm
npm install -g pnpm

# 3. Clonar e instalar
git clone https://github.com/Jomruizgo/playwright-visual-inspector-.git
cd playwright-visual-inspector-
pnpm install
pnpm exec playwright install chromium

# 4. Comando global (opcional)
echo '#!/bin/sh
exec node '"$(pwd)"'/inspect-page.js "$@"' > /usr/local/bin/visual-inspector
chmod +x /usr/local/bin/visual-inspector
```

> Si `/usr/local/bin` requiere permisos, usa `sudo` o colócalo en `~/.local/bin` (mismos pasos que Linux).

### Windows

```powershell
# 1. Instalar Node.js
# Descarga el instalador desde https://nodejs.org (versión LTS)
# Marca la opción "Add to PATH" durante la instalación.

# 2. Instalar pnpm (en PowerShell como administrador)
npm install -g pnpm

# 3. Clonar e instalar
git clone https://github.com/Jomruizgo/playwright-visual-inspector-.git
cd playwright-visual-inspector-
pnpm install
pnpm exec playwright install chromium

# 4. Comando global (opcional) — agrega un alias en tu perfil de PowerShell
notepad $PROFILE   # si no existe, PowerShell te preguntará si deseas crearlo
```

Agrega esta línea al perfil de PowerShell que se abrió:

```powershell
function visual-inspector { node "C:\ruta\completa\playwright-visual-inspector-\inspect-page.js" @args }
```

Guarda, cierra y recarga con `. $PROFILE`.

---

## Uso

```bash
# Linux / macOS
node inspect-page.js --url https://tu-sitio.com --width 1440 --height 768

# Windows (PowerShell)
node inspect-page.js --url https://tu-sitio.com --width 1440 --height 768

# Con el comando global (cualquier OS)
visual-inspector --url https://tu-sitio.com --width 1440 --height 768
```

| Argumento  | Descripción                       | Default              |
|-----------|-----------------------------------|----------------------|
| `--url`   | URL inicial que abre el browser   | **requerido**        |
| `--width` | Ancho del viewport (px)           | 1440                 |
| `--height`| Alto del viewport (px)            | 768                  |
| `--out`   | Carpeta de salida                 | `evidencia/inspector`|

---

## Flujo de uso

1. El browser abre en la URL indicada.
2. Navega hasta la vista que quieres documentar.
3. Elige uno de los tres modos de captura (ver abajo) y usa `Ctrl+Shift+S` para disparar.
4. Navega a otra vista y repite las veces que necesites.
5. Presiona **Ctrl+Shift+X** → el browser se cierra y se genera el reporte HTML.

## Modos de captura y atajos de teclado

Los atajos se activan directamente en el browser, sin necesidad de volver a la terminal.

### Resumen de atajos

| Teclas | Descripción |
|--------|-------------|
| **Ctrl+Shift+S** | Auto-scan completo / Escanear cola / Capturar en modo manual |
| **Ctrl+Shift+M** | Activar / desactivar modo manual |
| **Ctrl+Shift+Q** | Activar / desactivar modo cola de selección |
| **Ctrl+Shift+X** | Cerrar herramienta |
| **Shift+Clic** *(en modo manual)* | Comparar alineación entre dos elementos |
| **Alt+Clic** *(en modo cola)* | Añadir o quitar elemento de la cola |

---

### Modo auto-scan (`Ctrl+Shift+S`)

Descubre automáticamente todos los elementos visibles de la página por categoría semántica y captura un screenshot con el panel de estilos para cada uno.

### Modo manual (`Ctrl+Shift+M`)

Activa un cursor en forma de cruz. Haz clic sobre cualquier elemento para ver su panel de estilos. Los paneles son **arrastrables** — los puedes reposicionar antes de tomar el screenshot con `Ctrl+Shift+S`.

- **Shift+Clic** sobre un segundo elemento → modo comparación: muestra los deltas de `left`, `top`, `right`, `bottom`, `width` y `height` entre los dos elementos, con ✓ / ⚠ por cada propiedad.

### Modo cola de selección (`Ctrl+Shift+Q`)

Permite elegir exactamente qué elementos escanear antes de ejecutar el scan.

1. `Ctrl+Shift+Q` → cursor cambia a `cell`, badge muestra `⬡ Cola`
2. **Alt+Clic** en cada elemento que quieres capturar → se resalta en morado con un número de orden
3. **Alt+Clic** sobre un elemento ya en cola → lo quita y renumera los restantes
4. `Ctrl+Shift+S` → escanea solo los elementos en cola, en el orden seleccionado
5. `Ctrl+Shift+Q` → cancela y limpia la cola sin escanear

> **Nota en Linux:** `Alt+Clic` puede ser capturado por el gestor de ventanas para mover ventanas. Si esto ocurre, deshabilítalo en la configuración del escritorio (en GNOME: *Configuración → Accesibilidad → Interacción* o `dconf-editor` → `/org/gnome/desktop/wm/preferences/mouse-button-modifier`).

---

## Estructura de salida

```
evidencia/inspector/
├── sesion-001-<timestamp>/              ← auto-scan
│   ├── 00-vista-completa.png
│   ├── 01-Titulos-0.png
│   ├── 02-Cab_tabla-0.png
│   └── index.html
├── sesion-002-<timestamp>-cola/        ← cola de selección
│   ├── 00-vista-completa.png
│   ├── 01-Seleccion-0.png
│   └── index.html
├── sesion-003-<timestamp>-manual/      ← capturas manuales
│   ├── manual-01.png
│   └── index.html
└── reporte-inspector.html              ← índice de todas las sesiones
```

Abre `reporte-inspector.html` para navegar todas las sesiones.

---

## Categorías que auto-descubre

| Categoría        | Color de outline |
|-----------------|-----------------|
| Logo / Marca    | naranja          |
| Header          | rojo             |
| Perfil usuario  | rosa claro       |
| Navegación      | naranja oscuro   |
| Títulos         | azul             |
| Párrafos        | morado           |
| Inputs          | verde agua       |
| Botones         | amarillo         |
| Links           | azul claro       |
| Cabeceras tabla | azul oscuro      |
| Celdas datos    | verde            |
| Badges/Estado   | rosa             |
| Paginación      | violeta          |
| Scroll horiz.   | gris             |
| Cola (manual)   | morado claro     |

---

## Panel de propiedades capturadas

Cada screenshot incluye un panel flotante con:

- Tag y clases del elemento
- Contenido de texto (primeros 60 caracteres)
- `font-family`, `font-size`, `font-weight`, `color`, `background`, `text-align`
- `width`, `height`, `padding`, `margin`, `border`
- `overflow-x`, `text-overflow`, `white-space`
- Posición en el viewport (`x`, `y`)

El panel se posiciona automáticamente para no tapar el outline del elemento inspeccionado.

---

## Licencia

MIT
