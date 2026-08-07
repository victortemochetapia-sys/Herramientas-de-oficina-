import type { TrackedChangeSummary } from "../extensions/TrackChanges";

interface ReviewPanelProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  changes: TrackedChangeSummary[];
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}

export function ReviewPanel({ enabled, onToggle, changes, onAcceptAll, onRejectAll, onAccept, onReject }: ReviewPanelProps) {
  return (
    <div className="side-panel">
      <h2>Control de cambios</h2>

      <section className="ai-section">
        <label className="ai-toggle">
          <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} />
          Modo de revisión
        </label>
        <p className="ai-help">
          Con el modo activo, lo que escribas queda subrayado (inserción) y lo que borres queda tachado
          (eliminación) en vez de desaparecer, hasta que se acepte o rechace. <em>Función en beta</em>: cubre
          escribir, seleccionar y borrar con Retroceso/Supr; casos poco comunes (pegar sobre texto ya marcado,
          deshacer/rehacer) pueden comportarse de forma imperfecta.
        </p>
      </section>

      <section className="ai-section">
        <h3>Cambios ({changes.length})</h3>
        <div className="review-bulk-actions">
          <button type="button" className="ai-preset-btn" disabled={changes.length === 0} onClick={onAcceptAll}>
            ✔ Aceptar todos
          </button>
          <button type="button" className="ai-preset-btn" disabled={changes.length === 0} onClick={onRejectAll}>
            ✕ Rechazar todos
          </button>
        </div>

        {changes.length === 0 && <p className="ai-help">No hay cambios pendientes.</p>}

        {changes.map((c) => (
          <div key={c.id} className={`change-card ${c.type}`}>
            <div className="change-type">{c.type === "insert" ? "➕ Inserción" : "➖ Eliminación"}</div>
            <div className="change-text">{c.text || "(vacío)"}</div>
            <div className="comment-meta">
              <span>{c.author} · {c.date}</span>
              <div className="change-actions">
                <button type="button" onClick={() => onAccept(c.id)}>
                  Aceptar
                </button>
                <button type="button" onClick={() => onReject(c.id)}>
                  Rechazar
                </button>
              </div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
