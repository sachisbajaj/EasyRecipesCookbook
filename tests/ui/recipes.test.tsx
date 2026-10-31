import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RecipePages } from '../../src/recipes/RecipePages';
import { parseAmount, formatAmount, toDraft, toValues, validateDraft, type Recipe, type RecipeService } from '../../src/recipes/model';
const recipe: Recipe = { id: '00000000-0000-0000-0000-000000000003', user_id: 'a', title: 'Gnocchi', instructions: 'Pan fry.', servings: 2, minutes: null, store: null, source_url: null, rating: null, created_at: '', updated_at: '', ingredients: [{ id: 'i', recipe_id: '', name: 'Gnocchi', quantity: 1, unit: 'bag', position: 0 }] };
function service(): RecipeService { return { groceries: {list:async()=>[],generate:async()=>{},save:async()=>{throw Error('unused')},setChecked:async()=>{},remove:async()=>{}},planner: { list: async()=>[], save: async()=>{throw new Error('unused')}, remove: async()=>{} }, notes: { list: async()=>[], save: async()=>{throw new Error('unused')}, remove: async()=>{} }, list: vi.fn(async () => [recipe]), get: vi.fn(async () => recipe), save: vi.fn(async () => recipe.id), remove: vi.fn(async () => {}), setStar: vi.fn(async () => {}) }; }
function show(s: RecipeService, route = '/cookbook') { return render(<MemoryRouter initialEntries={[route]}><Routes><Route path="/cookbook/*" element={<RecipePages service={s} owner="a"/>}/></Routes></MemoryRouter>); }
it('lists only through the current owner and opens a full recipe', async () => {
  const s = service(); const user = userEvent.setup(); show(s);
  await user.click(await screen.findByRole('link', { name: /Gnocchi/ }));
  expect(await screen.findByText('Pan fry.')).toBeVisible();
  expect(s.list).toHaveBeenCalledWith('a'); expect(s.get).toHaveBeenCalledWith(recipe.id,'a');
  expect(screen.getByText(/Not rated yet/)).toBeVisible();
});
it('preserves edits after failure and sends a single atomic save with null optional fields', async () => {
  const s = service(); vi.mocked(s.save).mockRejectedValueOnce(new Error('offline')); const user = userEvent.setup(); show(s, `/cookbook/${recipe.id}/edit`);
  const title = await screen.findByLabelText('Recipe name'); await user.clear(title); await user.type(title,'Better gnocchi');
  await user.click(screen.getByRole('button', { name: 'Save recipe' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Your entries are still here');
  expect(title).toHaveValue('Better gnocchi');
  expect(s.save).toHaveBeenCalledWith(expect.objectContaining({ title: 'Better gnocchi', rating: null, minutes: null }), [{ name: 'Gnocchi', quantity: 1, unit: 'bag' }], recipe.id);
});
it('validates required inputs and supports adding and removing rows', async () => {
  const s = service(); const user = userEvent.setup(); show(s, '/cookbook/new');
  await user.click(screen.getByRole('button', { name: 'Save recipe' })); expect(s.save).not.toHaveBeenCalled();
  expect(screen.getByText('Give your recipe a name.')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Add ingredient' })); expect(screen.getByLabelText('Ingredient 2')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Remove ingredient 2' })); expect(screen.queryByLabelText('Ingredient 2')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Remove ingredient 1' })); await user.click(screen.getByRole('button', { name: 'Save recipe' })); expect(screen.getByText('Add at least one ingredient.')).toBeVisible();
});
it('shows a neutral missing recipe screen for inaccessible IDs', async () => {
  const s = service(); vi.mocked(s.get).mockResolvedValue(null); show(s, '/cookbook/not-yours');
  expect(await screen.findByRole('heading', { name: 'Recipe not found' })).toBeVisible(); expect(screen.queryByText('Pan fry.')).toBeNull();
});
it('ignores a late read after the private screen is removed', async () => {
  const s = service(); let resolve!: (value: Recipe[]) => void; vi.mocked(s.list).mockImplementation(() => new Promise(r => { resolve = r; }));
  const view = show(s); view.unmount(); await act(async () => resolve([recipe])); expect(screen.queryByText('Gnocchi')).toBeNull();
});
it('validates positive numbers and HTTP links while retaining an unrated value', () => {
  const draft = toDraft(recipe); expect(validateDraft(draft)).toEqual({}); expect(toValues(draft).recipe.rating).toBeNull();
  expect(validateDraft({ ...draft, servings:'0', minutes:'-1', source_url:'javascript:alert(1)', rating:'6' })).toEqual(expect.objectContaining({ servings:expect.any(String), minutes:expect.any(String), source_url:expect.any(String), rating:expect.any(String) }));
});
it('blocks duplicate submissions while a save is pending', async () => {
  const s = service(); let finish!: (id: string) => void; vi.mocked(s.save).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const user = userEvent.setup(); show(s, `/cookbook/${recipe.id}/edit`); await screen.findByLabelText('Recipe name');
  await user.click(screen.getByRole('button', { name: 'Save recipe' }));
  expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Saving…' })); expect(s.save).toHaveBeenCalledTimes(1);
  await act(async () => finish(recipe.id)); expect(await screen.findByText('Pan fry.')).toBeVisible();
});
it('offers retry after a collection request fails', async () => {
  const s = service(); vi.mocked(s.list).mockRejectedValueOnce(new Error('offline')); const user = userEvent.setup(); show(s);
  await user.click(await screen.findByRole('button', { name: 'Try again' })); expect(await screen.findByRole('link', { name: /Gnocchi/ })).toBeVisible();
});

it('parses fractions, mixed numbers, decimals, and units without discarding invalid input', () => {
  for (const [input, quantity, unit] of [['1/4',0.25,null],['1/4 cup',0.25,'cup'],['2tbsp',2,'tbsp'],['1 1/2 cups',1.5,'cups'],['½ cup',0.5,'cup'],['1½',1.5,null],['0.25',0.25,null],['',null,null]] as const) expect(parseAmount(input)).toEqual({quantity,unit});
  for (const input of ['1/0','0','-1','1/','abc','1.2.3','1/4/2']) expect(Number.isNaN(parseAmount(input).quantity)).toBe(true);
  expect(formatAmount(0.25)).toBe('1/4'); expect(formatAmount(1.5)).toBe('1 1/2');
});
it('preserves typed fractions, saves numeric quantities, and rejects malformed amounts', async () => {
  const s=service(); const user=userEvent.setup(); show(s,`/cookbook/${recipe.id}/edit`);
  const amount=await screen.findByLabelText('Amount 1'); await user.clear(amount); await user.type(amount,'1/');
  await user.click(screen.getByRole('button',{name:'Save recipe'})); expect(s.save).not.toHaveBeenCalled(); expect(amount).toHaveValue('1/');
  await user.clear(amount); await user.type(amount,'1/4 cup'); await user.click(screen.getByRole('button',{name:'Save recipe'}));
  expect(s.save).toHaveBeenCalledWith(expect.anything(),[{name:'Gnocchi',quantity:0.25,unit:'cup'}],recipe.id);
});
it('waits for blur, links errors to fields, and clears them during correction', async () => {
  const user=userEvent.setup(); show(service(),'/cookbook/new');
  const title=screen.getByLabelText('Recipe name'); expect(screen.queryByRole('alert')).toBeNull();
  await user.click(title); expect(title).toHaveAttribute('aria-invalid','false'); await user.tab();
  expect(title).toHaveAccessibleDescription('Give your recipe a name.');
  await user.type(title,'Pasta'); expect(title).toHaveAttribute('aria-invalid','false'); expect(title).not.toHaveAttribute('aria-describedby');
  expect(screen.getByLabelText('Servings')).toHaveAttribute('aria-invalid','false');
});
it('focuses the first invalid input and associates ingredient errors with stable rows', async () => {
  const user=userEvent.setup(); show(service(),'/cookbook/new');
  await user.click(screen.getByRole('button',{name:'Save recipe'})); expect(screen.getByLabelText('Recipe name')).toHaveFocus();
  await user.type(screen.getByLabelText('Recipe name'),'Pasta'); await user.type(screen.getByLabelText('Instructions'),'Cook.');
  await user.type(screen.getByLabelText('Ingredient 1'),'Pasta'); await user.click(screen.getByRole('button',{name:'Add ingredient'}));
  await user.type(screen.getByLabelText('Ingredient 2'),'Salt'); await user.type(screen.getByLabelText('Amount 2'),'1/0');
  const bad=screen.getByLabelText('Amount 2'); await user.click(screen.getByRole('button',{name:'Save recipe'})); expect(bad).toHaveFocus(); expect(bad).toHaveAccessibleDescription(/Enter an amount/);
  await user.click(screen.getByRole('button',{name:'Remove ingredient 1'})); expect(screen.getByLabelText('Amount 1')).toBe(bad); expect(bad).toHaveAccessibleDescription(/Enter an amount/);
  await user.click(screen.getByRole('button',{name:'Remove ingredient 1'})); expect(screen.queryByText(/Enter an amount such/)).toBeNull();
  await user.click(screen.getByRole('button',{name:'Save recipe'})); expect(screen.getByRole('button',{name:'Add ingredient'})).toHaveFocus();
});
it('retains malformed optional cooking time until corrected rather than saving it as blank', async () => {
  const s=service(); const user=userEvent.setup(); show(s,`/cookbook/${recipe.id}/edit`);
  const minutes=await screen.findByLabelText('Cooking time in minutes (optional)'); await user.type(minutes,'1e');
  await user.click(screen.getByRole('button',{name:'Save recipe'})); expect(minutes).toHaveValue('1e'); expect(minutes).toHaveFocus(); expect(minutes).toHaveAccessibleDescription(/positive whole number/); expect(s.save).not.toHaveBeenCalled();
  await user.clear(minutes); expect(minutes).toHaveAttribute('aria-invalid','false'); await user.click(screen.getByRole('button',{name:'Save recipe'})); expect(s.save).toHaveBeenCalledWith(expect.objectContaining({minutes:null}),expect.anything(),recipe.id);
});
it('preserves every ingredient after a failed create and allows retry after correction', async () => {
  const s=service(); vi.mocked(s.save).mockRejectedValueOnce(new Error('private SQL details')); const user=userEvent.setup(); show(s,'/cookbook/new');
  await user.type(screen.getByLabelText('Recipe name'),'Dip'); await user.type(screen.getByLabelText('Instructions'),'Blend.'); await user.type(screen.getByLabelText('Ingredient 1'),'Yogurt'); await user.type(screen.getByLabelText('Amount 1'),'1/4 cup');
  await user.click(screen.getByRole('button',{name:'Add ingredient'})); await user.type(screen.getByLabelText('Ingredient 2'),'Sauce'); await user.type(screen.getByLabelText('Amount 2'),'2tbsp');
  await user.click(screen.getByRole('button',{name:'Save recipe'})); expect(await screen.findByRole('alert')).toHaveTextContent('Check your connection'); expect(screen.queryByText('private SQL details')).toBeNull();
  expect(screen.getByLabelText('Amount 1')).toHaveValue('1/4 cup'); expect(screen.getByLabelText('Amount 2')).toHaveValue('2tbsp');
  await user.click(screen.getByRole('button',{name:'Save recipe'})); expect(s.save).toHaveBeenCalledTimes(2); expect(s.save).toHaveBeenLastCalledWith(expect.objectContaining({rating:null}),[{name:'Yogurt',quantity:0.25,unit:'cup'},{name:'Sauce',quantity:2,unit:'tbsp'}],null);
});
it('rejects invalid optional values and nonfinite amounts without converting them to empty values', () => {
  const draft=toDraft(recipe);
  for(const value of ['0','-1','1.5','NaN','Infinity','2147483648']) expect(validateDraft({...draft,minutes:value}).minutes).toBeTruthy();
  for(const value of ['NaN','Infinity','-Infinity','1/0','0/4','1/','-1/4']) expect(validateDraft({...draft,ingredients:[{...draft.ingredients[0],quantity:value}]})).toHaveProperty('i-quantity');
  for(const value of ['ftp://example.com','javascript:alert(1)','https://','https://a b.com']) expect(validateDraft({...draft,source_url:value}).source_url).toBeTruthy();
});
it('stars a recipe without opening its card and shows it in the Starred view', async () => {
  const s=service(); let starred=false;
  vi.mocked(s.list).mockImplementation(async()=>[{...recipe,stars:starred?[{user_id:'a'}]:[]}]);
  vi.mocked(s.setStar).mockImplementation(async(_id,_owner,value)=>{starred=value;});
  const user=userEvent.setup(); show(s);
  const button=await screen.findByRole('button',{name:'Star Gnocchi'}); await user.click(button);
  expect(button).toHaveAttribute('aria-pressed','true'); expect(s.get).not.toHaveBeenCalled(); expect(s.setStar).toHaveBeenCalledWith(recipe.id,'a',true);
  await user.click(screen.getByRole('link',{name:'Starred'})); expect(await screen.findByRole('link',{name:/Gnocchi/})).toBeVisible();
  await user.click(screen.getByRole('button',{name:'Star Gnocchi'})); expect(await screen.findByText('Your favorites will feel at home here.')).toBeVisible(); expect(s.remove).not.toHaveBeenCalled();
});
it('retains star state and recipe content after failure and permits retry', async () => {
  const s=service(); vi.mocked(s.setStar).mockRejectedValueOnce(new Error('offline')); const user=userEvent.setup(); show(s,`/cookbook/${recipe.id}`);
  const button=await screen.findByRole('button',{name:'Star Gnocchi'}); await user.click(button);
  expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t update this star'); expect(button).toHaveAttribute('aria-pressed','false'); expect(screen.getByText('Pan fry.')).toBeVisible();
  await user.click(button); expect(button).toHaveAttribute('aria-pressed','true'); expect(screen.queryByRole('alert')).toBeNull();
});
it('prevents duplicate star requests while saving', async () => {
  const s=service(); let finish!:()=>void; vi.mocked(s.setStar).mockImplementation(()=>new Promise<void>(r=>{finish=r;})); const user=userEvent.setup(); show(s);
  const button=await screen.findByRole('button',{name:'Star Gnocchi'}); await user.click(button); expect(button).toBeDisabled(); await user.click(button); expect(s.setStar).toHaveBeenCalledTimes(1); await act(async()=>finish()); expect(button).toHaveAttribute('aria-pressed','true');
});
it('hides unstarred recipes from the Starred view', async () => {
  const s=service(); show(s,'/cookbook/starred'); expect(await screen.findByText('Your favorites will feel at home here.')).toBeVisible(); expect(screen.queryByRole('link',{name:/Gnocchi/})).toBeNull();
});
it('combines collection controls, shows no-results, and resets to the complete collection',async()=>{
 const s=service();vi.mocked(s.list).mockResolvedValue([{...recipe,store:'Trader Joe’s',rating:4},{...recipe,id:'two',title:'Soup',store:'Other',rating:null}]);const user=userEvent.setup();show(s);
 await screen.findByRole('link',{name:/Gnocchi/});await user.type(screen.getByLabelText('Search titles'),'soup');
 expect(screen.queryByRole('link',{name:/Gnocchi/})).toBeNull();expect(screen.getByRole('link',{name:/Soup/})).toBeVisible();
 await user.selectOptions(screen.getByLabelText('Store or source'),'store:trader joe’s');expect(screen.getByText('No recipes match these controls.')).toBeVisible();
 await user.click(screen.getByRole('button',{name:'Clear search and filters'}));expect(screen.getByLabelText('Search titles')).toHaveValue('');expect(screen.getByRole('link',{name:/Gnocchi/})).toBeVisible();expect(screen.getByText('2 recipes shown')).toBeVisible();
});
it('restores URL controls and keeps them when opening Starred',async()=>{
 const s=service();vi.mocked(s.list).mockResolvedValue([{...recipe,stars:[{user_id:'a'}]}]);const user=userEvent.setup();show(s,'/cookbook?q=gnocchi&sort=rating');
 await screen.findByRole('link',{name:/Gnocchi/});expect(screen.getByLabelText('Search titles')).toHaveValue('gnocchi');expect(screen.getByLabelText('Sort recipes')).toHaveValue('rating');
 await user.click(screen.getByRole('link',{name:'Starred'}));expect(await screen.findByRole('link',{name:/Gnocchi/})).toBeVisible();expect(screen.getByLabelText('Search titles')).toHaveValue('gnocchi');
});
