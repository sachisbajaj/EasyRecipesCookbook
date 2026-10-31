import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, expect, test, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import GroceryList from '../../src/groceries/GroceryList';
import type { RecipeService } from '../../src/recipes/model';
import type { GroceryItem } from '../../src/groceries/model';
const item:GroceryItem={id:'g',user_id:'a',week_start:'2026-10-26',name:'Rice',quantity:2,unit:'cup',checked:false,position:0};
function service():RecipeService{return{list:async()=>[],get:async()=>null,save:async()=>'',remove:async()=>{},setStar:async()=>{},notes:{list:async()=>[],save:async()=>{throw Error();},remove:async()=>{}},planner:{list:async()=>[],save:async()=>{throw Error();},remove:async()=>{}},groceries:{list:vi.fn(async()=>[item]),generate:vi.fn(async()=>{}),save:vi.fn(async(owner,week,values,id)=>({...item,...values,id:id??'new',user_id:owner,week_start:week})),setChecked:vi.fn(async()=>{}),remove:vi.fn(async()=>{})}};}
function show(s:RecipeService){return render(<MemoryRouter initialEntries={['/cookbook/grocery-list?week=2026-10-26']}><GroceryList service={s} owner="a"/></MemoryRouter>);}
beforeAll(()=>{HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};});
test('generation requires confirmation and cancellation preserves the list',async()=>{
 const s=service(),user=userEvent.setup();show(s);await user.click(await screen.findByRole('button',{name:'Regenerate from meals'}));expect(screen.getByRole('dialog')).toHaveTextContent('edits, and checkmarks');await user.click(screen.getByRole('button',{name:'Cancel'}));expect(s.groceries.generate).not.toHaveBeenCalled();expect(screen.getByText('Rice')).toBeVisible();
 await user.click(screen.getByRole('button',{name:'Regenerate from meals'}));vi.mocked(s.groceries.generate).mockRejectedValueOnce(Error());await user.click(screen.getByRole('button',{name:'Yes, generate list'}));expect(await screen.findByRole('alert')).toHaveTextContent('couldn’t finish');expect(screen.getByText('Rice')).toBeVisible();
 vi.mocked(s.groceries.list).mockResolvedValue([]);await user.click(screen.getByRole('button',{name:'Yes, generate list'}));expect(await screen.findByText('A fresh list for your week.')).toBeVisible();expect(s.groceries.generate).toHaveBeenLastCalledWith('2026-10-26');
});
test('validates manual input, keeps failed edits, and parses fractional quantities',async()=>{
 const s=service(),user=userEvent.setup();show(s);await user.click(await screen.findByRole('button',{name:'Add item'}));expect(screen.getByLabelText('Item name')).toHaveFocus();expect(s.groceries.save).not.toHaveBeenCalled();
 await user.type(screen.getByLabelText('Item name'),'Yogurt');await user.type(screen.getByLabelText('Amount (optional)'),'1/0');await user.click(screen.getByRole('button',{name:'Add item'}));expect(screen.getByLabelText('Amount (optional)')).toHaveFocus();await user.clear(screen.getByLabelText('Amount (optional)'));await user.type(screen.getByLabelText('Amount (optional)'),'1/4 cup');
 vi.mocked(s.groceries.save).mockRejectedValueOnce(Error());await user.click(screen.getByRole('button',{name:'Add item'}));expect(await screen.findByRole('alert')).toHaveTextContent('entries are still here');expect(screen.getByLabelText('Item name')).toHaveValue('Yogurt');await user.click(screen.getByRole('button',{name:'Add item'}));expect(await screen.findByText('Grocery item added.')).toBeVisible();expect(s.groceries.save).toHaveBeenLastCalledWith('a','2026-10-26',{name:'Yogurt',quantity:0.25,unit:'cup'},null);
 await user.click(screen.getAllByRole('button',{name:'Edit item'})[0]);await user.click(screen.getByRole('button',{name:'Cancel edit'}));expect(screen.getByLabelText('Item name')).toHaveValue('');
});
test('checkmarks only change on success and deletion requires confirmation',async()=>{
 const s=service(),user=userEvent.setup();show(s);const check=await screen.findByRole('checkbox');vi.mocked(s.groceries.setChecked).mockRejectedValueOnce(Error());await user.click(check);expect(check).not.toBeChecked();await user.click(check);expect(check).toBeChecked();expect(s.groceries.setChecked).toHaveBeenLastCalledWith('a','2026-10-26','g',true);
 await user.click(screen.getByRole('button',{name:'Remove item'}));await user.click(screen.getByRole('button',{name:'Cancel'}));expect(s.groceries.remove).not.toHaveBeenCalled();await user.click(screen.getByRole('button',{name:'Remove item'}));await user.click(screen.getByRole('button',{name:'Yes, remove item'}));expect(await screen.findByText('Grocery item removed.')).toBeVisible();expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
});
test('successful generation with failed reload recovers without generating again',async()=>{
 const s=service(),user=userEvent.setup();show(s);await user.click(await screen.findByRole('button',{name:'Regenerate from meals'}));vi.mocked(s.groceries.list).mockRejectedValueOnce(Error());await user.click(screen.getByRole('button',{name:'Yes, generate list'}));expect(await screen.findByText(/Your list was generated/)).toBeVisible();await user.click(screen.getByRole('button',{name:'Reload saved list'}));await screen.findByText('Rice');expect(s.groceries.generate).toHaveBeenCalledTimes(1);
});
test('late responses from a previous week do not replace the selected week',async()=>{
 const s=service();show(s);await screen.findByText('Rice');let finish!:(items:GroceryItem[])=>void;vi.mocked(s.groceries.list).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));fireEvent.click(screen.getByRole('button',{name:'Next week'}));vi.mocked(s.groceries.list).mockResolvedValue([]);fireEvent.click(screen.getByRole('button',{name:'Next week'}));await screen.findByText('A fresh list for your week.');await act(async()=>finish([{...item,week_start:'2026-11-02'}]));expect(screen.queryByText('Rice')).not.toBeInTheDocument();
});
