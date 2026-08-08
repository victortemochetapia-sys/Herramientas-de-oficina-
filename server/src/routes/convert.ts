import { Router } from "express";
import multer from "multer";
import mammoth from "mammoth";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
// html-to-docx no publica tipos; se importa como módulo CJS por defecto.
// @ts-expect-error - sin tipados
import HTMLtoDOCX from "html-to-docx";
import { chromium } from "playwright";

// Polyfill de paged.js: re-fluye el HTML en páginas reales dentro del propio
// navegador (Chromium/Playwright), respetando el estándar CSS de "paginated
// media" (@page, notas al pie con float:footnote, encabezados/pies con
// contadores de página). Se inyecta como <script> inline para no depender
// de un servidor de archivos estáticos. Se resuelve por ruta relativa (en
// vez de require.resolve) porque el "exports" map de pagedjs no expone su
// carpeta dist/ como subpath importable.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGEDJS_POLYFILL_PATH = path.join(__dirname, "..", "..", "node_modules", "pagedjs", "dist", "paged.polyfill.min.js");
const PAGEDJS_POLYFILL = readFileSync(PAGEDJS_POLYFILL_PATH, "utf-8");

export const convertRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// Permite fijar la ruta del binario de Chromium (útil en entornos con un
// Chromium preinstalado). Si no está definida ni existe, se deja que
// Playwright resuelva su propio navegador gestionado.
const CHROMIUM_PATH = process.env.CHROMIUM_PATH && existsSync(process.env.CHROMIUM_PATH)
  ? process.env.CHROMIUM_PATH
  : existsSync("/opt/pw-browsers/chromium")
    ? "/opt/pw-browsers/chromium"
    : undefined;

type PaperSizeId = "a4" | "carta" | "legal";

const PAPER_SIZES_CM: Record<PaperSizeId, { width: number; height: number }> = {
  a4: { width: 21, height: 29.7 },
  carta: { width: 21.59, height: 27.94 },
  legal: { width: 21.59, height: 35.56 },
};


interface ExportBody {
  html?: string;
  title?: string;
  margins?: { top?: number; right?: number; bottom?: number; left?: number };
  paperSize?: PaperSizeId;
  orientation?: "portrait" | "landscape";
  headerText?: string;
  footerText?: string;
  showPageNumber?: boolean;
}

/**
 * Importa un .docx y lo convierte a HTML editable por el editor.
 */
convertRouter.post("/import/docx", upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No se recibió ningún archivo." });
    return;
  }

  try {
    const result = await mammoth.convertToHtml({ buffer: req.file.buffer });
    res.json({ html: result.value, warnings: result.messages.map((m) => m.message) });
  } catch (err) {
    console.error("Error importando .docx", err);
    res.status(500).json({ error: "No se pudo leer el documento .docx." });
  }
});

/**
 * Exporta HTML del editor a un archivo .docx descargable.
 */
convertRouter.post("/export/docx", async (req, res) => {
  const { html, title, margins, paperSize, orientation, headerText, footerText, showPageNumber } = req.body as ExportBody;
  if (!html) {
    res.status(400).json({ error: "Falta el contenido HTML." });
    return;
  }

  const m = {
    top: clampCm(margins?.top),
    right: clampCm(margins?.right),
    bottom: clampCm(margins?.bottom),
    left: clampCm(margins?.left),
  };

  const paper = PAPER_SIZES_CM[paperSize ?? "a4"] ?? PAPER_SIZES_CM.a4;
  const isLandscape = orientation === "landscape";
  const pageWidthCm = isLandscape ? paper.height : paper.width;
  const pageHeightCm = isLandscape ? paper.width : paper.height;

  const hasHeader = Boolean(headerText?.trim());
  const hasFooter = Boolean(footerText?.trim() || showPageNumber);

  try {
    const buffer = await HTMLtoDOCX(html, hasHeader ? `<p style="text-align:center;font-size:9pt;color:#555;">${escapeHtml(headerText || "")}</p>` : null, {
      orientation: isLandscape ? "landscape" : "portrait",
      pageSize: { width: cmToTwip(pageWidthCm), height: cmToTwip(pageHeightCm) },
      margins: {
        top: cmToTwip(m.top),
        right: cmToTwip(m.right),
        bottom: cmToTwip(m.bottom),
        left: cmToTwip(m.left),
      },
      table: { row: { cantSplit: true } },
      header: hasHeader,
      footer: hasFooter,
      pageNumber: Boolean(showPageNumber),
      title: title || "Documento",
    }, hasFooter ? `<p style="text-align:center;font-size:9pt;color:#555;">${escapeHtml(footerText || "")}</p>` : undefined);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${(title || "documento").replace(/"/g, "")}.docx"`);
    res.send(buffer);
  } catch (err) {
    console.error("Error exportando .docx", err);
    res.status(500).json({ error: "No se pudo generar el .docx." });
  }
});

/**
 * Exporta HTML del editor a PDF con paginación real: el contenido se
 * re-fluye en páginas de verdad dentro de Chromium usando paged.js (CSS
 * Paginated Media), por lo que los saltos de página, encabezados/pies con
 * numeración automática y notas al pie caen exactamente donde deben, en
 * vez de aproximarse.
 */
convertRouter.post("/export/pdf", async (req, res) => {
  const { html, title, margins, paperSize, orientation, headerText, footerText, showPageNumber } = req.body as ExportBody;
  if (!html) {
    res.status(400).json({ error: "Falta el contenido HTML." });
    return;
  }

  const m = {
    top: clampCm(margins?.top),
    right: clampCm(margins?.right),
    bottom: clampCm(margins?.bottom),
    left: clampCm(margins?.left),
  };

  const paper = PAPER_SIZES_CM[paperSize ?? "a4"] ?? PAPER_SIZES_CM.a4;
  const isLandscape = orientation === "landscape";
  const pageWidthCm = isLandscape ? paper.height : paper.width;
  const pageHeightCm = isLandscape ? paper.width : paper.height;

  const marginBoxRules: string[] = [];
  if (headerText?.trim()) {
    marginBoxRules.push(`@top-center { content: "${escapeCss(headerText)}"; font-size: 9px; color: #555; font-family: Arial, sans-serif; }`);
  }
  const footerParts: string[] = [];
  if (footerText?.trim()) footerParts.push(`"${escapeCss(footerText)}"`);
  if (footerText?.trim() && showPageNumber) footerParts.push(`" — "`);
  if (showPageNumber) footerParts.push(`counter(page) " / " counter(pages)`);
  if (footerParts.length > 0) {
    marginBoxRules.push(`@bottom-center { content: ${footerParts.join(" ")}; font-size: 9px; color: #555; font-family: Arial, sans-serif; }`);
  }

  let browser;
  try {
    browser = await chromium.launch({ executablePath: CHROMIUM_PATH ?? undefined, headless: true });
    const page = await browser.newPage();

    const fullHtml = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title || "Documento")}</title>
<style>
  @page {
    size: ${pageWidthCm}cm ${pageHeightCm}cm;
    margin: ${m.top}cm ${m.right}cm ${m.bottom}cm ${m.left}cm;
    ${marginBoxRules.join("\n    ")}
  }
  body { font-family: "Liberation Serif", Georgia, serif; font-size: 12pt; line-height: 1.5; color: #1a1a1a; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1px solid #999; padding: 6px 8px; }
  img { max-width: 100%; }
  h1, h2, h3 { font-family: "Liberation Sans", Arial, sans-serif; }
  .page-break { break-after: page; height: 0; border: none; margin: 0; }
  .footnote { float: footnote; font-size: 9pt; color: #333; }
</style>
<script>window.PagedConfig = { auto: true, after: () => { window.__pagedDone = true; } };</script>
<script>${PAGEDJS_POLYFILL}</script>
</head>
<body>${html}</body>
</html>`;

    await page.setContent(fullHtml, { waitUntil: "networkidle" });
    await page.waitForFunction(() => (globalThis as unknown as { __pagedDone?: boolean }).__pagedDone === true, { timeout: 60000 });

    const pdfBuffer = await page.pdf({
      width: `${pageWidthCm}cm`,
      height: `${pageHeightCm}cm`,
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${(title || "documento").replace(/"/g, "")}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error("Error exportando PDF", err);
    res.status(500).json({ error: "No se pudo generar el PDF." });
  } finally {
    await browser?.close();
  }
});

function clampCm(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 2.5;
  return Math.min(Math.max(value, 0), 10);
}

function cmToTwip(cm: number): number {
  return Math.round((cm / 2.54) * 1440);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Escapa un texto para usarlo dentro de un string literal de CSS (content: "..."). */
function escapeCss(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ");
}
