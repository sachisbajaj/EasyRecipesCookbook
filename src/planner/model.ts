import { today, validDate } from '../notes/model';
export type Meal = { id: string; user_id: string; recipe_id: string; planned_date: string; servings: number };
export type MealValues = Pick<Meal, 'recipe_id' | 'planned_date' | 'servings'>;
export interface PlannerService {
  list(owner: string, week: string): Promise<Meal[]>;
  save(owner: string, values: MealValues, id: string | null): Promise<Meal>;
  remove(owner: string, id: string): Promise<void>;
}
export function addDays(day: string, offset: number) {
  const date = new Date(`${day}T12:00:00Z`); date.setUTCDate(date.getUTCDate()+offset);
  const result = date.toISOString().slice(0,10);
  return validDate(result) ? result : null;
}
export function weekOf(day: string): string {
  const safe = validDate(day) ? day : today();
  const weekday = new Date(`${safe}T12:00:00Z`).getUTCDay();
  return addDays(safe, -((weekday+6)%7)) ?? safe;
}
export function selectedWeek(value: string | null) {
  const week = weekOf(value ?? today());
  // Only complete Monday–Sunday weeks are selectable at the calendar limits.
  return addDays(week,6) ? week : weekOf(today());
}
export function weekDays(week: string) { return Array.from({length:7},(_,index)=>addDays(week,index)!); }
export function dateLabel(date: string) { return new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric',timeZone:'UTC'}); }
export function validServings(value: string) { return /^\d+$/.test(value.trim()) && Number(value)>0 && Number(value)<=2147483647; }
