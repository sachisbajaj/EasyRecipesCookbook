import { useEffect, useRef, useState, type FormEvent } from 'react';
import { orderNotes, today, validDate, type CookingNote, type NotesService, type NoteValues } from './model';
const blank = (): NoteValues => ({ cooked_on: today(), what_worked: '', next_time: '' });
function displayDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}
// Parent keys this component by account and recipe, so drafts and pending results cannot cross contexts.
export function CookingNotes({ service, recipeId }: { service: NotesService; recipeId: string }) {
  const [notes, setNotes] = useState<CookingNote[]>();
  const [loadError, setLoadError] = useState(false); const [attempt, setAttempt] = useState(0);
  const [draft, setDraft] = useState(blank); const [editing, setEditing] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string,string>>({}); const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const [deleting, setDeleting] = useState<CookingNote | null>(null);
  const lock = useRef(false); const active = useRef(true); const form = useRef<HTMLFormElement>(null);
  const dialog = useRef<HTMLDialogElement>(null); const keep = useRef<HTMLButtonElement>(null);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => {
    let current = true; setLoadError(false);
    service.list(recipeId).then(result => { if (current) setNotes(orderNotes(result)); }).catch(() => { if (current) setLoadError(true); });
    return () => { current = false; };
  }, [service, recipeId, attempt]);
  useEffect(() => { if (Object.keys(errors).length) form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(); }, [errors]);
  function reset() { setDraft(blank()); setEditing(null); setErrors({}); setFailure(''); }
  async function save(event: FormEvent) {
    event.preventDefault(); if (lock.current) return;
    const invalid: Record<string,string> = {};
    if (!validDate(draft.cooked_on)) invalid.date = 'Choose a valid cooking date.';
    if (!draft.what_worked?.trim() && !draft.next_time?.trim()) invalid.content = 'Add what worked or what you want to try next time.';
    setErrors(invalid); setFailure(''); setMessage(''); if (Object.keys(invalid).length) return;
    lock.current = true; setBusy(true);
    try {
      const saved = await service.save(recipeId, draft, editing);
      if (active.current) { setNotes(previous => orderNotes([...(previous ?? []).filter(note => note.id !== saved.id), saved])); reset(); setMessage(editing ? 'Cooking note updated.' : 'Cooking note added.'); }
    } catch { if (active.current) setFailure('We couldn’t save this note. Your entries are still here. Please try again.'); }
    finally { lock.current = false; if (active.current) setBusy(false); }
  }
  async function remove() {
    if (!deleting || lock.current) return;
    lock.current = true; setBusy(true); setFailure('');
    try {
      await service.remove(recipeId, deleting.id);
      if (active.current) { setNotes(previous => previous?.filter(note => note.id !== deleting.id)); if (editing === deleting.id) reset(); dialog.current?.close(); setDeleting(null); setMessage('Cooking note deleted.'); }
    } catch { if (active.current) setFailure('We couldn’t delete this note. Please try again.'); }
    finally { lock.current = false; if (active.current) setBusy(false); }
  }
  return <section className="cooking-notes" aria-labelledby="notes-heading"><p className="eyebrow">BETTER EVERY TIME</p><h2 id="notes-heading">Cooking notes</h2><p>Keep the little lessons from each time you cook. Your recipe rating stays separate.</p>
    {message && <p role="status">{message}</p>}
    {loadError ? <div role="alert"><p>We couldn’t load your cooking notes.</p><button className="secondary" onClick={() => setAttempt(n=>n+1)}>Retry notes</button></div> : notes === undefined ? <p role="status">Opening cooking notes…</p> : <>
      <form ref={form} onSubmit={save} noValidate className="note-editor"><fieldset disabled={busy}><legend>{editing ? 'Edit cooking note' : 'Add a cooking note'}</legend>
        <label htmlFor="cooked-on">Cooking date</label><input id="cooked-on" type="date" min="0001-01-01" max="9999-12-31" value={draft.cooked_on} aria-invalid={Boolean(errors.date)} aria-describedby={errors.date ? 'note-date-error' : undefined} onChange={e=>setDraft(d=>({...d,cooked_on:e.target.value}))}/>{errors.date && <p id="note-date-error" className="field-error">{errors.date}</p>}
        <p id="note-help" className="muted">Fill in at least one of the two notes below.</p><div className="form-pair">{(['what_worked','next_time'] as const).map((field,index)=><div key={field}><label htmlFor={field}>{index === 0 ? 'What worked' : 'Next time'}</label><textarea id={field} rows={4} value={draft[field] ?? ''} aria-invalid={Boolean(errors.content)} aria-describedby={errors.content ? 'note-content-error' : 'note-help'} onChange={e=>setDraft(d=>({...d,[field]:e.target.value}))}/></div>)}</div>
        {errors.content && <p id="note-content-error" className="field-error" role="alert">{errors.content}</p>}{failure && !deleting && <p role="alert" className="error">{failure}</p>}
        <div className="recipe-actions"><button className="primary" type="submit">{busy ? 'Saving…' : editing ? 'Save changes' : 'Save cooking note'}</button>{editing && <button className="secondary" type="button" onClick={reset}>Cancel edit</button>}</div>
      </fieldset></form>
      {notes.length === 0 ? <p className="empty-state">No cooking notes yet. What would you remember for next time?</p> : <ol className="note-history" aria-label="Cooking-note history">{notes.map(note=><li key={note.id}><article><h3><time dateTime={note.cooked_on}>{displayDate(note.cooked_on)}</time></h3><div className="form-pair">{note.what_worked && <div><h4>What worked</h4><p className="instructions">{note.what_worked}</p></div>}{note.next_time && <div><h4>Next time</h4><p className="instructions">{note.next_time}</p></div>}</div><div className="recipe-actions"><button className="secondary" disabled={busy} onClick={()=>{setEditing(note.id);setDraft({cooked_on:note.cooked_on,what_worked:note.what_worked,next_time:note.next_time});setErrors({});setFailure('');setMessage('');form.current?.querySelector('input')?.focus();}}>Edit note</button><button className="secondary" disabled={busy} onClick={()=>{setDeleting(note);setFailure('');dialog.current?.showModal();keep.current?.focus();}}>Delete note</button></div></article></li>)}</ol>}
    </>}
    <dialog ref={dialog} aria-labelledby="delete-note-title" onCancel={e=>{if(lock.current)e.preventDefault();else{setDeleting(null);setFailure('');}}}><h2 id="delete-note-title">Delete cooking note?</h2><p>This removes your entry{deleting ? ` for ${displayDate(deleting.cooked_on)}` : ''}.</p>{failure && deleting && <p role="alert" className="error">{failure}</p>}<div className="recipe-actions"><button ref={keep} className="secondary" disabled={busy} onClick={()=>{dialog.current?.close();setDeleting(null);setFailure('');}}>Keep note</button><button className="primary" disabled={busy} onClick={remove}>{busy ? 'Deleting…' : 'Yes, delete note'}</button></div></dialog>
  </section>;
}
