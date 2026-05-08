import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import process from "node:process";
import { createInterface } from "node:readline";
import pg from "pg";

const DEFAULT_FILE = "data/cities15000.txt";
const DEFAULT_DATABASE_URL = "postgres://streetlevelsgallery@localhost:5432/scopri_italia";
const BATCH_SIZE = 1000;

function getArgValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function normalizeGeoNameKey(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function parseInteger(value) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDecimal(value) {
  const parsed = Number(value ?? "");
  return Number.isFinite(parsed) ? String(parsed) : null;
}

function parseRow(line) {
  const columns = line.split("\t");
  if (columns.length < 19) return null;

  const geonameId = parseInteger(columns[0]);
  const name = columns[1];
  const asciiName = columns[2];
  const alternateNames = columns[3] || null;
  const latitude = parseDecimal(columns[4]);
  const longitude = parseDecimal(columns[5]);
  const countryCode = columns[8]?.toUpperCase();
  const admin1Code = columns[10] || null;
  const population = parseInteger(columns[14]);
  const timezone = columns[17] || null;
  const modificationDate = columns[18] || null;
  const normalizedName = normalizeGeoNameKey(asciiName || name);

  if (!geonameId || !name || !asciiName || !countryCode || !latitude || !longitude || !normalizedName) {
    return null;
  }

  return {
    geonameId,
    name,
    asciiName,
    alternateNames,
    countryCode,
    admin1Code,
    latitude,
    longitude,
    population,
    timezone,
    modificationDate,
    normalizedName,
    searchKey: `${countryCode}|${normalizedName}`,
  };
}

function printMissingFileInstructions(file) {
  console.error(`[geonames-import] Missing GeoNames dump file: ${file}`);
  console.error("Manual setup:");
  console.error("1. Download cities15000.zip from https://download.geonames.org/export/dump/");
  console.error("2. Extract cities15000.txt from the zip archive.");
  console.error("3. Place the extracted text file at data/cities15000.txt.");
  console.error("4. Re-run: pnpm run geonames:import -- --file data/cities15000.txt");
}

async function insertBatch(client, rows) {
  if (rows.length === 0) return 0;

  const columns = [
    "geoname_id",
    "name",
    "ascii_name",
    "alternate_names",
    "country_code",
    "admin1_code",
    "latitude",
    "longitude",
    "population",
    "timezone",
    "modification_date",
    "normalized_name",
    "search_key",
  ];
  const values = [];
  const placeholders = rows.map((row, rowIndex) => {
    const offset = rowIndex * columns.length;
    values.push(
      row.geonameId,
      row.name,
      row.asciiName,
      row.alternateNames,
      row.countryCode,
      row.admin1Code,
      row.latitude,
      row.longitude,
      row.population,
      row.timezone,
      row.modificationDate,
      row.normalizedName,
      row.searchKey,
    );
    return `(${columns.map((_, columnIndex) => `$${offset + columnIndex + 1}`).join(", ")})`;
  });

  const result = await client.query(
    `
      INSERT INTO geo_cities (${columns.map((column) => `"${column}"`).join(", ")})
      VALUES ${placeholders.join(", ")}
      ON CONFLICT (geoname_id) DO NOTHING
    `,
    values,
  );
  return result.rowCount ?? 0;
}

async function main() {
  const file = getArgValue("--file") ?? DEFAULT_FILE;
  const databaseUrl = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
  const startedAt = Date.now();

  try {
    await access(file);
  } catch {
    printMissingFileInstructions(file);
    process.exitCode = 1;
    return;
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  let rowsRead = 0;
  let malformedRows = 0;
  let insertedRows = 0;
  let attemptedRows = 0;
  let batch = [];

  try {
    const reader = createInterface({
      input: createReadStream(file, { encoding: "utf8" }),
      crlfDelay: Infinity,
    });

    for await (const line of reader) {
      if (!line.trim()) continue;
      rowsRead += 1;
      const parsed = parseRow(line);
      if (!parsed) {
        malformedRows += 1;
        continue;
      }
      batch.push(parsed);

      if (batch.length >= BATCH_SIZE) {
        attemptedRows += batch.length;
        insertedRows += await insertBatch(client, batch);
        batch = [];
      }
    }

    if (batch.length > 0) {
      attemptedRows += batch.length;
      insertedRows += await insertBatch(client, batch);
    }
  } finally {
    await client.end();
  }

  console.log(
    JSON.stringify(
      {
        success: true,
        file,
        rowsRead,
        attemptedRows,
        insertedRows,
        skippedExistingRows: attemptedRows - insertedRows,
        malformedRows,
        durationMs: Date.now() - startedAt,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error("[geonames-import] Import failed.");
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
