import { test, expect } from '@playwright/test';
test('cooking notes persist through reload, edit and delete on mobile',async({page})=>{
 const owner='00000000-0000-0000-0000-000000000001',id='00000000-0000-0000-0000-000000000003';
 const user={id:owner,aud:'authenticated',role:'authenticated',email:'cook@example.com',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()};
 const encode=(value:unknown)=>Buffer.from(JSON.stringify(value)).toString('base64url'); const token=`${encode({alg:'HS256'})}.${encode({sub:owner,exp:Math.floor(Date.now()/1000)+3600})}.test`;
 let notes:any[]=[];let fail=true;
 await page.route('https://cookbook-test.supabase.co/**',async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname;const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*'};
  if(req.method()==='OPTIONS')return route.fulfill({headers,status:200});
  if(path.endsWith('/token'))return route.fulfill({headers,json:{access_token:token,refresh_token:'fake',expires_in:3600,token_type:'bearer',user}});
  if(path.endsWith('/user'))return route.fulfill({headers,json:user});
  if(path.endsWith('/recipes')){const recipe={id,user_id:owner,title:'Crispy gnocchi',instructions:'Pan fry and serve.',servings:2,minutes:15,rating:4,store:null,source_url:null,created_at:'2026-10-30',updated_at:'2026-10-30',ingredients:[],stars:[]};return route.fulfill({headers,json:req.headers().accept?.includes('vnd.pgrst.object')?recipe:[recipe]});}
  if(path.endsWith('/cooking_notes')){
   expect(url.searchParams.get('recipe_id')??req.postDataJSON()?.recipe_id).toMatch(id);
   if(req.method()==='GET')return route.fulfill({headers,json:[...notes].sort((a,b)=>b.cooked_on.localeCompare(a.cooked_on))});
   if(req.method()==='POST'){if(fail){fail=false;return route.fulfill({headers,status:500,json:{message:'Offline'}});}const note={...req.postDataJSON(),id:`note-${notes.length}`,created_at:'2026-10-30T12:00:00Z'};notes.push(note);return route.fulfill({headers,json:note});}
   const note=notes.find(n=>`eq.${n.id}`===url.searchParams.get('id'));
   if(req.method()==='PATCH'){Object.assign(note,req.postDataJSON());return route.fulfill({headers,json:note});}
   if(req.method()==='DELETE'){notes=notes.filter(n=>n!==note);return route.fulfill({headers,json:[{id:note.id}]});}
  }
  return route.fulfill({headers,status:404,json:{message:'Unexpected request'}});
 });
 await page.goto('/login');await page.getByLabel('Email address').fill('cook@example.com');await page.getByLabel('Password',{exact:true}).fill('password123');await page.getByRole('button',{name:'Log in',exact:true}).click();await page.getByRole('link',{name:/Crispy gnocchi/}).click();
 await page.getByRole('button',{name:'Save cooking note'}).click();await expect(page.getByLabel('What worked')).toBeFocused();
 await page.getByLabel('Cooking date').fill('2026-10-29');await page.getByLabel('What worked').fill('Crispy edges and a soft middle.');await page.getByLabel('Next time').fill('Add a little more spinach.');await page.getByRole('button',{name:'Save cooking note'}).click();await expect(page.getByRole('alert')).toContainText('entries are still here');await page.getByRole('button',{name:'Save cooking note'}).click();await expect(page.getByText('Cooking note added.')).toBeVisible();
 await page.reload();await expect(page.getByText('Crispy edges and a soft middle.',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Edit note'}).click();await page.getByLabel('Next time').fill('Add spinach at the very end.');await page.getByRole('button',{name:'Save changes'}).click();await expect(page.getByText('Add spinach at the very end.',{exact:true})).toBeVisible();await expect(page.getByText(/4 \/ 5/)).toBeVisible();
 await page.setViewportSize({width:1280,height:900});await page.screenshot({path:'test-results/cooking-notes-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/cooking-notes-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Delete note'}).click();await expect(page.getByRole('button',{name:'Keep note'})).toBeFocused();await page.getByRole('button',{name:'Keep note'}).click();expect(notes).toHaveLength(1);await page.getByRole('button',{name:'Delete note'}).click();await page.getByRole('button',{name:'Yes, delete note'}).click();await expect(page.getByText(/No cooking notes yet/)).toBeVisible();expect(notes).toHaveLength(0);
});
