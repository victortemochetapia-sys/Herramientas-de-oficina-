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

## Requisitos

- Node.js 20+

## Puesta en marcha

### 1. Servidor

```bash
cd server
npm install
cp .env.example .env
# Edita .env y coloca tu ANTHROPIC_API_KEY para activar las funciones de IA
npm run dev
```

El servidor arranca en `http://localhost:4000`. Sin `ANTHROPIC_API_KEY`
configurada, el editor funciona igualmente (edición, importación/exportación
de documentos), pero las funciones de IA quedan deshabilitadas y el panel
lateral lo indica.

### 2. Cliente

En otra terminal:

```bash
cd client
npm install
npm run dev
```

Abre `http://localhost:5173`.

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
