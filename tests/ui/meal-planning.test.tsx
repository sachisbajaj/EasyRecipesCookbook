import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, expect, test, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import MealPlan from '../../src/planner/MealPlan';
import { addDays, selectedWeek, weekOf, weekDays, type Meal } from '../../src/planner/model';
import type { Recipe, RecipeService } from '../../src/recipes/model';
const recipe:Recipe={id:'r',user_id:'a',title:'Gnocchi',servings:2,instructions:'Cook',minutes:null,rating:null,store:null,source_url:null,created_at:'2026-10-30',updated_at:'2026-10-30',ingredients:[]};
const meal:Meal={id:'m',user_id:'a',recipe_id:'r',planned_date:'2026-10-26',servings:4};
function service():RecipeService{return{list:vi.fn(async()=>[recipe]),get:vi.fn(async()=>recipe),save:vi.fn(async()=>''),remove:vi.fn(async()=>{}),setStar:vi.fn(async()=>{}),notes:{list:async()=>[],save:async()=>{throw Error();},remove:async()=>{}},planner:{list:vi.fn(async()=>[meal]),save:vi.fn(async(owner,values,id)=>({...values,user_id:owner,id:id??'new'})),remove:vi.fn(async()=>{})}};}
function show(s:RecipeService){return render(<MemoryRouter initialEntries={['/cookbook/meal-plan?week=2026-10-26']}><MealPlan service={s} owner="a"/></MemoryRouter>);}
beforeAll(()=>{HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};});
test('Monday weeks cover Sunday, leap day, year boundaries and calendar limits',()=>{
 expect(weekOf('2027-01-03')).toBe('2026-12-28');expect(weekOf('2027-01-04')).toBe('2027-01-04');expect(weekDays('2024-02-26')).toContain('2024-02-29');expect(addDays('0001-01-01',-7)).toBeNull();expect(addDays('9999-12-27',7)).toBeNull();expect(selectedWeek('bad')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});
test('validates, defaults servings, preserves failed saves, edits and cancels',async()=>{
 const s=service(),user=userEvent.setup();show(s);await screen.findByRole('button',{name:'Add to week'});await user.click(screen.getByRole('button',{name:'Add to week'}));expect(screen.getByLabelText('Recipe')).toHaveFocus();expect(s.planner.save).not.toHaveBeenCalled();
 await user.selectOptions(screen.getByLabelText('Recipe'),'r');expect(screen.getByLabelText('Planned servings')).toHaveValue('2');fireEvent.change(screen.getByLabelText('Cooking date'),{target:{value:'2026-11-03'}});await user.click(screen.getByRole('button',{name:'Add to week'}));expect(screen.getByLabelText('Cooking date')).toHaveFocus();
 fireEvent.change(screen.getByLabelText('Cooking date'),{target:{value:'2026-10-28'}});vi.mocked(s.planner.save).mockRejectedValueOnce(Error());await user.click(screen.getByRole('button',{name:'Add to week'}));expect(await screen.findByRole('alert')).toHaveTextContent('entries are still here');expect(screen.getByLabelText('Recipe')).toHaveValue('r');await user.click(screen.getByRole('button',{name:'Add to week'}));expect(await screen.findByText('Meal added to your week.')).toBeVisible();
 await user.click(screen.getAllByRole('button',{name:'Edit meal'})[0]);expect(screen.getByLabelText('Planned servings')).toHaveValue('4');await user.click(screen.getByRole('button',{name:'Cancel edit'}));expect(screen.getByLabelText('Recipe')).toHaveValue('');
 await user.click(screen.getAllByRole('button',{name:'Edit meal'})[0]);await user.clear(screen.getByLabelText('Planned servings'));await user.type(screen.getByLabelText('Planned servings'),'6');await user.click(screen.getByRole('button',{name:'Save meal changes'}));expect(await screen.findByText('Planned meal updated.')).toBeVisible();expect(s.planner.save).toHaveBeenLastCalledWith('a',expect.objectContaining({servings:6}),'m');
});
test('removal requires confirmation and keeps entries after failure',async()=>{
 const s=service(),user=userEvent.setup();show(s);await user.click(await screen.findByRole('button',{name:'Remove meal'}));await user.click(screen.getByRole('button',{name:'Keep meal'}));expect(s.planner.remove).not.toHaveBeenCalled();
 await user.click(screen.getByRole('button',{name:'Remove meal'}));vi.mocked(s.planner.remove).mockRejectedValueOnce(Error());await user.click(screen.getByRole('button',{name:'Yes, remove meal'}));expect(await screen.findByRole('alert')).toHaveTextContent('couldn’t remove');await user.click(screen.getByRole('button',{name:'Yes, remove meal'}));expect(await screen.findByText('Meal removed from your plan.')).toBeVisible();expect(screen.queryByRole('button',{name:'Remove meal'})).not.toBeInTheDocument();
});
test('retries errors and ignores old-week responses after navigation',async()=>{
 const s=service();vi.mocked(s.planner.list).mockRejectedValueOnce(Error());show(s);fireEvent.click(await screen.findByRole('button',{name:'Retry meal plan'}));await screen.findByText('4 servings');
 let finish!:(value:Meal[])=>void;vi.mocked(s.planner.list).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));fireEvent.click(screen.getByRole('button',{name:'Next week'}));vi.mocked(s.planner.list).mockResolvedValue([]);fireEvent.click(screen.getByRole('button',{name:'Next week'}));await screen.findByRole('button',{name:'Add to week'});await act(async()=>finish([{...meal,planned_date:'2026-11-02'}]));expect(screen.queryByText('4 servings')).not.toBeInTheDocument();expect(screen.getByLabelText('Choose any date in your week')).toHaveValue('2026-11-09');
});
