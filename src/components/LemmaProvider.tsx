'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { lemmaClient } from '@/lib/lemma';

const LS_ORG_KEY = 'docta-org-id';
const LS_ORG_NAME_KEY = 'docta-org-name';

interface LemmaContextValue {
  user: any;
  org: { id: string; name: string } | null;
  setOrg: (org: { id: string; name: string } | null) => void;
  isReady: boolean;
}

const LemmaCtx = createContext<LemmaContextValue>({
  user: null, org: null, setOrg: () => {}, isReady: false,
});

export function LemmaProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [org, setOrgState] = useState<{ id: string; name: string } | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const savedOrgId   = localStorage.getItem(LS_ORG_KEY);
    const savedOrgName = localStorage.getItem(LS_ORG_NAME_KEY);

    // Load user, then validate the cached org still exists in the datastore
    lemmaClient.users.current().then((u: any) => {
      setUser(u);
    }).catch(() => {
      // proxy handles auth — ignore
    }).finally(async () => {
      if (savedOrgId) {
        try {
          // Verify the org record still exists
          const records = await lemmaClient.records.list('organizations');
          const stillExists = (records as unknown as any[]).some((r: any) => r.id === savedOrgId);
          if (stillExists) {
            setOrgState({ id: savedOrgId, name: savedOrgName ?? '' });
          } else {
            // Org was deleted from pod — clear stale cache
            localStorage.removeItem(LS_ORG_KEY);
            localStorage.removeItem(LS_ORG_NAME_KEY);
          }
        } catch {
          // If we can't validate (network error), trust the cache
          setOrgState({ id: savedOrgId, name: savedOrgName ?? '' });
        }
      }
      setIsReady(true);
    });
  }, []);

  const setOrg = (newOrg: { id: string; name: string } | null) => {
    setOrgState(newOrg);
    if (newOrg?.id) {
      localStorage.setItem(LS_ORG_KEY, newOrg.id);
      localStorage.setItem(LS_ORG_NAME_KEY, newOrg.name);
    } else {
      localStorage.removeItem(LS_ORG_KEY);
      localStorage.removeItem(LS_ORG_NAME_KEY);
    }
  };

  return (
    <LemmaCtx.Provider value={{ user, org, setOrg, isReady }}>
      {children}
    </LemmaCtx.Provider>
  );
}

export const useLemma = () => useContext(LemmaCtx);
