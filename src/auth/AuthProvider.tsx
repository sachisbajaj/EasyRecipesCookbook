import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { AuthService } from './service';

type AuthState = {
  service: AuthService | null; session: Session | null; loading: boolean;
  failed: boolean; retry: () => void; clearSession: () => void;
};
const Context = createContext<AuthState | null>(null);
export function AuthProvider({ service, children }: { service: AuthService | null; children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(service));
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!service) { setLoading(false); setSession(null); return; }
    let active = true;
    let receivedEvent = false;
    setLoading(true);
    setFailed(false);
    const unsubscribe = service.onChange(next => {
      if (!active) return;
      receivedEvent = true;
      setSession(next);
      setLoading(false);
      setFailed(false);
    });
    service.getSession().then(({ data, error }) => {
      // A later auth event takes precedence over an older restoration request.
      if (!active || receivedEvent) return;
      setSession(error ? null : data.session);
      setFailed(Boolean(error));
      setLoading(false);
    }).catch(() => {
      if (!active || receivedEvent) return;
      setSession(null); setFailed(true); setLoading(false);
    });
    return () => { active = false; unsubscribe(); };
  }, [service, attempt]);
  return <Context.Provider value={{ service, session, loading, failed,
    retry: () => setAttempt(value => value + 1), clearSession: () => setSession(null) }}>
    {children}
  </Context.Provider>;
}
export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error('AuthProvider is required');
  return value;
}
