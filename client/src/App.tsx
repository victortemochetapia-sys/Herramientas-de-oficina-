import { useCallback, useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Image from "@tiptap/extension-image";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import FontFamily from "@tiptap/extension-font-family";

import { Ribbon } from "./components/Ribbon";
import { MenuBar } from "./components/MenuBar";
import { StatusBar } from "./components/StatusBar";
import { AiSidebar } from "./components/AiSidebar";
import { CommentsPanel } from "./components/CommentsPanel";
import { ReviewPanel } from "./components/ReviewPanel";
import { Ruler } from "./components/Ruler";
import { PageGuides } from "./components/PageGuides";
import { AiGhostSuggestion } from "./extensions/AiGhostSuggestion";
import { FontSize } from "./extensions/FontSize";
import { CommentMark } from "./extensions/CommentMark";
import { TrackChanges, TrackDeleteMark, TrackInsertMark, getTrackedChanges, type TrackedChangeSummary } from "./extensions/TrackChanges";
import { exportDocx, exportPdf, fetchAiStatus, fetchAiSuggestion, importDocx, streamAiInstruction } from "./lib/api";
import { sanitizeHtmlForExport } from "./lib/sanitizeExport";
import type { DocComment } from "./types";

import "./index.css";
import "./editor.css";

const SUGGESTION_DEBOUNCE_MS = 900;

export const PAGE_WIDTH_PX = 794; // A4 (21cm) a 96dpi
export const PAGE_HEIGHT_PX = 1123; // A4 (29.7cm) a 96dpi
export const PX_PER_CM = PAGE_WIDTH_PX / 21;

export interface Margins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const DEFAULT_MARGINS: Margins = { top: 2.5, right: 2.5, bottom: 2.5, left: 2.5 };

type SidebarTab = "ai" | "comments" | "review";

function App() {
  const [title, setTitle] = useState("Documento sin título");
  const [busy, setBusy] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [suggestionsEnabled, setSuggestionsEnabled] = useState(false);
  const [suggestionStyle, setSuggestionStyle] = useState("");
  const [instructBusy, setInstructBusy] = useState(false);
  const [instructError, setInstructError] = useState<string | null>(null);
  const [hasSelection, setHasSelection] = useState(false);
  const [counts, setCounts] = useState({ words: 0, characters: 0 });
  const [margins, setMargins] = useState<Margins>(DEFAULT_MARGINS);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("ai");
  const [comments, setComments] = useState<DocComment[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [trackChangesEnabled, setTrackChangesEnabled] = useState(false);
  const [trackedChanges, setTrackedChanges] = useState<TrackedChangeSummary[]>([]);

  const suggestionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionRequestId = useRef(0);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      TextStyle,
      Color,
      Highlight,
      FontFamily,
      FontSize,
      Image,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder: "Empieza a escribir tu documento…" }),
      AiGhostSuggestion,
      CommentMark,
      TrackInsertMark,
      TrackDeleteMark,
      TrackChanges,
    ],
    content: "<p></p>",
    autofocus: true,
    editorProps: {
      attributes: { spellcheck: "true", lang: "es" },
    },
  });

  useEffect(() => {
    fetchAiStatus().then(setAiEnabled);
  }, []);

  // Contador de palabras/caracteres + estado de selección.
  useEffect(() => {
    if (!editor) return;
    const update = () => {
      const text = editor.getText();
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      setCounts({ words, characters: text.length });
      setHasSelection(!editor.state.selection.empty);
    };
    update();
    editor.on("update", update);
    editor.on("selectionUpdate", update);
    return () => {
      editor.off("update", update);
      editor.off("selectionUpdate", update);
    };
  }, [editor]);

  // Modo de revisión (control de cambios): sincroniza el estado de React con
  // la extensión, y mantiene la lista de cambios pendientes actualizada.
  useEffect(() => {
    if (!editor) return;
    editor.storage.trackChanges.enabled = trackChangesEnabled;
  }, [editor, trackChangesEnabled]);

  useEffect(() => {
    if (!editor) return;
    const update = () => setTrackedChanges(getTrackedChanges(editor));
    update();
    editor.on("update", update);
    return () => {
      editor.off("update", update);
    };
  }, [editor]);

  // Sugerencias de IA en vivo (ghost text) mientras el usuario escribe.
  useEffect(() => {
    if (!editor) return;

    const handler = () => {
      if (suggestionTimer.current) clearTimeout(suggestionTimer.current);
      if (!suggestionsEnabled || !aiEnabled) return;

      suggestionTimer.current = setTimeout(async () => {
        const { selection } = editor.state;
        if (!selection.empty) return;
        const from = selection.from;
        const textBefore = editor.state.doc.textBetween(Math.max(0, from - 3000), from, "\n", "\n");
        if (!textBefore.trim()) return;

        const requestId = ++suggestionRequestId.current;
        try {
          const suggestion = await fetchAiSuggestion(textBefore, suggestionStyle);
          if (requestId !== suggestionRequestId.current) return;
          if (suggestion && editor.state.selection.from === from) {
            editor.commands.setAiSuggestion(suggestion);
          }
        } catch {
          // Silencioso: una sugerencia fallida no debe interrumpir la escritura.
        }
      }, SUGGESTION_DEBOUNCE_MS);
    };

    editor.on("update", handler);
    return () => {
      if (suggestionTimer.current) clearTimeout(suggestionTimer.current);
      editor.off("update", handler);
    };
  }, [editor, suggestionsEnabled, aiEnabled, suggestionStyle]);

  const handleNew = useCallback(() => {
    if (!editor) return;
    if (!window.confirm("¿Crear un nuevo documento? Se perderá el contenido no guardado.")) return;
    editor.commands.setContent("<p></p>");
    setTitle("Documento sin título");
    setComments([]);
  }, [editor]);

  const handleOpenFile = useCallback(
    async (file: File) => {
      if (!editor) return;
      setBusy(true);
      try {
        const nameNoExt = file.name.replace(/\.[^.]+$/, "");
        if (file.name.toLowerCase().endsWith(".docx")) {
          const { html } = await importDocx(file);
          editor.commands.setContent(html);
        } else {
          const text = await file.text();
          if (file.name.toLowerCase().match(/\.html?$/)) {
            editor.commands.setContent(text);
          } else {
            editor.commands.setContent(`<p>${text.split(/\n/).join("</p><p>")}</p>`);
          }
        }
        setTitle(nameNoExt);
        setComments([]);
      } catch (err) {
        alert(err instanceof Error ? err.message : "No se pudo abrir el archivo.");
      } finally {
        setBusy(false);
      }
    },
    [editor],
  );

  const handleSaveDocx = useCallback(async () => {
    if (!editor) return;
    setBusy(true);
    try {
      await exportDocx(sanitizeHtmlForExport(editor.getHTML()), title);
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo guardar el .docx.");
    } finally {
      setBusy(false);
    }
  }, [editor, title]);

  const handleSavePdf = useCallback(async () => {
    if (!editor) return;
    setBusy(true);
    try {
      await exportPdf(sanitizeHtmlForExport(editor.getHTML()), title, margins);
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo guardar el .pdf.");
    } finally {
      setBusy(false);
    }
  }, [editor, title, margins]);

  const handleSaveTxt = useCallback(() => {
    if (!editor) return;
    const blob = new Blob([editor.getText()], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title || "documento"}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [editor, title]);

  const handleApplyInstruction = useCallback(
    async (instruction: string) => {
      if (!editor) return;
      const { from, to, empty } = editor.state.selection;
      const selectionText = empty ? "" : editor.state.doc.textBetween(from, to, "\n");
      const context = editor.getText().slice(0, 1500);

      setInstructBusy(true);
      setInstructError(null);
      editor.commands.clearAiSuggestion();

      let insertPos = from;
      if (!empty) {
        editor.chain().focus().deleteRange({ from, to }).run();
      }

      await streamAiInstruction(
        { selection: selectionText, instruction, context },
        {
          onDelta: (text) => {
            editor.chain().insertContentAt(insertPos, text).run();
            insertPos += text.length;
          },
          onDone: () => setInstructBusy(false),
          onError: (message) => {
            setInstructError(message);
            setInstructBusy(false);
          },
        },
      );
    },
    [editor],
  );

  const handleMarginsChange = useCallback((patch: Partial<Margins>) => {
    setMargins((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleAddComment = useCallback(() => {
    if (!editor || !commentDraft.trim()) return;
    const { from, to, empty } = editor.state.selection;
    if (empty) return;
    const quote = editor.state.doc.textBetween(from, to, " ");
    const id = `c-${Date.now()}`;
    editor.chain().focus().setComment(id).run();
    setComments((prev) => [
      ...prev,
      { id, quote, body: commentDraft.trim(), author: "Tú", createdAt: new Date().toLocaleString("es-ES"), resolved: false },
    ]);
    setCommentDraft("");
  }, [editor, commentDraft]);

  const handleResolveComment = useCallback(
    (id: string) => {
      if (!editor) return;
      editor.chain().focus().unsetComment(id).run();
      setComments((prev) => prev.map((c) => (c.id === id ? { ...c, resolved: true } : c)));
    },
    [editor],
  );

  const handleFocusComment = useCallback(
    (id: string) => {
      if (!editor) return;
      let foundPos: number | null = null;
      editor.state.doc.descendants((node, pos) => {
        if (foundPos !== null) return false;
        if (!node.isText) return;
        if (node.marks.some((m) => m.type.name === "commentMark" && m.attrs.commentId === id)) {
          foundPos = pos;
        }
      });
      if (foundPos !== null) {
        editor.chain().focus().setTextSelection(foundPos).scrollIntoView().run();
      }
    },
    [editor],
  );

  const openComments = useCallback(() => setSidebarTab("comments"), []);
  const openReview = useCallback(() => setSidebarTab("review"), []);

  const pageContentHeightPx = PAGE_HEIGHT_PX - (margins.top + margins.bottom) * PX_PER_CM;

  return (
    <div className="app-shell">
      <MenuBar
        title={title}
        onTitleChange={setTitle}
        onNew={handleNew}
        onOpenFile={handleOpenFile}
        onSaveDocx={handleSaveDocx}
        onSavePdf={handleSavePdf}
        onSaveTxt={handleSaveTxt}
        busy={busy}
      />
      <Ribbon
        editor={editor}
        margins={margins}
        onMarginsChange={handleMarginsChange}
        trackChangesEnabled={trackChangesEnabled}
        onToggleTrackChanges={setTrackChangesEnabled}
        onOpenComments={openComments}
        onOpenReview={openReview}
        canAddComment={hasSelection}
      />

      <div className="workspace">
        <div className="page-scroll">
          <div className="page-column">
            <Ruler
              pageWidthPx={PAGE_WIDTH_PX}
              marginLeftCm={margins.left}
              marginRightCm={margins.right}
              onChange={(left, right) => handleMarginsChange({ left, right })}
            />
            <div
              className="page"
              style={{
                width: PAGE_WIDTH_PX,
                paddingTop: margins.top * PX_PER_CM,
                paddingRight: margins.right * PX_PER_CM,
                paddingBottom: margins.bottom * PX_PER_CM,
                paddingLeft: margins.left * PX_PER_CM,
              }}
            >
              <PageGuides editor={editor} pageContentHeightPx={pageContentHeightPx} marginTopPx={margins.top * PX_PER_CM} />
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>

        <aside className="ai-sidebar">
          <div className="sidebar-tabs">
            <button className={sidebarTab === "ai" ? "active" : ""} onClick={() => setSidebarTab("ai")}>
              IA
            </button>
            <button className={sidebarTab === "comments" ? "active" : ""} onClick={() => setSidebarTab("comments")}>
              Comentarios{comments.filter((c) => !c.resolved).length > 0 ? ` (${comments.filter((c) => !c.resolved).length})` : ""}
            </button>
            <button className={sidebarTab === "review" ? "active" : ""} onClick={() => setSidebarTab("review")}>
              Revisión{trackedChanges.length > 0 ? ` (${trackedChanges.length})` : ""}
            </button>
          </div>

          {sidebarTab === "ai" && (
            <AiSidebar
              aiEnabled={aiEnabled}
              suggestionsEnabled={suggestionsEnabled}
              onToggleSuggestions={setSuggestionsEnabled}
              suggestionStyle={suggestionStyle}
              onSuggestionStyleChange={setSuggestionStyle}
              onApplyInstruction={handleApplyInstruction}
              instructBusy={instructBusy}
              instructError={instructError}
              hasSelection={hasSelection}
            />
          )}

          {sidebarTab === "comments" && (
            <CommentsPanel
              comments={comments}
              canAddComment={hasSelection}
              draft={commentDraft}
              onDraftChange={setCommentDraft}
              onAddComment={handleAddComment}
              onResolve={handleResolveComment}
              onFocusComment={handleFocusComment}
            />
          )}

          {sidebarTab === "review" && (
            <ReviewPanel
              enabled={trackChangesEnabled}
              onToggle={setTrackChangesEnabled}
              changes={trackedChanges}
              onAcceptAll={() => editor?.chain().focus().acceptAllChanges().run()}
              onRejectAll={() => editor?.chain().focus().rejectAllChanges().run()}
              onAccept={(id) => editor?.chain().focus().acceptChange(id).run()}
              onReject={(id) => editor?.chain().focus().rejectChange(id).run()}
            />
          )}
        </aside>
      </div>

      <StatusBar words={counts.words} characters={counts.characters} aiEnabled={aiEnabled} />
    </div>
  );
}

export default App;
