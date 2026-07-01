import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';

// Lemma uses a self-signed cert in some regions
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

export const runtime = 'nodejs';
export const maxDuration = 60;

// ─── Constants ────────────────────────────────────────────────────────────────

const LEMMA_BASE = 'https://api.lemma.work';
const ST_REFRESH_URL = `${LEMMA_BASE}/st/auth/session/refresh`;
const LEMMA_BIN = process.env.LEMMA_BIN || 'C:\\Users\\tankk\\.local\\bin\\lemma.exe';

// KV mode: set when Vercel KV / Upstash Redis env vars are present
const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const USE_KV = !!(KV_URL && KV_TOKEN);
const IS_VERCEL = !!process.env.VERCEL;

// In-memory cache (works for warm serverless instances and local dev)
let cachedToken: string = process.env.LEMMA_TOKEN ?? '';
let tokenFetchedAt = 0;
let refreshInFlight: Promise<string> | null = null;

// ─── JWT helpers ─────────────────────────────────────────────────────────────

function getTokenExp(token: string): number {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    return (payload.exp ?? 0) * 1000;
  } catch { return 0; }
}

function isExpiringSoon(token: string, bufferMs = 5 * 60 * 1000): boolean {
  const exp = getTokenExp(token);
  return !exp || exp - Date.now() < bufferMs;
}

// ─── Vercel KV REST helpers ───────────────────────────────────────────────────

async function kvGet(key: string): Promise<string | null> {
  if (!USE_KV) return null;
  try {
    const res = await fetch(`${KV_URL}/get/${key}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
    });
    const json = await res.json() as { result: string | null };
    return json.result ?? null;
  } catch { return null; }
}

async function kvSet(key: string, value: string, exSeconds?: number): Promise<void> {
  if (!USE_KV) return;
  try {
    const query = exSeconds ? `?ex=${exSeconds}` : '';
    await fetch(`${KV_URL}/set/${key}/${encodeURIComponent(value)}${query}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
    });
  } catch { /* non-fatal */ }
}

// ─── SuperTokens refresh ──────────────────────────────────────────────────────

async function refreshViaSupertokens(refreshToken: string): Promise<{ access: string; refresh: string | null } | null> {
  // Try raw first (no encoding), then URL-encoded
  // HTTP cookies accept +/= without encoding; encodeURIComponent may corrupt the token
  const attempts = [refreshToken, encodeURIComponent(refreshToken)];

  for (const tokenValue of attempts) {
    try {
      const resp = await fetch(ST_REFRESH_URL, {
        method: 'POST',
        headers: {
          'Cookie': `sRefreshToken=${tokenValue}`,
          'Content-Type': 'application/json',
          'st-auth-mode': 'cookie',
          'rid': 'anti-csrf',
        },
      });

      const bodyText = await resp.text();
      if (!resp.ok) {
        console.warn(`[Docta Proxy] ST refresh attempt failed: ${resp.status} — ${bodyText.slice(0, 200)}`);
        continue;
      }

      const setCookies: string[] = (resp.headers as any).getSetCookie?.() ?? [resp.headers.get('set-cookie') ?? ''];
      let newAccess: string | null = null;
      let newRefresh: string | null = null;

      for (const c of setCookies) {
        const aMatch = c.match(/sAccessToken=([^;]+)/);
        const rMatch = c.match(/sRefreshToken=([^;]+)/);
        if (aMatch) newAccess = decodeURIComponent(aMatch[1]);
        if (rMatch) newRefresh = decodeURIComponent(rMatch[1]);
      }

      if (!newAccess) {
        try {
          const body = JSON.parse(bodyText) as any;
          newAccess = body?.accessToken ?? body?.access_token ?? null;
        } catch { /* not JSON */ }
      }

      if (newAccess) {
        console.log('[Docta Proxy] ✅ Token refreshed via SuperTokens API');
        return { access: newAccess, refresh: newRefresh };
      }
    } catch (e: any) {
      console.error('[Docta Proxy] SuperTokens refresh error:', e.message);
    }
  }
  return null;
}


// ─── Token provider ───────────────────────────────────────────────────────────

async function doRefresh(): Promise<string> {
  // ── KV mode (Vercel production) ─────────────────────────────────────────
  if (USE_KV) {
    // Try cached access token from KV first
    const kvAccess = await kvGet('lemma:access_token');
    if (kvAccess && !isExpiringSoon(kvAccess)) {
      cachedToken = kvAccess;
      tokenFetchedAt = Date.now();
      return kvAccess;
    }

    // Access token missing/expired → use refresh token from KV
    const kvRefresh = await kvGet('lemma:refresh_token');
    if (kvRefresh) {
      const result = await refreshViaSupertokens(kvRefresh);
      if (result) {
        await kvSet('lemma:access_token', result.access, 3300); // 55 min TTL
        if (result.refresh) await kvSet('lemma:refresh_token', result.refresh);
        cachedToken = result.access;
        tokenFetchedAt = Date.now();
        return result.access;
      }
    }

    // KV refresh failed → fall through to env var
    console.warn('[Docta Proxy] KV refresh failed, using LEMMA_TOKEN env var');
    const envToken = process.env.LEMMA_TOKEN ?? cachedToken;
    cachedToken = envToken;
    tokenFetchedAt = Date.now();
    return envToken;
  }

  // ── CLI mode (local dev) ────────────────────────────────────────────────
  if (!IS_VERCEL && LEMMA_BIN) {
    try {
      const fresh = execSync(`"${LEMMA_BIN}" auth print-token`, {
        encoding: 'utf8',
        timeout: 20_000,
        env: { ...process.env, PYTHONHTTPSVERIFY: '0' },
      }).trim();

      if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(fresh) && !isExpiringSoon(fresh)) {
        cachedToken = fresh;
        tokenFetchedAt = Date.now();
        console.log('[Docta Proxy] ✅ Token refreshed via CLI');
        return fresh;
      }
      console.warn('[Docta Proxy] CLI returned invalid/expired token');
    } catch (err: any) {
      console.error('[Docta Proxy] CLI refresh failed:', err.message);
    }
  }

  return cachedToken;
}

async function getFreshToken(): Promise<string> {
  const needsRefresh =
    !cachedToken ||
    isExpiringSoon(cachedToken) ||
    Date.now() - tokenFetchedAt > 20 * 60 * 1000;

  if (!needsRefresh) return cachedToken;

  // Mutex: one refresh at a time
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

// ─── HTTP verbs ───────────────────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await params);
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await params);
}
export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await params);
}
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await params);
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await params);
}

// ─── Core proxy ───────────────────────────────────────────────────────────────

async function proxy(request: NextRequest, params: { path: string[] }) {
  const routePath = params.path.join('/');
  const search = request.nextUrl.search ?? '';
  const targetUrl = `${LEMMA_BASE}/${routePath}${search}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${await getFreshToken()}`,
  };

  const ct = request.headers.get('content-type');
  if (ct) headers['Content-Type'] = ct;

  let body: BodyInit | undefined;
  if (!['GET', 'HEAD', 'DELETE'].includes(request.method)) {
    const buf = await request.arrayBuffer();
    if (buf.byteLength > 0) body = buf;
  }

  let response: Response;
  try {
    response = await fetch(targetUrl, { method: request.method, headers, body });
  } catch (err: any) {
    console.error('[Docta Proxy] fetch failed:', err);
    return NextResponse.json({ error: 'Proxy fetch failed' }, { status: 502 });
  }

  // On 401: force full re-fetch and retry once
  if (response.status === 401) {
    console.warn('[Docta Proxy] 401 — forcing token refresh...');
    tokenFetchedAt = 0;
    cachedToken = '';
    headers['Authorization'] = `Bearer ${await getFreshToken()}`;
    try {
      response = await fetch(targetUrl, { method: request.method, headers, body });
    } catch (retryErr) {
      console.error('[Docta Proxy] retry failed:', retryErr);
      return NextResponse.json({ error: 'Proxy retry failed' }, { status: 502 });
    }
  }

  if (response.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  const resBody = await response.text();
  const resHeaders = new Headers();
  ['content-type', 'cache-control', 'etag'].forEach(h => {
    const v = response.headers.get(h);
    if (v) resHeaders.set(h, v);
  });

  return new NextResponse(resBody, { status: response.status, headers: resHeaders });
}
