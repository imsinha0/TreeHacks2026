import { nanoid } from 'nanoid';

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

export function generateId(): string {
  return nanoid();
}
