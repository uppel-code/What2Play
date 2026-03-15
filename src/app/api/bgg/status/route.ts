import { NextResponse } from "next/server";
import { isBggConfigured } from "@/services/bgg";

export async function GET() {
  return NextResponse.json({ configured: isBggConfigured() });
}
