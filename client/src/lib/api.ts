const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

export async function fetchAiStatus(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/ai/status`);
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.enabled);
  } catch {
    return false;
  }
}

export async function fetchAiSuggestion(textBefore: string, instructions: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/ai/suggest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ textBefore, instructions }),
  });
  if (!res.ok) return "";
  const data = await res.json();
  return data.suggestion || "";
}

export interface InstructStreamHandlers {
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
}

export async function streamAiInstruction(
  params: { selection: string; instruction: string; context?: string },
  handlers: InstructStreamHandlers,
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/ai/instruct`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    handlers.onError(data.error || "Error al conectar con el servidor de IA.");
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split("\n\n");
    buffer = events.pop() || "";

    for (const rawEvent of events) {
      const lines = rawEvent.split("\n");
      let eventName = "message";
      let data = "";
      for (const line of lines) {
        if (line.startsWith("event:")) eventName = line.slice(6).trim();
        if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (!data) continue;
      const parsed = JSON.parse(data);
      if (eventName === "delta") handlers.onDelta(parsed.text);
      if (eventName === "error") handlers.onError(parsed.message);
      if (eventName === "done") handlers.onDone();
    }
  }
}

export async function importDocx(file: File): Promise<{ html: string; warnings: string[] }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/api/convert/import/docx`, { method: "POST", body: formData });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "No se pudo importar el documento.");
  }
  return res.json();
}

async function downloadBlob(res: Response, fallbackName: string) {
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "No se pudo generar el archivo.");
  }
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="(.+)"/);
  const filename = match?.[1] || fallbackName;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export interface PdfMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ExportOptions {
  margins?: PdfMargins;
  paperSize?: "a4" | "carta" | "legal";
  orientation?: "portrait" | "landscape";
  headerText?: string;
  footerText?: string;
  showPageNumber?: boolean;
}

export async function exportDocx(html: string, title: string, options?: ExportOptions): Promise<void> {
  const res = await fetch(`${API_BASE}/api/convert/export/docx`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html, title, ...options }),
  });
  await downloadBlob(res, `${title || "documento"}.docx`);
}

export async function exportPdf(html: string, title: string, options?: ExportOptions): Promise<void> {
  const res = await fetch(`${API_BASE}/api/convert/export/pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html, title, ...options }),
  });
  await downloadBlob(res, `${title || "documento"}.pdf`);
}
