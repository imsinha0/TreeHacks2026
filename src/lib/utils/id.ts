import { nanoid } from 'nanoid';
import { randomUUID } from 'crypto';

export function generateSessionId(): string {
  if (typeof window === 'undefined') return nanoid();

  const key = 'debate_session_id';
  let sessionId = sessionStorage.getItem(key);
  if (!sessionId) {
    sessionId = nanoid();
    sessionStorage.setItem(key, sessionId);
  }
  return sessionId;
}

/**
 * Generate a UUID for database records.
 * All database tables use UUID as their primary key.
 */
export function generateId(): string {
  return randomUUID();
}
