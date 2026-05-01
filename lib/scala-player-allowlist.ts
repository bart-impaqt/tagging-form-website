import fs from "node:fs/promises";
import path from "node:path";

type ZipEntry = { name: string; offset: number; compressedSize: number; compression: number };
type AllowedMap = Map<string, Set<string>>;

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_FILE_HEADER_SIGNATURE = 0x02014b50;
const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;

function findEocd(buffer: Buffer): number {
  // EOCD is within last 64KiB + comment.
  const min = Math.max(0, buffer.length - 0x10000 - 22);
  for (let i = buffer.length - 22; i >= min; i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIGNATURE) return i;
  }
  throw new Error("Invalid XLSX: EOCD not found");
}

async function readZipEntries(filePath: string): Promise<Map<string, Buffer>> {
  const buffer = await fs.readFile(filePath);
  const eocd = findEocd(buffer);
  const centralDirectoryOffset = buffer.readUInt32LE(eocd + 16);
  const totalEntries = buffer.readUInt16LE(eocd + 10);
  const entries: ZipEntry[] = [];

  let ptr = centralDirectoryOffset;
  for (let i = 0; i < totalEntries; i++) {
    if (buffer.readUInt32LE(ptr) !== CENTRAL_FILE_HEADER_SIGNATURE) {
      throw new Error("Invalid XLSX: central directory entry mismatch");
    }

    const compression = buffer.readUInt16LE(ptr + 10);
    const compressedSize = buffer.readUInt32LE(ptr + 20);
    const fileNameLength = buffer.readUInt16LE(ptr + 28);
    const extraLength = buffer.readUInt16LE(ptr + 30);
    const commentLength = buffer.readUInt16LE(ptr + 32);
    const localHeaderOffset = buffer.readUInt32LE(ptr + 42);
    const nameStart = ptr + 46;
    const nameEnd = nameStart + fileNameLength;
    const name = buffer.toString("utf8", nameStart, nameEnd);

    entries.push({ name, offset: localHeaderOffset, compressedSize, compression });
    ptr = nameEnd + extraLength + commentLength;
  }

  const unzip = await import("node:zlib");
  const files = new Map<string, Buffer>();

  for (const entry of entries) {
    const localPtr = entry.offset;
    if (buffer.readUInt32LE(localPtr) !== LOCAL_FILE_HEADER_SIGNATURE) {
      throw new Error(`Invalid XLSX: local header not found for ${entry.name}`);
    }
    const fileNameLength = buffer.readUInt16LE(localPtr + 26);
    const extraLength = buffer.readUInt16LE(localPtr + 28);
    const dataStart = localPtr + 30 + fileNameLength + extraLength;
    const dataEnd = dataStart + entry.compressedSize;
    const slice = buffer.subarray(dataStart, dataEnd);

    if (entry.compression === 0) {
      files.set(entry.name, slice);
      continue;
    }
    if (entry.compression === 8) {
      files.set(entry.name, unzip.inflateRawSync(slice));
      continue;
    }
    throw new Error(`Unsupported XLSX compression method ${entry.compression} for ${entry.name}`);
  }

  return files;
}

function decodeXmlEntities(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&apos;", "'");
}

function columnRefToIndex(ref: string): number {
  let n = 0;
  for (const c of ref.toUpperCase()) {
    if (c < "A" || c > "Z") break;
    n = n * 26 + (c.charCodeAt(0) - 64);
  }
  return Math.max(0, n - 1);
}

function getCellText(cellXml: string, sharedStrings: string[]): string {
  const typeMatch = cellXml.match(/\bt="([^"]+)"/);
  const type = typeMatch?.[1] ?? "";

  if (type === "inlineStr") {
    const inline = cellXml.match(/<is>([\s\S]*?)<\/is>/);
    if (!inline) return "";
    const parts = Array.from(inline[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)).map((m) => decodeXmlEntities(m[1]));
    return parts.join("");
  }

  const raw = cellXml.match(/<v>([\s\S]*?)<\/v>/)?.[1]?.trim() ?? "";
  if (!raw) return "";

  if (type === "s") {
    const idx = Number(raw);
    if (Number.isInteger(idx) && idx >= 0 && idx < sharedStrings.length) {
      return sharedStrings[idx];
    }
    return "";
  }

  return decodeXmlEntities(raw);
}

function parseSharedStrings(xml: string): string[] {
  const items = Array.from(xml.matchAll(/<si>([\s\S]*?)<\/si>/g));
  return items.map((m) => {
    const textParts = Array.from(m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)).map((x) => decodeXmlEntities(x[1]));
    return textParts.join("");
  });
}

function parseSheetRows(xml: string, sharedStrings: string[]): string[][] {
  const rows: string[][] = [];
  const rowMatches = Array.from(xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g));

  for (const row of rowMatches) {
    const cells = Array.from(row[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>|<c\b([^>]*)\/>/g));
    const out: string[] = [];

    for (const cell of cells) {
      const fullXml = cell[0];
      const attrs = cell[1] ?? cell[3] ?? "";
      const ref = attrs.match(/\br="([A-Z]+[0-9]+)"/)?.[1] ?? "";
      const index = columnRefToIndex(ref);
      out[index] = getCellText(fullXml, sharedStrings).trim();
    }

    rows.push(out);
  }

  return rows;
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replaceAll(/[\s_-]+/g, "");
}

function normalizeValue(value: string): string {
  return value.trim().toUpperCase();
}

function pickColumnIndex(headers: string[], aliases: string[]): number {
  const normalized = headers.map(normalizeHeader);
  for (const alias of aliases) {
    const idx = normalized.findIndex((v) => v === alias);
    if (idx >= 0) return idx;
  }
  return -1;
}

export async function loadAllowedFilialPlayersFromXlsx(): Promise<AllowedMap> {
  const xlsxPath = path.join(process.cwd(), "data", "scala-players.xlsx");
  const files = await readZipEntries(xlsxPath);
  const workbook = files.get("xl/workbook.xml")?.toString("utf8") ?? "";
  const firstSheetRelId = workbook.match(/<sheet\b[^>]*\br:id="([^"]+)"/)?.[1] ?? "";
  const rels = files.get("xl/_rels/workbook.xml.rels")?.toString("utf8") ?? "";
  const sheetTarget = rels.match(new RegExp(`<Relationship[^>]*Id="${firstSheetRelId}"[^>]*Target="([^"]+)"`))?.[1];
  const resolvedSheetTarget = sheetTarget?.startsWith("/")
    ? sheetTarget.slice(1)
    : `xl/${(sheetTarget ?? "worksheets/sheet1.xml").replace(/^\.\//, "")}`;

  const sharedStringsXml = files.get("xl/sharedStrings.xml")?.toString("utf8") ?? "";
  const sharedStrings = sharedStringsXml ? parseSharedStrings(sharedStringsXml) : [];
  const sheetXml = files.get(resolvedSheetTarget)?.toString("utf8");

  if (!sheetXml) {
    throw new Error("Invalid XLSX: worksheet not found");
  }

  const rows = parseSheetRows(sheetXml, sharedStrings).filter((r) => r.some((v) => v?.trim()));
  if (rows.length === 0) return new Map();

  const headers = rows[0] ?? [];
  const filialIdx = pickColumnIndex(headers, ["filial", "filiaal", "locationcode", "location", "code"]);
  const playerIdx = pickColumnIndex(headers, ["player", "playername", "screen", "naam"]);

  if (filialIdx < 0 || playerIdx < 0) {
    throw new Error("XLSX missing required columns: filial + player");
  }

  const allowed = new Map<string, Set<string>>();
  for (const row of rows.slice(1)) {
    const filial = normalizeValue(row[filialIdx] ?? "");
    const player = normalizeValue(row[playerIdx] ?? "");
    if (!filial || !player) continue;
    if (!allowed.has(filial)) allowed.set(filial, new Set());
    allowed.get(filial)!.add(player);
  }
  return allowed;
}
