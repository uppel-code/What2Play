"use client";

import { useEffect, useRef } from "react";

export interface BarData {
  label: string;
  value: number;
  color?: string;
}

const DEFAULT_COLOR = "#2D7A4F";

export default function BarChart({
  bars,
  height = 160,
  className = "",
}: {
  bars: BarData[];
  height?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = container.clientWidth;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const maxValue = Math.max(...bars.map((b) => b.value), 1);
    const barPadding = 8;
    const labelHeight = 24;
    const topPadding = 20;
    const chartHeight = height - labelHeight - topPadding;
    const barWidth = Math.min(
      (width - barPadding * (bars.length + 1)) / bars.length,
      60,
    );
    const totalBarsWidth = bars.length * barWidth + (bars.length + 1) * barPadding;
    const offsetX = (width - totalBarsWidth) / 2;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Detect dark mode
    const isDark = document.documentElement.classList.contains("dark");
    const textColor = isDark ? "#A8A29E" : "#78716C";
    const valueColor = isDark ? "#D6D3D1" : "#44403C";

    for (let i = 0; i < bars.length; i++) {
      const bar = bars[i];
      const x = offsetX + barPadding + i * (barWidth + barPadding);
      const barH = (bar.value / maxValue) * chartHeight;
      const y = topPadding + chartHeight - barH;

      // Bar
      ctx.fillStyle = bar.color || DEFAULT_COLOR;
      const radius = Math.min(6, barWidth / 4);
      roundedRect(ctx, x, y, barWidth, barH, radius);
      ctx.fill();

      // Value above bar
      ctx.fillStyle = valueColor;
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(bar.value), x + barWidth / 2, y - 4);

      // Label below
      ctx.fillStyle = textColor;
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "center";
      const maxLabelWidth = barWidth + barPadding - 2;
      const truncated = truncateText(ctx, bar.label, maxLabelWidth);
      ctx.fillText(truncated, x + barWidth / 2, height - 4);
    }
  }, [bars, height]);

  return (
    <div ref={containerRef} className={className}>
      <canvas
        ref={canvasRef}
        data-testid="bar-chart"
        style={{ width: "100%", height }}
      />
    </div>
  );
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function truncateText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + "…";
}
