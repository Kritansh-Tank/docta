'use client';

import { LemmaClient } from 'lemma-sdk';

const POD_ID = process.env.NEXT_PUBLIC_LEMMA_POD_ID!;
const API_URL = process.env.NEXT_PUBLIC_LEMMA_API_URL!;
const AUTH_URL = process.env.NEXT_PUBLIC_LEMMA_AUTH_URL ?? 'https://api.lemma.work/st/auth';

// Singleton client — always non-null, safe to pass to hooks
export const lemmaClient = new LemmaClient({
  podId: POD_ID,
  apiUrl: API_URL,
  authUrl: AUTH_URL,
});

// Inject initial token into SuperTokens localStorage so SDK treats user as authed
if (typeof window !== 'undefined') {
  const token = process.env.NEXT_PUBLIC_LEMMA_TOKEN;
  if (token) {
    localStorage.setItem('st-last-access-token-update', JSON.stringify({
      t: token,
      ate: Date.now() + 60 * 60 * 1000,
    }));
  }
}
