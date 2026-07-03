import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";

/**
 * Lightweight auth for the client-facing editor (/edit/[slug]).
 * Separate from Clerk, which only protects the owner dashboard.
 * Each website has its own optional password; a session is a signed
 * token scoped to exactly one website, stored in a per-site cookie.
 */

const SECRET = process.env.CLIENT_SESSION_SECRET || "dev-only-insecure-secret-change-me";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

function sign(payload: string): string {
  return createHash("sha256").update(payload + SECRET).digest("hex");
}

/** Create a signed session token for a given website id. */
export function createSessionToken(websiteId: string): string {
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = `${websiteId}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

/** Verify a session token belongs to the given website and hasn't expired. */
export function verifySessionToken(token: string | undefined, websiteId: string): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [tokenWebsiteId, expStr, sig] = parts;
  const payload = `${tokenWebsiteId}.${expStr}`;
  if (sign(payload) !== sig) return false;
  if (tokenWebsiteId !== websiteId) return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  return true;
}

export function clientCookieName(websiteId: string): string {
  return `client_session_${websiteId}`;
}
