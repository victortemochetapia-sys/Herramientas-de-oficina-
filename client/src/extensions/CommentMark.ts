import { Mark, mergeAttributes } from "@tiptap/core";

export interface CommentMarkOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    commentMark: {
      setComment: (id: string) => ReturnType;
      unsetComment: (id: string) => ReturnType;
    };
  }
}

/**
 * Marca de texto comentado. Varios comentarios pueden solaparse porque no es
 * exclusiva; cada tramo lleva el id del comentario al que pertenece.
 */
export const CommentMark = Mark.create<CommentMarkOptions>({
  name: "commentMark",
  excludes: "",

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-comment-id"),
        renderHTML: (attributes) => {
          if (!attributes.commentId) return {};
          return { "data-comment-id": attributes.commentId };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-comment-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { class: "commented-text" }), 0];
  },

  addCommands() {
    return {
      setComment:
        (id: string) =>
        ({ chain }) =>
          chain().setMark(this.name, { commentId: id }).run(),
      unsetComment:
        (id: string) =>
        ({ tr, state, dispatch }) => {
          if (dispatch) {
            state.doc.descendants((node, pos) => {
              node.marks.forEach((mark) => {
                if (mark.type.name === "commentMark" && mark.attrs.commentId === id) {
                  tr.removeMark(pos, pos + node.nodeSize, mark.type);
                }
              });
            });
            dispatch(tr);
          }
          return true;
        },
    };
  },
});
