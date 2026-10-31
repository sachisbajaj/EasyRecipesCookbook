export type CookingNote = { id: string; recipe_id: string; cooked_on: string; what_worked: string | null; next_time: string | null; created_at: string };
export type NoteValues = Pick<CookingNote, 'cooked_on' | 'what_worked' | 'next_time'>;
export interface NotesService {
  list(recipeId: string): Promise<CookingNote[]>;
  save(recipeId: string, values: NoteValues, id: string | null): Promise<CookingNote>;
  remove(recipeId: string, id: string): Promise<void>;
}
export function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}
export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === value;
}
export function orderNotes(notes: CookingNote[]) {
  return [...notes].sort((a,b) => b.cooked_on.localeCompare(a.cooked_on) || b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
}
