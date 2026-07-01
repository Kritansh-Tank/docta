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
    // Restore org from localStorage
    const savedOrgId = localStorage.getItem(LS_ORG_KEY);
    const savedOrgName = localStorage.getItem(LS_ORG_NAME_KEY);
    if (savedOrgId) {
      setOrgState({ id: savedOrgId, name: savedOrgName ?? '' });
    }

    // Load current user (best-effort)
    lemmaClient.users.current().then((u: any) => {
      setUser(u);
    }).catch(() => {
      // Not authed via SuperTokens — that's fine, proxy handles auth
    }).finally(() => {
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
