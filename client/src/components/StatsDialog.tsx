interface StatsDialogProps {
  words: number;
  characters: number;
  charactersNoSpaces: number;
  paragraphs: number;
  estimatedPages: number;
  onClose: () => void;
}

const READING_WPM = 200;

export function StatsDialog({ words, characters, charactersNoSpaces, paragraphs, estimatedPages, onClose }: StatsDialogProps) {
  const readingMinutes = Math.max(1, Math.round(words / READING_WPM));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Estadísticas del documento</h2>
          <button type="button" className="find-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <table className="stats-table">
          <tbody>
            <tr>
              <td>Palabras</td>
              <td>{words}</td>
            </tr>
            <tr>
              <td>Caracteres (con espacios)</td>
              <td>{characters}</td>
            </tr>
            <tr>
              <td>Caracteres (sin espacios)</td>
              <td>{charactersNoSpaces}</td>
            </tr>
            <tr>
              <td>Párrafos</td>
              <td>{paragraphs}</td>
            </tr>
            <tr>
              <td>Páginas estimadas</td>
              <td>{estimatedPages}</td>
            </tr>
            <tr>
              <td>Tiempo de lectura estimado</td>
              <td>~{readingMinutes} min</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
