import { Node, mergeAttributes } from "@tiptap/core";

/**
 * Contenedor para la tabla de contenido generada. Permite localizarla y
 * regenerarla ("Actualizar tabla de contenido") en vez de duplicarla.
 */
export const TocBlock = Node.create({
  name: "tocBlock",
  group: "block",
  content: "block+",
  defining: true,

  parseHTML() {
    return [{ tag: "div[data-toc]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { class: "toc-block", "data-toc": "" }), 0];
  },
});
