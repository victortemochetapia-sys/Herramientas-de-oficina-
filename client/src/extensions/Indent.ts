import { Extension } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    indent: {
      increaseIndent: () => ReturnType;
      decreaseIndent: () => ReturnType;
    };
  }
}

const MAX_INDENT = 8;

/** Sangría izquierda por párrafo/título, con botones de aumentar/disminuir. */
export const Indent = Extension.create({
  name: "indent",

  addOptions() {
    return { types: ["paragraph", "heading"] };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element: HTMLElement) => {
              const value = parseInt(element.style.marginLeft || "0", 10);
              return Number.isNaN(value) ? 0 : Math.round(value / 24);
            },
            renderHTML: (attributes: Record<string, unknown>) => {
              const level = Number(attributes.indent) || 0;
              if (level <= 0) return {};
              return { style: `margin-left: ${level * 24}px` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      increaseIndent:
        () =>
        ({ tr, state, dispatch }) => {
          const { selection } = state;
          if (dispatch) {
            state.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
              if (this.options.types.includes(node.type.name)) {
                const current = Number(node.attrs.indent) || 0;
                tr.setNodeAttribute(pos, "indent", Math.min(MAX_INDENT, current + 1));
              }
            });
            dispatch(tr);
          }
          return true;
        },
      decreaseIndent:
        () =>
        ({ tr, state, dispatch }) => {
          const { selection } = state;
          if (dispatch) {
            state.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
              if (this.options.types.includes(node.type.name)) {
                const current = Number(node.attrs.indent) || 0;
                tr.setNodeAttribute(pos, "indent", Math.max(0, current - 1));
              }
            });
            dispatch(tr);
          }
          return true;
        },
    };
  },
});
