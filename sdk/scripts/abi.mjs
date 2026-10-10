// Regenerates src/abi/<Name>.ts from the Foundry build output (run `forge build` in contracts/ first).
import { readFileSync, writeFileSync } from 'node:fs';

const names = ['OutcomeSeries', 'OutcomeToken', 'PythResolver', 'CREResolver', 'CREFxResolver'];

for (const name of names) {
  const file = new URL(`../../contracts/out/${name}.sol/${name}.json`, import.meta.url);
  const { abi } = JSON.parse(readFileSync(file, 'utf8'));
  const id = name.replace(/^[A-Z]+(?=[A-Z][a-z])|^[A-Z]/, (m) => m.toLowerCase()) + 'Abi';
  writeFileSync(new URL(`../src/abi/${name}.ts`, import.meta.url), `export const ${id} = ${JSON.stringify(abi, null, 2)} as const;\n`);
  console.log('wrote', name);
}
