import { useCallback, useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Image from "@tiptap/extension-image";
import { TextStyle, FontSize, LineHeight } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import FontFamily from "@tiptap/extension-font-family";
import Superscript from "@tiptap/extension-superscript";
import Subscript from "@tiptap/extension-subscript";

import { Ribbon } from "./components/Ribbon";
import { MenuBar } from "./components/MenuBar";
import { StatusBar } from "./components/StatusBar";
import { AiSidebar } from "./components/AiSidebar";
import { CommentsPanel } from "./components/CommentsPanel";
import { ReviewPanel } from "./components/ReviewPanel";
import { OutlinePanel } from "./components/OutlinePanel";
import { StatsDialog } from "./components/StatsDialog";
import { Ruler } from "./components/Ruler";
import { PageGuides } from "./components/PageGuides";
import { FindReplacePanel } from "./components/FindReplacePanel";
import { AiGhostSuggestion } from "./extensions/AiGhostSuggestion";
import { CommentMark } from "./extensions/CommentMark";
import { Indent } from "./extensions/Indent";
import { TextCase } from "./extensions/TextCase";
import { PageBreak } from "./extensions/PageBreak";
import { TocBlock } from "./extensions/TocBlock";
import { FindReplace, computeMatches, type FindMatch } from "./extensions/FindReplace";
import { TrackChanges, TrackDeleteMark, TrackInsertMark, getTrackedChanges, type TrackedChangeSummary } from "./extensions/TrackChanges";
import { getOutline, insertOrUpdateToc } from "./lib/outline";
import { exportDocx, exportPdf, fetchAiStatus, fetchAiSuggestion, importDocx, streamAiInstruction, type ExportOptions } from "./lib/api";
import { sanitizeHtmlForExport } from "./lib/sanitizeExport";
import type { DocComment } from "./types";

import "./index.css";
import "./editor.css";

const SUGGESTION_DEBOUNCE_MS = 900;
const AUTOSAVE_KEY = "herramientas-oficina-autosave-v1";

export const PX_PER_CM = 37.7953; // 96dpi

export type PaperSizeId = "a4" | "carta" | "legal";
export const PAPER_SIZES: Record<PaperSizeId, { label: string; width: number; height: number }> = {
  a4: { label: "A4", width: 21, height: 29.7 },
  carta: { label: "Carta", width: 21.59, height: 27.94 },
  legal: { label: "Legal", width: 21.59, height: 35.56 },
};

export type Orientation = "portrait" | "landscape";

export interface Margins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const DEFAULT_MARGINS: Margins = { top: 2.5, right: 2.5, bottom: 2.5, left: 2.5 };

type SidebarTab = "ai" | "comments" | "review" | "outline";

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
  const [findOpen, setFindOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [replaceTerm, setReplaceTerm] = useState("");
  const [findMatches, setFindMatchesState] = useState<FindMatch[]>([]);
  const [activeMatchIndex, setActiveMatchIndex] = useState(-1);
  const [paperSize, setPaperSize] = useState<PaperSizeId>("a4");
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [zoom, setZoom] = useState(100);
  const [headerText, setHeaderText] = useState("");
  const [footerText, setFooterText] = useState("");
  const [showPageNumber, setShowPageNumber] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [restoredBanner, setRestoredBanner] = useState(false);

  const suggestionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionRequestId = useRef(0);

  const paper = PAPER_SIZES[paperSize];
  const pageWidthCm = orientation === "portrait" ? paper.width : paper.height;
  const pageHeightCm = orientation === "portrait" ? paper.height : paper.width;
  const pageWidthPx = pageWidthCm * PX_PER_CM;
  const pageHeightPx = pageHeightCm * PX_PER_CM;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      TextStyle,
      Highlight.configure({ multicolor: true }),
      Color,
      FontFamily,
      FontSize,
      Superscript,
      Subscript,
      TextCase,
      LineHeight,
      Indent,
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
      FindReplace,
      PageBreak,
      TocBlock,
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

  // Panel de navegación: lista de títulos actualizada con el documento.
  const [outline, setOutline] = useState<ReturnType<typeof getOutline>>([]);
  useEffect(() => {
    if (!editor) return;
    const update = () => setOutline(getOutline(editor));
    update();
    editor.on("update", update);
    return () => {
      editor.off("update", update);
    };
  }, [editor]);

  const openOutline = useCallback(() => setSidebarTab("outline"), []);

  const handleJumpToHeading = useCallback(
    (pos: number) => {
      editor?.chain().focus().setTextSelection(pos).scrollIntoView().run();
    },
    [editor],
  );

  const handleInsertToc = useCallback(() => {
    if (!editor) return;
    const ok = insertOrUpdateToc(editor);
    if (!ok) alert("Agrega títulos (Título 1/2/3) a tu documento para generar la tabla de contenido.");
  }, [editor]);

  // Buscar y reemplazar: recalcula las coincidencias cuando cambia el
  // término de búsqueda o el contenido del documento.
  const recomputeMatches = useCallback(
    (term: string, keepIndex?: number) => {
      if (!editor) return;
      const matches = computeMatches(editor.state.doc, term);
      const nextIndex = matches.length === 0 ? -1 : Math.min(Math.max(keepIndex ?? 0, 0), matches.length - 1);
      setFindMatchesState(matches);
      setActiveMatchIndex(nextIndex);
      editor.commands.setFindMatches(matches, nextIndex);
    },
    [editor],
  );

  useEffect(() => {
    if (!editor || !findOpen) return;
    recomputeMatches(searchTerm, 0);
  }, [editor, findOpen, searchTerm, recomputeMatches]);

  useEffect(() => {
    if (!editor || !findOpen) return;
    const handler = () => recomputeMatches(searchTerm, activeMatchIndex);
    editor.on("update", handler);
    return () => {
      editor.off("update", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, findOpen, searchTerm]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setFindOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const goToMatch = useCallback(
    (index: number) => {
      if (!editor || findMatches.length === 0) return;
      const clamped = ((index % findMatches.length) + findMatches.length) % findMatches.length;
      const match = findMatches[clamped];
      setActiveMatchIndex(clamped);
      editor.commands.setFindMatches(findMatches, clamped);
      editor.chain().setTextSelection({ from: match.from, to: match.to }).scrollIntoView().run();
    },
    [editor, findMatches],
  );

  const handleFindNext = useCallback(() => goToMatch(activeMatchIndex + 1), [goToMatch, activeMatchIndex]);
  const handleFindPrev = useCallback(() => goToMatch(activeMatchIndex - 1), [goToMatch, activeMatchIndex]);

  const handleReplace = useCallback(() => {
    if (!editor || activeMatchIndex < 0 || !findMatches[activeMatchIndex]) return;
    const match = findMatches[activeMatchIndex];
    editor.chain().focus().insertContentAt({ from: match.from, to: match.to }, replaceTerm).run();
    recomputeMatches(searchTerm, activeMatchIndex);
  }, [editor, activeMatchIndex, findMatches, replaceTerm, recomputeMatches, searchTerm]);

  const handleReplaceAll = useCallback(() => {
    if (!editor || !searchTerm || findMatches.length === 0) return;
    const tr = editor.state.tr;
    [...findMatches].sort((a, b) => b.from - a.from).forEach((m) => tr.insertText(replaceTerm, m.from, m.to));
    editor.view.dispatch(tr);
    recomputeMatches(searchTerm, 0);
  }, [editor, searchTerm, findMatches, replaceTerm, recomputeMatches]);

  const closeFind = useCallback(() => {
    setFindOpen(false);
    setFindMatchesState([]);
    setActiveMatchIndex(-1);
    editor?.commands.setFindMatches([], -1);
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

  // Autoguardado local: guarda el documento en el navegador para no perder
  // el trabajo si se cierra la pestaña, y lo restaura al volver a abrir.
  const restoredOnce = useRef(false);
  useEffect(() => {
    if (!editor || restoredOnce.current) return;
    restoredOnce.current = true;
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      if (!raw) return;
      const snap = JSON.parse(raw);
      if (!snap.html) return;
      editor.commands.setContent(snap.html);
      if (snap.title) setTitle(snap.title);
      if (snap.margins) setMargins(snap.margins);
      if (Array.isArray(snap.comments)) setComments(snap.comments);
      if (snap.paperSize) setPaperSize(snap.paperSize);
      if (snap.orientation) setOrientation(snap.orientation);
      if (typeof snap.headerText === "string") setHeaderText(snap.headerText);
      if (typeof snap.footerText === "string") setFooterText(snap.footerText);
      if (typeof snap.showPageNumber === "boolean") setShowPageNumber(snap.showPageNumber);
      setRestoredBanner(true);
    } catch {
      // Autoguardado corrupto o inaccesible: se ignora silenciosamente.
    }
  }, [editor]);

  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleAutosave = useCallback(() => {
    if (!editor) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      try {
        const snapshot = {
          title,
          html: editor.getHTML(),
          margins,
          comments,
          paperSize,
          orientation,
          headerText,
          footerText,
          showPageNumber,
          savedAt: Date.now(),
        };
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(snapshot));
      } catch {
        // Almacenamiento local lleno o no disponible: se ignora.
      }
    }, 1000);
  }, [editor, title, margins, comments, paperSize, orientation, headerText, footerText, showPageNumber]);

  useEffect(() => {
    if (!editor) return;
    editor.on("update", scheduleAutosave);
    return () => {
      editor.off("update", scheduleAutosave);
    };
  }, [editor, scheduleAutosave]);

  useEffect(() => {
    scheduleAutosave();
  }, [scheduleAutosave]);

  const handleNew = useCallback(() => {
    if (!editor) return;
    if (!window.confirm("¿Crear un nuevo documento? Se perderá el contenido no guardado.")) return;
    editor.commands.setContent("<p></p>");
    setTitle("Documento sin título");
    setComments([]);
    localStorage.removeItem(AUTOSAVE_KEY);
    setRestoredBanner(false);
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

  const exportOptions = useCallback(
    (): ExportOptions => ({
      margins,
      paperSize,
      orientation,
      headerText,
      footerText,
      showPageNumber,
    }),
    [margins, paperSize, orientation, headerText, footerText, showPageNumber],
  );

  const handleSaveDocx = useCallback(async () => {
    if (!editor) return;
    setBusy(true);
    try {
      await exportDocx(sanitizeHtmlForExport(editor.getHTML()), title, exportOptions());
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo guardar el .docx.");
    } finally {
      setBusy(false);
    }
  }, [editor, title, exportOptions]);

  const handleSavePdf = useCallback(async () => {
    if (!editor) return;
    setBusy(true);
    try {
      await exportPdf(sanitizeHtmlForExport(editor.getHTML()), title, exportOptions());
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo guardar el .pdf.");
    } finally {
      setBusy(false);
    }
  }, [editor, title, exportOptions]);

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

  const pageContentHeightPx = pageHeightPx - (margins.top + margins.bottom) * PX_PER_CM;

  const text = editor?.getText() ?? "";
  const paragraphCount = editor ? editor.state.doc.content.childCount : 0;
  const charactersNoSpaces = text.replace(/\s/g, "").length;
  const estimatedPages = Math.max(1, Math.ceil(counts.characters / 1800));

  return (
    <div className={`app-shell${darkMode ? " theme-dark" : ""}`}>
      {restoredBanner && (
        <div className="restored-banner">
          <span>Recuperamos tu último documento (autoguardado).</span>
          <button type="button" onClick={() => setRestoredBanner(false)}>
            ✕
          </button>
        </div>
      )}
      <MenuBar
        title={title}
        onTitleChange={setTitle}
        onNew={handleNew}
        onOpenFile={handleOpenFile}
        onSaveDocx={handleSaveDocx}
        onSavePdf={handleSavePdf}
        onSaveTxt={handleSaveTxt}
        busy={busy}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((v) => !v)}
      />
      <Ribbon
        editor={editor}
        margins={margins}
        onMarginsChange={handleMarginsChange}
        trackChangesEnabled={trackChangesEnabled}
        onToggleTrackChanges={setTrackChangesEnabled}
        onOpenComments={openComments}
        onOpenReview={openReview}
        onOpenOutline={openOutline}
        canAddComment={hasSelection}
        onOpenFind={() => setFindOpen(true)}
        paperSize={paperSize}
        onPaperSizeChange={setPaperSize}
        orientation={orientation}
        onOrientationChange={setOrientation}
        zoom={zoom}
        onZoomChange={setZoom}
        headerText={headerText}
        onHeaderTextChange={setHeaderText}
        footerText={footerText}
        onFooterTextChange={setFooterText}
        showPageNumber={showPageNumber}
        onShowPageNumberChange={setShowPageNumber}
      />

      <div className="workspace">
        <div className="page-scroll">
          {findOpen && (
            <FindReplacePanel
              searchTerm={searchTerm}
              onSearchTermChange={setSearchTerm}
              replaceTerm={replaceTerm}
              onReplaceTermChange={setReplaceTerm}
              matchCount={findMatches.length}
              activeIndex={activeMatchIndex}
              onNext={handleFindNext}
              onPrev={handleFindPrev}
              onReplace={handleReplace}
              onReplaceAll={handleReplaceAll}
              onClose={closeFind}
            />
          )}
          <div className="page-column" style={{ zoom: `${zoom}%` }}>
            <Ruler
              pageWidthPx={pageWidthPx}
              pageWidthCm={pageWidthCm}
              marginLeftCm={margins.left}
              marginRightCm={margins.right}
              onChange={(left, right) => handleMarginsChange({ left, right })}
            />
            <div
              className="page"
              style={{
                width: pageWidthPx,
                minHeight: pageHeightPx,
                paddingTop: margins.top * PX_PER_CM,
                paddingRight: margins.right * PX_PER_CM,
                paddingBottom: margins.bottom * PX_PER_CM,
                paddingLeft: margins.left * PX_PER_CM,
              }}
            >
              <PageGuides editor={editor} pageContentHeightPx={pageContentHeightPx} marginTopPx={margins.top * PX_PER_CM} zoom={zoom} />
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
            <button className={sidebarTab === "outline" ? "active" : ""} onClick={() => setSidebarTab("outline")}>
              Esquema
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

          {sidebarTab === "outline" && <OutlinePanel headings={outline} onJump={handleJumpToHeading} onInsertToc={handleInsertToc} />}
        </aside>
      </div>

      <StatusBar words={counts.words} characters={counts.characters} aiEnabled={aiEnabled} onOpenStats={() => setStatsOpen(true)} />

      {statsOpen && (
        <StatsDialog
          words={counts.words}
          characters={counts.characters}
          charactersNoSpaces={charactersNoSpaces}
          paragraphs={paragraphCount}
          estimatedPages={estimatedPages}
          onClose={() => setStatsOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
