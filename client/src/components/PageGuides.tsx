import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";

interface PageGuidesProps {
  editor: Editor | null;
  pageContentHeightPx: number;
  marginTopPx: number;
  zoom?: number;
}

/**
 * Líneas guía que marcan dónde caerá cada salto de página al exportar a PDF
 * (aproximación visual: el contenido sigue siendo un único flujo editable,
 * no páginas físicamente separadas).
 */
export function PageGuides({ editor, pageContentHeightPx, marginTopPx, zoom = 100 }: PageGuidesProps) {
  const [guides, setGuides] = useState<number[]>([]);

  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom as HTMLElement;

    const recompute = () => {
      // `scrollHeight` viene afectado por el zoom CSS de la página; se
      // normaliza para comparar contra la altura de página sin escalar.
      const height = dom.scrollHeight / (zoom / 100);
      const count = Math.max(0, Math.floor(height / pageContentHeightPx));
      const next: number[] = [];
      for (let i = 1; i <= count; i++) next.push(i * pageContentHeightPx);
      setGuides(next);
    };

    recompute();
    const observer = new ResizeObserver(recompute);
    observer.observe(dom);
    editor.on("update", recompute);

    return () => {
      observer.disconnect();
      editor.off("update", recompute);
    };
  }, [editor, pageContentHeightPx, zoom]);

  return (
    <>
      {guides.map((offset, i) => (
        <div key={offset} className="page-break-guide" style={{ top: marginTopPx + offset }}>
          <span>Fin de página {i + 1}</span>
        </div>
      ))}
    </>
  );
}
