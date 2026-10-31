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
  for (const file of ['20261021000100_core_recipe_model.sql', '20261021000200_auth_profiles.sql', '20261027000100_recipe_management.sql', '20261027000200_recipe_stars.sql', '20261030000100_cooking_notes.sql', '20261031000100_meal_planning.sql']) await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'));
  await db.exec(`insert into auth.users values ('${A}'), ('${B}');`);
  async function as(id, role = 'authenticated') { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id ?? '']); await db.exec(`set role ${role}`); }
  const save = async (r = recipe, list = ingredients, id = null) => (await db.query('select public.save_recipe($1::jsonb,$2::jsonb,$3::uuid) as id', [JSON.stringify(r), JSON.stringify(list), id])).rows[0].id;
  await as(A); return { db, as, save };
}
test('meal plans allow repeated meals, validate fields, and support owner edits/removal',async t=>{
 const {db,save}=await setup(t);const id=await save();const other=await save();
 const add=(date,servings)=>db.query('insert into meal_plan_entries(user_id,recipe_id,planned_date,servings) values($1,$2,$3,$4) returning *',[A,id,date,servings]);
 for(const values of [['2026-10-30',0],['2026-10-30',-1],['2026-10-30',1.5],['2026-10-30',null],[null,2],['infinity',2],['2026-02-30',2]])await assert.rejects(()=>add(...values));
 const first=(await add('2026-10-30',4)).rows[0];await add('2026-10-30',2);await add('2026-10-31',1);
 assert.equal((await db.query('select * from meal_plan_entries')).rows.length,3);
 await db.query("update meal_plan_entries set recipe_id=$1,planned_date='2026-11-02',servings=6 where id=$2",[other,first.id]);
 assert.equal((await db.query('select servings from meal_plan_entries where id=$1',[first.id])).rows[0].servings,6);
 await db.query('delete from meal_plan_entries where id=$1',[first.id]);assert.equal((await db.query('select * from recipes')).rows.length,2);
});
test('meal plans enforce owner and recipe ownership for inserts and updates',async t=>{
 const {db,save,as}=await setup(t);const recipeA=await save();
 const entry=(await db.query("insert into meal_plan_entries(user_id,recipe_id,planned_date,servings) values($1,$2,'2026-10-30',2) returning id",[A,recipeA])).rows[0].id;
 await as(B);const recipeB=await save();
 assert.equal((await db.query('select * from meal_plan_entries')).rows.length,0);
 for(const [owner,parent] of [[B,recipeA],[A,recipeB]])await assert.rejects(()=>db.query("insert into meal_plan_entries(user_id,recipe_id,planned_date,servings) values($1,$2,'2026-10-30',2)",[owner,parent]),e=>e.code==='42501');
 assert.equal((await db.query('update meal_plan_entries set servings=10 where id=$1 returning id',[entry])).rows.length,0);
 assert.equal((await db.query('delete from meal_plan_entries where id=$1 returning id',[entry])).rows.length,0);
 await as(A);await assert.rejects(()=>db.query('update meal_plan_entries set recipe_id=$1 where id=$2',[recipeB,entry]),e=>e.code==='42501');
 for(const column of ['user_id','id'])await assert.rejects(()=>db.query(`update meal_plan_entries set ${column}=$1 where id=$2`,[B,entry]),e=>e.code==='42501');
 assert.equal((await db.query('select servings from meal_plan_entries')).rows[0].servings,2);
 await as(null,'anon');for(const sql of ['select * from meal_plan_entries',"update meal_plan_entries set servings=1",'delete from meal_plan_entries',`insert into meal_plan_entries(user_id,recipe_id,planned_date,servings) values('${A}','${recipeA}','2026-10-30',1)`])await assert.rejects(()=>db.query(sql),e=>e.code==='42501');
 await as(null);assert.equal((await db.query('select * from meal_plan_entries')).rows.length,0);
});
test('recipe and account deletion remove planned meals',async t=>{
 const {db,save}=await setup(t);const first=await save();const second=await save();
 await db.query("insert into meal_plan_entries(user_id,recipe_id,planned_date,servings) values($1,$2,'2026-10-30',2),($1,$3,'2026-10-30',2)",[A,first,second]);
 await db.query('delete from recipes where id=$1',[first]);assert.equal((await db.query('select * from meal_plan_entries')).rows.length,1);
 await db.exec('reset role');await db.query('delete from auth.users where id=$1',[A]);assert.equal((await db.query('select * from meal_plan_entries')).rows.length,0);
});
