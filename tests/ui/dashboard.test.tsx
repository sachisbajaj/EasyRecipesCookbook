import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { createClient, type Session } from '@supabase/supabase-js';
import { createRecipeService } from '../../src/recipes/service';
import Dashboard from '../../src/dashboard/Dashboard';
import { summarizeCookbook } from '../../src/dashboard/summary';
import { RecipePages } from '../../src/recipes/RecipePages';
import type { Recipe, RecipeService } from '../../src/recipes/model';
import { AuthProvider } from '../../src/auth/AuthProvider';
import { App } from '../../src/App';
import type { AuthService } from '../../src/auth/service';
beforeAll(()=>vi.stubGlobal('ResizeObserver',class { observe(){} unobserve(){} disconnect(){} }));
afterAll(()=>vi.unstubAllGlobals());
const recipe=(id:string,rating:number|null,owner='a'):Recipe=>({id,user_id:owner,title:id,instructions:'Cook',servings:2,minutes:null,store:null,source_url:null,rating,created_at:'',updated_at:'',ingredients:[],stars:[]});
const sample=[{...recipe('one',5),stars:[{user_id:'a'}]},recipe('two',3),recipe('three',null),{...recipe('other',1,'b'),stars:[{user_id:'b'}]}];
function service(list=sample):RecipeService{return{groceries: {list:async()=>[],generate:async()=>{},save:async()=>{throw Error('unused')},setChecked:async()=>{},remove:async()=>{}},planner: { list: async()=>[], save: async()=>{throw new Error('unused')}, remove: async()=>{} }, notes: { list: async()=>[], save: async()=>{throw new Error('unused')}, remove: async()=>{} },list:vi.fn(async()=>list),get:vi.fn(async()=>null),save:vi.fn(async()=>''),remove:vi.fn(async()=>{}),setStar:vi.fn(async()=>{})};}
function show(s:RecipeService){return render(<MemoryRouter><Dashboard service={s} owner="a"/></MemoryRouter>);}
it('shows the PLAN example: three owned recipes, 4.0 average, one star, and every chart bucket',async()=>{
 const s=service();show(s);expect(await screen.findByTestId('total-recipes')).toHaveTextContent('3');expect(screen.getByTestId('average-rating')).toHaveTextContent('4.0');expect(screen.getByTestId('starred-count')).toHaveTextContent('1');
 const table=screen.getByRole('table',{name:'Recipe counts by rating'});expect(within(table).getAllByRole('row')).toHaveLength(7);
 for(const [label,count] of [['1 / 5',0],['2 / 5',0],['3 / 5',1],['4 / 5',0],['5 / 5',1],['Unrated',1]] as const){const row=within(table).getByRole('rowheader',{name:label}).closest('tr')!;expect(within(row).getByRole('cell')).toHaveTextContent(String(count));}
 expect(s.list).toHaveBeenCalledWith('a');
});
it('shows Not rated yet for an empty cookbook and all-unrated recipes',async()=>{
 const view=show(service([]));expect(await screen.findByTestId('average-rating')).toHaveTextContent('Not rated yet');expect(screen.getByTestId('total-recipes')).toHaveTextContent('0');expect(screen.getByRole('link',{name:'Add your first recipe →'})).toBeVisible();view.unmount();
 show(service([recipe('unrated',null)]));expect(await screen.findByTestId('average-rating')).toHaveTextContent('Not rated yet');expect(screen.getByTestId('total-recipes')).toHaveTextContent('1');
});
it('calculates every rating bucket and counts recipes rather than duplicate star rows',()=>{
 const data=[1,2,3,4,5,null].map((value,i)=>recipe(String(i),value));data[0].stars=[{user_id:'a'},{user_id:'a'},{user_id:'b'}];const before=structuredClone(data);const result=summarizeCookbook(data,'a');expect(result.average).toBe(3);expect(result.starred).toBe(1);expect(result.distribution.map(b=>b.count)).toEqual([1,1,1,1,1,1]);expect(data).toEqual(before);
});
it('shows loading and retries failures without presenting zero totals',async()=>{
 const s=service();let finish!:(rows:Recipe[])=>void;vi.mocked(s.list).mockRejectedValueOnce(new Error('private details')).mockImplementationOnce(()=>new Promise(r=>{finish=r;}));show(s);
 expect(screen.queryByTestId('total-recipes')).toBeNull();await userEvent.click(await screen.findByRole('button',{name:'Try again'}));expect(screen.getByRole('status')).toHaveTextContent('Gathering');expect(screen.queryByTestId('total-recipes')).toBeNull();await act(async()=>finish(sample));expect(await screen.findByTestId('total-recipes')).toHaveTextContent('3');
});
it('reloads the full collection on returning from Recipes, independent of URL filters',async()=>{
 const s=service();const user=userEvent.setup();render(<MemoryRouter initialEntries={['/cookbook/dashboard?q=no-match&store=none']}><Routes><Route path="/cookbook/*" element={<RecipePages service={s} owner="a"/>}/></Routes></MemoryRouter>);
 expect(await screen.findByTestId('total-recipes')).toHaveTextContent('3');await user.click(screen.getByRole('link',{name:'Recipes'}));await screen.findByRole('heading',{name:'Your weeknight favorites'});vi.mocked(s.list).mockResolvedValue([recipe('remaining',2)]);await user.click(screen.getByRole('link',{name:'Dashboard'}));expect(await screen.findByTestId('total-recipes')).toHaveTextContent('1');expect(screen.getByTestId('average-rating')).toHaveTextContent('2.0');
});
it('clears account A data on switch and ignores A’s late response after account B loads',async()=>{
 let emit!:(session:Session|null)=>void;const session=(id:string)=>({user:{id,email:`${id}@example.com`}} as Session);
 const auth:AuthService={getSession:vi.fn(async()=>({data:{session:session('a')},error:null})),onChange:fn=>{emit=fn;return()=>{};},signIn:vi.fn(),signUp:vi.fn(),signOut:vi.fn()};
 const s=service();let finishA!:(rows:Recipe[])=>void;vi.mocked(s.list).mockImplementation(owner=>owner==='a'?new Promise(r=>{finishA=r;}):Promise.resolve([recipe('b-only',1,'b')]));
 render(<MemoryRouter initialEntries={['/cookbook/dashboard']}><AuthProvider service={auth}><App recipeService={s}/></AuthProvider></MemoryRouter>);
 await screen.findByText('Gathering your cookbook…');act(()=>emit(session('b')));expect(await screen.findByTestId('total-recipes')).toHaveTextContent('1');await act(async()=>finishA(sample));expect(screen.getByTestId('average-rating')).toHaveTextContent('1.0');expect(screen.queryByText('a@example.com')).toBeNull();act(()=>emit(null));expect(await screen.findByRole('heading',{name:'Welcome back'})).toBeVisible();expect(screen.queryByTestId('total-recipes')).toBeNull();
});

it('includes recipes beyond the first API page in the displayed summary',async()=>{
 const requests:URL[]=[];
 const client=createClient('https://test.supabase.co','fake-key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(input)=>{
  const url=new URL(String(input));requests.push(url);
  const rows=url.searchParams.get('offset')==='100'?[recipe('last',5)]:Array.from({length:100},(_,i)=>recipe(String(i),null));
  return new Response(JSON.stringify(rows),{status:200,headers:{'content-type':'application/json'}});
 }}});
 show(createRecipeService(client));expect(await screen.findByTestId('total-recipes')).toHaveTextContent('101');expect(screen.getByTestId('average-rating')).toHaveTextContent('5.0');expect(requests).toHaveLength(2);expect(requests.every(url=>url.searchParams.get('user_id')==='eq.a')).toBe(true);
});
