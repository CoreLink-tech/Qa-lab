#!/usr/bin/env node
"use strict";
const { spawnSync } = require("child_process");
const { readdirSync, statSync } = require("fs");
const { join } = require("path");

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (name.endsWith(".test.js")) acc.push(p);
  }
  return acc;
}

const files = walk(join(__dirname, "..", "test")).sort();
if (files.length === 0) {
  console.error("No test files found under test/");
  process.exit(1);
}
const r = spawnSync(process.execPath, ["--test", ...files], {
  stdio: "inherit",
  env: process.env,
});
process.exit(r.status === null ? 1 : r.status);
