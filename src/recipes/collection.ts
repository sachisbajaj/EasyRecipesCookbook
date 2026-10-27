import type { Recipe } from './model';
export type RecipeSort = 'newest' | 'rating' | 'time';
export type CollectionOptions = { query: string; store: string; sort: RecipeSort; starredOnly: boolean; owner: string };
export const normalizeStore = (value: string | null) => (value ?? '').trim().toLowerCase();
export const storeValue = (value: string | null) => normalizeStore(value) ? `store:${normalizeStore(value)}` : 'none';
export function readControls(params: URLSearchParams) {
  const sort = params.get('sort'); const store = params.get('store') ?? '';
  return { query: params.get('q') ?? '', store: store === 'none' || store.startsWith('store:') ? store : '', sort: (sort === 'rating' || sort === 'time' ? sort : 'newest') as RecipeSort };
}
export function storeOptions(recipes: Recipe[]) {
  const stores = new Map<string, string>();
  for (const recipe of recipes) {
    const value = storeValue(recipe.store);
    if (value !== 'none' && !stores.has(value)) {
      const label = recipe.store!.trim();
      stores.set(value, ['all stores', 'no store/source'].includes(label.toLowerCase()) ? `${label} (store label)` : label);
    }
  }
  return [...stores].map(([value, label]) => ({ value, label })).sort((a,b) => a.label.localeCompare(b.label));
}
export function selectRecipes(recipes: Recipe[], options: CollectionOptions) {
  const query = options.query.trim().toLowerCase();
  return recipes.filter(recipe => recipe.user_id === options.owner &&
    (!options.starredOnly || recipe.stars?.some(star => star.user_id === options.owner)) &&
    recipe.title.toLowerCase().includes(query) &&
    (!options.store || storeValue(recipe.store) === options.store)
  ).sort((a,b) => {
    if (options.sort !== 'newest') {
      const av = options.sort === 'rating' ? a.rating : a.minutes;
      const bv = options.sort === 'rating' ? b.rating : b.minutes;
      if (av == null && bv != null) return 1;
      if (av != null && bv == null) return -1;
      if (av != null && bv != null && av !== bv) return options.sort === 'rating' ? bv-av : av-bv;
    }
    return ((Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0)) || a.id.localeCompare(b.id);
  });
}
