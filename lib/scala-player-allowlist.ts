import fs from "node:fs/promises";
import path from "node:path";

type AllowedMap = Map<string, Set<string>>;

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "\"") {
      if (inQuotes && line[i + 1] === "\"") {
        cur += "\"";
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }

  out.push(cur.trim());
  return out;
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replaceAll(/[\s_-]+/g, "");
}

function normalizePlayerName(value: string): string {
  return value.trim().toUpperCase();
}

function buildFilialCode(typeRaw: string, codeRaw: string): string {
  const type = typeRaw.trim().toUpperCase();
  const digits = String(Number(codeRaw.trim()));
  if (!type || !Number.isFinite(Number(codeRaw.trim()))) return "";
  return `${type}${digits.padStart(4, "0")}`;
}

function pickHeaderIndex(headers: string[], aliases: string[]): number {
  const normalized = headers.map(normalizeHeader);
  for (const alias of aliases) {
    const i = normalized.findIndex((h) => h === alias);
    if (i >= 0) return i;
  }
  return -1;
}

export async function loadAllowedFilialPlayersFromCsv(): Promise<AllowedMap> {
  const csvPath = path.join(process.cwd(), "data", "scala-players.csv");
  const raw = await fs.readFile(csvPath, "utf8");
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return new Map();

  const headers = parseCsvLine(lines[0]);
  const playerIdx = pickHeaderIndex(headers, ["playername", "player"]);
  const filialTypeIdx = pickHeaderIndex(headers, ["filiaaltype", "filialtype", "type"]);
  const filialCodeIdx = pickHeaderIndex(headers, ["filiaalcode", "filialcode", "locationcode", "code"]);

  if (playerIdx < 0 || filialTypeIdx < 0 || filialCodeIdx < 0) {
    throw new Error("CSV missing required columns: Player Name + Filiaal Type + Filiaal Code");
  }

  const allowed: AllowedMap = new Map();
  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line);
    const filial = buildFilialCode(cols[filialTypeIdx] ?? "", cols[filialCodeIdx] ?? "");
    const playerName = normalizePlayerName(cols[playerIdx] ?? "");
    if (!filial || !playerName) continue;
    if (!allowed.has(filial)) allowed.set(filial, new Set());
    allowed.get(filial)!.add(playerName);
  }

  return allowed;
}
