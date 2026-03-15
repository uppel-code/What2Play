import { NextRequest, NextResponse } from "next/server";
import { fetchBggThing } from "@/services/bgg";

export async function GET(request: NextRequest) {
  const idParam = request.nextUrl.searchParams.get("id");

  if (!idParam) {
    return NextResponse.json({ error: "id parameter is required" }, { status: 400 });
  }

  const bggId = parseInt(idParam, 10);
  if (isNaN(bggId)) {
    return NextResponse.json({ error: "id must be a number" }, { status: 400 });
  }

  try {
    const game = await fetchBggThing(bggId);
    if (!game) {
      return NextResponse.json({ error: "Game not found on BGG" }, { status: 404 });
    }
    return NextResponse.json(game);
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

    console.error("BGG thing error:", error);
    return NextResponse.json({ error: "BGG lookup failed" }, { status: 500 });
  }
}
