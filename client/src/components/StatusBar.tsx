interface StatusBarProps {
  words: number;
  characters: number;
  aiEnabled: boolean;
  onOpenStats: () => void;
}

export function StatusBar({ words, characters, aiEnabled, onOpenStats }: StatusBarProps) {
  return (
    <div className="status-bar">
      <button type="button" className="status-stats-btn" onClick={onOpenStats} title="Ver estadísticas del documento">
        {words} palabras · {characters} caracteres
      </button>
      <span className={`ai-status ${aiEnabled ? "on" : "off"}`}>
        {aiEnabled ? "● IA conectada" : "○ IA no configurada"}
      </span>
    </div>
  );
}
