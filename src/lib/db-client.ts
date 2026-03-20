import Dexie, { type EntityTable } from "dexie";
import type { Game, CreateGameInput, UpdateGameInput, Player, PlayGroup, PlaySession, ChatMessage, Loan, Achievement, AchievementKey, Expansion, CreateExpansionInput, GameNight, CreateGameNightInput } from "@/types/game";

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
  wishlist: boolean;
  shelfLocation: string | null;
  lastPlayed: string | null;
  favorite: boolean;
  forSale: boolean;
  notes: string | null;
  tags: string[];
  bggRating: number | null;
  bggRank: number | null;
  quickRules: string | null;
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

interface LoanRecord {
  id: number;
  gameId: number;
  personName: string;
  loanDate: string;
  returnedAt: string | null;
  createdAt: string;
}

interface AchievementRecord {
  id: number;
  key: string;
  unlockedAt: string;
}

interface ExpansionRecord {
  id: number;
  parentGameId: number;
  bggId: number | null;
  name: string;
  owned: boolean;
  notes: string | null;
}

interface GameNightRecord {
  id: number;
  name: string;
  date: string;
  playerIds: number[];
  gameIds: number[];
  createdAt: string;
}

const db = new Dexie("What2PlayDB") as Dexie & {
  games: EntityTable<GameRecord, "id">;
  players: EntityTable<PlayerRecord, "id">;
  playGroups: EntityTable<PlayGroupRecord, "id">;
  playSessions: EntityTable<PlaySessionRecord, "id">;
  chatMessages: EntityTable<ChatMessageRecord, "id">;
  loans: EntityTable<LoanRecord, "id">;
  achievements: EntityTable<AchievementRecord, "id">;
  expansions: EntityTable<ExpansionRecord, "id">;
  gameNights: EntityTable<GameNightRecord, "id">;
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
}).upgrade((tx) => {
  return tx.table("games").toCollection().modify((game) => {
    if (game.quickRules === undefined) game.quickRules = null;
  });
});

db.version(7).stores({
  games: "++id, &bggId, name, [minPlayers+maxPlayers], playingTime, averageWeight, *mechanics",
  players: "++id, name",
  playGroups: "++id, name",
  playSessions: "++id, gameId, playedAt",
  chatMessages: "++id, gameId, createdAt",
  loans: "++id, gameId, personName, returnedAt",
});

db.version(8).stores({
  games: "++id, &bggId, name, [minPlayers+maxPlayers], playingTime, averageWeight, *mechanics",
  players: "++id, name",
  playGroups: "++id, name",
  playSessions: "++id, gameId, playedAt",
  chatMessages: "++id, gameId, createdAt",
  loans: "++id, gameId, personName, returnedAt",
  achievements: "++id, &key, unlockedAt",
});

db.version(9).stores({
  games: "++id, &bggId, name, [minPlayers+maxPlayers], playingTime, averageWeight, *mechanics",
  players: "++id, name",
  playGroups: "++id, name",
  playSessions: "++id, gameId, playedAt",
  chatMessages: "++id, gameId, createdAt",
  loans: "++id, gameId, personName, returnedAt",
  achievements: "++id, &key, unlockedAt",
}).upgrade((tx) => {
  return tx.table("games").toCollection().modify((game) => {
    if (game.forSale === undefined) game.forSale = false;
  });
});

db.version(10).stores({
  games: "++id, &bggId, name, [minPlayers+maxPlayers], playingTime, averageWeight, *mechanics",
  players: "++id, name",
  playGroups: "++id, name",
  playSessions: "++id, gameId, playedAt",
  chatMessages: "++id, gameId, createdAt",
  loans: "++id, gameId, personName, returnedAt",
  achievements: "++id, &key, unlockedAt",
  expansions: "++id, parentGameId, bggId, name",
});

db.version(11).stores({
  games: "++id, &bggId, name, [minPlayers+maxPlayers], playingTime, averageWeight, *mechanics",
  players: "++id, name",
  playGroups: "++id, name",
  playSessions: "++id, gameId, playedAt",
  chatMessages: "++id, gameId, createdAt",
  loans: "++id, gameId, personName, returnedAt",
  achievements: "++id, &key, unlockedAt",
  expansions: "++id, parentGameId, bggId, name",
  gameNights: "++id, name, date",
});

db.version(12).stores({
  games: "++id, &bggId, name, [minPlayers+maxPlayers], playingTime, averageWeight, *mechanics, wishlist",
  players: "++id, name",
  playGroups: "++id, name",
  playSessions: "++id, gameId, playedAt",
  chatMessages: "++id, gameId, createdAt",
  loans: "++id, gameId, personName, returnedAt",
  achievements: "++id, &key, unlockedAt",
  expansions: "++id, parentGameId, bggId, name",
  gameNights: "++id, name, date",
}).upgrade((tx) => {
  return tx.table("games").toCollection().modify((game) => {
    if (game.wishlist === undefined) game.wishlist = false;
  });
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
    quickRules: null,
    owned: data.owned !== false,
    wishlist: data.wishlist ?? false,
    shelfLocation: data.shelfLocation ?? null,
    lastPlayed: null,
    favorite: data.favorite ?? false,
    forSale: data.forSale ?? false,
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
  // BUG-06: Mutual exclusion between wishlist and forSale
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: any = { ...data, updatedAt: new Date().toISOString() };
  if (updates.forSale === true) updates.wishlist = false;
  if (updates.wishlist === true) updates.forSale = false;
  await db.games.update(id, updates);
  return db.games.get(id);
}

export async function deleteGame(id: number): Promise<boolean> {
  const existing = await db.games.get(id);
  if (!existing) return false;
  await db.transaction("rw", [db.games, db.loans, db.playSessions, db.expansions, db.chatMessages], async () => {
    await db.loans.where("gameId").equals(id).delete();
    await db.playSessions.where("gameId").equals(id).delete();
    await db.expansions.where("parentGameId").equals(id).delete();
    await db.chatMessages.where("gameId").equals(id).delete();
    await db.games.delete(id);
  });
  return true;
}

export async function getGameCount(): Promise<number> {
  return db.games.filter((g) => g.owned === true).count();
}

export async function getWishlistGames(): Promise<Game[]> {
  return db.games.filter((g) => g.wishlist === true).toArray();
}

export async function getWishlistCount(): Promise<number> {
  return db.games.filter((g) => g.wishlist === true).count();
}

export async function saveQuickRules(gameId: number, quickRules: string): Promise<void> {
  await db.games.update(gameId, { quickRules, updatedAt: new Date().toISOString() });
}

export async function getQuickRules(gameId: number): Promise<string | null> {
  const game = await db.games.get(gameId);
  return game?.quickRules ?? null;
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

export async function deletePlayer(id: number): Promise<{ deleted: boolean; warnings: string[] }> {
  const existing = await db.players.get(id);
  if (!existing) return { deleted: false, warnings: [] };
  const warnings: string[] = [];
  // BUG-17: Check for references before deletion
  const sessionCount = await db.playSessions.filter((s) => s.winnerId === id).count();
  if (sessionCount > 0) {
    warnings.push(`${sessionCount} Session(s) referenzieren diesen Spieler als Gewinner.`);
  }
  const loanCount = await db.loans.filter((l) => l.personName === existing.name).count();
  if (loanCount > 0) {
    warnings.push(`${loanCount} Ausleihe(n) referenzieren diesen Spieler.`);
  }
  // Nullify winnerId references
  const sessionsWithPlayer = await db.playSessions.filter((s) => s.winnerId === id).toArray();
  for (const s of sessionsWithPlayer) {
    await db.playSessions.update(s.id, { winnerId: null });
  }
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
  return { deleted: true, warnings };
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
  await db.transaction("rw", [db.games, db.players, db.playGroups, db.playSessions, db.chatMessages, db.loans, db.achievements, db.expansions, db.gameNights], async () => {
    await db.games.clear();
    await db.players.clear();
    await db.playGroups.clear();
    await db.playSessions.clear();
    await db.chatMessages.clear();
    await db.loans.clear();
    await db.achievements.clear();
    await db.expansions.clear();
    await db.gameNights.clear();
  });
}

export async function bulkImportData(
  games: Game[],
  players: Player[],
  playGroups: PlayGroup[],
  playSessions: PlaySession[],
  loans: Loan[] = []
): Promise<void> {
  await db.transaction("rw", [db.games, db.players, db.playGroups, db.playSessions, db.loans], async () => {
    if (games.length > 0) await db.games.bulkPut(games as unknown as GameRecord[]);
    if (players.length > 0) await db.players.bulkPut(players.map((p) => ({
      id: p.id,
      name: p.name,
      maxComplexity: p.maxComplexity ?? null,
      preferredDuration: p.preferredDuration ?? null,
    })));
    if (playGroups.length > 0) await db.playGroups.bulkPut(playGroups as unknown as PlayGroupRecord[]);
    if (playSessions.length > 0) await db.playSessions.bulkPut(playSessions as unknown as PlaySessionRecord[]);
    if (loans.length > 0) await db.loans.bulkPut(loans as unknown as LoanRecord[]);
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

// ─── Loan Operations (Leih-Tracker) ───

export async function createLoan(data: {
  gameId: number;
  personName: string;
  loanDate: string;
}): Promise<Loan> {
  const now = new Date().toISOString();
  const record: Omit<LoanRecord, "id"> = {
    gameId: data.gameId,
    personName: data.personName,
    loanDate: data.loanDate,
    returnedAt: null,
    createdAt: now,
  };
  const id = await db.loans.add(record as LoanRecord);
  return (await db.loans.get(id))! as Loan;
}

export async function returnLoan(id: number, returnDate?: string): Promise<Loan | undefined> {
  const existing = await db.loans.get(id);
  if (!existing) return undefined;
  const now = returnDate || new Date().toISOString().split("T")[0];
  // BUG-26: Validate returnedAt >= loanDate
  if (now < existing.loanDate) {
    throw new Error("Rückgabedatum darf nicht vor dem Ausleihdatum liegen.");
  }
  await db.loans.update(id, { returnedAt: now });
  return (await db.loans.get(id))! as Loan;
}

export async function deleteLoan(id: number): Promise<boolean> {
  const existing = await db.loans.get(id);
  if (!existing) return false;
  await db.loans.delete(id);
  return true;
}

export async function getActiveLoanByGame(gameId: number): Promise<Loan | undefined> {
  const loans = await db.loans
    .where("gameId")
    .equals(gameId)
    .filter((l) => l.returnedAt === null)
    .toArray();
  return loans[0] as Loan | undefined;
}

export async function getLoansByGame(gameId: number): Promise<Loan[]> {
  return db.loans.where("gameId").equals(gameId).reverse().sortBy("loanDate") as Promise<Loan[]>;
}

export async function getAllActiveLoans(): Promise<Loan[]> {
  return db.loans.filter((l) => l.returnedAt === null).toArray() as Promise<Loan[]>;
}

export async function getAllLoansRaw(): Promise<Loan[]> {
  return db.loans.toArray() as Promise<Loan[]>;
}

// ─── Achievement Operations ───

// ─── Expansion Operations ───

export async function createExpansion(data: CreateExpansionInput): Promise<Expansion> {
  const record: Omit<ExpansionRecord, "id"> = {
    parentGameId: data.parentGameId,
    bggId: data.bggId ?? null,
    name: data.name,
    owned: data.owned !== false,
    notes: data.notes ?? null,
  };
  const id = await db.expansions.add(record as ExpansionRecord);
  return (await db.expansions.get(id))! as Expansion;
}

export async function getExpansionsByGame(parentGameId: number): Promise<Expansion[]> {
  return db.expansions
    .where("parentGameId")
    .equals(parentGameId)
    .sortBy("name") as Promise<Expansion[]>;
}

export async function updateExpansion(id: number, data: Partial<Omit<Expansion, "id" | "parentGameId">>): Promise<Expansion | undefined> {
  const existing = await db.expansions.get(id);
  if (!existing) return undefined;
  await db.expansions.update(id, data);
  return (await db.expansions.get(id))! as Expansion;
}

export async function deleteExpansion(id: number): Promise<boolean> {
  const existing = await db.expansions.get(id);
  if (!existing) return false;
  await db.expansions.delete(id);
  return true;
}

export async function getOwnedExpansionCount(parentGameId: number): Promise<number> {
  return db.expansions
    .where("parentGameId")
    .equals(parentGameId)
    .filter((e) => e.owned === true)
    .count();
}

export async function getAchievement(key: AchievementKey): Promise<Achievement | undefined> {
  return db.achievements.where("key").equals(key).first() as Promise<Achievement | undefined>;
}

export async function getAllAchievements(): Promise<Achievement[]> {
  return db.achievements.toArray() as Promise<Achievement[]>;
}

export async function unlockAchievement(key: AchievementKey): Promise<Achievement | null> {
  const existing = await db.achievements.where("key").equals(key).first();
  if (existing) return null; // already unlocked
  const now = new Date().toISOString();
  const id = await db.achievements.add({ key, unlockedAt: now } as AchievementRecord);
  return (await db.achievements.get(id))! as Achievement;
}

// ─── GameNight Operations (Ich bring mit) ───

export async function createGameNight(data: CreateGameNightInput): Promise<GameNight> {
  const now = new Date().toISOString();
  const record: Omit<GameNightRecord, "id"> = {
    name: data.name,
    date: data.date,
    playerIds: data.playerIds ?? [],
    gameIds: data.gameIds ?? [],
    createdAt: now,
  };
  const id = await db.gameNights.add(record as GameNightRecord);
  return (await db.gameNights.get(id))! as GameNight;
}

export async function getAllGameNights(): Promise<GameNight[]> {
  return db.gameNights.orderBy("date").reverse().toArray() as Promise<GameNight[]>;
}

export async function getGameNight(id: number): Promise<GameNight | undefined> {
  return db.gameNights.get(id) as Promise<GameNight | undefined>;
}

export async function updateGameNight(id: number, data: Partial<Omit<GameNight, "id" | "createdAt">>): Promise<GameNight | undefined> {
  const existing = await db.gameNights.get(id);
  if (!existing) return undefined;
  await db.gameNights.update(id, data);
  return (await db.gameNights.get(id))! as GameNight;
}

export async function deleteGameNight(id: number): Promise<boolean> {
  const existing = await db.gameNights.get(id);
  if (!existing) return false;
  await db.gameNights.delete(id);
  return true;
}

export async function getUpcomingGameNight(): Promise<GameNight | undefined> {
  const now = new Date().toISOString();
  const upcoming = await db.gameNights
    .where("date")
    .aboveOrEqual(now.split("T")[0])
    .sortBy("date");
  return upcoming[0] as GameNight | undefined;
}

