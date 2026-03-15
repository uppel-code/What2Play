import { NextResponse } from "next/server";
import { createGame, getGameCount } from "@/lib/db";
import { SEED_GAMES } from "@/lib/seed";

export async function POST() {
  try {
    const existingCount = getGameCount();
    if (existingCount > 0) {
      return NextResponse.json(
        { message: `Database already has ${existingCount} games. Skipping seed.` },
        { status: 200 },
      );
    }

    const created = SEED_GAMES.map((game) => createGame(game));
    return NextResponse.json(
      { message: `Seeded ${created.length} games`, games: created },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to seed database:", error);
    return NextResponse.json({ error: "Failed to seed database" }, { status: 500 });
  }
}
