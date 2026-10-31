import type { Recipe } from '../recipes/model';
export function summarizeCookbook(recipes: Recipe[], owner: string) {
  const owned = recipes.filter(recipe => recipe.user_id === owner);
  const distribution = [1, 2, 3, 4, 5].map(rating => ({ label: String(rating), count: 0 }));
  distribution.push({ label: 'Unrated', count: 0 });
  let sum = 0; let rated = 0; let starred = 0;
  for (const recipe of owned) {
    if (recipe.stars?.some(star => star.user_id === owner)) starred++;
    if (recipe.rating !== null && Number.isInteger(recipe.rating) && recipe.rating >= 1 && recipe.rating <= 5) {
      sum += recipe.rating; rated++; distribution[recipe.rating - 1].count++;
    } else distribution[5].count++;
  }
  return { total: owned.length, average: rated ? sum / rated : null, rated, starred, distribution };
}
