/**
 * Prepara el HTML del editor para exportar a .docx/.pdf: quita el texto
 * marcado como "eliminado" pendiente de revisión (no debe aparecer en el
 * archivo final) y desenvuelve los resaltados de inserciones/comentarios,
 * dejando el texto limpio como si los cambios ya estuvieran aceptados.
 */
export function sanitizeHtmlForExport(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");

  doc.querySelectorAll('[data-change-type="delete"]').forEach((el) => el.remove());

  doc.querySelectorAll('[data-change-type="insert"], [data-comment-id]').forEach((el) => {
    el.replaceWith(...Array.from(el.childNodes));
  });

  return doc.body.innerHTML;
}
