"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { Player, PlayGroup } from "@/types/game";
import {
  getAllPlayers,
  createPlayer,
  deletePlayer,
  getAllPlayGroups,
  createPlayGroup,
  updatePlayGroup,
  deletePlayGroup,
} from "@/lib/db-client";

export default function GroupsPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [groups, setGroups] = useState<PlayGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"groups" | "players">("groups");

  // New player form
  const [newPlayerName, setNewPlayerName] = useState("");
  const [addingPlayer, setAddingPlayer] = useState(false);

  // New group form
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<number[]>([]);
  const [addingGroup, setAddingGroup] = useState(false);

  // Edit group
  const [editingGroup, setEditingGroup] = useState<PlayGroup | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [p, g] = await Promise.all([getAllPlayers(), getAllPlayGroups()]);
      setPlayers(p);
      setGroups(g);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleAddPlayer() {
    if (!newPlayerName.trim()) return;
    setAddingPlayer(true);
    try {
      await createPlayer(newPlayerName.trim());
      setNewPlayerName("");
      await loadData();
    } finally {
      setAddingPlayer(false);
    }
  }

  async function handleDeletePlayer(id: number, name: string) {
    if (!window.confirm(`"${name}" wirklich löschen?`)) return;
    await deletePlayer(id);
    await loadData();
  }

  async function handleAddGroup() {
    if (!newGroupName.trim()) return;
    setAddingGroup(true);
    try {
      await createPlayGroup(newGroupName.trim(), selectedPlayerIds);
      setNewGroupName("");
      setSelectedPlayerIds([]);
      await loadData();
    } finally {
      setAddingGroup(false);
    }
  }

  async function handleUpdateGroup() {
    if (!editingGroup) return;
    await updatePlayGroup(editingGroup.id, {
      name: editingGroup.name,
      playerIds: editingGroup.playerIds,
    });
    setEditingGroup(null);
    await loadData();
  }

  async function handleDeleteGroup(id: number, name: string) {
    if (!window.confirm(`Gruppe "${name}" wirklich löschen?`)) return;
    await deletePlayGroup(id);
    await loadData();
  }

  function togglePlayerInGroup(playerId: number) {
    if (editingGroup) {
      const newIds = editingGroup.playerIds.includes(playerId)
        ? editingGroup.playerIds.filter((id) => id !== playerId)
        : [...editingGroup.playerIds, playerId];
      setEditingGroup({ ...editingGroup, playerIds: newIds });
    } else {
      setSelectedPlayerIds((prev) =>
        prev.includes(playerId) ? prev.filter((id) => id !== playerId) : [...prev, playerId]
      );
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-warm-900">Spielgruppen</h1>
          <p className="mt-1 text-sm font-medium text-warm-500">Verwalte Spieler und Gruppen</p>
        </div>
        <Link
          href="/"
          className="rounded-xl bg-warm-100 px-4 py-2 text-sm font-medium text-warm-600 transition-colors hover:bg-warm-200"
        >
          Zurück
        </Link>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-1 rounded-2xl bg-warm-100 p-1">
        <button
          onClick={() => setActiveTab("groups")}
          className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
            activeTab === "groups"
              ? "bg-white text-warm-900 shadow-sm"
              : "text-warm-500 hover:text-warm-700"
          }`}
        >
          Gruppen ({groups.length})
        </button>
        <button
          onClick={() => setActiveTab("players")}
          className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
            activeTab === "players"
              ? "bg-white text-warm-900 shadow-sm"
              : "text-warm-500 hover:text-warm-700"
          }`}
        >
          Spieler ({players.length})
        </button>
      </div>

      {activeTab === "players" && (
        <div className="space-y-4">
          {/* Add player form */}
          <div className="rounded-2xl border border-warm-200/80 bg-white p-5">
            <h3 className="font-display text-lg font-bold text-warm-900 mb-3">Neuer Spieler</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddPlayer()}
                placeholder="Name eingeben..."
                className="flex-1 rounded-xl border border-warm-200 bg-warm-50/50 px-3.5 py-2.5 text-sm text-warm-800 placeholder:text-warm-400 focus:border-forest focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest/10"
              />
              <button
                onClick={handleAddPlayer}
                disabled={addingPlayer || !newPlayerName.trim()}
                className="rounded-xl bg-forest px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-forest-dark disabled:opacity-50"
              >
                {addingPlayer ? "..." : "Hinzufügen"}
              </button>
            </div>
          </div>

          {/* Players list */}
          <div className="rounded-2xl border border-warm-200/80 bg-white overflow-hidden">
            {players.length === 0 ? (
              <div className="p-8 text-center text-sm text-warm-500">
                Noch keine Spieler angelegt
              </div>
            ) : (
              <div className="divide-y divide-warm-100">
                {players.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between px-5 py-3 hover:bg-warm-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-forest-light text-sm font-bold text-forest">
                        {player.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-warm-900">{player.name}</span>
                    </div>
                    <button
                      onClick={() => handleDeletePlayer(player.id, player.name)}
                      className="rounded-lg p-2 text-warm-400 transition-colors hover:bg-coral-light hover:text-coral"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "groups" && (
        <div className="space-y-4">
          {/* Add/Edit group form */}
          <div className="rounded-2xl border border-warm-200/80 bg-white p-5">
            <h3 className="font-display text-lg font-bold text-warm-900 mb-3">
              {editingGroup ? "Gruppe bearbeiten" : "Neue Gruppe"}
            </h3>
            
            <input
              type="text"
              value={editingGroup ? editingGroup.name : newGroupName}
              onChange={(e) =>
                editingGroup
                  ? setEditingGroup({ ...editingGroup, name: e.target.value })
                  : setNewGroupName(e.target.value)
              }
              placeholder="Gruppenname..."
              className="w-full rounded-xl border border-warm-200 bg-warm-50/50 px-3.5 py-2.5 text-sm text-warm-800 placeholder:text-warm-400 focus:border-forest focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest/10 mb-3"
            />

            {players.length > 0 ? (
              <>
                <p className="text-xs font-medium text-warm-500 mb-2">Spieler auswählen:</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {players.map((player) => {
                    const isSelected = editingGroup
                      ? editingGroup.playerIds.includes(player.id)
                      : selectedPlayerIds.includes(player.id);
                    return (
                      <button
                        key={player.id}
                        onClick={() => togglePlayerInGroup(player.id)}
                        className={`rounded-xl px-3 py-1.5 text-sm font-medium transition-all ${
                          isSelected
                            ? "bg-forest text-white"
                            : "bg-warm-100 text-warm-600 hover:bg-warm-200"
                        }`}
                      >
                        {player.name}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="text-sm text-warm-500 mb-4">
                Erstelle zuerst Spieler im Tab &quot;Spieler&quot;
              </p>
            )}

            <div className="flex gap-2">
              {editingGroup ? (
                <>
                  <button
                    onClick={handleUpdateGroup}
                    className="rounded-xl bg-forest px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-forest-dark"
                  >
                    Speichern
                  </button>
                  <button
                    onClick={() => setEditingGroup(null)}
                    className="rounded-xl bg-warm-100 px-5 py-2.5 text-sm font-medium text-warm-600 transition-colors hover:bg-warm-200"
                  >
                    Abbrechen
                  </button>
                </>
              ) : (
                <button
                  onClick={handleAddGroup}
                  disabled={addingGroup || !newGroupName.trim()}
                  className="rounded-xl bg-forest px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-forest-dark disabled:opacity-50"
                >
                  {addingGroup ? "..." : "Gruppe erstellen"}
                </button>
              )}
            </div>
          </div>

          {/* Groups list */}
          <div className="space-y-3">
            {groups.length === 0 ? (
              <div className="rounded-2xl border border-warm-200/80 bg-white p-8 text-center text-sm text-warm-500">
                Noch keine Gruppen angelegt
              </div>
            ) : (
              groups.map((group) => {
                const groupPlayers = players.filter((p) => group.playerIds.includes(p.id));
                return (
                  <div
                    key={group.id}
                    className="rounded-2xl border border-warm-200/80 bg-white p-5"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-display text-lg font-bold text-warm-900">{group.name}</h4>
                        <p className="text-sm text-warm-500">{groupPlayers.length} Spieler</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingGroup(group)}
                          className="rounded-lg p-2 text-warm-400 transition-colors hover:bg-warm-100 hover:text-warm-600"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteGroup(group.id, group.name)}
                          className="rounded-lg p-2 text-warm-400 transition-colors hover:bg-coral-light hover:text-coral"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {groupPlayers.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {groupPlayers.map((player) => (
                          <span
                            key={player.id}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-forest-light px-2.5 py-1 text-xs font-medium text-forest"
                          >
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-forest text-[10px] text-white">
                              {player.name.charAt(0).toUpperCase()}
                            </span>
                            {player.name}
                          </span>
                        ))}
                      </div>
                    )}

                    <Link
                      href={`/today?players=${groupPlayers.length}`}
                      className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-forest px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-forest-dark"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Was spielen wir?
                    </Link>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
