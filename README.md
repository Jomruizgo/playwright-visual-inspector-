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
3. Presiona **Ctrl+Shift+S** → la herramienta recorre todos los elementos visibles y captura screenshots con el panel de estilos.
4. Navega a otra vista y repite el paso 3 las veces que necesites.
5. Presiona **Ctrl+Shift+X** → el browser se cierra y se genera el reporte HTML.

## Triggers de teclado

Los atajos se activan directamente en el browser abierto, sin necesidad de volver a la terminal.

| Teclas         | Modo idle                  | Modo manual                      |
|----------------|----------------------------|----------------------------------|
| Ctrl+Shift+S   | Auto-scan de la vista      | Capturar elemento seleccionado   |
| Ctrl+Shift+M   | Activar modo manual        | Desactivar modo manual           |
| Ctrl+Shift+X   | Cerrar herramienta         | Cerrar herramienta               |

### Modo manual

`Ctrl+Shift+M` activa un modo en el que puedes hacer clic sobre cualquier elemento de la página para ver su panel de estilos. Los paneles son arrastrables — los puedes reposicionar antes de tomar el screenshot con `Ctrl+Shift+S`. Las capturas manuales van al mismo reporte.

---

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

---

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
