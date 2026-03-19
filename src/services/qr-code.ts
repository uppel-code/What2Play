/**
 * QR Code Generator — Canvas-basiert, ohne externe Abhängigkeiten
 *
 * Nutzt das QR Code Model 2 mit Error Correction Level M.
 * Unterstützt alphanumerische URLs bis ~77 Zeichen (Version 4).
 */

// ─── QR Code Matrix Generation ───

// Galois Field GF(256) with polynomial 0x11d
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(function initGF() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x = x << 1;
    if (x >= 256) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsEncode(data: number[], ecCount: number): number[] {
  // Build generator polynomial
  let gen = [1];
  for (let i = 0; i < ecCount; i++) {
    const next = new Array(gen.length + 1).fill(0);
    for (let j = 0; j < gen.length; j++) {
      next[j] ^= gen[j];
      next[j + 1] ^= gfMul(gen[j], GF_EXP[i]);
    }
    gen = next;
  }

  const msg = [...data, ...new Array(ecCount).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const coef = msg[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        msg[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return msg.slice(data.length);
}

// ─── QR Version/Mode constants ───

// Version 1-M: 16 data codewords, 10 EC codewords, 26 total
// Version 2-M: 28 data codewords, 16 EC codewords, 44 total
// Version 3-M: 44 data codewords, 26 EC codewords, 70 total
// Version 4-M: 64 data codewords, 36 EC codewords, 100 total

interface VersionInfo {
  version: number;
  size: number;
  dataCodewords: number;
  ecCodewords: number;
  byteCapacity: number;
  alignmentPatterns: number[];
}

const VERSIONS: VersionInfo[] = [
  { version: 1, size: 21, dataCodewords: 16, ecCodewords: 10, byteCapacity: 14, alignmentPatterns: [] },
  { version: 2, size: 25, dataCodewords: 28, ecCodewords: 16, byteCapacity: 26, alignmentPatterns: [6, 18] },
  { version: 3, size: 29, dataCodewords: 44, ecCodewords: 26, byteCapacity: 42, alignmentPatterns: [6, 22] },
  { version: 4, size: 33, dataCodewords: 64, ecCodewords: 36, byteCapacity: 62, alignmentPatterns: [6, 26] },
  { version: 5, size: 37, dataCodewords: 86, ecCodewords: 46, byteCapacity: 84, alignmentPatterns: [6, 30] },
  { version: 6, size: 41, dataCodewords: 108, ecCodewords: 60, byteCapacity: 106, alignmentPatterns: [6, 34] },
];

function selectVersion(dataLength: number): VersionInfo {
  for (const v of VERSIONS) {
    if (dataLength <= v.byteCapacity) return v;
  }
  return VERSIONS[VERSIONS.length - 1];
}

function encodeData(text: string, version: VersionInfo): number[] {
  // Byte mode (0100)
  const bytes = new TextEncoder().encode(text);
  const bits: number[] = [];

  // Mode indicator: byte mode = 0100
  bits.push(0, 1, 0, 0);

  // Character count indicator (8 bits for versions 1-9)
  const countBits = version.version <= 9 ? 8 : 16;
  for (let i = countBits - 1; i >= 0; i--) {
    bits.push((bytes.length >> i) & 1);
  }

  // Data
  for (const b of bytes) {
    for (let i = 7; i >= 0; i--) {
      bits.push((b >> i) & 1);
    }
  }

  // Terminator (up to 4 bits of 0)
  const totalDataBits = version.dataCodewords * 8;
  const termLen = Math.min(4, totalDataBits - bits.length);
  for (let i = 0; i < termLen; i++) bits.push(0);

  // Pad to byte boundary
  while (bits.length % 8 !== 0) bits.push(0);

  // Convert to bytes
  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | (bits[i + j] || 0);
    codewords.push(byte);
  }

  // Pad codewords
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (codewords.length < version.dataCodewords) {
    codewords.push(padBytes[padIdx % 2]);
    padIdx++;
  }

  return codewords;
}

function createMatrix(version: VersionInfo): { matrix: number[][]; reserved: boolean[][] } {
  const size = version.size;
  const matrix = Array.from({ length: size }, () => new Array(size).fill(0));
  const reserved = Array.from({ length: size }, () => new Array(size).fill(false));

  // Finder patterns
  function placeFinderPattern(row: number, col: number) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = row + r, cc = col + c;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        reserved[rr][cc] = true;
        if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
          if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
            matrix[rr][cc] = 1;
          } else {
            matrix[rr][cc] = 0;
          }
        } else {
          matrix[rr][cc] = 0; // separator
        }
      }
    }
  }

  placeFinderPattern(0, 0);
  placeFinderPattern(0, size - 7);
  placeFinderPattern(size - 7, 0);

  // Alignment patterns
  if (version.alignmentPatterns.length > 0) {
    const positions = version.alignmentPatterns;
    for (const r of positions) {
      for (const c of positions) {
        // Skip if overlapping finder
        if (reserved[r][c]) continue;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const rr = r + dr, cc = c + dc;
            reserved[rr][cc] = true;
            if (Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0)) {
              matrix[rr][cc] = 1;
            } else {
              matrix[rr][cc] = 0;
            }
          }
        }
      }
    }
  }

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    reserved[6][i] = true;
    matrix[6][i] = i % 2 === 0 ? 1 : 0;
    reserved[i][6] = true;
    matrix[i][6] = i % 2 === 0 ? 1 : 0;
  }

  // Dark module
  reserved[size - 8][8] = true;
  matrix[size - 8][8] = 1;

  // Format info areas (reserve)
  for (let i = 0; i < 9; i++) {
    if (i < size) { reserved[8][i] = true; reserved[i][8] = true; }
  }
  for (let i = 0; i < 8; i++) {
    reserved[8][size - 8 + i] = true;
    reserved[size - 8 + i][8] = true;
  }

  return { matrix, reserved };
}

function placeData(matrix: number[][], reserved: boolean[][], codewords: number[]): void {
  const size = matrix.length;
  const bits: number[] = [];
  for (const cw of codewords) {
    for (let i = 7; i >= 0; i--) bits.push((cw >> i) & 1);
  }

  let bitIdx = 0;
  let upward = true;

  for (let col = size - 1; col >= 0; col -= 2) {
    if (col === 6) col = 5; // skip timing column
    const rows = upward ? Array.from({ length: size }, (_, i) => size - 1 - i) : Array.from({ length: size }, (_, i) => i);

    for (const row of rows) {
      for (const c of [col, col - 1]) {
        if (c < 0) continue;
        if (!reserved[row][c]) {
          matrix[row][c] = bitIdx < bits.length ? bits[bitIdx] : 0;
          bitIdx++;
        }
      }
    }
    upward = !upward;
  }
}

// Format info for mask pattern with EC level M (01)
const FORMAT_INFO: Record<number, number> = {
  0: 0x5412,
  1: 0x5125,
  2: 0x5e7c,
  3: 0x5b4b,
  4: 0x45f9,
  5: 0x40ce,
  6: 0x4f97,
  7: 0x4aa0,
};

function applyMaskAndFormat(matrix: number[][], reserved: boolean[][], maskPattern: number): number[][] {
  const size = matrix.length;
  const result = matrix.map((row) => [...row]);

  // Apply mask
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (reserved[r][c]) continue;
      let mask = false;
      switch (maskPattern) {
        case 0: mask = (r + c) % 2 === 0; break;
        case 1: mask = r % 2 === 0; break;
        case 2: mask = c % 3 === 0; break;
        case 3: mask = (r + c) % 3 === 0; break;
        case 4: mask = (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0; break;
        case 5: mask = ((r * c) % 2) + ((r * c) % 3) === 0; break;
        case 6: mask = (((r * c) % 2) + ((r * c) % 3)) % 2 === 0; break;
        case 7: mask = (((r + c) % 2) + ((r * c) % 3)) % 2 === 0; break;
      }
      if (mask) result[r][c] ^= 1;
    }
  }

  // Place format info
  const formatBits = FORMAT_INFO[maskPattern];
  // Around top-left finder
  for (let i = 0; i <= 5; i++) result[8][i] = (formatBits >> (14 - i)) & 1;
  result[8][7] = (formatBits >> 8) & 1;
  result[8][8] = (formatBits >> 7) & 1;
  result[7][8] = (formatBits >> 6) & 1;
  for (let i = 0; i <= 5; i++) result[5 - i][8] = (formatBits >> (5 - i)) & 1;

  // Around top-right and bottom-left
  for (let i = 0; i < 8; i++) result[8][size - 8 + i] = (formatBits >> (14 - i)) & 1;
  for (let i = 0; i < 7; i++) result[size - 1 - i][8] = (formatBits >> i) & 1;

  return result;
}

function scoreMask(matrix: number[][]): number {
  const size = matrix.length;
  let score = 0;

  // Rule 1: consecutive same-color modules (rows + columns)
  for (let r = 0; r < size; r++) {
    let count = 1;
    for (let c = 1; c < size; c++) {
      if (matrix[r][c] === matrix[r][c - 1]) {
        count++;
        if (count === 5) score += 3;
        else if (count > 5) score += 1;
      } else {
        count = 1;
      }
    }
  }
  for (let c = 0; c < size; c++) {
    let count = 1;
    for (let r = 1; r < size; r++) {
      if (matrix[r][c] === matrix[r - 1][c]) {
        count++;
        if (count === 5) score += 3;
        else if (count > 5) score += 1;
      } else {
        count = 1;
      }
    }
  }

  // Rule 4: proportion of dark modules
  let dark = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c]) dark++;
    }
  }
  const percent = (dark * 100) / (size * size);
  const prev5 = Math.floor(percent / 5) * 5;
  const next5 = prev5 + 5;
  score += Math.min(Math.abs(prev5 - 50) / 5, Math.abs(next5 - 50) / 5) * 10;

  return score;
}

export function generateQRMatrix(text: string): number[][] {
  const version = selectVersion(new TextEncoder().encode(text).length);
  const data = encodeData(text, version);
  const ec = rsEncode(data, version.ecCodewords);
  const allCodewords = [...data, ...ec];

  const { matrix, reserved } = createMatrix(version);
  placeData(matrix, reserved, allCodewords);

  // Try all 8 masks and pick the best
  let bestMask = 0;
  let bestScore = Infinity;
  for (let m = 0; m < 8; m++) {
    const masked = applyMaskAndFormat(matrix, reserved, m);
    const s = scoreMask(masked);
    if (s < bestScore) {
      bestScore = s;
      bestMask = m;
    }
  }

  return applyMaskAndFormat(matrix, reserved, bestMask);
}

// ─── Canvas Rendering ───

export function renderQRToCanvas(
  matrix: number[][],
  canvas: HTMLCanvasElement,
  options: { size?: number; margin?: number; darkColor?: string; lightColor?: string } = {}
): void {
  const { size = 300, margin = 4, darkColor = "#1a1a1a", lightColor = "#ffffff" } = options;
  const modules = matrix.length;
  const totalModules = modules + margin * 2;
  const moduleSize = size / totalModules;

  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // Background
  ctx.fillStyle = lightColor;
  ctx.fillRect(0, 0, size, size);

  // Modules
  ctx.fillStyle = darkColor;
  for (let r = 0; r < modules; r++) {
    for (let c = 0; c < modules; c++) {
      if (matrix[r][c]) {
        ctx.fillRect(
          (c + margin) * moduleSize,
          (r + margin) * moduleSize,
          moduleSize + 0.5, // slight overlap to avoid gaps
          moduleSize + 0.5
        );
      }
    }
  }
}

export function qrToDataURL(matrix: number[][], size: number = 300): string {
  const canvas = document.createElement("canvas");
  renderQRToCanvas(matrix, canvas, { size });
  return canvas.toDataURL("image/png");
}

export function getBggUrl(bggId: number): string {
  return `https://boardgamegeek.com/boardgame/${bggId}`;
}

export function generateCollectionShareText(games: { name: string; bggId: number | null }[]): string {
  const lines = games.map((g, i) => {
    const bggLink = g.bggId ? ` (${getBggUrl(g.bggId)})` : "";
    return `${i + 1}. ${g.name}${bggLink}`;
  });
  return `Meine Brettspielsammlung (${games.length} Spiele):\n\n${lines.join("\n")}`;
}
