import { cookies } from "next/headers";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const AUTH_COOKIE = "scala_portal_auth";
const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

interface SessionPayload {
  exp: number;
  nonce: string;
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET?.trim();
  if (secret) return secret;

  const fallback = process.env.ACCESS_CODE?.trim();
  if (fallback) return fallback;

  throw new Error("AUTH_SECRET or ACCESS_CODE must be configured.");
}

function getSessionTtlSeconds(): number {
  const fromEnv = Number(process.env.AUTH_SESSION_TTL_SECONDS);
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    return Math.floor(fromEnv);
  }
  return DEFAULT_SESSION_TTL_SECONDS;
}

function signValue(value: string): string {
  return createHmac("sha256", getAuthSecret()).update(value).digest("base64url");
}

function safeEqualStrings(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}

export function createAuthSessionToken(): string {
  const payload: SessionPayload = {
    exp: Math.floor(Date.now() / 1000) + getSessionTtlSeconds(),
    nonce: randomBytes(12).toString("hex"),
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signValue(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function verifyAuthSessionToken(token: string): boolean {
  const [encodedPayload, providedSignature] = token.split(".");
  if (!encodedPayload || !providedSignature) return false;

  const expectedSignature = signValue(encodedPayload);
  if (!safeEqualStrings(providedSignature, expectedSignature)) return false;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as SessionPayload;
    if (!payload || typeof payload.exp !== "number") return false;
    if (payload.exp <= Math.floor(Date.now() / 1000)) return false;
  } catch {
    return false;
  }

  return true;
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get(AUTH_COOKIE);
  if (!authCookie?.value) return false;
  return verifyAuthSessionToken(authCookie.value);
}

export async function validateAccessCode(code: string): Promise<boolean> {
  const expected = process.env.ACCESS_CODE?.trim();
  if (!expected) return false;
  return safeEqualStrings(code.trim(), expected);
}

export function getAuthCookieMaxAgeSeconds(): number {
  return getSessionTtlSeconds();
}
