#!/usr/bin/env node
/**
 * One-time seed script: reads refresh token from ~/.lemma/config.json
 * and writes it + the current access token into Vercel KV.
 *
 * Run ONCE after setting up Vercel KV:
 *   node scripts/seed-kv.cjs
 *
 * Requires in .env.local:
 *   KV_REST_API_URL=...
 *   KV_REST_API_TOKEN=...
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const CLI_CONFIG = path.join(os.homedir(), '.lemma', 'config.json');
const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

if (!KV_URL || !KV_TOKEN) {
  console.error('❌ KV_REST_API_URL and KV_REST_API_TOKEN must be set in .env.local');
  process.exit(1);
}

function readCliConfig() {
  const raw = fs.readFileSync(CLI_CONFIG, 'utf8');
  const cfg = JSON.parse(raw);
  const active = cfg?.active_server ?? 'default';
  const server = cfg?.servers?.[active];
  const auth = server?.auth ?? server;
  return {
    accessToken: auth?.access_token ?? server?.token ?? '',
    refreshToken: auth?.refresh_token ?? server?.refresh_token ?? '',
  };
}

function kvSet(key, value, exSeconds) {
  return new Promise((resolve, reject) => {
    // Vercel KV REST: POST /set/<key>/<value>?ex=<seconds>
    const encoded = encodeURIComponent(value);
    const query = exSeconds ? `?ex=${exSeconds}` : '';
    const u = new URL(`${KV_URL}/set/${key}/${encoded}${query}`);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KV_TOKEN}`,
        'Content-Type': 'application/json',
      },
    }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(JSON.parse(body));
        else reject(new Error(`KV set failed ${res.statusCode}: ${body}`));
      });
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  console.log('[seed-kv] Reading CLI config from', CLI_CONFIG);
  const { accessToken, refreshToken } = readCliConfig();

  if (!refreshToken) {
    console.error('❌ No refresh token found in CLI config. Run: lemma auth login');
    process.exit(1);
  }

  console.log('[seed-kv] Seeding refresh token into KV...');
  await kvSet('lemma:refresh_token', refreshToken);
  console.log('  ✅ lemma:refresh_token stored');

  if (accessToken) {
    console.log('[seed-kv] Seeding access token into KV (55min TTL)...');
    await kvSet('lemma:access_token', accessToken, 3300); // 55 min
    console.log('  ✅ lemma:access_token stored (expires in 55min)');
  }

  console.log('\n✅ KV seeded! Vercel will now auto-refresh tokens using the stored refresh token.');
})().catch(e => { console.error('❌ Seed failed:', e.message); process.exit(1); });
