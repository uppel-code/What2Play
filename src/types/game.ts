// ─── BGG Metadata (external, immutable) ───

export interface BggGameData {
  bggId: number;
  name: string;
  yearpublished: number | null;
  minPlayers: number;
  maxPlayers: number;
  playingTime: number;
  minPlayTime: number;
  maxPlayTime: number;
  minAge: number;
  averageWeight: number; // complexity 1.0–5.0
  thumbnail: string | null;
  image: string | null;
  categories: string[];
  mechanics: string[];
}

// ─── User Ownership Data ───

export interface OwnershipData {
  owned: boolean;
  shelfLocation: string | null;
  lastPlayed: string | null; // ISO date string
  favorite: boolean;
}

// ─── User Tags & Notes ───

export type PredefinedTag =
  | "good-with-newcomers"
  | "good-for-two"
  | "quick-to-explain"
  | "favorite"
  | "party-game"
  | "expert-game";

export const PREDEFINED_TAGS: { value: PredefinedTag; label: string }[] = [
  { value: "good-with-newcomers", label: "Gut mit Neulingen" },
  { value: "good-for-two", label: "Gut zu zweit" },
  { value: "quick-to-explain", label: "Schnell erklärt" },
  { value: "favorite", label: "Lieblingsspiel" },
  { value: "party-game", label: "Partyspiel" },
  { value: "expert-game", label: "Kennerspiel" },
];

export interface UserGameMeta {
  notes: string | null;
  tags: string[]; // PredefinedTag or custom strings
}

// ─── Combined Game (what the UI works with) ───

export interface Game {
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
  // Ownership
  owned: boolean;
  shelfLocation: string | null;
  lastPlayed: string | null;
  favorite: boolean;
  // User meta
  notes: string | null;
  tags: string[];
  // Timestamps
  createdAt: string;
  updatedAt: string;
}


// ─── Filter & Recommendation Types ───

export interface GameFilters {
  search?: string;
  playerCount?: number;
  maxDuration?: number;
  minComplexity?: number;
  maxComplexity?: number;
  minAge?: number;
}

export interface TodayPlayParams {
  playerCount: number;
  availableTime: number;       // minutes
  desiredComplexity: number;   // 1.0–5.0
  preferNewcomers?: boolean;
}

export interface ScoredGame extends Game {
  score: number;
  scoreBreakdown: ScoreBreakdown;
}

export interface ScoreBreakdown {
  playerFit: number;
  timeFit: number;
  complexityFit: number;
  favoriteBonus: number;
  lastPlayedBonus: number;
  tagBonus: number;
}

// ─── API Types ───

export interface CreateGameInput {
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
}

export interface UpdateGameInput extends Partial<CreateGameInput> {
  lastPlayed?: string | null;
}

// ─── BGG Search Types ───

export interface BggSearchResult {
  bggId: number;
  name: string;
  yearpublished: number | null;
}
