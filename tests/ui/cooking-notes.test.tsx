import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, expect, test, vi } from 'vitest';
import { CookingNotes } from '../../src/notes/CookingNotes';
import { validDate, orderNotes, type CookingNote, type NotesService } from '../../src/notes/model';
const note: CookingNote = { id:'n',recipe_id:'r',cooked_on:'2026-10-30',what_worked:'Crispy edges',next_time:null,created_at:'2026-10-30T12:00:00Z' };
function service(): NotesService { return { list:vi.fn(async()=>[note]), save:vi.fn(async(_r,values,id)=>({...note,...values,id:id??'new'})),remove:vi.fn(async()=>{}) }; }
beforeAll(()=>{ HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');}; });
test('validates calendar dates including leap days and deterministic newest-first ordering',()=>{
 expect(validDate('2024-02-29')).toBe(true);for(const date of ['2026-02-29','2026-02-30','0000-01-01','','infinity'])expect(validDate(date)).toBe(false);
 expect(orderNotes([note,{...note,id:'z'},{...note,id:'old',cooked_on:'2025-12-01'}]).map(n=>n.id)).toEqual(['z','n','old']);
});
test('requires content, preserves failed saves, adds, edits and cancels',async()=>{
 const s=service();const user=userEvent.setup();render(<CookingNotes service={s} recipeId="r"/>);await screen.findByText('Crispy edges');
 await user.click(screen.getByRole('button',{name:'Save cooking note'}));expect(s.save).not.toHaveBeenCalled();expect(screen.getByLabelText('What worked')).toHaveFocus();
 await user.type(screen.getByLabelText('Next time'),'Less salt');vi.mocked(s.save).mockRejectedValueOnce(new Error('offline'));
 await user.click(screen.getByRole('button',{name:'Save cooking note'}));expect(await screen.findByRole('alert')).toHaveTextContent('entries are still here');expect(screen.getByLabelText('Next time')).toHaveValue('Less salt');
 await user.click(screen.getByRole('button',{name:'Save cooking note'}));expect(await screen.findByText('Cooking note added.')).toBeVisible();expect(screen.getByLabelText('Next time')).toHaveValue('');
 await user.click(screen.getAllByRole('button',{name:'Edit note'})[0]);await user.click(screen.getByRole('button',{name:'Cancel edit'}));expect(screen.getByLabelText('What worked')).toHaveValue('');
 await user.click(screen.getAllByRole('button',{name:'Edit note'})[0]);await user.clear(screen.getByLabelText('What worked'));await user.type(screen.getByLabelText('What worked'),'More crisp');await user.click(screen.getByRole('button',{name:'Save changes'}));expect(await screen.findByText('Cooking note updated.')).toBeVisible();expect(s.save).toHaveBeenLastCalledWith('r',expect.objectContaining({what_worked:'More crisp'}),expect.any(String));
});
test('confirms deletion, preserves entry on failure, then removes it',async()=>{
 const s=service();const user=userEvent.setup();render(<CookingNotes service={s} recipeId="r"/>);await screen.findByText('Crispy edges');
 await user.click(screen.getByRole('button',{name:'Delete note'}));await user.click(screen.getByRole('button',{name:'Keep note'}));expect(s.remove).not.toHaveBeenCalled();
 await user.click(screen.getByRole('button',{name:'Delete note'}));vi.mocked(s.remove).mockRejectedValueOnce(new Error());await user.click(screen.getByRole('button',{name:'Yes, delete note'}));expect(await screen.findByRole('alert')).toHaveTextContent('couldn’t delete');expect(screen.getByText('Crispy edges')).toBeVisible();
 await user.click(screen.getByRole('button',{name:'Yes, delete note'}));expect(await screen.findByText('Cooking note deleted.')).toBeVisible();expect(screen.queryByText('Crispy edges')).not.toBeInTheDocument();
});
test('retries loading and ignores a previous recipe’s late result',async()=>{
 const s=service();vi.mocked(s.list).mockRejectedValueOnce(new Error());const view=render(<CookingNotes key="a:r" service={s} recipeId="r"/>);await screen.findByText('We couldn’t load your cooking notes.');fireEvent.click(screen.getByRole('button',{name:'Retry notes'}));await screen.findByText('Crispy edges');
 let finish!:(notes:CookingNote[])=>void;vi.mocked(s.list).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));view.rerender(<CookingNotes key="a:other" service={s} recipeId="other"/>);
 vi.mocked(s.list).mockResolvedValue([]);view.rerender(<CookingNotes key="b:new" service={s} recipeId="new"/>);await screen.findByText(/No cooking notes yet/);await act(async()=>finish([note]));expect(screen.queryByText('Crispy edges')).not.toBeInTheDocument();
});
test('blocks duplicate submissions while save is pending',async()=>{
 const s=service();let finish!:(value:CookingNote)=>void;vi.mocked(s.save).mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));render(<CookingNotes service={s} recipeId="r"/>);await screen.findByText('Crispy edges');fireEvent.change(screen.getByLabelText('What worked'),{target:{value:'Good'}});const form=screen.getByRole('button',{name:'Save cooking note'}).closest('form')!;fireEvent.submit(form);fireEvent.submit(form);expect(s.save).toHaveBeenCalledTimes(1);await act(async()=>finish(note));
});
