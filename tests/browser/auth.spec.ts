import { test, expect, type Page } from '@playwright/test';

function account(email = 'cook@example.com', id = '00000000-0000-0000-0000-000000000001') {
  return { id, aud: 'authenticated', role: 'authenticated', email, email_confirmed_at: new Date().toISOString(), app_metadata: { provider: 'email' }, user_metadata: {}, identities: [], created_at: new Date().toISOString() };
}
const token = (user: ReturnType<typeof account>) => {
  const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: user.id, email: user.email, role: 'authenticated', exp: Math.floor(Date.now()/1000)+3600 })}.test-signature`;
};
async function mockAuth(page: Page) {
  let current = account();
  await page.route('https://cookbook-test.supabase.co/**', async route => {
    const url = new URL(route.request().url());
    const data = route.request().postDataJSON() ?? {};
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 200, headers });
    if (url.pathname.endsWith('/signup')) return route.fulfill({ json: account(data.email), headers });
    if (url.pathname.endsWith('/token')) {
      if (data.email) current = account(data.email);
      return route.fulfill({ json: { access_token: token(current), refresh_token: 'test-refresh', token_type: 'bearer', expires_in: 3600, user: current }, headers });
    }
    if (url.pathname.endsWith('/user')) return route.fulfill({ json: current, headers });
    if (url.pathname.endsWith('/logout')) return route.fulfill({ status: 204, headers });
    return route.fulfill({ status: 404, json: { message: 'Unexpected test request' }, headers });
  });
}

test('desktop: login, refresh, logout, and protected route using the real client with mocked HTTP', async ({ page }) => {
  await mockAuth(page); await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/cookbook');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await page.screenshot({ path: 'test-results/login-desktop.png', fullPage: true });
  await page.getByLabel('Email address').fill('cook@example.com');
  await page.getByLabel('Password', { exact: true }).fill('password123');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page.getByText('cook@example.com', { exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByText('cook@example.com', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/cookbook-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await page.goto('/cookbook');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByText('cook@example.com', { exact: true })).toHaveCount(0);
});

test('mobile: signup confirmation and error callback remain readable without overflow', async ({ page }) => {
  await mockAuth(page); await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/signup');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByText('Enter a valid email address.')).toBeVisible();
  await page.getByLabel('Email address').fill('new@example.com');
  await page.getByLabel('Password', { exact: true }).fill('password123');
  await page.screenshot({ path: 'test-results/signup-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.goto('/auth/callback#error=access_denied&error_description=Link_expired');
  await expect(page.getByRole('heading', { name: 'That link didn’t work' })).toBeVisible();
  expect(new URL(page.url()).hash).toBe('');
});

test('valid email confirmation establishes a session and removes tokens from the URL', async ({ page }) => {
  await mockAuth(page);
  await page.goto(`/auth/callback#access_token=${token(account())}&refresh_token=test-refresh&expires_in=3600&token_type=bearer&type=signup`);
  await expect(page.getByText('cook@example.com', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/cookbook$/);
});
