/**
 * Run `prisma generate` without requiring a real database.
 * Uses local prisma binary from node_modules when present.
 */
"use strict";

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const placeholder =
  process.env.DATABASE_URL ||
  "postgresql://prisma:prisma@127.0.0.1:5432/prisma?schema=public";

const backendRoot = path.join(__dirname, "..");
const localPrisma = path.join(
  backendRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "prisma.cmd" : "prisma",
);

const cmd = fs.existsSync(localPrisma) ? localPrisma : "npx";
const args = fs.existsSync(localPrisma) ? ["generate"] : ["prisma", "generate"];

const result = spawnSync(cmd, args, {
  cwd: backendRoot,
  env: { ...process.env, DATABASE_URL: placeholder },
  stdio: "inherit",
});

process.exit(result.status === null ? 1 : result.status);
