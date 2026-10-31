import { test, expect } from '@playwright/test';
test('dashboard totals, chart, refresh, error recovery, and mobile layout with simulated Supabase',async({page})=>{
 const owner='00000000-0000-0000-0000-000000000001';const other='00000000-0000-0000-0000-000000000002';
 const user={id:owner,email:'dashboard@example.com',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()};
 const encode=(v:unknown)=>Buffer.from(JSON.stringify(v)).toString('base64url');const token=`${encode({alg:'HS256'})}.${encode({sub:owner,exp:Math.floor(Date.now()/1000)+3600})}.test`;
 let recipes=[5,3,null].map((rating,i)=>({id:`00000000-0000-0000-0000-00000000001${i}`,user_id:owner,title:`Dinner ${i+1}`,instructions:'Cook',servings:2,minutes:null,store:null,source_url:null,rating,created_at:'2026-10-30T00:00:00Z',updated_at:'2026-10-30T00:00:00Z',ingredients:[],stars:i===0?[{user_id:owner}]:[]}));let fail=false;
 await page.route('https://cookbook-test.supabase.co/**',async route=>{
  const request=route.request();const url=new URL(request.url());const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*'};
  if(request.method()==='OPTIONS')return route.fulfill({status:200,headers});
  if(url.pathname.endsWith('/token'))return route.fulfill({headers,json:{access_token:token,refresh_token:'fake',expires_in:3600,token_type:'bearer',user}});
  if(url.pathname.endsWith('/user'))return route.fulfill({headers,json:user});
  if(url.pathname.endsWith('/logout'))return route.fulfill({status:204,headers});
  if(url.pathname.endsWith('/recipes')){
   expect(url.searchParams.get('user_id')).toBe(`eq.${owner}`);
   if(fail)return route.fulfill({status:500,headers,json:{message:'simulated failure'}});
   // Deliberately include a foreign row to exercise the additional UI owner guard.
   return route.fulfill({headers,json:[...recipes,{...recipes[0],id:'foreign',user_id:other,rating:1,stars:[{user_id:other}]}]});
  }
  return route.fulfill({status:404,headers,json:{message:'Unexpected request'}});
 });
 await page.goto('/cookbook/dashboard');await page.getByLabel('Email address').fill('dashboard@example.com');await page.getByLabel('Password',{exact:true}).fill('password123');await page.getByRole('button',{name:'Log in',exact:true}).click();await page.getByRole('link',{name:'Dashboard',exact:true}).click();
 await expect(page.getByTestId('total-recipes')).toHaveText('3');await expect(page.getByTestId('average-rating')).toHaveText('4.0');await expect(page.getByTestId('starred-count')).toHaveText('1');await expect(page.getByRole('table',{name:'Recipe counts by rating'}).getByRole('row')).toHaveCount(7);await expect(page.locator('.rating-chart svg').first()).toBeVisible();
 await page.screenshot({path:'test-results/dashboard-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});await expect.poll(async()=>page.locator('.rating-chart svg').first().evaluate(el=>el.getBoundingClientRect().width)).toBeLessThan(390);await page.screenshot({path:'test-results/dashboard-mobile.png',fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.reload();await expect(page.getByTestId('average-rating')).toHaveText('4.0');
 await page.getByRole('link',{name:'Recipes',exact:true}).click();recipes=recipes.map(r=>({...r,rating:null}));await page.getByRole('link',{name:'Dashboard',exact:true}).click();await expect(page.getByTestId('average-rating')).toHaveText('Not rated yet');
 fail=true;await page.reload();await expect(page.getByRole('alert')).toContainText('couldn’t load');await expect(page.getByTestId('total-recipes')).toHaveCount(0);fail=false;recipes=[];await page.getByRole('button',{name:'Try again'}).click();await expect(page.getByTestId('total-recipes')).toHaveText('0');await expect(page.getByRole('link',{name:'Add your first recipe →'})).toBeVisible();
 await page.getByRole('button',{name:'Log out',exact:true}).click();await expect(page.getByRole('heading',{name:'Welcome back'})).toBeVisible();await page.goto('/cookbook/dashboard');await expect(page.getByRole('heading',{name:'Welcome back'})).toBeVisible();await expect(page.getByTestId('total-recipes')).toHaveCount(0);
});
