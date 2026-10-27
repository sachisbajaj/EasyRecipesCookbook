import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RecipePages } from '../../src/recipes/RecipePages';
import { parseAmount, formatAmount, toDraft, toValues, validateDraft, type Recipe, type RecipeService } from '../../src/recipes/model';
const recipe: Recipe = { id: '00000000-0000-0000-0000-000000000003', user_id: 'a', title: 'Gnocchi', instructions: 'Pan fry.', servings: 2, minutes: null, store: null, source_url: null, rating: null, created_at: '', updated_at: '', ingredients: [{ id: 'i', recipe_id: '', name: 'Gnocchi', quantity: 1, unit: 'bag', position: 0 }] };
function service(): RecipeService { return { list: vi.fn(async () => [recipe]), get: vi.fn(async () => recipe), save: vi.fn(async () => recipe.id), remove: vi.fn(async () => {}) }; }
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
