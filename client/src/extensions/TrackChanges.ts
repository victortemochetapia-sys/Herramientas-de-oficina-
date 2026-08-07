import { Extension, Mark, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";

let changeCounter = 0;
function newChangeId() {
  changeCounter += 1;
  return `chg-${Date.now()}-${changeCounter}`;
}

function today() {
  return new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const changeAttrs = () => ({
  id: {
    default: null,
    parseHTML: (el: HTMLElement) => el.getAttribute("data-change-id"),
    renderHTML: (attrs: Record<string, unknown>) => (attrs.id ? { "data-change-id": attrs.id } : {}),
  },
  author: {
    default: "Tú",
    parseHTML: (el: HTMLElement) => el.getAttribute("data-author"),
    renderHTML: (attrs: Record<string, unknown>) => (attrs.author ? { "data-author": attrs.author } : {}),
  },
  date: {
    default: "",
    parseHTML: (el: HTMLElement) => el.getAttribute("data-date"),
    renderHTML: (attrs: Record<string, unknown>) => (attrs.date ? { "data-date": attrs.date } : {}),
  },
});

export const TrackInsertMark = Mark.create({
  name: "trackInsert",
  addAttributes: changeAttrs,
  parseHTML() {
    return [{ tag: 'span[data-change-type="insert"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { class: "track-insert", "data-change-type": "insert" }), 0];
  },
});

export const TrackDeleteMark = Mark.create({
  name: "trackDelete",
  addAttributes: changeAttrs,
  parseHTML() {
    return [{ tag: 'span[data-change-type="delete"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { class: "track-delete", "data-change-type": "delete" }), 0];
  },
});

export interface TrackedChangeSummary {
  id: string;
  type: "insert" | "delete";
  text: string;
  author: string;
  date: string;
}

/** Recorre el documento y agrupa los tramos marcados por id de cambio. */
export function getTrackedChanges(editor: { state: { doc: import("@tiptap/pm/model").Node } }): TrackedChangeSummary[] {
  const byId = new Map<string, TrackedChangeSummary>();
  editor.state.doc.descendants((node) => {
    if (!node.isText) return;
    for (const mark of node.marks) {
      if (mark.type.name !== "trackInsert" && mark.type.name !== "trackDelete") continue;
      const id = mark.attrs.id as string;
      if (!id) continue;
      const existing = byId.get(id);
      if (existing) {
        existing.text += node.text || "";
      } else {
        byId.set(id, {
          id,
          type: mark.type.name === "trackInsert" ? "insert" : "delete",
          text: node.text || "",
          author: mark.attrs.author || "Tú",
          date: mark.attrs.date || "",
        });
      }
    }
  });
  return Array.from(byId.values());
}

declare module "@tiptap/core" {
  interface Storage {
    trackChanges: { enabled: boolean };
  }
  interface Commands<ReturnType> {
    trackChanges: {
      setTrackChangesEnabled: (enabled: boolean) => ReturnType;
      acceptAllChanges: () => ReturnType;
      rejectAllChanges: () => ReturnType;
      acceptChange: (id: string) => ReturnType;
      rejectChange: (id: string) => ReturnType;
    };
  }
}

function collectRangesByPredicate(
  doc: import("@tiptap/pm/model").Node,
  predicate: (markName: string, attrs: Record<string, unknown>) => "delete" | "unmark" | null,
  tr: import("@tiptap/pm/state").Transaction,
) {
  const deleteRanges: [number, number][] = [];
  doc.descendants((node, pos) => {
    if (!node.isText) return;
    for (const mark of node.marks) {
      const action = predicate(mark.type.name, mark.attrs);
      if (action === "delete") {
        deleteRanges.push([pos, pos + node.nodeSize]);
      } else if (action === "unmark") {
        tr.removeMark(pos, pos + node.nodeSize, mark.type);
      }
    }
  });
  deleteRanges.sort((a, b) => b[0] - a[0]);
  deleteRanges.forEach(([from, to]) => tr.delete(from, to));
}

export const TrackChanges = Extension.create({
  name: "trackChanges",

  addStorage() {
    return { enabled: false };
  },

  addCommands() {
    return {
      setTrackChangesEnabled:
        (enabled: boolean) =>
        ({ editor }) => {
          editor.storage.trackChanges.enabled = enabled;
          return true;
        },
      acceptAllChanges:
        () =>
        ({ tr, state, dispatch }) => {
          if (!dispatch) return true;
          collectRangesByPredicate(
            state.doc,
            (name) => {
              if (name === "trackDelete") return "delete";
              if (name === "trackInsert") return "unmark";
              return null;
            },
            tr,
          );
          dispatch(tr);
          return true;
        },
      rejectAllChanges:
        () =>
        ({ tr, state, dispatch }) => {
          if (!dispatch) return true;
          collectRangesByPredicate(
            state.doc,
            (name) => {
              if (name === "trackInsert") return "delete";
              if (name === "trackDelete") return "unmark";
              return null;
            },
            tr,
          );
          dispatch(tr);
          return true;
        },
      acceptChange:
        (id: string) =>
        ({ tr, state, dispatch }) => {
          if (!dispatch) return true;
          collectRangesByPredicate(
            state.doc,
            (name, attrs) => {
              if (attrs.id !== id) return null;
              if (name === "trackDelete") return "delete";
              if (name === "trackInsert") return "unmark";
              return null;
            },
            tr,
          );
          dispatch(tr);
          return true;
        },
      rejectChange:
        (id: string) =>
        ({ tr, state, dispatch }) => {
          if (!dispatch) return true;
          collectRangesByPredicate(
            state.doc,
            (name, attrs) => {
              if (attrs.id !== id) return null;
              if (name === "trackInsert") return "delete";
              if (name === "trackDelete") return "unmark";
              return null;
            },
            tr,
          );
          dispatch(tr);
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    const handleBackspace = () => {
      if (!this.editor.storage.trackChanges.enabled) return false;
      const { state, dispatch } = this.editor.view;
      const { selection } = state;

      if (!selection.empty) {
        const tr = state.tr.addMark(
          selection.from,
          selection.to,
          state.schema.marks.trackDelete.create({ id: newChangeId(), author: "Tú", date: today() }),
        );
        tr.setSelection(TextSelection.create(tr.doc, selection.from));
        dispatch(tr);
        return true;
      }

      let boundary = selection.from;
      let before = state.doc.resolve(boundary).nodeBefore;
      while (before && before.marks.some((m) => m.type.name === "trackDelete")) {
        boundary -= before.nodeSize;
        before = state.doc.resolve(boundary).nodeBefore;
      }
      if (!before || boundary === 0) {
        const tr = state.tr.setSelection(TextSelection.create(state.doc, boundary));
        dispatch(tr);
        return true;
      }

      // Si el cursor está justo antes de un tramo ya marcado como eliminado
      // (backspaces repetidos), reutiliza su id para no fragmentar el cambio.
      const adjacentDeleted = state.doc.resolve(boundary).nodeAfter;
      const reuseId = adjacentDeleted?.marks.find((m) => m.type.name === "trackDelete")?.attrs.id as string | undefined;

      const from = boundary - 1;
      const to = boundary;
      const tr = state.tr.addMark(
        from,
        to,
        state.schema.marks.trackDelete.create({ id: reuseId ?? newChangeId(), author: "Tú", date: today() }),
      );
      tr.setSelection(TextSelection.create(tr.doc, from));
      dispatch(tr);
      return true;
    };

    const handleDelete = () => {
      if (!this.editor.storage.trackChanges.enabled) return false;
      const { state, dispatch } = this.editor.view;
      const { selection } = state;

      if (!selection.empty) {
        const tr = state.tr.addMark(
          selection.from,
          selection.to,
          state.schema.marks.trackDelete.create({ id: newChangeId(), author: "Tú", date: today() }),
        );
        tr.setSelection(TextSelection.create(tr.doc, selection.from));
        dispatch(tr);
        return true;
      }

      let boundary = selection.from;
      let reuseId: string | undefined;
      let after = state.doc.resolve(boundary).nodeAfter;
      while (after && after.marks.some((m) => m.type.name === "trackDelete")) {
        reuseId = after.marks.find((m) => m.type.name === "trackDelete")?.attrs.id as string | undefined;
        boundary += after.nodeSize;
        after = state.doc.resolve(boundary).nodeAfter;
      }
      if (!after) return true;

      const from = boundary;
      const to = boundary + 1;
      const tr = state.tr.addMark(
        from,
        to,
        state.schema.marks.trackDelete.create({ id: reuseId ?? newChangeId(), author: "Tú", date: today() }),
      );
      tr.setSelection(TextSelection.create(tr.doc, boundary));
      dispatch(tr);
      return true;
    };

    return { Backspace: handleBackspace, Delete: handleDelete };
  },

  addProseMirrorPlugins() {
    const extension = this;
    const pluginKey = new PluginKey("trackChanges");

    return [
      new Plugin({
        key: pluginKey,
        props: {
          handleTextInput(view, from, to, text) {
            if (!extension.editor.storage.trackChanges.enabled) return false;
            if (from === to) return false;

            const { state, dispatch } = view;
            const tr = state.tr;
            tr.addMark(from, to, state.schema.marks.trackDelete.create({ id: newChangeId(), author: "Tú", date: today() }));
            tr.insertText(text, to, to);
            tr.addMark(
              to,
              to + text.length,
              state.schema.marks.trackInsert.create({ id: newChangeId(), author: "Tú", date: today() }),
            );
            tr.setSelection(TextSelection.create(tr.doc, to + text.length));
            tr.setMeta("trackChangesSkip", true);
            dispatch(tr);
            return true;
          },
        },
        appendTransaction(transactions, _oldState, newState) {
          if (!extension.editor.storage.trackChanges.enabled) return null;
          if (transactions.length !== 1) return null;
          const transaction = transactions[0];
          if (!transaction.docChanged) return null;
          if (transaction.getMeta("trackChangesSkip")) return null;
          if (transaction.getMeta("history$")) return null;

          const insertedRanges: [number, number][] = [];
          transaction.mapping.maps.forEach((stepMap, i) => {
            stepMap.forEach((_fromA, _toA, fromB, toB) => {
              const from = transaction.mapping.slice(i + 1).map(fromB, -1);
              const to = transaction.mapping.slice(i + 1).map(toB, 1);
              if (to > from) insertedRanges.push([from, to]);
            });
          });
          if (insertedRanges.length === 0) return null;

          const tr = newState.tr;
          insertedRanges.forEach(([from, to]) => {
            // Si la inserción continúa justo donde terminaba otra ya marcada
            // (p. ej. tecleando seguido), reutiliza su id en vez de crear un
            // cambio nuevo por cada pulsación.
            const before = from > 0 ? newState.doc.resolve(from).nodeBefore : null;
            const reuseId = before?.marks.find((m) => m.type.name === "trackInsert")?.attrs.id as string | undefined;
            const id = reuseId ?? newChangeId();
            tr.addMark(from, to, newState.schema.marks.trackInsert.create({ id, author: "Tú", date: today() }));
          });
          return tr;
        },
      }),
    ];
  },
});
