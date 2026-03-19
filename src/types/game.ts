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
  bggRating: number | null;  // BGG average rating (1.0–10.0)
  bggRank: number | null;    // BGG overall board game rank
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

// ─── Game Mechanics ───

export const COMMON_MECHANICS: { value: string; label: string }[] = [
  { value: "Worker Placement", label: "Worker Placement" },
  { value: "Deck, Bag, and Pool Building", label: "Deckbau" },
  { value: "Area Majority / Influence", label: "Gebietskontrolle" },
  { value: "Dice Rolling", label: "Würfeln" },
  { value: "Hand Management", label: "Handmanagement" },
  { value: "Set Collection", label: "Set Collection" },
  { value: "Tile Placement", label: "Plättchen legen" },
  { value: "Drafting", label: "Drafting" },
  { value: "Cooperative Game", label: "Kooperativ" },
  { value: "Engine Building", label: "Engine Building" },
  { value: "Route/Network Building", label: "Streckenbau" },
  { value: "Trading", label: "Handeln" },
  { value: "Auction/Bidding", label: "Auktion/Bieten" },
  { value: "Variable Player Powers", label: "Spielerfähigkeiten" },
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
  bggRating: number | null;
  bggRank: number | null;
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
  tags?: string[];
  mechanics?: string[];
  neverPlayed?: boolean;
  longNotPlayed?: boolean;       // >30 days since last play
  sortBy?: "name" | "lastPlayed";
  sortDirection?: "asc" | "desc"; // for lastPlayed sorting
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

// ─── Play Groups ───

export interface Player {
  id: number;
  name: string;
  maxComplexity?: number; // optional preference
  preferredDuration?: number; // optional preference in minutes
}

export interface PlayGroup {
  id: number;
  name: string;
  playerIds: number[];
  createdAt: string;
  updatedAt: string;
}

// ─── Play Sessions ───

export interface PlaySession {
  id: number;
  gameId: number;
  playedAt: string; // ISO date string (YYYY-MM-DD)
  playerCount: number;
  duration: number; // minutes
  winnerId: number | null; // Player id
  notes: string | null;
  createdAt: string;
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
  bggRating?: number | null;
  bggRank?: number | null;
  owned?: boolean;
  shelfLocation?: string | null;
  favorite?: boolean;
  notes?: string | null;
  tags?: string[];
}

export interface UpdateGameInput extends Partial<CreateGameInput> {
  lastPlayed?: string | null;
}

// ─── Chat Messages (RegelGuru) ───

export interface ChatMessage {
  id: number;
  gameId: number;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
}

// ─── BGG Search Types ───

export interface BggSearchResult {
  bggId: number;
  name: string;
  yearpublished: number | null;
}
