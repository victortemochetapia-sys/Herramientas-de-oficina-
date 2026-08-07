import type { DocComment } from "../types";

interface CommentsPanelProps {
  comments: DocComment[];
  canAddComment: boolean;
  draft: string;
  onDraftChange: (value: string) => void;
  onAddComment: () => void;
  onResolve: (id: string) => void;
  onFocusComment: (id: string) => void;
}

export function CommentsPanel({
  comments,
  canAddComment,
  draft,
  onDraftChange,
  onAddComment,
  onResolve,
  onFocusComment,
}: CommentsPanelProps) {
  const active = comments.filter((c) => !c.resolved);
  const resolved = comments.filter((c) => c.resolved);

  return (
    <div className="side-panel">
      <h2>Comentarios</h2>

      <section className="ai-section">
        <p className="ai-help">
          {canAddComment ? "Escribe tu comentario sobre el texto seleccionado." : "Selecciona texto en el documento para comentarlo."}
        </p>
        <textarea
          className="ai-instruction-input"
          rows={3}
          placeholder="Escribe un comentario…"
          value={draft}
          disabled={!canAddComment}
          onChange={(e) => onDraftChange(e.target.value)}
        />
        <button type="button" className="ai-apply-btn" disabled={!canAddComment || !draft.trim()} onClick={onAddComment}>
          Añadir comentario
        </button>
      </section>

      <section className="ai-section">
        <h3>Activos ({active.length})</h3>
        {active.length === 0 && <p className="ai-help">Sin comentarios pendientes.</p>}
        {active.map((c) => (
          <div key={c.id} className="comment-card" onClick={() => onFocusComment(c.id)}>
            <div className="comment-quote">“{c.quote}”</div>
            <div className="comment-body">{c.body}</div>
            <div className="comment-meta">
              <span>{c.author} · {c.createdAt}</span>
              <button
                type="button"
                className="comment-resolve-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onResolve(c.id);
                }}
              >
                Resolver
              </button>
            </div>
          </div>
        ))}
      </section>

      {resolved.length > 0 && (
        <section className="ai-section">
          <h3>Resueltos ({resolved.length})</h3>
          {resolved.map((c) => (
            <div key={c.id} className="comment-card resolved">
              <div className="comment-quote">“{c.quote}”</div>
              <div className="comment-body">{c.body}</div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
