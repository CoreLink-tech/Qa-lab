#!/usr/bin/env node
/**
 * Lightweight concurrent load smoke against a running API.
 * Usage: node scripts/load-smoke.mjs [baseUrl] [concurrency] [requests]
 */
import http from 'node:http';
import https from 'node:https';

const base = process.argv[2] || 'http://localhost:3000/api';
const concurrency = Number(process.argv[3] || 10);
const total = Number(process.argv[4] || 50);
const url = new URL(`${base.replace(/\/$/, '')}/health`);
const lib = url.protocol === 'https:' ? https : http;

let done = 0;
let ok = 0;
let fail = 0;
const latencies = [];

function one() {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = lib.get(url, (res) => {
      res.resume();
      res.on('end', () => {
        latencies.push(Date.now() - start);
        if (res.statusCode && res.statusCode < 500) ok++;
        else fail++;
        done++;
        resolve();
      });
    });
    req.on('error', () => {
      fail++;
      done++;
      resolve();
    });
  });
}

async function run() {
  console.log(`load-smoke ${url.href} concurrency=${concurrency} total=${total}`);
  let issued = 0;
  async function worker() {
    while (issued < total) {
      issued++;
      await one();
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  latencies.sort((a, b) => a - b);
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  console.log(JSON.stringify({ ok, fail, p95_ms: p95, samples: latencies.length }));
  if (fail > total * 0.1) process.exit(1);
}

run();
