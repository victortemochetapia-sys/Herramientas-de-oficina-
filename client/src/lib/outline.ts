import type { Editor } from "@tiptap/react";

export interface OutlineHeading {
  level: number;
  text: string;
  pos: number;
}

/** Recorre el documento y devuelve los títulos (H1/H2/H3) en orden. */
export function getOutline(editor: Editor): OutlineHeading[] {
  const headings: OutlineHeading[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "heading") {
      headings.push({ level: node.attrs.level, text: node.textContent || "(sin título)", pos });
    }
  });
  return headings;
}

/**
 * Construye (o actualiza) el bloque de tabla de contenido a partir de los
 * títulos actuales del documento. Si ya existe uno, lo reemplaza en el
 * mismo lugar; si no, lo inserta en la posición del cursor.
 */
export function insertOrUpdateToc(editor: Editor): boolean {
  const headings = getOutline(editor);
  if (headings.length === 0) return false;

  const content = {
    type: "tocBlock",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", marks: [{ type: "bold" }], text: "Tabla de contenido" }],
      },
      ...headings.map((h) => ({
        type: "paragraph",
        attrs: { indent: Math.max(0, h.level - 1) },
        content: h.text ? [{ type: "text", text: h.text }] : [],
      })),
    ],
  };

  let existingFrom: number | null = null;
  let existingTo = 0;
  editor.state.doc.descendants((node, pos) => {
    if (existingFrom === null && node.type.name === "tocBlock") {
      existingFrom = pos;
      existingTo = pos + node.nodeSize;
    }
  });

  if (existingFrom !== null) {
    editor.chain().focus().insertContentAt({ from: existingFrom, to: existingTo }, content).run();
  } else {
    editor.chain().focus().insertContent(content).run();
  }
  return true;
}
