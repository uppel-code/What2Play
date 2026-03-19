import { describe, it, expect } from "vitest";
import { generateQRMatrix, generateCollectionShareText, getBggUrl } from "@/services/qr-code";

describe("QR Code Generation", () => {
  it("generates a matrix for a short URL", () => {
    const url = "https://boardgamegeek.com/boardgame/13";
    const matrix = generateQRMatrix(url);

    // Should be a square matrix
    expect(matrix.length).toBeGreaterThanOrEqual(21); // minimum QR version 1
    expect(matrix[0].length).toBe(matrix.length);

    // All values should be 0 or 1
    for (const row of matrix) {
      for (const cell of row) {
        expect(cell === 0 || cell === 1).toBe(true);
      }
    }
  });

  it("generates a matrix for a longer URL", () => {
    const url = "https://boardgamegeek.com/boardgame/266192";
    const matrix = generateQRMatrix(url);

    expect(matrix.length).toBeGreaterThanOrEqual(21);
    expect(matrix[0].length).toBe(matrix.length);
  });

  it("has finder patterns in top-left corner", () => {
    const matrix = generateQRMatrix("https://bgg.cc/13");

    // Top-left finder pattern: first 7 rows/cols should have the pattern
    // First row should start with 1,1,1,1,1,1,1
    expect(matrix[0][0]).toBe(1);
    expect(matrix[0][1]).toBe(1);
    expect(matrix[0][2]).toBe(1);
    expect(matrix[0][3]).toBe(1);
    expect(matrix[0][4]).toBe(1);
    expect(matrix[0][5]).toBe(1);
    expect(matrix[0][6]).toBe(1);
  });

  it("generates different matrices for different URLs", () => {
    const m1 = generateQRMatrix("https://boardgamegeek.com/boardgame/13");
    const m2 = generateQRMatrix("https://boardgamegeek.com/boardgame/822");

    // Matrices should be different
    let different = false;
    const minSize = Math.min(m1.length, m2.length);
    for (let r = 0; r < minSize && !different; r++) {
      for (let c = 0; c < minSize && !different; c++) {
        if (m1[r][c] !== m2[r][c]) different = true;
      }
    }
    expect(different).toBe(true);
  });
});

describe("BGG URL generation", () => {
  it("generates correct BGG URL", () => {
    expect(getBggUrl(13)).toBe("https://boardgamegeek.com/boardgame/13");
    expect(getBggUrl(266192)).toBe("https://boardgamegeek.com/boardgame/266192");
  });
});

describe("Collection Share Text", () => {
  it("generates share text with games and BGG links", () => {
    const games = [
      { name: "Catan", bggId: 13 },
      { name: "Azul", bggId: 230802 },
    ];
    const text = generateCollectionShareText(games);

    expect(text).toContain("Meine Brettspielsammlung (2 Spiele):");
    expect(text).toContain("1. Catan (https://boardgamegeek.com/boardgame/13)");
    expect(text).toContain("2. Azul (https://boardgamegeek.com/boardgame/230802)");
  });

  it("generates share text without BGG links for manual games", () => {
    const games = [
      { name: "Custom Game", bggId: null },
    ];
    const text = generateCollectionShareText(games);

    expect(text).toContain("1. Custom Game");
    expect(text).not.toContain("boardgamegeek.com");
  });

  it("handles empty collection", () => {
    const text = generateCollectionShareText([]);
    expect(text).toContain("0 Spiele");
  });

  it("numbers games correctly", () => {
    const games = [
      { name: "Game 1", bggId: 1 },
      { name: "Game 2", bggId: 2 },
      { name: "Game 3", bggId: 3 },
    ];
    const text = generateCollectionShareText(games);

    expect(text).toContain("1. Game 1");
    expect(text).toContain("2. Game 2");
    expect(text).toContain("3. Game 3");
  });
});
