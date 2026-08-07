import { Router } from "express";
import multer from "multer";
import mammoth from "mammoth";
import { existsSync } from "node:fs";
// html-to-docx no publica tipos; se importa como módulo CJS por defecto.
// @ts-expect-error - sin tipados
import HTMLtoDOCX from "html-to-docx";
import { chromium } from "playwright";

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
  const { html, title } = req.body as { html?: string; title?: string };
  if (!html) {
    res.status(400).json({ error: "Falta el contenido HTML." });
    return;
  }

  try {
    const buffer = await HTMLtoDOCX(html, null, {
      table: { row: { cantSplit: true } },
      footer: false,
      pageNumber: false,
      title: title || "Documento",
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${(title || "documento").replace(/"/g, "")}.docx"`);
    res.send(buffer);
  } catch (err) {
    console.error("Error exportando .docx", err);
    res.status(500).json({ error: "No se pudo generar el .docx." });
  }
});

/**
 * Exporta HTML del editor a PDF usando Chromium headless (Playwright).
 */
convertRouter.post("/export/pdf", async (req, res) => {
  const { html, title, margins } = req.body as {
    html?: string;
    title?: string;
    margins?: { top?: number; right?: number; bottom?: number; left?: number };
  };
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
  @page { margin: ${m.top}cm ${m.right}cm ${m.bottom}cm ${m.left}cm; }
  body { font-family: "Liberation Serif", Georgia, serif; font-size: 12pt; line-height: 1.5; color: #1a1a1a; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1px solid #999; padding: 6px 8px; }
  img { max-width: 100%; }
  h1, h2, h3 { font-family: "Liberation Sans", Arial, sans-serif; }
</style>
</head>
<body>${html}</body>
</html>`;

    await page.setContent(fullHtml, { waitUntil: "networkidle" });
    const pdfBuffer = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });

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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
