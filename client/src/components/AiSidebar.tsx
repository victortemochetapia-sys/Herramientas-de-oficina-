import { useState } from "react";

interface AiSidebarProps {
  aiEnabled: boolean;
  suggestionsEnabled: boolean;
  onToggleSuggestions: (enabled: boolean) => void;
  suggestionStyle: string;
  onSuggestionStyleChange: (value: string) => void;
  onApplyInstruction: (instruction: string) => Promise<void>;
  instructBusy: boolean;
  instructError: string | null;
  hasSelection: boolean;
}

const PRESETS = [
  "Hazlo más formal",
  "Hazlo más cercano y sencillo",
  "Resume en 3 puntos clave",
  "Corrige ortografía y gramática",
  "Amplía con más detalle",
  "Tradúcelo al inglés",
];

export function AiSidebar({
  aiEnabled,
  suggestionsEnabled,
  onToggleSuggestions,
  suggestionStyle,
  onSuggestionStyleChange,
  onApplyInstruction,
  instructBusy,
  instructError,
  hasSelection,
}: AiSidebarProps) {
  const [instruction, setInstruction] = useState("");

  const submit = async () => {
    if (!instruction.trim() || instructBusy) return;
    await onApplyInstruction(instruction.trim());
  };

  return (
    <div className="side-panel">
      <h2>Asistente de IA</h2>

      {!aiEnabled && (
        <div className="ai-warning">
          La IA no está configurada. Define <code>ANTHROPIC_API_KEY</code> en el servidor
          (<code>server/.env</code>) y reinícialo para activar sugerencias e instrucciones.
        </div>
      )}

      <section className="ai-section">
        <label className="ai-toggle">
          <input
            type="checkbox"
            checked={suggestionsEnabled}
            disabled={!aiEnabled}
            onChange={(e) => onToggleSuggestions(e.target.checked)}
          />
          Sugerencias mientras escribo
        </label>
        <p className="ai-help">
          La IA propondrá continuaciones en gris. Pulsa <kbd>Tab</kbd> para aceptarlas o{" "}
          <kbd>Esc</kbd> para descartarlas.
        </p>
        <input
          className="ai-style-input"
          placeholder="Estilo opcional (ej: tono formal, técnico...)"
          value={suggestionStyle}
          disabled={!aiEnabled || !suggestionsEnabled}
          onChange={(e) => onSuggestionStyleChange(e.target.value)}
        />
      </section>

      <section className="ai-section">
        <h3>Dar instrucciones</h3>
        <p className="ai-help">
          {hasSelection
            ? "Se aplicará al texto seleccionado."
            : "Sin selección: se insertará en el cursor."}
        </p>

        <div className="ai-presets">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className="ai-preset-btn"
              disabled={!aiEnabled || instructBusy}
              onClick={() => onApplyInstruction(preset)}
            >
              {preset}
            </button>
          ))}
        </div>

        <textarea
          className="ai-instruction-input"
          placeholder="Escribe una instrucción, ej: 'redacta un párrafo de cierre agradeciendo al lector'"
          value={instruction}
          disabled={!aiEnabled}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
          rows={4}
        />
        <button type="button" className="ai-apply-btn" disabled={!aiEnabled || instructBusy || !instruction.trim()} onClick={submit}>
          {instructBusy ? "Redactando…" : "Aplicar (Ctrl+Enter)"}
        </button>

        {instructError && <div className="ai-error">{instructError}</div>}
      </section>
    </div>
  );
}
