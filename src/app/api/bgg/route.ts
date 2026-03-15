import { NextRequest, NextResponse } from "next/server";
import { fetchBggCollection } from "@/services/bgg";
import { createGame, getDb } from "@/lib/db";
import type { GameRow } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const { username } = await request.json();

    if (!username || typeof username !== "string") {
      return NextResponse.json({ error: "username is required" }, { status: 400 });
    }

    const result = await fetchBggCollection(username);

    if (result.queued) {
      return NextResponse.json(
        { message: "BGG is preparing your collection. Please try again in a few seconds.", queued: true },
        { status: 202 },
      );
    }

    if (!result.success) {
      return NextResponse.json(
        { error: "BGG import failed", details: result.errors },
        { status: 502 },
      );
    }

    const db = getDb();
    let imported = 0;
    let skipped = 0;

    for (const bggGame of result.games) {
      const existing = db.prepare("SELECT id FROM games WHERE bgg_id = ?").get(bggGame.bggId) as GameRow | undefined;
      if (existing) {
        skipped++;
        continue;
      }

      createGame({
        bggId: bggGame.bggId,
        name: bggGame.name,
        yearpublished: bggGame.yearpublished,
        minPlayers: bggGame.minPlayers,
        maxPlayers: bggGame.maxPlayers,
        playingTime: bggGame.playingTime,
        minPlayTime: bggGame.minPlayTime,
        maxPlayTime: bggGame.maxPlayTime,
        minAge: bggGame.minAge,
        averageWeight: bggGame.averageWeight,
        thumbnail: bggGame.thumbnail,
        image: bggGame.image,
        categories: bggGame.categories,
        mechanics: bggGame.mechanics,
        owned: true,
      });
      imported++;
    }

    return NextResponse.json({
      message: `Imported ${imported} games, skipped ${skipped} duplicates`,
      imported,
      skipped,
      total: result.games.length,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";

    if (msg === "BGG_API_TOKEN_MISSING") {
      return NextResponse.json(
        { error: "BGG_API_TOKEN_MISSING", message: "BGG API-Token ist nicht konfiguriert." },
        { status: 503 },
      );
    }
    if (msg === "BGG_API_TOKEN_INVALID") {
      return NextResponse.json(
        { error: "BGG_API_TOKEN_INVALID", message: "BGG API-Token ist ungültig oder abgelaufen." },
        { status: 401 },
      );
    }

    console.error("BGG import error:", error);
    return NextResponse.json({ error: "BGG import failed" }, { status: 500 });
  }
}
