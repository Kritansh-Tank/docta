#!/usr/bin/env node
/**
 * Runs before `npm run dev`.
 * Reads the refresh token from ~/.lemma/config.json and calls the
 * SuperTokens refresh endpoint to get a fresh access token.
 * Writes the new token into .env.local — no manual token updates needed.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

const ENV_FILE = path.join(__dirname, '..', '.env.local');
const CLI_CONFIG = path.join(os.homedir(), '.lemma', 'config.json');
const ST_REFRESH_URL = 'https://api.lemma.work/st/auth/session/refresh';

function readCliConfig() {
  try {
    const raw = fs.readFileSync(CLI_CONFIG, 'utf8');
    const cfg = JSON.parse(raw);
    const active = cfg?.active_server ?? 'default';
    const server = cfg?.servers?.[active];
    const auth = server?.auth ?? server;
    return {
      accessToken: auth?.access_token ?? auth?.token ?? server?.token ?? '',
      refreshToken: auth?.refresh_token ?? server?.refresh_token ?? '',
    };
  } catch (e) {
    console.warn('[predev] Could not read CLI config:', e.message);
    return null;
  }
}

function isExpiredOrExpiringSoon(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return (payload.exp * 1000) - Date.now() < 5 * 60 * 1000;
  } catch { return true; }
}

function httpsPost(url, headers) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname,
      method: 'POST',
      headers,
      rejectUnauthorized: false,
    }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function refreshToken(refreshToken) {
  const resp = await httpsPost(ST_REFRESH_URL, {
    'Cookie': `sRefreshToken=${encodeURIComponent(refreshToken)}`,
    'Content-Type': 'application/json',
    'st-auth-mode': 'cookie',
  });

  if (resp.status !== 200) {
    console.warn(`[predev] SuperTokens refresh returned ${resp.status}`);
    return null;
  }

  // Parse Set-Cookie for sAccessToken
  const setCookie = [resp.headers['set-cookie']].flat().join('; ');
  const aMatch = setCookie.match(/sAccessToken=([^;]+)/);
  const rMatch = setCookie.match(/sRefreshToken=([^;]+)/);

  const newAccess = aMatch ? decodeURIComponent(aMatch[1]) : null;
  const newRefresh = rMatch ? decodeURIComponent(rMatch[1]) : null;

  if (newRefresh) {
    // Rotate refresh token in CLI config
    try {
      const raw = fs.readFileSync(CLI_CONFIG, 'utf8');
      const cfg = JSON.parse(raw);
      const active = cfg?.active_server ?? 'default';
      const server = cfg?.servers?.[active];
      if (server?.auth) {
        server.auth.access_token = newAccess;
        server.auth.refresh_token = newRefresh;
      }
      if (server) {
        server.token = newAccess;
        server.refresh_token = newRefresh;
      }
      fs.writeFileSync(CLI_CONFIG, JSON.stringify(cfg, null, 2), 'utf8');
    } catch {}
  }

  return newAccess;
}

(async () => {
  const cli = readCliConfig();
  if (!cli) { console.warn('[predev] No CLI config found, skipping token refresh'); process.exit(0); }

  // If current token is still valid, no need to refresh
  if (cli.accessToken && !isExpiredOrExpiringSoon(cli.accessToken)) {
    console.log('[predev] ✅ Token still valid, updating .env.local');
    let env = fs.readFileSync(ENV_FILE, 'utf8');
    env = env.replace(/^NEXT_PUBLIC_LEMMA_TOKEN=.*/m, `NEXT_PUBLIC_LEMMA_TOKEN=${cli.accessToken}`);
    env = env.replace(/^LEMMA_TOKEN=.*/m, `LEMMA_TOKEN=${cli.accessToken}`);
    fs.writeFileSync(ENV_FILE, env, 'utf8');
    return;
  }

  if (!cli.refreshToken) {
    console.warn('[predev] No refresh token in CLI config. Run: lemma auth login');
    process.exit(0);
  }

  console.log('[predev] Refreshing Lemma token via SuperTokens API...');
  const fresh = await refreshToken(cli.refreshToken);

  if (!fresh) {
    console.warn('[predev] Token refresh failed. Run: lemma auth login');
    process.exit(0);
  }

  let env = fs.readFileSync(ENV_FILE, 'utf8');
  env = env.replace(/^NEXT_PUBLIC_LEMMA_TOKEN=.*/m, `NEXT_PUBLIC_LEMMA_TOKEN=${fresh}`);
  env = env.replace(/^LEMMA_TOKEN=.*/m, `LEMMA_TOKEN=${fresh}`);
  fs.writeFileSync(ENV_FILE, env, 'utf8');
  console.log('[predev] ✅ .env.local refreshed with fresh Lemma token (via SuperTokens)');
})();
