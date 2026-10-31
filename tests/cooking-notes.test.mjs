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
  for (const file of ['20261021000100_core_recipe_model.sql', '20261021000200_auth_profiles.sql', '20261027000100_recipe_management.sql', '20261027000200_recipe_stars.sql', '20261030000100_cooking_notes.sql']) await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'));
  await db.exec(`insert into auth.users values ('${A}'), ('${B}');`);
  async function as(id, role = 'authenticated') { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id ?? '']); await db.exec(`set role ${role}`); }
  const save = async (r = recipe, list = ingredients, id = null) => (await db.query('select public.save_recipe($1::jsonb,$2::jsonb,$3::uuid) as id', [JSON.stringify(r), JSON.stringify(list), id])).rows[0].id;
  await as(A); return { db, as, save };
}
test('notes support owner CRUD, validation and independent ratings', async t => {
 const {db,save}=await setup(t); const id=await save();
 const add=(date,worked,next)=>db.query('insert into cooking_notes(recipe_id,cooked_on,what_worked,next_time) values($1,$2,$3,$4) returning *',[id,date,worked,next]);
 for(const values of [[null,'yes',null],['infinity','yes',null],['2026-02-30','yes',null],['2026-10-30',null,null],['2026-10-30',' \n\t',' ']]) await assert.rejects(()=>add(...values));
 const first=(await add('2026-10-29','Crispy edges',null)).rows[0];
 await add('2026-10-30',null,'Less salt');
 assert.equal((await db.query('select * from cooking_notes order by cooked_on desc')).rows[0].next_time,'Less salt');
 await db.query('update cooking_notes set what_worked=$1,next_time=$2 where id=$3',['Good','More herbs',first.id]);
 assert.equal((await db.query('select rating from recipes')).rows[0].rating,null);
 await assert.rejects(()=>db.query("update cooking_notes set what_worked='',next_time=''"));
 await db.query('delete from cooking_notes where id=$1',[first.id]); assert.equal((await db.query('select * from cooking_notes')).rows.length,1);
});
test('notes deny foreign and anonymous access and prevent reparenting or metadata changes', async t => {
 const {db,save,as}=await setup(t); const id=await save(); const second=await save();
 const note=(await db.query("insert into cooking_notes(recipe_id,cooked_on,what_worked) values($1,'2026-10-30','Private') returning id",[id])).rows[0].id;
 for(const [column,value] of [['recipe_id',second],['id',B],['created_at','2026-10-01']]) await assert.rejects(()=>db.query(`update cooking_notes set ${column}=$1 where id=$2`,[value,note]),e=>e.code==='42501');
 await as(B);
 assert.equal((await db.query('select * from cooking_notes')).rows.length,0);
 await assert.rejects(()=>db.query("insert into cooking_notes(recipe_id,cooked_on,next_time) values($1,'2026-10-30','No')",[id]),e=>e.code==='42501');
 assert.equal((await db.query("update cooking_notes set next_time='No' where id=$1 returning id",[note])).rows.length,0);
 assert.equal((await db.query('delete from cooking_notes where id=$1 returning id',[note])).rows.length,0);
 await as(null,'anon'); for(const sql of ['select * from cooking_notes',`insert into cooking_notes(recipe_id,cooked_on,next_time) values('${id}','2026-10-30','No')`, "update cooking_notes set next_time='No'", 'delete from cooking_notes']) await assert.rejects(()=>db.query(sql),e=>e.code==='42501');
 await as(null); assert.equal((await db.query('select * from cooking_notes')).rows.length,0);
 await as(A); assert.equal((await db.query('select what_worked from cooking_notes')).rows[0].what_worked,'Private');
});
test('recipe and account deletions cascade to notes', async t=>{
 const {db,save}=await setup(t); const first=await save(); const second=await save();
 await db.query("insert into cooking_notes(recipe_id,cooked_on,next_time) values($1,'2026-10-30','A'),($2,'2026-10-30','B')",[first,second]);
 await db.query('delete from recipes where id=$1',[first]); assert.equal((await db.query('select * from cooking_notes')).rows.length,1);
 await db.exec('reset role'); await db.query('delete from auth.users where id=$1',[A]); assert.equal((await db.query('select * from cooking_notes')).rows.length,0);
});
