import type { SupabaseClient } from '@supabase/supabase-js';
import type { CookingNote, NotesService } from './model';
export function createNotesService(client: SupabaseClient): NotesService {
  return {
    async list(recipeId) {
      const notes: CookingNote[] = [];
      for (let start = 0; ; start += 100) {
        const { data, error } = await client.from('cooking_notes').select('*').eq('recipe_id', recipeId).order('cooked_on', { ascending: false }).order('created_at', { ascending: false }).order('id', { ascending: false }).range(start, start+99);
        if (error) throw error;
        notes.push(...data as CookingNote[]);
        if (data.length < 100) return notes;
      }
    },
    async save(recipeId, values, id) {
      // Explicit fields prevent callers from supplying ownership or server metadata.
      const fields = { cooked_on: values.cooked_on, what_worked: values.what_worked?.trim() || null, next_time: values.next_time?.trim() || null };
      const query = id ? client.from('cooking_notes').update(fields).eq('id', id).eq('recipe_id', recipeId) : client.from('cooking_notes').insert({ ...fields, recipe_id: recipeId });
      const { data, error } = await query.select('*').single();
      if (error) throw error;
      return data as CookingNote;
    },
    async remove(recipeId, id) {
      const { data, error } = await client.from('cooking_notes').delete().eq('id', id).eq('recipe_id', recipeId).select('id');
      if (error) throw error;
      if (!data.length) throw new Error('Note is no longer available');
    },
  };
}
