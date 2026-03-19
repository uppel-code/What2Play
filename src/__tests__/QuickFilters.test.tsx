import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import QuickFilters from "@/components/QuickFilters";
import type { GameFilters } from "@/types/game";

describe("QuickFilters", () => {
  const emptyFilters: GameFilters = {};

  it("renders all six filter chips", () => {
    render(<QuickFilters filters={emptyFilters} onChange={() => {}} />);

    expect(screen.getByText("2 Spieler")).toBeInTheDocument();
    expect(screen.getByText("Schnell")).toBeInTheDocument();
    expect(screen.getByText("Party")).toBeInTheDocument();
    expect(screen.getByText("Einfach")).toBeInTheDocument();
    expect(screen.getByText("Kennerspiel")).toBeInTheDocument();
    expect(screen.getByText("Verstaubt")).toBeInTheDocument();
  });

  it("activates a filter on click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<QuickFilters filters={emptyFilters} onChange={onChange} />);

    await user.click(screen.getByText("2 Spieler"));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ playerCount: 2 })
    );
  });

  it("deactivates an active filter on click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const activeFilters: GameFilters = { playerCount: 2 };

    render(<QuickFilters filters={activeFilters} onChange={onChange} />);

    await user.click(screen.getByText("2 Spieler"));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ playerCount: undefined })
    );
  });

  it("applies quick filter correctly", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<QuickFilters filters={emptyFilters} onChange={onChange} />);

    await user.click(screen.getByText("Schnell"));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ maxDuration: 30 })
    );
  });

  it("applies complexity filter", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<QuickFilters filters={emptyFilters} onChange={onChange} />);

    await user.click(screen.getByText("Einfach"));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ maxComplexity: 2.0 })
    );
  });

  it("applies expert filter", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<QuickFilters filters={emptyFilters} onChange={onChange} />);

    await user.click(screen.getByText("Kennerspiel"));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ minComplexity: 3.0 })
    );
  });

  it("applies never-played filter", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<QuickFilters filters={emptyFilters} onChange={onChange} />);

    await user.click(screen.getByText("Verstaubt"));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ neverPlayed: true })
    );
  });

  it("deactivates conflicting filter when activating another", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    // "2-players" is active (playerCount: 2)
    const filters: GameFilters = { playerCount: 2 };

    render(<QuickFilters filters={filters} onChange={onChange} />);

    // Clicking "Party" should remove "2-players" and apply playerCount: 5
    await user.click(screen.getByText("Party"));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ playerCount: 5 })
    );
  });

  it("deactivates conflicting complexity filters", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    // "easy" is active
    const filters: GameFilters = { maxComplexity: 2.0 };

    render(<QuickFilters filters={filters} onChange={onChange} />);

    // Clicking "expert" should remove easy and apply expert
    await user.click(screen.getByText("Kennerspiel"));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ minComplexity: 3.0, maxComplexity: undefined })
    );
  });

  it("shows active styling for active filters", () => {
    const filters: GameFilters = { playerCount: 2 };
    render(<QuickFilters filters={filters} onChange={() => {}} />);

    const button = screen.getByText("2 Spieler").closest("button");
    expect(button?.className).toContain("bg-forest");
  });

  it("shows inactive styling for inactive filters", () => {
    render(<QuickFilters filters={emptyFilters} onChange={() => {}} />);

    const button = screen.getByText("Schnell").closest("button");
    expect(button?.className).toContain("bg-surface");
  });
});
