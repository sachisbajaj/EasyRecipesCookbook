import { test, expect } from '@playwright/test';
import type { Recipe } from '../../src/recipes/model';
test('recipe workflow, failed save, deletion cancellation, and mobile layout with mocked HTTP', async ({ page }) => {
  const owner = '00000000-0000-0000-0000-000000000001'; const id = '00000000-0000-0000-0000-000000000003';
  const user = { id: owner, aud:'authenticated', role:'authenticated', email:'cook@example.com', app_metadata:{}, user_metadata:{}, created_at:new Date().toISOString() };
  const encode = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
  const token = `${encode({alg:'HS256'})}.${encode({sub:owner,exp:Math.floor(Date.now()/1000)+3600})}.test`;
  let saved: Recipe | null = null; let failSave = true; let failDelete = true; let starred = false; let failStar = true;
  await page.route('https://cookbook-test.supabase.co/**', async route => {
    const request = route.request(); const path = new URL(request.url()).pathname;
    const headers = { 'access-control-allow-origin':'*', 'access-control-allow-headers':'*' };
    if (request.method() === 'OPTIONS') return route.fulfill({status:200,headers});
    if (path.endsWith('/token')) return route.fulfill({headers,json:{access_token:token,refresh_token:'fake',expires_in:3600,token_type:'bearer',user}});
    if (path.endsWith('/user')) return route.fulfill({headers,json:user});
    if (path.endsWith('/rpc/save_recipe')) {
      if (failSave) { failSave = false; return route.fulfill({status:500,headers,json:{message:'Simulated failed transaction'}}); }
      const data = request.postDataJSON(); saved = {...data.p_recipe,id,user_id:owner,created_at:'2026-10-26',updated_at:'2026-10-26',ingredients:data.p_ingredients.map((i: object,position: number) => ({...i,id:`i${position}`,recipe_id:id,position}))};
      return route.fulfill({headers,json:id});
    }
    if (path.endsWith('/stars')) {
      if (failStar) { failStar=false; return route.fulfill({status:500,headers,json:{message:'Simulated failure'}}); }
      starred=request.method()!=='DELETE'; return route.fulfill({status:204,headers});
    }
    if (path.endsWith('/recipes')) {
      if(saved) saved.stars=starred?[{user_id:owner}]:[];
      if (request.method() === 'DELETE') { if (failDelete) { failDelete = false; return route.fulfill({status:500,headers,json:{message:'Simulated failure'}}); } saved = null; return route.fulfill({headers,json:[{id}]}); }
      const single = request.headers().accept?.includes('vnd.pgrst.object');
      return route.fulfill({headers,json:single ? saved : saved ? [saved] : []});
    }
    return route.fulfill({status:404,headers,json:{message:'Unexpected request'}});
  });
  await page.setViewportSize({width:1280,height:900}); await page.goto('/login');
  await page.getByLabel('Email address').fill('cook@example.com'); await page.getByLabel('Password',{exact:true}).fill('password123'); await page.getByRole('button',{name:'Log in',exact:true}).click();
  await expect(page.getByText('Your next favorite starts here.')).toBeVisible(); await page.getByRole('link',{name:'Add recipe',exact:true}).click();
  await page.getByRole('button',{name:'Save recipe',exact:true}).click(); await expect(page.getByLabel('Recipe name')).toBeFocused(); await expect(page.getByLabel('Recipe name')).toHaveAttribute('aria-describedby','title-error');
  await page.getByLabel('Recipe name').fill('Crispy gnocchi & greens'); await page.getByLabel('Instructions',{exact:true}).fill('Pan fry the gnocchi until golden.\nToss with greens and serve.'); await page.getByLabel('Ingredient 1',{exact:true}).fill('Cauliflower gnocchi'); await page.getByLabel('Amount 1').fill('1/4'); await page.getByLabel('Unit 1').fill('bag'); await page.getByRole('button',{name:'Add ingredient',exact:true}).click(); await page.getByLabel('Ingredient 2',{exact:true}).fill('Baby spinach'); await page.getByLabel('Unit 2').fill('handful'); await page.getByLabel('Store or source').fill('Trader Joe’s'); await page.getByLabel('Source URL').fill('https://example.com/gnocchi');
  await page.getByRole('button',{name:'Save recipe',exact:true}).click(); await expect(page.getByRole('alert')).toContainText('Your entries are still here'); await expect(page.getByLabel('Recipe name')).toHaveValue('Crispy gnocchi & greens');
  await page.setViewportSize({width:390,height:844}); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.screenshot({path:'test-results/recipe-form-mobile.png',fullPage:true});
  await page.getByRole('button',{name:'Save recipe',exact:true}).click(); await expect(page.getByRole('heading',{name:'Crispy gnocchi & greens'})).toBeVisible(); await expect(page.getByText('As needed')).toBeVisible(); await expect(page.getByRole('link',{name:/View original/})).toHaveAttribute('href','https://example.com/gnocchi');
  await page.getByRole('button',{name:'Star Crispy gnocchi & greens'}).click(); await expect(page.getByRole('alert')).toContainText('Couldn’t update this star'); await expect(page.getByRole('button',{name:'Star Crispy gnocchi & greens'})).toHaveAttribute('aria-pressed','false');
  await page.getByRole('button',{name:'Star Crispy gnocchi & greens'}).click(); await expect(page.getByRole('button',{name:'Star Crispy gnocchi & greens'})).toHaveAttribute('aria-pressed','true');
  await page.reload(); await expect(page.getByRole('heading',{name:'Crispy gnocchi & greens'})).toBeVisible(); await expect(page.getByRole('button',{name:'Star Crispy gnocchi & greens'})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByText('1/4 bag',{exact:true})).toBeVisible(); await page.getByRole('link',{name:'Edit recipe'}).click(); await expect(page.getByLabel('Amount 1')).toHaveValue('1/4'); await page.getByLabel('Amount 1').fill('1/0'); await page.getByRole('button',{name:'Save recipe',exact:true}).click(); await expect(page.getByLabel('Amount 1')).toBeFocused(); await expect(page.getByLabel('Amount 1')).toHaveValue('1/0'); await page.getByLabel('Amount 1').fill('1/4'); await expect(page.getByLabel('Amount 1')).toHaveAttribute('aria-invalid','false'); await page.getByLabel('Rating (optional)').selectOption('5'); await page.getByRole('button',{name:'Save recipe',exact:true}).click(); await expect(page.getByText(/5 \/ 5/)).toBeVisible();
  await page.screenshot({path:'test-results/recipe-detail-mobile.png',fullPage:true}); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({width:1280,height:900}); await page.screenshot({path:'test-results/recipe-detail-desktop.png',fullPage:true});
  await page.getByRole('button',{name:'Delete recipe',exact:true}).click(); await expect(page.getByRole('dialog')).toContainText('Crispy gnocchi & greens'); await page.getByRole('button',{name:'Keep recipe'}).click(); await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('link',{name:'Your cookbook'}).click(); await page.getByRole('link',{name:'Starred',exact:true}).click(); await expect(page.getByRole('link',{name:/Crispy gnocchi/})).toBeVisible(); await page.getByRole('button',{name:'Star Crispy gnocchi & greens'}).click(); await expect(page.getByText('Your favorites will feel at home here.')).toBeVisible(); await page.getByRole('link',{name:'All recipes',exact:true}).click(); await expect(page.getByRole('link',{name:/Crispy gnocchi/})).toBeVisible(); await page.screenshot({path:'test-results/recipe-collection-desktop.png',fullPage:true}); await page.getByRole('link',{name:/Crispy gnocchi/}).click();
  await page.getByRole('button',{name:'Delete recipe',exact:true}).click(); await page.getByRole('button',{name:'Yes, delete recipe'}).click(); await expect(page.getByRole('alert')).toContainText('couldn’t delete'); await expect(page.getByRole('dialog')).toBeVisible(); await page.getByRole('button',{name:'Yes, delete recipe'}).click(); await expect(page.getByText('Recipe deleted.')).toBeVisible(); await expect(page.getByText('Your next favorite starts here.')).toBeVisible();
});
