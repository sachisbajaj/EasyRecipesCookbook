import { test, expect } from '@playwright/test';
test('weekly planning supports repeated meals, editing, reload and mobile removal',async({page})=>{
 const owner='00000000-0000-0000-0000-000000000001',id='00000000-0000-0000-0000-000000000003';
 const user={id:owner,aud:'authenticated',role:'authenticated',email:'cook@example.com',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()};
 const encode=(value:unknown)=>Buffer.from(JSON.stringify(value)).toString('base64url');const token=`${encode({alg:'HS256'})}.${encode({sub:owner,exp:Math.floor(Date.now()/1000)+3600})}.test`;
 let meals:any[]=[];let fail=true;let serial=0;
 await page.route('https://cookbook-test.supabase.co/**',async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname;const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*'};
  if(req.method()==='OPTIONS')return route.fulfill({headers,status:200});
  if(path.endsWith('/token'))return route.fulfill({headers,json:{access_token:token,refresh_token:'fake',expires_in:3600,token_type:'bearer',user}});
  if(path.endsWith('/user'))return route.fulfill({headers,json:user});
  if(path.endsWith('/recipes'))return route.fulfill({headers,json:[{id,user_id:owner,title:'Crispy gnocchi',instructions:'Pan fry.',servings:2,minutes:15,rating:4,store:null,source_url:null,created_at:'2026-10-30',updated_at:'2026-10-30',ingredients:[],stars:[]}]});
  if(path.endsWith('/meal_plan_entries')){
   if(req.method()==='GET'){expect(url.searchParams.get('user_id')).toBe(`eq.${owner}`);const dates=url.searchParams.getAll('planned_date');const from=dates.find(v=>v.startsWith('gte.'))!.slice(4),to=dates.find(v=>v.startsWith('lte.'))!.slice(4);return route.fulfill({headers,json:meals.filter(m=>m.planned_date>=from&&m.planned_date<=to)});}
   if(req.method()==='POST'){if(fail){fail=false;return route.fulfill({headers,status:500,json:{message:'Offline'}});}const meal={...req.postDataJSON(),id:`meal-${serial++}`};meals.push(meal);return route.fulfill({headers,json:meal});}
   const meal=meals.find(m=>`eq.${m.id}`===url.searchParams.get('id'));expect(url.searchParams.get('user_id')).toBe(`eq.${owner}`);
   if(req.method()==='PATCH'){Object.assign(meal,req.postDataJSON());return route.fulfill({headers,json:meal});}
   if(req.method()==='DELETE'){meals=meals.filter(m=>m!==meal);return route.fulfill({headers,json:[{id:meal.id}]});}
  }
  return route.fulfill({headers,status:404,json:{message:'Unexpected request'}});
 });
 await page.goto('/login');await page.getByLabel('Email address').fill('cook@example.com');await page.getByLabel('Password',{exact:true}).fill('password123');await page.getByRole('button',{name:'Log in',exact:true}).click();await page.getByRole('link',{name:'Meal Plan',exact:true}).click();
 await page.getByLabel('Choose any date in your week').fill('2026-12-31');await expect(page).toHaveURL(/week=2026-12-28/);await page.getByRole('button',{name:'Add to week'}).click();await expect(page.getByLabel('Recipe',{exact:true})).toBeFocused();
 await page.getByLabel('Recipe',{exact:true}).selectOption(id);await expect(page.getByLabel('Planned servings')).toHaveValue('2');await page.getByLabel('Cooking date').fill('2026-12-30');await page.getByLabel('Planned servings').fill('4');await page.getByRole('button',{name:'Add to week'}).click();await expect(page.getByRole('alert')).toContainText('entries are still here');await page.getByRole('button',{name:'Add to week'}).click();await expect(page.getByText('Meal added to your week.')).toBeVisible();
 await page.getByLabel('Recipe',{exact:true}).selectOption(id);await page.getByLabel('Cooking date').fill('2026-12-30');await page.getByRole('button',{name:'Add to week'}).click();await expect(page.getByRole('button',{name:'Edit meal'})).toHaveCount(2);
 await page.reload();await expect(page.getByRole('button',{name:'Edit meal'})).toHaveCount(2);await page.getByRole('button',{name:'Edit meal'}).first().click();await page.getByLabel('Cooking date').fill('2027-01-01');await page.getByLabel('Planned servings').fill('6');await page.getByRole('button',{name:'Save meal changes'}).click();await expect(page.getByText('6 servings')).toBeVisible();
 await page.getByRole('button',{name:'Next week'}).click();await expect(page.getByRole('button',{name:'Edit meal'})).toHaveCount(0);await page.goBack();await expect(page.getByText('6 servings')).toBeVisible();
 await page.setViewportSize({width:1280,height:900});await page.screenshot({path:'test-results/meal-plan-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/meal-plan-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Remove meal'}).first().click();await page.getByRole('button',{name:'Keep meal'}).click();expect(meals).toHaveLength(2);await page.getByRole('button',{name:'Remove meal'}).first().click();await page.getByRole('button',{name:'Yes, remove meal'}).click();await expect(page.getByRole('button',{name:'Edit meal'})).toHaveCount(1);expect(meals).toHaveLength(1);
});
