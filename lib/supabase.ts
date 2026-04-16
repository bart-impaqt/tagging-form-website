import { PlayerTagSelection } from "@/types";

export interface PlayerSelectionRow {
  id: number;
  location_code: string;
  location_name: string;
  player_id: number;
  player_name: string;
  tags: string[];
  comment: string;
  submitted_at: string;
  updated_at: string;
}

interface SupabaseConfig {
  url: string;
  serviceRoleKey: string;
  apikey: string;
  table: string;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const payload = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getSupabaseConfig(): SupabaseConfig {
  const url = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const anonKey =
    process.env.SUPABASE_ANON_KEY?.trim() ||
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  const table = process.env.SUPABASE_TABLE?.trim() || "player_tag_submissions";

  if (!url) {
    throw new Error("SUPABASE_URL is not configured.");
  }
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }
  if (
    serviceRoleKey.startsWith("sb_publishable_") ||
    serviceRoleKey.startsWith("sb_anon_")
  ) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY must be the service_role key, not a publishable/anon key."
    );
  }

  const jwtPayload = decodeJwtPayload(serviceRoleKey);
  if (jwtPayload) {
    const role = String(jwtPayload.role ?? "");
    if (role !== "service_role") {
      throw new Error(
        `SUPABASE_SERVICE_ROLE_KEY is not a service role key (role="${role || "unknown"}").`
      );
    }
  }

  return {
    url,
    serviceRoleKey,
    apikey: anonKey || serviceRoleKey,
    table,
  };
}

function getSupabaseHeaders(
  serviceRoleKey: string,
  apikey: string,
  extra?: Record<string, string>
) {
  return {
    apikey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function readErrorMessage(res: Response): Promise<string> {
  const raw = await res.text();
  if (!raw) return `${res.status} ${res.statusText}`;

  try {
    const parsed = JSON.parse(raw) as { message?: string; error?: string };
    return parsed.message || parsed.error || raw;
  } catch {
    return raw;
  }
}

export async function upsertPlayerSelections(params: {
  locationCode: string;
  locationName: string;
  submittedAt: string;
  selections: PlayerTagSelection[];
}): Promise<PlayerSelectionRow[]> {
  const { locationCode, locationName, submittedAt, selections } = params;
  if (selections.length === 0) {
    return [];
  }

  const { url, serviceRoleKey, apikey, table } = getSupabaseConfig();
  const endpoint = new URL(`/rest/v1/${table}`, url);
  endpoint.searchParams.set("on_conflict", "location_code,player_id");

  const payload = selections.map((selection) => ({
    location_code: locationCode,
    location_name: locationName,
    player_id: selection.playerId,
    player_name: selection.playerName,
    tags: selection.tags,
    comment: selection.comment,
    submitted_at: submittedAt,
  }));

  const res = await fetch(endpoint.toString(), {
    method: "POST",
    headers: getSupabaseHeaders(serviceRoleKey, apikey, {
      Prefer: "resolution=merge-duplicates,return=representation",
    }),
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!res.ok) {
    const message = await readErrorMessage(res);
    throw new Error(`Supabase upsert failed: ${message}`);
  }

  return (await res.json()) as PlayerSelectionRow[];
}

export async function fetchPlayerSelections(locationCode?: string): Promise<PlayerSelectionRow[]> {
  const { url, serviceRoleKey, apikey, table } = getSupabaseConfig();
  const endpoint = new URL(`/rest/v1/${table}`, url);

  endpoint.searchParams.set(
    "select",
    "id,location_code,location_name,player_id,player_name,tags,comment,submitted_at,updated_at"
  );
  endpoint.searchParams.set("order", "updated_at.desc");
  if (locationCode) {
    endpoint.searchParams.set("location_code", `eq.${locationCode}`);
  }

  const res = await fetch(endpoint.toString(), {
    method: "GET",
    headers: getSupabaseHeaders(serviceRoleKey, apikey),
    cache: "no-store",
  });

  if (!res.ok) {
    const message = await readErrorMessage(res);
    throw new Error(`Supabase read failed: ${message}`);
  }

  return (await res.json()) as PlayerSelectionRow[];
}
