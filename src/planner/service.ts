import type { SupabaseClient } from '@supabase/supabase-js';
import { weekDays, type Meal, type PlannerService } from './model';
export function createPlannerService(client: SupabaseClient): PlannerService {
  return {
    async list(owner, week) {
      const meals: Meal[]=[];
      for(let start=0;;start+=100) {
        const {data,error}=await client.from('meal_plan_entries').select('*').eq('user_id',owner).gte('planned_date',week).lte('planned_date',weekDays(week)[6]).order('planned_date').order('id').range(start,start+99);
        if(error)throw error; meals.push(...data as Meal[]);if(data.length<100)return meals;
      }
    },
    async save(owner, values, id) {
      const fields={recipe_id:values.recipe_id,planned_date:values.planned_date,servings:values.servings};
      const query=id ? client.from('meal_plan_entries').update(fields).eq('id',id).eq('user_id',owner) : client.from('meal_plan_entries').insert({...fields,user_id:owner});
      const {data,error}=await query.select('*').single();if(error)throw error;return data as Meal;
    },
    async remove(owner,id) {
      const {data,error}=await client.from('meal_plan_entries').delete().eq('id',id).eq('user_id',owner).select('id');
      if(error)throw error;if(!data.length)throw new Error('Meal no longer available');
    },
  };
}
