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
  for (const file of ['20261021000100_core_recipe_model.sql', '20261021000200_auth_profiles.sql', '20261027000100_recipe_management.sql', '20261027000200_recipe_stars.sql']) await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'));
  await db.exec(`insert into auth.users values ('${A}'), ('${B}');`);
  async function as(id, role = 'authenticated') { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id ?? '']); await db.exec(`set role ${role}`); }
  const save = async (r = recipe, list = ingredients, id = null) => (await db.query('select public.save_recipe($1::jsonb,$2::jsonb,$3::uuid) as id', [JSON.stringify(r), JSON.stringify(list), id])).rows[0].id;
  await as(A); return { db, as, save };
}
test('owner stars are unique, survive edits, and can be removed without deleting the recipe', async t => {
  const {db,save}=await setup(t); const id=await save();
  await db.query('insert into stars(user_id,recipe_id) values ($1,$2)',[A,id]);
  await assert.rejects(()=>db.query('insert into stars(user_id,recipe_id) values ($1,$2)',[A,id]),e=>e.code==='23505');
  await db.query('insert into stars(user_id,recipe_id) values ($1,$2) on conflict (user_id,recipe_id) do nothing',[A,id]);
  await save({...recipe,title:'Improved'},ingredients,id);
  assert.equal((await db.query('select * from stars')).rows.length,1);
  assert.equal((await db.query('select * from stars')).rows[0].recipe_id,id);
  await db.query('delete from stars where recipe_id=$1',[id]);
  assert.equal((await db.query('select * from stars')).rows.length,0);
  assert.equal((await db.query('select * from recipes')).rows.length,1);
});
test('stars enforce owner and parent ownership, immutable keys, and anonymous restrictions', async t => {
  const {db,save,as}=await setup(t); const id=await save();
  await db.query('insert into stars(user_id,recipe_id) values ($1,$2)',[A,id]);
  await as(B); const other=await save();
  assert.equal((await db.query('select * from stars')).rows.length,0);
  await assert.rejects(()=>db.query('insert into stars(user_id,recipe_id) values ($1,$2)',[B,id]),e=>e.code==='42501');
  await assert.rejects(()=>db.query('insert into stars(user_id,recipe_id) values ($1,$2)',[A,other]),e=>e.code==='42501');
  assert.equal((await db.query('delete from stars where recipe_id=$1 returning *',[id])).rows.length,0);
  await as(A); for(const sql of ['update stars set user_id=$1','update stars set recipe_id=$1']) await assert.rejects(()=>db.query(sql,[B]),e=>e.code==='42501');
  assert.equal((await db.query('select * from stars')).rows.length,1);
  await as(null,'anon'); await assert.rejects(()=>db.query('select * from stars'),e=>e.code==='42501');
  await assert.rejects(()=>db.query('insert into stars(user_id,recipe_id) values ($1,$2)',[A,id]),e=>e.code==='42501');
  await as(null); assert.equal((await db.query('select * from stars')).rows.length,0);
});
test('recipe and account deletion cascade to stars', async t => {
  const {db,save}=await setup(t); const first=await save(); const second=await save();
  await db.query('insert into stars(user_id,recipe_id) values ($1,$2),($1,$3)',[A,first,second]);
  await db.query('delete from recipes where id=$1',[first]); assert.equal((await db.query('select * from stars')).rows.length,1);
  await db.exec('reset role'); await db.query('delete from auth.users where id=$1',[A]); assert.equal((await db.query('select * from stars')).rows.length,0);
});
