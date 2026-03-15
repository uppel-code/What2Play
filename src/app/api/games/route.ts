import { NextRequest, NextResponse } from "next/server";
import { getAllGames, createGame } from "@/lib/db";
import type { CreateGameInput } from "@/types/game";

export async function GET() {
  try {
    const games = getAllGames();
    return NextResponse.json(games);
  } catch (error) {
    console.error("Failed to fetch games:", error);
    return NextResponse.json({ error: "Failed to fetch games" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateGameInput;

    if (!body.name || body.minPlayers == null || body.maxPlayers == null || body.playingTime == null) {
      return NextResponse.json(
        { error: "name, minPlayers, maxPlayers, and playingTime are required" },
        { status: 400 },
      );
    }

    const game = createGame(body);
    return NextResponse.json(game, { status: 201 });
  } catch (error) {
    console.error("Failed to create game:", error);
    return NextResponse.json({ error: "Failed to create game" }, { status: 500 });
  }
}
