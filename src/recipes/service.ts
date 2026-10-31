import { createNotesService } from '../notes/service';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isRecipeId, RecipeMissing, type Recipe, type RecipeService } from './model';
export function createRecipeService(client: SupabaseClient): RecipeService {
  return {
    notes: createNotesService(client),
    async list(owner) {
      const recipes: Recipe[] = [];
      // Page through the API rather than silently truncating a larger collection.
      for (let start = 0; ; start += 100) {
        const { data, error } = await client.from('recipes').select('*, ingredients(*), stars(user_id)').eq('user_id', owner).order('created_at', { ascending: false }).order('id').range(start, start + 99);
        if (error) throw error;
        recipes.push(...data as Recipe[]);
        if (data.length < 100) return recipes;
      }
    },
    async get(id, owner) {
      if (!isRecipeId(id)) return null;
      const { data, error } = await client.from('recipes').select('*, ingredients(*), stars(user_id)').eq('id', id).eq('user_id', owner).maybeSingle();
      if (error) throw error;
      return data as Recipe | null;
    },
    async save(recipe, ingredients, id) {
      const { data, error } = await client.rpc('save_recipe', { p_recipe: recipe, p_ingredients: ingredients, p_id: id });
      if (error?.code === 'P0002') throw new RecipeMissing();
      if (error) throw error;
      if (typeof data !== 'string' || !isRecipeId(data)) throw new Error('Invalid save response');
      return data;
    },
    async setStar(id, owner, starred) {
      const result = starred
        ? await client.from('stars').upsert({ user_id: owner, recipe_id: id }, { onConflict: 'user_id,recipe_id', ignoreDuplicates: true })
        : await client.from('stars').delete().eq('user_id', owner).eq('recipe_id', id);
      if (result.error) throw result.error;
    },
    async remove(id, owner) {
      const { data, error } = await client.from('recipes').delete().eq('id', id).eq('user_id', owner).select('id');
      if (error) throw error;
      if (!data.length) throw new RecipeMissing();
    },
  };
}
