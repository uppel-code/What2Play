import { NextRequest, NextResponse } from "next/server";
import { fetchBggThing } from "@/services/bgg";
import { createGame, getDb } from "@/lib/db";
import type { GameRow } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const { ids } = await request.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids must be a non-empty array of BGG IDs" }, { status: 400 });
    }

    // Validate and deduplicate
    const bggIds = [...new Set(ids.map(Number).filter((id: number) => !isNaN(id) && id > 0))];

    if (bggIds.length === 0) {
      return NextResponse.json({ error: "No valid BGG IDs provided" }, { status: 400 });
    }

    if (bggIds.length > 200) {
      return NextResponse.json({ error: "Maximum 200 IDs at once" }, { status: 400 });
    }

    const db = getDb();
    const results: { bggId: number; name: string; status: "imported" | "skipped" | "failed" }[] = [];
    let imported = 0;
    let skipped = 0;
    let failed = 0;

    for (const bggId of bggIds) {
      // Check if already exists
      const existing = db.prepare("SELECT id FROM games WHERE bgg_id = ?").get(bggId) as GameRow | undefined;
      if (existing) {
        results.push({ bggId, name: `(bereits vorhanden)`, status: "skipped" });
        skipped++;
        continue;
      }

      try {
        const game = await fetchBggThing(bggId);
        if (!game) {
          results.push({ bggId, name: `ID ${bggId}`, status: "failed" });
          failed++;
          continue;
        }

        createGame({
          bggId: game.bggId,
          name: game.name,
          yearpublished: game.yearpublished,
          minPlayers: game.minPlayers,
          maxPlayers: game.maxPlayers,
          playingTime: game.playingTime,
          minPlayTime: game.minPlayTime,
          maxPlayTime: game.maxPlayTime,
          minAge: game.minAge,
          averageWeight: game.averageWeight,
          thumbnail: game.thumbnail,
          image: game.image,
          categories: game.categories,
          mechanics: game.mechanics,
          owned: true,
        });

        results.push({ bggId, name: game.name, status: "imported" });
        imported++;
      } catch (error) {
        const msg = error instanceof Error ? error.message : "";
        // Propagate token errors immediately
        if (msg === "BGG_API_TOKEN_MISSING") {
          return NextResponse.json(
            { error: "BGG_API_TOKEN_MISSING", message: "BGG API-Token ist nicht konfiguriert.", results, imported, skipped, failed },
            { status: 503 },
          );
        }
        if (msg === "BGG_API_TOKEN_INVALID") {
          return NextResponse.json(
            { error: "BGG_API_TOKEN_INVALID", message: "BGG API-Token ist ungültig.", results, imported, skipped, failed },
            { status: 401 },
          );
        }

        results.push({ bggId, name: `ID ${bggId}`, status: "failed" });
        failed++;
      }
    }

    return NextResponse.json({ imported, skipped, failed, total: bggIds.length, results });
  } catch (error) {
    console.error("BGG bulk import error:", error);
    return NextResponse.json({ error: "Bulk import failed" }, { status: 500 });
  }
}
