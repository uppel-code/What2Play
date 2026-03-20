"use client";

import { useEffect, useRef, useState } from "react";

export interface PieSlice {
  label: string;
  value: number;
  color: string;
}

const DARK_COLORS = [
  "#2D7A4F", "#D4A843", "#C45C4A", "#4A8DB7", "#8B6BB5",
  "#5BA88C", "#C47A3D", "#7A9B5A", "#B5635D", "#6B8FB5",
];

export function getPieColors(count: number): string[] {
  return Array.from({ length: count }, (_, i) => DARK_COLORS[i % DARK_COLORS.length]);
}

export default function PieChart({
  slices,
  size = 180,
  className = "",
}: {
  slices: PieSlice[];
  size?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // BUG-20: Re-render on dark mode change
  const [isDarkMode, setIsDarkMode] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDarkMode(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const total = slices.reduce((sum, s) => sum + s.value, 0);
    if (total === 0) return;

    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 4;
    let startAngle = -Math.PI / 2;

    for (const slice of slices) {
      const sweepAngle = (slice.value / total) * 2 * Math.PI;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, startAngle + sweepAngle);
      ctx.closePath();
      ctx.fillStyle = slice.color;
      ctx.fill();
      startAngle += sweepAngle;
    }

    // Center hole for donut effect
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.55, 0, 2 * Math.PI);
    // Use computed style for background
    const bg = getComputedStyle(document.documentElement).getPropertyValue("--color-surface").trim();
    ctx.fillStyle = bg || "#ffffff";
    ctx.fill();
  }, [slices, size, isDarkMode]);

  return (
    <div className={className}>
      <canvas
        ref={canvasRef}
        data-testid="pie-chart"
        style={{ width: size, height: size }}
      />
      {slices.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {slices.map((s) => (
            <div key={s.label} className="flex items-center gap-1.5 text-xs text-warm-600">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: s.color }}
              />
              <span>{s.label} ({s.value})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
