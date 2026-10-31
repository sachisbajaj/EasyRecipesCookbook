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
  for (const file of ['20261021000100_core_recipe_model.sql', '20261021000200_auth_profiles.sql', '20261027000100_recipe_management.sql', '20261027000200_recipe_stars.sql', '20261030000100_cooking_notes.sql', '20261031000100_meal_planning.sql', '20261031000200_grocery_lists.sql']) await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'));
  await db.exec(`insert into auth.users values ('${A}'), ('${B}');`);
  async function as(id, role = 'authenticated') { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id ?? '']); await db.exec(`set role ${role}`); }
  const save = async (r = recipe, list = ingredients, id = null) => (await db.query('select public.save_recipe($1::jsonb,$2::jsonb,$3::uuid) as id', [JSON.stringify(r), JSON.stringify(list), id])).rows[0].id;
  await as(A); return { db, as, save };
}
const WEEK='2026-10-26';
async function plan(db,owner,id,servings,date='2026-10-30'){await db.query('insert into meal_plan_entries(user_id,recipe_id,planned_date,servings) values($1,$2,$3,$4)',[owner,id,date,servings]);}
const generate=db=>db.query('select generate_grocery_list($1)',[WEEK]);
test('generation scales repeated meals and merges only matching names, units and known amounts',async t=>{
 const {db,save,as}=await setup(t);
 const first=await save(recipe,[{name:'Rice',quantity:2,unit:'cup'},{name:'Salt',quantity:null,unit:'pinch'},{name:'Salt',quantity:1,unit:'pinch'},{name:'Rice',quantity:100,unit:'g'},{name:'TJ gnocchi',quantity:1,unit:'bag'}]);
 const second=await save({...recipe,servings:4},[{name:' \t RICE \n',quantity:1,unit:' CUP '},{name:'gnocchi',quantity:1,unit:'bag'}]);
 await plan(db,A,first,4);await plan(db,A,first,2);await plan(db,A,second,2);await plan(db,A,first,100,'2026-11-02');
 await as(B);const foreign=await save();await plan(db,B,foreign,100);await as(A);await generate(db);
 const rows=(await db.query('select * from grocery_items order by position')).rows;assert.equal(rows.length,6);
 const amounts=rows.map(r=>[r.name.toLowerCase(),r.unit,r.quantity]);
 assert.ok(amounts.some(([n,u,q])=>n==='rice'&&u==='cup'&&Number(q)===6.5));
 assert.ok(amounts.some(([n,u,q])=>n==='rice'&&u==='g'&&Number(q)===300));
 assert.ok(amounts.some(([n,u,q])=>n==='salt'&&u==='pinch'&&q===null));
 assert.ok(amounts.some(([n,u,q])=>n==='salt'&&u==='pinch'&&Number(q)===3));
 assert.ok(amounts.some(([n,u,q])=>n==='tj gnocchi'&&Number(q)===3));
 assert.ok(amounts.some(([n,u,q])=>n==='gnocchi'&&Number(q)===0.5));
 assert.ok(rows.every(r=>r.user_id===A&&!r.checked));
});
test('snapshots survive recipe edits/deletion and regenerate only the selected owner/week',async t=>{
 const {db,save,as}=await setup(t);const id=await save();await plan(db,A,id,2);await generate(db);
 const original=(await db.query('select * from grocery_items order by id')).rows;
 await save({...recipe,title:'Changed'},[{name:'Pasta',quantity:4,unit:'bag'}],id);
 assert.deepEqual((await db.query('select * from grocery_items order by id')).rows,original);
 await db.query("update grocery_items set checked=true,quantity=8 where quantity is not null");
 await db.query("insert into grocery_items(user_id,week_start,name,unit) values($1,$2,'Manual','item'),($1,'2026-11-02','Other week','item')",[A,WEEK]);
 await as(B);await db.query("insert into grocery_items(user_id,week_start,name,unit) values($1,$2,'Other user','item')",[B,WEEK]);
 await as(A);await generate(db);const replacement=(await db.query('select * from grocery_items where week_start=$1',[WEEK])).rows;assert.equal(replacement.length,1);assert.equal(replacement[0].name,'Pasta');assert.equal(Number(replacement[0].quantity),4);assert.equal(replacement[0].checked,false);
 await db.query('delete from recipes where id=$1',[id]);assert.equal((await db.query('select * from grocery_items where week_start=$1',[WEEK])).rows.length,1);
 await generate(db);assert.equal((await db.query('select * from grocery_items')).rows.length,1);
 await as(B);assert.equal((await db.query('select name from grocery_items')).rows[0].name,'Other user');
 await db.exec('reset role');await db.query('delete from auth.users where id=$1',[A]);assert.equal((await db.query('select * from grocery_items where user_id=$1',[A])).rows.length,0);
});
test('failed replacement rolls back the original checklist',async t=>{
 const {db,save,as}=await setup(t);const id=await save();await plan(db,A,id,2);await generate(db);await db.query('update grocery_items set checked=true');const before=(await db.query('select * from grocery_items order by id')).rows;
 await db.exec("reset role; create function public.reject_test_insert() returns trigger language plpgsql as $$ begin raise exception 'Simulated insertion failure'; end; $$; create trigger fail_generation before insert on grocery_items for each row execute function public.reject_test_insert();");
 await as(A);await assert.rejects(()=>generate(db));assert.deepEqual((await db.query('select * from grocery_items order by id')).rows,before);
});
test('grocery validation, ownership, immutable keys and anonymous restrictions',async t=>{
 const {db,as}=await setup(t);
 const insert=(name,quantity,unit,week=WEEK)=>db.query('insert into grocery_items(user_id,week_start,name,quantity,unit) values($1,$2,$3,$4,$5) returning id',[A,week,name,quantity,unit]);
 for(const values of [['',1,'cup'],[' \t',1,'cup'],['Rice',0,'cup'],['Rice',-1,'cup'],['Rice','NaN','cup'],['Rice','Infinity','cup'],['Rice',1,''],['Rice',1,'cup','2026-10-27'],['Rice',1,'cup','infinity']])await assert.rejects(()=>insert(...values));
 const id=(await insert('Extra',null,'item')).rows[0].id;await db.query("update grocery_items set name='Milk',quantity=0.5,unit='cup',checked=true where id=$1",[id]);
 for(const [key,value] of [['id',B],['user_id',B],['week_start','2026-11-02']])await assert.rejects(()=>db.query(`update grocery_items set ${key}=$1 where id=$2`,[value,id]),e=>e.code==='42501');
 await as(B);assert.equal((await db.query('select * from grocery_items')).rows.length,0);await assert.rejects(()=>insert('No',1,'item'),e=>e.code==='42501');assert.equal((await db.query('update grocery_items set checked=false where id=$1 returning id',[id])).rows.length,0);assert.equal((await db.query('delete from grocery_items where id=$1 returning id',[id])).rows.length,0);await generate(db);
 await as(A);assert.equal((await db.query('select checked from grocery_items')).rows[0].checked,true);
 await assert.rejects(()=>db.query("select generate_grocery_list('2026-10-27')"));
 await as(null,'anon');for(const query of ['select * from grocery_items','update grocery_items set checked=true','delete from grocery_items',"select generate_grocery_list('2026-10-26')",`insert into grocery_items(user_id,week_start,name,unit) values('${A}','${WEEK}','No','item')`])await assert.rejects(()=>db.query(query),e=>e.code==='42501');
 await as(null);await assert.rejects(()=>generate(db),e=>e.code==='42501');
 await as(A);await db.query('delete from grocery_items where id=$1',[id]);assert.equal((await db.query('select * from grocery_items')).rows.length,0);
});
