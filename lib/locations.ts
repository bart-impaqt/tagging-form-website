import { ScalaPlayer, Location } from "@/types";

// Matches patterns like: NL_EV0040_Den-Haag_Leyweg_Kassa
// Group 1: prefix letters (EV, AB, etc.)
// Group 2: numeric code (0040, 0180, etc.)
// Group 3: city (Den-Haag)
// Group 4: area/sublocation (Leyweg)
const PLAYER_NAME_REGEX = /^[A-Z]{2}_([A-Z]{2})(\d+)_([^_]+)_([^_]+)/;

export function parsePlayerName(name: string): {
  prefix: string;
  number: string;
  code: string;
  city: string;
  area: string;
} | null {
  const match = name.match(PLAYER_NAME_REGEX);
  if (!match) return null;

  const [, prefix, number, city, area] = match;
  return {
    prefix,
    number,
    code: `${prefix}${number}`,
    city,
    area,
  };
}

export function groupPlayersIntoLocations(players: ScalaPlayer[]): Location[] {
  const locationMap = new Map<string, Location>();

  for (const player of players) {
    const parsed = parsePlayerName(player.name);
    if (!parsed) continue; // skip players that don't match pattern

    const { code, prefix, city, area } = parsed;

    if (!locationMap.has(code)) {
      locationMap.set(code, {
        code,
        prefix,
        city: city.replace(/-/g, " "),
        area: area.replace(/-/g, " "),
        displayName: `${city.replace(/-/g, " ")} – ${area.replace(/-/g, " ")}`,
        players: [],
      });
    }

    locationMap.get(code)!.players.push(player);
  }

  // Sort locations: by prefix, then by code
  return Array.from(locationMap.values()).sort((a, b) => {
    if (a.prefix !== b.prefix) return a.prefix.localeCompare(b.prefix);
    return a.code.localeCompare(b.code);
  });
}

export function getLocationByCode(
  locations: Location[],
  code: string
): Location | undefined {
  return locations.find((l) => l.code === code);
}
