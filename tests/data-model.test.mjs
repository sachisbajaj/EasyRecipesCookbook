import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const migration = await readFile(new URL('../supabase/migrations/20261021000100_core_recipe_model.sql', import.meta.url), 'utf8');
const A = '00000000-0000-0000-0000-000000000001';
const B = '00000000-0000-0000-0000-000000000002';

async function setup(t) {
  const db = new PGlite();
  t.after(() => db.close());
  // Test-only stand-in for Supabase Auth. Production supplies these objects.
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to anon, authenticated, service_role;
    grant execute on function auth.uid() to authenticated;
    insert into auth.users values ('${A}'), ('${B}');
  `);
  await db.exec(migration);
  await login(db, A);
  await db.query('insert into public.users (id, display_name) values ($1, $2)', [A, 'Cook A']);
  const a = await recipe(db, A);
  const ingredient = (await db.query('insert into public.ingredients (recipe_id, name, quantity) values ($1, $2, $3) returning id', [a, 'Rice', 1])).rows[0].id;
  await login(db, B);
  await db.query('insert into public.users (id) values ($1)', [B]);
  const b = await recipe(db, B);
  return { db, a, b, ingredient };
}
async function login(db, user) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);
  await db.exec('set role authenticated');
}
async function recipe(db, owner) {
  return (await db.query(`insert into public.recipes (user_id, title, instructions, servings)
    values ($1, 'Weeknight rice', 'Cook rice.', 2) returning id`, [owner])).rows[0].id;
}
async function denied(db, sql, params = [], code = '42501') {
  await assert.rejects(() => db.query(sql, params), error => error.code === code);
}

test('B cannot read or mutate A records, including guessed IDs and parent changes', async t => {
  const { db, a, b, ingredient } = await setup(t);
  assert.equal((await db.query('select * from public.recipes')).rows.length, 1);
  assert.equal((await db.query('select * from public.users')).rows.length, 1);
  assert.equal((await db.query('select * from public.recipes where id = $1', [a])).rows.length, 0);
  assert.equal((await db.query('select * from public.ingredients where id = $1', [ingredient])).rows.length, 0);
  for (const sql of [
    'update public.recipes set title = \'stolen\' where id = $1 returning id',
    'delete from public.recipes where id = $1 returning id'
  ]) assert.equal((await db.query(sql, [a])).rows.length, 0);
  for (const sql of [
    'update public.ingredients set name = \'stolen\' where id = $1 returning id',
    'delete from public.ingredients where id = $1 returning id'
  ]) assert.equal((await db.query(sql, [ingredient])).rows.length, 0);
  await denied(db, "insert into public.recipes (user_id, title, instructions, servings) values ($1, 'x', 'x', 1)", [A]);
  await denied(db, "insert into public.ingredients (recipe_id, name) values ($1, 'x')", [a]);
  const own = (await db.query("insert into public.ingredients (recipe_id, name) values ($1, 'Beans') returning id", [b])).rows[0].id;
  await denied(db, 'update public.ingredients set recipe_id = $1 where id = $2', [a, own]);
  await denied(db, 'update public.recipes set user_id = $1 where id = $2', [A, b]);
  assert.equal((await db.query("update public.users set display_name = 'stolen' where id = $1 returning id", [A])).rows.length, 0);
  await login(db, A);
  assert.equal((await db.query('select * from public.recipes where id = $1', [a])).rows.length, 1);
  assert.equal((await db.query('select * from public.ingredients where id = $1', [ingredient])).rows[0].name, 'Rice');
});

test('unsigned visitors and sessions without an identity cannot access cookbook data', async t => {
  const { db } = await setup(t);
  await db.exec('reset role; set role anon');
  for (const table of ['users', 'recipes', 'ingredients']) await denied(db, `select * from public.${table}`);
  await login(db, '');
  assert.equal((await db.query('select * from public.recipes')).rows.length, 0);
  await denied(db, "insert into public.users (id) values ($1)", [A]);
});

test('constraints reject invalid recipes and ingredients, and accept optional empty values', async t => {
  const { db, b } = await setup(t);
  for (const [column, value] of [
    ['title', ' \n\t'], ['instructions', ''], ['servings', 0], ['minutes', -1],
    ['rating', 0], ['rating', 6], ['source_url', 'javascript:alert(1)'], ['source_url', 'https://']
  ]) await denied(db, `update public.recipes set ${column} = $1 where id = $2`, [value, b], '23514');
  await db.query('update public.recipes set rating = 5, source_url = $1 where id = $2', ['https://example.com/recipe', b]);
  await db.query('update public.recipes set rating = null, minutes = null, source_url = null where id = $1', [b]);
  for (const value of ['0', '-1', 'NaN', 'Infinity'])
    await denied(db, "insert into public.ingredients (recipe_id, name, quantity) values ($1, 'Rice', $2)", [b, value], '23514');
  await denied(db, "insert into public.ingredients (recipe_id, name) values ($1, '  ')", [b], '23514');
  await db.query("insert into public.ingredients (recipe_id, name) values ($1, 'Salt')", [b]);
});

test('owners can edit and delete their recipes; recipe and account deletions cascade', async t => {
  const { db, a, b } = await setup(t);
  await db.exec('reset role');
  await db.query("alter table public.recipes disable trigger recipes_updated_at");
  await db.query("update public.recipes set updated_at = '2000-01-01' where id = $1", [a]);
  await db.query("alter table public.recipes enable trigger recipes_updated_at");
  await login(db, A);
  const before = (await db.query('select updated_at from public.recipes where id = $1', [a])).rows[0].updated_at;
  await db.query("update public.recipes set title = 'Improved rice' where id = $1", [a]);
  const after = (await db.query('select title, updated_at from public.recipes where id = $1', [a])).rows[0];
  assert.equal(after.title, 'Improved rice');
  assert.ok(new Date(after.updated_at) > new Date(before));
  await db.query('delete from public.recipes where id = $1', [a]);
  assert.equal((await db.query('select * from public.ingredients')).rows.length, 0);
  await db.exec('reset role');
  assert.equal((await db.query('select * from public.ingredients')).rows.length, 0);
  await login(db, B);
  await db.query("insert into public.ingredients (recipe_id, name) values ($1, 'Beans')", [b]);
  await db.exec('reset role');
  await db.query('delete from auth.users where id = $1', [B]);
  assert.equal((await db.query('select * from public.users where id = $1', [B])).rows.length, 0);
  assert.equal((await db.query('select * from public.recipes where id = $1', [b])).rows.length, 0);
  assert.equal((await db.query('select * from public.ingredients where recipe_id = $1', [b])).rows.length, 0);
});
