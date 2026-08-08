import { useEffect, useRef, useState } from "react";

interface FootnotePopupProps {
  initialText: string;
  x: number;
  y: number;
  onSave: (text: string) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function FootnotePopup({ initialText, x, y, onSave, onDelete, onClose }: FootnotePopupProps) {
  const [text, setText] = useState(initialText);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onSave(text);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <div className="footnote-popup" style={{ left: x, top: y }} ref={ref}>
      <textarea
        autoFocus
        rows={3}
        placeholder="Escribe el texto de la nota al pie…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            onSave(text);
            onClose();
          }
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            onSave(text);
            onClose();
          }
        }}
      />
      <div className="footnote-popup-actions">
        <button type="button" className="comment-resolve-btn" onClick={() => onSave(text)}>
          Guardar
        </button>
        <button type="button" className="footnote-delete-btn" onClick={onDelete}>
          Eliminar nota
        </button>
      </div>
    </div>
  );
}
