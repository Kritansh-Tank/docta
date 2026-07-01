import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';

// Disable SSL verification (Lemma uses self-signed cert in some regions)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

export const runtime = 'nodejs';
export const maxDuration = 60;

const LEMMA_BASE = 'https://api.lemma.work';
const LEMMA_BIN = process.env.LEMMA_BIN || 'C:\\Users\\tankk\\.local\\bin\\lemma.exe';
const IS_VERCEL = !!process.env.VERCEL;

let cachedToken: string = process.env.LEMMA_TOKEN ?? '';
let tokenFetchedAt = 0;
let refreshPromise: Promise<string> | null = null; // mutex: one refresh at a time

// ─── JWT helpers ─────────────────────────────────────────────────────────────

function getTokenExp(token: string): number {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    return (payload.exp ?? 0) * 1000;
  } catch { return 0; }
}

function isExpiringSoon(token: string): boolean {
  const exp = getTokenExp(token);
  return !exp || exp - Date.now() < 5 * 60 * 1000; // < 5 min left
}

// ─── Refresh via CLI ─────────────────────────────────────────────────────────

async function doRefresh(): Promise<string> {
  if (IS_VERCEL) {
    // No CLI on Vercel — use static env token
    const t = process.env.LEMMA_TOKEN ?? cachedToken;
    cachedToken = t;
    tokenFetchedAt = Date.now();
    return t;
  }

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
    console.warn('[Docta Proxy] CLI returned invalid/expired token, keeping cached');
  } catch (err: any) {
    console.error('[Docta Proxy] CLI refresh failed:', err.message);
  }
  return cachedToken;
}

async function getFreshToken(): Promise<string> {
  const needsRefresh =
    !cachedToken ||
    isExpiringSoon(cachedToken) ||
    Date.now() - tokenFetchedAt > 20 * 60 * 1000;

  if (!needsRefresh) return cachedToken;

  // Mutex: if already refreshing, wait for the same promise
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
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

  // On 401: force re-refresh and retry once
  if (response.status === 401) {
    console.warn('[Docta Proxy] 401 received — forcing token re-refresh');
    tokenFetchedAt = 0;
    cachedToken = '';
    const newToken = await getFreshToken();
    headers['Authorization'] = `Bearer ${newToken}`;
    try {
      response = await fetch(targetUrl, { method: request.method, headers, body });
    } catch (retryErr) {
      console.error('[Docta Proxy] retry fetch failed:', retryErr);
      return NextResponse.json({ error: 'Proxy retry failed' }, { status: 502 });
    }
  }

  // 204 No Content — Response spec forbids a body
  if (response.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  const resBody = await response.text();
  const resHeaders = new Headers();
  ['content-type', 'cache-control', 'etag'].forEach((h) => {
    const v = response.headers.get(h);
    if (v) resHeaders.set(h, v);
  });

  return new NextResponse(resBody, { status: response.status, headers: resHeaders });
}
