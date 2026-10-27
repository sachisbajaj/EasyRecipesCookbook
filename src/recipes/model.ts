export type Ingredient = { id: string; recipe_id: string; name: string; quantity: number | null; unit: string; position: number };
export type Recipe = {
  id: string; user_id: string; title: string; instructions: string; servings: number;
  minutes: number | null; store: string | null; source_url: string | null; rating: number | null;
  created_at: string; updated_at: string; ingredients: Ingredient[];
};
export type RecipeValues = Pick<Recipe, 'title' | 'instructions' | 'servings' | 'minutes' | 'store' | 'source_url' | 'rating'>;
export type IngredientValues = Pick<Ingredient, 'name' | 'quantity' | 'unit'>;
export interface RecipeService {
  list(owner: string): Promise<Recipe[]>;
  get(id: string, owner: string): Promise<Recipe | null>;
  save(recipe: RecipeValues, ingredients: IngredientValues[], id: string | null): Promise<string>;
  remove(id: string, owner: string): Promise<void>;
}
export class RecipeMissing extends Error {}
export const isRecipeId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
export function safeSource(value: string | null): string | null {
  if (!value || !/^https?:\/\//i.test(value) || /\s/.test(value)) return null;
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; }
  catch { return null; }
}
// Keep text input intact until validation; number inputs erase fractions.
export function parseAmount(value: string): { quantity: number | null; unit: string | null } {
  const text = value.trim().replace(/⁄/g, '/').replace(/([¼½¾⅓⅔⅛⅜⅝⅞])/g, (_, symbol: string) => ' ' + ({'¼':'1/4','½':'1/2','¾':'3/4','⅓':'1/3','⅔':'2/3','⅛':'1/8','⅜':'3/8','⅝':'5/8','⅞':'7/8'}[symbol] ?? '')).trim();
  if (!text) return { quantity: null, unit: null };
  const match = text.match(/^(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)(?:\s*([a-zA-Z][a-zA-Z .-]*))?$/);
  let quantity: number; let unit: string | null;
  if (match) {
    quantity = Number(match[1] ?? 0) + Number(match[2]) / Number(match[3]);
    unit = match[4]?.trim() || null;
    if (Number(match[3]) === 0) quantity = NaN;
  } else {
    const decimal = text.match(/^(\d+(?:\.\d+)?|\.\d+)(?:\s*([a-zA-Z][a-zA-Z .-]*))?$/);
    quantity = decimal ? Number(decimal[1]) : NaN;
    unit = decimal?.[2]?.trim() || null;
  }
  return { quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : NaN, unit };
}
export function formatAmount(quantity: number): string {
  const whole = Math.floor(quantity); const part = quantity - whole;
  if (part === 0) return String(whole);
  for (const denominator of [2, 3, 4, 8]) {
    const numerator = Math.round(part * denominator);
    if (numerator > 0 && numerator < denominator && Math.abs(part - numerator / denominator) < 1e-10) return `${whole ? whole + ' ' : ''}${numerator}/${denominator}`;
  }
  return String(quantity);
}
export type FormIngredient = { key: string; name: string; quantity: string; unit: string };
export type RecipeDraft = { title: string; instructions: string; servings: string; minutes: string; store: string; source_url: string; rating: string; ingredients: FormIngredient[] };
export function blankIngredient(): FormIngredient { return { key: crypto.randomUUID(), name: '', quantity: '', unit: 'item' }; }
export function toDraft(recipe?: Recipe): RecipeDraft {
  return recipe ? {
    title: recipe.title, instructions: recipe.instructions, servings: String(recipe.servings), minutes: recipe.minutes === null ? '' : String(recipe.minutes),
    store: recipe.store ?? '', source_url: recipe.source_url ?? '', rating: recipe.rating === null ? '' : String(recipe.rating),
    ingredients: [...recipe.ingredients].sort((a,b) => a.position-b.position).map(i => ({ key: i.id, name: i.name, quantity: i.quantity === null ? '' : formatAmount(i.quantity), unit: i.unit })),
  } : { title: '', instructions: '', servings: '2', minutes: '', store: '', source_url: '', rating: '', ingredients: [blankIngredient()] };
}
export function validateDraft(draft: RecipeDraft): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!draft.title.trim()) errors.title = 'Give your recipe a name.';
  if (!draft.instructions.trim()) errors.instructions = 'Add the cooking instructions.';
  const positiveInteger = (v: string) => /^\d+$/.test(v.trim()) && Number(v) > 0 && Number(v) <= 2147483647;
  if (!positiveInteger(draft.servings)) errors.servings = 'Enter a positive whole number of servings.';
  if (draft.minutes.trim() && !positiveInteger(draft.minutes)) errors.minutes = 'Enter a positive whole number of minutes.';
  if (draft.rating && !/^[1-5]$/.test(draft.rating)) errors.rating = 'Choose a rating from 1 to 5, or leave it unrated.';
  if (draft.source_url.trim() && (!safeSource(draft.source_url.trim()) || /\s/.test(draft.source_url.trim()))) errors.source_url = 'Enter a complete http:// or https:// link.';
  if (!draft.ingredients.length) errors.ingredients = 'Add at least one ingredient.';
  draft.ingredients.forEach(i => {
    if (!i.name.trim()) errors[`${i.key}-name`] = 'Enter an ingredient name.';
    const amount = parseAmount(i.quantity);
    if (Number.isNaN(amount.quantity)) errors[`${i.key}-quantity`] = 'Enter an amount such as 1/4, 1 1/2, or 0.25. Leave blank only for “as needed.”';
    if (!i.unit.trim() && !amount.unit) errors[`${i.key}-unit`] = 'Enter a unit, such as item, cup, or bag.';
  });
  return errors;
}
export function toValues(d: RecipeDraft): { recipe: RecipeValues; ingredients: IngredientValues[] } {
  return { recipe: { title: d.title.trim(), instructions: d.instructions.trim(), servings: Number(d.servings), minutes: d.minutes.trim() ? Number(d.minutes) : null,
    store: d.store.trim() || null, source_url: d.source_url.trim() || null, rating: d.rating ? Number(d.rating) : null },
    ingredients: d.ingredients.map(i => ({ name: i.name.trim(), quantity: parseAmount(i.quantity).quantity, unit: parseAmount(i.quantity).unit ?? i.unit.trim() })) };
}
