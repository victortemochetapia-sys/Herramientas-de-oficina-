import { useState } from "react";
import type { Editor } from "@tiptap/react";
import type { Margins } from "../App";

interface RibbonProps {
  editor: Editor | null;
  margins: Margins;
  onMarginsChange: (patch: Partial<Margins>) => void;
  trackChangesEnabled: boolean;
  onToggleTrackChanges: (enabled: boolean) => void;
  onOpenComments: () => void;
  onOpenReview: () => void;
  canAddComment: boolean;
  onOpenFind: () => void;
}

type Tab = "inicio" | "insertar" | "diseno" | "revisar";

const FONT_FAMILIES = [
  { label: "Por defecto", value: "" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Times New Roman", value: '"Times New Roman", serif' },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Courier New", value: '"Courier New", monospace' },
  { label: "Verdana", value: "Verdana, sans-serif" },
  { label: "Calibri", value: "Calibri, sans-serif" },
  { label: "Comic Sans MS", value: '"Comic Sans MS", cursive' },
];

const FONT_SIZES = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72];

const LINE_HEIGHTS = [
  { label: "Sencillo", value: "1" },
  { label: "1.15", value: "1.15" },
  { label: "1.5", value: "1.5" },
  { label: "Doble", value: "2" },
];

const HIGHLIGHT_COLORS = [
  { label: "Amarillo", value: "#fff3a3" },
  { label: "Verde", value: "#b9f6ca" },
  { label: "Rosa", value: "#f8bbd0" },
  { label: "Celeste", value: "#b3e5fc" },
  { label: "Naranja", value: "#ffd8a8" },
];

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`toolbar-btn${active ? " active" : ""}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}

export function Ribbon({
  editor,
  margins,
  onMarginsChange,
  trackChangesEnabled,
  onToggleTrackChanges,
  onOpenComments,
  onOpenReview,
  canAddComment,
  onOpenFind,
}: RibbonProps) {
  const [tab, setTab] = useState<Tab>("inicio");

  if (!editor) return null;

  const addLink = () => {
    const url = window.prompt("URL del enlace:");
    if (url) editor.chain().focus().setLink({ href: url }).run();
  };

  const addImageFromUrl = () => {
    const url = window.prompt("URL de la imagen:");
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };

  const addImageFromFile = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        editor.chain().focus().setImage({ src: reader.result as string }).run();
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const insertTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  return (
    <div className="ribbon">
      <div className="ribbon-tabs">
        {(["inicio", "insertar", "diseno", "revisar"] as Tab[]).map((t) => (
          <button key={t} className={`ribbon-tab${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
            {{ inicio: "Inicio", insertar: "Insertar", diseno: "Diseño", revisar: "Revisar" }[t]}
          </button>
        ))}
        <button className="ribbon-tab ribbon-find-btn" title="Buscar y reemplazar (Ctrl+F)" onClick={onOpenFind}>
          🔍 Buscar
        </button>
      </div>

      <div className="ribbon-panel">
        {tab === "inicio" && (
          <>
            <div className="toolbar-group">
              <select
                className="toolbar-select"
                onMouseDown={(e) => e.preventDefault()}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "p") editor.chain().focus().setParagraph().run();
                  else editor.chain().focus().toggleHeading({ level: Number(value) as 1 | 2 | 3 }).run();
                }}
                value={
                  editor.isActive("heading", { level: 1 })
                    ? "1"
                    : editor.isActive("heading", { level: 2 })
                      ? "2"
                      : editor.isActive("heading", { level: 3 })
                        ? "3"
                        : "p"
                }
              >
                <option value="p">Párrafo</option>
                <option value="1">Título 1</option>
                <option value="2">Título 2</option>
                <option value="3">Título 3</option>
              </select>

              <select
                className="toolbar-select"
                title="Fuente"
                onMouseDown={(e) => e.preventDefault()}
                onChange={(e) => {
                  const value = e.target.value;
                  if (!value) editor.chain().focus().unsetFontFamily().run();
                  else editor.chain().focus().setFontFamily(value).run();
                }}
                defaultValue=""
              >
                {FONT_FAMILIES.map((f) => (
                  <option key={f.label} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>

              <select
                className="toolbar-select toolbar-select-narrow"
                title="Tamaño de letra"
                onMouseDown={(e) => e.preventDefault()}
                onChange={(e) => {
                  const value = e.target.value;
                  if (!value) editor.chain().focus().unsetFontSize().run();
                  else editor.chain().focus().setFontSize(`${value}px`).run();
                }}
                defaultValue="16"
              >
                {FONT_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>

            <div className="toolbar-divider" />

            <div className="toolbar-group">
              <ToolbarButton title="Negrita (Ctrl+B)" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
                <b>N</b>
              </ToolbarButton>
              <ToolbarButton title="Cursiva (Ctrl+I)" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
                <i>K</i>
              </ToolbarButton>
              <ToolbarButton title="Subrayado (Ctrl+U)" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
                <u>S</u>
              </ToolbarButton>
              <ToolbarButton title="Tachado" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
                <s>T</s>
              </ToolbarButton>
              <div className="highlight-palette">
                <ToolbarButton title="Quitar resaltado" active={false} onClick={() => editor.chain().focus().unsetHighlight().run()}>
                  ✎
                </ToolbarButton>
                {HIGHLIGHT_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    title={`Resaltar en ${c.label}`}
                    className="highlight-swatch"
                    style={{ background: c.value }}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => editor.chain().focus().toggleHighlight({ color: c.value }).run()}
                  />
                ))}
              </div>
              <input
                type="color"
                title="Color de texto"
                className="toolbar-color"
                onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
              />
            </div>

            <div className="toolbar-divider" />

            <div className="toolbar-group">
              <ToolbarButton title="Superíndice" active={editor.isActive("superscript")} onClick={() => editor.chain().focus().toggleSuperscript().run()}>
                x²
              </ToolbarButton>
              <ToolbarButton title="Subíndice" active={editor.isActive("subscript")} onClick={() => editor.chain().focus().toggleSubscript().run()}>
                x₂
              </ToolbarButton>
              <ToolbarButton title="Borrar formato" onClick={() => editor.chain().focus().unsetAllMarks().run()}>
                ⌫✎
              </ToolbarButton>
              <select
                className="toolbar-select toolbar-select-narrow"
                title="Cambiar mayúsculas/minúsculas"
                onMouseDown={(e) => e.preventDefault()}
                onChange={(e) => {
                  const mode = e.target.value as "upper" | "lower" | "title";
                  if (mode) editor.chain().focus().transformCase(mode).run();
                  e.target.value = "";
                }}
                defaultValue=""
              >
                <option value="" disabled>
                  Aa
                </option>
                <option value="upper">MAYÚSCULAS</option>
                <option value="lower">minúsculas</option>
                <option value="title">Tipo Título</option>
              </select>
            </div>

            <div className="toolbar-divider" />

            <div className="toolbar-group">
              <ToolbarButton title="Alinear izquierda" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}>
                ⟵
              </ToolbarButton>
              <ToolbarButton title="Centrar" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}>
                ⟷
              </ToolbarButton>
              <ToolbarButton title="Alinear derecha" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}>
                ⟶
              </ToolbarButton>
              <ToolbarButton title="Justificar" active={editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()}>
                ☰
              </ToolbarButton>
            </div>

            <div className="toolbar-divider" />

            <div className="toolbar-group">
              <select
                className="toolbar-select"
                title="Interlineado"
                onMouseDown={(e) => e.preventDefault()}
                onChange={(e) => editor.chain().focus().setLineHeight(e.target.value).run()}
                defaultValue=""
              >
                <option value="" disabled>
                  Interlineado
                </option>
                {LINE_HEIGHTS.map((lh) => (
                  <option key={lh.value} value={lh.value}>
                    {lh.label}
                  </option>
                ))}
              </select>
              <ToolbarButton title="Disminuir sangría" onClick={() => editor.chain().focus().decreaseIndent().run()}>
                ⇤
              </ToolbarButton>
              <ToolbarButton title="Aumentar sangría" onClick={() => editor.chain().focus().increaseIndent().run()}>
                ⇥
              </ToolbarButton>
            </div>

            <div className="toolbar-divider" />

            <div className="toolbar-group">
              <ToolbarButton title="Lista con viñetas" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
                •≡
              </ToolbarButton>
              <ToolbarButton title="Lista numerada" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
                1≡
              </ToolbarButton>
              <ToolbarButton title="Cita" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
                "
              </ToolbarButton>
            </div>

            <div className="toolbar-divider" />

            <div className="toolbar-group">
              <ToolbarButton title="Deshacer (Ctrl+Z)" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
                ↶
              </ToolbarButton>
              <ToolbarButton title="Rehacer (Ctrl+Y)" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
                ↷
              </ToolbarButton>
            </div>
          </>
        )}

        {tab === "insertar" && (
          <div className="toolbar-group">
            <ToolbarButton title="Insertar enlace" active={editor.isActive("link")} onClick={addLink}>
              🔗 Enlace
            </ToolbarButton>
            <ToolbarButton title="Insertar imagen desde archivo" onClick={addImageFromFile}>
              🖼 Imagen (archivo)
            </ToolbarButton>
            <ToolbarButton title="Insertar imagen desde URL" onClick={addImageFromUrl}>
              🌐 Imagen (URL)
            </ToolbarButton>
            <ToolbarButton title="Insertar tabla" onClick={insertTable}>
              ⊞ Tabla
            </ToolbarButton>
            <ToolbarButton title="Insertar salto de página" onClick={() => editor.chain().focus().insertPageBreak().run()}>
              ⤓ Salto de página
            </ToolbarButton>
          </div>
        )}

        {tab === "diseno" && (
          <div className="margins-form">
            <label>
              Superior (cm)
              <input
                type="number"
                step="0.1"
                min="0.5"
                max="10"
                value={margins.top}
                onChange={(e) => onMarginsChange({ top: Number(e.target.value) })}
              />
            </label>
            <label>
              Inferior (cm)
              <input
                type="number"
                step="0.1"
                min="0.5"
                max="10"
                value={margins.bottom}
                onChange={(e) => onMarginsChange({ bottom: Number(e.target.value) })}
              />
            </label>
            <label>
              Izquierdo (cm)
              <input
                type="number"
                step="0.1"
                min="0.5"
                max="10"
                value={margins.left}
                onChange={(e) => onMarginsChange({ left: Number(e.target.value) })}
              />
            </label>
            <label>
              Derecho (cm)
              <input
                type="number"
                step="0.1"
                min="0.5"
                max="10"
                value={margins.right}
                onChange={(e) => onMarginsChange({ right: Number(e.target.value) })}
              />
            </label>
            <p className="ai-help">También puedes arrastrar los marcadores de la regla sobre la hoja.</p>
          </div>
        )}

        {tab === "revisar" && (
          <div className="toolbar-group">
            <ToolbarButton title="Comentar la selección" disabled={!canAddComment} onClick={onOpenComments}>
              💬 Nuevo comentario
            </ToolbarButton>
            <div className="toolbar-divider" />
            <label className="ai-toggle ribbon-toggle">
              <input type="checkbox" checked={trackChangesEnabled} onChange={(e) => onToggleTrackChanges(e.target.checked)} />
              Modo de revisión
            </label>
            <ToolbarButton title="Ver panel de cambios" onClick={onOpenReview}>
              📋 Ver cambios
            </ToolbarButton>
          </div>
        )}
      </div>
    </div>
  );
}
