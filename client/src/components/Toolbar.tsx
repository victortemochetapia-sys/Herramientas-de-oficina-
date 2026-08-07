import type { Editor } from "@tiptap/react";

interface ToolbarProps {
  editor: Editor | null;
}

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

export function Toolbar({ editor }: ToolbarProps) {
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
    <div className="toolbar">
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
        <ToolbarButton title="Resaltado" active={editor.isActive("highlight")} onClick={() => editor.chain().focus().toggleHighlight().run()}>
          ✎
        </ToolbarButton>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <input
          type="color"
          title="Color de texto"
          className="toolbar-color"
          onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
        />
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
        <ToolbarButton title="Insertar enlace" active={editor.isActive("link")} onClick={addLink}>
          🔗
        </ToolbarButton>
        <ToolbarButton title="Insertar imagen desde archivo" onClick={addImageFromFile}>
          🖼
        </ToolbarButton>
        <ToolbarButton title="Insertar imagen desde URL" onClick={addImageFromUrl}>
          🌐
        </ToolbarButton>
        <ToolbarButton title="Insertar tabla" onClick={insertTable}>
          ⊞
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
    </div>
  );
}
