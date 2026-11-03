export type RecipeStep = { name: string; description: string };
const prefix = 'cookbook:steps:v1\n';

// Only start a row at a recognizable cooking action. Other commas stay in the description.
const cookingAction = /^(?:(?:and then|then|and|finally)\s+)?(break up|fold in|stir in|mix in|bring to a boil|let rest|add|assemble|bake|beat|blend|boil|brown|brush|chill|chop|coat|combine|cook|cool|cover|dice|drain|drizzle|fry|garnish|grate|grill|heat|knead|line|marinate|mash|melt|mince|mix|peel|place|pour|preheat|prepare|press|reduce|refrigerate|rinse|roast|roll|sauté|saute|season|sear|serve|shape|simmer|slice|soak|spread|sprinkle|steam|stir|strain|toast|toss|transfer|whisk)\b/iu;

function legacySteps(instructions: string): RecipeStep[] {
  const parts = instructions.split(',');
  const rows: RecipeStep[] = [];
  for (const part of parts) {
    const action = cookingAction.exec(part.trimStart())?.[1];
    if (action) {
      rows.push({ name: action[0].toUpperCase() + action.slice(1).toLowerCase(), description: part });
    } else if (rows.length) {
      rows[rows.length - 1].description += ',' + part;
    } else {
      // A leading qualifier like “Once hot, add oil” belongs with its action.
      rows.push({ name: 'Instructions', description: part });
    }
  }
  if (rows.length > 1 && rows[0].name === 'Instructions') {
    const lead = rows.shift()!;
    rows[0].description = lead.description + ',' + rows[0].description;
  }
  return rows.length > 1
    ? rows.map(row => ({ ...row, description: row.description.trim() }))
    : [{ name: 'Instructions', description: instructions }];
}

export function readSteps(instructions: string): RecipeStep[] {
  if (instructions.startsWith(prefix)) {
    try {
      const value = JSON.parse(instructions.slice(prefix.length));
      if (Array.isArray(value) && value.length && value.every(step =>
        step && typeof step.name === 'string' && typeof step.description === 'string')) return value;
    } catch { /* Keep unrecognized text readable as legacy instructions. */ }
  }
  return legacySteps(instructions);
}

export function writeSteps(steps: RecipeStep[]): string {
  return prefix + JSON.stringify(steps.map(({ name, description }) => ({
    name: name.trim(), description: description.trim(),
  })));
}

export function blankStep() {
  return { key: crypto.randomUUID(), name: '', description: '' };
}
