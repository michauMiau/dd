#!/usr/bin/env node
/**
 * Every $('#id') and getElementById('id') in a script must resolve to an
 * element that actually exists in the HTML.
 *
 * This is the failure that really happens when someone renames an id: the app
 * boots, and later throws a null dereference with no useful message. A linter
 * grades style; this grades a break that ships.
 *
 * Usage: node scripts/check-ids.mjs [--verbose]
 * Exit: 0 all ids resolve, 1 otherwise.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const verbose = process.argv.includes('--verbose');

const targets = [{ script: 'kzones/app.js', html: 'kzones/index.html' }];

/** Collect ids present in the HTML. */
function idsInHtml(html) {
  const ids = new Set();
  // match id="..." in any attribute position; excludes id= inside comments is
  // not worth it here since these files have no such comments
  for (const m of html.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)) ids.add(m[1]);
  return ids;
}

/** Collect ids a script looks up. */
function idsInScript(src) {
  const found = new Map(); // id -> [lineNo, ...]
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    const patterns = [
      /\$\(\s*['"]([^'"]+)['"]\s*\)/g,                 // $('id')
      /getElementById\(\s*['"]([^'"]+)['"]\s*\)/g,     // getElementById('id')
      /querySelector\(\s*['"]#([A-Za-z0-9_-]+)['"]\s*\)/g, // querySelector('#id')
    ];
    for (const re of patterns) {
      for (const m of line.matchAll(re)) {
        if (!found.has(m[1])) found.set(m[1], []);
        found.get(m[1]).push(i + 1);
      }
    }
  });
  return found;
}

let failures = 0;

for (const { script, html } of targets) {
  const scriptSrc = readFileSync(join(root, script), 'utf8');
  const htmlSrc = readFileSync(join(root, html), 'utf8');
  const available = idsInHtml(htmlSrc);
  const used = idsInScript(scriptSrc);

  const missing = [...used.entries()].filter(([id]) => !available.has(id));

  for (const [id, lines] of [...used.entries()].sort()) {
    if (verbose) {
      const ok = available.has(id);
      console.log(`  ${ok ? 'ok  ' : 'MISS'} ${id}  (${script}:${lines.join(',')})`);
    }
  }

  if (missing.length) {
    failures += missing.length;
    console.error(`\n${script} refers to ${missing.length} id(s) that ${html} does not define:`);
    for (const [id, lines] of missing) {
      console.error(`  #${id}  — looked up at ${script}:${lines.join(', ')}`);
    }
    console.error('\nA renamed or deleted id fails at runtime with a null dereference.');
    console.error('Add the element to the HTML, or update the lookup in the script.');
  } else {
    console.log(`${script}: all ${used.size} id lookups resolve in ${html}`);
  }
}

if (failures) {
  console.error(`\n${failures} unresolved id lookup(s).`);
  process.exit(1);
}
console.log('\nid check passed');