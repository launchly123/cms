/**
 * Owner (agency) authentication — a single shared password, signed cookie.
 * Uses Web Crypto so it runs in BOTH edge middleware and node route handlers.
 * The password is OWNER_PASSWORD; sessions are signed with CLIENT_SESSION_SECRET.
 */

export const OWNER_COOKIE = "owner_session";
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const encoder = new TextEncoder();

function secret(): string {
  return process.env.CLIENT_SESSION_SECRET || "dev-only-insecure-secret-change-me";
}

async function hmacHex(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createOwnerToken(): Promise<string> {
  const exp = Date.now() + TTL_MS;
  const sig = await hmacHex(String(exp));
  return `${exp}.${sig}`;
}

export async function verifyOwnerToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [expStr, sig] = token.split(".");
  if (!expStr || !sig) return false;
  const expected = await hmacHex(expStr);
  if (expected !== sig) return false;
  const exp = Number(expStr);
  return Number.isFinite(exp) && Date.now() <= exp;
}

/** True when a login password matches OWNER_PASSWORD. */
export function checkOwnerPassword(password: string): boolean {
  const expected = process.env.OWNER_PASSWORD;
  if (!expected) return false;
  return password === expected;
}

export function ownerConfigured(): boolean {
  return Boolean(process.env.OWNER_PASSWORD);
}
