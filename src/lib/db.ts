import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "what2play.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initializeSchema(db);
  }
  return db;
}

function initializeSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS games (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      bgg_id        INTEGER UNIQUE,
      name          TEXT NOT NULL,
      yearpublished INTEGER,
      min_players   INTEGER NOT NULL DEFAULT 1,
      max_players   INTEGER NOT NULL DEFAULT 4,
      playing_time  INTEGER NOT NULL DEFAULT 30,
      min_play_time INTEGER NOT NULL DEFAULT 0,
      max_play_time INTEGER NOT NULL DEFAULT 0,
      min_age       INTEGER NOT NULL DEFAULT 0,
      average_weight REAL NOT NULL DEFAULT 2.0,
      thumbnail     TEXT,
      image         TEXT,
      categories    TEXT NOT NULL DEFAULT '[]',
      mechanics     TEXT NOT NULL DEFAULT '[]',
      -- Ownership data
      owned         INTEGER NOT NULL DEFAULT 1,
      shelf_location TEXT,
      last_played   TEXT,
      favorite      INTEGER NOT NULL DEFAULT 0,
      -- User meta
      notes         TEXT,
      tags          TEXT NOT NULL DEFAULT '[]',
      -- Timestamps
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_games_name ON games(name);
    CREATE INDEX IF NOT EXISTS idx_games_players ON games(min_players, max_players);
    CREATE INDEX IF NOT EXISTS idx_games_time ON games(playing_time);
    CREATE INDEX IF NOT EXISTS idx_games_weight ON games(average_weight);
  `);
}

// ─── Query Helpers ───

export interface GameRow {
  id: number;
  bgg_id: number | null;
  name: string;
  yearpublished: number | null;
  min_players: number;
  max_players: number;
  playing_time: number;
  min_play_time: number;
  max_play_time: number;
  min_age: number;
  average_weight: number;
  thumbnail: string | null;
  image: string | null;
  categories: string;
  mechanics: string;
  owned: number;
  shelf_location: string | null;
  last_played: string | null;
  favorite: number;
  notes: string | null;
  tags: string;
  created_at: string;
  updated_at: string;
}

import type { Game } from "@/types/game";

export function rowToGame(row: GameRow): Game {
  return {
    id: row.id,
    bggId: row.bgg_id,
    name: row.name,
    yearpublished: row.yearpublished,
    minPlayers: row.min_players,
    maxPlayers: row.max_players,
    playingTime: row.playing_time,
    minPlayTime: row.min_play_time,
    maxPlayTime: row.max_play_time,
    minAge: row.min_age,
    averageWeight: row.average_weight,
    thumbnail: row.thumbnail,
    image: row.image,
    categories: row.categories,
    mechanics: row.mechanics,
    owned: row.owned === 1,
    shelfLocation: row.shelf_location,
    lastPlayed: row.last_played,
    favorite: row.favorite === 1,
    notes: row.notes,
    tags: row.tags,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getAllGames(): Game[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM games WHERE owned = 1 ORDER BY name").all() as GameRow[];
  return rows.map(rowToGame);
}

export function getGameById(id: number): Game | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM games WHERE id = ?").get(id) as GameRow | undefined;
  return row ? rowToGame(row) : null;
}

export function createGame(data: {
  bggId?: number | null;
  name: string;
  yearpublished?: number | null;
  minPlayers: number;
  maxPlayers: number;
  playingTime: number;
  minPlayTime?: number;
  maxPlayTime?: number;
  minAge?: number;
  averageWeight?: number;
  thumbnail?: string | null;
  image?: string | null;
  categories?: string[];
  mechanics?: string[];
  owned?: boolean;
  shelfLocation?: string | null;
  favorite?: boolean;
  notes?: string | null;
  tags?: string[];
}): Game {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO games (
      bgg_id, name, yearpublished, min_players, max_players,
      playing_time, min_play_time, max_play_time, min_age, average_weight,
      thumbnail, image, categories, mechanics,
      owned, shelf_location, favorite, notes, tags
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?
    )
  `);

  const result = stmt.run(
    data.bggId ?? null,
    data.name,
    data.yearpublished ?? null,
    data.minPlayers,
    data.maxPlayers,
    data.playingTime,
    data.minPlayTime ?? data.playingTime,
    data.maxPlayTime ?? data.playingTime,
    data.minAge ?? 0,
    data.averageWeight ?? 2.0,
    data.thumbnail ?? null,
    data.image ?? null,
    JSON.stringify(data.categories ?? []),
    JSON.stringify(data.mechanics ?? []),
    data.owned !== false ? 1 : 0,
    data.shelfLocation ?? null,
    data.favorite ? 1 : 0,
    data.notes ?? null,
    JSON.stringify(data.tags ?? []),
  );

  return getGameById(Number(result.lastInsertRowid))!;
}

export function updateGame(id: number, data: Record<string, unknown>): Game | null {
  const db = getDb();

  const fieldMap: Record<string, string> = {
    bggId: "bgg_id",
    name: "name",
    yearpublished: "yearpublished",
    minPlayers: "min_players",
    maxPlayers: "max_players",
    playingTime: "playing_time",
    minPlayTime: "min_play_time",
    maxPlayTime: "max_play_time",
    minAge: "min_age",
    averageWeight: "average_weight",
    thumbnail: "thumbnail",
    image: "image",
    categories: "categories",
    mechanics: "mechanics",
    owned: "owned",
    shelfLocation: "shelf_location",
    lastPlayed: "last_played",
    favorite: "favorite",
    notes: "notes",
    tags: "tags",
  };

  const sets: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(data)) {
    const col = fieldMap[key];
    if (!col) continue;

    let dbValue = value;
    if (key === "categories" || key === "mechanics" || key === "tags") {
      dbValue = JSON.stringify(value);
    } else if (key === "owned" || key === "favorite") {
      dbValue = value ? 1 : 0;
    }

    sets.push(`${col} = ?`);
    values.push(dbValue);
  }

  if (sets.length === 0) return getGameById(id);

  sets.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE games SET ${sets.join(", ")} WHERE id = ?`).run(...values);
  return getGameById(id);
}

export function deleteGame(id: number): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM games WHERE id = ?").run(id);
  return result.changes > 0;
}

export function getGameCount(): number {
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) as count FROM games WHERE owned = 1").get() as { count: number };
  return row.count;
}
