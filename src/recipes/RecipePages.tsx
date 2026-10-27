import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { blankIngredient, formatAmount, RecipeMissing, safeSource, toDraft, toValues, validateDraft, type Recipe, type RecipeDraft, type RecipeService } from './model';

type Props = { service: RecipeService; owner: string };
function useLoad<T>(fetcher: () => Promise<T>, dependencies: unknown[]) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true; setData(undefined); setError(false);
    fetcher().then(value => { if (active) setData(value); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [...dependencies, attempt]);
  return { data, error, retry: () => setAttempt(n => n + 1) };
}
function LoadError({ retry }: { retry: () => void }) { return <div role="alert"><p>We couldn’t load your recipes. Please try again.</p><button className="secondary" onClick={retry}>Try again</button></div>; }
function Missing() { return <section><h1>Recipe not found</h1><p>This recipe isn’t available in your cookbook.</p><Link to="/cookbook">Back to cookbook</Link></section>; }
function Collection({ service, owner }: Props) {
  const { data, error, retry } = useLoad(() => service.list(owner), [service, owner]);
  const location = useLocation();
  return <section><div className="recipe-heading"><div><p className="eyebrow">GOOD FOOD, ON REPEAT</p><h1>Your weeknight favorites</h1></div><Link className="primary button-link" to="/cookbook/new">Add recipe</Link></div>
    {location.state?.message && <p role="status">{location.state.message}</p>}
    {error ? <LoadError retry={retry}/> : !data ? <p role="status">Opening your recipes…</p> : data.length === 0 ? <div className="empty-state"><h2>Your next favorite starts here.</h2><p>Save an easy dinner, its ingredients, and the link you want to come back to.</p><Link to="/cookbook/new">Add your first recipe →</Link></div> : <div className="recipe-grid">{data.map(recipe => <Link className="recipe-card" key={recipe.id} to={`/cookbook/${recipe.id}`}><p className="eyebrow">{recipe.store || 'FROM YOUR KITCHEN'}</p><h2>{recipe.title}</h2><p>{recipe.servings} servings{recipe.minutes !== null && ` · ${recipe.minutes} min`}</p><p>{recipe.rating === null ? 'Not rated yet' : `${recipe.rating} / 5`}</p><span>Let’s cook →</span></Link>)}</div>}
  </section>;
}
function Editor({ service, recipe }: { service: RecipeService; recipe?: Recipe }) {
  const [draft, setDraft] = useState<RecipeDraft>(() => toDraft(recipe));
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [attempt, setAttempt] = useState(0);
  const form = useRef<HTMLFormElement>(null);
  const invalid = validateDraft(draft);
  const errors = Object.fromEntries(Object.entries(invalid).filter(([key]) => attempt > 0 || touched[key]));
  function touch(key: string) { setTouched(previous => ({ ...previous, [key]: true })); }
  useEffect(() => {
    if (attempt) form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [attempt]);
  function errorProps(key: string) {
    return { 'aria-invalid': Boolean(errors[key]), 'aria-describedby': errors[key] ? `${key}-error` : undefined, onBlur: () => touch(key) };
  }
  function errorMessage(key: string) {
    return errors[key] ? <p id={`${key}-error`} className="field-error">{errors[key]}</p> : null;
  }
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false); const active = useRef(true); const navigate = useNavigate();
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  function field(key: keyof Omit<RecipeDraft, 'ingredients'>, label: string, type = 'text') {
    return <div><label htmlFor={key}>{label}</label><input id={key} type={type === 'number' ? 'text' : type} inputMode={type === 'number' ? 'numeric' : undefined} value={draft[key]} onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))} {...errorProps(key)}/>{errorMessage(key)}</div>;
  }
  async function submit(e: FormEvent) {
    e.preventDefault(); if (lock.current) return;
    setAttempt(n => n + 1); setFailure('');
    if (Object.keys(invalid).length) return;
    lock.current = true; setBusy(true);
    try { const values = toValues(draft); const id = await service.save(values.recipe, values.ingredients, recipe?.id ?? null); if (active.current) navigate(`/cookbook/${id}`, { replace: true }); }
    catch (error) { if (active.current) setFailure(error instanceof RecipeMissing ? 'This recipe is no longer available. Your entries are still here; copy them before leaving this page.' : 'We couldn’t save this recipe. Your entries are still here. Check your connection and try again.'); }
    finally { lock.current = false; if (active.current) setBusy(false); }
  }
  return <section className="recipe-editor"><p className="eyebrow">A LITTLE SOMETHING WORTH KEEPING</p><h1>{recipe ? 'Edit recipe' : 'Add a recipe'}</h1><p>Required: name, instructions, servings, and at least one ingredient. Everything else can wait.</p><form ref={form} onSubmit={submit} noValidate>
    <fieldset disabled={busy}><legend className="sr-only">Recipe details</legend>
      {field('title', 'Recipe name')}
      <label htmlFor="instructions">Instructions</label><textarea id="instructions" rows={7} value={draft.instructions} onChange={e => setDraft(d => ({ ...d, instructions: e.target.value }))} {...errorProps('instructions')}/>{errorMessage('instructions')}
      <div className="form-pair">{field('servings', 'Servings', 'number')}{field('minutes', 'Cooking time in minutes (optional)', 'number')}</div>
      <h2>Ingredients</h2><p className="muted">Use amounts like 1/4, 1 1/2, or 0.25. You can also enter 1/4 cup or 2 tbsp. Leave blank only for “as needed.” A unit included in the amount replaces the separate Unit value when saved.</p>
      {draft.ingredients.map((item, index) => <div className="ingredient-row" key={item.key}>{(['name', 'quantity', 'unit'] as const).map(key => <div key={key}><label htmlFor={`${item.key}-${key}`}>{key === 'name' ? 'Ingredient' : key === 'quantity' ? 'Amount' : 'Unit'} {index + 1}</label><input id={`${item.key}-${key}`} type="text" placeholder={key === 'quantity' ? 'e.g. 1/4' : undefined} value={item[key]} onChange={e => setDraft(d => ({ ...d, ingredients: d.ingredients.map(i => i.key === item.key ? { ...i, [key]: e.target.value } : i) }))} {...errorProps(`${item.key}-${key}`)}/>{errorMessage(`${item.key}-${key}`)}</div>)}<button type="button" className="secondary" aria-label={`Remove ingredient ${index + 1}`} onClick={() => { touch('ingredients'); setDraft(d => ({ ...d, ingredients: d.ingredients.filter(i => i.key !== item.key) })); }}>Remove</button></div>)}
      {errorMessage('ingredients')}<button className="secondary" type="button" {...errorProps('ingredients')} onClick={() => setDraft(d => ({ ...d, ingredients: [...d.ingredients, blankIngredient()] }))}>Add ingredient</button>
      <h2>The little extras</h2>{field('store', 'Store or source label (optional)')}{field('source_url', 'Source URL (optional)', 'url')}
      <label htmlFor="rating">Rating (optional)</label><select id="rating" {...errorProps('rating')} value={draft.rating} onChange={e => setDraft(d => ({ ...d, rating: e.target.value }))}><option value="">Not rated yet</option>{[1,2,3,4,5].map(n => <option key={n} value={n}>{n} / 5</option>)}</select>{errorMessage('rating')}
      {Object.keys(errors).length > 0 && <p role="alert" className="error">Please correct the marked fields, then save again.</p>}{failure && <p role="alert" className="error">{failure}</p>}
      {/* Keep blur validation from moving Save between mouse-down and click. Keyboard submission still works. */}
      <div className="recipe-actions"><button className="primary" type="submit" onMouseDown={event => event.preventDefault()}>{busy ? 'Saving…' : 'Save recipe'}</button><button type="button" className="secondary" onClick={() => navigate(recipe ? `/cookbook/${recipe.id}` : '/cookbook')}>Cancel</button></div>
    </fieldset></form></section>;
}
function Detail({ recipe, service, owner }: Props & { recipe: Recipe }) {
  const dialog = useRef<HTMLDialogElement>(null); const cancel = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false); const lock = useRef(false); const active = useRef(true); const [error, setError] = useState(''); const navigate = useNavigate();
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  async function remove() {
    if (lock.current) return; lock.current = true; setBusy(true); setError('');
    try { await service.remove(recipe.id, owner); if (active.current) navigate('/cookbook', { replace: true, state: { message: 'Recipe deleted.' } }); }
    catch { if (active.current) setError('We couldn’t delete this recipe. Please try again.'); }
    finally { lock.current = false; if (active.current) setBusy(false); }
  }
  const source = safeSource(recipe.source_url);
  return <article className="recipe-detail"><Link to="/cookbook">← Your cookbook</Link><p className="eyebrow">{recipe.store || 'FROM YOUR KITCHEN'}</p><h1>{recipe.title}</h1><p className="recipe-meta">{recipe.servings} servings{recipe.minutes !== null && ` · ${recipe.minutes} min`} · {recipe.rating === null ? 'Not rated yet' : `${recipe.rating} / 5`}</p>
    <div className="recipe-actions"><Link className="secondary button-link" to={`/cookbook/${recipe.id}/edit`}>Edit recipe</Link><button className="secondary" onClick={() => { setError(''); dialog.current?.showModal(); cancel.current?.focus(); }}>Delete recipe</button>{source && <a href={source} target="_blank" rel="noopener noreferrer">View original recipe ↗</a>}</div>
    <div className="recipe-body"><section><h2>Ingredients</h2><ul className="ingredient-list">{[...recipe.ingredients].sort((a,b) => a.position-b.position).map(i => <li key={i.id}><strong>{i.name}</strong><span>{i.quantity === null ? 'As needed' : `${formatAmount(i.quantity)} ${i.unit}`}</span></li>)}</ul></section><section><h2>Let’s make it</h2><p className="instructions">{recipe.instructions}</p></section></div>
    <dialog ref={dialog} aria-labelledby="delete-title" aria-describedby="delete-description" onCancel={e => { if (lock.current) e.preventDefault(); }}><h2 id="delete-title">Delete “{recipe.title}”?</h2><p id="delete-description">This removes the recipe and its ingredients from your cookbook.</p>{error && <p role="alert" className="error">{error}</p>}<div className="recipe-actions"><button ref={cancel} className="secondary" disabled={busy} onClick={() => dialog.current?.close()}>Keep recipe</button><button className="primary" disabled={busy} onClick={remove}>{busy ? 'Deleting…' : 'Yes, delete recipe'}</button></div></dialog>
  </article>;
}
function Existing({ service, owner, edit = false }: Props & { edit?: boolean }) {
  const { id = '' } = useParams();
  const { data, error, retry } = useLoad(() => service.get(id, owner), [service, owner, id]);
  if (error) return <LoadError retry={retry}/>;
  if (data === undefined) return <p role="status">Opening your recipe…</p>;
  if (!data) return <Missing/>;
  return edit ? <Editor recipe={data} service={service}/> : <Detail recipe={data} service={service} owner={owner}/>;
}
export function RecipePages({ service, owner }: { service: RecipeService | null; owner: string }) {
  const location = useLocation();
  if (!service) return <p role="status">Recipe access isn’t available yet. Please try again later.</p>;
  return <Routes key={location.pathname}><Route index element={<Collection service={service} owner={owner}/>}/><Route path="new" element={<Editor service={service}/>}/><Route path=":id" element={<Existing service={service} owner={owner}/>}/><Route path=":id/edit" element={<Existing service={service} owner={owner} edit/>}/><Route path="*" element={<Missing/>}/></Routes>;
}
