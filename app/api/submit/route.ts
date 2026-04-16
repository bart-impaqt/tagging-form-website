import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { LocationSubmission, PlayerTagSelection } from "@/types";
import { fetchPlayerSelections, PlayerSelectionRow, upsertPlayerSelections } from "@/lib/supabase";
import { applyRateLimit, getClientIp, withRateLimitHeaders } from "@/lib/rate-limit";

function normalizePlayerSelections(
  value: unknown
): PlayerTagSelection[] {
  if (!Array.isArray(value)) return [];

  const normalized: PlayerTagSelection[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const raw = entry as Partial<PlayerTagSelection>;

    const playerId = Number(raw.playerId);
    if (!Number.isFinite(playerId)) continue;

    const playerName = String(raw.playerName ?? "").trim();
    const tags = Array.isArray(raw.tags) ? raw.tags.map((tag) => String(tag)) : [];
    const comment =
      typeof raw.comment === "string"
        ? raw.comment
        : typeof raw.remark === "string"
          ? raw.remark
          : "";

    normalized.push({
      playerId,
      playerName,
      tags,
      comment,
    });
  }

  return normalized;
}

function toLocationSubmissions(rows: PlayerSelectionRow[]): LocationSubmission[] {
  const map = new Map<string, LocationSubmission>();

  for (const row of rows) {
    const key = row.location_code;
    const existing = map.get(key);
    const selection: PlayerTagSelection = {
      playerId: row.player_id,
      playerName: row.player_name,
      tags: Array.isArray(row.tags) ? row.tags.map((tag) => String(tag)) : [],
      comment: row.comment ?? "",
    };

    if (existing) {
      existing.playerSelections.push(selection);
      if (new Date(row.submitted_at).getTime() > new Date(existing.submittedAt).getTime()) {
        existing.submittedAt = row.submitted_at;
      }
      continue;
    }

    map.set(key, {
      locationCode: row.location_code,
      locationName: row.location_name,
      submittedAt: row.submitted_at,
      playerSelections: [selection],
    });
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  );
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(req);
  const limit = applyRateLimit({
    namespace: "submit-post",
    key: ip,
    maxRequests: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (limit.limited) {
    return withRateLimitHeaders(
      NextResponse.json({ error: "Too many submit requests. Please wait." }, { status: 429 }),
      limit
    );
  }

  try {
    const body = (await req.json()) as Partial<LocationSubmission>;
    const locationCode = String(body.locationCode ?? "").trim();
    const locationName = String(body.locationName ?? "").trim();
    const playerSelections = normalizePlayerSelections(body.playerSelections);

    if (!locationCode || !locationName || playerSelections.length === 0) {
      return withRateLimitHeaders(
        NextResponse.json({ error: "Invalid submission data" }, { status: 400 }),
        limit
      );
    }

    const submittedAt = new Date().toISOString();
    await upsertPlayerSelections({
      locationCode,
      locationName,
      submittedAt,
      selections: playerSelections,
    });

    const submission: LocationSubmission = {
      locationCode,
      locationName,
      submittedAt,
      playerSelections,
    };

    console.log(`[submissions] Saved to Supabase: ${locationCode} at ${submittedAt}`);
    return withRateLimitHeaders(NextResponse.json({ success: true, submission }), limit);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/submit] Error:", message);
    return withRateLimitHeaders(
      NextResponse.json({ error: message }, { status: 500 }),
      limit
    );
  }
}

export async function GET(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const locationCode = req.nextUrl.searchParams.get("locationCode") ?? undefined;
    const rows = await fetchPlayerSelections(locationCode);
    const submissions = toLocationSubmissions(rows);
    return NextResponse.json({ submissions });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/submit][GET] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
