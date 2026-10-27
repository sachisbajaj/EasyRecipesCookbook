import { createRecipeService } from '../recipes/service';
import { createClient } from '@supabase/supabase-js';
import type { AuthService } from '../auth/service';

// Read errors before the auth client processes and cleans the confirmation URL.
const callbackParameters = new URLSearchParams(window.location.hash.slice(1));
const queryParameters = new URLSearchParams(window.location.search);
export const confirmationFailed = window.location.pathname === '/auth/callback' &&
  (callbackParameters.has('error') || queryParameters.has('error'));

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
function isConfigured() {
  try {
    return Boolean(url && key && key !== 'sb_publishable_replace_me' &&
      new URL(url).hostname !== 'your-project.supabase.co' &&
      ['https:', 'http:'].includes(new URL(url).protocol));
  } catch { return false; }
}
const client = isConfigured() ? createClient(url!, key!, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' },
}) : null;

export const authService: AuthService | null = client ? {
  getSession: () => client.auth.getSession(),
  onChange: callback => {
    const { data } = client.auth.onAuthStateChange((_event, session) => callback(session));
    return () => data.subscription.unsubscribe();
  },
  signIn: (email, password) => client.auth.signInWithPassword({ email, password }),
  signUp: (email, password, redirectTo) => client.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } }),
  signOut: () => client.auth.signOut({ scope: 'local' }),
} : null;

export const recipeService = client ? createRecipeService(client) : null;
