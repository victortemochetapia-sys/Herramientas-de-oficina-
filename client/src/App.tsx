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

import { Toolbar } from "./components/Toolbar";
import { MenuBar } from "./components/MenuBar";
import { StatusBar } from "./components/StatusBar";
import { AiSidebar } from "./components/AiSidebar";
import { AiGhostSuggestion } from "./extensions/AiGhostSuggestion";
import { exportDocx, exportPdf, fetchAiStatus, fetchAiSuggestion, importDocx, streamAiInstruction } from "./lib/api";

import "./index.css";
import "./editor.css";

const SUGGESTION_DEBOUNCE_MS = 900;

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

  const suggestionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionRequestId = useRef(0);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      TextStyle,
      Color,
      Highlight,
      Image,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder: "Empieza a escribir tu documento…" }),
      AiGhostSuggestion,
    ],
    content: "<p></p>",
    autofocus: true,
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
      await exportDocx(editor.getHTML(), title);
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
      await exportPdf(editor.getHTML(), title);
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo guardar el .pdf.");
    } finally {
      setBusy(false);
    }
  }, [editor, title]);

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
      <Toolbar editor={editor} />

      <div className="workspace">
        <div className="page-scroll">
          <div className="page">
            <EditorContent editor={editor} />
          </div>
        </div>

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
      </div>

      <StatusBar words={counts.words} characters={counts.characters} aiEnabled={aiEnabled} />
    </div>
  );
}

export default App;
