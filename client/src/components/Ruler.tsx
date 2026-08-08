import { useCallback, useEffect, useRef, useState } from "react";

const MIN_MARGIN_CM = 0.5;

interface RulerProps {
  pageWidthPx: number;
  pageWidthCm: number;
  marginLeftCm: number;
  marginRightCm: number;
  onChange: (marginLeftCm: number, marginRightCm: number) => void;
}

export function Ruler({ pageWidthPx, pageWidthCm, marginLeftCm, marginRightCm, onChange }: RulerProps) {
  const rulerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<"left" | "right" | null>(null);
  const pxPerCm = pageWidthPx / pageWidthCm;
  const maxTextAreaCm = pageWidthCm - MIN_MARGIN_CM * 2;

  const clamp = (cm: number) => Math.min(Math.max(cm, MIN_MARGIN_CM), maxTextAreaCm);

  const handleMove = useCallback(
    (clientX: number) => {
      const rect = rulerRef.current?.getBoundingClientRect();
      if (!rect) return;
      // Usa el ancho real renderizado (afectado por el zoom de la página)
      // en vez de pxPerCm de diseño, para que arrastrar funcione bien con
      // cualquier nivel de zoom.
      const renderedPxPerCm = rect.width / pageWidthCm;
      const cm = (clientX - rect.left) / renderedPxPerCm;

      if (dragging === "left") {
        const newLeft = clamp(cm);
        if (newLeft + marginRightCm <= pageWidthCm - MIN_MARGIN_CM) onChange(newLeft, marginRightCm);
      } else if (dragging === "right") {
        const newRight = clamp(pageWidthCm - cm);
        if (newRight + marginLeftCm <= pageWidthCm - MIN_MARGIN_CM) onChange(marginLeftCm, newRight);
      }
    },
    [dragging, marginLeftCm, marginRightCm, onChange, pxPerCm, pageWidthCm],
  );

  useEffect(() => {
    if (!dragging) return;
    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX);
    const onMouseUp = () => setDragging(null);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [dragging, handleMove]);

  const ticks = [];
  for (let cm = 0; cm <= Math.floor(pageWidthCm); cm++) {
    ticks.push(
      <div key={cm} className="ruler-tick" style={{ left: cm * pxPerCm }}>
        {cm > 0 && cm < pageWidthCm && <span>{cm}</span>}
      </div>,
    );
  }

  return (
    <div className="ruler" style={{ width: pageWidthPx }} ref={rulerRef}>
      <div className="ruler-ticks">{ticks}</div>
      <div className="ruler-text-area" style={{ left: marginLeftCm * pxPerCm, right: marginRightCm * pxPerCm }} />
      <div
        className="ruler-handle ruler-handle-left"
        style={{ left: marginLeftCm * pxPerCm }}
        title={`Margen izquierdo: ${marginLeftCm.toFixed(1)} cm`}
        onMouseDown={(e) => {
          e.preventDefault();
          setDragging("left");
        }}
      />
      <div
        className="ruler-handle ruler-handle-right"
        style={{ left: pageWidthPx - marginRightCm * pxPerCm }}
        title={`Margen derecho: ${marginRightCm.toFixed(1)} cm`}
        onMouseDown={(e) => {
          e.preventDefault();
          setDragging("right");
        }}
      />
    </div>
  );
}
