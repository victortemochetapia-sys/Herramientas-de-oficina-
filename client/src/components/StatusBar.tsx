interface StatusBarProps {
  words: number;
  characters: number;
  aiEnabled: boolean;
}

export function StatusBar({ words, characters, aiEnabled }: StatusBarProps) {
  return (
    <div className="status-bar">
      <span>{words} palabras</span>
      <span>{characters} caracteres</span>
      <span className={`ai-status ${aiEnabled ? "on" : "off"}`}>
        {aiEnabled ? "● IA conectada" : "○ IA no configurada"}
      </span>
    </div>
  );
}
