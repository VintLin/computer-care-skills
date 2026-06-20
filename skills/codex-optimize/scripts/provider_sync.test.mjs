import assert from "node:assert/strict";
import test from "node:test";

import {
  buildUpdateSql,
  buildApplyScript,
  buildCommandArgs,
  defaultDbCandidates,
  formatNodeCommand,
  parseArgs,
  rewriteSessionMetaLine,
} from "./provider_sync.mjs";

test("when listing default candidates, should prefer sqlite subdirectory", () => {
  assert.deepEqual(defaultDbCandidates("/home/me"), [
    "/home/me/.codex/sqlite/state_5.sqlite",
    "/home/me/.codex/state_5.sqlite",
  ]);
});

test("when parsing inspect args, should not require confirmation", () => {
  const options = parseArgs(["inspect", "--to", "custom"]);

  assert.equal(options.command, "inspect");
  assert.equal(options.targetProvider, "custom");
  assert.equal(options.yes, false);
});

test("when parsing apply args, should require yes", () => {
  assert.throws(() => parseArgs(["apply", "--to", "custom"]), /Refusing to write without --yes/);
});

test("when parsing rollout rewrite args, should require explicit flag and yes", () => {
  const options = parseArgs(["apply", "--yes", "--to", "custom", "--rewrite-rollouts"]);

  assert.equal(options.command, "apply");
  assert.equal(options.rewriteRollouts, true);
});

test("when building update sql, should target unarchived rows by default", () => {
  assert.equal(
    buildUpdateSql("custom", false),
    "UPDATE threads SET model_provider = 'custom' WHERE archived = 0 AND model_provider != 'custom';",
  );
});

test("when building apply script, should execute sqlite statements in one session", () => {
  const script = buildApplyScript("custom", false);

  assert.match(script, /PRAGMA busy_timeout = 5000;/);
  assert.match(script, /BEGIN IMMEDIATE;/);
  assert.match(script, /UPDATE threads SET model_provider = 'custom'/);
  assert.match(script, /SELECT changes\(\) AS changes;/);
  assert.match(script, /COMMIT;/);
});

test("when building apply command args, should preserve inspect scope", () => {
  const options = parseArgs(["inspect", "--db", "/tmp/custom db.sqlite", "--include-archived"]);

  assert.deepEqual(buildCommandArgs(options, "custom"), [
    "apply",
    "--yes",
    "--to",
    "custom",
    "--db",
    "/tmp/custom db.sqlite",
    "--include-archived",
  ]);
});

test("when formatting node command, should quote paths and values", () => {
  assert.equal(
    formatNodeCommand("/tmp/skill path/provider_sync.mjs", [
      "apply",
      "--yes",
      "--to",
      "custom",
      "--db",
      "/tmp/custom db.sqlite",
    ]),
    "node '/tmp/skill path/provider_sync.mjs' 'apply' --yes --to 'custom' --db '/tmp/custom db.sqlite'",
  );
});

test("when rewriting a session_meta line, should only change payload model_provider", () => {
  const line = `${JSON.stringify({
    type: "session_meta",
    payload: {
      id: "thread-1",
      model_provider: "openai",
      cwd: "/tmp/project",
    },
  })}\n`;

  const result = rewriteSessionMetaLine(line, "custom");
  const rewritten = JSON.parse(result.line);

  assert.equal(result.changed, true);
  assert.equal(result.previousProvider, "openai");
  assert.equal(result.sessionId, "thread-1");
  assert.equal(rewritten.payload.model_provider, "custom");
  assert.equal(rewritten.payload.cwd, "/tmp/project");
});

test("when first line is not session_meta, should leave it unchanged", () => {
  const line = `${JSON.stringify({
    type: "response_item",
    payload: {
      model_provider: "openai",
    },
  })}\n`;

  const result = rewriteSessionMetaLine(line, "custom");

  assert.equal(result.changed, false);
  assert.equal(result.line, line);
});
