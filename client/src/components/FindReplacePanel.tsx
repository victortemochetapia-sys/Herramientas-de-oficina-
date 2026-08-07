interface FindReplacePanelProps {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  replaceTerm: string;
  onReplaceTermChange: (value: string) => void;
  matchCount: number;
  activeIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onReplace: () => void;
  onReplaceAll: () => void;
  onClose: () => void;
}

export function FindReplacePanel({
  searchTerm,
  onSearchTermChange,
  replaceTerm,
  onReplaceTermChange,
  matchCount,
  activeIndex,
  onNext,
  onPrev,
  onReplace,
  onReplaceAll,
  onClose,
}: FindReplacePanelProps) {
  return (
    <div className="find-panel">
      <div className="find-row">
        <input
          autoFocus
          className="find-input"
          placeholder="Buscar…"
          value={searchTerm}
          onChange={(e) => onSearchTermChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.shiftKey ? onPrev : onNext)();
            if (e.key === "Escape") onClose();
          }}
        />
        <span className="find-count">{matchCount > 0 ? `${activeIndex + 1} de ${matchCount}` : searchTerm ? "Sin resultados" : ""}</span>
        <button type="button" onClick={onPrev} disabled={matchCount === 0} title="Anterior">
          ↑
        </button>
        <button type="button" onClick={onNext} disabled={matchCount === 0} title="Siguiente">
          ↓
        </button>
        <button type="button" onClick={onClose} title="Cerrar" className="find-close">
          ✕
        </button>
      </div>
      <div className="find-row">
        <input
          className="find-input"
          placeholder="Reemplazar por…"
          value={replaceTerm}
          onChange={(e) => onReplaceTermChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onReplace();
          }}
        />
        <button type="button" onClick={onReplace} disabled={matchCount === 0}>
          Reemplazar
        </button>
        <button type="button" onClick={onReplaceAll} disabled={matchCount === 0}>
          Reemplazar todo
        </button>
      </div>
    </div>
  );
}
