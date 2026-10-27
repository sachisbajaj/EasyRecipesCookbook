import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useAuth } from './auth/AuthProvider';
import { RecipePages } from './recipes/RecipePages';
import type { RecipeService } from './recipes/model';
import { friendlyError } from './auth/service';

function BookMark() {
  return <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true"><path d="M14 7C10 4 5 5 3 6v17c4-2 8-1 11 1 3-2 7-3 11-1V6c-2-1-7-2-11 1Zm0 0v17" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>;
}
function Brand() { return <Link className="brand" to="/" aria-label="Easy Recipes Cookbook home"><BookMark /><span>easy recipes<span className="brand-sub">THE WEEKNIGHT COOKBOOK</span></span></Link>; }
function Illustration() {
  return <div className="illustration" aria-hidden="true"><svg viewBox="0 0 420 240" fill="none">
    <ellipse cx="211" cy="209" rx="145" ry="13" fill="#dfcdb8" opacity=".5"/>
    <path d="M83 100c0 78 47 103 127 103s127-25 127-103" fill="#ad503b"/>
    <ellipse cx="210" cy="100" rx="127" ry="39" fill="#edd7b5"/>
    <ellipse cx="210" cy="98" rx="110" ry="28" fill="#faf0dd"/>
    <path d="M126 99c26-35 32 30 61-4s31 29 55-4 31 25 53-1M143 110c19-26 30 25 52-1s31 23 48-2 27 14 40-3" stroke="#d8ac60" strokeWidth="7" strokeLinecap="round"/>
    <path d="M222 86c-26-37 9-51 17-38 18-19 35 16-17 38Z" fill="#657953"/>
    <circle cx="169" cy="85" r="10" fill="#bd6148"/><circle cx="264" cy="105" r="8" fill="#bd6148"/>
    <path d="m295 85 56-65" stroke="#706551" strokeWidth="7" strokeLinecap="round"/>
    <path d="M168 47c-12-15 13-20 0-35m39 30c-12-15 13-20 0-35" stroke="#bda98e" strokeWidth="2" strokeLinecap="round"/>
    <path d="M111 153c19 22 43 30 72 32" stroke="#d78569" strokeWidth="3" strokeLinecap="round"/>
  </svg></div>;
}
function Frame({ children }: { children: React.ReactNode }) {
  return <div className="page"><header><Brand /><span className="header-note">Good food. Worth remembering.</span></header><main>{children}</main><footer>A little less “what’s for dinner?” <span> A little more “let’s make that again.”</span></footer></div>;
}
function Intro() {
  return <section className="intro"><p className="eyebrow">YOUR EVERYDAY FAVORITES, ALL TOGETHER</p><h1>Good dinners<br/>deserve a <em>repeat.</em></h1><p className="intro-copy">A little home for the meals you love, the tweaks that made them better, and the next weeknight win.</p><Illustration /><div className="caption"><span className="small-star">✧</span> Made for real life, not perfect kitchens.</div></section>;
}
function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const signup = mode === 'signup';
  const { service, session } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<{ email?: string; password?: string }>({});
  const [sent, setSent] = useState(false);
  if (session) return <Navigate to="/cookbook" replace />;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !service) return;
    const invalid: typeof fields = {};
    const cleanEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) invalid.email = 'Enter a valid email address.';
    if (!password) invalid.password = 'Enter your password.';
    else if (signup && password.length < 8) invalid.password = 'Use at least 8 characters for your password.';
    setFields(invalid); setError('');
    if (Object.keys(invalid).length) return;
    setBusy(true);
    try {
      const result = signup
        ? await service.signUp(cleanEmail, password, `${window.location.origin}/auth/callback`)
        : await service.signIn(cleanEmail, password);
      if (result.error) { setError(friendlyError(result.error, mode)); return; }
      setPassword('');
      if (signup && !result.data.session) setSent(true);
      else navigate('/cookbook', { replace: true });
    } catch { setError(friendlyError(null, mode)); }
    finally { setBusy(false); }
  }
  return <div className="auth-layout"><Intro /><section className="auth-card" aria-labelledby="form-title">
    {sent ? <><span className="card-icon">✉</span><p className="eyebrow">ONE LAST THING</p><h2 id="form-title">Check your inbox</h2><p>If confirmation is needed, we’ve sent a link to <strong>{email.trim()}</strong>. Open it to finish setting up your cookbook.</p><p className="muted">Check your spam folder too. Already have an account? You can log in instead.</p><Link className="primary button-link" to="/login">Back to login</Link></> : <>
      <p className="eyebrow">{signup ? 'MAKE YOURSELF AT HOME' : 'YOUR COOKBOOK IS WAITING'}</p>
      <h2 id="form-title">{signup ? 'Start your cookbook' : 'Welcome back'}</h2>
      <p className="card-copy">{signup ? 'Keep your weeknight favorites in one cozy place.' : 'Let’s get back to the good stuff.'}</p>
      {!service && <p role="status" className="notice">Account access isn’t available yet. Please try again later.</p>}
      <form onSubmit={submit} noValidate>
        <label htmlFor="email">Email address</label>
        <input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={event => { setEmail(event.target.value); setFields(value => ({ ...value, email: undefined })); }} disabled={busy} aria-invalid={Boolean(fields.email)} aria-describedby={fields.email ? 'email-error' : undefined} required />
        {fields.email && <p id="email-error" className="field-error">{fields.email}</p>}
        <label htmlFor="password">Password</label>
        <div className="password-input"><input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete={signup ? 'new-password' : 'current-password'} value={password} onChange={event => { setPassword(event.target.value); setFields(value => ({ ...value, password: undefined })); }} disabled={busy} aria-invalid={Boolean(fields.password)} aria-describedby={fields.password ? 'password-error' : signup ? 'password-help' : undefined} required /><button type="button" className="show-password" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? 'Hide' : 'Show'}</button></div>
        {fields.password ? <p id="password-error" className="field-error">{fields.password}</p> : signup && <p id="password-help" className="hint">At least 8 characters.</p>}
        {error && <p role="alert" className="error">{error}</p>}
        <button className="primary" type="submit" disabled={busy || !service}>{busy ? (signup ? 'Creating your account…' : 'Logging in…') : (signup ? 'Create account' : 'Log in')} <span aria-hidden="true">→</span></button>
      </form>
      <p className="switch-form">{signup ? 'Already have a cookbook?' : 'New around here?'} <Link to={signup ? '/login' : '/signup'}>{signup ? 'Log in' : 'Create an account'}</Link></p>
      <p className="privacy-note">Your recipes. Your notes. Just for you.</p>
    </>}
  </section></div>;
}
function Cookbook({ recipeService }: { recipeService: RecipeService | null }) {
  const { session, service, clearSession } = useAuth();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (!session) return <Navigate to="/login" replace />;
  async function logout() {
    if (!service || busy) return;
    setBusy(true); setError('');
    try {
      const result = await service.signOut();
      if (result.error) setError(friendlyError(result.error, 'logout'));
      else clearSession();
    } catch { setError(friendlyError(null, 'logout')); }
    finally { setBusy(false); }
  }
  return <section className="cookbook"><div className="account-bar"><p>Signed in as <strong>{session.user.email}</strong></p><button className="secondary" onClick={logout} disabled={busy}>{busy ? 'Logging out…' : 'Log out'}</button></div>{error && <p className="error" role="alert">{error}</p>}<RecipePages service={recipeService} owner={session.user.id}/></section>;
}
function Confirmation({ failed }: { failed: boolean }) {
  const { session } = useAuth();
  useEffect(() => { window.history.replaceState(null, '', window.location.pathname); }, []);
  if (!failed && session) return <Navigate to="/cookbook" replace />;
  return <section className="message-card"><h1>{failed ? 'That link didn’t work' : 'Ready to log in?'}</h1><p>{failed ? 'Your confirmation link may have expired or already been used. Try logging in if you confirmed your email, or sign up again to request a new confirmation.' : 'If you’ve confirmed your email, log in to open your cookbook.'}</p><Link className="primary button-link" to="/login">Go to login</Link><Link to="/signup">Back to signup</Link></section>;
}
export function App({ confirmationFailed = false, recipeService = null }: { confirmationFailed?: boolean; recipeService?: RecipeService | null }) {
  const { loading, failed, retry, session } = useAuth();
  return <Frame>{loading ? <p role="status" className="loading">Opening your cookbook…</p> : failed ? <section className="message-card"><h1>Let’s try that again</h1><p role="alert">We couldn’t restore your session. Check your connection and retry.</p><button className="primary" onClick={retry}>Try again</button></section> : <Routes>
    <Route path="/" element={<Navigate to={session ? '/cookbook' : '/login'} replace />} />
    <Route path="/login" element={<AuthForm key="login" mode="login" />} />
    <Route path="/signup" element={<AuthForm key="signup" mode="signup" />} />
    <Route path="/auth/callback" element={<Confirmation failed={confirmationFailed} />} />
    <Route path="/cookbook/*" element={<Cookbook recipeService={recipeService} key={session?.user.id ?? 'signed-out'} />} />
    <Route path="*" element={<section className="message-card"><h1>A page out of place</h1><Link to="/">Back to your cookbook</Link></section>} />
  </Routes>}</Frame>;
}
