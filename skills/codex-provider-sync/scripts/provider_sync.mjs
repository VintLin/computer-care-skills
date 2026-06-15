#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const allowedProviders = new Set(["openai", "custom"]);

export function defaultDbCandidates(home = homedir()) {
  return [
    path.join(home, ".codex", "sqlite", "state_5.sqlite"),
    path.join(home, ".codex", "state_5.sqlite"),
  ];
}

export function findDefaultDb(home = homedir()) {
  const found = defaultDbCandidates(home).find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error("No Codex state_5.sqlite database found.");
  }
  return found;
}

export function parseArgs(argv) {
  const command = argv[0] ?? "inspect";
  if (!["inspect", "apply"].includes(command)) {
    throw new Error("Command must be inspect or apply.");
  }

  const options = {
    command,
    dbPath: null,
    includeArchived: false,
    rewriteRollouts: false,
    targetProvider: null,
    yes: false,
  };

  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--db") {
      options.dbPath = readRequiredValue(argv, index, arg);
      index += 1;
    } else if (arg === "--to") {
      options.targetProvider = readRequiredValue(argv, index, arg);
      index += 1;
    } else if (arg === "--include-archived") {
      options.includeArchived = true;
    } else if (arg === "--rewrite-rollouts") {
      options.rewriteRollouts = true;
    } else if (arg === "--yes") {
      options.yes = true;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (options.targetProvider !== null && !allowedProviders.has(options.targetProvider)) {
    throw new Error("--to must be one of: openai, custom");
  }

  if (options.command === "apply" && !options.yes) {
    throw new Error("Refusing to write without --yes.");
  }

  return options;
}

export function buildUpdateSql(targetProvider, includeArchived) {
  const escapedProvider = escapeSqlString(targetProvider);
  const where = includeArchived
    ? `model_provider != '${escapedProvider}'`
    : `archived = 0 AND model_provider != '${escapedProvider}'`;
  return `UPDATE threads SET model_provider = '${escapedProvider}' WHERE ${where};`;
}

export function rewriteSessionMetaLine(line, targetProvider) {
  const lineEnding = line.endsWith("\r\n") ? "\r\n" : line.endsWith("\n") ? "\n" : "";
  const rawLine = lineEnding ? line.slice(0, -lineEnding.length) : line;
  const entry = JSON.parse(rawLine);
  if (entry.type !== "session_meta" || typeof entry.payload !== "object" || entry.payload === null) {
    return { changed: false, line, previousProvider: null, sessionId: null };
  }

  const previousProvider = entry.payload.model_provider ?? null;
  const sessionId = entry.payload.id ?? null;
  if (previousProvider === targetProvider) {
    return { changed: false, line, previousProvider, sessionId };
  }

  entry.payload.model_provider = targetProvider;
  return {
    changed: true,
    line: `${JSON.stringify(entry)}${lineEnding}`,
    previousProvider,
    sessionId,
  };
}

function readRequiredValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function escapeSqlString(value) {
  return value.replaceAll("'", "''");
}

function readCurrentProvider(home = homedir()) {
  const configPath = path.join(home, ".codex", "config.toml");
  if (!existsSync(configPath)) {
    throw new Error(`Config not found: ${configPath}`);
  }
  const result = spawnSync("awk", [
    "-F",
    " *= *",
    '/^model_provider[[:space:]]*=/{gsub(/"/, "", $2); print $2; exit}',
    configPath,
  ], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || "Failed to read model_provider from config.toml.");
  }
  const provider = result.stdout.trim();
  if (!provider) {
    throw new Error("No model_provider found in config.toml.");
  }
  return provider;
}

function runSqlite(dbPath, args) {
  const result = spawnSync("sqlite3", [dbPath, ...args], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || "sqlite3 command failed");
  }
  return result.stdout;
}

function queryJson(dbPath, sql) {
  return JSON.parse(runSqlite(dbPath, ["-json", sql]) || "[]");
}

function queryTable(dbPath, sql) {
  return runSqlite(dbPath, ["-header", "-column", sql]).trim();
}

function createBackupSet(dbPath) {
  const timestamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
  const backupDir = path.join(homedir(), ".codex", "backups", `provider-sync-${timestamp}`);
  mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, path.basename(dbPath));
  runSqlite(dbPath, [`.backup '${backupPath.replaceAll("'", "''")}'`]);
  return { backupDir, dbBackupPath: backupPath };
}

function inspect(options) {
  const dbPath = options.dbPath ?? findDefaultDb();
  const activeProvider = readCurrentProvider();
  const targetProvider = options.targetProvider ?? activeProvider;
  if (!allowedProviders.has(targetProvider)) {
    throw new Error(`Target provider '${targetProvider}' is not supported by this skill script.`);
  }

  const scopeWhere = options.includeArchived ? "1 = 1" : "archived = 0";
  const changeWhere = `${scopeWhere} AND model_provider != '${escapeSqlString(targetProvider)}'`;
  const distribution = queryTable(
    dbPath,
    `SELECT model_provider, archived, COUNT(*) AS count FROM threads WHERE ${scopeWhere} GROUP BY model_provider, archived ORDER BY archived, model_provider;`,
  );
  const rowsToChange = queryJson(dbPath, `SELECT COUNT(*) AS count FROM threads WHERE ${changeWhere};`)[0]?.count ?? 0;
  const sampleRows = queryTable(
    dbPath,
    `SELECT id, model_provider, datetime(updated_at, 'unixepoch') AS updated_utc, cwd FROM threads WHERE ${changeWhere} ORDER BY updated_at DESC LIMIT 10;`,
  );

  return { activeProvider, dbPath, distribution, rowsToChange, sampleRows, targetProvider };
}

function scopedThreadRows(dbPath, includeArchived) {
  const scopeWhere = includeArchived ? "1 = 1" : "archived = 0";
  return queryJson(
    dbPath,
    `SELECT id, rollout_path, model_provider FROM threads WHERE ${scopeWhere} ORDER BY updated_at DESC;`,
  );
}

function rewriteRolloutFile(rolloutPath, targetProvider, backupDir) {
  if (!existsSync(rolloutPath)) {
    return { changed: false, skipped: true, reason: "missing", rolloutPath };
  }

  const content = readFileSync(rolloutPath, "utf8");
  const firstNewlineIndex = content.indexOf("\n");
  const firstLine = firstNewlineIndex === -1 ? content : content.slice(0, firstNewlineIndex + 1);
  const rest = firstNewlineIndex === -1 ? "" : content.slice(firstNewlineIndex + 1);
  if (!firstLine) {
    return { changed: false, skipped: true, reason: "empty", rolloutPath };
  }

  let rewritten;
  try {
    rewritten = rewriteSessionMetaLine(firstLine, targetProvider);
  } catch (error) {
    return {
      changed: false,
      skipped: true,
      reason: `invalid first JSONL line: ${error instanceof Error ? error.message : String(error)}`,
      rolloutPath,
    };
  }

  if (!rewritten.changed) {
    return {
      changed: false,
      previousProvider: rewritten.previousProvider,
      rolloutPath,
      sessionId: rewritten.sessionId,
    };
  }

  const rolloutsBackupDir = path.join(backupDir, "rollouts");
  mkdirSync(rolloutsBackupDir, { recursive: true });
  const backupPath = path.join(rolloutsBackupDir, path.basename(rolloutPath));
  copyFileSync(rolloutPath, backupPath);
  writeFileSync(rolloutPath, `${rewritten.line}${rest}`, "utf8");
  return {
    backupPath,
    changed: true,
    previousProvider: rewritten.previousProvider,
    rolloutPath,
    sessionId: rewritten.sessionId,
  };
}

function rewriteRollouts(dbPath, targetProvider, includeArchived, backupDir) {
  const rows = scopedThreadRows(dbPath, includeArchived);
  const results = rows.map((row) => rewriteRolloutFile(row.rollout_path, targetProvider, backupDir));
  const changed = results.filter((result) => result.changed);
  const skipped = results.filter((result) => result.skipped);
  return { changed, scanned: results.length, skipped };
}

function printInspect(result, options) {
  console.log(`Database: ${result.dbPath}`);
  console.log(`Current config model_provider: ${result.activeProvider}`);
  console.log(`Target provider: ${result.targetProvider}`);
  console.log(`Scope: ${options.includeArchived ? "all rows including archived" : "unarchived rows only"}`);
  console.log("");
  console.log("Provider distribution:");
  console.log(result.distribution || "(no rows)");
  console.log("");
  console.log(`Rows that would change: ${result.rowsToChange}`);
  if (result.sampleRows) {
    console.log("");
    console.log("Sample rows:");
    console.log(result.sampleRows);
  }
  console.log("");
  console.log("Apply command after user confirmation:");
  console.log(`node ${fileURLToPath(import.meta.url)} apply --yes --to ${result.targetProvider}`);
  console.log("Persistent rollout rewrite command after explicit confirmation:");
  console.log(`node ${fileURLToPath(import.meta.url)} apply --yes --to ${result.targetProvider} --rewrite-rollouts`);
}

function printUsage() {
  console.log(`Usage:
  provider_sync.mjs inspect [--to openai|custom] [--include-archived]
  provider_sync.mjs apply --yes [--to openai|custom] [--include-archived] [--rewrite-rollouts]
`);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }
  const result = inspect(options);
  printInspect(result, options);
  if (options.command === "apply") {
    const { backupDir, dbBackupPath } = createBackupSet(result.dbPath);
    let rolloutResult = null;
    runSqlite(result.dbPath, ["PRAGMA busy_timeout = 5000;", buildUpdateSql(result.targetProvider, options.includeArchived)]);
    if (options.rewriteRollouts) {
      rolloutResult = rewriteRollouts(
        result.dbPath,
        result.targetProvider,
        options.includeArchived,
        backupDir,
      );
    }
    console.log("");
    console.log(`Backup written: ${dbBackupPath}`);
    if (rolloutResult) {
      console.log(`Rollout JSONL scanned: ${rolloutResult.scanned}`);
      console.log(`Rollout JSONL changed: ${rolloutResult.changed.length}`);
      if (rolloutResult.skipped.length > 0) {
        console.log(`Rollout JSONL skipped: ${rolloutResult.skipped.length}`);
      }
    }
    console.log("Write complete. Re-run inspect to verify current distribution.");
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
