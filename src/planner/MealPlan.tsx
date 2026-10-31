import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { Recipe, RecipeService } from '../recipes/model';
import { addDays, dateLabel, selectedWeek, validServings, weekDays, type Meal } from './model';
function WeekPlan({service,owner,week}:{service:RecipeService;owner:string;week:string}) {
  const days=weekDays(week);
  const [data,setData]=useState<{recipes:Recipe[];meals:Meal[]}>();const [loadError,setLoadError]=useState(false);const [attempt,setAttempt]=useState(0);
  const [recipeId,setRecipeId]=useState('');const [date,setDate]=useState(week);const [servings,setServings]=useState('');const [editing,setEditing]=useState<string|null>(null);
  const [errors,setErrors]=useState<Record<string,string>>({});const [failure,setFailure]=useState('');const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
  const [deleting,setDeleting]=useState<Meal|null>(null);const dialog=useRef<HTMLDialogElement>(null);const keep=useRef<HTMLButtonElement>(null);const form=useRef<HTMLFormElement>(null);
  const lock=useRef(false);const active=useRef(true);
  useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
  useEffect(()=>{let current=true;setLoadError(false);Promise.all([service.list(owner),service.planner.list(owner,week)]).then(([recipes,meals])=>{if(current)setData({recipes:recipes.filter(r=>r.user_id===owner),meals:meals.filter(m=>m.user_id===owner && days.includes(m.planned_date))});}).catch(()=>{if(current)setLoadError(true);});return()=>{current=false;};},[service,owner,week,attempt]);
  useEffect(()=>{if(Object.keys(errors).length)form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();},[errors]);
  function reset(){setRecipeId('');setDate(week);setServings('');setEditing(null);setErrors({});setFailure('');}
  async function save(event:FormEvent){
    event.preventDefault();if(lock.current)return;
    const invalid:Record<string,string>={};
    if(!data?.recipes.some(r=>r.id===recipeId))invalid.recipe='Choose a recipe from your cookbook.';
    if(!days.includes(date))invalid.date='Choose a date within this week.';
    if(!validServings(servings))invalid.servings='Enter a positive whole number of servings.';
    setErrors(invalid);setFailure('');setMessage('');if(Object.keys(invalid).length)return;
    lock.current=true;setBusy(true);
    try{const meal=await service.planner.save(owner,{recipe_id:recipeId,planned_date:date,servings:Number(servings)},editing);if(active.current){setData(previous=>previous?{...previous,meals:[...previous.meals.filter(m=>m.id!==meal.id),meal]}:previous);reset();setMessage(editing?'Planned meal updated.':'Meal added to your week.');}}
    catch{if(active.current)setFailure('We couldn’t save this meal. Your entries are still here. The recipe may have been removed; please try again.');}
    finally{lock.current=false;if(active.current)setBusy(false);}
  }
  async function remove(){
    if(!deleting||lock.current)return;lock.current=true;setBusy(true);setFailure('');
    try{await service.planner.remove(owner,deleting.id);if(active.current){setData(previous=>previous?{...previous,meals:previous.meals.filter(m=>m.id!==deleting.id)}:previous);if(editing===deleting.id)reset();dialog.current?.close();setDeleting(null);setMessage('Meal removed from your plan.');}}
    catch{if(active.current)setFailure('We couldn’t remove this meal. Please try again.');}
    finally{lock.current=false;if(active.current)setBusy(false);}
  }
  const props=(key:string)=>({'aria-invalid':Boolean(errors[key]),'aria-describedby':errors[key]?`meal-${key}-error`:undefined});
  const error=(key:string)=>errors[key]?<p id={`meal-${key}-error`} className="field-error">{errors[key]}</p>:null;
  if(loadError)return <div role="alert"><p>We couldn’t load your meal plan.</p><button className="secondary" onClick={()=>setAttempt(n=>n+1)}>Retry meal plan</button></div>;
  if(!data)return <p role="status">Opening your week…</p>;
  return <>
    {message&&<p role="status">{message}</p>}
    {data.recipes.length===0?<div className="empty-state"><h2>A good week starts with a recipe.</h2><p>Add a recipe to start planning your meals.</p><Link to="/cookbook/new">Add your first recipe →</Link></div>:<form className="meal-editor" ref={form} onSubmit={save} noValidate><fieldset disabled={busy}><legend>{editing?'Edit planned meal':'Add a meal'}</legend>
      <div className="meal-fields"><div><label htmlFor="meal-recipe">Recipe</label><select id="meal-recipe" value={recipeId} {...props('recipe')} onChange={e=>{setRecipeId(e.target.value);setServings(String(data.recipes.find(r=>r.id===e.target.value)?.servings??''));}}><option value="">Choose a recipe</option>{data.recipes.map(r=><option key={r.id} value={r.id}>{r.title}</option>)}</select>{error('recipe')}</div>
      <div><label htmlFor="meal-date">Cooking date</label><input id="meal-date" type="date" min={week} max={days[6]} value={date} {...props('date')} onChange={e=>setDate(e.target.value)}/>{error('date')}</div>
      <div><label htmlFor="meal-servings">Planned servings</label><input id="meal-servings" inputMode="numeric" value={servings} {...props('servings')} onChange={e=>setServings(e.target.value)}/>{error('servings')}</div></div>
      {Object.keys(errors).length>0&&<p role="alert" className="error">Please correct the marked fields.</p>}{failure&&!deleting&&<p role="alert" className="error">{failure}</p>}
      <div className="recipe-actions"><button className="primary" type="submit">{busy?'Saving…':editing?'Save meal changes':'Add to week'}</button>{editing&&<button className="secondary" type="button" onClick={reset}>Cancel edit</button>}</div>
    </fieldset></form>}
    <div className="week-grid">{days.map(day=><section className="meal-day" key={day} aria-label={dateLabel(day)}><h2><time dateTime={day}>{dateLabel(day)}</time></h2>{!data.meals.some(m=>m.planned_date===day)?<p className="muted">Nothing planned yet.</p>:<ul>{data.meals.filter(m=>m.planned_date===day).sort((a,b)=>a.id.localeCompare(b.id)).map(meal=><li key={meal.id}><Link to={`/cookbook/${meal.recipe_id}`}>{data.recipes.find(r=>r.id===meal.recipe_id)?.title??'Recipe unavailable'}</Link><p>{meal.servings} {meal.servings===1?'serving':'servings'}</p><div className="recipe-actions"><button className="secondary" disabled={busy} onClick={()=>{setEditing(meal.id);setRecipeId(meal.recipe_id);setDate(meal.planned_date);setServings(String(meal.servings));setErrors({});setFailure('');setMessage('');form.current?.querySelector('select')?.focus();}}>Edit meal</button><button className="secondary" disabled={busy} onClick={()=>{setDeleting(meal);setFailure('');dialog.current?.showModal();keep.current?.focus();}}>Remove meal</button></div></li>)}</ul>}</section>)}</div>
    <dialog ref={dialog} aria-labelledby="remove-meal-title" onCancel={e=>{if(lock.current)e.preventDefault();else{setDeleting(null);setFailure('');}}}><h2 id="remove-meal-title">Remove this planned meal?</h2><p>The recipe stays in your cookbook.</p>{failure&&deleting&&<p role="alert" className="error">{failure}</p>}<div className="recipe-actions"><button ref={keep} className="secondary" disabled={busy} onClick={()=>{dialog.current?.close();setDeleting(null);setFailure('');}}>Keep meal</button><button className="primary" disabled={busy} onClick={remove}>{busy?'Removing…':'Yes, remove meal'}</button></div></dialog>
  </>;
}
export default function MealPlan({service,owner}:{service:RecipeService;owner:string}) {
  const [params,setParams]=useSearchParams();const week=selectedWeek(params.get('week'));const previous=addDays(week,-7),next=addDays(week,7);
  function choose(value:string){setParams({week:selectedWeek(value)});}
  return <section className="meal-plan"><p className="eyebrow">A LITTLE PLANNING, A BETTER WEEK</p><h1>Your meal plan</h1><p>Pick your dinners and how many you’re cooking for. Repeat favorites as often as you like.</p><div className="week-controls"><button className="secondary" disabled={!previous} onClick={()=>previous&&choose(previous)}>Previous week</button><div><label htmlFor="plan-week">Choose any date in your week</label><input id="plan-week" type="date" min="0001-01-01" max="9999-12-26" value={week} onChange={e=>{if(e.target.value)choose(e.target.value);}}/></div><button className="secondary" disabled={!next||!addDays(next,6)} onClick={()=>next&&choose(next)}>Next week</button></div><p className="muted">Week of {dateLabel(week)} – {dateLabel(weekDays(week)[6])}</p><WeekPlan key={`${owner}:${week}`} service={service} owner={owner} week={week}/></section>;
}
