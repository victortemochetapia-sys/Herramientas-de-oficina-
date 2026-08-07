import { useCallback, useEffect, useRef, useState } from "react";

const PAGE_WIDTH_CM = 21; // ancho A4
const MIN_MARGIN_CM = 0.5;
const MAX_TEXT_AREA_CM = PAGE_WIDTH_CM - MIN_MARGIN_CM * 2;

interface RulerProps {
  pageWidthPx: number;
  marginLeftCm: number;
  marginRightCm: number;
  onChange: (marginLeftCm: number, marginRightCm: number) => void;
}

export function Ruler({ pageWidthPx, marginLeftCm, marginRightCm, onChange }: RulerProps) {
  const rulerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<"left" | "right" | null>(null);
  const pxPerCm = pageWidthPx / PAGE_WIDTH_CM;

  const clamp = (cm: number) => Math.min(Math.max(cm, MIN_MARGIN_CM), MAX_TEXT_AREA_CM);

  const handleMove = useCallback(
    (clientX: number) => {
      const rect = rulerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cm = (clientX - rect.left) / pxPerCm;

      if (dragging === "left") {
        const newLeft = clamp(cm);
        if (newLeft + marginRightCm <= PAGE_WIDTH_CM - MIN_MARGIN_CM) onChange(newLeft, marginRightCm);
      } else if (dragging === "right") {
        const newRight = clamp(PAGE_WIDTH_CM - cm);
        if (newRight + marginLeftCm <= PAGE_WIDTH_CM - MIN_MARGIN_CM) onChange(marginLeftCm, newRight);
      }
    },
    [dragging, marginLeftCm, marginRightCm, onChange, pxPerCm],
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
  for (let cm = 0; cm <= PAGE_WIDTH_CM; cm++) {
    ticks.push(
      <div key={cm} className="ruler-tick" style={{ left: cm * pxPerCm }}>
        {cm > 0 && cm < PAGE_WIDTH_CM && <span>{cm}</span>}
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
