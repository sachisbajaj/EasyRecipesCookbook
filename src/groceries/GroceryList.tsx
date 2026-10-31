import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { formatAmount, parseAmount, type RecipeService } from '../recipes/model';
import { addDays, dateLabel, selectedWeek, weekDays } from '../planner/model';
import type { GroceryItem } from './model';
const blank=()=>({name:'',quantity:'',unit:'item'});
function WeekList({service,owner,week}:{service:RecipeService;owner:string;week:string}) {
 const [items,setItems]=useState<GroceryItem[]>();const [loadError,setLoadError]=useState(false);const [attempt,setAttempt]=useState(0);
 const [draft,setDraft]=useState(blank);const [editing,setEditing]=useState<string|null>(null);const [errors,setErrors]=useState<Record<string,string>>({});
 const [failure,setFailure]=useState('');const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
 const [confirmation,setConfirmation]=useState<'generate'|GroceryItem|null>(null);const dialog=useRef<HTMLDialogElement>(null);const keep=useRef<HTMLButtonElement>(null);const form=useRef<HTMLFormElement>(null);
 const lock=useRef(false);const active=useRef(true);
 const owned=(rows:GroceryItem[])=>rows.filter(item=>item.user_id===owner&&item.week_start===week);
 useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
 useEffect(()=>{let current=true;setItems(undefined);setLoadError(false);service.groceries.list(owner,week).then(rows=>{if(current)setItems(owned(rows));}).catch(()=>{if(current)setLoadError(true);});return()=>{current=false;};},[service,owner,week,attempt]);
 useEffect(()=>{if(Object.keys(errors).length)form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();},[errors]);
 function reset(){setDraft(blank());setEditing(null);setErrors({});}
 // One pending write at a time; unmounted weeks/accounts never receive late results.
 async function write(operation:()=>Promise<void>){
  if(lock.current)return;lock.current=true;setBusy(true);setFailure('');setMessage('');
  try{await operation();}catch{if(active.current)setFailure('We couldn’t finish that request. Your entries are still here. Reload the saved list before trying again.');}
  finally{lock.current=false;if(active.current)setBusy(false);}
 }
 async function save(event:FormEvent){
  event.preventDefault();if(lock.current)return;
  const amount=parseAmount(draft.quantity),invalid:Record<string,string>={};
  if(!draft.name.trim())invalid.name='Enter an item name.';
  if(Number.isNaN(amount.quantity))invalid.quantity='Enter a positive amount, such as 1/4 or 2. Leave blank for “as needed.”';
  if(!draft.unit.trim()&&!amount.unit)invalid.unit='Enter a unit, such as cup, bag, or item.';
  setErrors(invalid);if(Object.keys(invalid).length)return;
  await write(async()=>{const saved=await service.groceries.save(owner,week,{name:draft.name.trim(),quantity:amount.quantity,unit:amount.unit??draft.unit.trim()},editing);if(active.current){setItems(previous=>[...(previous??[]).filter(item=>item.id!==saved.id),saved].sort((a,b)=>a.position-b.position||a.id.localeCompare(b.id)));reset();setMessage(editing?'Grocery item updated.':'Grocery item added.');}});
 }
 function confirm(value:'generate'|GroceryItem){setConfirmation(value);setFailure('');dialog.current?.showModal();keep.current?.focus();}
 async function finishConfirmation(){
  const action=confirmation;if(!action)return;
  await write(async()=>{
   if(action==='generate'){
    await service.groceries.generate(week);
    if(!active.current)return;
    // Generation committed even if the following read fails. Offer reload, not an automatic second generation.
    reset();dialog.current?.close();setConfirmation(null);
    try{const rows=await service.groceries.list(owner,week);if(active.current){setItems(owned(rows));setMessage('Grocery list generated from this week’s meals.');}}
    catch{if(active.current){setItems(undefined);setLoadError(true);setFailure('Your list was generated, but we couldn’t reload it. Reload the saved list.');}}
   }else{
    await service.groceries.remove(owner,week,action.id);
    if(active.current){setItems(previous=>previous?.filter(item=>item.id!==action.id));if(editing===action.id)reset();dialog.current?.close();setConfirmation(null);setMessage('Grocery item removed.');}
   }
  });
 }
 const props=(key:string)=>({'aria-invalid':Boolean(errors[key]),'aria-describedby':errors[key]?`grocery-${key}-error`:undefined});
 return <>
  {message&&<p role="status">{message}</p>}
  {failure&&!confirmation&&<p role="alert" className="error">{failure}</p>}
  <div className="recipe-actions"><button className="primary" disabled={busy||items===undefined||loadError} onClick={()=>confirm('generate')}>{items?.length?'Regenerate from meals':'Generate from meals'}</button><button className="secondary" disabled={busy} onClick={()=>{setFailure('');setAttempt(n=>n+1);}}>Reload saved list</button><Link to={`/cookbook/meal-plan?week=${week}`}>View this week’s meals</Link></div>
  {loadError?<p role="alert">We couldn’t load your grocery list. Use “Reload saved list” to try again.</p>:items===undefined?<p role="status">Opening your grocery list…</p>:<>
   <p className="muted">{items.filter(item=>item.checked).length} of {items.length} items checked off</p>
   <form ref={form} onSubmit={save} noValidate className="meal-editor"><fieldset disabled={busy}><legend>{editing?'Edit grocery item':'Add an extra item'}</legend><div className="meal-fields">{(['name','quantity','unit'] as const).map(key=><div key={key}><label htmlFor={`grocery-${key}`}>{key==='name'?'Item name':key==='quantity'?'Amount (optional)':'Unit'}</label><input id={`grocery-${key}`} value={draft[key]} {...props(key)} onChange={e=>setDraft(previous=>({...previous,[key]:e.target.value}))}/>{errors[key]&&<p id={`grocery-${key}-error`} className="field-error">{errors[key]}</p>}</div>)}</div><p className="muted">Use amounts like 1/4, 1 1/2, or 2 cups. Leave the amount blank for “as needed.”</p><div className="recipe-actions"><button className="primary" type="submit">{busy?'Saving…':editing?'Save item changes':'Add item'}</button>{editing&&<button className="secondary" type="button" onClick={reset}>Cancel edit</button>}</div></fieldset></form>
   {items.length===0?<div className="empty-state"><h2>A fresh list for your week.</h2><p>Generate a list from your planned meals, or add an item above.</p></div>:<ul className="grocery-list" aria-label="Grocery checklist">{items.map(item=><li key={item.id} className={item.checked?'grocery-checked':''}><label className="grocery-check"><input type="checkbox" checked={item.checked} disabled={busy} aria-label={`Bought or already own ${item.name} (${item.quantity===null?'as needed':`${formatAmount(item.quantity)} ${item.unit}`})`} onChange={()=>void write(async()=>{await service.groceries.setChecked(owner,week,item.id,!item.checked);if(active.current)setItems(previous=>previous?.map(row=>row.id===item.id?{...row,checked:!item.checked}:row));})}/><span>{item.name}</span></label><span className="grocery-amount">{item.quantity===null?`As needed · ${item.unit}`:`${formatAmount(item.quantity)} ${item.unit}`}</span><div className="recipe-actions"><button className="secondary" disabled={busy} onClick={()=>{setEditing(item.id);setDraft({name:item.name,quantity:item.quantity===null?'':formatAmount(item.quantity),unit:item.unit});setErrors({});setFailure('');form.current?.querySelector('input')?.focus();}}>Edit item</button><button className="secondary" disabled={busy} onClick={()=>confirm(item)}>Remove item</button></div></li>)}</ul>}
  </>}
  <dialog ref={dialog} aria-labelledby="grocery-confirm-title" onCancel={e=>{if(lock.current)e.preventDefault();else{setConfirmation(null);setFailure('');}}}><h2 id="grocery-confirm-title">{confirmation==='generate'?'Generate this week’s list?':'Remove this item?'}</h2><p>{confirmation==='generate'?'This replaces all saved items, manual additions, edits, and checkmarks for this week with ingredients from your currently planned meals. If no meals are planned, the new list will be empty. Unsaved item edits will also be discarded.':'This removes the item from your saved list. Recipes and planned meals stay unchanged.'}</p>{failure&&confirmation&&<p role="alert" className="error">{failure}</p>}<div className="recipe-actions"><button ref={keep} className="secondary" disabled={busy} onClick={()=>{dialog.current?.close();setConfirmation(null);setFailure('');}}>Cancel</button><button className="primary" disabled={busy} onClick={finishConfirmation}>{busy?'Working…':confirmation==='generate'?'Yes, generate list':'Yes, remove item'}</button></div></dialog>
 </>;
}
export default function GroceryList({service,owner}:{service:RecipeService;owner:string}) {
 const [params,setParams]=useSearchParams();const week=selectedWeek(params.get('week'));const previous=addDays(week,-7),next=addDays(week,7);
 function choose(value:string){setParams({week:selectedWeek(value)});}
 return <section className="meal-plan"><p className="eyebrow">ONE LIST, LESS GUESSWORK</p><h1>Your grocery list</h1><p>Shop for your week, then check off what you’ve bought or already have.</p><p className="muted">This is a saved snapshot. Changes to recipes or meals won’t change your list until you generate it again. Matching names and units combine; different units stay separate. Known amounts and “as needed” amounts remain separate.</p><div className="week-controls"><button className="secondary" disabled={!previous} onClick={()=>previous&&choose(previous)}>Previous week</button><div><label htmlFor="grocery-week">Choose any date in your week</label><input id="grocery-week" type="date" min="0001-01-01" max="9999-12-26" value={week} onChange={e=>{if(e.target.value)choose(e.target.value);}}/></div><button className="secondary" disabled={!next||!addDays(next,6)} onClick={()=>next&&choose(next)}>Next week</button></div><p className="muted">Week of {dateLabel(week)} – {dateLabel(weekDays(week)[6])}</p><WeekList key={`${owner}:${week}`} service={service} owner={owner} week={week}/></section>;
}
