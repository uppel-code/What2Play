import Dexie, { type EntityTable } from "dexie";
import type { Game, CreateGameInput, UpdateGameInput } from "@/types/game";
import { SEED_GAMES } from "@/lib/seed";

// ─── Database Definition ───

interface GameRecord {
  id: number;
  bggId: number | null;
  name: string;
  yearpublished: number | null;
  minPlayers: number;
  maxPlayers: number;
  playingTime: number;
  minPlayTime: number;
  maxPlayTime: number;
  minAge: number;
  averageWeight: number;
  thumbnail: string | null;
  image: string | null;
  categories: string[];
  mechanics: string[];
  owned: boolean;
  shelfLocation: string | null;
  lastPlayed: string | null;
  favorite: boolean;
  notes: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

const db = new Dexie("What2PlayDB") as Dexie & {
  games: EntityTable<GameRecord, "id">;
};

db.version(1).stores({
  games: "++id, &bggId, name, [minPlayers+maxPlayers], playingTime, averageWeight",
});

// ─── CRUD Operations ───

export async function getAllGames(): Promise<Game[]> {
  return db.games.orderBy("name").filter((g) => g.owned === true).toArray();
}

export async function getGameById(id: number): Promise<Game | undefined> {
  return db.games.get(id);
}

export async function getGameByBggId(bggId: number): Promise<Game | undefined> {
  return db.games.where("bggId").equals(bggId).first();
}

export async function createGame(data: CreateGameInput): Promise<Game> {
  const now = new Date().toISOString();
  const record: Omit<GameRecord, "id"> = {
    bggId: data.bggId ?? null,
    name: data.name,
    yearpublished: data.yearpublished ?? null,
    minPlayers: data.minPlayers,
    maxPlayers: data.maxPlayers,
    playingTime: data.playingTime,
    minPlayTime: data.minPlayTime ?? data.playingTime,
    maxPlayTime: data.maxPlayTime ?? data.playingTime,
    minAge: data.minAge ?? 0,
    averageWeight: data.averageWeight ?? 2.0,
    thumbnail: data.thumbnail ?? null,
    image: data.image ?? null,
    categories: data.categories ?? [],
    mechanics: data.mechanics ?? [],
    owned: data.owned !== false,
    shelfLocation: data.shelfLocation ?? null,
    lastPlayed: null,
    favorite: data.favorite ?? false,
    notes: data.notes ?? null,
    tags: data.tags ?? [],
    createdAt: now,
    updatedAt: now,
  };

  const id = await db.games.add(record as GameRecord);
  return (await db.games.get(id))!;
}

export async function updateGame(
  id: number,
  data: UpdateGameInput
): Promise<Game | undefined> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: any = { ...data, updatedAt: new Date().toISOString() };
  await db.games.update(id, updates);
  return db.games.get(id);
}

export async function deleteGame(id: number): Promise<boolean> {
  const existing = await db.games.get(id);
  if (!existing) return false;
  await db.games.delete(id);
  return true;
}

export async function getGameCount(): Promise<number> {
  return db.games.filter((g) => g.owned === true).count();
}

// ─── Seed Data ───

export async function ensureSeedData(): Promise<void> {
  const count = await getGameCount();
  if (count > 0) return;

  for (const seed of SEED_GAMES) {
    await createGame(seed);
  }
}
