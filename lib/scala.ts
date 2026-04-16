import {
  PlayerPlaylistPreview,
  ScalaPlayer,
  ScalaPlayerDisplay,
  ScalaPlayersResponse,
} from "@/types";
import http from "node:http";
import https from "node:https";

let cachedToken: string | null = null;
let tokenExpiry: number = 0;
const SCALA_FETCH_TIMEOUT_MS = Number(process.env.SCALA_FETCH_TIMEOUT_MS ?? "15000");
const SCALA_TLS_INSECURE =
  process.env.SCALA_TLS_INSECURE === "1" ||
  process.env.SCALA_TLS_INSECURE?.toLowerCase() === "true";
const PLAYLIST_PREVIEW_ITEM_LIMIT = 3;

interface ScalaTimeslot {
  id?: number;
  sortOrder?: number;
  playlist?: {
    id?: number;
    name?: string;
  };
}

interface ScalaTimeslotsResponse {
  timeslots?: ScalaTimeslot[];
  list?: ScalaTimeslot[];
}

interface ScalaPlaylistItem {
  name?: string;
  mediaItem?: { name?: string };
  subplaylist?: { name?: string };
  playlist?: { name?: string };
  message?: { name?: string };
}

interface ScalaPlaylistResponse {
  id?: number;
  name?: string;
  playlistItems?: ScalaPlaylistItem[];
}

interface ScalaChannelResponse {
  frameset?: {
    frames?: Array<{
      id?: number;
    }>;
  };
}

function getScalaApiBaseUrl(): URL {
  const rawBaseUrl = process.env.SCALA_BASE_URL?.trim();
  if (!rawBaseUrl) {
    throw new Error("SCALA_BASE_URL is not configured.");
  }

  let parsedBaseUrl: URL;
  try {
    parsedBaseUrl = new URL(rawBaseUrl);
  } catch {
    throw new Error(`SCALA_BASE_URL must be an absolute URL. Received: "${rawBaseUrl}"`);
  }

  const normalizedPath = parsedBaseUrl.pathname.replace(/\/+$/, "");
  const cmPath = normalizedPath.endsWith("/cm") ? normalizedPath : `${normalizedPath}/cm`;
  return new URL(`${parsedBaseUrl.origin}${cmPath}/api/rest/`);
}

function describeFetchError(err: unknown): string {
  if (!(err instanceof Error)) {
    return "Unknown network error";
  }

  const certErrorPattern = /(unable to verify the first certificate|self[- ]signed certificate|CERT_)/i;
  const cause = (err as Error & { cause?: unknown }).cause;
  const causeMessage =
    cause instanceof Error
      ? cause.message
      : typeof cause === "string"
        ? cause
        : "";

  const baseMessage = causeMessage ? `${err.message}: ${causeMessage}` : err.message;
  if (certErrorPattern.test(baseMessage)) {
    return `${baseMessage}. TLS certificate validation failed. Use an internal HTTP Scala URL (for example http://cm4.ddjmusic.com:8080), or install the Scala root CA and run Node with --use-system-ca.`;
  }

  return baseMessage;
}

async function fetchScalaJson<T>(url: URL, init?: RequestInit): Promise<T> {
  const method = init?.method ?? "GET";
  const headers = new Headers(init?.headers);
  const bodyValue = init?.body;
  const body =
    typeof bodyValue === "string"
      ? bodyValue
      : bodyValue == null
        ? undefined
        : String(bodyValue);

  const requestHeaders: Record<string, string> = {};
  headers.forEach((value, key) => {
    requestHeaders[key] = value;
  });

  if (body && !requestHeaders["content-length"]) {
    requestHeaders["content-length"] = Buffer.byteLength(body).toString();
  }

  const response = await requestScala({
    url,
    method,
    headers: requestHeaders,
    body,
  });

  if (response.statusCode < 200 || response.statusCode >= 300) {
    const bodyPreview = response.body
      ? ` Body: ${response.body.replace(/\s+/g, " ").trim().slice(0, 200)}`
      : "";
    throw new Error(
      `Scala API request failed (${response.statusCode} ${response.statusText}) for ${url.toString()}.${bodyPreview}`
    );
  }

  try {
    return JSON.parse(response.body) as T;
  } catch (err: unknown) {
    throw new Error(
      `Scala API returned invalid JSON for ${url.toString()}: ${describeFetchError(err)}`
    );
  }
}

async function requestScala(params: {
  url: URL;
  method: string;
  headers: Record<string, string>;
  body?: string;
}): Promise<{ statusCode: number; statusText: string; body: string }> {
  const { url, method, headers, body } = params;

  const transport = url.protocol === "https:" ? https : http;

  return await new Promise((resolve, reject) => {
    const req = transport.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port ? Number(url.port) : undefined,
        path: `${url.pathname}${url.search}`,
        method,
        headers,
        rejectUnauthorized: url.protocol === "https:" ? !SCALA_TLS_INSECURE : undefined,
      },
      (res) => {
        const chunks: Buffer[] = [];

        res.on("data", (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });

        res.on("end", () => {
          resolve({
            statusCode: res.statusCode ?? 0,
            statusText: res.statusMessage ?? "Unknown",
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      }
    );

    req.setTimeout(SCALA_FETCH_TIMEOUT_MS, () => {
      req.destroy(new Error(`Request timed out after ${SCALA_FETCH_TIMEOUT_MS}ms`));
    });

    req.on("error", (err) => {
      reject(
        new Error(`Failed to reach Scala API at ${url.toString()}: ${describeFetchError(err)}`)
      );
    });

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

export async function getScalaToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry) {
    return cachedToken;
  }

  const scalaApiBaseUrl = getScalaApiBaseUrl();
  const username = process.env.SCALA_USERNAME;
  const password = process.env.SCALA_PASSWORD;

  if (!username || !password) {
    throw new Error("Scala CMS credentials not configured in environment variables.");
  }

  const authUrl = new URL("auth/login", scalaApiBaseUrl);
  const data = await fetchScalaJson<{ apiToken?: string }>(authUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const token = data.apiToken;

  if (!token) {
    throw new Error("No apiToken returned from Scala login.");
  }

  cachedToken = token;
  // Cache for 50 minutes (tokens typically valid 60min)
  tokenExpiry = now + 50 * 60 * 1000;

  return token;
}

export async function fetchAllPlayers(): Promise<ScalaPlayer[]> {
  return fetchPlayers("name,id");
}

export async function fetchAllPlayersWithDisplays(): Promise<ScalaPlayer[]> {
  return fetchPlayers("name,id,playerDisplays");
}

async function fetchPlayers(fields: string): Promise<ScalaPlayer[]> {
  const token = await getScalaToken();
  const scalaApiBaseUrl = getScalaApiBaseUrl();
  const players: ScalaPlayer[] = [];
  const limit = 100;
  let offset = 0;

  while (true) {
    const playersUrl = new URL("players", scalaApiBaseUrl);
    playersUrl.searchParams.set("limit", String(limit));
    playersUrl.searchParams.set("offset", String(offset));
    playersUrl.searchParams.set("sort", "name");
    playersUrl.searchParams.set("fields", fields);

    const data = await fetchScalaJson<ScalaPlayersResponse>(playersUrl, {
      headers: { apitoken: token },
    });
    players.push(...data.list);

    if (players.length >= data.count || data.list.length < limit) {
      break;
    }
    offset += limit;
  }

  return players;
}

function formatScalaDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCurrentWeekRange(): { fromDate: string; toDate: string } {
  const now = new Date();
  const toDate = new Date(now);
  toDate.setDate(now.getDate() + 6);
  return {
    fromDate: formatScalaDate(now),
    toDate: formatScalaDate(toDate),
  };
}

function getTimeslotsFromResponse(data: ScalaTimeslotsResponse): ScalaTimeslot[] {
  if (Array.isArray(data.timeslots)) return data.timeslots;
  if (Array.isArray(data.list)) return data.list;
  return [];
}

function getFirstPlaylistFromTimeslots(timeslots: ScalaTimeslot[]): {
  id: number;
  name: string | null;
} | null {
  const sorted = [...timeslots].sort((a, b) => {
    const sortA = typeof a.sortOrder === "number" ? a.sortOrder : Number.MAX_SAFE_INTEGER;
    const sortB = typeof b.sortOrder === "number" ? b.sortOrder : Number.MAX_SAFE_INTEGER;
    if (sortA !== sortB) return sortA - sortB;
    return (a.id ?? Number.MAX_SAFE_INTEGER) - (b.id ?? Number.MAX_SAFE_INTEGER);
  });

  for (const timeslot of sorted) {
    const playlistId = timeslot.playlist?.id;
    if (typeof playlistId !== "number") continue;
    return {
      id: playlistId,
      name: timeslot.playlist?.name ?? null,
    };
  }

  return null;
}

function extractPlaylistItemName(item: ScalaPlaylistItem): string | null {
  const candidates = [
    item.mediaItem?.name,
    item.subplaylist?.name,
    item.playlist?.name,
    item.message?.name,
    item.name,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const normalized = candidate.trim();
    if (!normalized) continue;
    return normalized;
  }

  return null;
}

async function fetchChannelTimeslots(params: {
  token: string;
  scalaApiBaseUrl: URL;
  channelId: number;
  frameId: number;
  fromDate: string;
  toDate: string;
}): Promise<ScalaTimeslot[]> {
  const { token, scalaApiBaseUrl, channelId, frameId, fromDate, toDate } = params;

  const timeslotsUrl = new URL(`channels/${channelId}/frames/${frameId}/timeslots`, scalaApiBaseUrl);
  timeslotsUrl.searchParams.set("offset", "0");
  timeslotsUrl.searchParams.set("limit", "999999");
  timeslotsUrl.searchParams.set("search", "");
  timeslotsUrl.searchParams.set("sort", "");
  timeslotsUrl.searchParams.set("count", "0");
  timeslotsUrl.searchParams.set("filters", "{}");
  timeslotsUrl.searchParams.set("fromDate", fromDate);
  timeslotsUrl.searchParams.set("toDate", toDate);

  const data = await fetchScalaJson<ScalaTimeslotsResponse>(timeslotsUrl, {
    headers: { apitoken: token },
  });
  return getTimeslotsFromResponse(data);
}

async function fetchChannelFrameIds(params: {
  token: string;
  scalaApiBaseUrl: URL;
  channelId: number;
}): Promise<number[]> {
  const { token, scalaApiBaseUrl, channelId } = params;

  const channelUrl = new URL(`channels/${channelId}`, scalaApiBaseUrl);
  const data = await fetchScalaJson<ScalaChannelResponse>(channelUrl, {
    headers: { apitoken: token },
  });

  if (!Array.isArray(data.frameset?.frames)) return [];

  const ids: number[] = [];
  for (const frame of data.frameset.frames) {
    if (typeof frame.id !== "number") continue;
    ids.push(frame.id);
  }
  return ids;
}

function isRetryableFrameError(message: string): boolean {
  return (
    message.includes("FrameNotFound") ||
    message.includes("No frame with ID") ||
    message.includes("/timeslots") && message.includes("(400") ||
    message.includes("/timeslots") && message.includes("(404")
  );
}

async function resolvePlaylistForDisplay(params: {
  token: string;
  scalaApiBaseUrl: URL;
  display: ScalaPlayerDisplay;
  fromDate: string;
  toDate: string;
  channelFrameIdsCache: Map<number, number[]>;
}): Promise<{ id: number; name: string | null } | null> {
  const {
    token,
    scalaApiBaseUrl,
    display,
    fromDate,
    toDate,
    channelFrameIdsCache,
  } = params;
  const channelId = display.channel?.id;
  if (typeof channelId !== "number") return null;

  let channelFrameIds: number[] = [];
  if (channelFrameIdsCache.has(channelId)) {
    channelFrameIds = channelFrameIdsCache.get(channelId) ?? [];
  } else {
    channelFrameIds = await fetchChannelFrameIds({
      token,
      scalaApiBaseUrl,
      channelId,
    });
    channelFrameIdsCache.set(channelId, channelFrameIds);
  }

  const frameIds = [display.id, ...channelFrameIds, channelId]
    .filter((value): value is number => typeof value === "number")
    .filter((value, index, all) => all.indexOf(value) === index);

  let lastError: Error | null = null;

  for (const frameId of frameIds) {
    try {
      const timeslots = await fetchChannelTimeslots({
        token,
        scalaApiBaseUrl,
        channelId,
        frameId,
        fromDate,
        toDate,
      });
      return getFirstPlaylistFromTimeslots(timeslots);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error("Unknown error");
      const canRetry = isRetryableFrameError(error.message);
      if (!canRetry || frameId === frameIds[frameIds.length - 1]) {
        if (!canRetry) throw error;
        lastError = error;
        break;
      }
      lastError = error;
    }
  }

  if (lastError && !isRetryableFrameError(lastError.message)) {
    throw lastError;
  }
  return null;
}

async function fetchPlaylistItemNames(params: {
  token: string;
  scalaApiBaseUrl: URL;
  playlistId: number;
}): Promise<string[]> {
  const { token, scalaApiBaseUrl, playlistId } = params;
  const playlistUrl = new URL(`playlists/${playlistId}`, scalaApiBaseUrl);
  playlistUrl.searchParams.set("calculateDuration", "true");

  const data = await fetchScalaJson<ScalaPlaylistResponse>(playlistUrl, {
    headers: { apitoken: token },
  });

  const names: string[] = [];
  const seen = new Set<string>();
  const items = Array.isArray(data.playlistItems) ? data.playlistItems : [];

  for (const item of items) {
    const name = extractPlaylistItemName(item);
    if (!name || seen.has(name)) continue;
    names.push(name);
    seen.add(name);
    if (names.length >= PLAYLIST_PREVIEW_ITEM_LIMIT) break;
  }

  return names;
}

export async function enrichPlayersWithPlaylistPreviews(
  players: ScalaPlayer[]
): Promise<ScalaPlayer[]> {
  const token = await getScalaToken();
  const scalaApiBaseUrl = getScalaApiBaseUrl();
  const { fromDate, toDate } = getCurrentWeekRange();
  const channelPlaylistCache = new Map<number, { id: number; name: string | null } | null>();
  const channelFrameIdsCache = new Map<number, number[]>();
  const playlistItemsCache = new Map<number, string[]>();

  for (const player of players) {
    const displays = player.playerDisplays ?? [];
    const previews: PlayerPlaylistPreview[] = [];

    for (const display of displays) {
      const channelId = display.channel?.id ?? null;
      let playlist: { id: number; name: string | null } | null = null;

      if (typeof channelId === "number") {
        if (channelPlaylistCache.has(channelId)) {
          playlist = channelPlaylistCache.get(channelId) ?? null;
        } else {
          playlist = await resolvePlaylistForDisplay({
            token,
            scalaApiBaseUrl,
            display,
            fromDate,
            toDate,
            channelFrameIdsCache,
          });
          channelPlaylistCache.set(channelId, playlist);
        }
      }

      let itemNames: string[] = [];
      if (playlist?.id) {
        if (playlistItemsCache.has(playlist.id)) {
          itemNames = playlistItemsCache.get(playlist.id) ?? [];
        } else {
          itemNames = await fetchPlaylistItemNames({
            token,
            scalaApiBaseUrl,
            playlistId: playlist.id,
          });
          playlistItemsCache.set(playlist.id, itemNames);
        }
      }

      previews.push({
        displayId: display.id,
        displayName: display.name,
        screenCounter:
          typeof display.screenCounter === "number" ? display.screenCounter : null,
        channelId,
        channelName: display.channel?.name ?? null,
        playlistId: playlist?.id ?? null,
        playlistName: playlist?.name ?? null,
        itemNames,
      });
    }

    player.playlistPreviews = previews;
  }

  return players;
}
