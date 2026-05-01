import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import {
  enrichPlayersWithPlaylistPreviews,
  fetchAllPlayers,
  fetchAllPlayersWithDisplays,
} from "@/lib/scala";
import { loadAllowedFilialPlayersFromCsv } from "@/lib/scala-player-allowlist";
import { getLocationByCode, groupPlayersIntoLocations } from "@/lib/locations";
import { applyRateLimit, getClientIp, withRateLimitHeaders } from "@/lib/rate-limit";

let allowlistCache: Promise<Map<string, Set<string>>> | null = null;

function getAllowlist(): Promise<Map<string, Set<string>>> {
  if (!allowlistCache) {
    allowlistCache = loadAllowedFilialPlayersFromCsv();
  }
  return allowlistCache;
}

function filterLocationsByAllowlist(
  locations: Awaited<ReturnType<typeof groupPlayersIntoLocations>>,
  allowlist: Map<string, Set<string>>
) {
  return locations
    .map((location) => {
      const allowedPlayers = allowlist.get(location.code.toUpperCase());
      if (!allowedPlayers) return null;
      const players = location.players.filter((player) => allowedPlayers.has(player.name.toUpperCase()));
      if (players.length === 0) return null;
      return { ...location, players };
    })
    .filter((location): location is NonNullable<typeof location> => Boolean(location));
}

export async function GET(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const code = request.nextUrl.searchParams.get("code");
    const includePlaylistPreview =
      request.nextUrl.searchParams.get("includePlaylistPreview") === "1";

    if (code) {
      if (includePlaylistPreview) {
        const limit = applyRateLimit({
          namespace: "locations-preview",
          key: getClientIp(request),
          maxRequests: 20,
          windowMs: 10 * 60 * 1000,
        });
        if (limit.limited) {
          return withRateLimitHeaders(
            NextResponse.json(
              { error: "Too many location detail requests. Please wait." },
              { status: 429 }
            ),
            limit
          );
        }
      }

      const [players, allowlist] = await Promise.all([fetchAllPlayersWithDisplays(), getAllowlist()]);
      const locations = filterLocationsByAllowlist(groupPlayersIntoLocations(players), allowlist);
      const location = getLocationByCode(locations, code.toUpperCase());

      if (!location) {
        return NextResponse.json({ error: "Location not found" }, { status: 404 });
      }

      if (includePlaylistPreview) {
        location.players = await enrichPlayersWithPlaylistPreviews(location.players);
      }

      return NextResponse.json({ location });
    }

    const [players, allowlist] = await Promise.all([fetchAllPlayers(), getAllowlist()]);
    const locations = filterLocationsByAllowlist(groupPlayersIntoLocations(players), allowlist);
    return NextResponse.json({ locations });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/locations] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
