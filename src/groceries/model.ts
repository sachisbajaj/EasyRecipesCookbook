export type GroceryItem = { id:string; user_id:string; week_start:string; name:string; quantity:number|null; unit:string; checked:boolean; position:number };
export type GroceryValues = Pick<GroceryItem,'name'|'quantity'|'unit'>;
export interface GroceryService {
  list(owner:string,week:string):Promise<GroceryItem[]>;
  generate(week:string):Promise<void>;
  save(owner:string,week:string,values:GroceryValues,id:string|null):Promise<GroceryItem>;
  setChecked(owner:string,week:string,id:string,checked:boolean):Promise<void>;
  remove(owner:string,week:string,id:string):Promise<void>;
}
