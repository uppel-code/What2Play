import { NextRequest, NextResponse } from "next/server";
import { searchBgg } from "@/services/bgg";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q");

  if (!query || query.trim().length < 2) {
    return NextResponse.json([]);
  }

  try {
    const results = await searchBgg(query.trim());
    return NextResponse.json(results.slice(0, 20));
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";

    if (msg === "BGG_API_TOKEN_MISSING") {
      return NextResponse.json(
        { error: "BGG_API_TOKEN_MISSING", message: "BGG API-Token ist nicht konfiguriert. Bitte BGG_API_TOKEN in .env.local setzen." },
        { status: 503 },
      );
    }
    if (msg === "BGG_API_TOKEN_INVALID") {
      return NextResponse.json(
        { error: "BGG_API_TOKEN_INVALID", message: "BGG API-Token ist ungültig oder abgelaufen." },
        { status: 401 },
      );
    }

    console.error("BGG search error:", error);
    return NextResponse.json({ error: "BGG search failed" }, { status: 500 });
  }
}
