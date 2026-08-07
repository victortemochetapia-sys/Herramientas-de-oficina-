import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export interface FindMatch {
  from: number;
  to: number;
}

const pluginKey = new PluginKey("findReplace");

declare module "@tiptap/core" {
  interface Storage {
    findReplace: { matches: FindMatch[]; activeIndex: number };
  }
  interface Commands<ReturnType> {
    findReplace: {
      setFindMatches: (matches: FindMatch[], activeIndex: number) => ReturnType;
    };
  }
}

/** Busca todas las apariciones (sin distinguir mayúsculas) de `term` en el documento. */
export function computeMatches(doc: import("@tiptap/pm/model").Node, term: string): FindMatch[] {
  if (!term.trim()) return [];
  const lowerTerm = term.toLowerCase();
  let text = "";
  const offsets: number[] = [];

  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      for (let i = 0; i < node.text.length; i++) offsets.push(pos + i);
      text += node.text;
    }
  });

  const lowerText = text.toLowerCase();
  const matches: FindMatch[] = [];
  let idx = 0;
  while (true) {
    const found = lowerText.indexOf(lowerTerm, idx);
    if (found === -1) break;
    matches.push({ from: offsets[found], to: offsets[found + term.length - 1] + 1 });
    idx = found + 1;
  }
  return matches;
}

export const FindReplace = Extension.create({
  name: "findReplace",

  addStorage() {
    return { matches: [] as FindMatch[], activeIndex: -1 };
  },

  addCommands() {
    return {
      setFindMatches:
        (matches: FindMatch[], activeIndex: number) =>
        ({ editor, tr, dispatch }) => {
          editor.storage.findReplace.matches = matches;
          editor.storage.findReplace.activeIndex = activeIndex;
          if (dispatch) dispatch(tr.setMeta(pluginKey, true));
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const extension = this;
    return [
      new Plugin({
        key: pluginKey,
        props: {
          decorations(state) {
            const { matches, activeIndex } = extension.editor.storage.findReplace;
            if (!matches.length) return null;
            const decorations = matches.map((m: FindMatch, i: number) =>
              Decoration.inline(m.from, m.to, { class: i === activeIndex ? "search-match search-match-active" : "search-match" }),
            );
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});
