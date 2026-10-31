import type { SupabaseClient } from '@supabase/supabase-js';
import type { GroceryItem, GroceryService } from './model';
export function createGroceryService(client:SupabaseClient):GroceryService {
 return {
  async list(owner,week){
   const items:GroceryItem[]=[];
   for(let start=0;;start+=100){const {data,error}=await client.from('grocery_items').select('*').eq('user_id',owner).eq('week_start',week).order('position').order('id').range(start,start+99);if(error)throw error;items.push(...data as GroceryItem[]);if(data.length<100)return items;}
  },
  async generate(week){const {error}=await client.rpc('generate_grocery_list',{p_week:week});if(error)throw error;},
  async save(owner,week,values,id){
   const fields={name:values.name.trim(),quantity:values.quantity,unit:values.unit.trim()};
   const query=id?client.from('grocery_items').update(fields).eq('id',id).eq('user_id',owner).eq('week_start',week):client.from('grocery_items').insert({...fields,user_id:owner,week_start:week});
   const {data,error}=await query.select('*').single();if(error)throw error;return data as GroceryItem;
  },
  async setChecked(owner,week,id,checked){const {data,error}=await client.from('grocery_items').update({checked}).eq('id',id).eq('user_id',owner).eq('week_start',week).select('id');if(error)throw error;if(!data.length)throw Error('Item no longer available');},
  async remove(owner,week,id){const {data,error}=await client.from('grocery_items').delete().eq('id',id).eq('user_id',owner).eq('week_start',week).select('id');if(error)throw error;if(!data.length)throw Error('Item no longer available');},
 };
}
