"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  getAllGames,
  getAllPlayers,
  getAllPlayGroups,
  getAllGameNights,
  createGameNight,
  updateGameNight,
  deleteGameNight,
} from "@/lib/db-client";
import type { Game, Player, PlayGroup, GameNight } from "@/types/game";

type View = "list" | "create" | "detail";

export default function GameNightPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [playGroups, setPlayGroups] = useState<PlayGroup[]>([]);
  const [gameNights, setGameNights] = useState<GameNight[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("list");
  const [selectedNight, setSelectedNight] = useState<GameNight | null>(null);
  const [copied, setCopied] = useState(false);

  // Create form state
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("19:00");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<number[]>([]);
  const [selectedGameIds, setSelectedGameIds] = useState<number[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    const [g, p, pg, gn] = await Promise.all([
      getAllGames(),
      getAllPlayers(),
      getAllPlayGroups(),
      getAllGameNights(),
    ]);
    setGames(g);
    setPlayers(p);
    setPlayGroups(pg);
    setGameNights(gn);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetForm = () => {
    setName("");
    setDate("");
    setTime("19:00");
    setSelectedPlayerIds([]);
    setSelectedGameIds([]);
    setSelectedGroupId(null);
  };

  const handleCreate = async () => {
    if (!name.trim() || !date) return;
    const dateTime = `${date}T${time}`;
    await createGameNight({
      name: name.trim(),
      date: dateTime,
      playerIds: selectedPlayerIds,
      gameIds: selectedGameIds,
    });
    resetForm();
    await loadData();
    setView("list");
  };

  const handleDelete = async (id: number) => {
    await deleteGameNight(id);
    if (selectedNight?.id === id) {
      setSelectedNight(null);
      setView("list");
    }
    await loadData();
  };

  const handleToggleGame = async (gameId: number) => {
    if (!selectedNight) return;
    const newIds = selectedNight.gameIds.includes(gameId)
      ? selectedNight.gameIds.filter((id) => id !== gameId)
      : [...selectedNight.gameIds, gameId];
    const updated = await updateGameNight(selectedNight.id, { gameIds: newIds });
    if (updated) {
      setSelectedNight(updated);
      setGameNights((prev) =>
        prev.map((gn) => (gn.id === updated.id ? updated : gn))
      );
    }
  };

  const handleSelectGroup = (groupId: number | null) => {
    setSelectedGroupId(groupId);
    if (groupId != null) {
      const group = playGroups.find((g) => g.id === groupId);
      if (group) setSelectedPlayerIds(group.playerIds);
    }
  };

  const playerCount = selectedNight
    ? selectedNight.playerIds.length
    : selectedPlayerIds.length;

  const fittingGames = games.filter(
    (g) => playerCount === 0 || (g.minPlayers <= playerCount && g.maxPlayers >= playerCount)
  );

  const generateShareText = (night: GameNight): string => {
    const d = new Date(night.date);
    const dateStr = d.toLocaleDateString("de-DE", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    const timeStr = d.toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const gameNames = night.gameIds
      .map((id) => games.find((g) => g.id === id)?.name)
      .filter(Boolean);
    const gameList =
      gameNames.length > 0 ? gameNames.join(", ") : "noch keine Spiele";
    return `Spieleabend "${night.name}" am ${dateStr} um ${timeStr}! Folgende Spiele sind dabei: ${gameList}`;
  };

  const handleShare = async (night: GameNight) => {
    const text = generateShareText(night);
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        // fallback to clipboard
      }
    }
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  // ─── Detail View ───
  if (view === "detail" && selectedNight) {
    const nightGames = games.filter((g) =>
      selectedNight.gameIds.includes(g.id)
    );
    const nightPlayers = players.filter((p) =>
      selectedNight.playerIds.includes(p.id)
    );
    const nightPlayerCount = nightPlayers.length;
    const availableGames = games.filter(
      (g) =>
        nightPlayerCount === 0 ||
        (g.minPlayers <= nightPlayerCount && g.maxPlayers >= nightPlayerCount)
    );

    return (
      <div>
        <button
          onClick={() => {
            setView("list");
            setSelectedNight(null);
          }}
          className="mb-4 flex items-center gap-1.5 text-sm font-medium text-warm-500 transition-colors hover:text-warm-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Alle Spieleabende
        </button>

        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-warm-900">
              {selectedNight.name}
            </h1>
            <p className="mt-1 text-sm font-medium text-warm-500">
              {new Date(selectedNight.date).toLocaleDateString("de-DE", {
                weekday: "long",
                day: "numeric",
                month: "long",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          <button
            onClick={() => handleShare(selectedNight)}
            className="flex-shrink-0 rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-forest-dark active:scale-[0.98]"
            data-testid="share-button"
          >
            {copied ? "Kopiert!" : "Teilen"}
          </button>
        </div>

        {/* Players */}
        {nightPlayers.length > 0 && (
          <div className="mt-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-warm-500">
              Spieler ({nightPlayers.length})
            </h2>
            <div className="flex flex-wrap gap-2">
              {nightPlayers.map((p) => (
                <span
                  key={p.id}
                  className="rounded-lg bg-warm-100 px-3 py-1.5 text-sm font-medium text-warm-700"
                >
                  {p.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Selected games summary */}
        <div className="mt-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-warm-500">
            Diese Spiele sind dabei ({nightGames.length})
          </h2>
          {nightGames.length === 0 ? (
            <p className="text-sm text-warm-400">
              Noch keine Spiele markiert. Markiere unten Spiele mit &quot;Bring ich mit&quot;.
            </p>
          ) : (
            <div className="space-y-2">
              {nightGames.map((g) => (
                <div
                  key={g.id}
                  className="flex items-center justify-between rounded-xl border border-forest/20 bg-forest/5 p-3"
                >
                  <div className="flex items-center gap-3">
                    {g.thumbnail && (
                      <img
                        src={g.thumbnail}
                        alt=""
                        className="h-10 w-10 rounded-lg object-cover"
                      />
                    )}
                    <div>
                      <p className="text-sm font-semibold text-warm-900">
                        {g.name}
                      </p>
                      <p className="text-xs text-warm-500">
                        {g.minPlayers}-{g.maxPlayers} Spieler &middot;{" "}
                        {g.playingTime} Min
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleGame(g.id)}
                    className="rounded-lg bg-coral/10 px-3 py-1.5 text-xs font-semibold text-coral transition-colors hover:bg-coral/20"
                  >
                    Entfernen
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Available games to bring */}
        <div className="mt-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-warm-500">
            Spiele ausw&auml;hlen
            {nightPlayerCount > 0 && (
              <span className="ml-1 normal-case text-warm-400">
                (passend f&uuml;r {nightPlayerCount} Spieler)
              </span>
            )}
          </h2>
          <div className="space-y-2">
            {availableGames
              .filter((g) => !selectedNight.gameIds.includes(g.id))
              .map((g) => (
                <div
                  key={g.id}
                  className="flex items-center justify-between rounded-xl border border-warm-200/80 bg-surface p-3 dark:border-warm-700/30"
                >
                  <div className="flex items-center gap-3">
                    {g.thumbnail && (
                      <img
                        src={g.thumbnail}
                        alt=""
                        className="h-10 w-10 rounded-lg object-cover"
                      />
                    )}
                    <div>
                      <p className="text-sm font-semibold text-warm-900">
                        {g.name}
                      </p>
                      <p className="text-xs text-warm-500">
                        {g.minPlayers}-{g.maxPlayers} Spieler &middot;{" "}
                        {g.playingTime} Min
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleGame(g.id)}
                    className="rounded-lg bg-forest/10 px-3 py-1.5 text-xs font-semibold text-forest transition-colors hover:bg-forest/20"
                    data-testid={`bring-game-${g.id}`}
                  >
                    Bring ich mit
                  </button>
                </div>
              ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Create View ───
  if (view === "create") {
    return (
      <div>
        <button
          onClick={() => {
            setView("list");
            resetForm();
          }}
          className="mb-4 flex items-center gap-1.5 text-sm font-medium text-warm-500 transition-colors hover:text-warm-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Abbrechen
        </button>

        <h1 className="font-display text-3xl font-bold tracking-tight text-warm-900">
          Spieleabend erstellen
        </h1>

        <div className="mt-6 space-y-5">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-warm-500">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Freitag Spieleabend"
              className="w-full rounded-xl border border-warm-200 bg-warm-50/50 px-3 py-2.5 text-sm font-medium text-warm-800 transition-colors focus:border-forest focus:bg-surface focus:outline-none focus:ring-2 focus:ring-forest/10"
              data-testid="night-name-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-warm-500">
                Datum
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-warm-200 bg-warm-50/50 px-3 py-2.5 text-sm font-medium text-warm-800 transition-colors focus:border-forest focus:bg-surface focus:outline-none focus:ring-2 focus:ring-forest/10"
                data-testid="night-date-input"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-warm-500">
                Uhrzeit
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-xl border border-warm-200 bg-warm-50/50 px-3 py-2.5 text-sm font-medium text-warm-800 transition-colors focus:border-forest focus:bg-surface focus:outline-none focus:ring-2 focus:ring-forest/10"
                data-testid="night-time-input"
              />
            </div>
          </div>

          {/* Group selector */}
          {playGroups.length > 0 && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-warm-500">
                Spielgruppe einladen
              </label>
              <select
                value={selectedGroupId ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  handleSelectGroup(val ? Number(val) : null);
                }}
                className="w-full rounded-xl border border-warm-200 bg-warm-50/50 px-3 py-2.5 text-sm font-medium text-warm-800 transition-colors focus:border-forest focus:bg-surface focus:outline-none focus:ring-2 focus:ring-forest/10"
                data-testid="group-select"
              >
                <option value="">Manuell w&auml;hlen...</option>
                {playGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.playerIds.length} Spieler)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Player selection */}
          {players.length > 0 && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-warm-500">
                Spieler ({selectedPlayerIds.length} ausgew&auml;hlt)
              </label>
              <div className="flex flex-wrap gap-2">
                {players.map((p) => {
                  const selected = selectedPlayerIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() =>
                        setSelectedPlayerIds((prev) =>
                          selected
                            ? prev.filter((id) => id !== p.id)
                            : [...prev, p.id]
                        )
                      }
                      className={`rounded-xl px-3 py-2 text-sm font-semibold transition-all ${
                        selected
                          ? "bg-forest text-white"
                          : "bg-warm-100 text-warm-600 hover:bg-warm-200"
                      }`}
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Game selection */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-warm-500">
              Spiele mitbringen ({selectedGameIds.length} ausgew&auml;hlt)
              {playerCount > 0 && (
                <span className="ml-1 normal-case text-warm-400">
                  &mdash; passend f&uuml;r {playerCount} Spieler
                </span>
              )}
            </label>
            <div className="space-y-2">
              {fittingGames.map((g) => {
                const selected = selectedGameIds.includes(g.id);
                return (
                  <button
                    key={g.id}
                    onClick={() =>
                      setSelectedGameIds((prev) =>
                        selected
                          ? prev.filter((id) => id !== g.id)
                          : [...prev, g.id]
                      )
                    }
                    className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                      selected
                        ? "border-forest/30 bg-forest/5"
                        : "border-warm-200/80 bg-surface hover:border-warm-300 dark:border-warm-700/30"
                    }`}
                  >
                    {g.thumbnail && (
                      <img
                        src={g.thumbnail}
                        alt=""
                        className="h-10 w-10 rounded-lg object-cover"
                      />
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-warm-900">
                        {g.name}
                      </p>
                      <p className="text-xs text-warm-500">
                        {g.minPlayers}-{g.maxPlayers} Spieler &middot;{" "}
                        {g.playingTime} Min
                      </p>
                    </div>
                    <span
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                        selected
                          ? "bg-forest text-white"
                          : "bg-warm-100 text-warm-500"
                      }`}
                    >
                      {selected ? "Dabei!" : "Bring ich mit"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={!name.trim() || !date}
            className="w-full rounded-xl bg-forest px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-forest-dark hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:hover:bg-forest"
            data-testid="create-night-button"
          >
            Spieleabend erstellen
          </button>
        </div>
      </div>
    );
  }

  // ─── List View ───
  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-warm-900">
            Spieleabende
          </h1>
          <p className="mt-1 text-sm font-medium text-warm-500">
            Plane deinen n&auml;chsten Spieleabend
          </p>
        </div>
        <button
          onClick={() => setView("create")}
          className="flex-shrink-0 rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-forest-dark active:scale-[0.98]"
          data-testid="new-night-button"
        >
          + Neuer Abend
        </button>
      </div>

      {gameNights.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-warm-200/80 bg-surface p-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-warm-100">
            <svg
              className="h-7 w-7 text-warm-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <p className="mt-4 font-display text-lg font-semibold text-warm-700">
            Noch keine Spieleabende
          </p>
          <p className="mt-2 text-sm text-warm-500">
            Erstelle deinen ersten Spieleabend und lade deine Freunde ein!
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {gameNights.map((night) => {
            const nightDate = new Date(night.date);
            const isUpcoming = nightDate >= new Date();
            const nightGames = games.filter((g) =>
              night.gameIds.includes(g.id)
            );
            const nightPlayers = players.filter((p) =>
              night.playerIds.includes(p.id)
            );

            return (
              <div
                key={night.id}
                className={`rounded-2xl border p-4 transition-all ${
                  isUpcoming
                    ? "border-forest/20 bg-forest/5"
                    : "border-warm-200/80 bg-surface dark:border-warm-700/30"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    onClick={() => {
                      setSelectedNight(night);
                      setView("detail");
                    }}
                    className="text-left"
                    data-testid={`night-${night.id}`}
                  >
                    <h3 className="font-display text-lg font-bold text-warm-900">
                      {night.name}
                    </h3>
                    <p className="mt-0.5 text-sm text-warm-500">
                      {nightDate.toLocaleDateString("de-DE", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleShare(night)}
                      className="rounded-lg bg-forest/10 px-3 py-1.5 text-xs font-semibold text-forest transition-colors hover:bg-forest/20"
                    >
                      Teilen
                    </button>
                    <button
                      onClick={() => handleDelete(night.id)}
                      className="rounded-lg bg-coral/10 px-3 py-1.5 text-xs font-semibold text-coral transition-colors hover:bg-coral/20"
                      data-testid={`delete-night-${night.id}`}
                    >
                      L&ouml;schen
                    </button>
                  </div>
                </div>

                {(nightPlayers.length > 0 || nightGames.length > 0) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {nightPlayers.length > 0 && (
                      <span className="text-xs text-warm-500">
                        {nightPlayers.length} Spieler
                      </span>
                    )}
                    {nightGames.length > 0 && (
                      <span className="text-xs text-warm-500">
                        &middot; {nightGames.length} Spiele
                      </span>
                    )}
                  </div>
                )}

                {nightGames.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {nightGames.slice(0, 5).map((g) => (
                      <span
                        key={g.id}
                        className="rounded-lg bg-warm-100 px-2 py-1 text-xs font-medium text-warm-600 dark:bg-warm-800/50 dark:text-warm-400"
                      >
                        {g.name}
                      </span>
                    ))}
                    {nightGames.length > 5 && (
                      <span className="rounded-lg bg-warm-100 px-2 py-1 text-xs font-medium text-warm-400">
                        +{nightGames.length - 5}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
