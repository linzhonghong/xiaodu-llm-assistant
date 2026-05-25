import type { AppDatabase } from './db.js';
import { nowIso } from '../utils/text.js';

export type ChatRole = 'system' | 'user' | 'assistant';

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type PendingConfirmation = {
  id: number;
  userKey: string;
  sessionId: string;
  actionType: string;
  payload: unknown;
  createdAt: string;
  expiresAt: string;
};

type MessageRow = {
  role: ChatRole;
  content: string;
};

type PendingRow = {
  id: number;
  user_key: string;
  session_id: string;
  action_type: string;
  payload_json: string;
  created_at: string;
  expires_at: string;
};

export function createConversationStore(db: AppDatabase, maxHistoryMessages: number) {
  return {
    addMessage(userKey: string, sessionId: string, role: ChatRole, content: string): void {
      db.prepare('INSERT INTO messages (user_key, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)').run(
        userKey,
        sessionId,
        role,
        content,
        nowIso()
      );
    },

    getHistory(userKey: string): ChatMessage[] {
      const rows = db
        .prepare(
          `SELECT role, content
           FROM messages
           WHERE user_key = ?
           ORDER BY id DESC
           LIMIT ?`
        )
        .all(userKey, maxHistoryMessages) as MessageRow[];

      return rows.reverse().map((row) => ({
        role: row.role,
        content: row.content
      }));
    },

    createPendingConfirmation(userKey: string, sessionId: string, actionType: string, payload: unknown, ttlMs = 60000): void {
      const createdAt = new Date();
      const expiresAt = new Date(createdAt.getTime() + ttlMs);
      db.prepare('DELETE FROM pending_confirmations WHERE user_key = ?').run(userKey);
      db.prepare(
        `INSERT INTO pending_confirmations
         (user_key, session_id, action_type, payload_json, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(userKey, sessionId, actionType, JSON.stringify(payload), createdAt.toISOString(), expiresAt.toISOString());
    },

    getPendingConfirmation(userKey: string): PendingConfirmation | undefined {
      const row = db
        .prepare(
          `SELECT id, user_key, session_id, action_type, payload_json, created_at, expires_at
           FROM pending_confirmations
           WHERE user_key = ? AND expires_at > ?
           ORDER BY id DESC
           LIMIT 1`
        )
        .get(userKey, nowIso()) as PendingRow | undefined;

      if (!row) {
        return undefined;
      }

      return {
        id: row.id,
        userKey: row.user_key,
        sessionId: row.session_id,
        actionType: row.action_type,
        payload: JSON.parse(row.payload_json),
        createdAt: row.created_at,
        expiresAt: row.expires_at
      };
    },

    clearPendingConfirmation(id: number): void {
      db.prepare('DELETE FROM pending_confirmations WHERE id = ?').run(id);
    },

    deleteExpiredPendingConfirmations(): void {
      db.prepare('DELETE FROM pending_confirmations WHERE expires_at <= ?').run(nowIso());
    }
  };
}
