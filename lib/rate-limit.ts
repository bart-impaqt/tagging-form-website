import { NextRequest, NextResponse } from "next/server";

interface BucketEntry {
  count: number;
  resetAt: number;
}

interface RateLimitStore {
  buckets: Map<string, BucketEntry>;
}

declare global {
  var __rateLimitStore: RateLimitStore | undefined;
}

function getStore(): RateLimitStore {
  if (!globalThis.__rateLimitStore) {
    globalThis.__rateLimitStore = {
      buckets: new Map<string, BucketEntry>(),
    };
  }
  return globalThis.__rateLimitStore;
}

export interface RateLimitResult {
  limited: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "unknown";
}

export function applyRateLimit(params: {
  namespace: string;
  key: string;
  maxRequests: number;
  windowMs: number;
}): RateLimitResult {
  const { namespace, key, maxRequests, windowMs } = params;
  const now = Date.now();
  const bucketKey = `${namespace}:${key}`;
  const store = getStore();

  // Opportunistic cleanup to prevent unbounded growth.
  if (Math.random() < 0.01) {
    for (const [k, entry] of store.buckets.entries()) {
      if (entry.resetAt <= now) {
        store.buckets.delete(k);
      }
    }
  }

  const entry = store.buckets.get(bucketKey);
  if (!entry || entry.resetAt <= now) {
    store.buckets.set(bucketKey, {
      count: 1,
      resetAt: now + windowMs,
    });
    return {
      limited: false,
      remaining: Math.max(0, maxRequests - 1),
      retryAfterSeconds: Math.ceil(windowMs / 1000),
    };
  }

  entry.count += 1;
  const remaining = Math.max(0, maxRequests - entry.count);
  const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));

  return {
    limited: entry.count > maxRequests,
    remaining,
    retryAfterSeconds,
  };
}

export function withRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult
): NextResponse {
  response.headers.set("X-RateLimit-Remaining", String(result.remaining));
  response.headers.set("Retry-After", String(result.retryAfterSeconds));
  return response;
}
