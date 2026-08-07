import { Node, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    pageBreak: {
      insertPageBreak: () => ReturnType;
    };
  }
}

/**
 * Salto de página manual: un nodo de bloque no editable que se muestra como
 * una línea con etiqueta en el editor, y fuerza un corte real de página al
 * exportar a PDF (CSS `break-after: page`).
 */
export const PageBreak = Node.create({
  name: "pageBreak",
  group: "block",
  atom: true,
  selectable: true,

  parseHTML() {
    return [{ tag: 'div[data-page-break]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { class: "page-break", "data-page-break": "" })];
  },

  addCommands() {
    return {
      insertPageBreak:
        () =>
        ({ chain }) =>
          chain().insertContent({ type: this.name }).run(),
    };
  },
});
