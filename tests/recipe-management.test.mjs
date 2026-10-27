import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const A = '00000000-0000-0000-0000-000000000001';
const B = '00000000-0000-0000-0000-000000000002';
const recipe = { title: 'Gnocchi', instructions: 'Pan fry. Serve.', servings: 2, minutes: 15, store: 'Trader Joe’s', source_url: 'https://example.com/recipe', rating: null };
const ingredients = [{ name: 'Gnocchi', quantity: 1, unit: 'bag' }, { name: 'Basil', quantity: null, unit: 'item' }];
async function setup(t) {
  const db = new PGlite(); t.after(() => db.close());
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth, public to authenticated;`);
  for (const file of ['20261021000100_core_recipe_model.sql', '20261021000200_auth_profiles.sql', '20261027000100_recipe_management.sql']) await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'));
  await db.exec(`insert into auth.users values ('${A}'), ('${B}');`);
  async function as(id, role = 'authenticated') { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id ?? '']); await db.exec(`set role ${role}`); }
  const save = async (r = recipe, list = ingredients, id = null) => (await db.query('select public.save_recipe($1::jsonb,$2::jsonb,$3::uuid) as id', [JSON.stringify(r), JSON.stringify(list), id])).rows[0].id;
  await as(A); return { db, as, save };
}
test('atomic creation, editing, optional values, ordered ingredients, and deletion', async t => {
  const { db, save } = await setup(t); const id = await save();
  assert.equal((await db.query('select rating from recipes')).rows[0].rating, null);
  assert.deepEqual((await db.query('select name,position from ingredients order by position')).rows, [{ name: 'Gnocchi', position: 0 }, { name: 'Basil', position: 1 }]);
  assert.equal(await save({ ...recipe, title: 'Better gnocchi', rating: 5, minutes: null, source_url: null }, [ingredients[1]], id), id);
  assert.equal((await db.query('select title,rating from recipes')).rows[0].rating, 5);
  assert.equal((await db.query('select * from ingredients')).rows.length, 1);
  await db.query('delete from recipes where id=$1', [id]);
  assert.equal((await db.query('select * from ingredients')).rows.length, 0);
});
test('failed saves roll back both recipe and ingredient changes', async t => {
  const { db, save } = await setup(t); const id = await save();
  const before = (await db.query('select * from recipes')).rows;
  const beforeIngredients = (await db.query('select * from ingredients order by position')).rows;
  await assert.rejects(() => save({ ...recipe, title: 'Should roll back' }, [ingredients[0], { name: 'Invalid', quantity: -1, unit: 'cup' }], id));
  assert.deepEqual((await db.query('select * from recipes')).rows, before);
  assert.deepEqual((await db.query('select * from ingredients order by position')).rows, beforeIngredients);
  await assert.rejects(() => save(recipe, [ingredients[0], { name: ' ', unit: 'cup' }]));
  assert.equal((await db.query('select * from recipes')).rows.length, 1);
  for (const change of [{ title: ' ' }, { instructions: '' }, { servings: 0 }, { minutes: 0 }, { rating: 6 }, { source_url: 'javascript:alert(1)' }]) await assert.rejects(() => save({ ...recipe, ...change }));
  await assert.rejects(() => save(recipe, []));
});
test('guessed IDs, owner transfer, anonymous calls, and cross-user writes are blocked', async t => {
  const { db, save, as } = await setup(t); const id = await save();
  await as(B);
  assert.equal((await db.query('select * from recipes where id=$1', [id])).rows.length, 0);
  assert.equal((await db.query('select * from ingredients where recipe_id=$1', [id])).rows.length, 0);
  await assert.rejects(() => save(recipe, ingredients, id), e => e.code === 'P0002');
  assert.equal((await db.query("update recipes set title='Stolen' where id=$1 returning id", [id])).rows.length, 0);
  assert.equal((await db.query('delete from recipes where id=$1 returning id', [id])).rows.length, 0);
  await assert.rejects(() => db.query('insert into ingredients(recipe_id,name) values ($1,$2)', [id,'Stolen']), e => e.code === '42501');
  await as(A); await assert.rejects(() => db.query('update recipes set user_id=$1 where id=$2', [B,id]), e => e.code === '42501');
  assert.equal((await db.query('select title from recipes')).rows[0].title, recipe.title);
  await as(null, 'anon'); await assert.rejects(() => save(), e => e.code === '42501');
  await assert.rejects(() => db.query('select * from recipes'), e => e.code === '42501');
  await as(null); await assert.rejects(() => save(), e => e.code === '42501');
});
test('direct writes cannot leave zero ingredients; full account deletion still cascades', async t => {
  const { db, save } = await setup(t); const id = await save(recipe, [ingredients[0]]);
  await assert.rejects(() => db.query('delete from ingredients where recipe_id=$1', [id]), e => e.code === '23514');
  await assert.rejects(() => db.query('insert into recipes(user_id,title,instructions,servings) values ($1,$2,$3,2)', [A,'Incomplete','Cook']), e => e.code === '23514');
  assert.equal((await db.query('select * from ingredients')).rows.length, 1);
  await db.exec('reset role'); await db.query('delete from auth.users where id=$1', [A]);
  assert.equal((await db.query('select * from recipes')).rows.length, 0);
  assert.equal((await db.query('select * from ingredients')).rows.length, 0);
});
