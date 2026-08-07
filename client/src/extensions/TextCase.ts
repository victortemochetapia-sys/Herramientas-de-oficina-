import { Extension } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    textCase: {
      transformCase: (mode: "upper" | "lower" | "title") => ReturnType;
    };
  }
}

function applyCase(text: string, mode: "upper" | "lower" | "title"): string {
  if (mode === "upper") return text.toLocaleUpperCase("es-ES");
  if (mode === "lower") return text.toLocaleLowerCase("es-ES");
  return text.replace(/\p{L}+/gu, (word) => word.charAt(0).toLocaleUpperCase("es-ES") + word.slice(1).toLocaleLowerCase("es-ES"));
}

/**
 * Cambia mayúsculas/minúsculas del texto seleccionado conservando las
 * marcas (negrita, color, etc.) de cada tramo de texto.
 */
export const TextCase = Extension.create({
  name: "textCase",

  addCommands() {
    return {
      transformCase:
        (mode: "upper" | "lower" | "title") =>
        ({ tr, state, dispatch }) => {
          const { from, to } = state.selection;
          if (from === to) return false;
          if (dispatch) {
            state.doc.nodesBetween(from, to, (node, pos) => {
              if (!node.isText || !node.text) return;
              const start = Math.max(from, pos);
              const end = Math.min(to, pos + node.nodeSize);
              if (start >= end) return;
              const sliceStart = start - pos;
              const sliceEnd = end - pos;
              const original = node.text.slice(sliceStart, sliceEnd);
              const transformed = applyCase(original, mode);
              if (transformed === original) return;
              tr.replaceWith(tr.mapping.map(start), tr.mapping.map(end), state.schema.text(transformed, node.marks));
            });
            dispatch(tr);
          }
          return true;
        },
    };
  },
});
