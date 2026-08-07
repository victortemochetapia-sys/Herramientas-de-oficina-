import { Router } from "express";
import type Anthropic from "@anthropic-ai/sdk";
import { AI_MODEL, aiEnabled, anthropic } from "../lib/anthropic.js";

export const aiRouter = Router();

aiRouter.get("/status", (_req, res) => {
  res.json({ enabled: aiEnabled });
});

/**
 * Sugerencia de continuación mientras el usuario escribe ("ghost text").
 * Se mantiene corta y de baja latencia: 1-2 frases como máximo.
 */
aiRouter.post("/suggest", async (req, res) => {
  if (!aiEnabled || !anthropic) {
    res.status(503).json({ error: "IA no configurada. Define ANTHROPIC_API_KEY en el servidor." });
    return;
  }

  const { textBefore, instructions } = req.body as {
    textBefore?: string;
    instructions?: string;
  };

  if (!textBefore || !textBefore.trim()) {
    res.json({ suggestion: "" });
    return;
  }

  try {
    const message = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 60,
      system:
        "Eres un asistente de redacción integrado en un procesador de textos. " +
        "El usuario está escribiendo un documento y quieres continuarlo de forma natural, " +
        "manteniendo el mismo idioma, tono y estilo. " +
        (instructions ? `Instrucciones adicionales del usuario: ${instructions}. ` : "") +
        "Responde ÚNICAMENTE con el texto que continúa directamente donde el cursor quedó, " +
        "sin repetir lo ya escrito, sin comillas ni explicaciones. Máximo una o dos frases cortas.",
      messages: [
        {
          role: "user",
          content: `Texto ya escrito (continúa justo después de esto):\n\n"""\n${textBefore.slice(-2000)}\n"""`,
        },
      ],
    });

    const suggestion = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    res.json({ suggestion });
  } catch (err) {
    console.error("Error en /api/ai/suggest", err);
    res.status(500).json({ error: "No se pudo generar la sugerencia." });
  }
});

/**
 * Reescritura dirigida por instrucciones del usuario (streaming vía SSE).
 * Ej: "hazlo más formal", "resume en 3 puntos", "corrige la ortografía".
 */
aiRouter.post("/instruct", async (req, res) => {
  if (!aiEnabled || !anthropic) {
    res.status(503).json({ error: "IA no configurada. Define ANTHROPIC_API_KEY en el servidor." });
    return;
  }

  const { selection, instruction, context } = req.body as {
    selection?: string;
    instruction?: string;
    context?: string;
  };

  if (!instruction || !instruction.trim()) {
    res.status(400).json({ error: "Falta la instrucción." });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const userText = selection?.trim()
      ? `Texto seleccionado a modificar:\n"""\n${selection}\n"""\n\nInstrucción: ${instruction}`
      : `No hay texto seleccionado. Instrucción: ${instruction}`;

    const stream = anthropic.messages.stream({
      model: AI_MODEL,
      max_tokens: 2000,
      system:
        "Eres un asistente de redacción integrado en un procesador de textos tipo OpenOffice Writer. " +
        "El usuario te da una instrucción para modificar o generar texto en su documento. " +
        "Responde ÚNICAMENTE con el texto final resultante, listo para insertarse en el documento " +
        "en lugar de la selección (o en el punto del cursor si no hay selección). " +
        "No agregues comillas, explicaciones, ni comentarios sobre lo que hiciste. " +
        "Conserva el idioma del documento salvo que se pida traducir." +
        (context ? ` Contexto adicional del documento: ${context.slice(0, 1500)}` : ""),
      messages: [{ role: "user", content: userText }],
    });

    stream.on("text", (delta) => {
      send("delta", { text: delta });
    });

    stream.on("error", (err) => {
      console.error("Error de streaming en /api/ai/instruct", err);
      send("error", { message: "Error generando la respuesta." });
      res.end();
    });

    await stream.finalMessage();
    send("done", {});
    res.end();
  } catch (err) {
    console.error("Error en /api/ai/instruct", err);
    send("error", { message: "No se pudo procesar la instrucción." });
    res.end();
  }
});
