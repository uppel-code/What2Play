import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RandomPicker from "@/components/RandomPicker";
import type { Game } from "@/types/game";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    id: 1,
    bggId: 13,
    name: "Catan",
    yearpublished: 1995,
    minPlayers: 3,
    maxPlayers: 4,
    playingTime: 90,
    minPlayTime: 60,
    maxPlayTime: 120,
    minAge: 10,
    averageWeight: 2.3,
    thumbnail: null,
    image: null,
    categories: [],
    mechanics: [],
    bggRating: 7.2,
    bggRank: 400,
    owned: true,
    shelfLocation: null,
    lastPlayed: null,
    favorite: false,
    notes: null,
    tags: [],
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

const games: Game[] = [
  makeGame({ id: 1, name: "Catan" }),
  makeGame({ id: 2, name: "Azul" }),
  makeGame({ id: 3, name: "Wingspan" }),
];

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  mockPush.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("RandomPicker", () => {
  it("renders nothing when games array is empty", () => {
    const { container } = render(<RandomPicker games={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders the spin button when games exist", () => {
    render(<RandomPicker games={games} />);
    expect(screen.getByText("Überrasch mich!")).toBeInTheDocument();
  });

  it("opens modal and starts spinning on click", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<RandomPicker games={games} />);

    await user.click(screen.getByText("Überrasch mich!"));

    // Modal should be open - dice emoji visible during spin
    expect(screen.getByText("🎲")).toBeInTheDocument();
  });

  it("shows a game name after spin completes", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<RandomPicker games={games} />);

    await user.click(screen.getByText("Überrasch mich!"));

    // Advance past the total spin duration (2400ms + buffer)
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    // After spin, one of the game names should be visible
    const gameNames = games.map((g) => g.name);
    const foundName = gameNames.some((name) =>
      screen.queryByText(name) !== null
    );
    expect(foundName).toBe(true);
  });

  it("shows action buttons after spin completes", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<RandomPicker games={games} />);

    await user.click(screen.getByText("Überrasch mich!"));

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByText("Spielen!")).toBeInTheDocument();
    expect(screen.getByText("Nochmal!")).toBeInTheDocument();
  });

  it("navigates to game page when 'Spielen!' is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<RandomPicker games={games} />);

    await user.click(screen.getByText("Überrasch mich!"));

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    await user.click(screen.getByText("Spielen!"));
    expect(mockPush).toHaveBeenCalledWith(expect.stringMatching(/\/game\?id=\d+/));
  });

  it("re-spins when 'Nochmal!' is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<RandomPicker games={games} />);

    await user.click(screen.getByText("Überrasch mich!"));

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    // Click "Nochmal!" to spin again
    await user.click(screen.getByText("Nochmal!"));

    // Should be spinning again
    expect(screen.getByText("🎲")).toBeInTheDocument();
  });

  it("displays game metadata chips", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<RandomPicker games={[makeGame({ averageWeight: 2.3 })]} />);

    await user.click(screen.getByText("Überrasch mich!"));

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    // Check metadata is rendered
    expect(screen.getByText(/Spieler/)).toBeInTheDocument();
    expect(screen.getByText("90 Min")).toBeInTheDocument();
    expect(screen.getByText("Einfach")).toBeInTheDocument();
  });

  it("shows complexity labels correctly", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    // Test with high weight
    render(<RandomPicker games={[makeGame({ averageWeight: 4.2 })]} />);

    await user.click(screen.getByText("Überrasch mich!"));

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByText("Schwer")).toBeInTheDocument();
  });

  it("works with single game", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const singleGame = [makeGame({ id: 1, name: "Solo Game" })];

    render(<RandomPicker games={singleGame} />);

    await user.click(screen.getByText("Überrasch mich!"));

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByText("Solo Game")).toBeInTheDocument();
  });
});
