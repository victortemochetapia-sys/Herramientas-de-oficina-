import { useRef, useState } from "react";

interface MenuBarProps {
  title: string;
  onTitleChange: (title: string) => void;
  onNew: () => void;
  onOpenFile: (file: File) => void;
  onSaveDocx: () => void;
  onSavePdf: () => void;
  onSaveTxt: () => void;
  busy: boolean;
}

export function MenuBar({ title, onTitleChange, onNew, onOpenFile, onSaveDocx, onSavePdf, onSaveTxt, busy }: MenuBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const closeAnd = (fn: () => void) => () => {
    setMenuOpen(false);
    fn();
  };

  return (
    <div className="menu-bar">
      <div className="menu-bar-brand">📝 Herramientas de Oficina — Writer</div>

      <div className="menu-dropdown">
        <button type="button" className="menu-btn" onClick={() => setMenuOpen((v) => !v)}>
          Archivo ▾
        </button>
        {menuOpen && (
          <>
            <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
            <div className="menu-list">
              <button onClick={closeAnd(onNew)}>🆕 Nuevo documento</button>
              <button onClick={closeAnd(() => fileInputRef.current?.click())}>📂 Abrir (.docx, .txt, .html)</button>
              <div className="menu-separator" />
              <button onClick={closeAnd(onSaveDocx)}>💾 Guardar como .docx</button>
              <button onClick={closeAnd(onSavePdf)}>📄 Guardar como .pdf</button>
              <button onClick={closeAnd(onSaveTxt)}>🧾 Guardar como .txt</button>
            </div>
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".docx,.txt,.html,.htm"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onOpenFile(file);
          e.target.value = "";
        }}
      />

      <input
        className="doc-title-input"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="Documento sin título"
      />

      {busy && <span className="menu-busy">Procesando…</span>}
    </div>
  );
}
