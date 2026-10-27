import { expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { createRecipeService } from '../../src/recipes/service';
import { selectRecipes, storeOptions, readControls, type CollectionOptions } from '../../src/recipes/collection';
import type { Recipe } from '../../src/recipes/model';
const base: Recipe={id:'a',user_id:'owner',title:'Pasta [easy]',instructions:'Cook',servings:2,minutes:10,rating:5,store:' Trader Joe’s ',source_url:null,created_at:'2026-10-01T00:00:00Z',updated_at:'',ingredients:[],stars:[{user_id:'owner'}]};
const options: CollectionOptions={owner:'owner',starredOnly:false,query:'',store:'',sort:'newest'};
const recipes=[base,{...base,id:'b',title:'Soup',store:'trader joe’s',rating:null,minutes:null,created_at:'2026-10-03T00:00:00Z',stars:[]},{...base,id:'c',title:'Pasta bowl',store:null,rating:3,minutes:5,created_at:'2026-10-02T00:00:00Z'},{...base,id:'private',user_id:'other'}];
it('combines literal title search, normalized store, and Stars without mutating input',()=>{
 const before=structuredClone(recipes);
 expect(selectRecipes(recipes,{...options,query:' PASTA [ ',store:'store:trader joe’s',starredOnly:true}).map(r=>r.id)).toEqual(['a']);
 expect(selectRecipes(recipes,{...options,query:'%'})).toEqual([]);
 expect(recipes).toEqual(before);
});
it('sorts missing values last, uses deterministic ties, and never includes another owner',()=>{
 expect(selectRecipes(recipes,{...options,sort:'rating'}).map(r=>r.id)).toEqual(['a','c','b']);
 expect(selectRecipes(recipes,{...options,sort:'time'}).map(r=>r.id)).toEqual(['c','a','b']);
 expect(selectRecipes(recipes,options).map(r=>r.id)).toEqual(['b','c','a']);
 expect(selectRecipes([{...base,id:'z'},{...base,id:'a'}],options).map(r=>r.id)).toEqual(['a','z']);
});
it('groups store labels but keeps sentinel choices distinct from real names',()=>{
 const stores=storeOptions([...recipes,{...base,id:'d',store:'No store/source'}]);
 expect(stores.filter(r=>r.value==='store:trader joe’s')).toHaveLength(1);
 expect(stores).toContainEqual({value:'store:no store/source',label:'No store/source (store label)'});
 expect(selectRecipes(recipes,{...options,store:'none'}).map(r=>r.id)).toEqual(['c']);
});
it('defaults unknown URL controls safely',()=>{
 expect(readControls(new URLSearchParams('sort=unknown&store=bad&q=soup'))).toEqual({sort:'newest',store:'',query:'soup'});
});
it('loads all owner-scoped pages before filtering, including a match beyond the first page',async()=>{
 const requests:URL[]=[];
 const client=createClient('https://test.supabase.co','test-key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(input)=>{
  const url=new URL(String(input));requests.push(url);
  const data=url.searchParams.get('offset')==='100'?[{...base,id:'last',title:'Final match'}]:Array.from({length:100},(_,i)=>({...base,id:String(i),title:'Other'}));
  return new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}});
 }}});
 const loaded=await createRecipeService(client).list('owner');
 expect(loaded).toHaveLength(101); expect(requests).toHaveLength(2);
 expect(requests.every(url=>url.searchParams.get('user_id')==='eq.owner')).toBe(true);
 expect(selectRecipes(loaded,{...options,query:'Final'}).map(r=>r.id)).toEqual(['last']);
});
