import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import {
  enrichPlayersWithPlaylistPreviews,
  fetchAllPlayers,
  fetchAllPlayersWithDisplays,
} from "@/lib/scala";
import { getLocationByCode, groupPlayersIntoLocations } from "@/lib/locations";
import { applyRateLimit, getClientIp, withRateLimitHeaders } from "@/lib/rate-limit";

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

      const players = await fetchAllPlayersWithDisplays();
      const locations = groupPlayersIntoLocations(players);
      const location = getLocationByCode(locations, code.toUpperCase());

      if (!location) {
        return NextResponse.json({ error: "Location not found" }, { status: 404 });
      }

      if (includePlaylistPreview) {
        location.players = await enrichPlayersWithPlaylistPreviews(location.players);
      }

      return NextResponse.json({ location });
    }

    const players = await fetchAllPlayers();
    const locations = groupPlayersIntoLocations(players);
    return NextResponse.json({ locations });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/locations] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
