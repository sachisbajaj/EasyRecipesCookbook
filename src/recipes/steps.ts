export type RecipeStep = { name: string; description: string };
const prefix = 'cookbook:steps:v1\n';

export function readSteps(instructions: string): RecipeStep[] {
  if (instructions.startsWith(prefix)) {
    try {
      const value = JSON.parse(instructions.slice(prefix.length));
      if (Array.isArray(value) && value.length && value.every(step =>
        step && typeof step.name === 'string' && typeof step.description === 'string')) return value;
    } catch { /* Keep unrecognized text readable as legacy instructions. */ }
  }
  return [{ name: 'Instructions', description: instructions }];
}

export function writeSteps(steps: RecipeStep[]): string {
  return prefix + JSON.stringify(steps.map(({ name, description }) => ({
    name: name.trim(), description: description.trim(),
  })));
}

export function blankStep() {
  return { key: crypto.randomUUID(), name: '', description: '' };
}
