import { test, expect } from '@playwright/test';
test('grocery list generates, persists edits/checkmarks, and confirms replacement on mobile',async({page})=>{
 const owner='00000000-0000-0000-0000-000000000001',week='2026-10-26';
 const user={id:owner,aud:'authenticated',role:'authenticated',email:'cook@example.com',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()};
 const encode=(value:unknown)=>Buffer.from(JSON.stringify(value)).toString('base64url');const token=`${encode({alg:'HS256'})}.${encode({sub:owner,exp:Math.floor(Date.now()/1000)+3600})}.test`;
 let items:any[]=[];let generations=0;let failSave=true;let serial=0;
 await page.route('https://cookbook-test.supabase.co/**',async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname;const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*'};
  if(req.method()==='OPTIONS')return route.fulfill({headers,status:200});
  if(path.endsWith('/token'))return route.fulfill({headers,json:{access_token:token,refresh_token:'fake',expires_in:3600,token_type:'bearer',user}});
  if(path.endsWith('/user'))return route.fulfill({headers,json:user});
  if(path.endsWith('/recipes'))return route.fulfill({headers,json:[]});
  if(path.endsWith('/rpc/generate_grocery_list')){expect(req.postDataJSON()).toEqual({p_week:week});generations++;items=[{id:'rice',user_id:owner,week_start:week,name:'Rice',quantity:6.5,unit:'cup',checked:false,position:0},{id:'salt',user_id:owner,week_start:week,name:'Salt',quantity:null,unit:'pinch',checked:false,position:1}];return route.fulfill({headers,status:204});}
  if(path.endsWith('/grocery_items')){
   if(req.method()==='GET'){expect(url.searchParams.get('user_id')).toBe(`eq.${owner}`);return route.fulfill({headers,json:items.filter(item=>`eq.${item.week_start}`===url.searchParams.get('week_start'))});}
   if(req.method()==='POST'){if(failSave){failSave=false;return route.fulfill({headers,status:500,json:{message:'Offline'}});}const item={...req.postDataJSON(),id:`extra-${serial++}`,checked:false,position:0};items.push(item);return route.fulfill({headers,json:item});}
   expect(url.searchParams.get('user_id')).toBe(`eq.${owner}`);expect(url.searchParams.get('week_start')).toBe(`eq.${week}`);const item=items.find(i=>`eq.${i.id}`===url.searchParams.get('id'));
   if(req.method()==='PATCH'){Object.assign(item,req.postDataJSON());return route.fulfill({headers,json:req.headers().accept?.includes('vnd.pgrst.object')?item:[{id:item.id}]});}
   if(req.method()==='DELETE'){items=items.filter(i=>i!==item);return route.fulfill({headers,json:[{id:item.id}]});}
  }
  return route.fulfill({headers,status:404,json:{message:'Unexpected request'}});
 });
 await page.goto('/login');await page.getByLabel('Email address').fill('cook@example.com');await page.getByLabel('Password',{exact:true}).fill('password123');await page.getByRole('button',{name:'Log in',exact:true}).click();await page.getByRole('link',{name:'Grocery List',exact:true}).click();await page.getByLabel('Choose any date in your week').fill(week);
 await page.getByRole('button',{name:'Generate from meals',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('checkmarks');await page.getByRole('button',{name:'Yes, generate list'}).click();await expect(page.getByText('6 1/2 cup',{exact:true})).toBeVisible();await expect(page.getByText('As needed · pinch')).toBeVisible();
 await page.getByRole('checkbox',{name:/Rice/}).click();await expect(page.getByRole('checkbox',{name:/Rice/})).toBeChecked();await page.reload();await expect(page.getByRole('checkbox',{name:/Rice/})).toBeChecked();
 await page.getByRole('button',{name:'Edit item'}).first().click();await page.getByLabel('Amount (optional)').fill('1/4');await page.getByRole('button',{name:'Save item changes'}).click();await expect(page.getByText('1/4 cup',{exact:true})).toBeVisible();
 await page.getByLabel('Item name').fill('Greek yogurt');await page.getByLabel('Amount (optional)').fill('1/4 cup');await page.getByRole('button',{name:'Add item',exact:true}).click();await expect(page.getByRole('alert')).toContainText('entries are still here');await page.getByRole('button',{name:'Add item',exact:true}).click();await expect(page.getByText('Greek yogurt',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Regenerate from meals'}).click();await page.getByRole('button',{name:'Cancel',exact:true}).click();expect(generations).toBe(1);await expect(page.getByRole('checkbox',{name:/Rice/})).toBeChecked();
 await page.setViewportSize({width:1280,height:900});await page.screenshot({path:'test-results/grocery-list-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/grocery-list-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Next week'}).click();await expect(page.getByRole('checkbox')).toHaveCount(0);await page.goBack();await expect(page.getByRole('checkbox')).toHaveCount(3);
 await page.getByRole('button',{name:'Remove item'}).last().click();await page.getByRole('button',{name:'Yes, remove item'}).click();await expect(page.getByRole('checkbox')).toHaveCount(2);
 await page.getByRole('button',{name:'Regenerate from meals'}).click();await page.getByRole('button',{name:'Yes, generate list'}).click();await expect(page.getByRole('checkbox',{name:/Rice/})).not.toBeChecked();await expect(page.getByText('6 1/2 cup',{exact:true})).toBeVisible();expect(generations).toBe(2);
});
