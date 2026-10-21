import type { Session } from '@supabase/supabase-js';

export type AuthFailure = { code?: string; message: string };
export type AuthResult = { data: { session: Session | null }; error: AuthFailure | null };
export interface AuthService {
  getSession(): Promise<AuthResult>;
  onChange(callback: (session: Session | null) => void): () => void;
  signIn(email: string, password: string): Promise<AuthResult>;
  signUp(email: string, password: string, redirectTo: string): Promise<AuthResult>;
  signOut(): Promise<{ error: AuthFailure | null }>;
}

export function friendlyError(error: AuthFailure | null, action: 'login' | 'signup' | 'logout'): string {
  switch (error?.code) {
    case 'invalid_credentials': return 'That email and password don’t match. Please try again.';
    case 'email_not_confirmed': return 'Please confirm your email before logging in. Check your inbox for the confirmation link.';
    case 'user_already_exists': return 'Please try logging in with this email instead.';
    case 'weak_password': return 'Choose a stronger password with at least 8 characters. Your account may require a mix of letters, numbers, and symbols.';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit': return 'Too many attempts. Please wait a few minutes and try again.';
    case 'signup_disabled': return 'New accounts aren’t available right now. Please try again later.';
    default: return action === 'logout'
      ? 'We couldn’t log you out. Check your connection and try again.'
      : `We couldn’t ${action === 'login' ? 'log you in' : 'create your account'}. Check your connection and try again.`;
  }
}
