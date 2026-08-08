export type ExportTarget = "pdf" | "docx";

/**
 * Prepara el HTML del editor para exportar a .docx/.pdf: quita el texto
 * marcado como "eliminado" pendiente de revisión (no debe aparecer en el
 * archivo final), desenvuelve los resaltados de inserciones/comentarios
 * (dejando el texto limpio como si los cambios ya estuvieran aceptados), y
 * transforma las notas al pie según el destino:
 *
 * - PDF: se convierten en `<span class="footnote">texto</span>`, que
 *   paged.js (usado en el servidor) extrae de verdad al pie de la página
 *   correspondiente, con numeración automática.
 * - DOCX: html-to-docx no soporta notas al pie reales, así que se
 *   convierten en una referencia numerada en el texto + una sección
 *   "Notas" al final del documento (equivalente a notas finales).
 */
export function sanitizeHtmlForExport(html: string, target: ExportTarget): string {
  const doc = new DOMParser().parseFromString(html, "text/html");

  doc.querySelectorAll('[data-change-type="delete"]').forEach((el) => el.remove());

  doc.querySelectorAll('[data-change-type="insert"], [data-comment-id]').forEach((el) => {
    el.replaceWith(...Array.from(el.childNodes));
  });

  const footnotes = Array.from(doc.querySelectorAll("[data-footnote-id]"));

  if (target === "pdf") {
    footnotes.forEach((el) => {
      const text = el.getAttribute("data-footnote-text") || "";
      const span = doc.createElement("span");
      span.className = "footnote";
      span.textContent = text;
      el.replaceWith(span);
    });
  } else {
    const notes: string[] = [];
    footnotes.forEach((el, i) => {
      const text = el.getAttribute("data-footnote-text") || "";
      notes.push(text);
      const sup = doc.createElement("sup");
      sup.textContent = String(i + 1);
      el.replaceWith(sup);
    });
    if (notes.length > 0) {
      const hr = doc.createElement("hr");
      doc.body.appendChild(hr);
      const heading = doc.createElement("p");
      heading.innerHTML = "<strong>Notas</strong>";
      doc.body.appendChild(heading);
      const list = doc.createElement("ol");
      notes.forEach((text) => {
        const li = doc.createElement("li");
        li.textContent = text;
        list.appendChild(li);
      });
      doc.body.appendChild(list);
    }
  }

  return doc.body.innerHTML;
}
