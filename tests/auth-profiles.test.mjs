import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const core = await readFile(new URL('../supabase/migrations/20261021000100_core_recipe_model.sql', import.meta.url), 'utf8');
const auth = await readFile(new URL('../supabase/migrations/20261021000200_auth_profiles.sql', import.meta.url), 'utf8');
const A = '00000000-0000-0000-0000-000000000001';
const B = '00000000-0000-0000-0000-000000000002';
const C = '00000000-0000-0000-0000-000000000003';

test('profile migration backfills, preserves profiles, and provisions new accounts privately', async t => {
  const db = new PGlite(); t.after(() => db.close());
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to authenticated;
    insert into auth.users values ('${A}'), ('${B}');
  `);
  await db.exec(core);
  await db.query("insert into public.users (id, display_name) values ($1, 'Keep my name')", [A]);
  await db.exec(auth);
  assert.equal((await db.query('select * from public.users')).rows.length, 2);
  assert.equal((await db.query('select display_name from public.users where id = $1', [A])).rows[0].display_name, 'Keep my name');
  await db.query('insert into auth.users values ($1)', [C]);
  assert.equal((await db.query('select * from public.users where id = $1', [C])).rows.length, 1);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [C]);
  await db.exec('set role authenticated');
  assert.deepEqual((await db.query('select id from public.users')).rows, [{ id: C }]);
  await assert.rejects(() => db.query('insert into public.users (id) values ($1)', [C]), e => e.code === '42501');
  await assert.rejects(() => db.query('select public.create_user_profile()'), e => e.code === '42501');
  await db.query("update public.users set display_name = 'New cook' where id = $1", [C]);
  assert.equal((await db.query('select display_name from public.users')).rows[0].display_name, 'New cook');
  await db.exec('reset role');
  await db.query('delete from auth.users where id = $1', [C]);
  assert.equal((await db.query('select * from public.users where id = $1', [C])).rows.length, 0);
});
