import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_COOKIE,
  createAuthSessionToken,
  getAuthCookieMaxAgeSeconds,
  validateAccessCode,
} from "@/lib/auth";
import { applyRateLimit, getClientIp, withRateLimitHeaders } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const limit = applyRateLimit({
    namespace: "auth-login",
    key: ip,
    maxRequests: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (limit.limited) {
    return withRateLimitHeaders(
      NextResponse.json(
        { error: "Too many login attempts. Please try again later." },
        { status: 429 }
      ),
      limit
    );
  }

  const body = (await req.json()) as { code?: unknown };
  const code = typeof body.code === "string" ? body.code : "";

  if (!code) {
    return withRateLimitHeaders(
      NextResponse.json({ error: "Access code required" }, { status: 400 }),
      limit
    );
  }

  const valid = await validateAccessCode(code);

  if (!valid) {
    return withRateLimitHeaders(
      NextResponse.json({ error: "Invalid access code" }, { status: 401 }),
      limit
    );
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(AUTH_COOKIE, createAuthSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: getAuthCookieMaxAgeSeconds(),
    path: "/",
  });

  return withRateLimitHeaders(response, limit);
}
