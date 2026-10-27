import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { AuthProvider } from '../../src/auth/AuthProvider';
import type { AuthResult, AuthService } from '../../src/auth/service';
import { App } from '../../src/App';

const session = (email = 'a@example.com', id = 'a') => ({ user: { id, email }, access_token: 'fake', refresh_token: 'fake', token_type: 'bearer', expires_in: 3600 } as Session);
function fake(initial: Session | null = null) {
  const listeners = new Set<(s: Session | null) => void>();
  const emit = (s: Session | null) => { for (const listener of listeners) listener(s); };
  const service: AuthService = {
    getSession: vi.fn(async () => ({ data: { session: initial }, error: null })),
    onChange: fn => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    signIn: vi.fn(async email => { const next = session(email); emit(next); return { data: { session: next }, error: null }; }),
    signUp: vi.fn(async () => ({ data: { session: null }, error: null })),
    signOut: vi.fn(async () => { emit(null); return { error: null }; }),
  };
  return { service, emit };
}
function show(service: AuthService | null, route = '/login', failed = false) {
  return render(<MemoryRouter initialEntries={[route]}><AuthProvider service={service}><App confirmationFailed={failed}/></AuthProvider></MemoryRouter>);
}
async function fill(user: ReturnType<typeof userEvent.setup>, password = 'password123') {
  await user.type(await screen.findByLabelText('Email address'), 'a@example.com');
  await user.type(screen.getByLabelText('Password', { exact: true }), password);
}

describe('account flows', () => {
  it('redirects a signed-out visitor away from the cookbook', async () => {
    show(fake().service, '/cookbook');
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeVisible();
    expect(screen.queryByText('Signed in as')).not.toBeInTheDocument();
  });
  it('restores a session and clears the private screen on logout', async () => {
    const user = userEvent.setup(); const { service } = fake(session()); show(service, '/cookbook');
    expect(await screen.findByText('a@example.com')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Log out' }));
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeVisible();
    expect(screen.queryByText('a@example.com')).not.toBeInTheDocument();
  });
  it('validates signup fields before calling the service', async () => {
    const user = userEvent.setup(); const { service } = fake(); show(service, '/signup');
    await user.click(await screen.findByRole('button', { name: 'Create account' }));
    expect(screen.getByText('Enter a valid email address.')).toBeVisible();
    expect(service.signUp).not.toHaveBeenCalled();
    await fill(user, 'short'); await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByText('Use at least 8 characters for your password.')).toBeVisible();
    expect(service.signUp).not.toHaveBeenCalled();
  });
  it('shows confirmation instructions and sends the callback URL', async () => {
    const user = userEvent.setup(); const { service } = fake(); show(service, '/signup'); await fill(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByRole('heading', { name: 'Check your inbox' })).toBeVisible();
    expect(service.signUp).toHaveBeenCalledWith('a@example.com', 'password123', `${window.location.origin}/auth/callback`);
    expect(screen.queryByLabelText('Password', { exact: true })).not.toBeInTheDocument();
  });
  it('opens the cookbook when signup immediately returns a session', async () => {
    const user = userEvent.setup(); const { service, emit } = fake();
    service.signUp = vi.fn(async () => { const next = session(); emit(next); return { data: { session: next }, error: null }; });
    show(service, '/signup'); await fill(user); await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('a@example.com')).toBeVisible();
  });
  it('logs in and removes old account state when the identity changes', async () => {
    const user = userEvent.setup(); const { service, emit } = fake(); show(service); await fill(user);
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByText('a@example.com')).toBeVisible();
    act(() => emit(session('b@example.com', 'b')));
    expect(await screen.findByText('b@example.com')).toBeVisible();
    expect(screen.queryByText('a@example.com')).not.toBeInTheDocument();
  });
  it('shows a friendly error for invalid credentials without echoing server details', async () => {
    const user = userEvent.setup(); const { service } = fake();
    service.signIn = vi.fn(async () => ({ data: { session: null }, error: { code: 'invalid_credentials', message: 'SECRET INTERNAL ERROR' } }));
    show(service); await fill(user); await user.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('That email and password don’t match.');
    expect(screen.queryByText('SECRET INTERNAL ERROR')).not.toBeInTheDocument();
  });
  it('disables duplicate submits while a login is pending', async () => {
    const user = userEvent.setup(); const { service } = fake();
    let resolve!: (v: AuthResult) => void;
    service.signIn = vi.fn(() => new Promise<AuthResult>(r => { resolve = r; }));
    show(service); await fill(user); await user.click(screen.getByRole('button', { name: 'Log in' }));
    expect(screen.getByRole('button', { name: /Logging in/ })).toBeDisabled();
    await act(async () => resolve({ data: { session: null }, error: { message: 'offline' } }));
    expect(await screen.findByRole('alert')).toBeVisible();
  });
  it('keeps logout failure visible and allows retry', async () => {
    const user = userEvent.setup(); const { service } = fake(session());
    service.signOut = vi.fn(async () => ({ error: { message: 'offline' } }));
    show(service, '/cookbook'); await user.click(await screen.findByRole('button', { name: 'Log out' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('We couldn’t log you out');
    expect(screen.getByText('a@example.com')).toBeVisible();
  });
  it('does not restore an old session after a newer signed-out event', async () => {
    const { service, emit } = fake(); let resolve!: (v: AuthResult) => void;
    service.getSession = vi.fn(() => new Promise<AuthResult>(r => { resolve = r; }));
    show(service, '/cookbook'); act(() => emit(null));
    await act(async () => resolve({ data: { session: session() }, error: null }));
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeVisible();
    expect(screen.queryByText('a@example.com')).not.toBeInTheDocument();
  });
  it('offers retry when session restoration fails', async () => {
    const user = userEvent.setup(); const { service } = fake();
    service.getSession = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ data: { session: null }, error: null });
    show(service); await user.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeVisible();
  });
  it('handles valid and expired confirmation callbacks', async () => {
    const view = show(fake(session()).service, '/auth/callback');
    expect(await screen.findByText('a@example.com')).toBeVisible(); view.unmount();
    show(fake().service, '/auth/callback', true);
    expect(await screen.findByRole('heading', { name: 'That link didn’t work' })).toBeVisible();
  });
  it('shows an unavailable state without configuration, rather than accepting fake accounts', async () => {
    show(null);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Log in' })).toBeDisabled());
    expect(screen.getByRole('status')).toHaveTextContent('Account access isn’t available yet');
  });
});
