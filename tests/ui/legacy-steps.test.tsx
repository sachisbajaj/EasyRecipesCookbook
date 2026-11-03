import { expect, it } from 'vitest';
import { readSteps, writeSteps } from '../../src/recipes/steps';

it('names comma-separated actions and keeps ingredient lists together', () => {
  const rows = readSteps('Blend yogurt, cottage cheese, and sauce, then fold in chicken, bake for 15 minutes.');
  expect(rows).toEqual([
    { name: 'Blend', description: 'Blend yogurt, cottage cheese, and sauce' },
    { name: 'Fold in', description: 'then fold in chicken' },
    { name: 'Bake', description: 'bake for 15 minutes.' },
  ]);
  rows[0] = { name: 'Make the base', description: 'Blend yogurt, add sauce slowly.' };
  expect(readSteps(writeSteps(rows))).toEqual(rows);
});

it('preserves unsplit text and keeps an opening qualifier with its action', () => {
  for (const text of ['Blend yogurt, cheese, and sauce.', 'Once hot, add oil.', 'Bake until golden.']) {
    expect(readSteps(text)).toEqual([{ name: 'Instructions', description: text }]);
  }
  expect(readSteps('Once hot, add oil, fry the onions')[0]).toEqual({
    name: 'Add', description: 'Once hot, add oil',
  });
});
