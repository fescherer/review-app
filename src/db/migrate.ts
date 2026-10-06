import { execute, select } from "./client";

// Versioned SQL files: migrations/NNN_name.sql. PRAGMA user_version records the last applied one.
const files = import.meta.glob<string>("./migrations/*.sql", {
  query: "?raw",
  import: "default",
  eager: true,
});

const migrations = Object.entries(files)
  .map(([file, sql]) => {
    const match = /\/(\d+)_[^/]+\.sql$/.exec(file);
    if (!match) throw new Error(`Bad migration filename: ${file}`);
    return { version: Number(match[1]), file, sql };
  })
  .sort((a, b) => a.version - b.version);

function splitStatements(sql: string): string[] {
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function runMigrations(): Promise<void> {
  const [{ user_version: current }] = await select<{ user_version: number }>("PRAGMA user_version");
  for (const m of migrations) {
    if (m.version <= current) continue;
    for (const statement of splitStatements(m.sql)) {
      await execute(statement);
    }
    await execute(`PRAGMA user_version = ${m.version}`);
  }
}
