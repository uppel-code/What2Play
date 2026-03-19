/**
 * Regelwerk Export Service
 *
 * Exports game rules as plain text or generates a printable PDF-like HTML page.
 */

import type { Game } from "@/types/game";

export interface RulesExportData {
  game: Game;
  quickRules: string;
}

/**
 * Export rules as plain text and trigger download.
 */
export function exportRulesAsText(data: RulesExportData): void {
  const text = formatRulesText(data);
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  downloadBlob(blob, `${sanitizeFilename(data.game.name)}_Regeln.txt`);
}

/**
 * Export rules as a printable HTML document (PDF-ready via print dialog).
 */
export function exportRulesAsPdf(data: RulesExportData): void {
  const html = formatRulesHtml(data);
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.addEventListener("load", () => {
    printWindow.print();
  });
}

/**
 * Copy rules text to clipboard.
 */
export async function copyRulesToClipboard(data: RulesExportData): Promise<boolean> {
  const text = formatRulesText(data);
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// ─── Formatting Helpers ───

export function formatRulesText(data: RulesExportData): string {
  const { game, quickRules } = data;
  const lines: string[] = [];

  lines.push(`═══════════════════════════════════════`);
  lines.push(`  ${game.name} — Kurzregeln`);
  lines.push(`═══════════════════════════════════════`);
  lines.push("");

  if (game.yearpublished) {
    lines.push(`Erscheinungsjahr: ${game.yearpublished}`);
  }
  lines.push(`Spieler: ${game.minPlayers}–${game.maxPlayers}`);
  lines.push(`Spieldauer: ${game.playingTime} Minuten`);
  if (game.averageWeight > 0) {
    lines.push(`Komplexität: ${game.averageWeight.toFixed(1)} / 5.0`);
  }
  if (game.mechanics.length > 0) {
    lines.push(`Mechaniken: ${game.mechanics.join(", ")}`);
  }

  lines.push("");
  lines.push(`───────────────────────────────────────`);
  lines.push("");
  lines.push(quickRules);
  lines.push("");
  lines.push(`───────────────────────────────────────`);
  lines.push(`Exportiert aus What2Play`);

  return lines.join("\n");
}

export function formatRulesHtml(data: RulesExportData): string {
  const { game, quickRules } = data;
  const rulesHtml = quickRules
    .split("\n")
    .map((line) => (line.trim() === "" ? "<br>" : `<p>${escapeHtml(line)}</p>`))
    .join("\n");

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(game.name)} — Kurzregeln</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 700px; margin: 40px auto; padding: 0 20px; color: #1a1a1a; line-height: 1.6; }
    h1 { font-size: 24px; margin-bottom: 4px; }
    .meta { color: #666; font-size: 14px; margin-bottom: 24px; }
    .meta span { margin-right: 16px; }
    .rules { font-size: 15px; }
    .rules p { margin: 0 0 8px; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 12px; color: #999; }
    @media print { body { margin: 20px; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(game.name)}</h1>
  <div class="meta">
    ${game.yearpublished ? `<span>${game.yearpublished}</span>` : ""}
    <span>${game.minPlayers}–${game.maxPlayers} Spieler</span>
    <span>${game.playingTime} Min</span>
    ${game.averageWeight > 0 ? `<span>Komplexität: ${game.averageWeight.toFixed(1)}/5</span>` : ""}
  </div>
  <div class="rules">
    ${rulesHtml}
  </div>
  <div class="footer">Exportiert aus What2Play</div>
</body>
</html>`;
}

// ─── Utilities ───

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9äöüÄÖÜß\-_ ]/g, "").replace(/\s+/g, "_");
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
