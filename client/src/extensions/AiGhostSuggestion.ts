import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export interface AiGhostSuggestionOptions {
  onAccept?: (text: string) => void;
}

interface GhostState {
  text: string;
  pos: number;
}

const key = new PluginKey<GhostState | null>("aiGhostSuggestion");

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    aiGhostSuggestion: {
      setAiSuggestion: (text: string) => ReturnType;
      clearAiSuggestion: () => ReturnType;
      acceptAiSuggestion: () => ReturnType;
    };
  }
}

/**
 * Extensión que muestra una sugerencia de IA como texto "fantasma" (gris,
 * no editable) justo después del cursor. Tab la acepta, Escape la descarta,
 * y cualquier edición o movimiento del cursor la invalida automáticamente.
 */
export const AiGhostSuggestion = Extension.create<AiGhostSuggestionOptions>({
  name: "aiGhostSuggestion",

  addOptions() {
    return { onAccept: undefined };
  },

  addCommands() {
    return {
      setAiSuggestion:
        (text: string) =>
        ({ state, dispatch }) => {
          if (!text) return false;
          const pos = state.selection.from;
          if (dispatch) {
            dispatch(state.tr.setMeta(key, { type: "set", text, pos }));
          }
          return true;
        },
      clearAiSuggestion:
        () =>
        ({ state, dispatch }) => {
          if (dispatch) {
            dispatch(state.tr.setMeta(key, { type: "clear" }));
          }
          return true;
        },
      acceptAiSuggestion:
        () =>
        ({ state, dispatch, tr }) => {
          const ghost = key.getState(state);
          if (!ghost) return false;
          if (dispatch) {
            tr.insertText(ghost.text, ghost.pos, ghost.pos);
            tr.setMeta(key, { type: "clear" });
            dispatch(tr);
            this.options.onAccept?.(ghost.text);
          }
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        const ghost = key.getState(this.editor.state);
        if (!ghost) return false;
        return this.editor.commands.acceptAiSuggestion();
      },
      Escape: () => {
        const ghost = key.getState(this.editor.state);
        if (!ghost) return false;
        return this.editor.commands.clearAiSuggestion();
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<GhostState | null>({
        key,
        state: {
          init: () => null,
          apply(tr, value) {
            const meta = tr.getMeta(key);
            if (meta?.type === "set") {
              return { text: meta.text, pos: meta.pos };
            }
            if (meta?.type === "clear") {
              return null;
            }
            if (!value) return null;
            // Cualquier cambio de doc o movimiento de cursor invalida la sugerencia.
            if (tr.docChanged) return null;
            if (tr.selectionSet && tr.selection.from !== value.pos) return null;
            return value;
          },
        },
        props: {
          decorations(state) {
            const ghost = key.getState(state);
            if (!ghost) return null;
            const widget = document.createElement("span");
            widget.className = "ai-ghost-text";
            widget.textContent = ghost.text;
            widget.setAttribute("contenteditable", "false");
            return DecorationSet.create(state.doc, [Decoration.widget(ghost.pos, widget, { side: 1 })]);
          },
        },
      }),
    ];
  },
});
