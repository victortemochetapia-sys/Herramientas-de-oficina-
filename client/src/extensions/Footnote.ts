import { Node, mergeAttributes } from "@tiptap/core";

let counter = 0;
function newFootnoteId() {
  counter += 1;
  return `fn-${Date.now()}-${counter}`;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    footnote: {
      insertFootnote: () => ReturnType;
      setFootnoteText: (id: string, text: string) => ReturnType;
      removeFootnote: (id: string) => ReturnType;
    };
  }
}

/**
 * Nota al pie: un nodo inline "atom" que guarda su propio texto como
 * atributo. En el editor se ve como un marcador pequeño y clickeable; el
 * texto real se edita en un popup (ver FootnotePopup.tsx). Al exportar, se
 * transforma según el destino (PDF: nota real de página vía paged.js;
 * DOCX: referencia numerada + sección de notas al final, ver
 * lib/footnotes.ts).
 */
export const Footnote = Node.create({
  name: "footnote",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-footnote-id"),
        renderHTML: (attrs: Record<string, unknown>) => ({ "data-footnote-id": attrs.id }),
      },
      text: {
        default: "",
        parseHTML: (el: HTMLElement) => el.getAttribute("data-footnote-text") || "",
        renderHTML: (attrs: Record<string, unknown>) => ({ "data-footnote-text": attrs.text }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "sup[data-footnote-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["sup", mergeAttributes(HTMLAttributes, { class: "footnote-ref" }), "†"];
  },

  addCommands() {
    return {
      insertFootnote:
        () =>
        ({ chain }) =>
          chain()
            .insertContent({ type: this.name, attrs: { id: newFootnoteId(), text: "" } })
            .run(),
      setFootnoteText:
        (id: string, text: string) =>
        ({ tr, state, dispatch }) => {
          if (!dispatch) return true;
          state.doc.descendants((node, pos) => {
            if (node.type.name === "footnote" && node.attrs.id === id) {
              tr.setNodeAttribute(pos, "text", text);
            }
          });
          dispatch(tr);
          return true;
        },
      removeFootnote:
        (id: string) =>
        ({ tr, state, dispatch }) => {
          if (!dispatch) return true;
          state.doc.descendants((node, pos) => {
            if (node.type.name === "footnote" && node.attrs.id === id) {
              tr.delete(pos, pos + node.nodeSize);
            }
          });
          dispatch(tr);
          return true;
        },
    };
  },
});
