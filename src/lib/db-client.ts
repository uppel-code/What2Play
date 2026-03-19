import Dexie, { type EntityTable } from "dexie";
import type { Game, CreateGameInput, UpdateGameInput, Player, PlayGroup, PlaySession, ChatMessage } from "@/types/game";

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
  bggRating: number | null;
  bggRank: number | null;
  createdAt: string;
  updatedAt: string;
}

interface PlayerRecord {
  id: number;
  name: string;
  maxComplexity: number | null;
  preferredDuration: number | null;
}

interface PlayGroupRecord {
  id: number;
  name: string;
  playerIds: number[];
  createdAt: string;
  updatedAt: string;
}

interface PlaySessionRecord {
  id: number;
  gameId: number;
  playedAt: string;
  playerCount: number;
  duration: number;
  winnerId: number | null;
  notes: string | null;
  createdAt: string;
}

interface ChatMessageRecord {
  id: number;
  gameId: number;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
}

const db = new Dexie("What2PlayDB") as Dexie & {
  games: EntityTable<GameRecord, "id">;
  players: EntityTable<PlayerRecord, "id">;
  playGroups: EntityTable<PlayGroupRecord, "id">;
  playSessions: EntityTable<PlaySessionRecord, "id">;
  chatMessages: EntityTable<ChatMessageRecord, "id">;
};

db.version(1).stores({
  games: "++id, &bggId, name, [minPlayers+maxPlayers], playingTime, averageWeight",
});

db.version(2).stores({
  games: "++id, &bggId, name, [minPlayers+maxPlayers], playingTime, averageWeight",
  players: "++id, name",
  playGroups: "++id, name",
});

db.version(3).stores({
  games: "++id, &bggId, name, [minPlayers+maxPlayers], playingTime, averageWeight",
  players: "++id, name",
  playGroups: "++id, name",
}).upgrade((tx) => {
  return tx.table("games").toCollection().modify((game) => {
    if (game.bggRating === undefined) game.bggRating = null;
    if (game.bggRank === undefined) game.bggRank = null;
  });
});

db.version(4).stores({
  games: "++id, &bggId, name, [minPlayers+maxPlayers], playingTime, averageWeight",
  players: "++id, name",
  playGroups: "++id, name",
  playSessions: "++id, gameId, playedAt",
});

db.version(5).stores({
  games: "++id, &bggId, name, [minPlayers+maxPlayers], playingTime, averageWeight, *mechanics",
  players: "++id, name",
  playGroups: "++id, name",
  playSessions: "++id, gameId, playedAt",
}).upgrade((tx) => {
  return tx.table("games").toCollection().modify((game) => {
    if (game.mechanics === undefined) game.mechanics = [];
  });
});

db.version(6).stores({
  games: "++id, &bggId, name, [minPlayers+maxPlayers], playingTime, averageWeight, *mechanics",
  players: "++id, name",
  playGroups: "++id, name",
  playSessions: "++id, gameId, playedAt",
  chatMessages: "++id, gameId, createdAt",
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
    bggRating: data.bggRating ?? null,
    bggRank: data.bggRank ?? null,
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

// ─── Player Operations ───

export async function getAllPlayers(): Promise<Player[]> {
  const records = await db.players.orderBy("name").toArray();
  return records.map((r) => ({
    id: r.id,
    name: r.name,
    maxComplexity: r.maxComplexity ?? undefined,
    preferredDuration: r.preferredDuration ?? undefined,
  }));
}

export async function createPlayer(name: string, maxComplexity?: number, preferredDuration?: number): Promise<Player> {
  const id = await db.players.add({
    name,
    maxComplexity: maxComplexity ?? null,
    preferredDuration: preferredDuration ?? null,
  } as PlayerRecord);
  return { id: id as number, name, maxComplexity, preferredDuration };
}

export async function updatePlayer(id: number, data: Partial<Omit<Player, "id">>): Promise<Player | undefined> {
  await db.players.update(id, {
    ...data,
    maxComplexity: data.maxComplexity ?? null,
    preferredDuration: data.preferredDuration ?? null,
  });
  const record = await db.players.get(id);
  if (!record) return undefined;
  return {
    id: record.id,
    name: record.name,
    maxComplexity: record.maxComplexity ?? undefined,
    preferredDuration: record.preferredDuration ?? undefined,
  };
}

export async function deletePlayer(id: number): Promise<boolean> {
  const existing = await db.players.get(id);
  if (!existing) return false;
  await db.players.delete(id);
  // Also remove from all groups
  const groups = await db.playGroups.toArray();
  for (const group of groups) {
    if (group.playerIds.includes(id)) {
      await db.playGroups.update(group.id, {
        playerIds: group.playerIds.filter((pid) => pid !== id),
        updatedAt: new Date().toISOString(),
      });
    }
  }
  return true;
}

// ─── PlayGroup Operations ───

export async function getAllPlayGroups(): Promise<PlayGroup[]> {
  return db.playGroups.orderBy("name").toArray();
}

export async function getPlayGroup(id: number): Promise<PlayGroup | undefined> {
  return db.playGroups.get(id);
}

export async function createPlayGroup(name: string, playerIds: number[] = []): Promise<PlayGroup> {
  const now = new Date().toISOString();
  const id = await db.playGroups.add({
    name,
    playerIds,
    createdAt: now,
    updatedAt: now,
  } as PlayGroupRecord);
  return { id: id as number, name, playerIds, createdAt: now, updatedAt: now };
}

export async function updatePlayGroup(id: number, data: { name?: string; playerIds?: number[] }): Promise<PlayGroup | undefined> {
  await db.playGroups.update(id, {
    ...data,
    updatedAt: new Date().toISOString(),
  });
  return db.playGroups.get(id);
}

export async function deletePlayGroup(id: number): Promise<boolean> {
  const existing = await db.playGroups.get(id);
  if (!existing) return false;
  await db.playGroups.delete(id);
  return true;
}

// ─── PlaySession Operations ───

export async function createPlaySession(data: {
  gameId: number;
  playedAt: string;
  playerCount: number;
  duration: number;
  winnerId?: number | null;
  notes?: string | null;
}): Promise<PlaySession> {
  const now = new Date().toISOString();
  const record: Omit<PlaySessionRecord, "id"> = {
    gameId: data.gameId,
    playedAt: data.playedAt,
    playerCount: data.playerCount,
    duration: data.duration,
    winnerId: data.winnerId ?? null,
    notes: data.notes ?? null,
    createdAt: now,
  };
  const id = await db.playSessions.add(record as PlaySessionRecord);
  // Also update lastPlayed on the game
  await db.games.update(data.gameId, {
    lastPlayed: data.playedAt,
    updatedAt: now,
  });
  return (await db.playSessions.get(id))! as PlaySession;
}

export async function getSessionsByGame(gameId: number): Promise<PlaySession[]> {
  return db.playSessions
    .where("gameId")
    .equals(gameId)
    .reverse()
    .sortBy("playedAt");
}

export async function getAllSessions(): Promise<PlaySession[]> {
  return db.playSessions.reverse().sortBy("playedAt");
}

export async function deletePlaySession(id: number): Promise<boolean> {
  const existing = await db.playSessions.get(id);
  if (!existing) return false;
  await db.playSessions.delete(id);
  return true;
}

// ─── Bulk Operations (Export/Import) ───

export async function getAllGamesRaw(): Promise<Game[]> {
  return db.games.toArray();
}

export async function getAllPlayersRaw(): Promise<Player[]> {
  const records = await db.players.toArray();
  return records.map((r) => ({
    id: r.id,
    name: r.name,
    maxComplexity: r.maxComplexity ?? undefined,
    preferredDuration: r.preferredDuration ?? undefined,
  }));
}

export async function getAllPlayGroupsRaw(): Promise<PlayGroup[]> {
  return db.playGroups.toArray();
}

export async function getAllSessionsRaw(): Promise<PlaySession[]> {
  return db.playSessions.toArray();
}

export async function clearAllData(): Promise<void> {
  await db.transaction("rw", [db.games, db.players, db.playGroups, db.playSessions, db.chatMessages], async () => {
    await db.games.clear();
    await db.players.clear();
    await db.playGroups.clear();
    await db.playSessions.clear();
    await db.chatMessages.clear();
  });
}

export async function bulkImportData(
  games: Game[],
  players: Player[],
  playGroups: PlayGroup[],
  playSessions: PlaySession[]
): Promise<void> {
  await db.transaction("rw", [db.games, db.players, db.playGroups, db.playSessions], async () => {
    if (games.length > 0) await db.games.bulkPut(games as unknown as GameRecord[]);
    if (players.length > 0) await db.players.bulkPut(players.map((p) => ({
      id: p.id,
      name: p.name,
      maxComplexity: p.maxComplexity ?? null,
      preferredDuration: p.preferredDuration ?? null,
    })));
    if (playGroups.length > 0) await db.playGroups.bulkPut(playGroups as unknown as PlayGroupRecord[]);
    if (playSessions.length > 0) await db.playSessions.bulkPut(playSessions as unknown as PlaySessionRecord[]);
  });
}

export async function getPlayStats(): Promise<{
  totalPlayed: number;
  thisWeekCount: number;
  mostPlayedGameId: number | null;
  mostPlayedCount: number;
}> {
  const all = await db.playSessions.toArray();
  const totalPlayed = all.length;

  // This week (Monday-based)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const mondayStr = monday.toISOString().split("T")[0];
  const thisWeekCount = all.filter((s) => s.playedAt >= mondayStr).length;

  // Most played game
  const counts = new Map<number, number>();
  for (const s of all) {
    counts.set(s.gameId, (counts.get(s.gameId) || 0) + 1);
  }
  let mostPlayedGameId: number | null = null;
  let mostPlayedCount = 0;
  for (const [gid, count] of counts) {
    if (count > mostPlayedCount) {
      mostPlayedGameId = gid;
      mostPlayedCount = count;
    }
  }

  return { totalPlayed, thisWeekCount, mostPlayedGameId, mostPlayedCount };
}

// ─── Chat Message Operations (RegelGuru) ───

export async function getChatMessages(gameId: number): Promise<ChatMessage[]> {
  return db.chatMessages
    .where("gameId")
    .equals(gameId)
    .sortBy("createdAt");
}

export async function addChatMessage(gameId: number, role: "user" | "assistant", text: string): Promise<ChatMessage> {
  const now = new Date().toISOString();
  const id = await db.chatMessages.add({
    gameId,
    role,
    text,
    createdAt: now,
  } as ChatMessageRecord);
  return { id: id as number, gameId, role, text, createdAt: now };
}

export async function clearChatMessages(gameId: number): Promise<void> {
  await db.chatMessages.where("gameId").equals(gameId).delete();
}

export async function trimChatMessages(gameId: number, maxMessages: number = 10): Promise<void> {
  const messages = await db.chatMessages
    .where("gameId")
    .equals(gameId)
    .sortBy("createdAt");
  if (messages.length > maxMessages) {
    const toDelete = messages.slice(0, messages.length - maxMessages);
    await db.chatMessages.bulkDelete(toDelete.map((m) => m.id));
  }
}

