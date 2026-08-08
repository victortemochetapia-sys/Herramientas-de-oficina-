import type { OutlineHeading } from "../lib/outline";

interface OutlinePanelProps {
  headings: OutlineHeading[];
  onJump: (pos: number) => void;
  onInsertToc: () => void;
}

export function OutlinePanel({ headings, onJump, onInsertToc }: OutlinePanelProps) {
  return (
    <div className="side-panel">
      <h2>Panel de navegación</h2>

      <section className="ai-section">
        <p className="ai-help">Haz clic en un título para saltar a esa sección.</p>
        {headings.length === 0 && <p className="ai-help">Aún no hay títulos (Título 1/2/3) en el documento.</p>}
        <div className="outline-list">
          {headings.map((h, i) => (
            <button
              key={`${h.pos}-${i}`}
              type="button"
              className={`outline-item outline-level-${h.level}`}
              onClick={() => onJump(h.pos)}
            >
              {h.text}
            </button>
          ))}
        </div>
      </section>

      <section className="ai-section">
        <h3>Tabla de contenido</h3>
        <p className="ai-help">Inserta un índice con los títulos actuales, o vuelve a pulsar para actualizarlo.</p>
        <button type="button" className="ai-apply-btn" disabled={headings.length === 0} onClick={onInsertToc}>
          📑 Insertar / actualizar tabla de contenido
        </button>
      </section>
    </div>
  );
}
