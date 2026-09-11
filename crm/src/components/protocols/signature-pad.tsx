"use client";

import { useRef, useState } from "react";
import { Eraser, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Minimal canvas signature pad — mouse + touch, no external dependency. */
export function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hasDrawing, setHasDrawing] = useState(false);

  function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    canvas.setPointerCapture(e.pointerId);
    const ctx = canvas.getContext("2d")!;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    drawingRef.current = true;
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const { x, y } = getPos(e);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1c1917";
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function onPointerUp() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    setHasDrawing(true);
    onChange(canvasRef.current!.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawing(false);
    onChange(null);
  }

  function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onChange(reader.result as string);
      setHasDrawing(true);
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d")!;
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex flex-col gap-2">
      <canvas
        ref={canvasRef}
        width={400}
        height={160}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="w-full touch-none rounded-lg border border-stone-300 bg-white"
        style={{ height: 160 }}
      />
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={clear} disabled={!hasDrawing}>
          <Eraser className="h-4 w-4" /> Xóa
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
          <Upload className="h-4 w-4" /> Tải chữ ký lên
        </Button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onUpload} />
      </div>
    </div>
  );
}
