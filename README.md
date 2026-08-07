# Herramientas de Oficina — Writer con IA

Editor de textos web, al estilo de OpenOffice/LibreOffice Writer, que permite
crear y editar documentos y exportarlos a **.docx** y **.pdf** (además de
**.txt**), con un asistente de **IA integrado** que puede:

- **Sugerir en caliente** mientras el usuario redacta (texto "fantasma" en
  gris que aparece a medida que escribe; se acepta con `Tab` o se descarta
  con `Esc`).
- **Redactar o modificar por instrucciones**: el usuario selecciona texto (o
  no) y le pide a la IA que lo reescriba, resuma, traduzca, corrija, amplíe,
  etc. La respuesta se transmite en vivo (streaming) directamente en el
  documento.

## Arquitectura

Monorepo con dos proyectos independientes:

```
client/   Editor (React + Vite + TypeScript + TipTap/ProseMirror)
server/   API (Node + Express + TypeScript)
```

El **cliente** contiene el editor de texto enriquecido (negrita, cursiva,
subrayado, títulos, listas, tablas, imágenes, enlaces, alineación, color de
texto, etc.) y la barra lateral de IA.

El **servidor** expone:

- `POST /api/convert/import/docx` — convierte un `.docx` subido a HTML editable (usa `mammoth`).
- `POST /api/convert/export/docx` — convierte el HTML del editor a `.docx` (usa `html-to-docx`).
- `POST /api/convert/export/pdf` — convierte el HTML del editor a `.pdf` renderizando con Chromium headless (Playwright).
- `POST /api/ai/suggest` — sugerencia corta de continuación para el modo "sugerencias en vivo".
- `POST /api/ai/instruct` — reescritura por instrucción del usuario, con streaming (Server-Sent Events).
- `GET /api/ai/status` — indica si la IA está configurada (clave de API presente).

La IA usa la [API de Anthropic (Claude)](https://docs.anthropic.com/) desde
el servidor, para no exponer la clave de API en el navegador.

## Puesta en marcha (paso a paso, sin experiencia previa)

Pensado para correr en tu propia computadora (por ejemplo una Mac), no en un
equipo corporativo restringido.

### 1. Instala Node.js (una sola vez)

Node.js es el programa que permite ejecutar este proyecto. Ve a
[nodejs.org](https://nodejs.org/), descarga la versión **LTS** para macOS y
ábrela como cualquier instalador (`.pkg`): siguiente, siguiente, instalar.

### 2. Descarga este proyecto

En GitHub, en la rama `claude/text-editor-ai-integration-rl90vf`, usa el
botón verde **Code → Download ZIP** y descomprime el archivo (por ejemplo en
el Escritorio).

### 3. Abre la Terminal

En el Launchpad o con Spotlight (`Cmd + Espacio`) busca **Terminal** y
ábrela. Escribe `cd ` (con un espacio al final) y luego arrastra la carpeta
descomprimida del proyecto hacia la ventana de la Terminal — esto pega la
ruta automáticamente. Presiona `Enter`.

### 4. Instala y arranca todo con dos comandos

Copia y pega estos comandos uno por uno (Enter después de cada uno):

```bash
npm run setup
npm run dev
```

El primero instala todo lo necesario y crea los archivos de configuración.
El segundo arranca la aplicación completa (editor + servidor) con un solo
comando. Cuando veas `VITE ... ready` en la Terminal, abre tu navegador en:

```
http://localhost:5173
```

Para detenerlo, vuelve a la Terminal y presiona `Ctrl + C`. Para volver a
usarlo otro día, solo hace falta `npm run dev` (ya no `npm run setup`).

### 5. (Opcional) Activar el asistente de IA

Sin esto, el editor funciona igual (escribir, dar formato, exportar a
.docx/.pdf) pero sin sugerencias ni instrucciones de IA. Para activarlas:

1. Consigue una clave de API en [console.anthropic.com](https://console.anthropic.com/).
2. Dentro de la carpeta del proyecto, abre el archivo `server/.env` con
   cualquier editor de texto (TextEdit sirve).
3. Donde dice `ANTHROPIC_API_KEY=`, pega tu clave justo después del `=`.
4. Guarda el archivo y reinicia `npm run dev`.

## Funciones de IA en detalle

### Sugerencias en vivo

Se activan con el interruptor **"Sugerencias mientras escribo"** en el
panel lateral. Tras una pausa breve al escribir, la IA propone una
continuación corta, mostrada como texto fantasma justo después del cursor.
`Tab` la inserta, `Esc` la descarta, y seguir escribiendo o mover el cursor
la invalida automáticamente. Se puede indicar un estilo opcional (p. ej.
"tono formal", "técnico") que se envía junto con el contexto.

### Instrucciones dirigidas

En la sección **"Dar instrucciones"** el usuario escribe qué quiere que la
IA haga (o usa uno de los atajos predefinidos: más formal, resumir,
corregir, ampliar, traducir...). Si hay texto seleccionado, la IA lo
reemplaza con el resultado; si no, inserta el resultado en la posición del
cursor. La respuesta se transmite palabra a palabra directamente en el
documento.

## Exportación e importación

- **Abrir**: `.docx`, `.txt`, `.html`.
- **Guardar como**: `.docx`, `.pdf`, `.txt`.

La conversión a `.docx` y `.pdf` ocurre en el servidor para asegurar
fidelidad de formato (tablas, imágenes, estilos).

## Notas de despliegue

- El servidor necesita un Chromium accesible para Playwright (para exportar
  a PDF). En entornos sin navegador preinstalado, ejecuta
  `npx playwright install chromium` tras `npm install`.
- Nunca subas tu `.env` con la clave de Anthropic al repositorio.
