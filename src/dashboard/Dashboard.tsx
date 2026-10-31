import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Recipe, RecipeService } from '../recipes/model';
import { summarizeCookbook } from './summary';
export default function Dashboard({ service, owner }: { service: RecipeService; owner: string }) {
  const [result, setResult] = useState<{ owner: string; recipes: Recipe[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true; setResult(null); setFailed(false);
    service.list(owner).then(recipes => { if (active) setResult({ owner, recipes }); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [service, owner, attempt]);
  return <section className="dashboard"><p className="eyebrow">A LITTLE LOOK AT WHAT YOU LOVE</p><h1>Your cookbook, at a glance</h1><p className="muted">Your whole collection, including recipes you haven’t rated yet.</p>
    {failed ? <div className="notice" role="alert"><p>We couldn’t load your cookbook summary. Please try again.</p><button className="secondary" onClick={() => setAttempt(n => n + 1)}>Try again</button></div> : !result || result.owner !== owner ? <p role="status">Gathering your cookbook…</p> : <Summary recipes={result.recipes} owner={owner}/>}
  </section>;
}
function Summary({ recipes, owner }: { recipes: Recipe[]; owner: string }) {
  const summary = summarizeCookbook(recipes, owner);
  return <>
    <dl className="dashboard-stats">
      <div><dt>Total recipes</dt><dd data-testid="total-recipes">{summary.total}</dd><Link to="/cookbook">Browse your recipes →</Link></div>
      <div><dt>Average rating</dt><dd data-testid="average-rating">{summary.average === null ? 'Not rated yet' : summary.average.toFixed(1)}</dd><p>{summary.rated ? `Out of 5 · ${summary.rated} rated ${summary.rated === 1 ? 'recipe' : 'recipes'}` : 'Add a rating after your next cook.'}</p></div>
      <div><dt>Starred recipes</dt><dd data-testid="starred-count">{summary.starred}</dd><Link to="/cookbook/starred">Visit your favorites →</Link></div>
    </dl>
    {summary.total === 0 && <div className="dashboard-empty"><h2>Your first dinner is the start.</h2><p>Save a recipe to start filling your cookbook.</p><Link to="/cookbook/new">Add your first recipe →</Link></div>}
    <section className="rating-panel" aria-labelledby="rating-heading"><h2 id="rating-heading">Recipes by rating</h2><p>Each recipe counts once. Unrated recipes are excluded from the average.</p>
      <div className="rating-chart" aria-hidden="true"><ResponsiveContainer width="100%" height={280} minWidth={0} initialDimension={{ width: 600, height: 280 }}><BarChart accessibilityLayer={false} data={summary.distribution} margin={{ top: 16, right: 12, left: 0, bottom: 8 }}><CartesianGrid vertical={false} stroke="#e2d7c7"/><XAxis dataKey="label" tickLine={false} axisLine={false} interval={0}/><YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} domain={[0, 'auto']}/><Tooltip cursor={{ fill: '#f1e7d8' }}/><Bar dataKey="count" name="Recipes" fill="#a9432e" radius={[5, 5, 0, 0]} isAnimationActive={false}/></BarChart></ResponsiveContainer></div>
      <table className="rating-counts"><caption>Recipe counts by rating</caption><thead><tr><th scope="col">Rating</th><th scope="col">Recipes</th></tr></thead><tbody>{summary.distribution.map(bucket => <tr key={bucket.label}><th scope="row">{bucket.label === 'Unrated' ? bucket.label : `${bucket.label} / 5`}</th><td>{bucket.count}</td></tr>)}</tbody></table>
    </section>
  </>;
}
