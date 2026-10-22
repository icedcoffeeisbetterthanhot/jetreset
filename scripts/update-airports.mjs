import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import tzLookup from "tz-lookup";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceUrl =
  "https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv";
const outputPath = resolve(rootDir, "src/data/airports.json");

function parseCsvRow(text, start) {
  const values = [];
  let value = "";
  let quoted = false;
  let index = start;

  while (index < text.length) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        value += '"';
        index += 2;
        continue;
      }
      if (character === '"') {
        quoted = false;
        index += 1;
        continue;
      }
      value += character;
      index += 1;
      continue;
    }

    if (character === '"') {
      quoted = true;
      index += 1;
    } else if (character === ",") {
      values.push(value);
      value = "";
      index += 1;
    } else if (character === "\n") {
      values.push(value.replace(/\r$/, ""));
      return { values, next: index + 1 };
    } else {
      value += character;
      index += 1;
    }
  }

  if (value.length > 0 || values.length > 0) values.push(value.replace(/\r$/, ""));
  return { values, next: index };
}

const response = await fetch(sourceUrl);
if (!response.ok) {
  throw new Error(`Airport data download failed with HTTP ${response.status}.`);
}

const csv = await response.text();
const headerRow = parseCsvRow(csv, 0);
const headers = headerRow.values;
const columnIndex = Object.fromEntries(headers.map((header, index) => [header, index]));
const requiredColumns = [
  "iata_code",
  "name",
  "municipality",
  "iso_country",
  "latitude_deg",
  "longitude_deg",
  "scheduled_service",
];
const missingColumns = requiredColumns.filter((column) => columnIndex[column] === undefined);
if (missingColumns.length > 0) {
  throw new Error(`Airport data is missing expected columns: ${missingColumns.join(", ")}.`);
}

const airports = [];
const codes = new Set();
let skippedTimeZones = 0;
let cursor = headerRow.next;
while (cursor < csv.length) {
  const row = parseCsvRow(csv, cursor);
  cursor = row.next;
  if (row.values.length === 1 && row.values[0] === "") continue;

  const field = (name) => row.values[columnIndex[name]]?.trim() ?? "";
  const code = field("iata_code");
  const latitude = Number(field("latitude_deg"));
  const longitude = Number(field("longitude_deg"));
  if (
    !/^[A-Z]{3}$/.test(code) ||
    field("scheduled_service") !== "yes" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    continue;
  }
  if (codes.has(code)) {
    throw new Error(`Airport source contains duplicate scheduled-service IATA code ${code}.`);
  }

  let timeZone;
  try {
    timeZone = tzLookup(latitude, longitude);
    new Intl.DateTimeFormat("en", { timeZone });
  } catch {
    skippedTimeZones += 1;
    continue;
  }

  codes.add(code);
  airports.push({
    code,
    name: field("name"),
    city: field("municipality") || null,
    countryCode: field("iso_country") || null,
    timeZone,
    latitude,
    longitude,
  });
}

airports.sort((first, second) => first.code.localeCompare(second.code));
if (airports.length === 0) {
  throw new Error("No usable scheduled-service airports were found.");
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(airports)}\n`, "utf8");
console.log(
  `Wrote ${airports.length} airports with coordinates to src/data/airports.json; skipped ${skippedTimeZones} airports without a usable time zone.`,
);
