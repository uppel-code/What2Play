import { describe, it, expect, beforeEach } from "vitest";
import Dexie from "dexie";
import {
  createGame,
  addChatMessage,
  getChatMessages,
  clearChatMessages,
  trimChatMessages,
} from "@/lib/db-client";
import type { CreateGameInput } from "@/types/game";

const sampleGame: CreateGameInput = {
  name: "Catan",
  bggId: 13,
  minPlayers: 3,
  maxPlayers: 4,
  playingTime: 90,
};

let gameId: number;

beforeEach(async () => {
  await Dexie.delete("What2PlayDB");
  const game = await createGame(sampleGame);
  gameId = game.id;
});

describe("chat history (RegelGuru)", () => {
  describe("addChatMessage", () => {
    it("stores a message in DB and returns it", async () => {
      const msg = await addChatMessage(gameId, "user", "Wie geht Catan?");

      expect(msg.id).toBeDefined();
      expect(msg.gameId).toBe(gameId);
      expect(msg.role).toBe("user");
      expect(msg.text).toBe("Wie geht Catan?");
      expect(msg.createdAt).toBeTruthy();
    });

    it("stores messages with correct roles", async () => {
      await addChatMessage(gameId, "user", "Frage");
      await addChatMessage(gameId, "assistant", "Antwort");

      const messages = await getChatMessages(gameId);
      expect(messages[0].role).toBe("user");
      expect(messages[1].role).toBe("assistant");
    });
  });

  describe("getChatMessages", () => {
    it("returns messages sorted by createdAt", async () => {
      await addChatMessage(gameId, "user", "Erste Frage");
      await addChatMessage(gameId, "assistant", "Erste Antwort");
      await addChatMessage(gameId, "user", "Zweite Frage");

      const messages = await getChatMessages(gameId);
      expect(messages).toHaveLength(3);
      expect(messages[0].text).toBe("Erste Frage");
      expect(messages[1].text).toBe("Erste Antwort");
      expect(messages[2].text).toBe("Zweite Frage");
    });

    it("returns empty array when no messages exist", async () => {
      const messages = await getChatMessages(gameId);
      expect(messages).toEqual([]);
    });

    it("only returns messages for the requested game", async () => {
      const game2 = await createGame({ ...sampleGame, name: "Azul", bggId: 230802 });
      await addChatMessage(gameId, "user", "Catan Frage");
      await addChatMessage(game2.id, "user", "Azul Frage");

      const catanMessages = await getChatMessages(gameId);
      expect(catanMessages).toHaveLength(1);
      expect(catanMessages[0].text).toBe("Catan Frage");
    });
  });

  describe("clearChatMessages", () => {
    it("deletes all messages for a game", async () => {
      await addChatMessage(gameId, "user", "Frage 1");
      await addChatMessage(gameId, "assistant", "Antwort 1");
      await addChatMessage(gameId, "user", "Frage 2");

      await clearChatMessages(gameId);

      const messages = await getChatMessages(gameId);
      expect(messages).toHaveLength(0);
    });

    it("does not affect messages of other games", async () => {
      const game2 = await createGame({ ...sampleGame, name: "Azul", bggId: 230802 });
      await addChatMessage(gameId, "user", "Catan Frage");
      await addChatMessage(game2.id, "user", "Azul Frage");

      await clearChatMessages(gameId);

      const catanMessages = await getChatMessages(gameId);
      const azulMessages = await getChatMessages(game2.id);
      expect(catanMessages).toHaveLength(0);
      expect(azulMessages).toHaveLength(1);
    });
  });

  describe("trimChatMessages", () => {
    it("keeps only the last maxMessages messages", async () => {
      // Add 12 messages
      for (let i = 1; i <= 12; i++) {
        await addChatMessage(gameId, i % 2 === 1 ? "user" : "assistant", `Nachricht ${i}`);
      }

      await trimChatMessages(gameId, 10);

      const messages = await getChatMessages(gameId);
      expect(messages).toHaveLength(10);
      // First two should be deleted (oldest)
      expect(messages[0].text).toBe("Nachricht 3");
      expect(messages[9].text).toBe("Nachricht 12");
    });

    it("does nothing when messages are within limit", async () => {
      await addChatMessage(gameId, "user", "Frage");
      await addChatMessage(gameId, "assistant", "Antwort");

      await trimChatMessages(gameId, 10);

      const messages = await getChatMessages(gameId);
      expect(messages).toHaveLength(2);
    });

    it("uses default maxMessages of 10", async () => {
      for (let i = 1; i <= 15; i++) {
        await addChatMessage(gameId, "user", `Msg ${i}`);
      }

      await trimChatMessages(gameId);

      const messages = await getChatMessages(gameId);
      expect(messages).toHaveLength(10);
    });
  });

  describe("message structure", () => {
    it("messages have all required fields", async () => {
      const msg = await addChatMessage(gameId, "user", "Test");

      expect(msg).toHaveProperty("id");
      expect(msg).toHaveProperty("gameId");
      expect(msg).toHaveProperty("role");
      expect(msg).toHaveProperty("text");
      expect(msg).toHaveProperty("createdAt");
      expect(typeof msg.id).toBe("number");
      expect(typeof msg.gameId).toBe("number");
      expect(typeof msg.createdAt).toBe("string");
    });
  });
});
